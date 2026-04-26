import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import RunTelemetry from "@/components/RunTelemetry";
import type { ActivityRecord, AgentRecord, AgentRunRecord } from "@/lib/types";

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Runs / Activity</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
          Execution history and workspace activity from the backend.
        </p>
      </header>

      {error && <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading runs...</div>
      ) : (
        <>
        <div className="mb-6">
          <RunTelemetry runs={runs} agents={agents} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Agent runs</h2>
            {runs.length === 0 ? <Empty text="No agent runs recorded." /> : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-ink-100">{run.title}</div>
                        <div className="mt-1 text-xs text-ink-500">{relative(run.createdAt)}</div>
                        {run.error && <div className="mt-2 text-xs text-rose-300">{run.error}</div>}
                      </div>
                      <span className="rounded-full border border-ink-700 bg-ink-950/40 px-2.5 py-1 text-xs capitalize text-ink-300">{run.status}</span>
                    </div>
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
        </>
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-ink-700 p-6 text-center text-sm text-ink-500">{text}</div>;
}
