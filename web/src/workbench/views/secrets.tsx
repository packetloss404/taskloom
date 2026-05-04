import { I } from "../icons";
import { Topbar, PanelHeader } from "../Shell";
import { AdminToggle } from "./admin-controls";
import { useApiData } from "../useApiData";
import { api } from "@/lib/api";

export function SecretsView() {
  const envVars = useApiData(() => api.listEnvVars(), []);
  const list = envVars.data ?? [];
  const secrets = list.filter(e => e.secret);

  return (
    <>
      <Topbar crumbs={["__WS__", "Admin", "Secrets"]}
        actions={<button className="top-btn"><I.plus size={13}/> New secret</button>}/>
      <div style={{ padding: "26px 28px 60px", maxWidth: 1180 }}>
        <div className="kicker">VAULT</div>
        <h1 className="h1" style={{ fontSize: 28, marginTop: 4, marginBottom: 4 }}>Secrets</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {secrets.length} secret{secrets.length === 1 ? "" : "s"} · {list.length - secrets.length} non-secret env vars · accessed via reference, never returned in plaintext over HTTP.
        </p>

        {envVars.loading && <div className="muted">Loading…</div>}
        <div className="card" style={{ overflow: "hidden", marginBottom: 18 }}>
          <table className="tbl">
            <thead><tr><th>Name</th><th>Scope</th><th>Length</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {secrets.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <I.shield size={12} style={{ color: "var(--green)" }}/>
                      <span className="mono" style={{ color: "var(--silver-50)", fontSize: 12 }}>{s.key}</span>
                    </div>
                  </td>
                  <td><span className="pill muted">{s.scope}</span></td>
                  <td className="mono muted" style={{ fontSize: 11.5 }}>{s.valueLength ?? "—"} chars</td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(s.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm" style={{ padding: "3px 8px" }}><I.refresh size={11}/> Rotate</button>
                    <button className="btn btn-sm" style={{ padding: "3px 8px", marginLeft: 4, color: "var(--danger)" }} onClick={async () => { try { await api.deleteEnvVar(s.id); await envVars.refresh(); } catch (e) { console.error(e); } }}>Delete</button>
                  </td>
                </tr>
              ))}
              {secrets.length === 0 && !envVars.loading && (
                <tr><td colSpan={5} className="muted" style={{ padding: 18, textAlign: "center" }}>No secrets in the vault yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="h3" style={{ fontSize: 14, marginBottom: 6 }}>Rotation policy</div>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
            Secrets are stored encrypted at rest with envelope encryption. Rotations create a new version and invalidate prior plaintext.
          </p>
          <AdminToggle label="Auto-rotate when overdue" sub="Triggers a rotation job 24h after policy expiry" on={true}/>
          <AdminToggle label="Block reveal in production" sub="Reveal returns reference id only; plaintext never leaves the host" on={true}/>
          <AdminToggle label="Require approval for cross-scope reads" sub="2 reviewers required for workspace → agent secret reads" on={false}/>
        </div>
      </div>
    </>
  );
}
