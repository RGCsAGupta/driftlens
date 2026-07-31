import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SqliteScanRepository } from "@/server/scans/repository";

const directories: string[] = [];

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "driftlens-"));
  directories.push(directory);
  return join(directory, "history.sqlite");
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("SqliteScanRepository", () => {
  it("bootstraps schema version one idempotently and preserves restart history", () => {
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
