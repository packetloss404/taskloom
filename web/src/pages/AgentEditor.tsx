import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Archive, Bot, CalendarClock, ChevronDown, ChevronRight, Loader2, Play, Save, Zap } from "lucide-react";
import { api } from "@/lib/api";
import type { AgentPlaybookStep, AgentRecord, AgentRunRecord, AgentStatus, AgentTriggerKind, ProviderRecord, SaveAgentInput } from "@/lib/types";
import { relative } from "@/lib/format";
import { describeNextRun, triggerLabel, triggerToneClass, TRIGGER_KINDS } from "@/lib/agent-runtime";
import PlaybookEditor from "@/components/PlaybookEditor";
import RunTranscript from "@/components/RunTranscript";
import { DashboardStyles } from "./Dashboard";

type LocationState = { prompt?: string };

export default function AgentEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id;
  const incomingPrompt = (location.state as LocationState | null)?.prompt ?? "";

  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [playbook, setPlaybook] = useState<AgentPlaybookStep[]>([]);
  const [triggerKind, setTriggerKind] = useState<AgentTriggerKind>("manual");
  const [schedule, setSchedule] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [providerList, detail] = await Promise.all([
          api.listProviders(),
          id ? api.getAgent(id) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        setProviders(providerList);
        if (detail) {
          setAgent(detail.agent);
          setRuns(detail.runs);
          setPlaybook(detail.agent.playbook ?? []);
          setTriggerKind(detail.agent.triggerKind ?? "manual");
          setSchedule(detail.agent.schedule ?? "");
          setExpandedRun(detail.runs[0]?.id ?? null);
        }
      } catch (loadError) {
        if (mounted) setError((loadError as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const defaults = useMemo<SaveAgentInput>(() => ({
    name: agent?.name ?? "",
    description: agent?.description ?? "",
    instructions: agent?.instructions ?? incomingPrompt,
    providerId: agent?.providerId ?? providers[0]?.id ?? "",
    model: agent?.model ?? providers[0]?.defaultModel ?? "",
    tools: agent?.tools ?? [],
    schedule: agent?.schedule ?? "",
    triggerKind: agent?.triggerKind ?? "manual",
    playbook: agent?.playbook ?? [],
    status: agent?.status ?? "active",
  }), [agent, incomingPrompt, providers]);

  const nextRunLabel = useMemo(() => describeNextRun(schedule, triggerKind), [schedule, triggerKind]);

  const saveAgent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: SaveAgentInput = {
      name: field(form, "name"),
      description: field(form, "description"),
      instructions: field(form, "instructions"),
      providerId: field(form, "providerId") || undefined,
      model: field(form, "model") || undefined,
      tools: field(form, "tools").split(",").map((tool) => tool.trim()).filter(Boolean),
      schedule: field(form, "schedule") || undefined,
      triggerKind,
      playbook: playbook.filter((step) => step.title.trim().length > 0),
      status: field(form, "status") as AgentStatus,
    };

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextAgent = isNew ? await api.createAgent(body) : await api.updateAgent(id!, body);
      setAgent(nextAgent);
      setPlaybook(nextAgent.playbook ?? []);
      setTriggerKind(nextAgent.triggerKind ?? "manual");
      setSchedule(nextAgent.schedule ?? "");
      setMessage(isNew ? "Agent created." : "Agent saved.");
      if (isNew) navigate(`/agents/${nextAgent.id}`, { replace: true });
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      await api.archiveAgent(agent.id);
      navigate("/agents", { replace: true });
    } catch (archiveError) {
      setError((archiveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (!agent) return;
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const newRun = await api.runAgent(agent.id, { triggerKind: "manual" });
      const detail = await api.getAgent(agent.id);
      setRuns(detail.runs);
      setExpandedRun(newRun.id);
      setMessage("Agent run recorded.");
    } catch (runError) {
      setError((runError as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading agent...</div>;
  }

  return (
    <>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/agents" className="text-sm text-ink-400 hover:text-ink-100">Agents</Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-100">{isNew ? "New Agent" : agent?.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
            Configure instructions, the playbook the agent runs, its trigger, and its provider. Saves persist to the backend.
          </p>
        </div>
        {!isNew && agent && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={run} disabled={running || saving}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run now
            </button>
            <button type="button" className="btn-ghost border-rose-500/30 text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/10" onClick={archive} disabled={saving}>
              <Archive className="h-4 w-4" /> Archive
            </button>
          </div>
        )}
      </header>

      {error && <Status tone="error">{error}</Status>}
      {message && !error && <Status tone="success">{message}</Status>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <form className="space-y-6" onSubmit={saveAgent}>
          <section className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name"><input name="name" defaultValue={defaults.name} className="dashboard-input" required /></Field>
              <Field label="Status">
                <select name="status" defaultValue={defaults.status} className="dashboard-input">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Description"><input name="description" defaultValue={defaults.description} className="dashboard-input" placeholder="What this agent does" /></Field>
            </div>

            <div className="mt-4">
              <Field label="Instructions / system prompt">
                <textarea name="instructions" defaultValue={defaults.instructions} rows={6} className="dashboard-input resize-none" required />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Provider">
                <select name="providerId" defaultValue={defaults.providerId} className="dashboard-input">
                  <option value="">No provider yet</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Model"><input name="model" defaultValue={defaults.model} className="dashboard-input" placeholder="gpt-4.1-mini" /></Field>
            </div>

            <div className="mt-4">
              <Field label="Tools / integrations"><input name="tools" defaultValue={defaults.tools?.join(", ")} className="dashboard-input" placeholder="gmail, slack, github" /></Field>
            </div>
          </section>

          <section className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink-850 text-ink-300"><Zap className="h-4 w-4" /></div>
              <div>
                <h2 className="text-sm font-semibold text-ink-100">Trigger</h2>
                <p className="text-xs text-ink-500">How this agent gets invoked. Manual triggers always work; schedules drive the next-run estimate.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Trigger kind">
                <select
                  className="dashboard-input"
                  value={triggerKind}
                  onChange={(event) => setTriggerKind(event.target.value as AgentTriggerKind)}
                >
                  {TRIGGER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>{triggerLabel(kind)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Cron schedule">
                <input
                  name="schedule"
                  className="dashboard-input"
                  value={schedule}
                  onChange={(event) => setSchedule(event.target.value)}
                  placeholder="0 8 * * 1-5"
                />
              </Field>
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-950/40 px-3 py-1 text-xs text-ink-300">
              <CalendarClock className="h-3.5 w-3.5" /> {nextRunLabel}
            </div>
          </section>

          <section className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink-100">Playbook</h2>
                <p className="text-xs text-ink-500">Ordered steps the agent walks through. Each run captures one transcript entry per step.</p>
              </div>
              <span className="rounded-full border border-ink-700 bg-ink-950/40 px-2.5 py-1 text-xs text-ink-300">
                {playbook.length} step{playbook.length === 1 ? "" : "s"}
              </span>
            </div>

            <PlaybookEditor steps={playbook} onChange={setPlaybook} />
          </section>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary bg-ink-100 text-ink-950 hover:bg-white" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isNew ? "Create Agent" : "Save Agent"}
            </button>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-850 text-ink-300"><Bot className="h-5 w-5" /></div>
              <div>
                <h2 className="text-sm font-semibold text-ink-100">Backend state</h2>
                <p className="mt-1 text-xs text-ink-500">{agent ? `Updated ${relative(agent.updatedAt)}` : "New unsaved agent"}</p>
              </div>
            </div>
            {agent && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 capitalize ${triggerToneClass(agent.triggerKind)}`}>
                  {triggerLabel(agent.triggerKind)}
                </span>
                <span className="rounded-full border border-ink-700 bg-ink-950/40 px-2.5 py-1 text-ink-300">
                  {(agent.playbook?.length ?? 0)} playbook step{(agent.playbook?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Recent runs</h2>
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-700 p-5 text-sm text-ink-500">No runs recorded for this agent.</div>
            ) : (
              <div className="space-y-3">
                {runs.map((runRecord) => {
                  const expanded = expandedRun === runRecord.id;
                  return (
                    <div key={runRecord.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 text-left"
                        onClick={() => setExpandedRun(expanded ? null : runRecord.id)}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink-100">{runRecord.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                            <span>{runRecord.status}</span>
                            <span>· {relative(runRecord.createdAt)}</span>
                            <span className={`rounded-full border px-2 py-0.5 capitalize ${triggerToneClass(runRecord.triggerKind)}`}>
                              {triggerLabel(runRecord.triggerKind)}
                            </span>
                          </div>
                        </div>
                        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />}
                      </button>
                      {runRecord.error && <div className="mt-2 text-xs text-rose-300">{runRecord.error}</div>}
                      {expanded && (
                        <div className="mt-3 border-t border-ink-800/60 pt-3">
                          <RunTranscript steps={runRecord.transcript} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>

      <DashboardStyles />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink-200">{label}</span>{children}</label>;
}

function Status({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const classes = tone === "error"
    ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
    : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  return <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
