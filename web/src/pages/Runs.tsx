import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import RunTelemetry from "@/components/RunTelemetry";
import RunTranscript from "@/components/RunTranscript";
import { triggerLabel } from "@/lib/agent-runtime";
import type { ActivityRecord, AgentRecord, AgentRunLogEntry, AgentRunRecord, AgentRunStatus } from "@/lib/types";

function statusPillClass(status: AgentRunStatus) {
  if (status === "success") return "pill pill--good";
  if (status === "failed") return "pill pill--danger";
  if (status === "running" || status === "queued") return "pill pill--warn";
  return "pill pill--muted";
}

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AgentRunStatus>("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRuns, nextActivities, nextAgents] = await Promise.all([
        api.listAgentRuns(),
        api.listActivity(),
        api.listAgents(),
      ]);
      setRuns(nextRuns);
      setActivities(nextActivities);
      setAgents(nextAgents);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const filteredRuns = useMemo(
    () => (statusFilter === "all" ? runs : runs.filter((run) => run.status === statusFilter)),
    [runs, statusFilter],
  );

  const stats = useMemo(() => computeRunStats(runs), [runs]);
  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId) ?? null, [runs, selectedRunId]);

  const cancel = async (run: AgentRunRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    if (pending) return;
    setPending(run.id);
    setError(null);
    try { await api.cancelAgentRun(run.id); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  };

  const retry = async (run: AgentRunRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    if (pending) return;
    setPending(run.id);
    setError(null);
    try { await api.retryAgentRun(run.id); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  };

  const successTone = stats.total === 0 ? "muted" : stats.successRate >= 90 ? "good" : stats.successRate >= 60 ? "warn" : "danger";
  const filters: { key: "all" | AgentRunStatus; label: string; count: number }[] = [
    { key: "all", label: "All", count: runs.length },
    { key: "success", label: "Success", count: stats.success },
    { key: "failed", label: "Failed", count: stats.failed },
    { key: "running", label: "Running", count: runs.filter((r) => r.status === "running").length },
    { key: "queued", label: "Queued", count: runs.filter((r) => r.status === "queued").length },
    { key: "canceled", label: "Canceled", count: runs.filter((r) => r.status === "canceled").length },
  ];

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <div className="kicker mb-3">RUNS · EXECUTION HISTORY</div>
          <h1 className="display-xl">Runs.</h1>
          <p className="mt-4 max-w-xl font-mono text-xs text-ink-400">
            <span className="text-ink-200">{stats.total}</span> total ·{" "}
            <span className="text-signal-amber">{stats.last24h}</span> in last 24h ·{" "}
            <span className="text-ink-500">structured inputs, output, logs, retry/cancel.</span>
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-6 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          ERR · {error}
        </div>
      )}

      <section className="grid grid-cols-2 divide-x divide-ink-700 border-y border-ink-700 lg:grid-cols-4">
        <StatCell label="TOTAL RUNS" value={stats.total} sublabel={`${stats.last24h} in last 24h`} />
        <StatCell
          label="SUCCESS RATE"
          value={stats.total === 0 ? "—" : `${stats.successRate}%`}
          sublabel={`${stats.success} ok · ${stats.failed} fail`}
          tone={successTone}
        />
        <StatCell
          label="AVG DURATION"
          value={stats.avgDurationMs == null ? "—" : formatDuration(stats.avgDurationMs)}
          sublabel={stats.avgDurationMs == null ? "no completed runs" : `${stats.completed} completed`}
        />
        <StatCell
          label="IN FLIGHT"
          value={stats.inFlight}
          sublabel={stats.inFlight === 0 ? "idle" : "running or queued"}
          tone={stats.inFlight > 0 ? "warn" : "muted"}
        />
      </section>

      <div className="tab-strip mt-8">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`tab-strip__item ${statusFilter === f.key ? "tab-strip__item--active" : ""}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label} <span className="ml-1 text-ink-500">[{f.count}]</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING RUNS</span>
        </div>
      ) : (
        <>
          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">TELEMETRY</div>
                <h2 className="display text-2xl">7-day stack</h2>
              </div>
              <span className="section-marker">§ 01 / 03</span>
            </div>
            <div className="bg-grid border border-ink-700 p-4">
              <RunTelemetry runs={runs} agents={agents} />
            </div>
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">AGENT RUNS · {filteredRuns.length} SHOWN</div>
                <h2 className="display text-2xl">Run log</h2>
              </div>
              <span className="section-marker">§ 02 / 03</span>
            </div>

            {filteredRuns.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-6 py-10 text-center">
                <p className="font-serif text-xl text-ink-200">
                  {runs.length === 0 ? "No agent runs recorded." : "No runs match this filter."}
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Title</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th className="num">Duration</th>
                    <th className="num">Steps</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.flatMap((run) => {
                    const expanded = expandedRun === run.id;
                    const stepCount = run.transcript?.length ?? 0;
                    const canCancel = run.canCancel ?? (run.status === "running" || run.status === "queued");
                    const canRetry = run.canRetry ?? (run.status === "failed" || run.status === "canceled");
                    const rows: ReactNode[] = [
                      <tr key={run.id} className="cursor-pointer">
                        <td className="font-mono text-[11px] text-ink-400" onClick={() => setSelectedRunId(run.id)}>
                          {relative(run.createdAt)}
                        </td>
                        <td onClick={() => setSelectedRunId(run.id)}>
                          <div className="font-serif text-sm text-ink-100">{run.title}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-ink-500">{run.id}</div>
                          {run.error && <div className="mt-1 font-mono text-[10px] text-signal-red">ERR · {run.error}</div>}
                        </td>
                        <td><span className="pill">{triggerLabel(run.triggerKind)}</span></td>
                        <td><span className={statusPillClass(run.status)}>{run.status}</span></td>
                        <td className="num">{durationLabel(run) ?? "—"}</td>
                        <td className="num">{stepCount}</td>
                        <td className="font-mono text-[11px] text-ink-400 whitespace-nowrap">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedRun(expanded ? null : run.id); }} className="hover:text-signal-amber">
                            {expanded ? "[ − ]" : "[ + ]"}
                          </button>
                          {canCancel && (
                            <button type="button" onClick={(e) => cancel(run, e)} disabled={pending === run.id} className="ml-3 hover:text-signal-red disabled:opacity-50">
                              CANCEL
                            </button>
                          )}
                          {canRetry && (
                            <button type="button" onClick={(e) => retry(run, e)} disabled={pending === run.id} className="ml-3 hover:text-signal-green disabled:opacity-50">
                              RETRY
                            </button>
                          )}
                        </td>
                      </tr>,
                    ];
                    if (expanded) {
                      rows.push(
                        <tr key={`${run.id}-detail`}>
                          <td colSpan={7} className="bg-ink-950/40 p-4">
                            <RunTranscript steps={run.transcript} />
                            {run.output && (
                              <>
                                <div className="kicker mb-1.5 mt-4">OUTPUT</div>
                                <pre className="border border-ink-700 bg-ink-950 p-3 font-mono text-xs leading-5 text-ink-200 whitespace-pre-wrap overflow-x-auto">{run.output}</pre>
                              </>
                            )}
                            {run.logs && run.logs.length > 0 && (
                              <>
                                <div className="kicker mb-1.5 mt-4">LOG TIMELINE</div>
                                <RunLogTimeline logs={run.logs} />
                              </>
                            )}
                          </td>
                        </tr>,
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">WORKSPACE ACTIVITY</div>
                <h2 className="display text-2xl">Audit trail</h2>
              </div>
              <span className="section-marker">§ 03 / 03</span>
            </div>
            {activities.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-6 py-8 text-center">
                <p className="font-mono text-xs text-ink-500">— NO ACTIVITY RECORDED —</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Scope</th>
                    <th>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id}>
                      <td className="font-mono text-[11px] text-ink-400">{relative(a.occurredAt)}</td>
                      <td className="font-mono text-[11px] text-ink-300">{a.scope}</td>
                      <td className="text-sm text-ink-200">{String(a.data.title || a.event)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {selectedRun && <RunDetailDrawer run={selectedRun} onClose={() => setSelectedRunId(null)} />}
    </div>
  );
}

interface RunStats {
  total: number; success: number; failed: number; successRate: number;
  inFlight: number; completed: number; avgDurationMs: number | null; last24h: number;
}

function computeRunStats(runs: AgentRunRecord[]): RunStats {
  const success = runs.filter((r) => r.status === "success").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const inFlight = runs.filter((r) => r.status === "running" || r.status === "queued").length;
  const finished = runs.filter((r) => r.status === "success" || r.status === "failed");
  const durations = finished.map(durationMs).filter((v): v is number => v != null);
  const avgDurationMs = durations.length === 0 ? null : Math.round(durations.reduce((s, v) => s + v, 0) / durations.length);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = runs.filter((r) => new Date(r.createdAt).getTime() >= since).length;
  const successRate = success + failed === 0 ? 0 : Math.round((success / (success + failed)) * 100);
  return { total: runs.length, success, failed, successRate, inFlight, completed: finished.length, avgDurationMs, last24h };
}

function durationMs(run: AgentRunRecord): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  const s = new Date(run.startedAt).getTime();
  const e = new Date(run.completedAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return Math.max(0, e - s);
}

function durationLabel(run: AgentRunRecord) {
  const ms = durationMs(run);
  return ms == null ? null : formatDuration(ms);
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return `${m}m ${rest}s`;
}

function StatCell({ label, value, sublabel, tone = "muted" }: { label: string; value: number | string; sublabel: string; tone?: "good" | "warn" | "danger" | "muted" }) {
  const valueColor = tone === "good" ? "text-signal-green" : tone === "warn" ? "text-signal-amber" : tone === "danger" ? "text-signal-red" : "text-ink-100";
  return (
    <div className="px-5 py-5">
      <div className="kicker">{label}</div>
      <div className={`mt-2 font-mono text-3xl tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-500">{sublabel}</div>
    </div>
  );
}

function RunDetailDrawer({ run, onClose }: { run: AgentRunRecord; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const queuedToStart = run.startedAt ? new Date(run.startedAt).getTime() - new Date(run.createdAt).getTime() : null;
  const execution = durationMs(run);
  const total = run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime() : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-ink-700 bg-ink-900">
        <header className="flex items-start justify-between gap-3 border-b border-ink-700 px-6 py-5">
          <div className="min-w-0">
            <div className="kicker mb-2">RUN DETAIL</div>
            <h2 className="display text-2xl">{run.title}</h2>
            <div className="mt-2 font-mono text-[11px] text-ink-500">
              {run.id} · {relative(run.createdAt)}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="font-mono text-xs text-ink-400 hover:text-signal-amber">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className={statusPillClass(run.status)}>{run.status}</span>
            {run.triggerKind && <span className="pill">{triggerLabel(run.triggerKind)}</span>}
            {run.agentId && (
              <span className="font-mono text-[10px] text-ink-500">
                AGENT <span className="text-ink-300">{run.agentId.slice(0, 8)}</span>
              </span>
            )}
          </div>

          <DetailGroup title="TIMING">
            <DetailRow label="Created" value={absolute(run.createdAt)} />
            <DetailRow label="Started" value={absolute(run.startedAt)} />
            <DetailRow label="Completed" value={absolute(run.completedAt)} />
            <DetailRow label="Queue wait" value={queuedToStart == null ? "—" : formatDuration(Math.max(0, queuedToStart))} />
            <DetailRow label="Execution" value={execution == null ? "—" : formatDuration(execution)} />
            <DetailRow label="Total" value={total == null ? "—" : formatDuration(Math.max(0, total))} />
          </DetailGroup>

          {run.transcript && run.transcript.length > 0 && (
            <DetailGroup title="TRANSCRIPT">
              <RunTranscript steps={run.transcript} />
            </DetailGroup>
          )}

          {run.error && (
            <DetailGroup title="ERROR" tone="danger">
              <pre className="border border-signal-red/40 bg-ink-950 p-3 font-mono text-xs text-signal-red whitespace-pre-wrap overflow-x-auto">{run.error}</pre>
            </DetailGroup>
          )}

          {run.output && (
            <DetailGroup title="OUTPUT">
              <pre className="border border-ink-700 bg-ink-950 p-3 font-mono text-xs leading-5 text-ink-200 whitespace-pre-wrap overflow-x-auto">{run.output}</pre>
            </DetailGroup>
          )}

          {(run.status === "running" || run.status === "queued") && (
            <div className="border border-signal-amber/40 px-3 py-2 font-mono text-xs text-signal-amber">
              {run.status === "queued" ? "WAITING IN QUEUE…" : "RUN IN PROGRESS…"}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function DetailGroup({ title, children, tone = "default" }: { title: string; children: ReactNode; tone?: "default" | "danger" }) {
  return (
    <section className="mb-6">
      <div className={`kicker mb-2 ${tone === "danger" ? "text-signal-red" : ""}`}>{title}</div>
      <div>{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink-800 py-1.5 leader last:border-b-0">
      <span className="bg-ink-900 pr-2 font-mono text-[11px] text-ink-500">{label}</span>
      <span className="bg-ink-900 pl-2 font-mono text-[11px] text-ink-200">{value}</span>
    </div>
  );
}

function absolute(iso: string | undefined | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function RunLogTimeline({ logs }: { logs: AgentRunLogEntry[] }) {
  return (
    <ol className="border-l border-ink-700 pl-3">
      {logs.map((entry, index) => (
        <li key={index} className="font-mono text-xs">
          <span className={logLevelClass(entry.level)}>{entry.level.toUpperCase()}</span>
          <span className="ml-2 text-ink-300">{entry.message}</span>
        </li>
      ))}
    </ol>
  );
}

function logLevelClass(level: AgentRunLogEntry["level"]) {
  if (level === "error") return "text-signal-red font-semibold";
  if (level === "warn") return "text-signal-amber font-semibold";
  return "text-ink-500 font-semibold";
}
