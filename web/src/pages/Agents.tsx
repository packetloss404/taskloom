import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, CalendarClock, ListChecks, Loader2, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type { AgentRecord } from "@/lib/types";
import { describeNextRun, triggerLabel, triggerToneClass } from "@/lib/agent-runtime";
import { DashboardStyles } from "./Dashboard";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listAgents()
      .then(setAgents)
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter((agent) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [agent.name, agent.description, agent.instructions, agent.provider?.name, agent.model, agent.schedule]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });

  return (
    <>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Agents</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
            Create, edit, schedule, and run persistent workspace agents.
          </p>
        </div>
        <Link to="/agents/new" className="btn-primary bg-ink-100 text-ink-950 hover:bg-white">
          <Plus className="h-4 w-4" /> New Agent
        </Link>
      </header>

      <div className="mb-5 flex items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input className="dashboard-input h-10 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents" />
        </div>
      </div>

      {error && <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/25 p-8 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-ink-850 text-ink-300"><Bot className="h-5 w-5" /></div>
          <h2 className="mt-3 text-sm font-semibold text-ink-100">No agents found</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-500">Create an agent to persist it in the backend and make it available across the dashboard.</p>
          <div className="mt-4"><Link to="/agents/new" className="btn-primary bg-ink-100 text-ink-950 hover:bg-white"><Plus className="h-4 w-4" /> New Agent</Link></div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((agent) => {
            const stepCount = agent.playbook?.length ?? 0;
            return (
              <Link key={agent.id} to={`/agents/${agent.id}`} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4 transition-colors hover:border-ink-600 hover:bg-ink-900/75">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-ink-100">{agent.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-400">{agent.description || "No description yet."}</p>
                  </div>
                  <span className="rounded-full border border-ink-700 bg-ink-950/40 px-2.5 py-1 text-xs capitalize text-ink-300">{agent.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${triggerToneClass(agent.triggerKind)}`}>
                    {triggerLabel(agent.triggerKind)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-950/40 px-2 py-0.5 text-ink-300">
                    <ListChecks className="h-3 w-3" /> {stepCount} step{stepCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-950/40 px-2 py-0.5 text-ink-300">
                    <CalendarClock className="h-3 w-3" /> {describeNextRun(agent.schedule, agent.triggerKind)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
                  <span>{agent.provider?.name ?? "No provider"}</span>
                  {agent.model && <span>· {agent.model}</span>}
                  <span>· Updated {relative(agent.updatedAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <DashboardStyles />
    </>
  );
}
