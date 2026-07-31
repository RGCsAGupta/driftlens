import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import {
  comparisonOutcomeSchema,
  historyLimitSchema,
  scanStageSchema,
  scanStatusSchema,
  startScanSchema,
} from "@/server/scans/contracts";

interface SchemaObject {
  additionalProperties?: boolean;
  default?: number;
  enum?: string[];
  maximum?: number;
  maxLength?: number;
  minimum?: number;
  minLength?: number;
  pattern?: string;
  properties?: Record<string, SchemaObject>;
  "x-normalized-max-length"?: number;
  "x-normalized-min-length"?: number;
}

interface OperationObject {
  parameters?: Array<{ name: string; schema: SchemaObject }>;
  requestBody?: {
    content: { "application/json": { schema: { $ref: string } } };
  };
  responses: Record<string, unknown>;
  "x-max-request-body-bytes"?: number;
}

interface OpenApiDocument {
  components: { schemas: Record<string, SchemaObject> };
  jsonSchemaDialect: string;
  openapi: string;
  paths: Record<string, Record<string, OperationObject>>;
  security: unknown[];
}

const contractPath = fileURLToPath(
  new URL("../../../docs/openapi.yaml", import.meta.url),
);
const contract = parse(readFileSync(contractPath, "utf8")) as OpenApiDocument;

function responseStatuses(operation: OperationObject): string[] {
  return Object.keys(operation.responses).sort();
}

describe("OpenAPI scan contract", () => {
  it("is an OpenAPI 3.1 document for exactly the implemented issue routes", () => {
    expect(contract.openapi).toBe("3.1.0");
    expect(contract.jsonSchemaDialect).toBe(
      "https://spec.openapis.org/oas/3.1/dialect/base",
    );
    expect(contract.security).toEqual([]);
    expect(Object.keys(contract.paths).sort()).toEqual([
      "/api/scans",
      "/api/scans/{id}",
      "/api/source",
    ]);
    expect(Object.keys(contract.paths["/api/source"] ?? {})).toEqual(["get"]);
    expect(Object.keys(contract.paths["/api/scans"] ?? {}).sort()).toEqual([
      "get",
      "post",
    ]);
    expect(Object.keys(contract.paths["/api/scans/{id}"] ?? {})).toEqual([
      "get",
    ]);
  });

  it("matches runtime request bounds and normalization", () => {
    const start = contract.paths["/api/scans"]?.post;
    expect(start?.["x-max-request-body-bytes"]).toBe(1_024);
    expect(start?.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/StartScanRequest",
    );

    const ref = contract.components.schemas.StartScanRequest?.properties?.ref;
    expect(ref).toMatchObject({
      "x-normalized-max-length": 200,
      "x-normalized-min-length": 1,
    });
    const rawRefPattern = new RegExp(ref?.pattern ?? "");
    expect(rawRefPattern.test(" main ")).toBe(true);
    expect(rawRefPattern.test("feature branch")).toBe(false);
    expect(rawRefPattern.test(` ${"a".repeat(200)} `)).toBe(true);
    expect(rawRefPattern.test(` ${"a".repeat(201)} `)).toBe(false);
    expect(rawRefPattern.test("main\u0000")).toBe(false);
    expect(
      contract.components.schemas.StartScanRequest?.additionalProperties,
    ).toBe(false);
    expect(startScanSchema.parse({ ref: " main " })).toEqual({ ref: "main" });
    expect(startScanSchema.safeParse({ ref: "feature branch" }).success).toBe(
      false,
    );
    expect(startScanSchema.safeParse({ ref: "a".repeat(201) }).success).toBe(
      false,
    );

    const limit = contract.paths["/api/scans"]?.get?.parameters?.find(
      (parameter) => parameter.name === "limit",
    )?.schema;
    expect(limit).toMatchObject({
      default: 20,
      maximum: 50,
      minimum: 1,
    });
    expect(historyLimitSchema.parse("1")).toBe(1);
    expect(historyLimitSchema.parse("50")).toBe(50);
    expect(historyLimitSchema.safeParse("51").success).toBe(false);
  });

  it("matches runtime enums and response outcomes", () => {
    expect(contract.components.schemas.ScanStatus?.enum).toEqual(
      scanStatusSchema.options,
    );
    expect(contract.components.schemas.ScanStage?.enum).toEqual(
      scanStageSchema.options,
    );
    expect(contract.components.schemas.ComparisonOutcome?.enum).toEqual(
      comparisonOutcomeSchema.options,
    );

    expect(responseStatuses(contract.paths["/api/source"]!.get!)).toEqual([
      "200",
      "500",
      "503",
    ]);
    expect(responseStatuses(contract.paths["/api/scans"]!.get!)).toEqual([
      "200",
      "400",
      "500",
      "503",
    ]);
    expect(responseStatuses(contract.paths["/api/scans"]!.post!)).toEqual([
      "202",
      "400",
      "409",
      "500",
      "503",
    ]);
    expect(responseStatuses(contract.paths["/api/scans/{id}"]!.get!)).toEqual([
      "200",
      "404",
      "500",
      "503",
    ]);
  });

  it("separates API envelope codes from persisted scan failure codes", () => {
    expect(contract.components.schemas.ApiErrorCode?.enum).toEqual([
      "CONFIGURATION_INVALID",
      "INTERNAL_ERROR",
      "INVALID_LIMIT",
      "INVALID_REQUEST",
      "SCAN_ACTIVE",
      "SCAN_NOT_FOUND",
      "STORAGE_UNAVAILABLE",
      "STORAGE_WRITE_FAILED",
    ]);
    expect(contract.components.schemas.ScanErrorCode?.enum).toEqual([
      "CONFIGURATION_INVALID",
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
  });
});
