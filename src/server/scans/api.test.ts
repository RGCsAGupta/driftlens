import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getScanResponse,
  listScansResponse,
  sourceResponse,
  startScanResponse,
} from "@/server/scans/api";
import { ScanExecutionError } from "@/server/scans/errors";
import { SqliteScanRepository } from "@/server/scans/repository";
import { ScanService } from "@/server/scans/service";

const repositories: SqliteScanRepository[] = [];
const SHA = "0123456789abcdef0123456789abcdef01234567";
const MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  namespace: demo
spec:
  template:
    spec:
      containers:
        - name: api
          image: api:1
`;

function createService(): ScanService {
  const repository = new SqliteScanRepository(":memory:");
  repositories.push(repository);
  let id = 0;
  return new ScanService(
    repository,
    {
      load: vi.fn().mockResolvedValue({ resolvedSha: SHA, yaml: MANIFEST }),
    },
    {
      read: vi.fn().mockResolvedValue({
        containers: [{ image: "api:1", name: "api" }],
        replicas: 1,
      }),
    },
    { manifestPath: "deployment.yaml", repository: "owner/repo" },
    () => "2026-07-31T00:00:00.000Z",
    () => `scan-${++id}`,
  );
}

function post(body: string): Request {
  return new Request("http://localhost/api/scans", {
    body,
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

afterEach(() => {
  for (const repository of repositories.splice(0)) {
    repository.close();
  }
});

describe("scan API contracts", () => {
  it("validates input before creating work", async () => {
    const service = createService();
    for (const body of ["{}", '{"ref":"bad ref"}', "not-json"]) {
      const response = await startScanResponse(post(body), service, vi.fn());
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: { code: "INVALID_REQUEST", message: "Request is invalid." },
      });
    }
  });

  it("cancels chunked input as soon as the byte limit is exceeded", async () => {
    let cancelled = false;
    const chunk = new Uint8Array(600).fill(97);
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
      pull(controller) {
        controller.enqueue(chunk);
      },
    });
    const request = new Request("http://localhost/api/scans", {
      body,
      duplex: "half",
      method: "POST",
    } as RequestInit & { duplex: "half" });

    const response = await startScanResponse(request, createService(), vi.fn());

    expect(response.status).toBe(400);
    expect(cancelled).toBe(true);
  });

  it("returns 202 immediately, then polling observes persisted completion", async () => {
    const service = createService();
    const tasks: Array<() => Promise<void>> = [];
    const response = await startScanResponse(
      post('{"ref":"main"}'),
      service,
      (task) => tasks.push(task),
    );

    expect(response.status).toBe(202);
    const queued = (await response.json()) as { scan: { id: string } };
    expect(queued.scan).toMatchObject({ id: "scan-1", status: "QUEUED" });
    expect(tasks).toHaveLength(1);

    await tasks[0]!();
    const detail = getScanResponse("scan-1", service);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      scan: {
        outcome: "IN_SYNC",
        resolvedSha: SHA,
        status: "COMPLETED",
      },
    });
  });

  it("returns active conflict without scheduling a second workflow", async () => {
    const service = createService();
    const schedule = vi.fn();
    expect(
      (await startScanResponse(post('{"ref":"main"}'), service, schedule))
        .status,
    ).toBe(202);

    const conflict = await startScanResponse(
      post('{"ref":"other"}'),
      service,
      schedule,
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: {
        code: "SCAN_ACTIVE",
        message: "Another scan is active.",
      },
    });
    expect(schedule).toHaveBeenCalledOnce();
  });

  it("returns bounded history, source metadata, invalid limit, and not-found", async () => {
    const service = createService();
    service.start("main");

    const history = listScansResponse(
      new Request("http://localhost/api/scans?limit=1"),
      service,
    );
    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toMatchObject({
      scans: [{ id: "scan-1" }],
    });

    const badLimit = listScansResponse(
      new Request("http://localhost/api/scans?limit=51"),
      service,
    );
    expect(badLimit.status).toBe(400);

    const missing = getScanResponse("missing", service);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: { code: "SCAN_NOT_FOUND", message: "Scan was not found." },
    });

    await expect(sourceResponse(service).json()).resolves.toEqual({
      source: {
        manifestPath: "deployment.yaml",
        repository: "owner/repo",
      },
    });
  });

  it("maps synchronous initial storage failure to a safe 503", async () => {
    const service = createService();
    vi.spyOn(service, "start").mockImplementation(() => {
      throw new ScanExecutionError("STORAGE_WRITE_FAILED");
    });

    const response = await startScanResponse(
      post('{"ref":"main"}'),
      service,
      vi.fn(),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "STORAGE_WRITE_FAILED",
        message: "Scan progress could not be saved.",
      },
    });
  });
});
