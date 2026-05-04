import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { I, type IconKey } from "../icons";
import { Topbar } from "../Shell";
import { useWorkbench } from "../WorkbenchContext";
import { api } from "@/lib/api";
import { describeNextRun, triggerLabel, TRIGGER_KINDS, validateCronSchedule, formatDuration } from "@/lib/agent-runtime";
import { canEditWorkflowRole, canManageWorkspaceRole } from "@/lib/roles";
import type {
  AgentInputField,
  AgentInputFieldType,
  AgentPlaybookStep,
  AgentRecord,
  AgentRunRecord,
  AgentRunStep,
  AgentRunStepStatus,
  AgentRunToolCall,
  AgentStatus,
  AgentTriggerKind,
  AvailableTool,
  ProviderRecord,
  SaveAgentInput,
} from "@/lib/types";

const FIELD_TYPES: AgentInputFieldType[] = ["string", "number", "boolean", "url", "enum"];

function webhookOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function AgentEditorView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useWorkbench().session.workspace.role;
  const isNew = !id;
  const canManageAgent = canManageWorkspaceRole(role);
  const canRunAgent = canEditWorkflowRole(role);

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
    instructions: agent?.instructions ?? "",
    providerId: agent?.providerId ?? providers[0]?.id ?? "",
    model: agent?.model ?? providers[0]?.defaultModel ?? "",
    tools: agent?.tools ?? [],
    schedule: agent?.schedule ?? "",
    triggerKind: agent?.triggerKind ?? "manual",
    playbook: agent?.playbook ?? [],
    status: agent?.status ?? "active",
  }), [agent, providers]);

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
    const invalidEnum = inputSchema.find((f) => f.type === "enum" && (f.options ?? []).length === 0);
    if (invalidEnum) {
      setError(`enum input ${invalidEnum.key || invalidEnum.label} needs at least one option`);
      setMessage(null);
      return;
    }
    const form = new FormData(event.currentTarget);
    const body: SaveAgentInput = {
      name: fieldValue(form, "name"),
      description: fieldValue(form, "description"),
      instructions: fieldValue(form, "instructions"),
      providerId: fieldValue(form, "providerId") || undefined,
      model: fieldValue(form, "model") || undefined,
      tools: fieldValue(form, "tools").split(",").map((t) => t.trim()).filter(Boolean),
      schedule: fieldValue(form, "schedule") || undefined,
      triggerKind,
      playbook: playbook.filter((s) => s.title.trim().length > 0),
      status: fieldValue(form, "status") as AgentStatus,
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
    } catch (e) {
      setError((e as Error).message);
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
      const updated = await api.recordRunAsPlaybook(runId);
      setAgent(updated);
      setPlaybook(updated.playbook ?? []);
      setMessage("Run captured as playbook.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecordingRunId(null);
    }
  };

  const runNow = async () => {
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const webhookPathToken = agent?.webhookToken ?? agent?.webhookTokenPreview;
  const hasWebhook = Boolean(agent?.webhookToken || agent?.webhookTokenPreview || agent?.hasWebhookToken);

  return (
    <>
      <Topbar
        crumbs={["__WS__", "Agents", isNew ? "New" : agent?.name ?? "Edit"]}
        actions={
          !isNew && agent ? (
            <>
              <button className="top-btn" onClick={() => { void runNow(); }} disabled={!canRunAgent || running || saving}>
                {running ? <span className="spin"><I.refresh size={13}/></span> : <I.play size={13}/>} Run now
              </button>
              {canManageAgent && (
                <button className="top-btn" onClick={() => { void archive(); }} disabled={saving}>
                  <I.trash size={13}/> Archive
                </button>
              )}
            </>
          ) : null
        }
      />

      <div style={{ padding: "26px 28px 60px", maxWidth: 1280 }}>
        {loading && <div className="muted" style={{ padding: 16 }}>Loading agent…</div>}

        {!loading && !canManageAgent && (
          <div className="card" style={{ padding: "10px 14px", marginBottom: 14, borderColor: "var(--line-2)" }}>
            <span className="mono muted" style={{ fontSize: 11 }}>Admin role required to create, edit, archive, or manage webhooks for agents.</span>
          </div>
        )}

        {error && (
          <div className="card" style={{ padding: "10px 14px", marginBottom: 14, borderColor: "rgba(242,107,92,0.3)", background: "rgba(242,107,92,0.06)", color: "var(--danger)" }}>
            <span className="mono" style={{ fontSize: 11.5 }}>ERR · {error}</span>
          </div>
        )}
        {message && !error && (
          <div className="card" style={{ padding: "10px 14px", marginBottom: 14, borderColor: "rgba(184,242,92,0.3)", background: "rgba(184,242,92,0.06)", color: "var(--green)" }}>
            <span className="mono" style={{ fontSize: 11.5 }}>OK · {message}</span>
          </div>
        )}

        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
            <form onSubmit={saveAgent}>
              <fieldset disabled={!canManageAgent} style={{ border: 0, padding: 0, margin: 0 }}>
                <Section number="01 / 05" kicker="CONFIGURATION" title="Identity & instructions">
                  <Row>
                    <Field label="Name"><input name="name" defaultValue={defaults.name} className="field" required/></Field>
                    <Field label="Status">
                      <select name="status" defaultValue={defaults.status} className="field">
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                      </select>
                    </Field>
                  </Row>
                  <Field label="Description">
                    <input name="description" defaultValue={defaults.description} className="field" placeholder="What this agent does"/>
                  </Field>
                  <Field label="Instructions · system prompt">
                    <textarea name="instructions" defaultValue={defaults.instructions} rows={6} className="field" required/>
                  </Field>
                  <Row>
                    <Field label="Provider">
                      <select name="providerId" defaultValue={defaults.providerId} className="field">
                        <option value="">— no provider yet —</option>
                        {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Model"><input name="model" defaultValue={defaults.model} className="field" placeholder="gpt-4.1-mini"/></Field>
                  </Row>
                  <Field label="Tools / integrations · comma-separated tags">
                    <input name="tools" defaultValue={defaults.tools?.join(", ")} className="field" placeholder="gmail, slack, github"/>
                  </Field>
                </Section>

                <Section number="02 / 05" kicker="TRIGGER" title="Invocation rules" sub="How this agent gets invoked. Manual always works; schedules drive the next-run estimate.">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {TRIGGER_KINDS.map((kind) => {
                      const active = triggerKind === kind;
                      return (
                        <button
                          type="button"
                          key={kind}
                          onClick={() => setTriggerKind(kind)}
                          className={active ? "btn-primary btn btn-sm" : "btn btn-sm"}
                        >
                          {triggerLabel(kind)}
                        </button>
                      );
                    })}
                  </div>
                  <Row>
                    <Field label={triggerKind === "schedule" ? "Cron schedule *" : "Cron schedule · optional"}>
                      <input
                        name="schedule"
                        className="field mono"
                        value={schedule}
                        onBlur={() => setScheduleTouched(true)}
                        onChange={(e) => { setSchedule(e.target.value); setScheduleTouched(true); }}
                        placeholder="0 8 * * 1-5"
                        required={triggerKind === "schedule"}
                      />
                      <p className="mono muted" style={{ fontSize: 10, marginTop: 6 }}>
                        Five-field cron in workspace time. Examples: <span style={{ color: "var(--silver-200)" }}>0 8 * * 1-5</span> weekdays at 08:00, <span style={{ color: "var(--silver-200)" }}>*/30 * * * *</span> every 30m.
                      </p>
                      {showScheduleValidation && (
                        <p className="mono" style={{ fontSize: 10.5, marginTop: 4, color: "var(--danger)" }}>ERR · {scheduleValidation}</p>
                      )}
                    </Field>
                    <Field label={triggerKind === "schedule" ? "Next run" : "Trigger mode"}>
                      <div className="field mono" style={{ background: "var(--bg-elev)" }}>{nextRunLabel}</div>
                    </Field>
                  </Row>
                  {!isNew && agent && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                      <div className="kicker" style={{ marginBottom: 6 }}>WEBHOOK TRIGGER</div>
                      {hasWebhook ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div className="mono" style={{ fontSize: 11, padding: "8px 10px", background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--silver-200)", wordBreak: "break-all" }}>
                            POST {webhookOrigin()}/api/public/webhooks/agents/{webhookPathToken ?? "[redacted]"}
                          </div>
                          <p className="mono muted" style={{ fontSize: 10 }}>
                            Body is forwarded as the run's `inputs`. Trigger kind = webhook. Full token is only shown immediately after rotation.
                          </p>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="btn btn-sm" onClick={() => { void rotateWebhook(); }} disabled={webhookBusy}><I.refresh size={11}/> Rotate token</button>
                            <button type="button" className="btn btn-sm" onClick={() => { void removeWebhook(); }} disabled={webhookBusy} style={{ color: "var(--danger)" }}><I.trash size={11}/> Remove</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" className="btn btn-sm" onClick={() => { void rotateWebhook(); }} disabled={webhookBusy}><I.plus size={11}/> Generate webhook URL</button>
                      )}
                    </div>
                  )}
                </Section>

                <Section number="03 / 05" kicker={`PLAYBOOK · ${playbook.length} STEP${playbook.length === 1 ? "" : "S"}`} title="Ordered steps">
                  <PlaybookEditor steps={playbook} onChange={setPlaybook}/>
                </Section>

                <Section number="04 / 05" kicker={`TOOLS · ${enabledTools.length} ENABLED`} title="Available tool registry" sub="Enabling any tool runs the agent through the tool-use loop on save.">
                  <ToolPicker tools={availableTools} enabled={enabledTools} onChange={setEnabledTools}/>
                </Section>

                <Section number="05 / 05" kicker="INPUT SCHEMA" title="Typed parameters" sub="Validated server-side. Coerced into typed inputs on every run.">
                  <InputSchemaEditor schema={inputSchema} onChange={setInputSchema}/>
                </Section>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" disabled={!canManageAgent || saving}>
                    {saving ? <span className="spin"><I.refresh size={13}/></span> : <I.check size={13}/>}
                    {isNew ? " Create agent" : " Save agent"}
                  </button>
                </div>
              </fieldset>
            </form>

            <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {!isNew && agent && (
                <div>
                  <div className="kicker" style={{ marginBottom: 8 }}>RUN WITH INPUTS</div>
                  {inputSchema.length === 0 ? (
                    <div className="card muted" style={{ padding: "12px 14px", fontSize: 12, textAlign: "center" }}>— no inputs defined —</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", marginTop: 10, justifyContent: "center" }}
                    onClick={() => { void runNow(); }}
                    disabled={!canRunAgent || running || saving}
                  >
                    {running ? <span className="spin"><I.refresh size={13}/></span> : <I.play size={13}/>}
                    {canRunAgent ? " Execute" : " Member role required"}
                  </button>
                </div>
              )}

              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>RECENT RUNS</div>
                {runs.length === 0 ? (
                  <div className="card muted" style={{ padding: "12px 14px", fontSize: 12, textAlign: "center" }}>— no runs recorded —</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {runs.map((r) => {
                      const expanded = expandedRun === r.id;
                      return (
                        <div key={r.id} className="card" style={{ padding: 12 }}>
                          <button
                            type="button"
                            onClick={() => setExpandedRun(expanded ? null : r.id)}
                            style={{ background: "transparent", border: "none", padding: 0, color: "var(--silver-100)", cursor: "pointer", textAlign: "left", width: "100%", display: "flex", gap: 8, alignItems: "flex-start" }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                <span className={`pill ${r.status === "success" ? "good" : r.status === "failed" ? "danger" : r.status === "running" ? "warn" : "muted"}`}>
                                  <span className="dot"></span>{r.status}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--silver-100)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                              </div>
                              <div className="mono muted" style={{ fontSize: 10.5 }}>{new Date(r.createdAt).toLocaleString()} · {triggerLabel(r.triggerKind)}</div>
                            </div>
                            <span className="mono muted" style={{ fontSize: 11 }}>{expanded ? "[ − ]" : "[ + ]"}</span>
                          </button>
                          {r.error && <div className="mono" style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>ERR · {r.error}</div>}
                          {expanded && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                              <RunTranscript steps={r.transcript}/>
                              {r.toolCalls && r.toolCalls.length > 0 && (
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <div className="kicker">TOOL CALLS · {r.toolCalls.length}</div>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => { void recordAsPlaybook(r.id); }}
                                      disabled={!canRunAgent || recordingRunId === r.id}
                                    >
                                      {recordingRunId === r.id ? "Recording…" : "Record as playbook"}
                                    </button>
                                  </div>
                                  <ToolCallTimeline calls={r.toolCalls}/>
                                </div>
                              )}
                              {r.output && (
                                <pre className="mono" style={{ margin: 0, padding: 10, fontSize: 11, lineHeight: 1.5, background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--silver-200)", whiteSpace: "pre-wrap" }}>{r.output}</pre>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

function Section({ number, kicker, title, sub, children }: { number: string; kicker: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 22, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>{kicker}</div>
          <h2 className="h2" style={{ fontSize: 18 }}>{title}</h2>
          {sub && <p className="muted" style={{ fontSize: 12.5, marginTop: 4, maxWidth: 480 }}>{sub}</p>}
        </div>
        <span className="mono muted" style={{ fontSize: 10.5, letterSpacing: "0.12em" }}>§ {number}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function fieldValue(form: FormData, key: string) {
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

// ─── PlaybookEditor ─────────────────────────────────────────────────────────
function PlaybookEditor({ steps, onChange }: { steps: AgentPlaybookStep[]; onChange: (next: AgentPlaybookStep[]) => void }) {
  const update = (index: number, patch: Partial<AgentPlaybookStep>) => {
    const next = steps.slice();
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  };
  const addStep = () => onChange([...steps, { id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, title: "", instruction: "" }]);
  const removeStep = (index: number) => { const next = steps.slice(); next.splice(index, 1); onChange(next); };
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = steps.slice();
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <div>
      {steps.length === 0 ? (
        <div className="card muted" style={{ padding: "12px 14px", textAlign: "center", fontSize: 12 }}>— empty playbook · add a step so each run produces a transcript —</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((step, index) => (
            <div key={step.id} className="card" style={{ padding: 12, display: "grid", gridTemplateColumns: "32px 1fr 80px", gap: 10 }}>
              <div className="mono muted" style={{ fontSize: 11, paddingTop: 6 }}>{String(index + 1).padStart(2, "0")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input className="field" placeholder="Step title" value={step.title} onChange={(e) => update(index, { title: e.target.value })}/>
                <textarea className="field" rows={2} placeholder="What the agent should do" value={step.instruction} onChange={(e) => update(index, { instruction: e.target.value })}/>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 11 }}>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="btn btn-sm" style={{ padding: "2px 6px", opacity: index === 0 ? 0.3 : 1 }}>↑</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === steps.length - 1} className="btn btn-sm" style={{ padding: "2px 6px", opacity: index === steps.length - 1 ? 0.3 : 1 }}>↓</button>
                <button type="button" onClick={() => removeStep(index)} className="btn btn-sm" style={{ padding: "2px 6px", color: "var(--danger)" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={addStep} className="btn btn-sm"><I.plus size={11}/> Add step</button>
      </div>
    </div>
  );
}

// ─── ToolPicker ─────────────────────────────────────────────────────────────
function ToolPicker({ tools, enabled, onChange }: { tools: AvailableTool[]; enabled: string[]; onChange: (next: string[]) => void }) {
  const enabledSet = new Set(enabled);
  if (tools.length === 0) {
    return <div className="card muted" style={{ padding: "12px 14px", textAlign: "center", fontSize: 12 }}>— tool registry empty —</div>;
  }
  const groups: Record<"read" | "write" | "exec", AvailableTool[]> = { read: [], write: [], exec: [] };
  for (const t of tools) groups[t.side].push(t);
  const toggle = (name: string) => {
    if (enabledSet.has(name)) onChange(enabled.filter((n) => n !== name));
    else onChange([...enabled, name]);
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      {(["read", "write", "exec"] as const).map((side) => (
        <div key={side} className="card" style={{ padding: 12 }}>
          <div className="kicker" style={{ marginBottom: 8, color: "var(--green)" }}>{side.toUpperCase()} · {groups[side].length}</div>
          {groups[side].length === 0 ? (
            <p className="mono muted" style={{ fontSize: 11 }}>— none —</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {groups[side].map((t) => (
                <label key={t.name} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={enabledSet.has(t.name)} onChange={() => toggle(t.name)} style={{ marginTop: 2, accentColor: "var(--green)" }}/>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--silver-100)", display: "block" }}>{t.name}</span>
                    <span className="muted" style={{ fontSize: 10.5, lineHeight: 1.4 }}>{t.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── InputSchemaEditor ──────────────────────────────────────────────────────
function InputSchemaEditor({ schema, onChange }: { schema: AgentInputField[]; onChange: (next: AgentInputField[]) => void }) {
  const update = (index: number, patch: Partial<AgentInputField>) => onChange(schema.map((f, i) => i === index ? { ...f, ...patch } : f));
  const remove = (index: number) => onChange(schema.filter((_, i) => i !== index));
  const add = () => onChange([...schema, { key: `field_${schema.length + 1}`, label: `Field ${schema.length + 1}`, type: "string", required: false }]);

  return (
    <div>
      {schema.length === 0 ? (
        <div className="card muted" style={{ padding: "12px 14px", textAlign: "center", fontSize: 12 }}>— empty schema · add a field to capture per-run parameters —</div>
      ) : (
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <table className="tbl">
            <thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Req</th><th>Options</th><th>Default</th><th></th></tr></thead>
            <tbody>
              {schema.map((f, index) => (
                <tr key={index}>
                  <td>
                    <input className="field mono" style={{ fontSize: 11, padding: "5px 8px" }} placeholder="key" value={f.key} onChange={(e) => update(index, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}/>
                  </td>
                  <td>
                    <input className="field" style={{ fontSize: 12, padding: "5px 8px" }} placeholder="Label" value={f.label} onChange={(e) => update(index, { label: e.target.value })}/>
                  </td>
                  <td>
                    <select className="field mono" style={{ fontSize: 11, padding: "5px 8px" }} value={f.type} onChange={(e) => {
                      const type = e.target.value as AgentInputFieldType;
                      update(index, { type, options: type === "enum" ? (f.options && f.options.length > 0 ? f.options : ["option_a"]) : undefined });
                    }}>
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td><input type="checkbox" checked={f.required} onChange={(e) => update(index, { required: e.target.checked })} style={{ accentColor: "var(--green)" }}/></td>
                  <td>
                    {f.type === "enum" ? (
                      <textarea className="field mono" style={{ fontSize: 11, padding: "5px 8px", minHeight: 50, minWidth: 140, resize: "none" }} placeholder="one per line" rows={2} value={(f.options ?? []).join("\n")} onChange={(e) => update(index, { options: lines(e.target.value) })}/>
                    ) : <span className="mono muted" style={{ fontSize: 11 }}>—</span>}
                  </td>
                  <td>
                    <input className="field" style={{ fontSize: 12, padding: "5px 8px" }} placeholder="—" value={f.defaultValue ?? ""} onChange={(e) => update(index, { defaultValue: e.target.value })}/>
                  </td>
                  <td>
                    <button type="button" onClick={() => remove(index)} className="btn btn-sm" style={{ padding: "3px 6px", color: "var(--danger)" }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={add} className="btn btn-sm"><I.plus size={11}/> Add field</button>
      </div>
    </div>
  );
}

function RunInputControl({ field: f, value, onChange }: { field: AgentInputField; value: string; onChange: (next: string) => void }) {
  if (f.type === "enum") {
    return (
      <Field label={`${f.label}${f.required ? " *" : ""}`}>
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— select —</option>
          {(f.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
    );
  }
  if (f.type === "boolean") {
    return (
      <label className="mono" style={{ fontSize: 12, color: "var(--silver-200)", display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} style={{ accentColor: "var(--green)" }}/>
        {f.label}
      </label>
    );
  }
  return (
    <Field label={`${f.label}${f.required ? " *" : ""}`}>
      <input className="field" type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.description}/>
    </Field>
  );
}

// ─── RunTranscript / ToolCallTimeline (workbench-styled) ────────────────────
export function RunTranscript({ steps }: { steps: AgentRunStep[] | undefined }) {
  if (!steps || steps.length === 0) {
    return <div className="mono muted" style={{ fontSize: 11, padding: "8px 10px", border: "1px dashed var(--line-2)", borderRadius: 6 }}>— no transcript captured for this run —</div>;
  }
  const statusPill = (s: AgentRunStepStatus) => s === "success" ? "good" : s === "failed" ? "danger" : "muted";
  const statusLabel = (s: AgentRunStepStatus) => s === "success" ? "OK" : s === "failed" ? "FAIL" : "SKIP";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {steps.map((step, index) => (
        <div key={step.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", alignItems: "baseline", gap: 10, padding: "10px 0", borderTop: index === 0 ? "none" : "1px solid var(--line)" }}>
          <div className="mono muted" style={{ fontSize: 11 }}>{String(index + 1).padStart(2, "0")}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`pill ${statusPill(step.status)}`}>{statusLabel(step.status)}</span>
              <span style={{ fontSize: 12.5, color: "var(--silver-100)" }}>{step.title}</span>
            </div>
            {step.output && <p style={{ marginTop: 4, fontSize: 11.5, color: "var(--silver-400)" }}>{step.output}</p>}
          </div>
          <div className="mono muted" style={{ fontSize: 11 }}>{formatDuration(step.durationMs)}</div>
        </div>
      ))}
    </div>
  );
}

export function ToolCallTimeline({ calls }: { calls: AgentRunToolCall[] | undefined }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!calls || calls.length === 0) return null;
  const statusPill = (s: AgentRunToolCall["status"]) => s === "ok" ? "good" : s === "timeout" ? "warn" : "danger";
  const statusLabel = (s: AgentRunToolCall["status"]) => s === "ok" ? "OK" : s === "timeout" ? "T/O" : "ERR";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {calls.map((call, index) => {
        const open = expanded === call.id;
        return (
          <div key={call.id} style={{ padding: "8px 0", borderTop: index === 0 ? "none" : "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => setExpanded(open ? null : call.id)}
              style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 30px", gap: 8, alignItems: "baseline", textAlign: "left", width: "100%", border: "none", background: "transparent", color: "inherit", padding: 0, cursor: "pointer" }}
            >
              <span className="mono muted" style={{ fontSize: 11 }}>{String(index + 1).padStart(2, "0")}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--silver-200)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span className={`pill ${statusPill(call.status)}`}>{statusLabel(call.status)}</span>
                <span style={{ marginLeft: 8, color: "var(--green)" }}>{call.toolName}</span>
                {call.error && <span style={{ marginLeft: 8, color: "var(--danger)" }}>{call.error}</span>}
              </span>
              <span className="mono muted" style={{ fontSize: 10, textAlign: "right" }}>{call.durationMs}ms</span>
              <span className="mono muted" style={{ fontSize: 10, textAlign: "right" }}>{open ? "[ − ]" : "[ + ]"}</span>
            </button>
            {open && (
              <div style={{ marginTop: 8, paddingLeft: 40, display: "grid", gap: 8 }}>
                <div>
                  <div className="kicker" style={{ marginBottom: 4 }}>INPUT</div>
                  <pre className="mono" style={{ margin: 0, padding: 8, fontSize: 10.5, lineHeight: 1.5, background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--silver-200)", overflow: "auto" }}>{safeStringify(call.input)}</pre>
                </div>
                {call.output !== undefined && (
                  <div>
                    <div className="kicker" style={{ marginBottom: 4 }}>OUTPUT</div>
                    <pre className="mono" style={{ margin: 0, padding: 8, fontSize: 10.5, lineHeight: 1.5, background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--silver-200)", overflow: "auto" }}>{safeStringify(call.output)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function safeStringify(value: unknown, max = 4000): string {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
  } catch {
    return String(value);
  }
}
