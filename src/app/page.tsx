const foundationCapabilities = [
  "Read-only Kubernetes workflow",
  "Deterministic field comparison",
  "Persistent scan history",
] as const;

export default function Home() {
  return (
    <main>
      <section className="console" aria-labelledby="page-title">
        <div className="eyebrow">
          <span className="status-dot" aria-hidden="true" />
          Application foundation
        </div>
        <h1 id="page-title">DriftLens</h1>
        <p className="lede">
          A focused operator console for comparing the desired state of one
          Kubernetes Deployment with its live cluster state.
        </p>

        <div className="capability-grid" aria-label="Planned MVP capabilities">
          {foundationCapabilities.map((capability) => (
            <div className="capability" key={capability}>
              <span aria-hidden="true">↗</span>
              {capability}
            </div>
          ))}
        </div>

        <aside className="foundation-note">
          <strong>Foundation ready.</strong>
          <span>Scan controls arrive in the next approved vertical slice.</span>
        </aside>
      </section>
    </main>
  );
}
