import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { I, type IconKey } from "../icons";
import { Topbar } from "../Shell";
import { useApiData } from "../useApiData";
import { api } from "@/lib/api";

const SAMPLE_PROMPTS: Array<{ id: string; label: string; icon: IconKey; desc: string; prompt: string }> = [
  { id: "crm", label: "Lightweight CRM", icon: "users", desc: "Track companies, contacts, deals", prompt: "Build a lightweight CRM app for account managers to track companies, contacts, opportunities, and renewal risk." },
  { id: "triage", label: "Support triage", icon: "inbox", desc: "Webhook agent for incidents", prompt: "Create a webhook agent to triage customer incidents, open blockers for critical risks, and post a summary to Slack." },
  { id: "leads", label: "Lead enrichment", icon: "sparkle", desc: "Daily research + summary", prompt: "Build an agent that reviews new leads daily, researches each company website, and writes a sales-ready summary." },
  { id: "report", label: "Scheduled report", icon: "history", desc: "Daily ops digest", prompt: "Build an agent that monitors support tickets daily, summarizes urgent escalations, and reports outcomes to operators." },
  { id: "portal", label: "Customer portal", icon: "globe", desc: "Self-serve requests + docs", prompt: "Build a customer portal where customers can manage profile details, open requests, and upload documents." },
  { id: "tracker", label: "Task tracker", icon: "flow", desc: "Projects · tasks · review queue", prompt: "Create a task tracker app with projects, tasks, assignees, statuses, due dates, and a simple review queue." },
];

export function LandingView() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"app" | "agent">("app");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agents = useApiData(() => api.listAgents(), []);
  const recentAgents = (agents.data ?? []).slice(0, 4);

  const submit = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      if (mode === "agent") {
        await api.generateAgentFromPrompt({ prompt });
        navigate("/agents");
      } else {
        await api.generateAppBuilderDraft({ prompt });
        navigate("/builder");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Topbar
        crumbs={["__WS__", "New build"]}
        actions={<button className="top-btn" onClick={() => navigate("/runs")}><I.history size={13}/> History</button>}
      />

      <div style={{ padding: "44px 32px 60px", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 className="h1" style={{ fontSize: 42, fontWeight: 400, marginBottom: 8 }}>
            What do you want to <span className="serif" style={{ color: "var(--green)", fontWeight: 400 }}>weave</span> today?
          </h1>
          <p className="muted" style={{ maxWidth: 560, margin: "0 auto", fontSize: 14.5 }}>
            Describe an agent or an internal app. Taskloom plans, generates, previews,
            and publishes it to your self-hosted workspace.
          </p>
        </div>

        <div className="card" style={{ padding: 4, position: "relative", boxShadow: "0 0 0 1px var(--line), 0 30px 80px -40px rgba(184,242,92,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px 0", gap: 4 }}>
            {([
              { id: "app", label: "Build an app", icon: "layout" as IconKey, desc: "Pages · data · routes" },
              { id: "agent", label: "Build an agent", icon: "bot" as IconKey, desc: "Tools · schedule · webhook" },
            ] as const).map(m => {
              const Ico = I[m.icon];
              const active = mode === m.id;
              return (
                <button key={m.id} onClick={() => setMode(m.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px",
                    background: active ? "var(--bg-elev)" : "transparent",
                    border: `1px solid ${active ? "var(--line-2)" : "transparent"}`,
                    borderBottom: "none",
                    borderRadius: "8px 8px 0 0",
                    color: active ? "var(--silver-50)" : "var(--silver-400)",
                    fontSize: 13, fontWeight: 500,
                  }}>
                  <Ico size={14} />
                  {m.label}
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--silver-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{m.desc}</span>
                </button>
              );
            })}
          </div>

          <div style={{ padding: "14px 18px 16px", borderTop: "1px solid var(--line)" }}>
            <textarea
              className="field"
              placeholder={mode === "app"
                ? "e.g. A lightweight CRM for account managers to track companies, contacts, and renewal risk…"
                : "e.g. A webhook agent that triages incident reports, opens blockers, and posts a summary…"}
              style={{ background: "transparent", border: "none", padding: 0, fontSize: 16, minHeight: 80, color: "var(--silver-50)" }}
              value={prompt} onChange={e => setPrompt(e.target.value)}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <button className="btn btn-sm"><I.doc size={12}/> Use brief</button>
              <button className="btn btn-sm"><I.shield size={12}/> Plan mode</button>
              <div style={{ flex: 1 }}></div>
              <span className="mono" style={{ fontSize: 11, color: "var(--silver-500)" }}>{prompt.length} chars</span>
              <button className="btn-primary btn" disabled={!prompt.trim() || generating} onClick={() => { void submit(); }}>
                {generating ? <><span className="spin"><I.refresh size={13}/></span> Generating</> : <><I.arrowUp size={13}/> Build</>}
              </button>
            </div>
            {error && <div className="mono" style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>{error}</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
          {SAMPLE_PROMPTS.map(s => {
            const Ico = I[s.icon] || I.sparkle;
            return (
              <button key={s.id} onClick={() => setPrompt(s.prompt)}
                style={{
                  textAlign: "left", padding: "12px 14px",
                  background: "var(--panel)", border: "1px solid var(--line)",
                  borderRadius: 10, color: "var(--silver-100)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "var(--bg-elev)", border: "1px solid var(--line)",
                  display: "grid", placeItems: "center", color: "var(--green)", flexShrink: 0,
                }}>
                  <Ico size={14}/>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{s.desc}</div>
                </div>
                <I.arrow size={13} style={{ marginLeft: "auto", color: "var(--silver-500)", flexShrink: 0 }}/>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div className="kicker">RECENT BUILDS</div>
              <h2 className="h2" style={{ marginTop: 2, fontSize: 18 }}>Continue a recent build</h2>
            </div>
            <button className="btn btn-sm" onClick={() => navigate("/dashboard")}><I.history size={12}/> Full history</button>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {agents.loading && <div style={{ padding: 16 }} className="muted">Loading…</div>}
            {!agents.loading && recentAgents.length === 0 && (
              <div style={{ padding: 16 }} className="muted">No agents yet — start one above.</div>
            )}
            {recentAgents.map((p, i) => (
              <div key={p.id} onClick={() => navigate("/agents")}
                style={{
                  display: "grid", gridTemplateColumns: "26px 1fr auto auto",
                  alignItems: "center", gap: 12,
                  padding: "11px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  cursor: "pointer",
                }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: "var(--bg-elev)", border: "1px solid var(--line)",
                  display: "grid", placeItems: "center",
                  color: "var(--green)",
                }}>
                  <I.bot size={13}/>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--silver-500)" }}>
                    {p.model ?? p.provider?.defaultModel ?? "—"} {p.schedule ? `· ${p.schedule}` : p.triggerKind ? `· ${p.triggerKind}` : ""}
                  </div>
                </div>
                <span className={`pill ${p.status === "active" ? "good" : p.status === "paused" ? "warn" : "muted"}`}>
                  <span className="dot"></span>{p.status}
                </span>
                <span className="mono muted" style={{ fontSize: 11 }}>{new Date(p.updatedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
