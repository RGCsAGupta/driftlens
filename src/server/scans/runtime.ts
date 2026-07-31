import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { resolveRuntimeConfiguration } from "@/server/runtime-config";
import { ScanExecutionError } from "@/server/scans/errors";
import {
  ExplanationService,
  OpenAIExplanationProvider,
} from "@/server/scans/explanation";
import { GitHubDesiredStateReader } from "@/server/scans/github";
import {
  createAppsV1Client,
  KubernetesDeploymentReader,
} from "@/server/scans/kubernetes";
import { StructuredScanLogger } from "@/server/scans/log";
import { SqliteScanRepository } from "@/server/scans/repository";
import { ScanService } from "@/server/scans/service";

declare global {
  var __driftlensScanService: ScanService | undefined;
  var __driftlensExplanationService: ExplanationService | undefined;
}

export function getScanService(): ScanService {
  if (globalThis.__driftlensScanService) {
    return globalThis.__driftlensScanService;
  }

  const configuration = resolveRuntimeConfiguration();
  if (!configuration.ready) {
    throw new ScanExecutionError("CONFIGURATION_INVALID");
  }

  try {
    mkdirSync(configuration.dataDirectory, { recursive: true });
    const repository = new SqliteScanRepository(
      join(configuration.dataDirectory, "driftlens.sqlite"),
    );
    const desiredState = new GitHubDesiredStateReader(
      configuration.scan.repository,
      configuration.scan.manifestPath,
    );
    const liveState = new KubernetesDeploymentReader(
      createAppsV1Client(
        configuration.scan.kubeconfigPath,
        configuration.scan.kubeContext,
      ),
    );
    globalThis.__driftlensScanService = new ScanService(
      repository,
      desiredState,
      liveState,
      {
        manifestPath: configuration.scan.manifestPath,
        repository: configuration.scan.repository,
      },
      undefined,
      undefined,
      new StructuredScanLogger((line) => process.stdout.write(`${line}\n`)),
    );
    globalThis.__driftlensExplanationService = new ExplanationService(
      repository,
      new OpenAIExplanationProvider(),
    );
    return globalThis.__driftlensScanService;
  } catch (error) {
    if (error instanceof ScanExecutionError) {
      throw error;
    }
    throw new ScanExecutionError("CONFIGURATION_INVALID", { cause: error });
  }
}

export function getExplanationService(): ExplanationService {
  if (!globalThis.__driftlensExplanationService) getScanService();
  if (!globalThis.__driftlensExplanationService) {
    throw new ScanExecutionError("CONFIGURATION_INVALID");
  }
  return globalThis.__driftlensExplanationService;
}
