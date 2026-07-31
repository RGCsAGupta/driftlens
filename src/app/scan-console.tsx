"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { createScanApi, ScanApiError, type ScanApi } from "@/app/scan-api";
import type {
  Difference,
  ScanRecord,
  ScanStage,
  SourceMetadata,
} from "@/server/scans/contracts";

const STAGE_LABELS: Record<ScanStage, string> = {
  QUEUED: "Queued",
  LOADING_DESIRED: "Loading desired manifest",
  READING_LIVE: "Reading live Deployment",
  COMPARING: "Comparing supported fields",
  SAVING_RESULT: "Saving result",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

const TERMINAL = new Set(["COMPLETED", "FAILED"]);

function formatTime(value: string): string {
  return value.replace("T", " ").replace(".000Z", " UTC");
}

function differenceIdentity(field: string): string {
  if (field === "spec.replicas") return "Replicas";
  const match = field.match(
    /^spec\.template\.spec\.containers\[name=(.+)]\.image$/,
  );
  return match ? `Container ${match[1]} image` : field;
}

function valueText(value: Difference["live"] | Difference["desired"]): string {
  return value === null ? "Missing" : String(value);
}

function mergeRecords(
  current: Record<string, ScanRecord>,
  scans: ScanRecord[],
) {
  const next = { ...current };
  for (const scan of scans) next[scan.id] = scan;
  return next;
}

function setScanQuery(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("scan", id);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function ScanDetails({ scan }: { scan: ScanRecord }) {
  return (
    <article className="scan-details" aria-labelledby="scan-details-title">
      <div className="detail-heading">
        <div>
          <p className="section-kicker">Selected scan</p>
          <h2 id="scan-details-title">{scan.requestedRef}</h2>
        </div>
        <span className={`status-badge status-${scan.status.toLowerCase()}`}>
          {scan.outcome?.replace("_", " ") ?? scan.status}
        </span>
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-busy={!TERMINAL.has(scan.status)}
      >
        Stage: <strong>{STAGE_LABELS[scan.stage]}</strong>
      </p>

      <ol className="stage-timeline" aria-label="Scan stage history">
        {scan.stages.map((entry, index) => (
          <li key={`${entry.at}-${entry.stage}-${index}`}>
            <strong>{STAGE_LABELS[entry.stage]}</strong>
            <span>{formatTime(entry.at)}</span>
          </li>
        ))}
      </ol>

      {scan.target ? (
        <dl className="scan-meta">
          <div>
            <dt>Deployment</dt>
            <dd>
              {scan.target.namespace}/{scan.target.name}
            </dd>
          </div>
          <div>
            <dt>Resolved commit</dt>
            <dd className="code-value">{scan.resolvedSha}</dd>
          </div>
        </dl>
      ) : null}

      {scan.error ? (
        <div className="error-panel" role="alert">
          <strong>{scan.error.code}</strong>
          <p>{scan.error.message}</p>
          <p>
            Correct the reported issue, then start a new scan. DriftLens does
            not retry failed scans.
          </p>
        </div>
      ) : null}

      {scan.outcome === "IN_SYNC" ? (
        <p className="outcome-copy">✓ Desired and live fields are in sync.</p>
      ) : null}
      {scan.outcome === "MISSING_LIVE" ? (
        <p className="outcome-copy">! Matching live Deployment is missing.</p>
      ) : null}
      {scan.outcome === "DRIFTED" ? (
        <div className="table-wrap">
          <table>
            <caption>Supported field differences</caption>
            <thead>
              <tr>
                <th scope="col">Field or container</th>
                <th scope="col">Desired</th>
                <th scope="col">Live</th>
              </tr>
            </thead>
            <tbody>
              {scan.differences.map((difference) => (
                <tr key={difference.field}>
                  <th scope="row">{differenceIdentity(difference.field)}</th>
                  <td>{valueText(difference.desired)}</td>
                  <td>{valueText(difference.live)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

export function ScanConsole({
  api: suppliedApi,
  pollIntervalMs = 750,
}: {
  api?: ScanApi;
  pollIntervalMs?: number;
}) {
  const api = useMemo(() => suppliedApi ?? createScanApi(), [suppliedApi]);
  const [source, setSource] = useState<SourceMetadata | null>(null);
  const [records, setRecords] = useState<Record<string, ScanRecord>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ref, setRef] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshHistory() {
    const scans = await api.listScans();
    setRecords((current) => mergeRecords(current, scans));
    setHistory(scans.map(({ id }) => id));
    return scans;
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.getSource(), api.listScans()])
      .then(async ([nextSource, scans]) => {
        if (cancelled) return;
        setSource(nextSource);
        setRecords((current) => mergeRecords(current, scans));
        setHistory(scans.map(({ id }) => id));
        const requestedId = new URLSearchParams(window.location.search).get(
          "scan",
        );
        const selected = requestedId ?? scans[0]?.id ?? null;
        if (!selected) return;
        setSelectedId(selected);
        if (!scans.some(({ id }) => id === selected)) {
          const detail = await api.getScan(selected);
          if (!cancelled)
            setRecords((current) => mergeRecords(current, [detail]));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(
            error instanceof Error
              ? error.message
              : "Console data could not be loaded.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const scan = await api.getScan(activeId);
        if (cancelled) return;
        setRecords((current) => mergeRecords(current, [scan]));
        if (TERMINAL.has(scan.status)) {
          setActiveId(null);
          await refreshHistory();
          return;
        }
        timer = setTimeout(poll, pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        const code =
          error instanceof ScanApiError ? error.code : "TRANSPORT_ERROR";
        setMessage(
          `Polling stopped (${code}). Refresh the page to retrieve current scan state.`,
        );
      }
    };
    timer = setTimeout(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeId, api, pollIntervalMs]);

  function selectScan(id: string) {
    setSelectedId(id);
    setScanQuery(id);
    if (!records[id]) {
      void api
        .getScan(id)
        .then((scan) => setRecords((current) => mergeRecords(current, [scan])))
        .catch((error: unknown) =>
          setMessage(
            error instanceof Error
              ? error.message
              : "Scan could not be loaded.",
          ),
        );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || activeId) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const scan = await api.startScan(ref);
      setRecords((current) => mergeRecords(current, [scan]));
      setHistory((current) => [
        scan.id,
        ...current.filter((id) => id !== scan.id),
      ]);
      setSelectedId(scan.id);
      setScanQuery(scan.id);
      setActiveId(scan.id);
    } catch (error) {
      const safe =
        error instanceof ScanApiError
          ? `${error.code}: ${error.message}`
          : "Scan could not be started.";
      setMessage(safe);
      if (error instanceof ScanApiError && error.code === "SCAN_ACTIVE") {
        void refreshHistory().catch(() => undefined);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const selected = selectedId ? records[selectedId] : undefined;
  const busy = submitting || activeId !== null;

  return (
    <main>
      <div className="console-layout">
        <header className="console-header">
          <div>
            <p className="eyebrow">Read-only Kubernetes drift</p>
            <h1>DriftLens</h1>
          </div>
          <p>
            Compare one configured public Deployment manifest with its live
            cluster state.
          </p>
          {source ? (
            <p className="source-line">
              <strong>{source.repository}</strong>
              <span>{source.manifestPath}</span>
            </p>
          ) : null}
        </header>

        <section className="scan-control" aria-labelledby="run-scan-title">
          <h2 id="run-scan-title">Run a scan</h2>
          <form onSubmit={submit}>
            <label htmlFor="scan-ref">Branch or commit SHA</label>
            <div className="control-row">
              <input
                id="scan-ref"
                name="ref"
                value={ref}
                onChange={(event) => setRef(event.target.value)}
                maxLength={200}
                required
                disabled={busy}
              />
              <button type="submit" disabled={busy}>
                {busy ? "Scan in progress…" : "Run scan"}
              </button>
            </div>
          </form>
          {message ? (
            <div className="console-message" role="alert">
              {message}
            </div>
          ) : null}
        </section>

        <div className="workspace-grid">
          <nav className="history-panel" aria-labelledby="history-title">
            <div className="panel-heading">
              <h2 id="history-title">History</h2>
              <span>Newest first</span>
            </div>
            {history.length === 0 ? (
              <p>No scans yet.</p>
            ) : (
              <ul>
                {history.map((id) => {
                  const scan = records[id];
                  if (!scan) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => selectScan(id)}
                        aria-current={id === selectedId ? "true" : undefined}
                      >
                        <strong>{scan.requestedRef}</strong>
                        <span>{formatTime(scan.createdAt)}</span>
                        <span>
                          Target:{" "}
                          {scan.target
                            ? `${scan.target.namespace}/${scan.target.name}`
                            : TERMINAL.has(scan.status)
                              ? "Unavailable"
                              : "Pending"}
                        </span>
                        <span>
                          {scan.status}
                          {scan.outcome
                            ? ` · ${scan.outcome.replace("_", " ")}`
                            : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
          <section className="result-panel" aria-label="Scan result">
            {selected ? (
              <ScanDetails scan={selected} />
            ) : (
              <p className="empty-result">Select a scan or start a new one.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
