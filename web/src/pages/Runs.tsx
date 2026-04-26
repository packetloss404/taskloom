import { useEffect, useMemo, useState } from "react";
import { Activity, Loader2, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/api";
import { duration, relative } from "@/lib/format";
import type { ActivityRecord, AgentRunRecord, AgentRunStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: "all" | AgentRunStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "canceled", label: "Canceled" },
];

const STATUS_TONE: Record<AgentRunStatus, string> = {
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  failed: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  running: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  queued: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  canceled: "border-ink-700 bg-ink-900/80 text-ink-300",
};

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AgentRunStatus>("all");
  const [pending, setPending] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRuns, nextActivities] = await Promise.all([api.listAgentRuns(), api.listActivity()]);
      setRuns(nextRuns);
      setActivities(nextActivities);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return runs;
    return runs.filter((run) => run.status === filter);
  }, [runs, filter]);

  const counts = useMemo(() => {
    const totals: Record<string, number> = { all: runs.length };
    for (const run of runs) totals[run.status] = (totals[run.status] ?? 0) + 1;
    return totals;
  }, [runs]);

  const cancel = async (run: AgentRunRecord) => {
    setPending(run.id);
    setError(null);
    try {
      await api.cancelAgentRun(run.id);
      await reload();
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setPending(null);
    }
  };

  const retry = async (run: AgentRunRecord) => {
    setPending(run.id);
    setError(null);
    try {
      await api.retryAgentRun(run.id);
      await reload();
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Runs / Activity</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
          Execution history for the workspace. Cancel pending runs or retry failed ones.
        </p>
      </header>

      {error && <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading runs...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Agent runs</h2>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map(({ value, label }) => {
                  const active = filter === value;
                  const count = counts[value] ?? 0;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? "border-ink-200 bg-ink-100 text-ink-950"
                          : "border-ink-700 bg-ink-900/40 text-ink-300 hover:border-ink-500 hover:text-ink-100"
                      }`}
                    >
                      {label} {count > 0 && <span className={active ? "text-ink-700" : "text-ink-500"}>· {count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {filtered.length === 0 ? <Empty text="No runs match this filter." /> : (
              <div className="space-y-3">
                {filtered.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink-100">{run.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                          <span>{relative(run.createdAt)}</span>
                          <span className="text-ink-600">·</span>
                          <span>duration {duration(run.durationMs ?? null)}</span>
                          {run.startedAt && (
                            <>
                              <span className="text-ink-600">·</span>
                              <span>started {relative(run.startedAt)}</span>
                            </>
                          )}
                        </div>
                        {run.error && <div className="mt-2 text-xs text-rose-300">{run.error}</div>}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs capitalize ${STATUS_TONE[run.status]}`}>
                        {run.status}
                      </span>
                    </div>
                    {(run.canCancel || run.canRetry) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {run.canCancel && (
                          <button
                            type="button"
                            onClick={() => cancel(run)}
                            disabled={pending === run.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-950/40 px-3 py-1.5 text-xs text-ink-200 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                        )}
                        {run.canRetry && (
                          <button
                            type="button"
                            onClick={() => retry(run)}
                            disabled={pending === run.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-950/40 px-3 py-1.5 text-xs text-ink-200 hover:border-accent-400/40 hover:text-accent-200 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Retry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-ink-700 p-6 text-center text-sm text-ink-500">{text}</div>;
}
