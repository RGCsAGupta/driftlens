const FULL_SHA = /^[0-9a-f]{40}$/;

export type RuntimeMode = "development" | "test" | "production";

export type ConfigurationIssue =
  "BUILD_SHA_REQUIRED" | "BUILD_SHA_INVALID" | "DATA_DIR_INVALID";

export interface RuntimeConfiguration {
  buildSha: string;
  dataDirectory: string;
  issues: ConfigurationIssue[];
  mode: RuntimeMode;
  ready: boolean;
}

function runtimeMode(value: string | undefined): RuntimeMode {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
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

    return "development";
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
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfiguration {
  const mode = runtimeMode(environment.NODE_ENV);
  const issues: ConfigurationIssue[] = [];
  const buildSha = resolveBuildSha(
    environment.DRIFTLENS_BUILD_SHA,
    mode,
    issues,
  );
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
