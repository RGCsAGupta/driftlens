import {
  resolveRuntimeConfiguration,
  type ConfigurationIssue,
} from "./runtime-config";

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
  environment: NodeJS.ProcessEnv = process.env,
): ReadinessStatus {
  const configuration = resolveRuntimeConfiguration(environment);

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
  environment: NodeJS.ProcessEnv = process.env,
): VersionStatus {
  return {
    buildSha: resolveRuntimeConfiguration(environment).buildSha,
    service: "driftlens",
  };
}
