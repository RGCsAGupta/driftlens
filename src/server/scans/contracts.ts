import { z } from "zod";

function containsUnsafeRefCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 || character.trim() === "";
  });
}

export const scanStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);
export type ScanStatus = z.infer<typeof scanStatusSchema>;

export const scanStageSchema = z.enum([
  "QUEUED",
  "LOADING_DESIRED",
  "READING_LIVE",
  "COMPARING",
  "SAVING_RESULT",
  "COMPLETED",
  "FAILED",
]);
export type ScanStage = z.infer<typeof scanStageSchema>;

export const comparisonOutcomeSchema = z.enum([
  "IN_SYNC",
  "DRIFTED",
  "MISSING_LIVE",
]);
export type ComparisonOutcome = z.infer<typeof comparisonOutcomeSchema>;

export const startScanSchema = z
  .object({
    ref: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => !containsUnsafeRefCharacter(value), {
        message: "ref must not contain whitespace or control characters",
      }),
  })
  .strict();

export const historyLimitSchema = z.coerce.number().int().min(1).max(50);

export interface DeploymentTarget {
  apiVersion: "apps/v1";
  kind: "Deployment";
  name: string;
  namespace: string;
}

export interface ContainerProjection {
  image: string;
  name: string;
}

export interface DeploymentProjection {
  containers: ContainerProjection[];
  replicas: number;
}

export interface Difference {
  desired: number | string;
  field: string;
  live: number | string | null;
}

export interface ComparisonResult {
  differences: Difference[];
  outcome: ComparisonOutcome;
}

export interface SafeScanError {
  code: ScanErrorCode;
  message: string;
}

export type ScanErrorCode =
  | "CONFIGURATION_INVALID"
  | "GITHUB_FILE_NOT_FOUND"
  | "GITHUB_REF_NOT_FOUND"
  | "GITHUB_RESPONSE_INVALID"
  | "GITHUB_TIMEOUT"
  | "GITHUB_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "KUBERNETES_FORBIDDEN"
  | "KUBERNETES_TIMEOUT"
  | "KUBERNETES_UNAVAILABLE"
  | "MANIFEST_INVALID"
  | "MANIFEST_UNSUPPORTED"
  | "SCAN_ACTIVE"
  | "SCAN_NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_WRITE_FAILED";

export interface StageRecord {
  at: string;
  stage: ScanStage;
}

export interface ScanRecord {
  completedAt: string | null;
  createdAt: string;
  differences: Difference[];
  durable: boolean;
  error: SafeScanError | null;
  id: string;
  live: DeploymentProjection | null;
  outcome: ComparisonOutcome | null;
  requestedRef: string;
  resolvedSha: string | null;
  stage: ScanStage;
  stages: StageRecord[];
  status: ScanStatus;
  target: DeploymentTarget | null;
  updatedAt: string;
  desired: DeploymentProjection | null;
}

export interface SourceMetadata {
  manifestPath: string;
  repository: string;
}
