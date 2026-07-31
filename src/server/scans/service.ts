import { randomUUID } from "node:crypto";

import type { ScanRecord, SourceMetadata } from "@/server/scans/contracts";
import {
  compareDeployments,
  parseDesiredDeployment,
} from "@/server/scans/deployment";
import { safeScanError, ScanExecutionError } from "@/server/scans/errors";
import type { DesiredStateReader } from "@/server/scans/github";
import type { LiveDeploymentReader } from "@/server/scans/kubernetes";
import { noOpScanLogger, type ScanLogger } from "@/server/scans/log";
import type { ScanRepository } from "@/server/scans/repository";

export type Clock = () => string;
export type IdFactory = () => string;

export class ScanService {
  private activeScanId: string | null = null;
  private readonly volatileFailures = new Map<string, ScanRecord>();

  constructor(
    private readonly repository: ScanRepository,
    private readonly desiredState: DesiredStateReader,
    private readonly liveState: LiveDeploymentReader,
    private readonly sourceMetadata: SourceMetadata,
    private readonly clock: Clock = () => new Date().toISOString(),
    private readonly idFactory: IdFactory = randomUUID,
    private readonly logger: ScanLogger = noOpScanLogger,
  ) {}

  source(): SourceMetadata {
    return this.sourceMetadata;
  }

  start(requestedRef: string): ScanRecord {
    if (this.activeScanId !== null) {
      throw new ScanExecutionError("SCAN_ACTIVE");
    }

    const id = this.idFactory();
    this.activeScanId = id;
    try {
      const scan = this.repository.createQueued(id, requestedRef, this.clock());
      this.logger.stage(id, "QUEUED");
      return scan;
    } catch (error) {
      this.activeScanId = null;
      throw error;
    }
  }

  async run(id: string): Promise<void> {
    if (this.activeScanId !== id) {
      return;
    }

    try {
      this.repository.transition(
        id,
        "LOADING_DESIRED",
        "RUNNING",
        this.clock(),
      );
      this.logger.stage(id, "LOADING_DESIRED");
      const queued = this.repository.get(id);
      if (!queued) {
        throw new ScanExecutionError("SCAN_NOT_FOUND");
      }

      const desiredSource = await this.desiredState.load(queued.requestedRef);
      const desired = parseDesiredDeployment(desiredSource.yaml);
      this.repository.saveDesired(
        id,
        desiredSource.resolvedSha,
        desired.target,
        desired.projection,
        this.clock(),
      );
      this.logger.stage(id, "READING_LIVE");

      const live = await this.liveState.read(desired.target);
      this.repository.saveLive(id, live, this.clock());
      this.logger.stage(id, "COMPARING");
      const result = compareDeployments(desired.projection, live);

      this.repository.transition(id, "SAVING_RESULT", "RUNNING", this.clock());
      this.logger.stage(id, "SAVING_RESULT");
      this.repository.complete(id, result, this.clock());
      this.logger.stage(id, "COMPLETED");
    } catch (error) {
      const safeError = safeScanError(error);
      try {
        this.repository.fail(id, safeError, this.clock());
        this.logger.failed(id, safeError.code, true);
      } catch {
        this.recordVolatileStorageFailure(id);
        this.logger.failed(id, "STORAGE_WRITE_FAILED", false);
      }
    } finally {
      this.activeScanId = null;
    }
  }

  get(id: string): ScanRecord | null {
    return this.volatileFailures.get(id) ?? this.repository.get(id);
  }

  list(limit: number): ScanRecord[] {
    const durable = this.repository.list(limit);
    return durable.map(
      (record) => this.volatileFailures.get(record.id) ?? record,
    );
  }

  private recordVolatileStorageFailure(id: string): void {
    let record: ScanRecord | null = null;
    try {
      record = this.repository.get(id);
    } catch {
      // The API will surface repository unavailability if reads also fail.
    }
    if (!record) {
      return;
    }

    const at = this.clock();
    this.volatileFailures.set(id, {
      ...record,
      completedAt: at,
      durable: false,
      error: new ScanExecutionError("STORAGE_WRITE_FAILED").toSafeError(),
      stage: "FAILED",
      status: "FAILED",
      updatedAt: at,
    });
    if (this.volatileFailures.size > 50) {
      const oldest = this.volatileFailures.keys().next().value as
        string | undefined;
      if (oldest) {
        this.volatileFailures.delete(oldest);
      }
    }
  }
}
