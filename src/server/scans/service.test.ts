import { describe, expect, it, vi } from "vitest";

import { ScanExecutionError } from "@/server/scans/errors";
import type { DesiredStateReader } from "@/server/scans/github";
import type { LiveDeploymentReader } from "@/server/scans/kubernetes";
import {
  SqliteScanRepository,
  type ScanRepository,
} from "@/server/scans/repository";
import { ScanService } from "@/server/scans/service";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const SOURCE = { manifestPath: "deployment.yaml", repository: "owner/repo" };
const MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  namespace: demo
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: api
          image: api:1
`;

function clock(): () => string {
  let seconds = 0;
  return () => `2026-07-31T00:00:${String(seconds++).padStart(2, "0")}.000Z`;
}

function service(
  repository: ScanRepository,
  desiredState: DesiredStateReader,
  liveState: LiveDeploymentReader,
  idFactory: () => string = () => "scan-1",
): ScanService {
  return new ScanService(
    repository,
    desiredState,
    liveState,
    SOURCE,
    clock(),
    idFactory,
  );
}

describe("ScanService", () => {
  it("drives every stage to persisted deterministic completion", async () => {
    const repository = new SqliteScanRepository(":memory:");
    const desiredState = {
      load: vi.fn().mockResolvedValue({ resolvedSha: SHA, yaml: MANIFEST }),
    };
    const liveState = {
      read: vi.fn().mockResolvedValue({
        containers: [{ image: "api:1", name: "api" }],
        replicas: 2,
      }),
    };
    const scans = service(repository, desiredState, liveState);

    expect(scans.start("main")).toMatchObject({
      requestedRef: "main",
      status: "QUEUED",
    });
    await scans.run("scan-1");

    expect(scans.get("scan-1")).toMatchObject({
      differences: [],
      durable: true,
      outcome: "IN_SYNC",
      resolvedSha: SHA,
      stages: [
        { stage: "QUEUED" },
        { stage: "LOADING_DESIRED" },
        { stage: "READING_LIVE" },
        { stage: "COMPARING" },
        { stage: "SAVING_RESULT" },
        { stage: "COMPLETED" },
      ],
      status: "COMPLETED",
      target: { name: "app", namespace: "demo" },
    });
    expect(desiredState.load).toHaveBeenCalledOnce();
    expect(liveState.read).toHaveBeenCalledOnce();
    repository.close();
  });

  it("completes a Kubernetes 404 projection as MISSING_LIVE", async () => {
    const repository = new SqliteScanRepository(":memory:");
    const scans = service(
      repository,
      { load: vi.fn().mockResolvedValue({ resolvedSha: SHA, yaml: MANIFEST }) },
      { read: vi.fn().mockResolvedValue(null) },
    );

    scans.start("main");
    await scans.run("scan-1");

    expect(scans.get("scan-1")).toMatchObject({
      error: null,
      outcome: "MISSING_LIVE",
      status: "COMPLETED",
    });
    repository.close();
  });

  it.each([
    [
      "GitHub failure",
      new ScanExecutionError("GITHUB_UNAVAILABLE"),
      MANIFEST,
      null,
      "GITHUB_UNAVAILABLE",
    ],
    ["invalid manifest", null, "not: [valid", null, "MANIFEST_INVALID"],
    [
      "Kubernetes denial",
      null,
      MANIFEST,
      new ScanExecutionError("KUBERNETES_FORBIDDEN"),
      "KUBERNETES_FORBIDDEN",
    ],
    [
      "unknown adapter failure",
      new Error("unsafe detail"),
      MANIFEST,
      null,
      "INTERNAL_ERROR",
    ],
  ])(
    "persists one safe terminal %s without automatic retry",
    async (_name, desiredError, yaml, liveError, code) => {
      const repository = new SqliteScanRepository(":memory:");
      const desiredState = {
        load: desiredError
          ? vi.fn().mockRejectedValue(desiredError)
          : vi.fn().mockResolvedValue({ resolvedSha: SHA, yaml }),
      };
      const liveState = {
        read: liveError
          ? vi.fn().mockRejectedValue(liveError)
          : vi.fn().mockResolvedValue({
              containers: [{ image: "api:1", name: "api" }],
              replicas: 2,
            }),
      };
      const scans = service(repository, desiredState, liveState);

      scans.start("main");
      await scans.run("scan-1");

      expect(scans.get("scan-1")).toMatchObject({
        error: { code },
        stage: "FAILED",
        status: "FAILED",
      });
      expect(desiredState.load).toHaveBeenCalledOnce();
      expect(liveState.read).toHaveBeenCalledTimes(
        desiredError || yaml !== MANIFEST ? 0 : 1,
      );
      repository.close();
    },
  );

  it("rejects a concurrent start without creating another scan", () => {
    const repository = new SqliteScanRepository(":memory:");
    const scans = service(repository, { load: vi.fn() }, { read: vi.fn() });
    scans.start("main");

    expect(() => scans.start("other")).toThrowError(
      expect.objectContaining<Partial<ScanExecutionError>>({
        code: "SCAN_ACTIVE",
      }),
    );
    expect(repository.list(10)).toHaveLength(1);
    repository.close();
  });

  it("releases admission when the initial scan write fails and creates no scan", () => {
    const durable = new SqliteScanRepository(":memory:");
    let attempts = 0;
    const repository = new Proxy(durable, {
      get(target, property, receiver) {
        if (property === "createQueued") {
          return (...args: Parameters<ScanRepository["createQueued"]>) => {
            attempts += 1;
            if (attempts === 1) {
              throw new ScanExecutionError("STORAGE_WRITE_FAILED");
            }
            return target.createQueued(...args);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }) as ScanRepository;
    const scans = service(repository, { load: vi.fn() }, { read: vi.fn() });

    expect(() => scans.start("first")).toThrow();
    expect(durable.list(10)).toEqual([]);
    expect(scans.start("second")).toMatchObject({ requestedRef: "second" });
    durable.close();
  });

  it("terminalizes a scheduler rejection and admits a subsequent scan", () => {
    const repository = new SqliteScanRepository(":memory:");
    const desiredState = { load: vi.fn() };
    const liveState = { read: vi.fn() };
    let id = 0;
    const scans = service(
      repository,
      desiredState,
      liveState,
      () => `scan-${++id}`,
    );

    expect(() =>
      scans.startScheduled("main", () => {
        throw new Error("unsafe scheduler detail");
      }),
    ).toThrow("unsafe scheduler detail");

    const history = repository.list(10);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      durable: true,
      error: {
        code: "INTERNAL_ERROR",
        message: "Scan failed unexpectedly.",
      },
      id: "scan-1",
      status: "FAILED",
    });
    expect(history[0]?.stages.map(({ stage }) => stage)).toEqual([
      "QUEUED",
      "FAILED",
    ]);
    expect(desiredState.load).not.toHaveBeenCalled();
    expect(liveState.read).not.toHaveBeenCalled();

    const tasks: Array<() => Promise<void>> = [];
    expect(
      scans.startScheduled("next", (task) => tasks.push(task)),
    ).toMatchObject({ id: "scan-2", status: "QUEUED" });
    expect(tasks).toHaveLength(1);
    repository.close();
  });

  it("exposes a non-durable scheduler failure when terminal persistence fails", () => {
    const durable = new SqliteScanRepository(":memory:");
    const repository: ScanRepository = {
      checkWritable: () => durable.checkWritable(),
      complete: (...args) => durable.complete(...args),
      createQueued: (...args) => durable.createQueued(...args),
      failExplanation: (...args) => durable.failExplanation(...args),
      fail: () => {
        throw new ScanExecutionError("STORAGE_WRITE_FAILED");
      },
      get: () => {
        throw new ScanExecutionError("STORAGE_UNAVAILABLE");
      },
      list: (...args) => durable.list(...args),
      requestExplanation: (...args) => durable.requestExplanation(...args),
      saveDesired: (...args) => durable.saveDesired(...args),
      saveLive: (...args) => durable.saveLive(...args),
      saveExplanation: (...args) => durable.saveExplanation(...args),
      transition: (...args) => durable.transition(...args),
    };
    let id = 0;
    const scans = service(
      repository,
      { load: vi.fn() },
      { read: vi.fn() },
      () => `scan-${++id}`,
    );

    expect(() =>
      scans.startScheduled("main", () => {
        throw new Error("scheduler rejected");
      }),
    ).toThrow("scheduler rejected");

    expect(scans.get("scan-1")).toMatchObject({
      durable: false,
      error: {
        code: "STORAGE_WRITE_FAILED",
        message: "Scan progress could not be saved.",
      },
      stage: "FAILED",
      status: "FAILED",
    });
    expect(durable.get("scan-1")).toMatchObject({
      durable: true,
      stage: "QUEUED",
      status: "QUEUED",
    });
    expect(scans.startScheduled("next", vi.fn())).toMatchObject({
      id: "scan-2",
      status: "QUEUED",
    });
    durable.close();
  });

  it("exposes a later storage failure as volatile without false durable history", async () => {
    const durable = new SqliteScanRepository(":memory:");
    const repository: ScanRepository = {
      checkWritable: () => durable.checkWritable(),
      complete: () => {
        throw new ScanExecutionError("STORAGE_WRITE_FAILED");
      },
      createQueued: (...args) => durable.createQueued(...args),
      failExplanation: (...args) => durable.failExplanation(...args),
      fail: () => {
        throw new ScanExecutionError("STORAGE_WRITE_FAILED");
      },
      get: (...args) => durable.get(...args),
      list: (...args) => durable.list(...args),
      requestExplanation: (...args) => durable.requestExplanation(...args),
      saveDesired: () => {
        throw new ScanExecutionError("STORAGE_WRITE_FAILED");
      },
      saveLive: () => {
        throw new ScanExecutionError("STORAGE_WRITE_FAILED");
      },
      saveExplanation: (...args) => durable.saveExplanation(...args),
      transition: () => {
        throw new ScanExecutionError("STORAGE_WRITE_FAILED");
      },
    };
    const scans = service(repository, { load: vi.fn() }, { read: vi.fn() });

    scans.start("main");
    await scans.run("scan-1");

    expect(scans.get("scan-1")).toMatchObject({
      durable: false,
      error: { code: "STORAGE_WRITE_FAILED" },
      stage: "FAILED",
      status: "FAILED",
    });
    expect(durable.get("scan-1")).toMatchObject({
      durable: true,
      error: null,
      stage: "QUEUED",
      status: "QUEUED",
    });
    durable.close();
  });

  it("probes repository writability on every persistence check", () => {
    const repository = new SqliteScanRepository(":memory:");
    const checkWritable = vi.spyOn(repository, "checkWritable");
    const scans = service(repository, { load: vi.fn() }, { read: vi.fn() });

    scans.checkPersistence();
    scans.checkPersistence();
    expect(checkWritable).toHaveBeenCalledTimes(2);

    checkWritable.mockImplementation(() => {
      throw new ScanExecutionError("STORAGE_UNAVAILABLE");
    });
    expect(() => scans.checkPersistence()).toThrowError(
      expect.objectContaining<Partial<ScanExecutionError>>({
        code: "STORAGE_UNAVAILABLE",
      }),
    );
    repository.close();
  });

  it("fails history closed after bounded volatile failure eviction", () => {
    const durable = new SqliteScanRepository(":memory:");
    const repository: ScanRepository = {
      checkWritable: () => durable.checkWritable(),
      complete: (...args) => durable.complete(...args),
      createQueued: (...args) => durable.createQueued(...args),
      failExplanation: (...args) => durable.failExplanation(...args),
      fail: () => {
        throw new ScanExecutionError("STORAGE_WRITE_FAILED");
      },
      get: (...args) => durable.get(...args),
      list: (...args) => durable.list(...args),
      requestExplanation: (...args) => durable.requestExplanation(...args),
      saveDesired: (...args) => durable.saveDesired(...args),
      saveLive: (...args) => durable.saveLive(...args),
      saveExplanation: (...args) => durable.saveExplanation(...args),
      transition: (...args) => durable.transition(...args),
    };
    let id = 0;
    const scans = service(
      repository,
      { load: vi.fn() },
      { read: vi.fn() },
      () => `scan-${++id}`,
    );

    for (let attempt = 1; attempt <= 51; attempt += 1) {
      expect(() =>
        scans.startScheduled(`ref-${attempt}`, () => {
          throw new Error("scheduler rejected");
        }),
      ).toThrow("scheduler rejected");
    }

    expect(scans.get("scan-51")).toMatchObject({
      durable: false,
      status: "FAILED",
    });
    expect(durable.get("scan-1")).toMatchObject({
      durable: true,
      status: "QUEUED",
    });
    for (const readHistory of [
      () => scans.get("scan-1"),
      () => scans.list(50),
      () => scans.checkPersistence(),
      () => scans.start("blocked"),
    ]) {
      expect(readHistory).toThrowError(
        expect.objectContaining<Partial<ScanExecutionError>>({
          code: "STORAGE_UNAVAILABLE",
        }),
      );
    }
    durable.close();
  });
});
