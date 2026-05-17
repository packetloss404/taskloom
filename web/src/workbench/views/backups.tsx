import { PanelHeader } from "../Shell";
import { useApiData } from "../useApiData";
import { useWorkbench } from "../WorkbenchContext";
import { api } from "@/lib/api";
import { canManageWorkspaceRole } from "@/lib/roles";

export function BackupsView() {
  const role = useWorkbench().session.workspace.role;
  const canManageWorkspace = canManageWorkspaceRole(role);
  const status = useApiData<{ storageTopology?: Record<string, unknown>; releaseEvidence?: Record<string, unknown>; managedDatabaseTopology?: Record<string, unknown> }>(
    () => canManageWorkspace ? api.getOperationsStatus() as Promise<{ storageTopology?: Record<string, unknown>; releaseEvidence?: Record<string, unknown> }> : Promise.resolve({}),
    [canManageWorkspace],
  );
  const evidence = status.data?.releaseEvidence;
  const topology = status.data?.storageTopology;

  return (
    <div style={{ padding: "26px 28px 60px", maxWidth: 1180 }}>
        {!canManageWorkspace ? (
          <div className="card" style={{ padding: 18 }}>
            <div className="h3" style={{ fontSize: 14, marginBottom: 8 }}>Admin access required</div>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
              Backup topology, release evidence, and data export posture are only available to workspace admins.
            </p>
          </div>
        ) : (
        <>
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
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
            Export and purge controls are not exposed by the server in this build.
          </p>
        </div>
        </>
        )}
    </div>
  );
}
