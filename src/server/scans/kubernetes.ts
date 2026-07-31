import {
  ApiException,
  AppsV1Api,
  KubeConfig,
  Observable,
  type ConfigurationOptions,
  type ObservableMiddleware,
  type RequestContext,
  type ResponseContext,
  type V1Deployment,
} from "@kubernetes/client-node";

import type {
  DeploymentProjection,
  DeploymentTarget,
} from "@/server/scans/contracts";
import { ScanExecutionError } from "@/server/scans/errors";

export interface LiveDeploymentReader {
  read(target: DeploymentTarget): Promise<DeploymentProjection | null>;
}

export interface AppsV1DeploymentClient {
  readNamespacedDeployment(
    request: { name: string; namespace: string },
    options?: ConfigurationOptions,
  ): Promise<V1Deployment>;
}

function singleValue<T>(value: T): Observable<T> {
  return new Observable(Promise.resolve(value));
}

function abortMiddleware(signal: AbortSignal): ObservableMiddleware {
  return {
    post(context: ResponseContext): Observable<ResponseContext> {
      return singleValue(context);
    },
    pre(context: RequestContext): Observable<RequestContext> {
      context.setSignal(signal);
      return singleValue(context);
    },
  };
}

export function createAppsV1Client(
  kubeconfigPath: string,
  context?: string,
): AppsV1DeploymentClient {
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromFile(kubeconfigPath);
  if (context) {
    kubeconfig.setCurrentContext(context);
  }
  return kubeconfig.makeApiClient(AppsV1Api);
}

export class KubernetesDeploymentReader implements LiveDeploymentReader {
  constructor(
    private readonly client: AppsV1DeploymentClient,
    private readonly timeoutMs = 10_000,
  ) {}

  async read(target: DeploymentTarget): Promise<DeploymentProjection | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const deployment = await this.client.readNamespacedDeployment(
        { name: target.name, namespace: target.namespace },
        { middleware: [abortMiddleware(controller.signal)] },
      );
      const containers = deployment.spec?.template.spec?.containers;
      if (!containers) {
        throw new ScanExecutionError("KUBERNETES_UNAVAILABLE");
      }

      return {
        containers: containers
          .filter(
            (
              container,
            ): container is typeof container & {
              image: string;
              name: string;
            } =>
              typeof container.name === "string" &&
              typeof container.image === "string",
          )
          .map(({ image, name }) => ({ image, name }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        replicas: deployment.spec?.replicas ?? 1,
      };
    } catch (error) {
      if (error instanceof ScanExecutionError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new ScanExecutionError("KUBERNETES_TIMEOUT", { cause: error });
      }
      if (error instanceof ApiException) {
        if (error.code === 404) {
          return null;
        }
        if (error.code === 401 || error.code === 403) {
          throw new ScanExecutionError("KUBERNETES_FORBIDDEN", {
            cause: error,
          });
        }
      }
      throw new ScanExecutionError("KUBERNETES_UNAVAILABLE", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}
