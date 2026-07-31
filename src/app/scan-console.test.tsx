// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScanConsole, ScanDetails } from "@/app/scan-console";
import { ScanApiError, type ScanApi } from "@/app/scan-api";
import type { ScanRecord } from "@/server/scans/contracts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function record(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    completedAt: null,
    createdAt: "2026-07-31T12:00:00.000Z",
    desired: null,
    differences: [],
    durable: true,
    error: null,
    id: "scan-1",
    live: null,
    outcome: null,
    requestedRef: "main",
    resolvedSha: null,
    stage: "QUEUED",
    stages: [{ at: "2026-07-31T12:00:00.000Z", stage: "QUEUED" }],
    status: "QUEUED",
    target: null,
    updatedAt: "2026-07-31T12:00:00.000Z",
    ...overrides,
  };
}

function api(overrides: Partial<ScanApi> = {}): ScanApi {
  return {
    getScan: vi.fn().mockResolvedValue(record()),
    getSource: vi.fn().mockResolvedValue({
      manifestPath: "deploy/app.yaml",
      repository: "owner/repo",
    }),
    listScans: vi.fn().mockResolvedValue([]),
    startScan: vi.fn().mockResolvedValue(record()),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("scan result rendering", () => {
  it.each([
    ["IN_SYNC", /in sync/i],
    ["MISSING_LIVE", /live Deployment is missing/i],
  ] as const)("renders %s with a non-color cue", (outcome, text) => {
    render(
      <ScanDetails
        scan={record({ outcome, stage: "COMPLETED", status: "COMPLETED" })}
      />,
    );
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText(outcome.replace("_", " "))).toBeTruthy();
  });

  it("renders multiple exact replica and container differences", () => {
    render(
      <ScanDetails
        scan={record({
          differences: [
            { desired: 3, field: "spec.replicas", live: 1 },
            {
              desired: "api:2",
              field: "spec.template.spec.containers[name=api].image",
              live: null,
            },
          ],
          outcome: "DRIFTED",
          resolvedSha: SHA,
          stage: "COMPLETED",
          status: "COMPLETED",
          target: {
            apiVersion: "apps/v1",
            kind: "Deployment",
            name: "app",
            namespace: "demo",
          },
        })}
      />,
    );

    expect(
      screen.getByRole("table", { name: /supported field differences/i }),
    ).toBeTruthy();
    expect(screen.getByText("Replicas")).toBeTruthy();
    expect(screen.getByText("Container api image")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
    expect(screen.getByText("demo/app")).toBeTruthy();
    expect(screen.getByText(SHA)).toBeTruthy();
  });

  it("renders a long safe failure with new-scan guidance", () => {
    render(
      <ScanDetails
        scan={record({
          error: {
            code: "KUBERNETES_FORBIDDEN",
            message:
              "The configured identity cannot read the Deployment safely.",
          },
          stage: "FAILED",
          status: "FAILED",
        })}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "KUBERNETES_FORBIDDEN",
    );
    expect(screen.getByRole("alert").textContent).toMatch(/start a new scan/i);
  });
});

describe("scan console interaction", () => {
  it("polls every Core stage through completed in-sync and refreshes history", async () => {
    const stages = [
      "LOADING_DESIRED",
      "READING_LIVE",
      "COMPARING",
      "SAVING_RESULT",
    ] as const;
    const completed = record({
      completedAt: "2026-07-31T12:00:05.000Z",
      outcome: "IN_SYNC",
      stage: "COMPLETED",
      status: "COMPLETED",
    });
    const getScan = vi
      .fn()
      .mockResolvedValueOnce(record({ stage: stages[0], status: "RUNNING" }))
      .mockResolvedValueOnce(record({ stage: stages[1], status: "RUNNING" }))
      .mockResolvedValueOnce(record({ stage: stages[2], status: "RUNNING" }))
      .mockResolvedValueOnce(record({ stage: stages[3], status: "RUNNING" }))
      .mockResolvedValueOnce(completed);
    const listScans = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([completed]);
    render(
      <ScanConsole api={api({ getScan, listScans })} pollIntervalMs={1} />,
    );

    await screen.findByText("No scans yet.");
    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));
    expect(
      await screen.findByText(/Desired and live fields are in sync/),
    ).toBeTruthy();
    expect(getScan).toHaveBeenCalledTimes(5);
    expect(listScans).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["QUEUED", null, "QUEUED"],
    ["RUNNING", null, "RUNNING"],
    ["COMPLETED", "MISSING_LIVE", "COMPLETED · MISSING LIVE"],
    ["FAILED", null, "FAILED"],
  ] as const)(
    "renders %s history with outcome %s",
    async (status, outcome, expected) => {
      const item = record({
        id: `scan-${status}`,
        outcome,
        stage: status === "RUNNING" ? "READING_LIVE" : status,
        status,
        target:
          status === "COMPLETED"
            ? {
                apiVersion: "apps/v1",
                kind: "Deployment",
                name: "app",
                namespace: "demo",
              }
            : null,
      });
      render(
        <ScanConsole
          api={api({ listScans: vi.fn().mockResolvedValue([item]) })}
        />,
      );
      expect(
        await screen.findByRole("button", { name: new RegExp(expected) }),
      ).toBeTruthy();
      expect(
        screen.getByText(
          status === "COMPLETED"
            ? "Target: demo/app"
            : `Target: ${status === "FAILED" ? "Unavailable" : "Pending"}`,
        ),
      ).toBeTruthy();
    },
  );

  it("loads empty history and prevents duplicate submission while starting", async () => {
    let resolveStart!: (scan: ScanRecord) => void;
    const start = vi.fn(
      () =>
        new Promise<ScanRecord>((resolve) => {
          resolveStart = resolve;
        }),
    );
    render(<ScanConsole api={api({ startScan: start })} pollIntervalMs={5} />);

    expect(await screen.findByText("No scans yet.")).toBeTruthy();
    const input = screen.getByLabelText("Branch or commit SHA");
    const button = screen.getByRole("button", { name: "Run scan" });
    fireEvent.change(input, { target: { value: "feature/ref" } });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(start).toHaveBeenCalledOnce();
    expect(button.hasAttribute("disabled")).toBe(true);
    resolveStart(record({ requestedRef: "feature/ref" }));
    await screen.findByText("Scan in progress…");
  });

  it("keeps a selected historical scan when active polling resolves", async () => {
    const old = record({
      id: "old",
      requestedRef: "old-ref",
      status: "COMPLETED",
      stage: "COMPLETED",
      outcome: "IN_SYNC",
    });
    const queued = record({ id: "active", requestedRef: "main" });
    let resolvePoll!: (scan: ScanRecord) => void;
    const getScan = vi.fn(
      () =>
        new Promise<ScanRecord>((resolve) => {
          resolvePoll = resolve;
        }),
    );
    render(
      <ScanConsole
        api={api({
          getScan,
          listScans: vi.fn().mockResolvedValue([old]),
          startScan: vi.fn().mockResolvedValue(queued),
        })}
        pollIntervalMs={1}
      />,
    );

    await screen.findByRole("button", { name: /old-ref/i });
    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));
    await screen.findByText("Scan in progress…");
    await waitFor(() => expect(getScan).toHaveBeenCalledWith("active"));
    fireEvent.click(screen.getByRole("button", { name: /old-ref/i }));
    resolvePoll(
      record({
        id: "active",
        requestedRef: "main",
        status: "COMPLETED",
        stage: "COMPLETED",
        outcome: "MISSING_LIVE",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "old-ref" })).toBeTruthy(),
    );
    expect(window.location.search).toBe("?scan=old");
  });

  it("stops polling on transport failure and gives refresh guidance", async () => {
    const queued = record({ id: "active" });
    const getScan = vi
      .fn()
      .mockRejectedValue(new ScanApiError("TRANSPORT_ERROR", "offline"));
    render(
      <ScanConsole
        api={api({ getScan, startScan: vi.fn().mockResolvedValue(queued) })}
        pollIntervalMs={1}
      />,
    );
    await screen.findByText("No scans yet.");
    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Polling stopped \(TRANSPORT_ERROR\).*Refresh the page/,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(getScan).toHaveBeenCalledOnce();
  });

  it("keeps backend validation failures actionable", async () => {
    render(
      <ScanConsole
        api={api({
          startScan: vi
            .fn()
            .mockRejectedValue(
              new ScanApiError("INVALID_REQUEST", "Request is invalid."),
            ),
        })}
      />,
    );
    await screen.findByText("No scans yet.");
    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "INVALID_REQUEST: Request is invalid.",
    );
  });
});
