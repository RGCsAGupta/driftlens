import { isAbsolute } from "node:path";

const FULL_SHA = /^[0-9a-f]{40}$/;
const GITHUB_REPOSITORY =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

type ConfiguredRuntimeMode = "development" | "test" | "production";

export type RuntimeMode = ConfiguredRuntimeMode | "invalid";

export type ConfigurationIssue =
  | "RUNTIME_MODE_INVALID"
  | "BUILD_SHA_REQUIRED"
  | "BUILD_SHA_INVALID"
  | "DATA_DIR_INVALID"
  | "GITHUB_REPOSITORY_INVALID"
  | "GITHUB_REPOSITORY_REQUIRED"
  | "KUBECONFIG_PATH_INVALID"
  | "KUBECONFIG_PATH_REQUIRED"
  | "KUBECONTEXT_INVALID"
  | "MANIFEST_PATH_INVALID"
  | "MANIFEST_PATH_REQUIRED";

export interface RuntimeEnvironment {
  DRIFTLENS_BUILD_SHA?: string;
  DRIFTLENS_DATA_DIR?: string;
  DRIFTLENS_GITHUB_REPOSITORY?: string;
  DRIFTLENS_KUBECONFIG_PATH?: string;
  DRIFTLENS_KUBECONTEXT?: string;
  DRIFTLENS_MANIFEST_PATH?: string;
  NODE_ENV?: string;
}

export interface RuntimeConfiguration {
  buildSha: string;
  dataDirectory: string;
  issues: ConfigurationIssue[];
  mode: RuntimeMode;
  ready: boolean;
  scan: {
    kubeconfigPath: string;
    kubeContext?: string;
    manifestPath: string;
    repository: string;
  };
}

export function readRuntimeEnvironment(): RuntimeEnvironment {
  const readValue = (name: keyof RuntimeEnvironment): string | undefined => {
    const value: unknown = Reflect.get(process.env, name);
    return typeof value === "string" ? value : undefined;
  };

  return {
    DRIFTLENS_BUILD_SHA: readValue("DRIFTLENS_BUILD_SHA"),
    DRIFTLENS_DATA_DIR: readValue("DRIFTLENS_DATA_DIR"),
    DRIFTLENS_GITHUB_REPOSITORY: readValue("DRIFTLENS_GITHUB_REPOSITORY"),
    DRIFTLENS_KUBECONFIG_PATH: readValue("DRIFTLENS_KUBECONFIG_PATH"),
    DRIFTLENS_KUBECONTEXT: readValue("DRIFTLENS_KUBECONTEXT"),
    DRIFTLENS_MANIFEST_PATH: readValue("DRIFTLENS_MANIFEST_PATH"),
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

function requiredValue(
  value: string | undefined,
  requiredIssue: ConfigurationIssue,
  invalidIssue: ConfigurationIssue,
  isValid: (candidate: string) => boolean,
  issues: ConfigurationIssue[],
): string {
  const candidate = value?.trim();
  if (!candidate) {
    issues.push(requiredIssue);
    return "unavailable";
  }
  if (!isValid(candidate)) {
    issues.push(invalidIssue);
    return "unavailable";
  }
  return candidate;
}

function safeManifestPath(value: string): boolean {
  return (
    value.length <= 500 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function optionalKubeContext(
  value: string | undefined,
  issues: ConfigurationIssue[],
): string | undefined {
  const candidate = value?.trim();
  if (!candidate) {
    return undefined;
  }
  if (
    candidate.length > 253 ||
    [...candidate].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) {
    issues.push("KUBECONTEXT_INVALID");
    return undefined;
  }
  return candidate;
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
  const repository = requiredValue(
    environment.DRIFTLENS_GITHUB_REPOSITORY,
    "GITHUB_REPOSITORY_REQUIRED",
    "GITHUB_REPOSITORY_INVALID",
    (value) => GITHUB_REPOSITORY.test(value),
    issues,
  );
  const manifestPath = requiredValue(
    environment.DRIFTLENS_MANIFEST_PATH,
    "MANIFEST_PATH_REQUIRED",
    "MANIFEST_PATH_INVALID",
    safeManifestPath,
    issues,
  );
  const kubeconfigPath = requiredValue(
    environment.DRIFTLENS_KUBECONFIG_PATH,
    "KUBECONFIG_PATH_REQUIRED",
    "KUBECONFIG_PATH_INVALID",
    (value) => isAbsolute(value) && !value.includes("\0"),
    issues,
  );
  const kubeContext = optionalKubeContext(
    environment.DRIFTLENS_KUBECONTEXT,
    issues,
  );

  return {
    buildSha,
    dataDirectory,
    issues,
    mode,
    ready: issues.length === 0,
    scan: {
      kubeconfigPath,
      ...(kubeContext ? { kubeContext } : {}),
      manifestPath,
      repository,
    },
  };
}
