import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canEditWorkflowRole, canManageWorkspaceRole } from "@/lib/roles";
import type {
  AgentInputField,
  AgentInputFieldType,
  AgentPlaybookStep,
  AgentRecord,
  AgentRunLogEntry,
  AgentRunRecord,
  AgentStatus,
  AgentTriggerKind,
  AvailableTool,
  ProviderRecord,
  SaveAgentInput,
} from "@/lib/types";
import { relative } from "@/lib/format";
import { describeNextRun, triggerLabel, TRIGGER_KINDS, validateCronSchedule } from "@/lib/agent-runtime";
import PlaybookEditor from "@/components/PlaybookEditor";
import RunTranscript from "@/components/RunTranscript";
import ToolCallTimeline from "@/components/ToolCallTimeline";

type LocationState = { prompt?: string };

const FIELD_TYPES: AgentInputFieldType[] = ["string", "number", "boolean", "url", "enum"];

function statusPillClass(status: AgentRunRecord["status"]) {
  if (status === "success") return "pill pill--good";
  if (status === "failed") return "pill pill--danger";
  if (status === "running") return "pill pill--warn";
  return "pill";
}

function agentStatusPillClass(status: string) {
  if (status === "active") return "pill pill--good";
  if (status === "paused") return "pill pill--warn";
  return "pill pill--muted";
}

function webhookOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export default function AgentEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const isNew = !id;
  const incomingPrompt = (location.state as LocationState | null)?.prompt ?? "";
  const canManageAgent = canManageWorkspaceRole(session?.workspace.role);
  const canRunAgent = canEditWorkflowRole(session?.workspace.role);

  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [playbook, setPlaybook] = useState<AgentPlaybookStep[]>([]);
  const [triggerKind, setTriggerKind] = useState<AgentTriggerKind>("manual");
  const [schedule, setSchedule] = useState("");
  const [inputSchema, setInputSchema] = useState<AgentInputField[]>([]);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [recordingRunId, setRecordingRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [scheduleTouched, setScheduleTouched] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [providerList, detail, tools] = await Promise.all([
          api.listProviders(),
          id ? api.getAgent(id) : Promise.resolve(null),
          api.listTools().catch(() => [] as AvailableTool[]),
        ]);
        if (!mounted) return;
        setProviders(providerList);
        setAvailableTools(tools);
        if (detail) {
          setAgent(detail.agent);
          setRuns(detail.runs);
          setPlaybook(detail.agent.playbook ?? []);
          setTriggerKind(detail.agent.triggerKind ?? "manual");
          setSchedule(detail.agent.schedule ?? "");
          setExpandedRun(detail.runs[0]?.id ?? null);
          setInputSchema(detail.agent.inputSchema ?? []);
          setEnabledTools(detail.agent.enabledTools ?? []);
          setRunInputs(seedRunInputs(detail.agent.inputSchema ?? []));
        }
      } catch (loadError) {
        if (mounted) setError((loadError as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
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
  const scheduleValidation = triggerKind === "schedule" ? validateCronSchedule(schedule) : null;
  const showScheduleValidation = triggerKind === "schedule" && scheduleValidation && scheduleTouched;

  const saveAgent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageAgent) {
      setError("admin role is required to save agents");
      setMessage(null);
      return;
    }
    const invalidEnum = inputSchema.find((field) => field.type === "enum" && (field.options ?? []).length === 0);
    if (invalidEnum) {
      setError(`enum input ${invalidEnum.key || invalidEnum.label} needs at least one option`);
      setMessage(null);
      return;
    }
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
      inputSchema,
      enabledTools,
    };

    if (scheduleValidation) {
      setScheduleTouched(true);
      setError(scheduleValidation);
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextAgent = isNew ? await api.createAgent(body) : await api.updateAgent(id!, body);
      setAgent(nextAgent);
      setPlaybook(nextAgent.playbook ?? []);
      setTriggerKind(nextAgent.triggerKind ?? "manual");
      setSchedule(nextAgent.schedule ?? "");
      setInputSchema(nextAgent.inputSchema ?? []);
      setEnabledTools(nextAgent.enabledTools ?? []);
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
    if (!agent || !canManageAgent) return;
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

  const rotateWebhook = async () => {
    if (!agent || !canManageAgent) return;
    setWebhookBusy(true);
    setError(null);
    try {
      const token = await api.rotateAgentWebhook(agent.id);
      setAgent({ ...agent, webhookToken: token, webhookTokenPreview: undefined, hasWebhookToken: true });
      setMessage("Webhook token rotated. Full URL is shown until this page refreshes.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWebhookBusy(false);
    }
  };

  const removeWebhook = async () => {
    if (!agent || !canManageAgent) return;
    setWebhookBusy(true);
    setError(null);
    try {
      await api.removeAgentWebhook(agent.id);
      setAgent({ ...agent, webhookToken: undefined, webhookTokenPreview: undefined, hasWebhookToken: false });
      setMessage("Webhook removed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWebhookBusy(false);
    }
  };

  const recordAsPlaybook = async (runId: string) => {
    if (!canRunAgent) return;
    setRecordingRunId(runId);
    setError(null);
    try {
      const updatedAgent = await api.recordRunAsPlaybook(runId);
      setAgent(updatedAgent);
      setPlaybook(updatedAgent.playbook ?? []);
      setMessage("Run captured as playbook.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecordingRunId(null);
    }
  };

  const run = async () => {
    if (!agent || !canRunAgent) return;
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const inputs = buildRunInputPayload(inputSchema, runInputs);
      const newRun = await api.runAgent(agent.id, { triggerKind: "manual", inputs });
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
    return (
      <div className="page-frame flex items-center gap-3 text-sm text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING AGENT</span>
      </div>
    );
  }

  const webhookPathToken = agent?.webhookToken ?? agent?.webhookTokenPreview;
  const hasWebhook = Boolean(agent?.webhookToken || agent?.webhookTokenPreview || agent?.hasWebhookToken);

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <Link to="/agents" className="kicker hover:text-signal-amber">← AGENTS</Link>
          <div className="kicker mt-2 mb-3">{isNew ? "AGENT · NEW" : `AGENT · ${agent?.id ?? ""}`}</div>
          <h1 className="display-xl">{isNew ? "New agent." : (agent?.name || "Untitled.")}</h1>
          {agent && (
            <p className="mt-4 font-mono text-xs text-ink-400">
              <span className={agentStatusPillClass(agent.status)}>{agent.status}</span>
              <span className="ml-3 text-ink-500">UPDATED {relative(agent.updatedAt).toUpperCase()}</span>
              {agent.templateId && <span className="ml-3 text-ink-500">CLONED FROM {agent.templateId}</span>}
            </p>
          )}
        </div>
        {!isNew && agent && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={run} disabled={!canRunAgent || running || saving}>
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "▶"} Run now
            </button>
            {canManageAgent && (
              <button type="button" className="btn-ghost" onClick={archive} disabled={saving}>
                × Archive
              </button>
            )}
          </div>
        )}
      </header>

      {!canManageAgent && (
        <div className="mb-6 border border-ink-700 bg-ink-950/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
          Admin role required to create, edit, archive, or manage webhooks for agents.
        </div>
      )}

      {error && (
        <div className="mb-6 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          ERR · {error}
        </div>
      )}
      {message && !error && (
        <div className="mb-6 border border-signal-green/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-green">
          OK · {message}
        </div>
      )}

      <div className="grid gap-10 xl:grid-cols-[1fr_360px]">
        <form className="space-y-0" onSubmit={saveAgent}>
          <fieldset className="contents" disabled={!canManageAgent}>
          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">CONFIGURATION</div>
                <h2 className="display text-2xl">Identity & instructions</h2>
              </div>
              <span className="section-marker">§ 01 / 04</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="NAME"><input name="name" defaultValue={defaults.name} className="workflow-input" required /></Field>
              <Field label="STATUS">
                <select name="status" defaultValue={defaults.status} className="workflow-input">
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="DESCRIPTION">
                <input name="description" defaultValue={defaults.description} className="workflow-input" placeholder="What this agent does" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="INSTRUCTIONS · SYSTEM PROMPT">
                <textarea name="instructions" defaultValue={defaults.instructions} rows={6} className="workflow-input resize-none" required />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="PROVIDER">
                <select name="providerId" defaultValue={defaults.providerId} className="workflow-input">
                  <option value="">— no provider yet —</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="MODEL"><input name="model" defaultValue={defaults.model} className="workflow-input" placeholder="gpt-4.1-mini" /></Field>
            </div>
            <div className="mt-4">
              <Field label="TOOLS / INTEGRATIONS">
                <input name="tools" defaultValue={defaults.tools?.join(", ")} className="workflow-input" placeholder="gmail, slack, github" />
              </Field>
            </div>
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">TRIGGER</div>
                <h2 className="display text-2xl">Invocation rules</h2>
                <p className="mt-2 max-w-md font-mono text-xs text-ink-500">
                  How this agent gets invoked. Manual always works; schedules drive the next-run estimate.
                </p>
              </div>
              <span className="section-marker">§ 02 / 04</span>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {TRIGGER_KINDS.map((kind) => (
                <button
                  type="button"
                  key={kind}
                  className={triggerKind === kind ? "btn-primary" : "btn-ghost"}
                  onClick={() => setTriggerKind(kind)}
                >
                  {triggerLabel(kind)}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={triggerKind === "schedule" ? "CRON SCHEDULE *" : "CRON SCHEDULE · OPTIONAL"}>
                <input
                  name="schedule"
                  className="workflow-input"
                  value={schedule}
                  onBlur={() => setScheduleTouched(true)}
                  onChange={(event) => {
                    setSchedule(event.target.value);
                    setScheduleTouched(true);
                  }}
                  placeholder="0 8 * * 1-5"
                  required={triggerKind === "schedule"}
                  aria-invalid={Boolean(showScheduleValidation)}
                />
                <p className="mt-2 font-mono text-[10px] leading-4 text-ink-500">
                  Five-field cron in workspace time. Examples: <span className="text-ink-300">0 8 * * 1-5</span> weekdays at 08:00, <span className="text-ink-300">*/30 * * * *</span> every 30 minutes, <span className="text-ink-300">15 14 * * *</span> daily at 14:15.
                </p>
                {showScheduleValidation && (
                  <p className="mt-2 font-mono text-[10px] text-signal-red">ERR · {scheduleValidation}</p>
                )}
              </Field>
              <div>
                <div className="kicker mb-1.5">{triggerKind === "schedule" ? "NEXT RUN" : "TRIGGER MODE"}</div>
                <div className="border border-ink-700 bg-ink-950/60 px-3 py-2 font-mono text-xs text-ink-300">
                  {nextRunLabel}
                </div>
              </div>
            </div>
            {!isNew && agent && (
              <div className="mt-5 border-t border-ink-700 pt-4">
                <div className="kicker mb-2">WEBHOOK TRIGGER</div>
                {hasWebhook ? (
                  <div className="grid gap-2">
                    <div className="break-all border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-[11px] text-ink-200">
                      POST {webhookOrigin()}/api/public/webhooks/agents/{webhookPathToken ?? "[redacted]"}
                    </div>
                    <p className="font-mono text-[10px] text-ink-500">
                      Body is forwarded as the run's `inputs`. Trigger kind = webhook. Full token is only shown immediately after rotation.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost" onClick={rotateWebhook} disabled={webhookBusy}>↺ Rotate token</button>
                      <button type="button" className="btn-ghost" onClick={removeWebhook} disabled={webhookBusy}>× Remove</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost" onClick={rotateWebhook} disabled={webhookBusy}>+ Generate webhook URL</button>
                )}
              </div>
            )}
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">PLAYBOOK · {playbook.length} STEP{playbook.length === 1 ? "" : "S"}</div>
                <h2 className="display text-2xl">Ordered steps</h2>
              </div>
              <span className="section-marker">§ 03 / 05</span>
            </div>
            <PlaybookEditor steps={playbook} onChange={setPlaybook} />
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">TOOLS · {enabledTools.length} ENABLED</div>
                <h2 className="display text-2xl">Available tool registry</h2>
                <p className="mt-2 max-w-md font-mono text-xs text-ink-500">
                  Enabling any tool runs the agent through the tool-use loop on save. Otherwise the
                  deterministic stub run records a transcript without calling a model.
                </p>
              </div>
              <span className="section-marker">§ 04 / 05</span>
            </div>
            <ToolPicker tools={availableTools} enabled={enabledTools} onChange={setEnabledTools} />
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">INPUT SCHEMA</div>
                <h2 className="display text-2xl">Typed parameters</h2>
                <p className="mt-2 max-w-md font-mono text-xs text-ink-500">
                  Validated server-side. Coerced into typed inputs on every run.
                </p>
              </div>
              <span className="section-marker">§ 05 / 05</span>
            </div>
            <InputSchemaEditor schema={inputSchema} onChange={setInputSchema} />
          </section>

          <div className="mt-8 flex justify-end border-t border-ink-700 pt-6">
            <button type="submit" className="btn-primary" disabled={!canManageAgent || saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "✓"} {isNew ? "Create agent" : "Save agent"}
            </button>
          </div>
          </fieldset>
        </form>

        <aside className="space-y-8">
          {!isNew && agent && (
            <section>
              <div className="kicker mb-3">RUN WITH INPUTS</div>
              {inputSchema.length === 0 ? (
                <p className="border border-dashed border-ink-700 px-3 py-4 font-mono text-xs text-ink-500">
                  — NO INPUTS DEFINED —
                </p>
              ) : (
                <div className="space-y-3">
                  {inputSchema.map((f) => (
                    <RunInputControl
                      key={f.key}
                      field={f}
                      value={runInputs[f.key] ?? ""}
                      onChange={(next) => setRunInputs((prev) => ({ ...prev, [f.key]: next }))}
                    />
                  ))}
                </div>
              )}
              <button type="button" className="btn-primary mt-4 w-full justify-center" onClick={run} disabled={!canRunAgent || running || saving}>
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "▶"} {canRunAgent ? "Execute" : "Member role required"}
              </button>
            </section>
          )}

          <section>
            <div className="kicker mb-3">RECENT RUNS</div>
            {runs.length === 0 ? (
              <p className="border border-dashed border-ink-700 px-3 py-4 font-mono text-xs text-ink-500">
                — NO RUNS RECORDED —
              </p>
            ) : (
              <ol>
                {runs.map((runRecord) => {
                  const expanded = expandedRun === runRecord.id;
                  return (
                    <li key={runRecord.id} className="border-t border-ink-700 py-3 first:border-t-0">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 text-left"
                        onClick={() => setExpandedRun(expanded ? null : runRecord.id)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={statusPillClass(runRecord.status)}>{runRecord.status}</span>
                            <span className="truncate font-serif text-sm text-ink-100">{runRecord.title}</span>
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-ink-500">
                            {relative(runRecord.createdAt).toUpperCase()} · {triggerLabel(runRecord.triggerKind).toUpperCase()}
                          </div>
                          {runRecord.inputs && Object.keys(runRecord.inputs).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px] text-ink-400">
                              {Object.entries(runRecord.inputs).map(([key, val]) => (
                                <span key={key}>
                                  <span className="text-ink-500">{key}:</span> {String(val)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-xs text-ink-500">{expanded ? "[ − ]" : "[ + ]"}</span>
                      </button>
                      {runRecord.error && (
                        <div className="mt-2 font-mono text-xs text-signal-red">ERR · {runRecord.error}</div>
                      )}
                      {expanded && (
                        <div className="mt-3 space-y-3 border-t border-ink-800 pt-3">
                          <RunTranscript steps={runRecord.transcript} />
                          {runRecord.toolCalls && runRecord.toolCalls.length > 0 && (
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <div className="kicker">TOOL CALLS · {runRecord.toolCalls.length}</div>
                                <button
                                  type="button"
                                  className="font-mono text-[10px] uppercase tracking-wider text-ink-400 hover:text-signal-amber"
                                  onClick={() => recordAsPlaybook(runRecord.id)}
                                  disabled={!canRunAgent || recordingRunId === runRecord.id}
                                >
                                  {recordingRunId === runRecord.id ? "RECORDING…" : "▣ RECORD AS PLAYBOOK"}
                                </button>
                              </div>
                              <ToolCallTimeline calls={runRecord.toolCalls} />
                            </div>
                          )}
                          {runRecord.output && (
                            <pre className="border border-ink-700 bg-ink-950 p-3 font-mono text-xs leading-5 text-ink-200 whitespace-pre-wrap">{runRecord.output}</pre>
                          )}
                          {runRecord.logs && runRecord.logs.length > 0 && <RunLogTimeline logs={runRecord.logs} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ToolPicker({ tools, enabled, onChange }: { tools: AvailableTool[]; enabled: string[]; onChange: (next: string[]) => void }) {
  const enabledSet = new Set(enabled);
  if (tools.length === 0) {
    return (
      <div className="border border-dashed border-ink-700 px-4 py-6 text-center">
        <div className="kicker mb-1.5">TOOL REGISTRY EMPTY</div>
        <p className="font-mono text-xs text-ink-500">No tools registered on the server.</p>
      </div>
    );
  }
  const groups = { read: [] as AvailableTool[], write: [] as AvailableTool[], exec: [] as AvailableTool[] };
  for (const t of tools) groups[t.side].push(t);
  const toggle = (name: string) => {
    if (enabledSet.has(name)) onChange(enabled.filter((n) => n !== name));
    else onChange([...enabled, name]);
  };
  return (
    <div className="grid gap-px bg-ink-700 md:grid-cols-3">
      {(["read", "write", "exec"] as const).map((side) => (
        <div key={side} className="bg-ink-875 p-4">
          <div className="kicker-amber mb-3">{side.toUpperCase()} · {groups[side].length}</div>
          {groups[side].length === 0 ? (
            <p className="font-mono text-xs text-ink-500">— none —</p>
          ) : (
            <ul>
              {groups[side].map((t) => (
                <li key={t.name} className="border-t border-ink-700 py-2 first:border-t-0">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-3.5 w-3.5 accent-signal-amber"
                      checked={enabledSet.has(t.name)}
                      onChange={() => toggle(t.name)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs text-ink-100">{t.name}</span>
                      <span className="mt-0.5 block text-[11px] leading-5 text-ink-400">{t.description}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function InputSchemaEditor({ schema, onChange }: { schema: AgentInputField[]; onChange: (next: AgentInputField[]) => void }) {
  const update = (index: number, patch: Partial<AgentInputField>) => {
    onChange(schema.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const remove = (index: number) => onChange(schema.filter((_, i) => i !== index));

  const add = () => {
    onChange([...schema, { key: `field_${schema.length + 1}`, label: `Field ${schema.length + 1}`, type: "string", required: false }]);
  };

  return (
    <div>
      {schema.length === 0 ? (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center">
          <div className="kicker mb-1.5">EMPTY SCHEMA</div>
          <p className="font-mono text-xs text-ink-500">Add a field to capture per-run parameters.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Label</th>
              <th>Type</th>
              <th>Required</th>
              <th>Options</th>
              <th>Default</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schema.map((f, index) => (
              <tr key={index}>
                <td>
                  <input
                    className="workflow-input font-mono text-[11px]"
                    placeholder="key"
                    value={f.key}
                    onChange={(event) => update(index, { key: event.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                  />
                </td>
                <td>
                  <input
                    className="workflow-input"
                    placeholder="Label"
                    value={f.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="workflow-input font-mono text-[11px]"
                    value={f.type}
                    onChange={(event) => {
                      const type = event.target.value as AgentInputFieldType;
                      update(index, {
                        type,
                        options: type === "enum" ? (f.options && f.options.length > 0 ? f.options : ["option_a"]) : undefined,
                      });
                    }}
                  >
                    {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-signal-amber"
                    checked={f.required}
                    onChange={(event) => update(index, { required: event.target.checked })}
                  />
                </td>
                <td>
                  {f.type === "enum" ? (
                    <textarea
                      className="workflow-input min-w-40 resize-none font-mono text-[11px]"
                      rows={2}
                      placeholder="one option per line"
                      value={(f.options ?? []).join("\n")}
                      onChange={(event) => update(index, { options: lines(event.target.value) })}
                    />
                  ) : (
                    <span className="font-mono text-[11px] text-ink-600">—</span>
                  )}
                </td>
                <td>
                  <input
                    className="workflow-input"
                    placeholder="—"
                    value={f.defaultValue ?? ""}
                    onChange={(event) => update(index, { defaultValue: event.target.value })}
                  />
                </td>
                <td>
                  <button type="button" className="font-mono text-xs text-ink-500 hover:text-signal-red" onClick={() => remove(index)}>
                    × DEL
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4">
        <button type="button" className="btn-ghost" onClick={add}>+ Add field</button>
      </div>
    </div>
  );
}

function RunInputControl({ field: f, value, onChange }: { field: AgentInputField; value: string; onChange: (next: string) => void }) {
  if (f.type === "enum") {
    return (
      <Field label={`${f.label.toUpperCase()}${f.required ? " *" : ""}`}>
        <select className="workflow-input" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">— select —</option>
          {(f.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
    );
  }
  if (f.type === "boolean") {
    return (
      <label className="flex items-center gap-2 font-mono text-xs text-ink-200">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-signal-amber"
          checked={value === "true"}
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        />
        {f.label.toUpperCase()}
      </label>
    );
  }
  return (
    <Field label={`${f.label.toUpperCase()}${f.required ? " *" : ""}`}>
      <input
        className="workflow-input"
        type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={f.description}
      />
    </Field>
  );
}

function RunLogTimeline({ logs }: { logs: AgentRunLogEntry[] }) {
  return (
    <ol className="border-l border-ink-700 pl-3">
      {logs.map((entry, index) => (
        <li key={index} className="font-mono text-xs">
          <span className={logLevelClass(entry.level)}>{entry.level.toUpperCase()}</span>
          <span className="ml-2 text-ink-300">{entry.message}</span>
        </li>
      ))}
    </ol>
  );
}

function logLevelClass(level: AgentRunLogEntry["level"]) {
  if (level === "error") return "text-signal-red font-semibold";
  if (level === "warn") return "text-signal-amber font-semibold";
  return "text-ink-500 font-semibold";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kicker mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function lines(value: string) {
  return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
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
