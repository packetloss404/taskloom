import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { relative } from "@/lib/format";
import { canManageWorkspaceRole } from "@/lib/roles";
import type { AgentRecord, AgentTemplate } from "@/lib/types";
import { describeNextRun, triggerLabel } from "@/lib/agent-runtime";

function statusPillClass(status: string): string {
  if (status === "active") return "pill pill--good";
  if (status === "paused") return "pill pill--warn";
  if (status === "archived" || status === "draft") return "pill pill--muted";
  return "pill";
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canManageAgents = canManageWorkspaceRole(session?.workspace.role);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    return Promise.all([api.listAgents(), api.listAgentTemplates()])
      .then(([nextAgents, nextTemplates]) => {
        setAgents(nextAgents);
        setTemplates(nextTemplates);
      })
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void reload();
  }, []);

  const createFromTemplate = async (template: AgentTemplate) => {
    if (!canManageAgents) return;
    setCreatingTemplateId(template.id);
    setError(null);
    try {
      const agent = await api.createAgentFromTemplate(template.id);
      navigate(`/agents/${agent.id}`);
    } catch (createError) {
      setError((createError as Error).message);
    } finally {
      setCreatingTemplateId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) =>
      [agent.name, agent.description, agent.instructions, agent.provider?.name, agent.model, agent.schedule]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [agents, query]);

  const total = agents.length;
  const active = agents.filter((a) => a.status === "active").length;

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <div className="kicker mb-3">AGENTS · WORKSPACE CATALOG</div>
          <h1 className="display-xl">Agents.</h1>
          <p className="mt-4 max-w-xl font-mono text-xs text-ink-400">
            <span className="text-ink-200">{total}</span> registered ·{" "}
            <span className="text-signal-green">{active}</span> active ·{" "}
            <span className="text-ink-500">create, schedule, and run persistent workspace agents.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageAgents ? (
            <Link to="/agents/new" className="btn-primary">+ New agent</Link>
          ) : (
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">Admin role required to create agents</span>
          )}
        </div>
      </header>

      <div className="rule mb-5" />

      <div className="mb-6 flex items-center gap-3">
        <div className="kicker">FILTER</div>
        <input
          className="workflow-input max-w-md"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents by name, model, or description"
        />
      </div>

      {error && (
        <div className="mb-6 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          ERR · {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING AGENTS</span>
        </div>
      ) : (
        <>
          <section className="section-band">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">REGISTERED AGENTS</div>
                <h2 className="display text-2xl">Catalog</h2>
              </div>
              <span className="section-marker">§ 01 / 02</span>
            </div>

            {filtered.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-6 py-12 text-center">
                <div className="kicker mb-3">NO AGENTS</div>
                <p className="font-serif text-2xl text-ink-200">
                  {agents.length === 0 ? "This workspace has no agents yet." : "No matches for that search."}
                </p>
                <p className="mt-3 font-mono text-xs text-ink-500">
                  {agents.length === 0 ? "Start from a template below or create one from scratch." : "Refine the filter or clear it to see all agents."}
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Trigger</th>
                    <th>Model</th>
                    <th>Steps</th>
                    <th>Status</th>
                    <th>Last update</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((agent) => {
                    const stepCount = agent.playbook?.length ?? 0;
                    return (
                      <tr
                        key={agent.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/agents/${agent.id}`)}
                      >
                        <td>
                          <div className="font-serif text-base text-ink-100">{agent.name}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-ink-500">
                            {agent.id} · {agent.description ? agent.description.slice(0, 60) : "no description"}
                          </div>
                        </td>
                        <td>
                          <span className="pill">{triggerLabel(agent.triggerKind)}</span>
                          <div className="mt-1 font-mono text-[10px] text-ink-500">
                            {describeNextRun(agent.schedule, agent.triggerKind)}
                          </div>
                        </td>
                        <td className="font-mono text-[11px] text-ink-300">
                          {agent.provider?.name ?? "—"}
                          {agent.model && <span className="text-ink-500"> · {agent.model}</span>}
                        </td>
                        <td className="num">{stepCount}</td>
                        <td>
                          <span className={statusPillClass(agent.status)}>{agent.status}</span>
                        </td>
                        <td className="font-mono text-[11px] text-ink-400">{relative(agent.updatedAt)}</td>
                        <td className="font-mono text-ink-500">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="section-band">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <div className="kicker-amber mb-2">STARTER TEMPLATES</div>
                <h2 className="display text-2xl">From the catalog</h2>
                <p className="mt-2 max-w-xl font-mono text-xs text-ink-500">
                  Built-in starting points. One click clones the template into a new workspace agent.
                </p>
              </div>
              <span className="section-marker">§ 02 / 02</span>
            </div>
            <div className="grid gap-px bg-ink-700 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <article key={template.id} className="flex flex-col bg-ink-875 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="kicker">{template.category}</div>
                    <span className="font-mono text-[10px] text-ink-500">{template.id}</span>
                  </div>
                  <h3 className="mt-3 font-serif text-xl text-ink-100">{template.name}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-ink-300">{template.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {template.tools.slice(0, 5).map((tool) => (
                      <span key={tool} className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        {tool}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3 font-mono text-[10px] text-ink-500">
                    <span>
                      {template.inputSchema.length > 0 && `${template.inputSchema.length} INPUTS · `}
                      {template.schedule ? `SCHED ${template.schedule}` : "ON DEMAND"}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => void createFromTemplate(template)}
                      disabled={!canManageAgents || creatingTemplateId === template.id}
                    >
                      {creatingTemplateId === template.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "+"
                      )}
                      {canManageAgents ? "Use" : "Admin only"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
