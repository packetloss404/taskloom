import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { I } from "../icons";
import { Topbar } from "../Shell";
import { api } from "@/lib/api";
import type { AgentRunRecord } from "@/lib/types";
import { triggerLabel, formatDuration } from "@/lib/agent-runtime";
import { RunTranscript, ToolCallTimeline } from "./agent-editor";

export function RunDeepView() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState<AgentRunRecord | null>(null);
  const [agentName, setAgentName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setRun(null);
    void (async () => {
      try {
        // Find the agent that owns this run by listing all runs.
        const allRuns = await api.listAgentRuns();
        const match = allRuns.find((r) => r.id === id);
        if (!match) {
          if (mounted) setError("Run not found.");
          return;
        }
        if (match.agentId) {
          const agentDetail = await api.getAgent(match.agentId);
          if (!mounted) return;
          const full = agentDetail.runs.find((r) => r.id === id) ?? match;
          setRun(full);
          setAgentName(agentDetail.agent.name);
        } else if (mounted) {
          setRun(match);
        }
      } catch (e) {
        if (mounted) setError((e as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <>
        <Topbar crumbs={["__WS__", "Runs", id]}/>
        <div className="muted" style={{ padding: 26 }}>Loading run…</div>
      </>
    );
  }
  if (error || !run) {
    return (
      <>
        <Topbar crumbs={["__WS__", "Runs", id]}/>
        <div style={{ padding: "26px 28px" }}>
          <button className="btn btn-sm" onClick={() => navigate("/runs")}><I.arrow size={11} style={{ transform: "scaleX(-1)" }}/> All runs</button>
          <div className="card" style={{ padding: 22, marginTop: 18, color: "var(--danger)" }}>{error ?? "Run not found."}</div>
        </div>
      </>
    );
  }

  const status = run.status;

  return (
    <>
      <Topbar
        crumbs={["__WS__", "Runs", agentName || run.title]}
        actions={
          <>
            {run.canCancel && (
              <button className="top-btn" onClick={async () => { try { const next = await api.cancelAgentRun(run.id); setRun(next); } catch (e) { setError((e as Error).message); } }}>
                <I.pause size={13}/> Cancel
              </button>
            )}
            {run.canRetry && (
              <button className="top-btn" onClick={async () => { try { const next = await api.retryAgentRun(run.id); setRun(next); } catch (e) { setError((e as Error).message); } }}>
                <I.refresh size={13}/> Retry
              </button>
            )}
            <button className="top-btn" onClick={async () => { try { const d = await api.diagnoseAgentRun(run.id); setDiagnostic(d?.summary ?? "No diagnostic available."); } catch (e) { setError((e as Error).message); } }}>
              <I.sparkle size={13}/> Diagnose
            </button>
          </>
        }
      />
      <div style={{ padding: "26px 28px 60px", maxWidth: 1200 }}>
        <div className="kicker">RUN · {run.id}</div>
        <h1 className="h1" style={{ fontSize: 28, marginTop: 4, marginBottom: 6 }}>{run.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <span className={`pill ${status === "success" ? "good" : status === "failed" ? "danger" : status === "running" ? "warn" : "muted"}`}>
            <span className="dot"></span>{status}
          </span>
          {agentName && <span className="mono muted" style={{ fontSize: 11.5 }}>agent: {agentName}</span>}
          <span className="mono muted" style={{ fontSize: 11.5 }}>{triggerLabel(run.triggerKind)}</span>
          {run.modelUsed && <span className="mono muted" style={{ fontSize: 11.5 }}>{run.modelUsed}</span>}
          {typeof run.costUsd === "number" && <span className="mono muted" style={{ fontSize: 11.5 }}>${run.costUsd.toFixed(4)}</span>}
          {run.durationMs && <span className="mono muted" style={{ fontSize: 11.5 }}>{formatDuration(run.durationMs)}</span>}
        </div>

        {error && (
          <div className="card" style={{ padding: "10px 14px", marginBottom: 14, borderColor: "rgba(242,107,92,0.3)", background: "rgba(242,107,92,0.06)", color: "var(--danger)" }}>
            <span className="mono" style={{ fontSize: 11.5 }}>ERR · {error}</span>
          </div>
        )}

        {run.error && (
          <div className="card" style={{ padding: "10px 14px", marginBottom: 14, borderColor: "rgba(242,107,92,0.3)", background: "rgba(242,107,92,0.06)" }}>
            <div className="kicker" style={{ marginBottom: 4, color: "var(--danger)" }}>ERROR</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--silver-100)", whiteSpace: "pre-wrap" }}>{run.error}</div>
          </div>
        )}

        {diagnostic && (
          <div className="card" style={{ padding: "12px 14px", marginBottom: 14, borderColor: "rgba(184,242,92,0.3)" }}>
            <div className="kicker" style={{ marginBottom: 4, color: "var(--green)" }}>DIAGNOSTIC</div>
            <div style={{ fontSize: 12.5, color: "var(--silver-200)", lineHeight: 1.6 }}>{diagnostic}</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {run.transcript && run.transcript.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>TRANSCRIPT · {run.transcript.length} STEP{run.transcript.length === 1 ? "" : "S"}</div>
                <RunTranscript steps={run.transcript}/>
              </div>
            )}
            {run.toolCalls && run.toolCalls.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>TOOL CALLS · {run.toolCalls.length}</div>
                <ToolCallTimeline calls={run.toolCalls}/>
              </div>
            )}
            {run.output && (
              <div className="card" style={{ padding: 18 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>OUTPUT</div>
                <pre className="mono" style={{ margin: 0, padding: 12, background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 11.5, lineHeight: 1.6, color: "var(--silver-200)", whiteSpace: "pre-wrap", overflow: "auto" }}>{run.output}</pre>
              </div>
            )}
            {run.logs && run.logs.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>LOGS · {run.logs.length}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {run.logs.map((entry, i) => (
                    <div key={i} className="mono" style={{ fontSize: 11.5, display: "flex", gap: 10 }}>
                      <span style={{ color: entry.level === "error" ? "var(--danger)" : entry.level === "warn" ? "var(--warn)" : "var(--silver-500)", width: 50 }}>{entry.level.toUpperCase()}</span>
                      <span style={{ color: entry.level === "error" ? "var(--silver-100)" : "var(--silver-300)", flex: 1 }}>{entry.message}</span>
                      <span className="muted" style={{ fontSize: 10.5 }}>{new Date(entry.at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card" style={{ padding: 18 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>METADATA</div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px 10px", fontSize: 12 }}>
                <div className="muted">Run ID</div><div className="mono" style={{ wordBreak: "break-all" }}>{run.id}</div>
                <div className="muted">Created</div><div className="mono">{new Date(run.createdAt).toLocaleString()}</div>
                {run.startedAt && <><div className="muted">Started</div><div className="mono">{new Date(run.startedAt).toLocaleString()}</div></>}
                {run.completedAt && <><div className="muted">Completed</div><div className="mono">{new Date(run.completedAt).toLocaleString()}</div></>}
                {run.modelUsed && <><div className="muted">Model</div><div className="mono">{run.modelUsed}</div></>}
                {typeof run.costUsd === "number" && <><div className="muted">Cost</div><div className="mono">${run.costUsd.toFixed(4)}</div></>}
              </div>
            </div>

            {run.inputs && Object.keys(run.inputs).length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>INPUTS</div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 10px", fontSize: 11.5 }}>
                  {Object.entries(run.inputs).map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <span className="mono muted">{k}</span>
                      <span className="mono" style={{ color: "var(--silver-200)", wordBreak: "break-word" }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
