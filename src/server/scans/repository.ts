import { DatabaseSync } from "node:sqlite";

import type {
  ComparisonResult,
  DeploymentProjection,
  DeploymentTarget,
  OperatorAnalysis,
  SafeExplanationError,
  SafeScanError,
  ScanRecord,
  ScanStage,
  ScanStatus,
  StageRecord,
} from "@/server/scans/contracts";
import { ScanExecutionError } from "@/server/scans/errors";

export interface ScanRepository {
  checkWritable(): void;
  complete(id: string, result: ComparisonResult, at: string): void;
  createQueued(id: string, requestedRef: string, at: string): ScanRecord;
  fail(id: string, error: SafeScanError, at: string): void;
  get(id: string): ScanRecord | null;
  list(limit: number): ScanRecord[];
  failExplanation(id: string, error: SafeExplanationError, at: string): void;
  requestExplanation(id: string, at: string): void;
  saveExplanation(id: string, analysis: OperatorAnalysis, at: string): void;
  saveDesired(
    id: string,
    resolvedSha: string,
    target: DeploymentTarget,
    desired: DeploymentProjection,
    at: string,
  ): void;
  saveLive(id: string, live: DeploymentProjection | null, at: string): void;
  transition(
    id: string,
    stage: ScanStage,
    status: ScanStatus,
    at: string,
  ): void;
}

const READINESS_PROBE_ID = "00000000-0000-0000-0000-000000000000";

interface ScanRow extends Record<string, unknown> {
  completed_at: string | null;
  created_at: string;
  desired_json: string | null;
  differences_json: string | null;
  error_code: SafeScanError["code"] | null;
  error_message: string | null;
  explanation_error_code: SafeExplanationError["code"] | null;
  explanation_error_message: string | null;
  explanation_json: string | null;
  explanation_requested_at: string | null;
  explanation_saved_at: string | null;
  explanation_state: ScanRecord["explanation"]["state"];
  id: string;
  live_json: string | null;
  outcome: ScanRecord["outcome"];
  requested_ref: string;
  resolved_sha: string | null;
  stage: ScanStage;
  status: ScanStatus;
  target_api_version: "apps/v1" | null;
  target_kind: "Deployment" | null;
  target_name: string | null;
  target_namespace: string | null;
  updated_at: string;
}

interface JoinedScanRow extends ScanRow {
  stage_at: string | null;
  stage_name: ScanStage | null;
}

const SCAN_COLUMNS = `
  s.id, s.requested_ref, s.resolved_sha,
  s.target_api_version, s.target_kind, s.target_namespace, s.target_name,
  s.status, s.stage, s.outcome, s.desired_json, s.live_json,
  s.differences_json, s.error_code, s.error_message,
  s.explanation_state, s.explanation_json, s.explanation_error_code,
  s.explanation_error_message, s.explanation_requested_at,
  s.explanation_saved_at,
  s.created_at, s.updated_at, s.completed_at
`;

const SCHEMA = `
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
`;

function parseJson<T>(value: string | null, fallback: T): T {
  if (value === null) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new ScanExecutionError("STORAGE_UNAVAILABLE", { cause: error });
  }
}

function recordFromRows(row: ScanRow, stages: StageRecord[]): ScanRecord {
  const target =
    row.target_api_version &&
    row.target_kind &&
    row.target_namespace &&
    row.target_name
      ? {
          apiVersion: row.target_api_version,
          kind: row.target_kind,
          name: row.target_name,
          namespace: row.target_namespace,
        }
      : null;
  const error =
    row.error_code && row.error_message
      ? { code: row.error_code, message: row.error_message }
      : null;

  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    desired: parseJson(row.desired_json, null),
    differences: parseJson(row.differences_json, []),
    durable: true,
    error,
    explanation: {
      analysis: parseJson(row.explanation_json, null),
      error:
        row.explanation_error_code && row.explanation_error_message
          ? {
              code: row.explanation_error_code,
              message: row.explanation_error_message,
            }
          : null,
      requestedAt: row.explanation_requested_at,
      savedAt: row.explanation_saved_at,
      state: row.explanation_state,
    },
    id: row.id,
    live: parseJson(row.live_json, null),
    outcome: row.outcome,
    requestedRef: row.requested_ref,
    resolvedSha: row.resolved_sha,
    stage: row.stage,
    stages,
    status: row.status,
    target,
    updatedAt: row.updated_at,
  };
}

export class SqliteScanRepository implements ScanRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    try {
      this.database = new DatabaseSync(path);
      this.bootstrap();
    } catch (error) {
      throw new ScanExecutionError("STORAGE_UNAVAILABLE", { cause: error });
    }
  }

  close(): void {
    this.database.close();
  }

  checkWritable(): void {
    try {
      this.database.exec("BEGIN IMMEDIATE");
      this.database
        .prepare(
          `INSERT INTO scans (
            id, requested_ref, status, stage, created_at, updated_at
          ) VALUES (?, 'readiness-probe', 'QUEUED', 'QUEUED', ?, ?)`,
        )
        .run(
          READINESS_PROBE_ID,
          "1970-01-01T00:00:00.000Z",
          "1970-01-01T00:00:00.000Z",
        );
      this.database.exec("ROLLBACK");
    } catch (error) {
      this.rollback();
      throw new ScanExecutionError("STORAGE_UNAVAILABLE", { cause: error });
    }
  }

  createQueued(id: string, requestedRef: string, at: string): ScanRecord {
    this.write(() => {
      this.database
        .prepare(
          `INSERT INTO scans (
            id, requested_ref, status, stage, created_at, updated_at
          ) VALUES (?, ?, 'QUEUED', 'QUEUED', ?, ?)`,
        )
        .run(id, requestedRef, at, at);
      this.appendStage(id, "QUEUED", at);
    });

    return {
      completedAt: null,
      createdAt: at,
      desired: null,
      differences: [],
      durable: true,
      error: null,
      explanation: {
        analysis: null,
        error: null,
        requestedAt: null,
        savedAt: null,
        state: "NOT_REQUESTED",
      },
      id,
      live: null,
      outcome: null,
      requestedRef,
      resolvedSha: null,
      stage: "QUEUED",
      stages: [{ at, stage: "QUEUED" }],
      status: "QUEUED",
      target: null,
      updatedAt: at,
    };
  }

  transition(
    id: string,
    stage: ScanStage,
    status: ScanStatus,
    at: string,
  ): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            "UPDATE scans SET stage = ?, status = ?, updated_at = ? WHERE id = ?",
          )
          .run(stage, status, at, id).changes,
      );
      this.appendStage(id, stage, at);
    });
  }

  saveDesired(
    id: string,
    resolvedSha: string,
    target: DeploymentTarget,
    desired: DeploymentProjection,
    at: string,
  ): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            `UPDATE scans SET
              resolved_sha = ?, target_api_version = ?, target_kind = ?,
              target_namespace = ?, target_name = ?, desired_json = ?,
              stage = 'READING_LIVE', status = 'RUNNING', updated_at = ?
            WHERE id = ?`,
          )
          .run(
            resolvedSha,
            target.apiVersion,
            target.kind,
            target.namespace,
            target.name,
            JSON.stringify(desired),
            at,
            id,
          ).changes,
      );
      this.appendStage(id, "READING_LIVE", at);
    });
  }

  saveLive(id: string, live: DeploymentProjection | null, at: string): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            `UPDATE scans SET
              live_json = ?, stage = 'COMPARING', updated_at = ?
            WHERE id = ?`,
          )
          .run(live === null ? null : JSON.stringify(live), at, id).changes,
      );
      this.appendStage(id, "COMPARING", at);
    });
  }

  complete(id: string, result: ComparisonResult, at: string): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            `UPDATE scans SET
              outcome = ?, differences_json = ?, status = 'COMPLETED',
              stage = 'COMPLETED', updated_at = ?, completed_at = ?
            WHERE id = ?`,
          )
          .run(result.outcome, JSON.stringify(result.differences), at, at, id)
          .changes,
      );
      this.appendStage(id, "COMPLETED", at);
    });
  }

  fail(id: string, error: SafeScanError, at: string): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            `UPDATE scans SET
              error_code = ?, error_message = ?, status = 'FAILED',
              stage = 'FAILED', updated_at = ?, completed_at = ?
            WHERE id = ?`,
          )
          .run(error.code, error.message, at, at, id).changes,
      );
      this.appendStage(id, "FAILED", at);
    });
  }

  requestExplanation(id: string, at: string): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            `UPDATE scans SET explanation_state = 'REQUESTED',
              explanation_requested_at = ?
            WHERE id = ? AND status = 'COMPLETED'
              AND explanation_state = 'NOT_REQUESTED'`,
          )
          .run(at, id).changes,
      );
    });
  }

  saveExplanation(id: string, analysis: OperatorAnalysis, at: string): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            `UPDATE scans SET explanation_state = 'SAVED',
              explanation_json = ?, explanation_saved_at = ?
            WHERE id = ? AND explanation_state = 'REQUESTED'`,
          )
          .run(JSON.stringify(analysis), at, id).changes,
      );
    });
  }

  failExplanation(id: string, error: SafeExplanationError, at: string): void {
    this.write(() => {
      this.requireChange(
        this.database
          .prepare(
            `UPDATE scans SET explanation_state = 'FAILED',
              explanation_error_code = ?, explanation_error_message = ?,
              explanation_saved_at = ?
            WHERE id = ? AND explanation_state = 'REQUESTED'`,
          )
          .run(error.code, error.message, at, id).changes,
      );
    });
  }

  get(id: string): ScanRecord | null {
    try {
      const rows = this.database
        .prepare(
          `SELECT ${SCAN_COLUMNS},
            st.stage AS stage_name, st.at AS stage_at
          FROM scans s
          LEFT JOIN scan_stages st ON st.scan_id = s.id
          WHERE s.id = ?
          ORDER BY st.position ASC`,
        )
        .all(id) as JoinedScanRow[];
      if (rows.length === 0) {
        return null;
      }
      return recordFromRows(rows[0]!, this.stageRows(rows));
    } catch (error) {
      throw new ScanExecutionError("STORAGE_UNAVAILABLE", { cause: error });
    }
  }

  list(limit: number): ScanRecord[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT ${SCAN_COLUMNS},
            st.stage AS stage_name, st.at AS stage_at
          FROM (
            SELECT * FROM scans ORDER BY created_at DESC, id DESC LIMIT ?
          ) s
          LEFT JOIN scan_stages st ON st.scan_id = s.id
          ORDER BY s.created_at DESC, s.id DESC, st.position ASC`,
        )
        .all(limit) as JoinedScanRow[];
      const records = new Map<
        string,
        { row: ScanRow; stages: StageRecord[] }
      >();
      for (const row of rows) {
        const entry = records.get(row.id) ?? { row, stages: [] };
        if (row.stage_name && row.stage_at) {
          entry.stages.push({ at: row.stage_at, stage: row.stage_name });
        }
        records.set(row.id, entry);
      }
      return [...records.values()].map(({ row, stages }) =>
        recordFromRows(row, stages),
      );
    } catch (error) {
      throw new ScanExecutionError("STORAGE_UNAVAILABLE", { cause: error });
    }
  }

  private bootstrap(): void {
    this.database.exec("PRAGMA foreign_keys = ON");
    const row = this.database.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    if (row.user_version === 2) {
      return;
    }
    if (row.user_version === 1) {
      this.write(() => {
        this.database.exec(
          `ALTER TABLE scans ADD COLUMN explanation_state TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
           ALTER TABLE scans ADD COLUMN explanation_json TEXT;
           ALTER TABLE scans ADD COLUMN explanation_error_code TEXT;
           ALTER TABLE scans ADD COLUMN explanation_error_message TEXT;
           ALTER TABLE scans ADD COLUMN explanation_requested_at TEXT;
           ALTER TABLE scans ADD COLUMN explanation_saved_at TEXT;`,
        );
        this.database.exec("PRAGMA user_version = 2");
      });
      return;
    }
    if (row.user_version !== 0) {
      throw new Error(
        `Unsupported database schema version: ${row.user_version}`,
      );
    }

    this.write(() => {
      this.database.exec(SCHEMA);
      this.database.exec(
        `ALTER TABLE scans ADD COLUMN explanation_state TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
         ALTER TABLE scans ADD COLUMN explanation_json TEXT;
         ALTER TABLE scans ADD COLUMN explanation_error_code TEXT;
         ALTER TABLE scans ADD COLUMN explanation_error_message TEXT;
         ALTER TABLE scans ADD COLUMN explanation_requested_at TEXT;
         ALTER TABLE scans ADD COLUMN explanation_saved_at TEXT;`,
      );
      this.database.exec("PRAGMA user_version = 2");
    });
  }

  private appendStage(id: string, stage: ScanStage, at: string): void {
    this.database
      .prepare(
        `INSERT INTO scan_stages (scan_id, position, stage, at)
         VALUES (
           ?,
           COALESCE(
             (SELECT MAX(position) + 1 FROM scan_stages WHERE scan_id = ?),
             0
           ),
           ?,
           ?
         )`,
      )
      .run(id, id, stage, at);
  }

  private requireChange(changes: number | bigint): void {
    if (changes !== 1 && changes !== 1n) {
      throw new Error("Scan record was not updated.");
    }
  }

  private stageRows(rows: JoinedScanRow[]): StageRecord[] {
    return rows.flatMap((row) =>
      row.stage_name && row.stage_at
        ? [{ at: row.stage_at, stage: row.stage_name }]
        : [],
    );
  }

  private write(operation: () => void): void {
    try {
      this.database.exec("BEGIN IMMEDIATE");
      operation();
      this.database.exec("COMMIT");
    } catch (error) {
      this.rollback();
      if (error instanceof ScanExecutionError) {
        throw error;
      }
      throw new ScanExecutionError("STORAGE_WRITE_FAILED", { cause: error });
    }
  }

  private rollback(): void {
    try {
      this.database.exec("ROLLBACK");
    } catch {
      // Preserve the original storage failure.
    }
  }
}
