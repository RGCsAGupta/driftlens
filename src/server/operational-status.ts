import {
  readRuntimeEnvironment,
  resolveRuntimeConfiguration,
  type ConfigurationIssue,
  type RuntimeEnvironment,
} from "./runtime-config";

const embeddedBuildSha = process.env.DRIFTLENS_BUILD_SHA;

export interface HealthStatus {
  service: "driftlens";
  status: "ok";
}

export interface ReadinessStatus {
  checks: {
    configuration: "pass" | "fail";
  };
  issues: ConfigurationIssue[];
  service: "driftlens";
  status: "ready" | "not_ready";
}

export interface VersionStatus {
  buildSha: string;
  service: "driftlens";
}

export function healthStatus(): HealthStatus {
  return {
    service: "driftlens",
    status: "ok",
  };
}

export function readinessStatus(
  environment: RuntimeEnvironment = readRuntimeEnvironment(),
  buildSha: string | undefined = embeddedBuildSha,
): ReadinessStatus {
  const configuration = resolveRuntimeConfiguration(environment, buildSha);

  return {
    checks: {
      configuration: configuration.ready ? "pass" : "fail",
    },
    issues: configuration.issues,
    service: "driftlens",
    status: configuration.ready ? "ready" : "not_ready",
  };
}

export function versionStatus(
  environment: RuntimeEnvironment = readRuntimeEnvironment(),
  buildSha: string | undefined = embeddedBuildSha,
): VersionStatus {
  return {
    buildSha: resolveRuntimeConfiguration(environment, buildSha).buildSha,
    service: "driftlens",
  };
}
