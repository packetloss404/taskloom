import { useMemo, useState } from "react";
import type { AgentRecord, AgentRunRecord, AgentRunStatus } from "@/lib/types";

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
  other: number;
}

const STATUS_BAR_TONE: Record<AgentRunStatus, string> = {
  queued: "bg-ink-500",
  running: "bg-signal-amber",
  success: "bg-signal-green",
  failed: "bg-signal-red",
  canceled: "bg-ink-600",
};

export default function RunTelemetry({ runs, agents = [], windowDays = 7 }: RunTelemetryProps) {
  const stats = useMemo(() => computeStats(runs), [runs]);
  const days = useMemo(() => bucketByDay(runs, windowDays), [runs, windowDays]);
  const perAgent = useMemo(() => groupByAgent(runs, agents), [runs, agents]);
  const peakDay = useMemo(() => days.reduce((max, day) => Math.max(max, day.total), 0), [days]);

  return (
    <div className="border border-ink-700 bg-ink-900/40">
      <div className="flex items-end justify-between gap-4 border-b border-ink-700 px-5 py-3">
        <div>
          <div className="kicker">RUN TELEMETRY · LAST {windowDays} DAYS</div>
          <div className="mt-1 font-mono text-[11px] text-ink-400">
            {stats.windowTotal} runs in window · success rate {stats.successRate}%
          </div>
        </div>
        <div className="flex gap-4 font-mono text-[11px]">
          <LegendDot label="OK" cls="bg-signal-green" />
          <LegendDot label="FAIL" cls="bg-signal-red" />
          <LegendDot label="OTHER" cls="bg-ink-500" />
        </div>
      </div>

      <div className="bg-grid px-5 pt-4 pb-2">
        <div
          className="grid items-end gap-2"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, height: "180px" }}
        >
          {days.map((day) => {
            const total = day.total;
            const totalH = peakDay === 0 ? 0 : (total / peakDay) * 160;
            const okH = total === 0 ? 0 : (day.success / total) * totalH;
            const failH = total === 0 ? 0 : (day.failed / total) * totalH;
            const otherH = Math.max(0, totalH - okH - failH);
            return (
              <BarColumn
                key={day.iso}
                label={day.label}
                total={total}
                okH={okH}
                failH={failH}
                otherH={otherH}
                day={day}
              />
            );
          })}
        </div>
        <div className="mt-2 grid gap-2 border-t border-ink-700 pt-2 font-mono text-[10px] text-ink-500" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => (
            <div key={day.iso} className="text-center uppercase tracking-[0.16em]">{day.label}</div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-ink-700 border-t border-ink-700 lg:grid-cols-4">
        <TileStat label="TOTAL · ALLTIME" value={String(stats.total)} />
        <TileStat label="SUCCESS" value={String(stats.success)} tone="good" />
        <TileStat label="FAILED" value={String(stats.failed)} tone={stats.failed > 0 ? "danger" : undefined} />
        <TileStat label="AVG DURATION" value={stats.avgDurationLabel} />
      </div>

      {perAgent.length > 0 && (
        <div className="border-t border-ink-700 px-5 py-4">
          <div className="kicker mb-3">BY AGENT · TOP {perAgent.length}</div>
          <ul className="space-y-2">
            {perAgent.map((entry) => (
              <li key={entry.agentId} className="font-mono text-[11px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-ink-100">{entry.name}</span>
                  <span className="text-ink-400">
                    {entry.success}/{entry.total} ok
                  </span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden border border-ink-700 bg-ink-950">
                  {(["success", "failed", "running", "queued", "canceled"] as AgentRunStatus[]).map((status) => {
                    const count = entry.byStatus[status] ?? 0;
                    if (count === 0 || entry.total === 0) return null;
                    const percent = (count / entry.total) * 100;
                    return (
                      <div
                        key={status}
                        className={STATUS_BAR_TONE[status]}
                        style={{ width: `${percent}%` }}
                        title={`${status}: ${count}`}
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BarColumn({
  label,
  total,
  okH,
  failH,
  otherH,
  day,
}: {
  label: string;
  total: number;
  okH: number;
  failH: number;
  otherH: number;
  day: DayBucket;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative flex h-full flex-col items-stretch justify-end" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {hover && total > 0 && (
        <div className="pointer-events-none absolute -top-12 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-ink-600 bg-ink-950 px-2 py-1 font-mono text-[10px] text-ink-100">
          <span className="text-signal-amber">{label}</span> · {day.success} ok · {day.failed} fail · {day.other} other
        </div>
      )}
      <div className="flex flex-col-reverse">
        {okH > 0 && <div className="bg-signal-green/85" style={{ height: `${okH}px` }} aria-label={`${day.success} succeeded`} />}
        {failH > 0 && <div className="bg-signal-red/85" style={{ height: `${failH}px` }} aria-label={`${day.failed} failed`} />}
        {otherH > 0 && <div className="bg-ink-500" style={{ height: `${otherH}px` }} aria-label={`${day.other} other`} />}
        {total === 0 && <div className="border-t border-ink-700" />}
      </div>
    </div>
  );
}

function LegendDot({ label, cls }: { label: string; cls: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-500">
      <span className={`block h-2 w-2 ${cls}`} />
      <span>{label}</span>
    </span>
  );
}

function TileStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "danger" }) {
  const color = tone === "good" ? "text-signal-green" : tone === "danger" ? "text-signal-red" : "text-ink-100";
  return (
    <div className="px-5 py-4">
      <div className="kicker">{label}</div>
      <div className={`mt-1 font-mono text-2xl tabular-nums ${color}`}>{value}</div>
    </div>
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
      label: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3).toUpperCase(),
      total: 0,
      success: 0,
      failed: 0,
      other: 0,
    });
  }

  for (const run of runs) {
    if (!run.createdAt) continue;
    const iso = new Date(run.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(iso);
    if (!bucket) continue;
    bucket.total += 1;
    if (run.status === "success") bucket.success += 1;
    else if (run.status === "failed") bucket.failed += 1;
    else bucket.other += 1;
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
