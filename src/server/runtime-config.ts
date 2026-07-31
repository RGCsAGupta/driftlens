const FULL_SHA = /^[0-9a-f]{40}$/;

type ConfiguredRuntimeMode = "development" | "test" | "production";

export type RuntimeMode = ConfiguredRuntimeMode | "invalid";

export type ConfigurationIssue =
  | "RUNTIME_MODE_INVALID"
  | "BUILD_SHA_REQUIRED"
  | "BUILD_SHA_INVALID"
  | "DATA_DIR_INVALID";

export interface RuntimeEnvironment {
  DRIFTLENS_BUILD_SHA?: string;
  DRIFTLENS_DATA_DIR?: string;
  NODE_ENV?: string;
}

export interface RuntimeConfiguration {
  buildSha: string;
  dataDirectory: string;
  issues: ConfigurationIssue[];
  mode: RuntimeMode;
  ready: boolean;
}

export function readRuntimeEnvironment(): RuntimeEnvironment {
  const readValue = (name: keyof RuntimeEnvironment): string | undefined => {
    const value: unknown = Reflect.get(process.env, name);
    return typeof value === "string" ? value : undefined;
  };

  return {
    DRIFTLENS_BUILD_SHA: readValue("DRIFTLENS_BUILD_SHA"),
    DRIFTLENS_DATA_DIR: readValue("DRIFTLENS_DATA_DIR"),
    NODE_ENV: readValue("NODE_ENV"),
  };
}

function runtimeMode(
  value: string | undefined,
  issues: ConfigurationIssue[],
): RuntimeMode {
  if (value === "development" || value === "production" || value === "test") {
    return value;
  }

  issues.push("RUNTIME_MODE_INVALID");
  return "invalid";
}

function resolveBuildSha(
  value: string | undefined,
  mode: RuntimeMode,
  issues: ConfigurationIssue[],
): string {
  const buildSha = value?.trim();

  if (!buildSha) {
    if (mode === "production") {
      issues.push("BUILD_SHA_REQUIRED");
      return "unavailable";
    }

    return mode === "invalid" ? "unavailable" : "development";
  }

  if (!FULL_SHA.test(buildSha)) {
    issues.push("BUILD_SHA_INVALID");
    return "unavailable";
  }

  return buildSha;
}

function resolveDataDirectory(
  value: string | undefined,
  mode: RuntimeMode,
  issues: ConfigurationIssue[],
): string {
  if (mode === "invalid") {
    return "unavailable";
  }

  const dataDirectory =
    value?.trim() || (mode === "production" ? "/data" : ".driftlens");

  if (dataDirectory.includes("\0")) {
    issues.push("DATA_DIR_INVALID");
    return "unavailable";
  }

  if (mode === "production" && !dataDirectory.startsWith("/")) {
    issues.push("DATA_DIR_INVALID");
    return "unavailable";
  }

  return dataDirectory;
}

export function resolveRuntimeConfiguration(
  environment: RuntimeEnvironment = readRuntimeEnvironment(),
  buildShaValue: string | undefined = environment.DRIFTLENS_BUILD_SHA,
): RuntimeConfiguration {
  const issues: ConfigurationIssue[] = [];
  const mode = runtimeMode(environment.NODE_ENV, issues);
  const buildSha = resolveBuildSha(buildShaValue, mode, issues);
  const dataDirectory = resolveDataDirectory(
    environment.DRIFTLENS_DATA_DIR,
    mode,
    issues,
  );

  return {
    buildSha,
    dataDirectory,
    issues,
    mode,
    ready: issues.length === 0,
  };
}
