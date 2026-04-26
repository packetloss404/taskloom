import { useMemo } from "react";
import type { AgentRecord, AgentRunRecord, AgentRunStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RunTelemetryProps {
  runs: AgentRunRecord[];
  agents?: AgentRecord[];
  windowDays?: number;
}

interface DayBucket {
  iso: string;
  label: string;
  total: number;
  success: number;
  failed: number;
}

const STATUS_TONE: Record<AgentRunStatus, string> = {
  queued: "bg-ink-700",
  running: "bg-amber-400",
  success: "bg-emerald-400",
  failed: "bg-rose-400",
  canceled: "bg-ink-500",
};

export default function RunTelemetry({ runs, agents = [], windowDays = 7 }: RunTelemetryProps) {
  const stats = useMemo(() => computeStats(runs), [runs]);
  const days = useMemo(() => bucketByDay(runs, windowDays), [runs, windowDays]);
  const perAgent = useMemo(() => groupByAgent(runs, agents), [runs, agents]);
  const peakDay = useMemo(() => days.reduce((max, day) => Math.max(max, day.total), 0), [days]);

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Run telemetry</h2>
          <p className="mt-1 text-xs text-ink-500">
            Aggregated agent run history. Last {windowDays} days timeline plus rolling success rate.
          </p>
        </div>
        <SuccessGauge value={stats.successRate} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total runs" value={String(stats.total)} />
        <Stat label="Successes" value={String(stats.success)} tone="good" />
        <Stat label="Failures" value={String(stats.failed)} tone={stats.failed > 0 ? "danger" : "muted"} />
        <Stat label="Avg duration" value={stats.avgDurationLabel} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-500">
          <span>Last {windowDays} days</span>
          <span>{stats.windowTotal} runs</span>
        </div>
        <div className="grid grid-cols-7 gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => {
            const total = day.total;
            const heightPercent = peakDay === 0 ? 0 : (total / peakDay) * 100;
            const successPercent = total === 0 ? 0 : (day.success / total) * 100;
            return (
              <div key={day.iso} className="flex flex-col items-center gap-1.5">
                <div className="flex h-24 w-full flex-col-reverse overflow-hidden rounded-md border border-ink-800 bg-ink-950/40">
                  <div
                    className="bg-ink-700 transition-all"
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div
                      className="h-full bg-emerald-500/60"
                      style={{ width: `${successPercent}%` }}
                      title={`${day.success}/${day.total} succeeded`}
                    />
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-ink-500">{day.label}</span>
                <span className="text-[10px] text-ink-400">{day.total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {perAgent.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">By agent</h3>
          <div className="space-y-2">
            {perAgent.map((entry) => (
              <div key={entry.agentId} className="rounded-xl border border-ink-800 bg-ink-950/35 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-ink-100">{entry.name}</span>
                  <span className="text-xs text-ink-400">
                    {entry.success}/{entry.total} ok
                  </span>
                </div>
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink-800">
                  {(["success", "failed", "running", "queued", "canceled"] as AgentRunStatus[]).map((status) => {
                    const count = entry.byStatus[status] ?? 0;
                    if (count === 0 || entry.total === 0) return null;
                    const percent = (count / entry.total) * 100;
                    return (
                      <div
                        key={status}
                        className={cn("h-full", STATUS_TONE[status])}
                        style={{ width: `${percent}%` }}
                        title={`${status}: ${count}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

interface AggregateStats {
  total: number;
  success: number;
  failed: number;
  running: number;
  successRate: number;
  windowTotal: number;
  avgDurationLabel: string;
}

function computeStats(runs: AgentRunRecord[]): AggregateStats {
  const total = runs.length;
  let success = 0;
  let failed = 0;
  let running = 0;
  let durationTotal = 0;
  let durationCount = 0;
  const cutoff = Date.now() - 7 * 24 * 3600_000;
  let windowTotal = 0;

  for (const run of runs) {
    if (run.status === "success") success += 1;
    if (run.status === "failed") failed += 1;
    if (run.status === "running" || run.status === "queued") running += 1;
    if (run.startedAt && run.completedAt) {
      const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
      if (ms >= 0 && Number.isFinite(ms)) {
        durationTotal += ms;
        durationCount += 1;
      }
    }
    if (run.createdAt && new Date(run.createdAt).getTime() >= cutoff) {
      windowTotal += 1;
    }
  }

  const completed = success + failed;
  const successRate = completed === 0 ? 0 : Math.round((success / completed) * 100);
  const avgDurationLabel = durationCount === 0 ? "—" : formatDuration(durationTotal / durationCount);

  return { total, success, failed, running, successRate, windowTotal, avgDurationLabel };
}

function bucketByDay(runs: AgentRunRecord[], windowDays: number): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const today = startOfDay(new Date());
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - offset * 24 * 3600_000);
    const iso = day.toISOString().slice(0, 10);
    buckets.set(iso, {
      iso,
      label: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
      total: 0,
      success: 0,
      failed: 0,
    });
  }

  for (const run of runs) {
    if (!run.createdAt) continue;
    const iso = new Date(run.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(iso);
    if (!bucket) continue;
    bucket.total += 1;
    if (run.status === "success") bucket.success += 1;
    if (run.status === "failed") bucket.failed += 1;
  }

  return Array.from(buckets.values());
}

interface AgentBreakdown {
  agentId: string;
  name: string;
  total: number;
  success: number;
  byStatus: Partial<Record<AgentRunStatus, number>>;
}

function groupByAgent(runs: AgentRunRecord[], agents: AgentRecord[]): AgentBreakdown[] {
  const agentNames = new Map<string, string>();
  for (const agent of agents) agentNames.set(agent.id, agent.name);

  const byAgent = new Map<string, AgentBreakdown>();
  for (const run of runs) {
    const agentId = run.agentId ?? "unattached";
    const entry = byAgent.get(agentId) ?? {
      agentId,
      name: agentId === "unattached" ? "Unattached runs" : agentNames.get(agentId) ?? "Removed agent",
      total: 0,
      success: 0,
      byStatus: {},
    };
    entry.total += 1;
    if (run.status === "success") entry.success += 1;
    entry.byStatus[run.status] = (entry.byStatus[run.status] ?? 0) + 1;
    byAgent.set(agentId, entry);
  }

  return Array.from(byAgent.values()).sort((a, b) => b.total - a.total).slice(0, 6);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "danger" | "muted" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "danger" ? "text-rose-300" : "text-ink-100";
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/35 p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold", color)}>{value}</div>
    </div>
  );
}

function SuccessGauge({ value }: { value: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const tone = value >= 90 ? "stroke-emerald-400" : value >= 60 ? "stroke-amber-400" : "stroke-rose-400";
  return (
    <div className="flex items-center gap-2">
      <svg width={56} height={56} viewBox="0 0 56 56">
        <circle cx={28} cy={28} r={radius} strokeWidth={5} className="fill-none stroke-ink-800" />
        <circle
          cx={28}
          cy={28}
          r={radius}
          strokeWidth={5}
          strokeLinecap="round"
          className={cn("fill-none transition-all", tone)}
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 28 28)"
        />
        <text x={28} y={32} textAnchor="middle" className="fill-ink-100 text-[12px] font-semibold">
          {value}%
        </text>
      </svg>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-ink-500">Success</div>
        <div className="text-xs text-ink-300">on completed runs</div>
      </div>
    </div>
  );
}
