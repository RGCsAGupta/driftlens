import {
  readRuntimeEnvironment,
  resolveRuntimeConfiguration,
  type ConfigurationIssue,
  type RuntimeEnvironment,
} from "./runtime-config";
import { ScanExecutionError } from "./scans/errors";
import { getScanService } from "./scans/runtime";

const embeddedBuildSha = process.env.DRIFTLENS_BUILD_SHA;

export interface HealthStatus {
  service: "driftlens";
  status: "ok";
}

export interface ReadinessStatus {
  checks: {
    configuration: "pass" | "fail";
    persistence: "pass" | "fail";
  };
  issues: Array<
    ConfigurationIssue | "CONFIGURATION_INVALID" | "STORAGE_UNAVAILABLE"
  >;
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
  persistenceCheck: () => void = () => {
    getScanService().checkPersistence();
  },
): ReadinessStatus {
  const configuration = resolveRuntimeConfiguration(environment, buildSha);
  const issues: ReadinessStatus["issues"] = [...configuration.issues];
  let persistenceReady = false;
  if (configuration.ready) {
    try {
      persistenceCheck();
      persistenceReady = true;
    } catch (error) {
      issues.push(
        error instanceof ScanExecutionError && error.code.startsWith("STORAGE_")
          ? "STORAGE_UNAVAILABLE"
          : "CONFIGURATION_INVALID",
      );
    }
  }
  const ready = configuration.ready && persistenceReady;

  return {
    checks: {
      configuration: configuration.ready ? "pass" : "fail",
      persistence: persistenceReady ? "pass" : "fail",
    },
    issues,
    service: "driftlens",
    status: ready ? "ready" : "not_ready",
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
