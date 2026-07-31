import { z } from "zod";

import {
  comparisonOutcomeSchema,
  explanationStateSchema,
  operatorAnalysisSchema,
  scanStageSchema,
  scanStatusSchema,
  type ScanRecord,
  type SourceMetadata,
} from "@/server/scans/contracts";

export class ScanApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScanApiError";
  }
}

export interface ScanApi {
  explainScan(id: string): Promise<ScanRecord>;
  getScan(id: string): Promise<ScanRecord>;
  getSource(): Promise<SourceMetadata>;
  listScans(): Promise<ScanRecord[]>;
  startScan(ref: string): Promise<ScanRecord>;
}

const boundedString = z.string().min(1).max(2_048);
const apiErrorCodeSchema = z.enum([
  "CONFIGURATION_INVALID",
  "EXPLANATION_NOT_ELIGIBLE",
  "EXPLANATION_TERMINAL",
  "INTERNAL_ERROR",
  "INVALID_LIMIT",
  "INVALID_REQUEST",
  "SCAN_ACTIVE",
  "SCAN_NOT_FOUND",
  "STORAGE_UNAVAILABLE",
  "STORAGE_WRITE_FAILED",
]);
const scanErrorCodeSchema = z.enum([
  "CONFIGURATION_INVALID",
  "EXPLANATION_NOT_ELIGIBLE",
  "EXPLANATION_TERMINAL",
  "GITHUB_FILE_NOT_FOUND",
  "GITHUB_REF_NOT_FOUND",
  "GITHUB_RESPONSE_INVALID",
  "GITHUB_TIMEOUT",
  "GITHUB_UNAVAILABLE",
  "INTERNAL_ERROR",
  "KUBERNETES_FORBIDDEN",
  "KUBERNETES_TIMEOUT",
  "KUBERNETES_UNAVAILABLE",
  "MANIFEST_INVALID",
  "MANIFEST_UNSUPPORTED",
  "SCAN_ACTIVE",
  "SCAN_NOT_FOUND",
  "STORAGE_UNAVAILABLE",
  "STORAGE_WRITE_FAILED",
]);
const errorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string().min(1).max(500),
  }),
});
const targetSchema = z.strictObject({
  apiVersion: z.literal("apps/v1"),
  kind: z.literal("Deployment"),
  name: boundedString,
  namespace: boundedString,
});
const projectionSchema = z.strictObject({
  containers: z
    .array(z.strictObject({ image: boundedString, name: boundedString }))
    .max(500),
  replicas: z.number().int().nonnegative(),
});
const differenceValueSchema = z.union([boundedString, z.number().finite()]);
const scanRecordSchema = z.strictObject({
  completedAt: z.string().min(1).max(40).nullable(),
  createdAt: z.string().min(1).max(40),
  desired: projectionSchema.nullable(),
  differences: z
    .array(
      z.strictObject({
        desired: differenceValueSchema,
        field: boundedString,
        live: differenceValueSchema.nullable(),
      }),
    )
    .max(500),
  durable: z.boolean(),
  error: z
    .strictObject({
      code: scanErrorCodeSchema,
      message: z.string().min(1).max(500),
    })
    .nullable(),
  explanation: z.strictObject({
    analysis: operatorAnalysisSchema.nullable(),
    error: z
      .strictObject({
        code: z.enum([
          "AI_CONFIGURATION_INVALID",
          "AI_INCOMPLETE",
          "AI_INVALID_RESPONSE",
          "AI_PROVIDER_UNAVAILABLE",
          "AI_REFUSED",
          "AI_TIMEOUT",
        ]),
        message: z.string().min(1).max(500),
      })
      .nullable(),
    requestedAt: z.string().min(1).max(40).nullable(),
    savedAt: z.string().min(1).max(40).nullable(),
    state: explanationStateSchema,
  }),
  id: z.string().uuid(),
  live: projectionSchema.nullable(),
  outcome: comparisonOutcomeSchema.nullable(),
  requestedRef: z.string().min(1).max(200),
  resolvedSha: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable(),
  stage: scanStageSchema,
  stages: z
    .array(
      z.strictObject({
        at: z.string().min(1).max(40),
        stage: scanStageSchema,
      }),
    )
    .min(1)
    .max(32),
  status: scanStatusSchema,
  target: targetSchema.nullable(),
  updatedAt: z.string().min(1).max(40),
});
const scanEnvelopeSchema = z.strictObject({ scan: scanRecordSchema });
const scanListEnvelopeSchema = z.strictObject({
  scans: z.array(scanRecordSchema).max(50),
});
const sourceEnvelopeSchema = z.strictObject({
  source: z.strictObject({
    manifestPath: z.string().min(1).max(1_024),
    repository: z.string().min(1).max(300),
  }),
});

function invalidResponse(): ScanApiError {
  return new ScanApiError(
    "INVALID_RESPONSE",
    "The scan service returned an invalid response.",
  );
}

async function requestJson(
  fetcher: typeof fetch,
  input: string,
  init?: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(input, init);
  } catch {
    throw new ScanApiError(
      "TRANSPORT_ERROR",
      "DriftLens could not reach the scan service.",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw invalidResponse();
  }
  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(body);
    if (!parsed.success) throw invalidResponse();
    throw new ScanApiError(parsed.data.error.code, parsed.data.error.message);
  }
  return body;
}

function scanEnvelope(value: unknown): ScanRecord {
  const parsed = scanEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw invalidResponse();
  return parsed.data.scan;
}

export function createScanApi(fetcher: typeof fetch = fetch): ScanApi {
  return {
    async explainScan(id) {
      return scanEnvelope(
        await requestJson(
          fetcher,
          `/api/scans/${encodeURIComponent(id)}/explanation`,
          { method: "POST" },
        ),
      );
    },
    async getScan(id) {
      return scanEnvelope(
        await requestJson(fetcher, `/api/scans/${encodeURIComponent(id)}`),
      );
    },
    async getSource() {
      const parsed = sourceEnvelopeSchema.safeParse(
        await requestJson(fetcher, "/api/source"),
      );
      if (!parsed.success) throw invalidResponse();
      return parsed.data.source;
    },
    async listScans() {
      const parsed = scanListEnvelopeSchema.safeParse(
        await requestJson(fetcher, "/api/scans?limit=20"),
      );
      if (!parsed.success) throw invalidResponse();
      return parsed.data.scans;
    },
    async startScan(ref) {
      return scanEnvelope(
        await requestJson(fetcher, "/api/scans", {
          body: JSON.stringify({ ref }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
    },
  };
}
