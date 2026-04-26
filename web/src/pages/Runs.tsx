import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, CheckCircle2, Clock, Loader2, Timer, X } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import RunTelemetry from "@/components/RunTelemetry";
import type { ActivityRecord, AgentRecord, AgentRunRecord, AgentRunStatus } from "@/lib/types";

const STATUS_TONE: Record<AgentRunStatus, "good" | "danger" | "warn" | "muted"> = {
  success: "good",
  failed: "danger",
  canceled: "muted",
  running: "warn",
  queued: "muted",
};

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AgentRunStatus>("all");

  useEffect(() => {
    Promise.all([api.listAgentRuns(), api.listActivity(), api.listAgents()])
      .then(([nextRuns, nextActivities, nextAgents]) => {
        setRuns(nextRuns);
        setActivities(nextActivities);
        setAgents(nextAgents);
      })
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filteredRuns = useMemo(
    () => (statusFilter === "all" ? runs : runs.filter((run) => run.status === statusFilter)),
    [runs, statusFilter],
  );

  const stats = useMemo(() => computeRunStats(runs), [runs]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  return (
    <>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Runs / Activity</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
          Execution history and workspace activity from the backend.
        </p>
      </header>

      {error && <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ObservabilityTile
          icon={<Activity className="h-4 w-4" />}
          label="Total runs"
          value={stats.total}
          sublabel={stats.last24h > 0 ? `${stats.last24h} in last 24h` : "No runs in last 24h"}
        />
        <ObservabilityTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Success rate"
          value={stats.total === 0 ? "—" : `${stats.successRate}%`}
          sublabel={`${stats.success} succeeded · ${stats.failed} failed`}
          tone={stats.total === 0 ? "muted" : stats.successRate >= 90 ? "good" : stats.successRate >= 60 ? "warn" : "danger"}
        />
        <ObservabilityTile
          icon={<Timer className="h-4 w-4" />}
          label="Avg duration"
          value={stats.avgDurationMs == null ? "—" : formatDuration(stats.avgDurationMs)}
          sublabel={stats.avgDurationMs == null ? "No completed runs" : `${stats.completed} completed`}
        />
        <ObservabilityTile
          icon={<Clock className="h-4 w-4" />}
          label="In flight"
          value={stats.inFlight}
          sublabel={stats.inFlight === 0 ? "Idle" : "Running or queued"}
          tone={stats.inFlight > 0 ? "warn" : "muted"}
        />
      </section>

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading runs...</div>
      ) : (
        <>
        <div className="mb-6">
          <RunTelemetry runs={runs} agents={agents} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Agent runs</h2>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip label="All" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
                <FilterChip label="Success" active={statusFilter === "success"} onClick={() => setStatusFilter("success")} />
                <FilterChip label="Failed" active={statusFilter === "failed"} onClick={() => setStatusFilter("failed")} />
                <FilterChip label="Running" active={statusFilter === "running"} onClick={() => setStatusFilter("running")} />
              </div>
            </div>
            {filteredRuns.length === 0 ? <Empty text={runs.length === 0 ? "No agent runs recorded." : "No runs match this filter."} /> : (
              <div className="space-y-3">
                {filteredRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={cn(
                      "block w-full rounded-2xl border p-4 text-left transition-colors",
                      selectedRunId === run.id
                        ? "border-ink-600 bg-ink-850/60"
                        : "border-ink-800/80 bg-ink-900/45 hover:border-ink-700 hover:bg-ink-900/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink-100">{run.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                          <span>{relative(run.createdAt)}</span>
                          {durationLabel(run) && (
                            <span className="inline-flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {durationLabel(run)}
                            </span>
                          )}
                        </div>
                        {run.error && <div className="mt-2 truncate text-xs text-rose-300">{run.error}</div>}
                      </div>
                      <StatusPill status={run.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Workspace activity</h2>
            {activities.length === 0 ? <Empty text="No activity recorded." /> : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-850 text-ink-300"><Activity className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink-100">{String(activity.data.title || activity.event)}</div>
                        <div className="mt-1 text-xs text-ink-500">{activity.scope} · {relative(activity.occurredAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        </>
      )}

      {selectedRun && <RunDetailDrawer run={selectedRun} onClose={() => setSelectedRunId(null)} />}
    </>
  );
}

interface RunStats {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  inFlight: number;
  completed: number;
  avgDurationMs: number | null;
  last24h: number;
}

function computeRunStats(runs: AgentRunRecord[]): RunStats {
  const success = runs.filter((run) => run.status === "success").length;
  const failed = runs.filter((run) => run.status === "failed").length;
  const inFlight = runs.filter((run) => run.status === "running" || run.status === "queued").length;
  const finished = runs.filter((run) => run.status === "success" || run.status === "failed");
  const durations = finished
    .map((run) => durationMs(run))
    .filter((value): value is number => value != null);
  const avgDurationMs = durations.length === 0 ? null : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = runs.filter((run) => new Date(run.createdAt).getTime() >= since).length;
  const successRate = success + failed === 0 ? 0 : Math.round((success / (success + failed)) * 100);

  return {
    total: runs.length,
    success,
    failed,
    successRate,
    inFlight,
    completed: finished.length,
    avgDurationMs,
    last24h,
  };
}

function durationMs(run: AgentRunRecord): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

function durationLabel(run: AgentRunRecord) {
  const ms = durationMs(run);
  return ms == null ? null : formatDuration(ms);
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes}m ${rest}s`;
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-ink-500 bg-ink-100 text-ink-950"
          : "border-ink-700 bg-ink-950/40 text-ink-300 hover:border-ink-600 hover:text-ink-100",
      )}
    >
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: AgentRunStatus }) {
  const tone = STATUS_TONE[status];
  const classes = {
    danger: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    muted: "border-ink-700 bg-ink-950/40 text-ink-300",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs capitalize", classes)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone === "warn" && "animate-pulse", {
        "bg-rose-400": tone === "danger",
        "bg-emerald-400": tone === "good",
        "bg-amber-400": tone === "warn",
        "bg-ink-400": tone === "muted",
      })} />
      {status}
    </span>
  );
}

function ObservabilityTile({ icon, label, value, sublabel, tone = "muted" }: { icon: ReactNode; label: string; value: number | string; sublabel: string; tone?: "good" | "warn" | "danger" | "muted" }) {
  const valueColor = {
    good: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-rose-300",
    muted: "text-ink-100",
  }[tone];
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-900/50 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-500">
        {icon}
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", valueColor)}>{value}</div>
      <div className="mt-1 text-xs text-ink-500">{sublabel}</div>
    </div>
  );
}

function RunDetailDrawer({ run, onClose }: { run: AgentRunRecord; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const queuedToStart = run.startedAt ? new Date(run.startedAt).getTime() - new Date(run.createdAt).getTime() : null;
  const execution = durationMs(run);
  const total = run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime() : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-ink-800 bg-ink-900 shadow-card">
        <header className="flex items-start justify-between gap-3 border-b border-ink-800 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Run detail</div>
            <h2 className="mt-1 truncate text-lg font-semibold text-ink-100">{run.title}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
              <span className="font-mono">{run.id.slice(0, 12)}</span>
              <span>·</span>
              <span>{relative(run.createdAt)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-ink-700 text-ink-400 hover:bg-ink-850 hover:text-ink-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5 flex items-center gap-2">
            <StatusPill status={run.status} />
            {run.agentId && <span className="text-xs text-ink-500">Agent <span className="font-mono text-ink-300">{run.agentId.slice(0, 8)}</span></span>}
          </div>

          <DetailGroup title="Timing">
            <DetailRow label="Created" value={absolute(run.createdAt)} />
            <DetailRow label="Started" value={absolute(run.startedAt)} />
            <DetailRow label="Completed" value={absolute(run.completedAt)} />
            <DetailRow label="Queue wait" value={queuedToStart == null ? "—" : formatDuration(Math.max(0, queuedToStart))} />
            <DetailRow label="Execution" value={execution == null ? "—" : formatDuration(execution)} />
            <DetailRow label="Total" value={total == null ? "—" : formatDuration(Math.max(0, total))} />
          </DetailGroup>

          {run.error && (
            <DetailGroup title="Error" tone="danger">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 text-xs leading-5 text-rose-200">{run.error}</pre>
            </DetailGroup>
          )}

          {run.output && (
            <DetailGroup title="Output">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-950/60 p-3 text-xs leading-5 text-ink-200">{run.output}</pre>
            </DetailGroup>
          )}

          {!run.output && !run.error && run.status !== "running" && run.status !== "queued" && (
            <div className="rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-xs text-ink-500">
              No output recorded for this run.
            </div>
          )}

          {(run.status === "running" || run.status === "queued") && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {run.status === "queued" ? "Waiting in queue…" : "Run in progress…"}
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
      <h3 className={cn("mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]", tone === "danger" ? "text-rose-300" : "text-ink-500")}>{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-800/60 py-1.5 text-xs last:border-b-0">
      <span className="text-ink-500">{label}</span>
      <span className="font-mono text-ink-200">{value}</span>
    </div>
  );
}

function absolute(iso: string | undefined | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-ink-700 p-6 text-center text-sm text-ink-500">{text}</div>;
}

