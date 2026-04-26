import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type {
  ActivityRecord,
  AgentRecord,
  AgentRunRecord,
  BootstrapPayload,
  ProviderRecord,
  WorkflowDraft,
} from "@/lib/types";

type RecencyFilter = "all" | "24h" | "7d" | "30d";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>("all");

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
      setActivities(nextBootstrap.activities ?? []);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const openBlockers = useMemo(() => {
    const items = bootstrap?.activation.summary.items ?? [];
    return items.filter((item) => !item.completed).length;
  }, [bootstrap]);

  const currentStageKey = bootstrap?.activation.summary.stageLabel ?? "unknown";
  const currentRiskKey = bootstrap?.activation.summary.riskLevel ?? "low";
  const dashboardScopeMatches =
    (stageFilter === "all" || stageFilter === currentStageKey) &&
    (riskFilter === "all" || riskFilter === currentRiskKey);

  const statusOptions = useMemo(() => {
    const activityScopes = Array.from(new Set(activities.map((activity) => activity.scope))).sort();
    const activityEvents = Array.from(new Set(activities.map((activity) => activity.event))).sort();
    const agentStatuses = Array.from(new Set(agents.map((agent) => agent.status))).sort();
    const providerStatuses = Array.from(new Set(providers.map((provider) => provider.status))).sort();
    const runStatuses = Array.from(new Set(runs.map((run) => run.status))).sort();

    return [
      { value: "all", label: "All statuses" },
      ...activityScopes.map((scope) => ({ value: `activity-scope:${scope}`, label: `Activity scope · ${scope}` })),
      ...activityEvents.map((event) => ({ value: `activity-event:${event}`, label: `Activity event · ${formatEventName(event)}` })),
      ...agentStatuses.map((status) => ({ value: `agent:${status}`, label: `Agent · ${status}` })),
      ...providerStatuses.map((status) => ({ value: `provider:${status}`, label: `Provider · ${status.replace("_", " ")}` })),
      ...runStatuses.map((status) => ({ value: `run:${status}`, label: `Run · ${status}` })),
    ];
  }, [activities, agents, providers, runs]);

  const filteredActivities = useMemo(() => {
    if (!dashboardScopeMatches) return [];
    return activities.filter(
      (activity) =>
        matchesActivityStatus(activity, statusFilter) && isWithinRecency(activity.occurredAt, recencyFilter),
    );
  }, [activities, dashboardScopeMatches, recencyFilter, statusFilter]);

  const filteredAgents = useMemo(() => {
    if (!dashboardScopeMatches) return [];
    return agents.filter(
      (agent) => matchesCategoryStatus("agent", agent.status, statusFilter) && isWithinRecency(agent.updatedAt, recencyFilter),
    );
  }, [agents, dashboardScopeMatches, recencyFilter, statusFilter]);

  const filteredProviders = useMemo(() => {
    if (!dashboardScopeMatches) return [];
    return providers.filter(
      (provider) =>
        matchesCategoryStatus("provider", provider.status, statusFilter) && isWithinRecency(provider.updatedAt, recencyFilter),
    );
  }, [dashboardScopeMatches, providers, recencyFilter, statusFilter]);

  const filteredRuns = useMemo(() => {
    if (!dashboardScopeMatches) return [];
    return runs.filter(
      (run) => matchesCategoryStatus("run", run.status, statusFilter) && isWithinRecency(run.createdAt, recencyFilter),
    );
  }, [dashboardScopeMatches, recencyFilter, runs, statusFilter]);

  const filteredProviderCounts = useMemo(() => {
    return {
      connected: filteredProviders.filter((provider) => provider.status === "connected").length,
      missing: filteredProviders.filter((provider) => provider.status === "missing_key").length,
    };
  }, [filteredProviders]);

  const filtersActive =
    stageFilter !== "all" || riskFilter !== "all" || statusFilter !== "all" || recencyFilter !== "all";

  const resetFilters = () => {
    setStageFilter("all");
    setRiskFilter("all");
    setStatusFilter("all");
    setRecencyFilter("all");
  };

  const generateDraft = async () => {
    setError(null);
    setMessage(null);
    setDrafting(true);
    try {
      const result = await api.generateWorkflowFromPrompt({ prompt, apply: false });
      setDraft(result.draft);
      setMessage("Draft workflow generated. Review below and apply when ready.");
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

  if (loading) {
    return (
      <div className="page-frame space-y-6">
        <div className="h-3 w-40 animate-pulse bg-ink-850" />
        <div className="h-16 w-2/3 animate-pulse bg-ink-850" />
        <div className="h-px w-full bg-ink-800" />
        <div className="grid grid-cols-4 gap-px bg-ink-800">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse bg-ink-900" />
          ))}
        </div>
      </div>
    );
  }

  const workspaceName = bootstrap?.workspace.name ?? "Workspace";
  const stage = bootstrap?.activation.summary.stageLabel ?? "—";
  const risk = bootstrap?.activation.summary.riskLabel ?? "—";
  const riskLevel = bootstrap?.activation.summary.riskLevel ?? "low";
  const activation = bootstrap?.activation.summary.progressLabel ?? "0%";
  const activationPercent = bootstrap?.activation.summary.progressPercent ?? 0;

  return (
    <div className="page-frame">
      <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="kicker">WORKSPACE OVERVIEW · {workspaceName.toUpperCase()}</p>
          <h1 className="display-xl mt-3">{workspaceName}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink-400">
            Build agents, connect your own providers, and run scheduled workflows without
            platform credit lock-in.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="section-marker">§ 01 / 06</span>
          <button className="btn-ghost" type="button" onClick={loadDashboard}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </header>

      {error && <Banner tone="error">{error}</Banner>}
      {message && !error && <Banner tone="success">{message}</Banner>}

      {/* STAT STRIP */}
      <section className="mb-2">
        <div className="grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 sm:grid-cols-4">
          <StatCell label="STAGE" value={stage} />
          <StatCell label="RISK" value={risk} tone={riskLevel === "high" ? "danger" : riskLevel === "medium" ? "warn" : "good"} />
          <StatCell label="ACTIVATION" value={activation} subline={`${activationPercent}/100`} />
          <StatCell
            label="OPEN BLOCKERS"
            value={String(openBlockers).padStart(2, "0")}
            tone={openBlockers > 0 ? "warn" : "good"}
          />
        </div>
      </section>

      {/* DASHBOARD FILTERS */}
      <section className="mt-6 border border-ink-800 bg-ink-950 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">CONTROL ROOM FILTERS</p>
            <p className="mt-2 text-sm text-ink-400">
              Local filters over the loaded workspace dashboard. Stage and risk use the current activation summary.
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={resetFilters} disabled={!filtersActive}>
            Reset filters
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <FilterField label="STAGE">
            <select className="workflow-input font-mono text-[11px]" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
              <option value="all">All stages</option>
              <option value={currentStageKey}>Current · {stage}</option>
            </select>
          </FilterField>
          <FilterField label="RISK">
            <select className="workflow-input font-mono text-[11px]" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="all">All risks</option>
              <option value={currentRiskKey}>Current · {risk}</option>
            </select>
          </FilterField>
          <FilterField label="STATUS / EVENT">
            <select className="workflow-input font-mono text-[11px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="RECENCY">
            <select className="workflow-input font-mono text-[11px]" value={recencyFilter} onChange={(event) => setRecencyFilter(event.target.value as RecencyFilter)}>
              <option value="all">All time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
            </select>
          </FilterField>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px bg-ink-800 md:grid-cols-4">
          <FilterCount label="ACTIVITY" count={filteredActivities.length} total={activities.length} />
          <FilterCount label="AGENTS" count={filteredAgents.length} total={agents.length} />
          <FilterCount label="PROVIDERS" count={filteredProviders.length} total={providers.length} />
          <FilterCount label="RUNS" count={filteredRuns.length} total={runs.length} />
        </div>
      </section>

      {/* DRAFT WORKFLOW */}
      <section className="section-band mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">§ 02 / 06 · PROMPT INTAKE</p>
            <h2 className="display mt-2 text-3xl">Draft workflow from prompt.</h2>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            MODEL · gpt-4.1-mini · ~$0.0040 / draft
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <label className="kicker mb-2 block" htmlFor="automation-prompt">
              AUTOMATION REQUEST
            </label>
            <textarea
              id="automation-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              className="workflow-input resize-none"
              placeholder="Every weekday at 8am, check my support inbox, summarize urgent items, draft replies, and post a brief."
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void generateDraft()}
                disabled={drafting || prompt.trim().length < 8}
              >
                {drafting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span>▸</span>
                )}
                Draft workflow
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => navigate("/agents/new", { state: { prompt } })}
              >
                + New agent
              </button>
              <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                CHAR · {prompt.length.toString().padStart(4, "0")}
              </span>
            </div>
          </div>

          <aside className="border-l border-ink-800 pl-6">
            <p className="kicker mb-3">JUMP</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/workflows" className="leader flex justify-between text-ink-200 hover:text-signal-amber">
                  <span>Workflow brief</span>
                  <span className="font-mono text-ink-500">→</span>
                </Link>
              </li>
              <li>
                <Link to="/agents" className="leader flex justify-between text-ink-200 hover:text-signal-amber">
                  <span>Agents catalogue</span>
                  <span className="font-mono text-ink-500">→</span>
                </Link>
              </li>
              <li>
                <Link to="/operations" className="leader flex justify-between text-ink-200 hover:text-signal-amber">
                  <span>Operations</span>
                  <span className="font-mono text-ink-500">→</span>
                </Link>
              </li>
              <li>
                <Link to="/integrations" className="leader flex justify-between text-ink-200 hover:text-signal-amber">
                  <span>Provider keys</span>
                  <span className="font-mono text-ink-500">→</span>
                </Link>
              </li>
            </ul>
          </aside>
        </div>

        {draft && (
          <div className="spec-frame mt-8">
            <div className="spec-label spec-label--amber">DRAFT PREVIEW</div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-ink-300">
                Generated brief, requirements, and plan items. Apply to overwrite this workspace's workflow.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setDraft(null)}
                  disabled={applying}
                >
                  × Discard
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void applyDraft()}
                  disabled={applying}
                >
                  {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>▸</span>}
                  Apply to workflow
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div>
                <p className="kicker mb-2">BRIEF</p>
                <p className="text-sm leading-6 text-ink-200">{draft.brief.summary}</p>
                {draft.brief.targetCustomers.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-ink-500">
                    FOR · {draft.brief.targetCustomers.join(", ")}
                  </p>
                )}
              </div>
              <div>
                <p className="kicker mb-2">REQUIREMENTS</p>
                <ul className="space-y-1.5 text-sm text-ink-200">
                  {draft.requirements.map((entry, index) => (
                    <li key={`${entry.title}-${index}`} className="flex gap-3">
                      <span className="font-mono text-ink-500">{(index + 1).toString().padStart(2, "0")}</span>
                      <span>
                        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-500">
                          {entry.priority}
                        </span>{" "}
                        · {entry.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="kicker mb-2">PLAN ITEMS</p>
                <ol className="space-y-1.5 text-sm text-ink-200">
                  {draft.planItems.map((entry, index) => (
                    <li key={`${entry.title}-${index}`} className="flex gap-3">
                      <span className="font-mono text-ink-500">{(index + 1).toString().padStart(2, "0")}</span>
                      <span>{entry.title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ONBOARDING CHECKLIST */}
      <section className="section-band">
        <SectionHeader marker="§ 03 / 06" kicker="STATE OF THE WORKSPACE" title="Activation checklist." />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12"></th>
                <th>MILESTONE</th>
                <th>NOTE</th>
                <th className="w-36 text-right">SINCE</th>
              </tr>
            </thead>
            <tbody>
              {(bootstrap?.activation.summary.items ?? []).map((item) => (
                <tr key={item.key}>
                  <td className="font-mono text-ink-300">
                    {item.completed ? (
                      <span className="text-signal-green">[✓]</span>
                    ) : (
                      <span className="text-ink-500">[ ]</span>
                    )}
                  </td>
                  <td>
                    <div className="text-ink-100">{item.label}</div>
                  </td>
                  <td className="text-ink-400">{item.description}</td>
                  <td className="num text-ink-500">
                    {item.completed && item.completedAt ? relative(item.completedAt) : "—"}
                  </td>
                </tr>
              ))}
              {(bootstrap?.activation.summary.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-ink-500">
                    No activation checklist available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="section-band">
        <SectionHeader marker="§ 04 / 06" kicker="LEDGER" title="Recent activity." viewAll="/activity" />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-32">SCOPE</th>
                <th>EVENT</th>
                <th>ACTOR</th>
                <th className="w-40 text-right">WHEN</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.slice(0, 10).map((activity) => (
                <tr key={activity.id}>
                  <td className="font-mono text-[11px] uppercase tracking-wide text-ink-500">{activity.scope}</td>
                  <td className="text-ink-100">
                    <Link to={`/activity/${activity.id}`} className="hover:text-signal-amber">
                      {formatEventName(activity.event)}
                    </Link>
                  </td>
                  <td className="text-ink-400">
                    {activity.actor.displayName ?? activity.actor.id}
                  </td>
                  <td className="num text-ink-500">{relative(activity.occurredAt)}</td>
                </tr>
              ))}
              {filteredActivities.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-ink-500">
                    {activities.length === 0 ? "No activity yet. Run an agent to populate the ledger." : "No activity matches the current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* AGENTS + PROVIDERS + RUNS — typographic three-column ledger */}
      <section className="section-band">
        <SectionHeader marker="§ 05 / 06" kicker="ROSTER" title="Agents, providers, runs." />
        <div className="grid gap-px bg-ink-800 lg:grid-cols-3">
          <div className="bg-ink-950 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="kicker">AGENTS · {filteredAgents.length.toString().padStart(2, "0")}/{agents.length.toString().padStart(2, "0")}</p>
              <Link to="/agents" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 hover:text-signal-amber">
                ALL →
              </Link>
            </div>
            {filteredAgents.length === 0 ? (
              <p className="text-sm text-ink-500">
                {agents.length === 0 ? <>No agents yet. <Link to="/agents/new" className="text-signal-amber">Create one →</Link></> : "No agents match the current filters."}
              </p>
            ) : (
              <ul className="space-y-3">
                {filteredAgents.slice(0, 5).map((agent) => (
                  <li key={agent.id} className="border-b border-ink-800 pb-3 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link to={`/agents/${agent.id}`} className="text-sm text-ink-100 hover:text-signal-amber">
                        {agent.name}
                      </Link>
                      <StatusPill status={agent.status} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-500">
                      {agent.provider?.name ?? "NO PROVIDER"} · {agent.model ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-ink-950 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="kicker">
                PROVIDERS · {filteredProviderCounts.connected.toString().padStart(2, "0")}/{filteredProviders.length.toString().padStart(2, "0")}
              </p>
              <Link to="/integrations" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 hover:text-signal-amber">
                ALL →
              </Link>
            </div>
            {filteredProviders.length === 0 ? (
              <p className="text-sm text-ink-500">{providers.length === 0 ? "No providers configured." : "No providers match the current filters."}</p>
            ) : (
              <ul className="space-y-3">
                {filteredProviders.slice(0, 5).map((provider) => (
                  <li key={provider.id} className="border-b border-ink-800 pb-3 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-ink-100">{provider.name}</span>
                      <span
                        className={`pill ${
                          provider.status === "connected" ? "pill--good" : "pill--warn"
                        }`}
                      >
                        {provider.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-500">
                      {provider.defaultModel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-ink-950 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="kicker">RUNS · {filteredRuns.length.toString().padStart(2, "0")}/{runs.length.toString().padStart(2, "0")}</p>
              <Link to="/runs" className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 hover:text-signal-amber">
                ALL →
              </Link>
            </div>
            {filteredRuns.length === 0 ? (
              <p className="text-sm text-ink-500">{runs.length === 0 ? "No runs yet." : "No runs match the current filters."}</p>
            ) : (
              <ul className="space-y-3">
                {filteredRuns.slice(0, 5).map((run) => (
                  <li key={run.id} className="border-b border-ink-800 pb-3 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-ink-100">{run.title}</span>
                      <span
                        className={`pill ${
                          run.status === "failed"
                            ? "pill--danger"
                            : run.status === "success"
                              ? "pill--good"
                              : "pill--muted"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-500">
                      {relative(run.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="section-band">
        <SectionHeader marker="§ 06 / 06" kicker="JUMP DESK" title="Workspace surfaces." />
        <ul className="divide-y divide-ink-800">
          {[
            { label: "Workflow brief & plan", to: "/workflows", code: "WF-01" },
            { label: "Agents catalogue", to: "/agents", code: "AG-01" },
            { label: "Operations · blockers, questions, release", to: "/operations", code: "OP-01" },
            { label: "Run history & telemetry", to: "/runs", code: "RN-01" },
            { label: "Provider keys & env vars", to: "/integrations", code: "IN-01" },
            { label: "Settings", to: "/settings", code: "ST-01" },
          ].map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="leader flex items-center justify-between gap-4 py-3 text-sm text-ink-200 transition-colors hover:text-signal-amber"
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                    {link.code}
                  </span>
                  <span>{link.label}</span>
                </span>
                <span className="font-mono text-ink-500">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCell({
  label,
  value,
  subline,
  tone,
}: {
  label: string;
  value: string;
  subline?: string;
  tone?: "good" | "warn" | "danger";
}) {
  const valueColor =
    tone === "danger" ? "text-signal-red" : tone === "warn" ? "text-signal-amber" : "text-ink-100";
  return (
    <div className="bg-ink-950 px-5 py-5">
      <p className="kicker">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${valueColor} num`}>{value}</p>
      {subline && <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-500">{subline}</p>}
    </div>
  );
}

function SectionHeader({
  marker,
  kicker,
  title,
  viewAll,
}: {
  marker: string;
  kicker: string;
  title: string;
  viewAll?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">{marker} · {kicker}</p>
        <h2 className="display mt-2 text-3xl">{title}</h2>
      </div>
      {viewAll && (
        <Link
          to={viewAll}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400 hover:text-signal-amber"
        >
          VIEW ALL →
        </Link>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="kicker mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function FilterCount({ label, count, total }: { label: string; count: number; total: number }) {
  return (
    <div className="bg-ink-950 px-4 py-3">
      <p className="kicker">{label}</p>
      <p className="num mt-1 font-mono text-lg text-ink-100">
        {count.toString().padStart(2, "0")}/{total.toString().padStart(2, "0")}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: AgentRecord["status"] }) {
  const tone = status === "active" ? "pill--good" : status === "paused" ? "pill--warn" : "pill--muted";
  return <span className={`pill ${tone}`}>{status}</span>;
}

function Banner({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-signal-red text-signal-red"
      : "border-signal-green text-signal-green";
  return (
    <div className={`mb-6 border ${cls} bg-ink-950 px-4 py-3 font-mono text-xs uppercase tracking-wide`}>
      {children}
    </div>
  );
}

function formatEventName(event: string) {
  return event.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function matchesActivityStatus(activity: ActivityRecord, statusFilter: string) {
  if (statusFilter === "all") return true;
  if (statusFilter.startsWith("activity-scope:")) {
    return activity.scope === statusFilter.slice("activity-scope:".length);
  }
  if (statusFilter.startsWith("activity-event:")) {
    return activity.event === statusFilter.slice("activity-event:".length);
  }
  return false;
}

function matchesCategoryStatus(category: "agent" | "provider" | "run", status: string, statusFilter: string) {
  return statusFilter === "all" || statusFilter === `${category}:${status}`;
}

function isWithinRecency(value: string | undefined, recencyFilter: RecencyFilter) {
  if (recencyFilter === "all") return true;
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  const windowMs = recencyFilter === "24h" ? 24 * 60 * 60 * 1000 : recencyFilter === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return Date.now() - timestamp <= windowMs;
}

// Re-export a no-op DashboardStyles so other pages that imported it continue to compile.
export function DashboardStyles() {
  return null;
}
