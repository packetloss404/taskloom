import { I } from "../icons";
import { Topbar, Stat, PanelHeader } from "../Shell";
import { useApiData } from "../useApiData";
import { useWorkbench } from "../WorkbenchContext";
import { api } from "@/lib/api";
import { canManageWorkspaceRole } from "@/lib/roles";

interface StatusReport {
  generatedAt?: string;
  status?: string;
  storageTopology?: { posture?: string; engine?: string; databasePath?: string; sizeBytes?: number; walSizeBytes?: number; pageSize?: number; freePages?: number; lastVacuumAt?: string };
  managedDatabaseTopology?: unknown;
}

export function StorageView() {
  const role = useWorkbench().session.workspace.role;
  const canManageWorkspace = canManageWorkspaceRole(role);
  const status = useApiData<StatusReport>(() => canManageWorkspace ? api.getOperationsStatus() as Promise<StatusReport> : Promise.resolve({}), [canManageWorkspace]);
  const health = useApiData(() => canManageWorkspace ? api.getOperationsHealth() as Promise<{ subsystems?: Array<{ name: string; status: string; detail: string }> }> : Promise.resolve({ subsystems: [] }), [canManageWorkspace]);

  const topology = status.data?.storageTopology;
  const sizeMb = topology?.sizeBytes ? (topology.sizeBytes / (1024 * 1024)).toFixed(1) : null;
  const walMb = topology?.walSizeBytes ? (topology.walSizeBytes / (1024 * 1024)).toFixed(1) : null;
  const storeSubsystem = (health.data?.subsystems ?? []).find(s => s.name === "store" || s.name === "managed_pg");

  return (
    <>
      <Topbar crumbs={["__WS__", "Admin", "Storage"]}
        actions={canManageWorkspace ? <button className="top-btn" onClick={() => { void status.refresh(); void health.refresh(); }}><I.refresh size={13}/> Refresh</button> : null}/>
      <div style={{ padding: "26px 28px 60px", maxWidth: 1180 }}>
        {!canManageWorkspace ? (
          <div className="card" style={{ padding: 18 }}>
            <div className="h3" style={{ fontSize: 14, marginBottom: 8 }}>Admin access required</div>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
              Storage topology and maintenance posture are only available to workspace admins.
            </p>
          </div>
        ) : (
        <>
        <div className="kicker">STORAGE</div>
        <h1 className="h1" style={{ fontSize: 28, marginTop: 4, marginBottom: 4 }}>Database & storage</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {topology?.engine ?? "—"}
          {topology?.posture ? ` · ${topology.posture}` : ""}
          {sizeMb ? ` · ${sizeMb} MB on disk` : ""}
        </p>

        {(status.loading || health.loading) && <div className="muted" style={{ marginBottom: 16 }}>Loading…</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          <Stat label="Engine" value={topology?.engine ?? "—"} sub={topology?.posture ?? ""}/>
          <Stat label="On disk" value={sizeMb ? `${sizeMb} MB` : "—"} sub={walMb ? `WAL ${walMb} MB` : ""}/>
          <Stat label="Page size" value={topology?.pageSize ? `${topology.pageSize}B` : "—"} sub={topology?.freePages ? `${topology.freePages} free pages` : ""}/>
          <Stat label="Last vacuum" value={topology?.lastVacuumAt ? new Date(topology.lastVacuumAt).toLocaleDateString() : "—"} sub="auto-scheduled"/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <PanelHeader title="Storage subsystem" sub={storeSubsystem?.detail ?? "—"}/>
            <div style={{ padding: 16 }}>
              {storeSubsystem ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`pill ${storeSubsystem.status === "ok" ? "good" : storeSubsystem.status === "degraded" ? "warn" : "muted"}`}>
                    <span className="dot"></span>{storeSubsystem.status}
                  </span>
                  <div className="mono muted" style={{ fontSize: 12 }}>{storeSubsystem.name}</div>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 13 }}>No store status reported.</div>
              )}
              {topology?.databasePath && (
                <div className="mono muted" style={{ fontSize: 11.5, marginTop: 12 }}>path: {topology.databasePath}</div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="h3" style={{ fontSize: 14, marginBottom: 8 }}>Maintenance</div>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
              Manual VACUUM, index analysis, WAL checkpoint, and schema inspection controls are not exposed by the server in this build.
            </p>
          </div>
        </div>
        </>
        )}
      </div>
    </>
  );
}
