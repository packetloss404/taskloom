import { I } from "../icons";
import { Topbar, PanelHeader } from "../Shell";
import { useApiData } from "../useApiData";
import { api } from "@/lib/api";

export function BackupsView() {
  const status = useApiData<{ storageTopology?: Record<string, unknown>; releaseEvidence?: Record<string, unknown>; managedDatabaseTopology?: Record<string, unknown> }>(
    () => api.getOperationsStatus() as Promise<{ storageTopology?: Record<string, unknown>; releaseEvidence?: Record<string, unknown> }>,
    [],
  );
  const evidence = status.data?.releaseEvidence;
  const topology = status.data?.storageTopology;

  return (
    <>
      <Topbar crumbs={["__WS__", "Admin", "Backups & data"]}
        actions={<button className="top-btn" onClick={() => { void status.refresh(); }}><I.refresh size={13}/> Refresh</button>}/>
      <div style={{ padding: "26px 28px 60px", maxWidth: 1180 }}>
        <div className="kicker">DATA PROTECTION</div>
        <h1 className="h1" style={{ fontSize: 28, marginTop: 4, marginBottom: 4 }}>Backups & restore</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          Backup orchestration is configured per-deployment. The topology and release-evidence reports below come live from the operations status endpoint.
        </p>

        {status.loading && <div className="muted" style={{ marginBottom: 16 }}>Loading…</div>}
        {status.error && <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{status.error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="Storage topology"/>
            <div style={{ padding: 16 }}>
              {topology
                ? <pre className="mono" style={{ margin: 0, fontSize: 11.5, color: "var(--silver-200)", whiteSpace: "pre-wrap" }}>{JSON.stringify(topology, null, 2)}</pre>
                : <div className="muted" style={{ fontSize: 13 }}>No topology reported.</div>}
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="Release evidence"/>
            <div style={{ padding: 16 }}>
              {evidence
                ? <pre className="mono" style={{ margin: 0, fontSize: 11.5, color: "var(--silver-200)", whiteSpace: "pre-wrap" }}>{JSON.stringify(evidence, null, 2)}</pre>
                : <div className="muted" style={{ fontSize: 13 }}>No release evidence captured yet.</div>}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <div className="h3" style={{ fontSize: 14, marginBottom: 12 }}>Data export</div>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
            One-click export of the workspace as a portable archive — agents, runs, audit log, secrets envelope (encrypted).
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled><I.doc size={12}/> Export full archive</button>
            <button className="btn" disabled><I.doc size={12}/> Export audit only</button>
            <button className="btn" style={{ color: "var(--danger)", borderColor: "rgba(242,107,92,0.25)", marginLeft: "auto" }} disabled><I.trash size={12}/> Purge old backups…</button>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>Export and purge actions require server-side endpoints not yet exposed.</p>
        </div>
      </div>
    </>
  );
}
