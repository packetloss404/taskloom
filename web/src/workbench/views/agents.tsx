import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { I } from "../icons";
import { Topbar } from "../Shell";
import { useApiData } from "../useApiData";
import { api } from "@/lib/api";
import type { AgentRecord } from "@/lib/types";

export function AgentsView() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"catalog" | "templates">("catalog");

  return (
    <>
      <Topbar
        crumbs={["__WS__", "Agents"]}
        actions={
          <button
            className="top-btn"
            style={{ background: "var(--green)", color: "#0E1A02", borderColor: "var(--green)", fontWeight: 600 }}
            onClick={() => navigate("/agents/new")}
          >
            <I.plus size={13}/> New agent
          </button>
        }
      />

      <div className="tabbar">
        {([
          { id: "catalog", label: "Catalog" },
          { id: "templates", label: "Templates" },
        ] as const).map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {tab === "catalog" && <AgentsCatalog onOpen={(a) => navigate(`/agents/${a.id}`)}/>}
      {tab === "templates" && <AgentTemplates onCreated={(a) => navigate(`/agents/${a.id}`)}/>}
    </>
  );
}

function AgentsCatalog({ onOpen }: { onOpen: (a: AgentRecord) => void }) {
  const agents = useApiData(() => api.listAgents(), []);
  const list = agents.data ?? [];
  const runs = useApiData(() => api.listAgentRuns(), []);
  const runs24hByAgent: Record<string, { total: number; success: number }> = {};
  for (const r of runs.data ?? []) {
    if (!r.agentId) continue;
    if (!r.startedAt) continue;
    if (Date.now() - new Date(r.startedAt).getTime() > 7 * 24 * 60 * 60 * 1000) continue;
    const cur = runs24hByAgent[r.agentId] ?? { total: 0, success: 0 };
    cur.total += 1;
    if (r.status === "success") cur.success += 1;
    runs24hByAgent[r.agentId] = cur;
  }

  const active = list.filter(a => a.status === "active").length;
  const paused = list.filter(a => a.status === "paused").length;

  return (
    <div style={{ padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <div className="kicker">CATALOG · {list.length} AGENT{list.length === 1 ? "" : "S"}</div>
          <h1 className="h1" style={{ fontSize: 28, marginTop: 4 }}>Agents</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>{active} active · {paused} paused</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <input className="field" placeholder="Search agents…" style={{ width: 240 }}/>
          <button className="btn btn-sm" onClick={() => agents.refresh()}><I.refresh size={12}/> Refresh</button>
        </div>
      </div>

      {agents.loading && <div className="muted" style={{ padding: 16 }}>Loading agents…</div>}
      {agents.error && <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{agents.error}</div>}
      {!agents.loading && !agents.error && list.length === 0 && (
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div className="h3" style={{ fontSize: 15, marginBottom: 6 }}>No agents yet</div>
          <p className="muted" style={{ fontSize: 13 }}>Create one from a template or describe what you want to build.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {list.map(a => {
          const stats = runs24hByAgent[a.id] ?? { total: 0, success: 0 };
          const successRate = stats.total > 0 ? stats.success / stats.total : 0;
          return (
            <div key={a.id} className="card" style={{ padding: 16, cursor: "pointer" }} onClick={() => onOpen(a)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-elev)", border: "1px solid var(--line)", display: "grid", placeItems: "center", color: a.status === "active" ? "var(--green)" : "var(--silver-400)" }}>
                  <I.bot size={15}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--silver-50)" }}>{a.name}</div>
                  <div className="mono muted" style={{ fontSize: 11 }}>{a.id} · {a.provider?.name ?? "—"} · {a.model ?? a.provider?.defaultModel ?? "—"}</div>
                </div>
                <span className={`pill ${a.status === "active" ? "good" : a.status === "paused" ? "warn" : "muted"}`}><span className="dot"></span>{a.status}</span>
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 12 }}>{a.description || "—"}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5 }} className="mono">
                <span style={{ color: "var(--silver-300)" }}>
                  <I.zap size={11} style={{ verticalAlign: "-2px" }}/> {a.triggerKind ?? "manual"}
                  {a.schedule ? ` · ${a.schedule}` : ""}
                </span>
                <span style={{ color: "var(--silver-400)" }}>{(a.enabledTools?.length ?? a.tools?.length ?? 0)} tools</span>
                <span style={{ color: "var(--silver-400)" }}>{stats.total} runs · 7d</span>
                {stats.total > 0 && (
                  <span style={{ color: successRate >= 0.9 ? "var(--green)" : successRate >= 0.7 ? "var(--warn)" : "var(--silver-400)" }}>
                    {(successRate * 100).toFixed(0)}% success
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentTemplates({ onCreated }: { onCreated: (a: AgentRecord) => void }) {
  const templates = useApiData(() => api.listAgentTemplates(), []);
  return (
    <div style={{ padding: "26px 28px" }}>
      <div className="kicker">TEMPLATES</div>
      <h1 className="h1" style={{ fontSize: 28, marginTop: 4, marginBottom: 16 }}>Start from a template</h1>
      {templates.loading && <div className="muted">Loading…</div>}
      {templates.error && <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{templates.error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {(templates.data ?? []).map(t => (
          <div key={t.id} className="card" style={{ padding: 16 }}>
            <div className="kicker" style={{ color: "var(--green)" }}>{t.category.toUpperCase()}</div>
            <div className="h3" style={{ fontSize: 15, marginTop: 6 }}>{t.name}</div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4, minHeight: 40 }}>{t.summary || t.description}</p>
            <button
              className="btn btn-sm"
              style={{ marginTop: 8 }}
              onClick={async () => {
                try {
                  const created = await api.createAgentFromTemplate(t.id);
                  onCreated(created);
                } catch (e) {
                  console.error("createAgentFromTemplate failed", e);
                }
              }}
            >
              Use template <I.arrow size={11}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

