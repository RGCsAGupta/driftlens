import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplanationService } from "@/server/scans/explanation";
import { SqliteScanRepository } from "@/server/scans/repository";

const directories: string[] = [];

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "driftlens-"));
  directories.push(directory);
  return join(directory, "history.sqlite");
}

function createSchemaV1Database(path: string): void {
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE scans (
      id TEXT PRIMARY KEY,
      requested_ref TEXT NOT NULL,
      resolved_sha TEXT,
      target_api_version TEXT,
      target_kind TEXT,
      target_namespace TEXT,
      target_name TEXT,
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      outcome TEXT,
      desired_json TEXT,
      live_json TEXT,
      differences_json TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    ) STRICT;
    CREATE TABLE scan_stages (
      scan_id TEXT NOT NULL REFERENCES scans(id),
      position INTEGER NOT NULL,
      stage TEXT NOT NULL,
      at TEXT NOT NULL,
      PRIMARY KEY (scan_id, position)
    ) STRICT;
    CREATE INDEX scans_created_at_idx ON scans(created_at DESC);
    PRAGMA user_version = 1;
  `);
  database
    .prepare(
      `INSERT INTO scans (
        id, requested_ref, resolved_sha, target_api_version, target_kind,
        target_namespace, target_name, status, stage, outcome, desired_json,
        live_json, differences_json, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "scan-v1",
      "main",
      "0123456789abcdef0123456789abcdef01234567",
      "apps/v1",
      "Deployment",
      "demo",
      "api",
      "COMPLETED",
      "COMPLETED",
      "DRIFTED",
      JSON.stringify({
        containers: [{ image: "api:2", name: "api" }],
        replicas: 2,
      }),
      JSON.stringify({
        containers: [{ image: "api:1", name: "api" }],
        replicas: 1,
      }),
      JSON.stringify([{ desired: 2, field: "spec.replicas", live: 1 }]),
      "2026-07-31T00:00:00.000Z",
      "2026-07-31T00:00:01.000Z",
      "2026-07-31T00:00:01.000Z",
    );
  database
    .prepare(
      `INSERT INTO scan_stages (scan_id, position, stage, at)
       VALUES (?, ?, ?, ?)`,
    )
    .run("scan-v1", 0, "COMPLETED", "2026-07-31T00:00:01.000Z");
  database.close();
}

function openAsLastKnownGoodBinary(path: string): DatabaseSync {
  const database = new DatabaseSync(path);
  const row = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (row.user_version !== 1) {
    database.close();
    throw new Error(`Unsupported database schema version: ${row.user_version}`);
  }
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("SqliteScanRepository", () => {
  it("bootstraps rollback-compatible schema version one idempotently", () => {
    const path = databasePath();
    const first = new SqliteScanRepository(path);
    first.createQueued("scan-1", "main", "2026-07-31T00:00:00.000Z");
    first.close();

    const second = new SqliteScanRepository(path);
    const beforeProbe = second.get("scan-1");
    second.checkWritable();
    expect(second.get("scan-1")).toMatchObject({
      id: "scan-1",
      requestedRef: "main",
      stage: "QUEUED",
      status: "QUEUED",
    });
    expect(second.get("scan-1")).toEqual(beforeProbe);
    second.close();

    const inspection = new DatabaseSync(path, { readOnly: true });
    expect(inspection.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 1,
    });
    inspection.close();
  });

  it("migrates genuine schema v1 history and reuses a saved explanation after restart", async () => {
    const path = databasePath();
    createSchemaV1Database(path);

    const migrated = new SqliteScanRepository(path);
    const original = migrated.get("scan-v1");
    expect(original).toMatchObject({
      differences: [{ desired: 2, field: "spec.replicas", live: 1 }],
      explanation: { state: "NOT_REQUESTED" },
      id: "scan-v1",
      outcome: "DRIFTED",
      requestedRef: "main",
      status: "COMPLETED",
    });
    migrated.requestExplanation("scan-v1", "2026-07-31T00:00:02.000Z");
    migrated.saveExplanation(
      "scan-v1",
      {
        importantDifferences: ["Replica count differs."],
        investigationChecks: ["Review rollout history."],
        likelyImplications: ["Capacity may differ."],
        limitations: ["Only supported fields were analyzed."],
        summary: "Supported-field drift exists.",
      },
      "2026-07-31T00:00:03.000Z",
    );
    migrated.close();

    const restarted = new SqliteScanRepository(path);
    expect(restarted.list(10)).toHaveLength(1);
    const saved = restarted.get("scan-v1");
    expect(saved).toMatchObject({
      desired: original?.desired,
      differences: original?.differences,
      explanation: {
        analysis: { summary: "Supported-field drift exists." },
        error: null,
        requestedAt: "2026-07-31T00:00:02.000Z",
        savedAt: "2026-07-31T00:00:03.000Z",
        state: "SAVED",
      },
      live: original?.live,
      outcome: original?.outcome,
      stages: original?.stages,
      status: original?.status,
      target: original?.target,
    });
    const analyze = vi.fn().mockRejectedValue(new Error("must not be called"));
    const restartedService = new ExplanationService(restarted, { analyze });
    await expect(restartedService.explain("scan-v1")).resolves.toEqual(saved);
    expect(analyze).not.toHaveBeenCalled();
    restarted.close();

    const inspection = new DatabaseSync(path, { readOnly: true });
    expect(inspection.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 1,
    });
    inspection.close();
  });

  it("keeps a migrated database usable by the last-known-good binary", () => {
    const path = databasePath();
    createSchemaV1Database(path);

    const migrated = new SqliteScanRepository(path);
    migrated.requestExplanation("scan-v1", "2026-07-31T00:00:02.000Z");
    migrated.close();

    const preCorrection = new DatabaseSync(path);
    preCorrection.exec("PRAGMA user_version = 2");
    preCorrection.close();
    expect(() => openAsLastKnownGoodBinary(path)).toThrow(
      "Unsupported database schema version: 2",
    );

    const corrected = new SqliteScanRepository(path);
    corrected.close();

    const rolledBack = openAsLastKnownGoodBinary(path);
    rolledBack.exec("BEGIN IMMEDIATE");
    rolledBack
      .prepare(
        `INSERT INTO scans (
          id, requested_ref, status, stage, created_at, updated_at
        ) VALUES (?, ?, 'QUEUED', 'QUEUED', ?, ?)`,
      )
      .run(
        "rollback-readiness",
        "readiness-probe",
        "1970-01-01T00:00:00.000Z",
        "1970-01-01T00:00:00.000Z",
      );
    rolledBack.exec("ROLLBACK");
    expect(
      rolledBack
        .prepare(
          `SELECT id, requested_ref, status, stage, outcome, desired_json,
            live_json, differences_json, error_code, error_message,
            created_at, updated_at, completed_at
          FROM scans WHERE id = ?`,
        )
        .get("scan-v1"),
    ).toMatchObject({
      id: "scan-v1",
      outcome: "DRIFTED",
      requested_ref: "main",
      status: "COMPLETED",
    });
    rolledBack.close();
  });

  it("binds injection-shaped values and preserves ordered append-only stages", () => {
    const repository = new SqliteScanRepository(":memory:");
    const requestedRef = "main'); DROP TABLE scans; --";
    repository.createQueued(
      "scan-injection",
      requestedRef,
      "2026-07-31T00:00:00.000Z",
    );
    repository.transition(
      "scan-injection",
      "LOADING_DESIRED",
      "RUNNING",
      "2026-07-31T00:00:01.000Z",
    );
    repository.saveDesired(
      "scan-injection",
      "0123456789abcdef0123456789abcdef01234567",
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: "app",
        namespace: "demo",
      },
      { containers: [{ image: "api:1", name: "api" }], replicas: 1 },
      "2026-07-31T00:00:02.000Z",
    );
    repository.saveLive(
      "scan-injection",
      { containers: [{ image: "api:2", name: "api" }], replicas: 2 },
      "2026-07-31T00:00:03.000Z",
    );
    repository.transition(
      "scan-injection",
      "SAVING_RESULT",
      "RUNNING",
      "2026-07-31T00:00:04.000Z",
    );
    repository.complete(
      "scan-injection",
      {
        differences: [{ desired: 1, field: "spec.replicas", live: 2 }],
        outcome: "DRIFTED",
      },
      "2026-07-31T00:00:05.000Z",
    );

    expect(repository.get("scan-injection")).toMatchObject({
      differences: [{ desired: 1, field: "spec.replicas", live: 2 }],
      durable: true,
      outcome: "DRIFTED",
      requestedRef,
      stages: [
        { at: "2026-07-31T00:00:00.000Z", stage: "QUEUED" },
        { at: "2026-07-31T00:00:01.000Z", stage: "LOADING_DESIRED" },
        { at: "2026-07-31T00:00:02.000Z", stage: "READING_LIVE" },
        { at: "2026-07-31T00:00:03.000Z", stage: "COMPARING" },
        { at: "2026-07-31T00:00:04.000Z", stage: "SAVING_RESULT" },
        { at: "2026-07-31T00:00:05.000Z", stage: "COMPLETED" },
      ],
      status: "COMPLETED",
    });
    repository.close();
  });

  it("returns bounded newest-first history in one query contract", () => {
    const repository = new SqliteScanRepository(":memory:");
    repository.createQueued("old", "main", "2026-07-31T00:00:00.000Z");
    repository.createQueued("middle", "main", "2026-07-31T00:00:01.000Z");
    repository.createQueued("new", "main", "2026-07-31T00:00:02.000Z");

    expect(repository.list(2).map(({ id }) => id)).toEqual(["new", "middle"]);
    repository.close();
  });

  it("does not depend on a post-commit read to return a queued scan", () => {
    const repository = new SqliteScanRepository(":memory:");
    const get = vi.spyOn(repository, "get").mockImplementation(() => {
      throw new Error("injected read failure");
    });

    expect(
      repository.createQueued("queued", "main", "2026-07-31T00:00:00.000Z"),
    ).toMatchObject({
      id: "queued",
      stages: [{ stage: "QUEUED" }],
      status: "QUEUED",
    });
    expect(get).not.toHaveBeenCalled();
    repository.close();
  });

  it("persists safe terminal failures without upstream detail", () => {
    const repository = new SqliteScanRepository(":memory:");
    repository.createQueued("failed", "main", "2026-07-31T00:00:00.000Z");
    repository.fail(
      "failed",
      { code: "GITHUB_UNAVAILABLE", message: "GitHub is unavailable." },
      "2026-07-31T00:00:01.000Z",
    );

    expect(repository.get("failed")).toMatchObject({
      error: {
        code: "GITHUB_UNAVAILABLE",
        message: "GitHub is unavailable.",
      },
      stage: "FAILED",
      status: "FAILED",
    });
    repository.close();
  });
});
