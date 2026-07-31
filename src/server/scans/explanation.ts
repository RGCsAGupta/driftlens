import OpenAI, { APIConnectionTimeoutError, type ClientOptions } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  operatorAnalysisSchema,
  type ComparisonOutcome,
  type DeploymentProjection,
  type Difference,
  type OperatorAnalysis,
  type SafeExplanationError,
  type ScanRecord,
} from "@/server/scans/contracts";
import { ScanExecutionError } from "@/server/scans/errors";
import type { Clock } from "@/server/scans/service";
import type { ScanRepository } from "@/server/scans/repository";

export interface ExplanationProjection {
  desired: DeploymentProjection;
  differences: Difference[];
  live: DeploymentProjection | null;
  outcome: ComparisonOutcome;
}

export interface ExplanationProvider {
  analyze(input: ExplanationProjection): Promise<OperatorAnalysis>;
}

type OpenAIClientFactory = (
  options: ClientOptions,
) => Pick<OpenAI, "responses">;

const projectedContainerSchema = z.strictObject({
  image: z.string().min(1).max(2_048),
  name: z.string().min(1).max(2_048),
});
const projectedDeploymentSchema = z.strictObject({
  containers: z.array(projectedContainerSchema).max(500),
  replicas: z.number().int().nonnegative(),
});
const projectedValueSchema = z.union([
  z.string().min(1).max(2_048),
  z.number().finite(),
]);
const explanationProjectionSchema = z.strictObject({
  desired: projectedDeploymentSchema,
  differences: z
    .array(
      z.strictObject({
        desired: projectedValueSchema,
        field: z.string().min(1).max(2_048),
        live: projectedValueSchema.nullable(),
      }),
    )
    .max(500),
  live: projectedDeploymentSchema.nullable(),
  outcome: z.enum(["IN_SYNC", "DRIFTED", "MISSING_LIVE"]),
});

export class ExplanationProviderError extends Error {
  constructor(readonly safe: SafeExplanationError) {
    super(safe.message);
  }
}

const SAFE_ERRORS = {
  configuration: {
    code: "AI_CONFIGURATION_INVALID",
    message: "AI explanation configuration is unavailable.",
  },
  incomplete: {
    code: "AI_INCOMPLETE",
    message: "AI explanation was incomplete.",
  },
  invalid: {
    code: "AI_INVALID_RESPONSE",
    message: "AI explanation did not match the required structure.",
  },
  provider: {
    code: "AI_PROVIDER_UNAVAILABLE",
    message: "AI explanation provider is unavailable.",
  },
  refused: {
    code: "AI_REFUSED",
    message: "AI explanation was refused.",
  },
  timeout: {
    code: "AI_TIMEOUT",
    message: "AI explanation request timed out.",
  },
} as const satisfies Record<string, SafeExplanationError>;

export function projectScanForExplanation(
  scan: ScanRecord,
): ExplanationProjection {
  if (scan.status !== "COMPLETED" || !scan.outcome || !scan.desired) {
    throw new ScanExecutionError("EXPLANATION_NOT_ELIGIBLE");
  }
  const desiredContainers = scan.desired.containers.map(({ image, name }) => ({
    image,
    name,
  }));
  const desiredContainerNames = new Set(
    desiredContainers.map(({ name }) => name),
  );
  const candidate = {
    desired: {
      containers: desiredContainers,
      replicas: scan.desired.replicas,
    },
    differences: scan.differences.map(({ desired, field, live }) => ({
      desired,
      field,
      live,
    })),
    live: scan.live
      ? {
          containers: scan.live.containers
            .filter(({ name }) => desiredContainerNames.has(name))
            .map(({ image, name }) => ({ image, name })),
          replicas: scan.live.replicas,
        }
      : null,
    outcome: scan.outcome,
  };
  const parsed = explanationProjectionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ScanExecutionError("EXPLANATION_NOT_ELIGIBLE");
  }
  return parsed.data;
}

export class OpenAIExplanationProvider implements ExplanationProvider {
  private readonly model: string | null;
  private readonly responses: OpenAI["responses"] | null;

  constructor(
    apiKey: string | undefined = process.env.OPENAI_API_KEY,
    model: string | undefined = process.env.OPENAI_MODEL,
    private readonly timeoutMs = 12_000,
    responses?: OpenAI["responses"],
    createClient: OpenAIClientFactory = (options) => new OpenAI(options),
  ) {
    this.model = model?.trim() || null;
    this.responses =
      responses ??
      (apiKey?.trim()
        ? createClient({ apiKey: apiKey.trim(), maxRetries: 0 }).responses
        : null);
  }

  async analyze(input: ExplanationProjection): Promise<OperatorAnalysis> {
    if (!this.responses || !this.model) {
      throw new ExplanationProviderError(SAFE_ERRORS.configuration);
    }

    try {
      const response = await this.responses.parse(
        {
          input: JSON.stringify(input),
          instructions:
            "Analyze only this deterministic Kubernetes Deployment comparison. Do not infer hidden cluster state, confirm root causes, or prescribe mutations. Return concise operator analysis and state uncertainty explicitly.",
          max_output_tokens: 900,
          model: this.model,
          store: false,
          text: {
            format: zodTextFormat(operatorAnalysisSchema, "operator_analysis"),
          },
        },
        { timeout: this.timeoutMs },
      );

      if (response.status !== "completed") {
        throw new ExplanationProviderError(SAFE_ERRORS.incomplete);
      }
      if (
        response.output.some(
          (item) =>
            item.type === "message" &&
            item.content.some((content) => content.type === "refusal"),
        )
      ) {
        throw new ExplanationProviderError(SAFE_ERRORS.refused);
      }
      const parsed = operatorAnalysisSchema.safeParse(response.output_parsed);
      if (!parsed.success) {
        throw new ExplanationProviderError(SAFE_ERRORS.invalid);
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ExplanationProviderError) throw error;
      if (error instanceof APIConnectionTimeoutError) {
        throw new ExplanationProviderError(SAFE_ERRORS.timeout);
      }
      throw new ExplanationProviderError(SAFE_ERRORS.provider);
    }
  }
}

export class ExplanationService {
  constructor(
    private readonly repository: ScanRepository,
    private readonly provider: ExplanationProvider,
    private readonly clock: Clock = () => new Date().toISOString(),
  ) {}

  async explain(id: string): Promise<ScanRecord> {
    const scan = this.repository.get(id);
    if (!scan) throw new ScanExecutionError("SCAN_NOT_FOUND");
    if (scan.explanation.state === "SAVED") return scan;
    if (scan.explanation.state !== "NOT_REQUESTED") {
      throw new ScanExecutionError("EXPLANATION_TERMINAL");
    }

    const projection = projectScanForExplanation(scan);
    this.repository.requestExplanation(id, this.clock());
    try {
      const analysis = await this.provider.analyze(projection);
      this.repository.saveExplanation(id, analysis, this.clock());
    } catch (error) {
      const safe =
        error instanceof ExplanationProviderError
          ? error.safe
          : SAFE_ERRORS.provider;
      this.repository.failExplanation(id, safe, this.clock());
    }

    const result = this.repository.get(id);
    if (!result) throw new ScanExecutionError("SCAN_NOT_FOUND");
    return result;
  }
}
