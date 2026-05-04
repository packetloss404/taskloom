import { useState } from "react";
import { I } from "../icons";
import { Topbar } from "../Shell";
import { useApiData } from "../useApiData";
import { useWorkbench } from "../WorkbenchContext";
import { api } from "@/lib/api";

type Tab = "members" | "invitations" | "shares" | "keys" | "workspace" | "audit";

export function SettingsView() {
  const [tab, setTab] = useState<Tab>("members");
  const members = useApiData(() => api.listWorkspaceMembers(), []);
  const apiKeys = useApiData(() => api.listApiKeys(), []);
  const shares = useApiData(() => api.listShareTokens(), []);
  const activity = useApiData(() => api.listActivity(), []);

  const memberCount = members.data?.members.length ?? 0;
  const inviteCount = members.data?.invitations.length ?? 0;
  const shareCount = shares.data?.length ?? 0;
  const keyCount = apiKeys.data?.length ?? 0;

  return (
    <>
      <Topbar crumbs={["__WS__", "Settings"]}/>
      <div className="tabbar">
        {([
          { id: "members", label: "Members", count: memberCount },
          { id: "invitations", label: "Invitations", count: inviteCount },
          { id: "shares", label: "Share tokens", count: shareCount },
          { id: "keys", label: "API keys", count: keyCount },
          { id: "workspace", label: "Workspace" },
          { id: "audit", label: "Audit log" },
        ] as const).map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id as Tab)}>
            {t.label}{"count" in t && t.count !== undefined && <span className="mono muted" style={{ fontSize: 10.5, marginLeft: 6 }}>{t.count}</span>}
          </div>
        ))}
      </div>
      <div style={{ padding: "26px 28px", maxWidth: 1080 }}>
        {tab === "members" && <MembersTab data={members.data} loading={members.loading} refresh={members.refresh}/>}
        {tab === "invitations" && <InvitesTab data={members.data} loading={members.loading} refresh={members.refresh}/>}
        {tab === "shares" && <SharesTab data={shares.data} loading={shares.loading} refresh={shares.refresh}/>}
        {tab === "keys" && <KeysTab data={apiKeys.data} loading={apiKeys.loading} refresh={apiKeys.refresh}/>}
        {tab === "workspace" && <WorkspaceTab/>}
        {tab === "audit" && <AuditTab data={activity.data} loading={activity.loading}/>}
      </div>
    </>
  );
}

function MembersTab({ data, loading, refresh }: { data: { members: ReadonlyArray<{ userId: string; email: string; displayName: string; role: string; joinedAt: string }> } | null; loading: boolean; refresh: () => Promise<void> }) {
  const list = data?.members ?? [];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
        <h1 className="h1" style={{ fontSize: 24 }}>Members</h1>
        <span className="muted" style={{ marginLeft: 8 }}>· roles enforced server-side</span>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }}><I.plus size={12}/> Invite</button>
      </div>
      {loading && <div className="muted">Loading…</div>}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {list.map(m => (
              <tr key={m.userId}>
                <td style={{ color: "var(--silver-50)", fontWeight: 500 }}>{m.displayName}</td>
                <td className="mono" style={{ fontSize: 12 }}>{m.email}</td>
                <td><span className={`pill ${m.role === "owner" ? "good" : m.role === "viewer" ? "muted" : "info"}`}>{m.role}</span></td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(m.joinedAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-sm" style={{ padding: "3px 8px" }} onClick={async () => { try { await api.removeWorkspaceMember(m.userId); await refresh(); } catch (e) { console.error(e); } }}>Remove</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && <tr><td colSpan={5} className="muted" style={{ padding: 18, textAlign: "center" }}>Just you so far.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvitesTab({ data, loading, refresh }: { data: { invitations: ReadonlyArray<{ id: string; email: string; role: string; status: string; expiresAt: string; tokenPreview?: string }> } | null; loading: boolean; refresh: () => Promise<void> }) {
  const list = data?.invitations ?? [];
  return (
    <div>
      <h1 className="h1" style={{ fontSize: 24, marginBottom: 14 }}>Pending invitations</h1>
      {loading && <div className="muted">Loading…</div>}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Token</th><th></th></tr></thead>
          <tbody>
            {list.map(i => (
              <tr key={i.id}>
                <td className="mono" style={{ color: "var(--silver-50)" }}>{i.email}</td>
                <td><span className="pill info">{i.role}</span></td>
                <td><span className={`pill ${i.status === "pending" ? "warn" : i.status === "accepted" ? "good" : "muted"}`}><span className="dot"></span>{i.status}</span></td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(i.expiresAt).toLocaleDateString()}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{i.tokenPreview ?? "—"}</td>
                <td>
                  <button className="btn btn-sm" style={{ padding: "3px 8px" }} onClick={async () => { try { await api.resendWorkspaceInvitation(i.id); await refresh(); } catch (e) { console.error(e); } }}>Resend</button>
                  <button className="btn btn-sm" style={{ padding: "3px 8px", marginLeft: 4, color: "var(--danger)" }} onClick={async () => { try { await api.revokeWorkspaceInvitation(i.id); await refresh(); } catch (e) { console.error(e); } }}>Revoke</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && <tr><td colSpan={6} className="muted" style={{ padding: 18, textAlign: "center" }}>No pending invitations.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SharesTab({ data, loading, refresh }: { data: ReadonlyArray<{ id: string; scope: string; tokenPreview?: string; expiresAt?: string; createdAt: string; revokedAt?: string }> | null; loading: boolean; refresh: () => Promise<void> }) {
  const list = data ?? [];
  return (
    <div>
      <h1 className="h1" style={{ fontSize: 24, marginBottom: 14 }}>Share tokens</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Read-only public links. Scopes are enforced server-side; token rotation invalidates any prior URL.</p>
      {loading && <div className="muted">Loading…</div>}
      {list.map(s => (
        <div key={s.id} className="card" style={{ padding: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <I.link size={14} style={{ color: "var(--green)" }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>scope: <span className="mono" style={{ color: "var(--green)" }}>{s.scope}</span></div>
            <div className="mono muted" style={{ fontSize: 11 }}>created {new Date(s.createdAt).toLocaleDateString()}{s.expiresAt ? ` · expires ${new Date(s.expiresAt).toLocaleDateString()}` : " · no expiry"}</div>
          </div>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--silver-400)" }}>{s.tokenPreview ?? "—"}</span>
          <button className="btn btn-sm" style={{ color: "var(--danger)" }} onClick={async () => { try { await api.deleteShareToken(s.id); await refresh(); } catch (e) { console.error(e); } }}>Revoke</button>
        </div>
      ))}
      {list.length === 0 && !loading && <div className="card muted" style={{ padding: 16 }}>No share tokens.</div>}
    </div>
  );
}

function KeysTab({ data, loading, refresh }: { data: ReadonlyArray<{ id: string; provider: string; label: string; masked: string; createdAt: string; lastUsedAt?: string }> | null; loading: boolean; refresh: () => Promise<void> }) {
  const list = data ?? [];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
        <h1 className="h1" style={{ fontSize: 24 }}>API keys</h1>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }}><I.plus size={12}/> New key</button>
      </div>
      {loading && <div className="muted">Loading…</div>}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Label</th><th>Provider</th><th>Token</th><th>Created</th><th>Last used</th><th></th></tr></thead>
          <tbody>
            {list.map(k => (
              <tr key={k.id}>
                <td style={{ color: "var(--silver-50)", fontWeight: 500 }}>{k.label}</td>
                <td><span className="pill info">{k.provider}</span></td>
                <td className="mono" style={{ fontSize: 11.5 }}>{k.masked}</td>
                <td className="muted" style={{ fontSize: 12 }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                <td className="muted" style={{ fontSize: 12 }}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "—"}</td>
                <td><button className="btn btn-sm" style={{ padding: "3px 8px", color: "var(--danger)" }} onClick={async () => { try { await api.deleteApiKey(k.id); await refresh(); } catch (e) { console.error(e); } }}>Revoke</button></td>
              </tr>
            ))}
            {list.length === 0 && !loading && <tr><td colSpan={6} className="muted" style={{ padding: 18, textAlign: "center" }}>No API keys yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkspaceTab() {
  const session = useWorkbench().session;
  const ws = session.workspace;
  const [name, setName] = useState(ws.name);
  const [website, setWebsite] = useState(ws.website || "");
  const [goal, setGoal] = useState(ws.automationGoal || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateWorkspace({ name, website, automationGoal: goal });
      setSavedAt(Date.now());
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="h1" style={{ fontSize: 24, marginBottom: 14 }}>Workspace</h1>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <label className="label">Name</label>
          <input className="field" value={name} onChange={e => setName(e.target.value)}/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="label">Slug</label>
          <input className="field mono" value={ws.slug} readOnly/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="label">Website</label>
          <input className="field" value={website} onChange={e => setWebsite(e.target.value)}/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label className="label">Automation goal</label>
          <textarea className="field" value={goal} onChange={e => setGoal(e.target.value)}/>
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid var(--line)", alignItems: "center" }}>
          <button className="btn btn-primary" onClick={() => { void save(); }} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          {savedAt && <span className="mono muted" style={{ fontSize: 11 }}>Saved · {new Date(savedAt).toLocaleTimeString()}</span>}
        </div>
      </div>
    </div>
  );
}

function AuditTab({ data, loading }: { data: ReadonlyArray<{ id: string; event: string; scope: string; occurredAt: string; actor: { type: string; displayName?: string }; data: Record<string, unknown> }> | null; loading: boolean }) {
  const list = data ?? [];
  return (
    <div>
      <h1 className="h1" style={{ fontSize: 24, marginBottom: 14 }}>Audit log</h1>
      {loading && <div className="muted">Loading…</div>}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>When</th><th>Event</th><th>Actor</th><th>Scope</th><th>Detail</th></tr></thead>
          <tbody>
            {list.map(a => (
              <tr key={a.id}>
                <td className="mono muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{new Date(a.occurredAt).toLocaleString()}</td>
                <td className="mono" style={{ color: "var(--green)", fontSize: 11.5 }}>{a.event}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>{a.actor.displayName ?? a.actor.type}</td>
                <td><span className="pill muted">{a.scope}</span></td>
                <td style={{ fontSize: 12.5 }}>{summarizeData(a.data)}</td>
              </tr>
            ))}
            {list.length === 0 && !loading && <tr><td colSpan={5} className="muted" style={{ padding: 18, textAlign: "center" }}>No audit entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarizeData(data: Record<string, unknown>): string {
  const keys = Object.keys(data ?? {});
  if (keys.length === 0) return "—";
  const first = keys[0]!;
  const val = data[first];
  return `${first}: ${typeof val === "object" ? JSON.stringify(val).slice(0, 60) : String(val).slice(0, 60)}`;
}
