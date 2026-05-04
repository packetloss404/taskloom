import { useState } from "react";
import { I, type IconKey } from "../icons";

const SAMPLE_PROMPTS = [
  { id: "crm", label: "Lightweight CRM", icon: "users" as IconKey, desc: "Track companies, contacts, deals", prompt: "Build a lightweight CRM app for account managers to track companies, contacts, opportunities, and renewal risk." },
  { id: "triage", label: "Support triage", icon: "inbox" as IconKey, desc: "Webhook agent for incidents", prompt: "Create a webhook agent to triage customer incidents, open blockers for critical risks, and post a summary to Slack." },
  { id: "leads", label: "Lead enrichment", icon: "sparkle" as IconKey, desc: "Daily research + summary", prompt: "Build an agent that reviews new leads daily, researches each company website, and writes a sales-ready summary." },
  { id: "report", label: "Scheduled report", icon: "history" as IconKey, desc: "Daily ops digest", prompt: "Build an agent that monitors support tickets daily, summarizes urgent escalations, and reports outcomes to operators." },
  { id: "portal", label: "Customer portal", icon: "globe" as IconKey, desc: "Self-serve requests + docs", prompt: "Build a customer portal where customers can manage profile details, open requests, and upload documents." },
  { id: "tracker", label: "Task tracker", icon: "flow" as IconKey, desc: "Projects · tasks · review queue", prompt: "Create a task tracker app with projects, tasks, assignees, statuses, due dates, and a simple review queue." },
];

export function LoggedOutView({ onSignIn }: { onSignIn: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"app" | "agent">("app");

  return (
    <div style={{ height: "100vh", overflow: "auto", background: "radial-gradient(900px 500px at 50% -10%, rgba(184,242,92,0.06), transparent 60%), var(--bg)" }}>
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header style={{
        height: 64, display: "flex", alignItems: "center",
        padding: "0 32px", borderBottom: "1px solid var(--line)",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark" style={{ width: 30, height: 30 }}></div>
          <div>
            <div className="brand-name" style={{ fontSize: 16 }}>task<span>loom</span></div>
            <div className="brand-tag" style={{ fontSize: 9.5 }}>Agent · App workbench</div>
          </div>
        </div>
        <nav style={{ marginLeft: 40, display: "flex", gap: 22, fontSize: 13 }}>
          <a style={{ color: "var(--silver-300)", textDecoration: "none", cursor: "pointer" }}>Product</a>
          <a style={{ color: "var(--silver-300)", textDecoration: "none", cursor: "pointer" }}>Templates</a>
          <a style={{ color: "var(--silver-300)", textDecoration: "none", cursor: "pointer" }}>Self-host</a>
          <a style={{ color: "var(--silver-300)", textDecoration: "none", cursor: "pointer" }}>Docs</a>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={onSignIn}>Sign in</button>
          <button className="btn btn-primary btn-sm" onClick={onSignIn}>Get started</button>
        </div>
      </header>

      <div style={{ flex: 1, padding: "60px 32px", maxWidth: 940, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div className="kicker" style={{ marginBottom: 14 }}>
            <span style={{ color: "var(--green)" }}>●</span> SELF-HOSTABLE · OPEN AGENT WORKBENCH
          </div>
          <h1 className="h1" style={{ fontSize: 52, fontWeight: 400, marginBottom: 10, letterSpacing: "-0.025em" }}>
            What do you want to <span className="serif" style={{ color: "var(--green)", fontWeight: 400 }}>weave</span> today?
          </h1>
          <p className="muted" style={{ maxWidth: 580, margin: "0 auto", fontSize: 15.5, lineHeight: 1.55 }}>
            Describe an agent or an internal app. Taskloom plans, generates, previews,
            and publishes it to a workspace you own end-to-end.
          </p>
        </div>

        <div className="card" style={{ padding: 4, position: "relative", boxShadow: "0 0 0 1px var(--line), 0 40px 100px -40px rgba(184,242,92,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px 0", gap: 4 }}>
            {([
              { id: "app", label: "Build an app", icon: "layout" as IconKey, desc: "Pages · data · routes" },
              { id: "agent", label: "Build an agent", icon: "bot" as IconKey, desc: "Tools · schedule · webhook" },
            ] as const).map(m => {
              const Ico = I[m.icon];
              const active = mode === m.id;
              return (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                  background: active ? "var(--bg-elev)" : "transparent",
                  border: `1px solid ${active ? "var(--line-2)" : "transparent"}`,
                  borderBottom: "none", borderRadius: "8px 8px 0 0",
                  color: active ? "var(--silver-50)" : "var(--silver-400)",
                  fontSize: 13, fontWeight: 500,
                }}>
                  <Ico size={14}/> {m.label}
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--silver-500)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{m.desc}</span>
                </button>
              );
            })}
            <div style={{ flex: 1 }}></div>
            <span className="pill muted"><I.cpu size={11}/> claude-sonnet-4.5</span>
          </div>
          <div style={{ padding: "16px 18px 18px", borderTop: "1px solid var(--line)" }}>
            <textarea className="field" placeholder={mode === "app"
              ? "e.g. A lightweight CRM for account managers to track companies, contacts, and renewal risk…"
              : "e.g. A webhook agent that triages incident reports, opens blockers, and posts a summary…"}
              style={{ background: "transparent", border: "none", padding: 0, fontSize: 17, minHeight: 90, color: "var(--silver-50)" }}
              value={prompt} onChange={e => setPrompt(e.target.value)}/>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span className="mono muted" style={{ fontSize: 11 }}>Sign in to generate, preview, and publish.</span>
              <div style={{ flex: 1 }}></div>
              <button className="btn-primary btn" onClick={onSignIn}><I.arrowUp size={13}/> Sign in to build</button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
          {SAMPLE_PROMPTS.map(s => {
            const Ico = I[s.icon] || I.sparkle;
            return (
              <button key={s.id} onClick={() => setPrompt(s.prompt)} style={{
                textAlign: "left", padding: "12px 14px",
                background: "var(--panel)", border: "1px solid var(--line)",
                borderRadius: 10, color: "var(--silver-100)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-elev)", border: "1px solid var(--line)", display: "grid", placeItems: "center", color: "var(--green)", flexShrink: 0 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 50 }}>
          {([
            { k: "Plan, then build", b: "Taskloom drafts a plan, surfaces blockers and questions, and only writes code once you approve.", i: "flow" as IconKey },
            { k: "Self-hosted by default", b: "Single binary plus your model keys. Your data, your infra, your audit log.", i: "shield" as IconKey },
            { k: "Real activation signals", b: "Workspaces graduate from onboarding to activated through actual runs and releases — not vanity steps.", i: "rocket" as IconKey },
          ] as const).map(c => {
            const Ico = I[c.i];
            return (
              <div key={c.k} className="card" style={{ padding: 18 }}>
                <Ico size={18} style={{ color: "var(--green)" }}/>
                <div className="h3" style={{ fontSize: 14, marginTop: 10 }}>{c.k}</div>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.55 }}>{c.b}</p>
              </div>
            );
          })}
        </div>
      </div>

      <footer style={{ borderTop: "1px solid var(--line)", padding: "20px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <span className="mono muted" style={{ fontSize: 11 }}>© Taskloom · v0.18.4</span>
        <span className="mono muted" style={{ fontSize: 11, marginLeft: "auto" }}>self-hosted · MIT</span>
      </footer>
    </div>
    </div>
  );
}
