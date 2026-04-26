import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type { ActivityRecord, AgentRunLogEntry, AgentRunRecord } from "@/lib/types";

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listAgentRuns(), api.listActivity()])
      .then(([nextRuns, nextActivities]) => {
        setRuns(nextRuns);
        setActivities(nextActivities);
      })
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Runs / Activity</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
          Execution history with structured inputs, output, and step logs.
        </p>
      </header>

      {error && <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading runs...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Agent runs</h2>
            {runs.length === 0 ? <Empty text="No agent runs recorded." /> : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <RunCard key={run.id} run={run} />
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

function RunCard({ run }: { run: AgentRunRecord }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-100">{run.title}</div>
          <div className="mt-1 text-xs text-ink-500">{relative(run.createdAt)}</div>
        </div>
        <span className={statusBadgeClass(run.status)}>{run.status}</span>
      </div>
      {run.inputs && Object.keys(run.inputs).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-ink-400">
          {Object.entries(run.inputs).map(([key, val]) => (
            <span key={key} className="rounded-md border border-ink-800 bg-ink-950/40 px-2 py-0.5">
              <span className="text-ink-500">{key}:</span> {String(val)}
            </span>
          ))}
        </div>
      )}
      {run.output && <p className="mt-3 text-sm leading-6 text-ink-300">{run.output}</p>}
      {run.error && <div className="mt-3 text-xs text-rose-300">{run.error}</div>}
      {run.logs && run.logs.length > 0 && <RunLogTimeline logs={run.logs} />}
    </div>
  );
}

function RunLogTimeline({ logs }: { logs: AgentRunLogEntry[] }) {
  return (
    <ol className="mt-3 space-y-1.5 border-l border-ink-800 pl-3">
      {logs.map((entry, index) => (
        <li key={index} className="text-xs">
          <span className={logLevelClass(entry.level)}>{entry.level.toUpperCase()}</span>
          <span className="ml-2 text-ink-300">{entry.message}</span>
        </li>
      ))}
    </ol>
  );
}

function statusBadgeClass(status: AgentRunRecord["status"]) {
  const tone = status === "success"
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
    : status === "failed"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
      : "border-ink-700 bg-ink-950/40 text-ink-300";
  return `rounded-full border px-2.5 py-1 text-xs capitalize ${tone}`;
}

function logLevelClass(level: AgentRunLogEntry["level"]) {
  if (level === "error") return "font-semibold text-rose-300";
  if (level === "warn") return "font-semibold text-amber-300";
  return "font-semibold text-ink-500";
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-ink-700 p-6 text-center text-sm text-ink-500">{text}</div>;
}
