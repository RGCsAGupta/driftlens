import {
  APIConnectionTimeoutError,
  type ClientOptions,
  type OpenAI,
} from "openai";
import { describe, expect, it, vi } from "vitest";

import type {
  ComparisonOutcome,
  OperatorAnalysis,
  SafeExplanationError,
  ScanRecord,
} from "@/server/scans/contracts";
import {
  ExplanationProviderError,
  ExplanationService,
  OpenAIExplanationProvider,
  projectScanForExplanation,
  type ExplanationProjection,
  type ExplanationProvider,
} from "@/server/scans/explanation";
import { ScanExecutionError } from "@/server/scans/errors";
import { SqliteScanRepository } from "@/server/scans/repository";

const ANALYSIS: OperatorAnalysis = {
  importantDifferences: ["Replica count differs."],
  investigationChecks: ["Check the Deployment rollout history."],
  likelyImplications: ["Capacity may differ from the desired state."],
  limitations: ["This analysis uses only supported fields."],
  summary: "The deterministic comparison found supported-field drift.",
};

const PROJECTION: ExplanationProjection = {
  desired: { containers: [{ image: "api:2", name: "api" }], replicas: 2 },
  differences: [{ desired: 2, field: "spec.replicas", live: 1 }],
  live: { containers: [{ image: "api:1", name: "api" }], replicas: 1 },
  outcome: "DRIFTED",
};

function completed(
  repository: SqliteScanRepository,
  outcome: ComparisonOutcome = "DRIFTED",
): ScanRecord {
  repository.createQueued("scan-1", "private-ref", "2026-07-31T00:00:00Z");
  repository.saveDesired(
    "scan-1",
    "0123456789abcdef0123456789abcdef01234567",
    {
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: "private-name",
      namespace: "private-namespace",
    },
    { containers: [{ image: "api:2", name: "api" }], replicas: 2 },
    "2026-07-31T00:00:01Z",
  );
  repository.saveLive(
    "scan-1",
    outcome === "MISSING_LIVE"
      ? null
      : { containers: [{ image: "api:1", name: "api" }], replicas: 1 },
    "2026-07-31T00:00:02Z",
  );
  repository.complete(
    "scan-1",
    {
      differences:
        outcome === "IN_SYNC"
          ? []
          : [
              {
                desired: 2,
                field: "spec.replicas",
                live: outcome === "MISSING_LIVE" ? null : 1,
              },
            ],
      outcome,
    },
    "2026-07-31T00:00:03Z",
  );
  return repository.get("scan-1")!;
}

function deterministicTruth(scan: ScanRecord): string {
  return JSON.stringify({
    desired: scan.desired,
    differences: scan.differences,
    error: scan.error,
    live: scan.live,
    outcome: scan.outcome,
    stage: scan.stage,
    stages: scan.stages,
    status: scan.status,
    target: scan.target,
  });
}

describe("ExplanationService", () => {
  it("excludes live-only containers from the provider projection", () => {
    const repository = new SqliteScanRepository(":memory:");
    const scan = completed(repository);
    const projection = projectScanForExplanation({
      ...scan,
      live: {
        containers: [
          ...scan.live!.containers,
          { image: "mesh:private", name: "injected-sidecar" },
        ],
        replicas: scan.live!.replicas,
      },
    });

    expect(projection.live?.containers).toEqual([
      { image: "api:1", name: "api" },
    ]);
    expect(JSON.stringify(projection)).not.toContain("injected-sidecar");
    repository.close();
  });

  it.each(["IN_SYNC", "DRIFTED", "MISSING_LIVE"] as const)(
    "saves structured analysis for %s without changing deterministic truth",
    async (outcome) => {
      const repository = new SqliteScanRepository(":memory:");
      const before = completed(repository, outcome);
      const analyze = vi.fn().mockResolvedValue(ANALYSIS);
      const service = new ExplanationService(repository, { analyze });

      const after = await service.explain("scan-1");

      expect(after.explanation).toMatchObject({
        analysis: ANALYSIS,
        error: null,
        state: "SAVED",
      });
      expect(deterministicTruth(after)).toBe(deterministicTruth(before));
      expect(analyze).toHaveBeenCalledWith(projectScanForExplanation(before));
      expect(JSON.stringify(analyze.mock.calls[0]?.[0])).not.toMatch(
        /private-ref|private-name|private-namespace|0123456789abcdef/,
      );
      await expect(service.explain("scan-1")).resolves.toEqual(after);
      expect(analyze).toHaveBeenCalledOnce();
      repository.close();
    },
  );

  it.each([
    ["AI_REFUSED", "AI explanation was refused."],
    ["AI_INCOMPLETE", "AI explanation was incomplete."],
    [
      "AI_INVALID_RESPONSE",
      "AI explanation did not match the required structure.",
    ],
    ["AI_TIMEOUT", "AI explanation request timed out."],
    [
      "AI_CONFIGURATION_INVALID",
      "AI explanation configuration is unavailable.",
    ],
    ["AI_PROVIDER_UNAVAILABLE", "AI explanation provider is unavailable."],
  ] as const)(
    "persists terminal safe failure %s without retry",
    async (code, message) => {
      const repository = new SqliteScanRepository(":memory:");
      const before = completed(repository);
      const safe: SafeExplanationError = { code, message };
      const analyze = vi
        .fn<ExplanationProvider["analyze"]>()
        .mockRejectedValue(new ExplanationProviderError(safe));
      const service = new ExplanationService(repository, { analyze });

      const after = await service.explain("scan-1");
      expect(after.explanation).toMatchObject({ error: safe, state: "FAILED" });
      expect(deterministicTruth(after)).toBe(deterministicTruth(before));
      await expect(service.explain("scan-1")).rejects.toMatchObject({
        code: "EXPLANATION_TERMINAL",
      });
      expect(analyze).toHaveBeenCalledOnce();
      repository.close();
    },
  );

  it("rejects an unfinished scan before calling the provider", async () => {
    const repository = new SqliteScanRepository(":memory:");
    repository.createQueued("scan-1", "main", "2026-07-31T00:00:00Z");
    const analyze = vi.fn().mockResolvedValue(ANALYSIS);
    const service = new ExplanationService(repository, { analyze });
    await expect(service.explain("scan-1")).rejects.toEqual(
      new ScanExecutionError("EXPLANATION_NOT_ELIGIBLE"),
    );
    expect(analyze).not.toHaveBeenCalled();
    repository.close();
  });
});

describe("OpenAIExplanationProvider", () => {
  it("uses bounded stored-off structured Responses with zero client retries", async () => {
    const parse = vi.fn().mockResolvedValue({
      output: [],
      output_parsed: ANALYSIS,
      status: "completed",
    });
    const responses = { parse } as unknown as OpenAI["responses"];
    const createClient = vi.fn(
      (_options: ClientOptions): Pick<OpenAI, "responses"> => ({ responses }),
    );
    const provider = new OpenAIExplanationProvider(
      "test-key",
      "gpt-5.6",
      12_000,
      undefined,
      createClient,
    );

    await expect(provider.analyze(PROJECTION)).resolves.toEqual(ANALYSIS);

    expect(createClient).toHaveBeenCalledWith({
      apiKey: "test-key",
      maxRetries: 0,
    });
    expect(parse).toHaveBeenCalledOnce();
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        input: JSON.stringify(PROJECTION),
        max_output_tokens: 900,
        model: "gpt-5.6",
        store: false,
        text: { format: expect.any(Object) },
      }),
      { timeout: 12_000 },
    );
  });

  it.each([
    [
      "refusal",
      {
        output: [
          {
            content: [{ refusal: "refused", type: "refusal" }],
            type: "message",
          },
        ],
        output_parsed: null,
        status: "completed",
      },
      "AI_REFUSED",
    ],
    [
      "incomplete output",
      { output: [], output_parsed: null, status: "incomplete" },
      "AI_INCOMPLETE",
    ],
    [
      "invalid structured output",
      {
        output: [],
        output_parsed: { summary: "partial" },
        status: "completed",
      },
      "AI_INVALID_RESPONSE",
    ],
    ["timeout", new APIConnectionTimeoutError(), "AI_TIMEOUT"],
  ] as const)("classifies %s without retry", async (_name, result, code) => {
    const parse = vi
      .fn()
      .mockImplementation(() =>
        result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result),
      );
    const provider = new OpenAIExplanationProvider(
      "test-key",
      "gpt-5.6",
      12_000,
      { parse } as unknown as OpenAI["responses"],
    );

    await expect(provider.analyze(PROJECTION)).rejects.toMatchObject({
      safe: { code },
    });
    expect(parse).toHaveBeenCalledOnce();
  });

  it("maps generic provider failure to one fixed safe error without retry", async () => {
    const rawDetail = "raw upstream provider detail";
    const parse = vi.fn().mockRejectedValue(new Error(rawDetail));
    const provider = new OpenAIExplanationProvider(
      "test-key",
      "gpt-5.6",
      12_000,
      { parse } as unknown as OpenAI["responses"],
    );

    const failure = await provider.analyze(PROJECTION).then(
      () => {
        throw new Error("Expected provider failure.");
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(ExplanationProviderError);
        return error as ExplanationProviderError;
      },
    );

    expect(failure.safe).toEqual({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "AI explanation provider is unavailable.",
    });
    expect(
      JSON.stringify({ message: failure.message, safe: failure.safe }),
    ).not.toContain(rawDetail);
    expect(parse).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing key", " ", "gpt-5.6"],
    ["missing model", "test-key", " "],
  ])("fails safely for %s", async (_name, apiKey, model) => {
    const provider = new OpenAIExplanationProvider(apiKey, model);

    await expect(provider.analyze(PROJECTION)).rejects.toMatchObject({
      safe: { code: "AI_CONFIGURATION_INVALID" },
    });
  });
});
