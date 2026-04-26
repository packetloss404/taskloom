import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Archive, Bot, Loader2, Play, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type {
  AgentInputField,
  AgentInputFieldType,
  AgentRecord,
  AgentRunLogEntry,
  AgentRunRecord,
  AgentStatus,
  ProviderRecord,
  SaveAgentInput,
} from "@/lib/types";
import { relative } from "@/lib/format";
import { DashboardStyles } from "./Dashboard";

type LocationState = { prompt?: string };

const FIELD_TYPES: AgentInputFieldType[] = ["string", "number", "boolean", "url", "enum"];

export default function AgentEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id;
  const incomingPrompt = (location.state as LocationState | null)?.prompt ?? "";

  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [inputSchema, setInputSchema] = useState<AgentInputField[]>([]);
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
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
          setInputSchema(detail.agent.inputSchema ?? []);
          setRunInputs(seedRunInputs(detail.agent.inputSchema ?? []));
        } else {
          setInputSchema([]);
          setRunInputs({});
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
      inputSchema,
    };

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextAgent = isNew ? await api.createAgent(body) : await api.updateAgent(id!, body);
      setAgent(nextAgent);
      setInputSchema(nextAgent.inputSchema ?? []);
      setRunInputs(seedRunInputs(nextAgent.inputSchema ?? []));
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
      const inputs = buildRunInputPayload(inputSchema, runInputs);
      await api.runAgent(agent.id, inputs);
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
            Configure instructions, provider, model, tools, schedule, and a typed input schema. Runs validate inputs and capture step logs.
          </p>
        </div>
        {!isNew && agent && (
          <div className="flex flex-wrap gap-2">
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

          <InputSchemaEditor schema={inputSchema} onChange={setInputSchema} />

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
                {agent?.templateId && <p className="mt-1 text-xs text-ink-500">Cloned from template <span className="text-ink-300">{agent.templateId}</span></p>}
              </div>
            </div>
          </section>

          {!isNew && agent && (
            <section className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Run with inputs</h2>
              {inputSchema.length === 0 ? (
                <p className="text-xs text-ink-500">No inputs defined. Add fields above to capture per-run parameters.</p>
              ) : (
                <div className="space-y-3">
                  {inputSchema.map((field) => (
                    <RunInputControl
                      key={field.key}
                      field={field}
                      value={runInputs[field.key] ?? ""}
                      onChange={(next) => setRunInputs((prev) => ({ ...prev, [field.key]: next }))}
                    />
                  ))}
                </div>
              )}
              <button type="button" className="btn-primary mt-4 w-full justify-center bg-ink-100 text-ink-950 hover:bg-white" onClick={run} disabled={running || saving}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run agent
              </button>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Recent runs</h2>
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-700 p-5 text-sm text-ink-500">No runs recorded for this agent.</div>
            ) : (
              <div className="space-y-3">
                {runs.map((runRecord) => (
                  <RunCard key={runRecord.id} run={runRecord} />
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

function InputSchemaEditor({ schema, onChange }: { schema: AgentInputField[]; onChange: (next: AgentInputField[]) => void }) {
  const update = (index: number, patch: Partial<AgentInputField>) => {
    onChange(schema.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const remove = (index: number) => {
    onChange(schema.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([
      ...schema,
      { key: `field_${schema.length + 1}`, label: `Field ${schema.length + 1}`, type: "string", required: false },
    ]);
  };

  return (
    <div className="mt-6 rounded-2xl border border-ink-800 bg-ink-950/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-100">Input schema</h3>
          <p className="mt-1 text-xs text-ink-500">Typed parameters captured on every run. Validated server-side.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={add}>
          <Plus className="h-4 w-4" /> Add field
        </button>
      </div>

      {schema.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-700 p-4 text-xs text-ink-500">No input fields. Add one to capture per-run parameters.</div>
      ) : (
        <div className="space-y-3">
          {schema.map((field, index) => (
            <div key={index} className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]">
                <input
                  className="dashboard-input"
                  placeholder="key"
                  value={field.key}
                  onChange={(event) => update(index, { key: event.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                />
                <input
                  className="dashboard-input"
                  placeholder="Label"
                  value={field.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                />
                <select
                  className="dashboard-input"
                  value={field.type}
                  onChange={(event) => update(index, { type: event.target.value as AgentInputFieldType })}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button type="button" className="btn-ghost" onClick={() => remove(index)} aria-label="Remove field">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className="dashboard-input"
                  placeholder="Description (optional)"
                  value={field.description ?? ""}
                  onChange={(event) => update(index, { description: event.target.value })}
                />
                <input
                  className="dashboard-input"
                  placeholder="Default value (optional)"
                  value={field.defaultValue ?? ""}
                  onChange={(event) => update(index, { defaultValue: event.target.value })}
                />
                <label className="flex items-center gap-2 text-xs text-ink-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-700 bg-ink-950"
                    checked={field.required}
                    onChange={(event) => update(index, { required: event.target.checked })}
                  />
                  Required
                </label>
              </div>
              {field.type === "enum" && (
                <input
                  className="dashboard-input mt-2"
                  placeholder="Comma-separated options (e.g. low, medium, high)"
                  value={(field.options ?? []).join(", ")}
                  onChange={(event) => update(index, { options: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean) })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunInputControl({ field, value, onChange }: { field: AgentInputField; value: string; onChange: (next: string) => void }) {
  if (field.type === "enum") {
    return (
      <Field label={`${field.label}${field.required ? " *" : ""}`}>
        <select className="dashboard-input" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </Field>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-ink-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-ink-700 bg-ink-950"
          checked={value === "true"}
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        />
        {field.label}
      </label>
    );
  }
  return (
    <Field label={`${field.label}${field.required ? " *" : ""}`}>
      <input
        className="dashboard-input"
        type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.description}
      />
    </Field>
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

function seedRunInputs(schema: AgentInputField[]): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of schema) {
    if (f.defaultValue !== undefined) next[f.key] = f.defaultValue;
    else if (f.type === "boolean") next[f.key] = "false";
    else next[f.key] = "";
  }
  return next;
}

function buildRunInputPayload(schema: AgentInputField[], values: Record<string, string>): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  for (const f of schema) {
    const raw = values[f.key];
    if (raw === undefined || raw === "") continue;
    if (f.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) payload[f.key] = n;
    } else if (f.type === "boolean") {
      payload[f.key] = raw === "true";
    } else {
      payload[f.key] = raw;
    }
  }
  return payload;
}
