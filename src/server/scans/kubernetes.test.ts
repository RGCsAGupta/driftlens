import {
  ApiException,
  HttpMethod,
  RequestContext,
  type V1Deployment,
} from "@kubernetes/client-node";
import { describe, expect, it, vi } from "vitest";

import type { ScanExecutionError } from "@/server/scans/errors";
import {
  KubernetesDeploymentReader,
  type AppsV1DeploymentClient,
} from "@/server/scans/kubernetes";

const TARGET = {
  apiVersion: "apps/v1",
  kind: "Deployment",
  name: "app",
  namespace: "demo",
} as const;

function deployment(): V1Deployment {
  return {
    spec: {
      replicas: 2,
      selector: { matchLabels: { app: "demo" } },
      template: {
        metadata: {},
        spec: {
          containers: [
            { image: "worker:1", name: "worker" },
            { image: "api:1", name: "api" },
          ],
        },
      },
    },
  };
}

describe("KubernetesDeploymentReader", () => {
  it("performs one namespaced Deployment read and projects supported fields", async () => {
    const client: AppsV1DeploymentClient = {
      readNamespacedDeployment: vi.fn().mockResolvedValue(deployment()),
    };
    const reader = new KubernetesDeploymentReader(client);

    await expect(reader.read(TARGET)).resolves.toEqual({
      containers: [
        { image: "api:1", name: "api" },
        { image: "worker:1", name: "worker" },
      ],
      replicas: 2,
    });
    expect(client.readNamespacedDeployment).toHaveBeenCalledOnce();
    expect(client.readNamespacedDeployment).toHaveBeenCalledWith(
      { name: "app", namespace: "demo" },
      expect.objectContaining({ middleware: [expect.any(Object)] }),
    );
  });

  it.each([
    [404, null],
    [403, "KUBERNETES_FORBIDDEN"],
    [500, "KUBERNETES_UNAVAILABLE"],
  ])("maps API status %i safely", async (status, expected) => {
    const error = new ApiException(status, "unsafe upstream detail", {}, {});
    const client: AppsV1DeploymentClient = {
      readNamespacedDeployment: vi.fn().mockRejectedValue(error),
    };
    const promise = new KubernetesDeploymentReader(client).read(TARGET);

    if (expected === null) {
      await expect(promise).resolves.toBeNull();
    } else {
      await expect(promise).rejects.toEqual(
        expect.objectContaining({ code: expected }),
      );
    }
    expect(client.readNamespacedDeployment).toHaveBeenCalledOnce();
  });

  it("aborts one hung read at the bounded timeout without retrying", async () => {
    const client: AppsV1DeploymentClient = {
      readNamespacedDeployment: vi.fn(async (_request, options) => {
        const middleware = options?.middleware?.[0];
        const context = new RequestContext(
          "https://cluster.example/apis/apps/v1/namespaces/demo/deployments/app",
          HttpMethod.GET,
        );
        const request = middleware
          ? await middleware.pre(context).toPromise()
          : context;
        return new Promise<V1Deployment>((_resolve, reject) => {
          request
            .getSignal()
            ?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
        });
      }),
    };

    await expect(
      new KubernetesDeploymentReader(client, 1).read(TARGET),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ScanExecutionError>>({
        code: "KUBERNETES_TIMEOUT",
      }),
    );
    expect(client.readNamespacedDeployment).toHaveBeenCalledOnce();
  });
});
