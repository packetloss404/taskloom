import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ClipboardList, Layers, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import LineageGraphView from "@/components/LineageGraph";
import { buildLineageGraph, lineageNeighbors, type LineageNode } from "@/lib/lineage";
import type {
  SaveWorkflowPlanItemInput,
  SaveWorkflowRequirementInput,
  WorkflowBlocker,
  WorkflowBrief,
  WorkflowPlanItem,
  WorkflowPlanItemStatus,
  WorkflowQuestion,
  WorkflowReleaseConfirmation,
  WorkflowRequirement,
  WorkflowRequirementPriority,
  WorkflowRequirementStatus,
  WorkflowTemplate,
  WorkflowValidationEvidence,
} from "@/lib/types";

interface WorkflowState {
  brief: WorkflowBrief | null;
  requirements: WorkflowRequirement[];
  planItems: WorkflowPlanItem[];
  validationEvidence: WorkflowValidationEvidence[];
  release: WorkflowReleaseConfirmation | null;
  blockers: WorkflowBlocker[];
  questions: WorkflowQuestion[];
}

const EMPTY_STATE: WorkflowState = {
  brief: null,
  requirements: [],
  planItems: [],
  validationEvidence: [],
  release: null,
  blockers: [],
  questions: [],
};

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const loadWorkflow = async () => {
    setLoading(true);
    setError(null);
    try {
      const [brief, requirements, planItems, validationEvidence, release, blockers, questions] = await Promise.all([
        api.getWorkflowBrief(),
        api.listWorkflowRequirements(),
        api.listWorkflowPlanItems(),
        api.listWorkflowValidationEvidence().catch(() => []),
        api.getWorkflowReleaseConfirmation().catch(() => null),
        api.listWorkflowBlockers().catch(() => []),
        api.listWorkflowQuestions().catch(() => []),
      ]);
      setState({
        brief,
        requirements,
        planItems,
        validationEvidence,
        release,
        blockers,
        questions,
      });
    } catch (loadError) {
      setError((loadError as Error).message);
      setState(EMPTY_STATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkflow();
    api.listWorkflowTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const applyTemplate = async (template: WorkflowTemplate) => {
    setApplyingTemplateId(template.id);
    setError(null);
    setMessage(null);
    try {
      const result = await api.applyWorkflowTemplate(template.id);
      setState({
        brief: result.brief,
        requirements: result.requirements,
        planItems: result.planItems,
      });
      setMessage(`Applied template: ${template.name}.`);
    } catch (templateError) {
      setError((templateError as Error).message);
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const counts = useMemo(() => {
    return {
      must: state.requirements.filter((entry) => entry.priority === "must").length,
      accepted: state.requirements.filter((entry) => entry.status === "accepted").length,
      done: state.planItems.filter((entry) => entry.status === "done").length,
    };
  }, [state]);

  const lineageGraph = useMemo(
    () =>
      buildLineageGraph({
        brief: state.brief,
        requirements: state.requirements,
        planItems: state.planItems,
        validationEvidence: state.validationEvidence,
        release: state.release,
        blockers: state.blockers,
        questions: state.questions,
      }),
    [state],
  );

  const selectedNode = useMemo<LineageNode | null>(() => {
    if (!selectedNodeId) return null;
    return lineageGraph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [lineageGraph, selectedNodeId]);

  const selectedDetail = useMemo(() => {
    if (!selectedNode) return null;
    const { upstream, downstream } = lineageNeighbors(lineageGraph, selectedNode.id);
    const lookup = (id: string) => lineageGraph.nodes.find((node) => node.id === id);
    return {
      node: selectedNode,
      upstream: upstream.map(lookup).filter((value): value is LineageNode => Boolean(value)),
      downstream: downstream.map(lookup).filter((value): value is LineageNode => Boolean(value)),
      blockers: relatedBlockers(state, selectedNode),
      questions: relatedQuestions(state, selectedNode),
    };
  }, [lineageGraph, selectedNode, state]);

  const runUpdate = async (label: string, action: () => Promise<WorkflowState | void>) => {
    setSaving(label);
    setError(null);
    setMessage(null);
    try {
      const next = await action();
      if (next) setState(next);
      else await loadWorkflow();
      setMessage("Workflow updated.");
    } catch (updateError) {
      setError((updateError as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const saveBrief = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runUpdate("brief", async () => {
      const brief = await api.saveWorkflowBrief({
        summary: fieldValue(form, "summary"),
        audience: fieldValue(form, "audience"),
        constraints: fieldValue(form, "constraints"),
        problemStatement: fieldValue(form, "problemStatement"),
        desiredOutcome: fieldValue(form, "desiredOutcome"),
        goals: lines(fieldValue(form, "goals")),
        successMetrics: lines(fieldValue(form, "successMetrics")),
        targetCustomers: lines(fieldValue(form, "targetCustomers")),
      });
      return { ...state, brief };
    });
  };

  const addRequirement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = fieldValue(form, "title");
    if (!title) return;
    const nextInput: SaveWorkflowRequirementInput[] = [
      ...state.requirements.map(requirementToInput),
      {
        title,
        detail: fieldValue(form, "detail"),
        priority: fieldValue(form, "priority") as WorkflowRequirementPriority,
        status: fieldValue(form, "status") as WorkflowRequirementStatus,
      },
    ];
    await runUpdate("requirement", async () => {
      const requirements = await api.saveWorkflowRequirements(nextInput);
      event.currentTarget.reset();
      return { ...state, requirements };
    });
  };

  const updateRequirementStatus = (requirement: WorkflowRequirement, status: WorkflowRequirementStatus) =>
    runUpdate(`requirement-${requirement.id}`, async () => {
      const requirements = await api.saveWorkflowRequirements(
        state.requirements.map((entry) => requirementToInput(entry.id === requirement.id ? { ...entry, status } : entry)),
      );
      return { ...state, requirements };
    });

  const addPlanItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = fieldValue(form, "title");
    if (!title) return;
    await runUpdate("plan", async () => {
      await api.createWorkflowPlanItem({
        title,
        description: fieldValue(form, "description"),
        status: fieldValue(form, "status") as WorkflowPlanItemStatus,
      });
      event.currentTarget.reset();
    });
  };

  const updatePlanStatus = (item: WorkflowPlanItem, status: WorkflowPlanItemStatus) =>
    runUpdate(`plan-${item.id}`, async () => {
      await api.updateWorkflowPlanItem(item.id, {
        title: item.title,
        description: item.description,
        status,
      });
    });

  return (
    <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-100">Workflow</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-400">Brief, requirements, and implementation plan for the active workspace.</p>
        </div>
        <button className="btn-ghost" type="button" onClick={loadWorkflow} disabled={loading || Boolean(saving)}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Must haves" value={counts.must} />
        <Stat label="Accepted" value={counts.accepted} />
        <Stat label="Plan done" value={`${counts.done}/${state.planItems.length}`} />
      </section>

      {templates.length > 0 && (
        <section className="card mb-6 p-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-500/12 text-accent-300">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Starter templates</h2>
              <p className="mt-1 text-xs text-ink-500">
                Apply a workspace template to overwrite the brief, requirements, and plan items below.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {templates.map((template) => (
              <article key={template.id} className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
                <div className="text-xs uppercase tracking-wider text-ink-500">{template.category}</div>
                <h3 className="mt-1 text-sm font-semibold text-ink-100">{template.name}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-400">{template.description}</p>
                <div className="mt-3 text-xs text-ink-500">
                  {template.requirements.length} requirements · {template.planItems.length} plan items
                </div>
                <button
                  type="button"
                  className="btn-primary mt-4 w-full justify-center"
                  onClick={() => void applyTemplate(template)}
                  disabled={applyingTemplateId === template.id || Boolean(saving)}
                >
                  {applyingTemplateId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                  Apply template
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && (
        <section className="mb-6 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <LineageGraphView
            graph={lineageGraph}
            selectedNodeId={selectedNodeId}
            onSelect={(node) => setSelectedNodeId(node?.id ?? null)}
          />
          <LineageDetail detail={selectedDetail} onClear={() => setSelectedNodeId(null)} />
        </section>
      )}

      {error && <Status tone="error">{error}</Status>}
      {message && !error && <Status tone="success">{message}</Status>}

      {loading ? (
        <div className="card flex items-center gap-3 p-6 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading workflow…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="card p-6">
            <SectionTitle icon={<ClipboardList className="h-4 w-4" />} title="Workspace Brief" />
            <form className="mt-5 space-y-4" onSubmit={saveBrief}>
              <Field label="Summary">
                <textarea name="summary" defaultValue={state.brief?.summary ?? ""} rows={4} className="workflow-input resize-none" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Audience">
                  <input name="audience" defaultValue={state.brief?.audience ?? ""} className="workflow-input" />
                </Field>
                <Field label="Constraints">
                  <input name="constraints" defaultValue={state.brief?.constraints ?? ""} className="workflow-input" />
                </Field>
              </div>
              <Field label="Problem statement">
                <input name="problemStatement" defaultValue={state.brief?.problemStatement ?? ""} className="workflow-input" />
              </Field>
              <Field label="Desired outcome">
                <input name="desiredOutcome" defaultValue={state.brief?.desiredOutcome ?? ""} className="workflow-input" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Goals">
                  <textarea name="goals" defaultValue={(state.brief?.goals ?? []).join("\n")} rows={5} className="workflow-input resize-none" />
                </Field>
                <Field label="Customers">
                  <textarea name="targetCustomers" defaultValue={(state.brief?.targetCustomers ?? []).join("\n")} rows={5} className="workflow-input resize-none" />
                </Field>
                <Field label="Metrics">
                  <textarea name="successMetrics" defaultValue={(state.brief?.successMetrics ?? []).join("\n")} rows={5} className="workflow-input resize-none" />
                </Field>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-500">Updated {relative(state.brief?.updatedAt)}</span>
                <button className="btn-primary" type="submit" disabled={saving === "brief"}>
                  <Save className="h-4 w-4" /> Save brief
                </button>
              </div>
            </form>
          </section>

          <div className="space-y-6">
            <section className="card p-6">
              <SectionTitle icon={<Plus className="h-4 w-4" />} title="Requirements" />
              <form className="mt-5 grid gap-3 lg:grid-cols-[1fr_130px_130px_auto] lg:items-end" onSubmit={addRequirement}>
                <Field label="Title"><input name="title" className="workflow-input" required /></Field>
                <Field label="Priority">
                  <select name="priority" className="workflow-input" defaultValue="should">
                    <option value="must">Must</option>
                    <option value="should">Should</option>
                    <option value="could">Could</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" className="workflow-input" defaultValue="accepted">
                    <option value="proposed">Proposed</option>
                    <option value="accepted">Accepted</option>
                    <option value="deferred">Deferred</option>
                  </select>
                </Field>
                <button className="btn-primary justify-center" type="submit" disabled={saving === "requirement"}>Add</button>
                <div className="lg:col-span-4">
                  <Field label="Detail"><input name="detail" className="workflow-input" /></Field>
                </div>
              </form>
              <div className="mt-5 space-y-3">
                {state.requirements.map((requirement) => (
                  <Row key={requirement.id} title={requirement.title} detail={requirement.detail} meta={`${requirement.priority} priority · updated ${relative(requirement.updatedAt)}`}>
                    <select className="workflow-input min-w-32" value={requirement.status} onChange={(event) => updateRequirementStatus(requirement, event.target.value as WorkflowRequirementStatus)}>
                      <option value="proposed">Proposed</option>
                      <option value="accepted">Accepted</option>
                      <option value="deferred">Deferred</option>
                    </select>
                  </Row>
                ))}
              </div>
            </section>

            <section className="card p-6">
              <SectionTitle icon={<ClipboardList className="h-4 w-4" />} title="Implementation Plan" />
              <form className="mt-5 grid gap-3 lg:grid-cols-[1fr_140px_auto] lg:items-end" onSubmit={addPlanItem}>
                <Field label="Title"><input name="title" className="workflow-input" required /></Field>
                <Field label="Status">
                  <select name="status" className="workflow-input" defaultValue="todo">
                    <option value="todo">Todo</option>
                    <option value="in_progress">In progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </Field>
                <button className="btn-primary justify-center" type="submit" disabled={saving === "plan"}>Add</button>
                <div className="lg:col-span-3">
                  <Field label="Description"><input name="description" className="workflow-input" /></Field>
                </div>
              </form>
              <div className="mt-5 space-y-3">
                {state.planItems.map((item) => (
                  <Row key={item.id} title={item.title} detail={item.description} meta={`Updated ${relative(item.updatedAt)}`}>
                    <select className="workflow-input min-w-36" value={item.status} onChange={(event) => updatePlanStatus(item, event.target.value as WorkflowPlanItemStatus)}>
                      <option value="todo">Todo</option>
                      <option value="in_progress">In progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </Row>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      <style>{`
        .workflow-input {
          width: 100%;
          background: rgb(11 11 18 / 0.6);
          border: 1px solid rgb(38 40 56);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          color: rgb(230 231 240);
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }
        .workflow-input::placeholder { color: rgb(107 110 133); }
        .workflow-input:focus {
          border-color: rgb(161 161 170 / 0.5);
          box-shadow: 0 0 0 3px rgb(161 161 170 / 0.14);
        }
      `}</style>
    </>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-500/12 text-accent-300">{icon}</div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink-200">{label}</span>{children}</label>;
}

function Row({ title, detail, meta, children }: { title: string; detail?: string; meta: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink-100">{title}</h3>
          {detail && <p className="mt-1 text-sm text-ink-400">{detail}</p>}
          <p className="mt-2 text-xs text-ink-500">{meta}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="card p-4"><div className="text-xs uppercase tracking-wider text-ink-500">{label}</div><div className="mt-1 text-2xl font-semibold text-ink-100">{value}</div></div>;
}

function Status({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const classes = tone === "error"
    ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
    : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  return <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}

function LineageDetail({
  detail,
  onClear,
}: {
  detail: LineageDetailValue | null;
  onClear: () => void;
}) {
  if (!detail) {
    return (
      <div className="card flex h-full flex-col justify-center gap-2 p-6 text-sm text-ink-400">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Block detail</h3>
        <p>Select a node in the lineage graph to inspect its inputs, outputs, and tied blockers or questions.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full border border-ink-700 bg-ink-900/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-500">
            {detail.node.stage}
          </span>
          <h3 className="mt-2 text-sm font-semibold text-ink-100">{detail.node.label}</h3>
          {detail.node.sublabel && <p className="mt-1 text-sm text-ink-400">{detail.node.sublabel}</p>}
          {detail.node.meta && <p className="mt-1 text-xs text-ink-500">Updated {relative(detail.node.meta)}</p>}
        </div>
        <button className="btn-ghost" type="button" onClick={onClear}>Close</button>
      </div>

      <DetailGroup title="Inputs" nodes={detail.upstream} emptyText="No upstream inputs." />
      <DetailGroup title="Outputs" nodes={detail.downstream} emptyText="Nothing downstream yet." />

      {(detail.blockers.length > 0 || detail.questions.length > 0) && (
        <div className="mt-4 space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Tied concerns</h4>
          {detail.blockers.map((blocker) => (
            <div key={blocker.id} className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              Blocker: {blocker.title}
            </div>
          ))}
          {detail.questions.map((question) => (
            <div key={question.id} className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Question: {question.prompt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailGroup({ title, nodes, emptyText }: { title: string; nodes: LineageNode[]; emptyText: string }) {
  return (
    <div className="mt-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{title}</h4>
      {nodes.length === 0 ? (
        <p className="mt-1 text-xs text-ink-500">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {nodes.map((node) => (
            <li key={node.id} className="rounded-xl border border-ink-800 bg-ink-950/35 px-3 py-2 text-xs text-ink-200">
              <span className="text-[10px] uppercase tracking-wider text-ink-500">{node.stage}</span>
              <div className="mt-0.5 text-sm text-ink-100">{node.label}</div>
              {node.sublabel && <div className="mt-0.5 text-xs text-ink-400">{node.sublabel}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function relatedBlockers(state: WorkflowState, node: LineageNode): WorkflowBlocker[] {
  if (node.stage === "plan") {
    const planId = node.id.replace(/^plan:/, "");
    return state.blockers.filter((blocker) => blocker.relatedPlanItemId === planId);
  }
  if (node.stage === "requirements") {
    const requirementId = node.id.replace(/^req:/, "");
    return state.blockers.filter((blocker) => blocker.relatedRequirementId === requirementId);
  }
  return [];
}

function relatedQuestions(state: WorkflowState, node: LineageNode): WorkflowQuestion[] {
  if (node.stage === "plan") {
    const planId = node.id.replace(/^plan:/, "");
    return state.questions.filter(
      (question) => (question as unknown as { relatedPlanItemId?: string }).relatedPlanItemId === planId,
    );
  }
  if (node.stage === "requirements") {
    const requirementId = node.id.replace(/^req:/, "");
    return state.questions.filter(
      (question) => (question as unknown as { relatedRequirementId?: string }).relatedRequirementId === requirementId,
    );
  }
  return [];
}

type LineageDetailValue = {
  node: LineageNode;
  upstream: LineageNode[];
  downstream: LineageNode[];
  blockers: WorkflowBlocker[];
  questions: WorkflowQuestion[];
};

function requirementToInput(requirement: WorkflowRequirement): SaveWorkflowRequirementInput {
  return {
    id: requirement.id,
    title: requirement.title,
    detail: requirement.detail,
    priority: requirement.priority,
    status: requirement.status,
  };
}

function lines(value: string) {
  return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function fieldValue(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
