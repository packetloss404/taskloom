import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Bot, CalendarClock, KeyRound, Loader2, Plus, Play, RefreshCw, Sparkles, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type { AgentRecord, AgentRunRecord, BootstrapPayload, ProviderRecord, WorkflowDraft } from "@/lib/types";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [applying, setApplying] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBootstrap, nextAgents, nextProviders, nextRuns] = await Promise.all([
        api.getBootstrap(),
        api.listAgents(),
        api.listProviders(),
        api.listAgentRuns(),
      ]);
      setBootstrap(nextBootstrap);
      setAgents(nextAgents);
      setProviders(nextProviders);
      setRuns(nextRuns);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const providerCounts = useMemo(() => {
    return {
      connected: providers.filter((provider) => provider.status === "connected").length,
      missing: providers.filter((provider) => provider.status === "missing_key").length,
    };
  }, [providers]);

  const generateDraft = async () => {
    setError(null);
    setMessage(null);
    setDrafting(true);
    try {
      const result = await api.generateWorkflowFromPrompt({ prompt, apply: false });
      setDraft(result.draft);
      setMessage("Draft workflow generated from prompt. Review below and apply when ready.");
    } catch (draftError) {
      setError((draftError as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const applyDraft = async () => {
    if (!draft) return;
    setError(null);
    setMessage(null);
    setApplying(true);
    try {
      await api.generateWorkflowFromPrompt({ prompt: draft.prompt, apply: true });
      setMessage("Draft applied: brief, requirements, and plan items updated.");
      setDraft(null);
      navigate("/workflow");
    } catch (applyError) {
      setError((applyError as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const runAgent = async (agentId: string) => {
    setRunningId(agentId);
    setError(null);
    setMessage(null);
    try {
      await api.runAgent(agentId);
      setMessage("Agent run recorded.");
      await loadDashboard();
    } catch (runError) {
      setError((runError as Error).message);
    } finally {
      setRunningId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-ink-850" />
        <div className="h-44 animate-pulse rounded-2xl bg-ink-900" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-2xl bg-ink-900" />
          <div className="h-28 animate-pulse rounded-2xl bg-ink-900" />
          <div className="h-28 animate-pulse rounded-2xl bg-ink-900" />
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">{bootstrap?.workspace.name ?? "Workspace"}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-100">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
            Build agents, connect your own providers, and run scheduled workflows without platform credit lock-in.
          </p>
        </div>
        <button className="btn-ghost" type="button" onClick={loadDashboard}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {error && <Status tone="error">{error}</Status>}
      {message && !error && <Status tone="success">{message}</Status>}

      <section className="mb-6 rounded-2xl border border-ink-700/70 bg-ink-900/70 p-4 shadow-card sm:p-5">
        <label className="mb-2 block text-sm font-medium text-ink-200" htmlFor="automation-prompt">
          What do you want to automate?
        </label>
        <textarea
          id="automation-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          className="dashboard-input resize-none"
          placeholder="Every weekday at 8am, check my support inbox, summarize urgent items, draft replies, and post a brief."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary bg-ink-100 text-ink-950 hover:bg-white"
            onClick={() => navigate("/agents/new", { state: { prompt } })}
          >
            <Plus className="h-4 w-4" /> New Agent
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void generateDraft()}
            disabled={drafting || prompt.trim().length < 8}
          >
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Draft workflow from prompt
          </button>
          <Link to="/workflows" className="btn-ghost">
            <Workflow className="h-4 w-4" /> New Workflow
          </Link>
          <Link to="/integrations" className="btn-ghost">
            <KeyRound className="h-4 w-4" /> Connect Provider
          </Link>
        </div>
      </section>

      {draft && (
        <section className="mb-6 rounded-2xl border border-accent-500/30 bg-ink-900/70 p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-100">Draft workflow preview</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-400">
                Generated brief, requirements, and plan items. Apply to overwrite this workspace's workflow.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDraft(null)} disabled={applying}>
                Discard
              </button>
              <button
                type="button"
                className="btn-primary bg-ink-100 text-ink-950 hover:bg-white"
                onClick={() => void applyDraft()}
                disabled={applying}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
                Apply to workflow
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Brief</h3>
              <p className="mt-2 text-sm leading-6 text-ink-200">{draft.brief.summary}</p>
              {draft.brief.targetCustomers.length > 0 && (
                <p className="mt-2 text-xs text-ink-500">For: {draft.brief.targetCustomers.join(", ")}</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Requirements</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-200">
                {draft.requirements.map((entry, index) => (
                  <li key={`${entry.title}-${index}`} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
                    <span><span className="text-ink-400 capitalize">{entry.priority}</span> · {entry.title}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Plan items</h3>
              <ol className="mt-2 space-y-1.5 text-sm text-ink-200">
                {draft.planItems.map((entry, index) => (
                  <li key={`${entry.title}-${index}`} className="flex gap-2">
                    <span className="text-ink-500">{index + 1}.</span>
                    <span>{entry.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<Bot className="h-4 w-4" />} label="Agents" value={agents.length} />
        <Metric icon={<CalendarClock className="h-4 w-4" />} label="Scheduled" value={agents.filter((agent) => agent.schedule).length} />
        <Metric icon={<Activity className="h-4 w-4" />} label="Runs" value={runs.length} />
        <Metric icon={<KeyRound className="h-4 w-4" />} label="Providers" value={`${providerCounts.connected}/${providers.length}`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section>
          <SectionHeader title="Recent agents" to="/agents" />
          {agents.length === 0 ? (
            <EmptyState
              icon={<Bot className="h-5 w-5" />}
              title="No agents yet"
              body="Create your first agent and it will persist to the backend, appear in the sidebar, and become runnable here."
              action={<Link to="/agents/new" className="btn-primary bg-ink-100 text-ink-950 hover:bg-white"><Plus className="h-4 w-4" /> New Agent</Link>}
            />
          ) : (
            <div className="grid gap-3">
              {agents.slice(0, 5).map((agent) => (
                <article key={agent.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/agents/${agent.id}`} className="text-base font-semibold text-ink-100 hover:text-white">
                          {agent.name}
                        </Link>
                        <Badge>{agent.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-ink-400">{agent.description || "No description yet."}</p>
                      <div className="mt-3 text-xs text-ink-500">
                        {agent.provider?.name ?? "No provider"} {agent.model ? `· ${agent.model}` : ""} {agent.schedule ? `· ${agent.schedule}` : ""}
                      </div>
                    </div>
                    <button className="btn-ghost justify-center" type="button" onClick={() => void runAgent(agent.id)} disabled={runningId === agent.id}>
                      {runningId === agent.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Run
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <SectionHeader title="Provider status" to="/integrations" />
            {providers.length === 0 ? (
              <EmptyState icon={<KeyRound className="h-5 w-5" />} title="No providers" body="Connect an API provider or local runtime before running model-backed agents." />
            ) : (
              <div className="space-y-3">
                {providers.map((provider) => (
                  <div key={provider.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-ink-100">{provider.name}</div>
                        <div className="mt-1 text-xs text-ink-500">{provider.defaultModel}</div>
                      </div>
                      <Badge tone={provider.status === "connected" ? "good" : "warn"}>{provider.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Recent runs" to="/runs" />
            {runs.length === 0 ? (
              <EmptyState icon={<Activity className="h-5 w-5" />} title="No runs yet" body="Run an agent to record execution history here." />
            ) : (
              <div className="space-y-3">
                {runs.slice(0, 6).map((run) => (
                  <div key={run.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink-100">{run.title}</div>
                        <div className="mt-1 text-xs text-ink-500">{relative(run.createdAt)}</div>
                      </div>
                      <Badge tone={run.status === "failed" ? "danger" : run.status === "success" ? "good" : "muted"}>{run.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <DashboardStyles />
    </>
  );
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">{title}</h2>
      <Link to={to} className="text-sm text-ink-400 hover:text-ink-100">View all</Link>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-900/50 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-ink-100">{value}</div>
    </div>
  );
}

function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/25 p-6 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-ink-850 text-ink-300">{icon}</div>
      <h3 className="mt-3 text-sm font-semibold text-ink-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-500">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "danger" | "good" | "muted" | "warn" }) {
  const classes = {
    danger: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    muted: "border-ink-700 bg-ink-950/40 text-ink-300",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  }[tone];
  return <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${classes}`}>{children}</span>;
}

function Status({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const classes = tone === "error"
    ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
    : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  return <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}

export function DashboardStyles() {
  return (
    <style>{`
      .dashboard-input {
        width: 100%;
        border: 1px solid rgb(38 38 46 / 0.95);
        border-radius: 14px;
        background: rgb(8 8 12 / 0.58);
        padding: 10px 12px;
        color: rgb(244 244 245);
        font-size: 14px;
        outline: none;
        transition: border-color 150ms, box-shadow 150ms, background 150ms;
      }
      .dashboard-input::placeholder { color: rgb(113 113 122); }
      .dashboard-input:focus {
        border-color: rgb(212 212 216 / 0.42);
        box-shadow: 0 0 0 3px rgb(212 212 216 / 0.11);
        background: rgb(8 8 12 / 0.75);
      }
      .dashboard-input:disabled { opacity: 0.65; cursor: not-allowed; }
    `}</style>
  );
}
