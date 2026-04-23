import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Archive, Bot, Loader2, Play, Save } from "lucide-react";
import { api } from "@/lib/api";
import type { AgentRecord, AgentRunRecord, AgentStatus, ProviderRecord, SaveAgentInput } from "@/lib/types";
import { relative } from "@/lib/format";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    status: agent?.status ?? "active",
  }), [agent, incomingPrompt, providers]);

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
      status: field(form, "status") as AgentStatus,
    };

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextAgent = isNew ? await api.createAgent(body) : await api.updateAgent(id!, body);
      setAgent(nextAgent);
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
      await api.runAgent(agent.id);
      const detail = await api.getAgent(agent.id);
      setRuns(detail.runs);
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
            Configure instructions, provider, model, tools, and cron schedule. Saves persist to the backend.
          </p>
        </div>
        {!isNew && agent && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={run} disabled={running || saving}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run
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
        <form className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5" onSubmit={saveAgent}>
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
              <textarea name="instructions" defaultValue={defaults.instructions} rows={8} className="dashboard-input resize-none" required />
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

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Tools / integrations"><input name="tools" defaultValue={defaults.tools?.join(", ")} className="dashboard-input" placeholder="gmail, slack, github" /></Field>
            <Field label="Cron schedule"><input name="schedule" defaultValue={defaults.schedule} className="dashboard-input" placeholder="0 8 * * 1-5" /></Field>
          </div>

          <div className="mt-5 flex justify-end">
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
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Recent runs</h2>
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-700 p-5 text-sm text-ink-500">No runs recorded for this agent.</div>
            ) : (
              <div className="space-y-3">
                {runs.map((runRecord) => (
                  <div key={runRecord.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-4">
                    <div className="text-sm font-medium text-ink-100">{runRecord.title}</div>
                    <div className="mt-1 text-xs text-ink-500">{runRecord.status} · {relative(runRecord.createdAt)}</div>
                    {runRecord.error && <div className="mt-2 text-xs text-rose-300">{runRecord.error}</div>}
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
