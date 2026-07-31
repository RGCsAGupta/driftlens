import { parseAllDocuments } from "yaml";
import { z } from "zod";

import type {
  ComparisonResult,
  DeploymentProjection,
  DeploymentTarget,
  Difference,
} from "@/server/scans/contracts";
import { ScanExecutionError } from "@/server/scans/errors";

const dnsSubdomain = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9](?:[-a-z0-9.]*[a-z0-9])?$/)
  .refine((value) => value.split(".").every((label) => label.length <= 63));
const dnsLabel = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/);
const containerSchema = z.object({
  image: z.string().trim().min(1).max(2_048),
  name: dnsLabel,
});
const deploymentSchema = z.object({
  apiVersion: z.string(),
  kind: z.string(),
  metadata: z.object({
    name: dnsSubdomain,
    namespace: dnsLabel,
  }),
  spec: z.object({
    replicas: z.number().int().min(0).optional(),
    template: z.object({
      spec: z.object({
        containers: z.array(containerSchema).min(1),
      }),
    }),
  }),
});

export interface DesiredDeployment {
  projection: DeploymentProjection;
  target: DeploymentTarget;
}

export function parseDesiredDeployment(yaml: string): DesiredDeployment {
  let documents;
  try {
    documents = parseAllDocuments(yaml);
  } catch (error) {
    throw new ScanExecutionError("MANIFEST_INVALID", { cause: error });
  }

  if (
    documents.length !== 1 ||
    documents[0]?.errors.length !== 0 ||
    documents[0].contents === null
  ) {
    throw new ScanExecutionError("MANIFEST_INVALID");
  }

  const result = deploymentSchema.safeParse(documents[0].toJS());
  if (!result.success) {
    throw new ScanExecutionError("MANIFEST_INVALID");
  }

  if (
    result.data.apiVersion !== "apps/v1" ||
    result.data.kind !== "Deployment"
  ) {
    throw new ScanExecutionError("MANIFEST_UNSUPPORTED");
  }

  const containerNames = result.data.spec.template.spec.containers.map(
    ({ name }) => name,
  );
  if (new Set(containerNames).size !== containerNames.length) {
    throw new ScanExecutionError("MANIFEST_INVALID");
  }

  return {
    projection: {
      containers: result.data.spec.template.spec.containers
        .map(({ image, name }) => ({ image, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      replicas: result.data.spec.replicas ?? 1,
    },
    target: {
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: result.data.metadata.name,
      namespace: result.data.metadata.namespace,
    },
  };
}

export function compareDeployments(
  desired: DeploymentProjection,
  live: DeploymentProjection | null,
): ComparisonResult {
  if (live === null) {
    return { differences: [], outcome: "MISSING_LIVE" };
  }

  const differences: Difference[] = [];
  if (desired.replicas !== live.replicas) {
    differences.push({
      desired: desired.replicas,
      field: "spec.replicas",
      live: live.replicas,
    });
  }

  const liveContainers = new Map(
    live.containers.map((container) => [container.name, container.image]),
  );
  for (const container of desired.containers) {
    const liveImage = liveContainers.get(container.name) ?? null;
    if (container.image !== liveImage) {
      differences.push({
        desired: container.image,
        field: `spec.template.spec.containers[name=${container.name}].image`,
        live: liveImage,
      });
    }
  }

  return {
    differences,
    outcome: differences.length === 0 ? "IN_SYNC" : "DRIFTED",
  };
}
