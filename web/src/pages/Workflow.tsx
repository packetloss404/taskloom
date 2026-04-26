import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  GitCompare,
  History,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import LineageGraphView from "@/components/LineageGraph";
import { buildLineageGraph, lineageNeighbors, type LineageNode } from "@/lib/lineage";
import type {
  SaveWorkflowRequirementInput,
  WorkflowBlocker,
  WorkflowBrief,
  WorkflowBriefTemplate,
  WorkflowBriefVersion,
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
  versions: WorkflowBriefVersion[];
  briefTemplates: WorkflowBriefTemplate[];
}

const EMPTY_STATE: WorkflowState = {
  brief: null,
  requirements: [],
  planItems: [],
  validationEvidence: [],
  release: null,
  blockers: [],
  questions: [],
  versions: [],
  briefTemplates: [],
};

type CompareSelection = { left: string | null; right: string | null };

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [briefFormKey, setBriefFormKey] = useState(0);
  const [showBriefTemplates, setShowBriefTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<CompareSelection>({ left: null, right: null });
  const [compareOpen, setCompareOpen] = useState(false);

  const loadWorkflow = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        brief,
        requirements,
        planItems,
        validationEvidence,
        release,
        blockers,
        questions,
        versions,
        briefTemplates,
      ] = await Promise.all([
        api.getWorkflowBrief(),
        api.listWorkflowRequirements(),
        api.listWorkflowPlanItems(),
        api.listWorkflowValidationEvidence().catch(() => []),
        api.getWorkflowReleaseConfirmation().catch(() => null),
        api.listWorkflowBlockers().catch(() => []),
        api.listWorkflowQuestions().catch(() => []),
        api.listWorkflowBriefVersions().catch(() => [] as WorkflowBriefVersion[]),
        api.listWorkflowBriefTemplates().catch(() => [] as WorkflowBriefTemplate[]),
      ]);
      setState({
        brief,
        requirements,
        planItems,
        validationEvidence,
        release,
        blockers,
        questions,
        versions,
        briefTemplates,
      });
      setBriefFormKey((key) => key + 1);
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
      setState((current) => ({
        ...current,
        brief: result.brief,
        requirements: result.requirements,
        planItems: result.planItems,
      }));
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
      passedEvidence: state.validationEvidence.filter((entry) => entry.status === "passed").length,
      openBlockers: state.blockers.filter((entry) => entry.status === "open").length,
    };
  }, [state]);

  const releaseStatus = state.release?.confirmed
    ? { label: "CONFIRMED", tone: "good" as const }
    : state.release
    ? { label: "PENDING", tone: "warn" as const }
    : { label: "NOT STARTED", tone: "muted" as const };

  const previewVersion = useMemo(
    () => state.versions.find((entry) => entry.id === previewVersionId) ?? null,
    [state.versions, previewVersionId],
  );

  const compareLeft = useMemo(
    () => state.versions.find((entry) => entry.id === compareSelection.left) ?? null,
    [state.versions, compareSelection.left],
  );
  const compareRight = useMemo(
    () => state.versions.find((entry) => entry.id === compareSelection.right) ?? null,
    [state.versions, compareSelection.right],
  );

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
      await api.saveWorkflowBrief({
        summary: fieldValue(form, "summary"),
        audience: fieldValue(form, "audience"),
        constraints: fieldValue(form, "constraints"),
        problemStatement: fieldValue(form, "problemStatement"),
        desiredOutcome: fieldValue(form, "desiredOutcome"),
        goals: lines(fieldValue(form, "goals")),
        successMetrics: lines(fieldValue(form, "successMetrics")),
        targetCustomers: lines(fieldValue(form, "targetCustomers")),
      });
    });
  };

  const applyBriefTemplate = (template: WorkflowBriefTemplate) =>
    runUpdate(`brief-template-${template.id}`, async () => {
      await api.applyWorkflowBriefTemplate(template.id);
      setShowBriefTemplates(false);
    });

  const restoreVersion = (version: WorkflowBriefVersion) =>
    runUpdate(`restore-${version.id}`, async () => {
      await api.restoreWorkflowBriefVersion(version.id);
      setPreviewVersionId(null);
    });

  const toggleCompareSelection = (versionId: string) => {
    setCompareSelection((current) => {
      if (current.left === versionId) return { left: null, right: current.right };
      if (current.right === versionId) return { left: current.left, right: null };
      if (!current.left) return { left: versionId, right: current.right };
      if (!current.right) return { left: current.left, right: versionId };
      return { left: current.right, right: versionId };
    });
  };

  const openCompare = () => {
    if (compareLeft && compareRight) setCompareOpen(true);
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
    const formEl = event.currentTarget;
    await runUpdate("requirement", async () => {
      const requirements = await api.saveWorkflowRequirements(nextInput);
      formEl.reset();
      return { ...state, requirements };
    });
  };

  const updateRequirementStatus = (requirement: WorkflowRequirement, status: WorkflowRequirementStatus) =>
    runUpdate(`requirement-${requirement.id}`, async () => {
      const requirements = await api.saveWorkflowRequirements(
        state.requirements.map((entry) =>
          requirementToInput(entry.id === requirement.id ? { ...entry, status } : entry),
        ),
      );
      return { ...state, requirements };
    });

  const addPlanItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = fieldValue(form, "title");
    if (!title) return;
    const formEl = event.currentTarget;
    await runUpdate("plan", async () => {
      await api.createWorkflowPlanItem({
        title,
        description: fieldValue(form, "description"),
        status: fieldValue(form, "status") as WorkflowPlanItemStatus,
      });
      formEl.reset();
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
    <div className="page-frame">
      {/* ======================= HEADER ======================= */}
      <header className="border-b border-ink-700 pb-8">
        <div className="flex items-baseline justify-between gap-3">
          <span className="kicker-amber">WORKFLOW · ACTIVE WORKSPACE</span>
          <span className="section-marker">§ 00 / 06</span>
        </div>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="display-xl">Workflow</h1>
            <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
              <span className="text-ink-200">{state.brief?.workspaceId ?? "—"}</span>
              <span className="text-ink-700">|</span>
              <span className={`pill pill--${releaseStatus.tone}`}>RELEASE · {releaseStatus.label}</span>
              <span className="text-ink-700">|</span>
              <span>UPDATED {(relative(state.brief?.updatedAt) || "—").toUpperCase()}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-ghost"
              type="button"
              onClick={loadWorkflow}
              disabled={loading || Boolean(saving)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setShowBriefTemplates((open) => !open)}
              disabled={loading || Boolean(saving)}
            >
              <Sparkles className="h-3.5 w-3.5" /> Plan mode
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setShowHistory((open) => !open)}
              disabled={loading}
            >
              <History className="h-3.5 w-3.5" /> History
              {state.versions.length > 0 && (
                <span className="ml-1 font-mono text-[10px] text-ink-300">
                  [{state.versions.length}]
                </span>
              )}
            </button>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-12 gap-y-4 sm:grid-cols-5">
          <Metric label="MUST HAVES" value={counts.must} />
          <Metric label="ACCEPTED" value={counts.accepted} />
          <Metric label="PLAN DONE" value={`${counts.done}/${state.planItems.length}`} />
          <Metric label="EVIDENCE PASSED" value={counts.passedEvidence} />
          <Metric label="OPEN BLOCKERS" value={counts.openBlockers} tone={counts.openBlockers > 0 ? "warn" : undefined} />
        </dl>
      </header>

      {(error || message) && (
        <div className="mt-6">
          {error && <Banner tone="error">{error}</Banner>}
          {message && !error && <Banner tone="success">{message}</Banner>}
        </div>
      )}

      {loading ? (
        <div className="mt-12 flex items-center gap-3 border border-ink-700 bg-ink-875 px-6 py-6 font-mono text-xs uppercase tracking-[0.18em] text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin text-signal-amber" /> LOADING WORKFLOW…
        </div>
      ) : (
        <>
          {/* ======================= STARTER TEMPLATES ======================= */}
          {templates.length > 0 && (
            <section className="section-band mt-2">
              <SectionHeader
                kicker="LIBRARY · STARTER TEMPLATES"
                title="Templates"
                marker="§ 01 / 06"
                meta="Apply a workspace template to overwrite the brief, requirements, and plan items below."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {templates.map((template) => (
                  <article key={template.id} className="spec-frame">
                    <div className="spec-label">{template.category.toUpperCase()}</div>
                    <h3 className="display text-2xl leading-[1.05]">{template.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-ink-300">{template.description}</p>
                    <div className="mt-4 grid grid-cols-2 gap-px border border-ink-700 bg-ink-700">
                      <Stat
                        label="REQUIREMENTS"
                        value={template.requirements.length}
                      />
                      <Stat
                        label="PLAN ITEMS"
                        value={template.planItems.length}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary mt-5 w-full justify-center"
                      onClick={() => void applyTemplate(template)}
                      disabled={applyingTemplateId === template.id || Boolean(saving)}
                    >
                      {applyingTemplateId === template.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Apply template
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ======================= LINEAGE ======================= */}
          <section className="section-band">
            <SectionHeader
              kicker="LINEAGE · STAGE GRAPH"
              title="Lineage"
              marker="§ 02 / 06"
              meta="Trace the provenance of every artefact from brief through release. Click a node to focus its chain."
            />
            <div className="mt-8 grid gap-px bg-ink-700 lg:grid-cols-[1fr_320px]">
              <div className="bg-ink-950">
                <LineageGraphView
                  graph={lineageGraph}
                  selectedNodeId={selectedNodeId}
                  onSelect={(node) => setSelectedNodeId(node?.id ?? null)}
                />
              </div>
              <LineageDetail
                detail={selectedDetail}
                onClear={() => setSelectedNodeId(null)}
              />
            </div>
          </section>

          {/* ======================= BRIEF ======================= */}
          <section className="section-band">
            <SectionHeader
              kicker="DOCUMENT · WORKSPACE BRIEF"
              title="Brief"
              marker="§ 03 / 06"
              meta="Single source of intent for the workspace. Saving creates a new immutable version."
            />
            <div className="mt-8 grid gap-12 lg:grid-cols-[260px_1fr]">
              <aside className="space-y-6">
                <MetaRow label="WORKSPACE" value={state.brief?.workspaceId ?? "—"} mono />
                <MetaRow label="LAST SAVED" value={(relative(state.brief?.updatedAt) || "—").toUpperCase()} mono />
                <MetaRow
                  label="VERSIONS"
                  value={`${state.versions.length} ON FILE`}
                  mono
                />
                <MetaRow
                  label="REQUIREMENTS"
                  value={`${state.requirements.length} TRACKED`}
                  mono
                />
                <MetaRow
                  label="PLAN ITEMS"
                  value={`${state.planItems.length} DEFINED`}
                  mono
                />
              </aside>
              <form key={briefFormKey} className="space-y-5" onSubmit={saveBrief}>
                <Field label="SUMMARY">
                  <textarea
                    name="summary"
                    defaultValue={state.brief?.summary ?? ""}
                    rows={4}
                    className="workflow-input resize-none"
                    required
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="AUDIENCE">
                    <input name="audience" defaultValue={state.brief?.audience ?? ""} className="workflow-input" />
                  </Field>
                  <Field label="CONSTRAINTS">
                    <input
                      name="constraints"
                      defaultValue={state.brief?.constraints ?? ""}
                      className="workflow-input"
                    />
                  </Field>
                </div>
                <Field label="PROBLEM STATEMENT">
                  <input
                    name="problemStatement"
                    defaultValue={state.brief?.problemStatement ?? ""}
                    className="workflow-input"
                  />
                </Field>
                <Field label="DESIRED OUTCOME">
                  <input
                    name="desiredOutcome"
                    defaultValue={state.brief?.desiredOutcome ?? ""}
                    className="workflow-input"
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="GOALS">
                    <textarea
                      name="goals"
                      defaultValue={(state.brief?.goals ?? []).join("\n")}
                      rows={5}
                      className="workflow-input resize-none"
                    />
                  </Field>
                  <Field label="CUSTOMERS">
                    <textarea
                      name="targetCustomers"
                      defaultValue={(state.brief?.targetCustomers ?? []).join("\n")}
                      rows={5}
                      className="workflow-input resize-none"
                    />
                  </Field>
                  <Field label="METRICS">
                    <textarea
                      name="successMetrics"
                      defaultValue={(state.brief?.successMetrics ?? []).join("\n")}
                      rows={5}
                      className="workflow-input resize-none"
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between border-t border-ink-800 pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    UPDATED {(relative(state.brief?.updatedAt) || "—").toUpperCase()}
                  </span>
                  <button className="btn-primary" type="submit" disabled={saving === "brief"}>
                    <Save className="h-3.5 w-3.5" /> Save brief
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* ======================= REQUIREMENTS ======================= */}
          <section className="section-band">
            <SectionHeader
              kicker="REGISTER · REQUIREMENTS"
              title="Requirements"
              marker="§ 04 / 06"
              meta="Catalogued must / should / could items. Inline status edits are persisted immediately."
            />
            <div className="mt-8 grid gap-12 lg:grid-cols-[260px_1fr]">
              <aside className="space-y-6">
                <MetaRow label="TOTAL" value={state.requirements.length} mono />
                <MetaRow label="MUST" value={counts.must} mono />
                <MetaRow label="ACCEPTED" value={counts.accepted} mono />
                <MetaRow
                  label="DEFERRED"
                  value={state.requirements.filter((r) => r.status === "deferred").length}
                  mono
                />
              </aside>
              <div>
                <form
                  className="grid gap-3 border border-ink-700 bg-ink-875 p-4 lg:grid-cols-[1fr_140px_140px_auto] lg:items-end"
                  onSubmit={addRequirement}
                >
                  <Field label="TITLE">
                    <input name="title" className="workflow-input" required />
                  </Field>
                  <Field label="PRIORITY">
                    <select name="priority" className="workflow-input" defaultValue="should">
                      <option value="must">Must</option>
                      <option value="should">Should</option>
                      <option value="could">Could</option>
                    </select>
                  </Field>
                  <Field label="STATUS">
                    <select name="status" className="workflow-input" defaultValue="accepted">
                      <option value="proposed">Proposed</option>
                      <option value="accepted">Accepted</option>
                      <option value="deferred">Deferred</option>
                    </select>
                  </Field>
                  <button
                    className="btn-primary justify-center"
                    type="submit"
                    disabled={saving === "requirement"}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <div className="lg:col-span-4">
                    <Field label="DETAIL">
                      <input name="detail" className="workflow-input" />
                    </Field>
                  </div>
                </form>

                <div className="mt-5 border border-ink-700">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>TITLE / DETAIL</th>
                        <th className="num">PRIORITY</th>
                        <th className="num">UPDATED</th>
                        <th className="num">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.requirements.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                            NO REQUIREMENTS — ADD ONE ABOVE
                          </td>
                        </tr>
                      )}
                      {state.requirements.map((requirement, index) => (
                        <tr key={requirement.id}>
                          <td className="font-mono text-[11px] text-ink-500">
                            REQ-{String(index + 1).padStart(3, "0")}
                          </td>
                          <td>
                            <div className="text-ink-100">{requirement.title}</div>
                            {requirement.detail && (
                              <div className="mt-1 text-xs text-ink-400">{requirement.detail}</div>
                            )}
                          </td>
                          <td className="num">
                            <span className="pill pill--muted">{requirement.priority.toUpperCase()}</span>
                          </td>
                          <td className="num text-ink-400">
                            {(relative(requirement.updatedAt) || "—").toUpperCase()}
                          </td>
                          <td className="num">
                            <select
                              className="workflow-input min-w-32"
                              value={requirement.status}
                              onChange={(event) =>
                                updateRequirementStatus(
                                  requirement,
                                  event.target.value as WorkflowRequirementStatus,
                                )
                              }
                            >
                              <option value="proposed">Proposed</option>
                              <option value="accepted">Accepted</option>
                              <option value="deferred">Deferred</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* ======================= PLAN ITEMS ======================= */}
          <section className="section-band">
            <SectionHeader
              kicker="REGISTER · PLAN ITEMS"
              title="Implementation Plan"
              marker="§ 05 / 06"
              meta="Discrete units of work that turn requirements into shipped change."
            />
            <div className="mt-8 grid gap-12 lg:grid-cols-[260px_1fr]">
              <aside className="space-y-6">
                <MetaRow label="TOTAL" value={state.planItems.length} mono />
                <MetaRow label="DONE" value={counts.done} mono />
                <MetaRow
                  label="IN PROGRESS"
                  value={state.planItems.filter((p) => p.status === "in_progress").length}
                  mono
                />
                <MetaRow
                  label="BLOCKED"
                  value={state.planItems.filter((p) => p.status === "blocked").length}
                  mono
                  tone={state.planItems.some((p) => p.status === "blocked") ? "warn" : undefined}
                />
              </aside>
              <div>
                <form
                  className="grid gap-3 border border-ink-700 bg-ink-875 p-4 lg:grid-cols-[1fr_160px_auto] lg:items-end"
                  onSubmit={addPlanItem}
                >
                  <Field label="TITLE">
                    <input name="title" className="workflow-input" required />
                  </Field>
                  <Field label="STATUS">
                    <select name="status" className="workflow-input" defaultValue="todo">
                      <option value="todo">Todo</option>
                      <option value="in_progress">In progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </Field>
                  <button className="btn-primary justify-center" type="submit" disabled={saving === "plan"}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                  <div className="lg:col-span-3">
                    <Field label="DESCRIPTION">
                      <input name="description" className="workflow-input" />
                    </Field>
                  </div>
                </form>

                <div className="mt-5 border border-ink-700">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>TITLE / DESCRIPTION</th>
                        <th className="num">UPDATED</th>
                        <th className="num">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.planItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                            NO PLAN ITEMS — ADD ONE ABOVE
                          </td>
                        </tr>
                      )}
                      {state.planItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="font-mono text-[11px] text-ink-500">
                            PLN-{String(index + 1).padStart(3, "0")}
                          </td>
                          <td>
                            <div className="text-ink-100">{item.title}</div>
                            {item.description && (
                              <div className="mt-1 text-xs text-ink-400">{item.description}</div>
                            )}
                          </td>
                          <td className="num text-ink-400">
                            {(relative(item.updatedAt) || "—").toUpperCase()}
                          </td>
                          <td className="num">
                            <select
                              className="workflow-input min-w-36"
                              value={item.status}
                              onChange={(event) =>
                                updatePlanStatus(item, event.target.value as WorkflowPlanItemStatus)
                              }
                            >
                              <option value="todo">Todo</option>
                              <option value="in_progress">In progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="done">Done</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* ======================= VALIDATION + RELEASE ======================= */}
          <section className="section-band">
            <SectionHeader
              kicker="GATE · VALIDATION & RELEASE"
              title="Validation"
              marker="§ 06 / 06"
              meta="Evidence chain feeding the release confirmation gate."
            />
            <div className="mt-8 grid gap-px bg-ink-700 lg:grid-cols-2">
              <div className="bg-ink-950 p-6">
                <div className="kicker mb-3">EVIDENCE LOG</div>
                {state.validationEvidence.length === 0 ? (
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                    NO EVIDENCE RECORDED
                  </div>
                ) : (
                  <ul className="divide-y divide-ink-800">
                    {state.validationEvidence.map((evidence, index) => (
                      <li key={evidence.id} className="grid gap-2 py-3 sm:grid-cols-[60px_1fr_auto] sm:items-baseline">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                          EV-{String(index + 1).padStart(3, "0")}
                        </span>
                        <div>
                          <div className="text-sm text-ink-100">{evidence.title}</div>
                          {evidence.detail && (
                            <div className="mt-0.5 text-xs text-ink-400">{evidence.detail}</div>
                          )}
                          {evidence.source && (
                            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                              SOURCE · {evidence.source}
                            </div>
                          )}
                        </div>
                        <span
                          className={`pill ${
                            evidence.status === "passed"
                              ? "pill--good"
                              : evidence.status === "failed"
                              ? "pill--danger"
                              : "pill--muted"
                          }`}
                        >
                          {evidence.status.toUpperCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-ink-950 p-6">
                <div className="kicker mb-3">RELEASE CONFIRMATION</div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`pill pill--${releaseStatus.tone}`}>
                      {releaseStatus.label}
                    </span>
                    {state.release?.confirmedAt && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                        CONFIRMED {(relative(state.release.confirmedAt) || "—").toUpperCase()}
                      </span>
                    )}
                  </div>
                  {state.release?.summary ? (
                    <p className="text-sm leading-6 text-ink-200">{state.release.summary}</p>
                  ) : (
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                      NO RELEASE SUMMARY ON FILE
                    </p>
                  )}
                  {state.release?.confirmedBy && (
                    <MetaRow label="CONFIRMED BY" value={state.release.confirmedBy} mono />
                  )}
                  {(state.blockers.length > 0 || state.questions.length > 0) && (
                    <div className="mt-4 space-y-2 border-t border-ink-800 pt-4">
                      <div className="kicker">OPEN CONCERNS</div>
                      {state.blockers
                        .filter((b) => b.status === "open")
                        .map((blocker) => (
                          <div
                            key={blocker.id}
                            className="flex items-start gap-3 border-l border-signal-red bg-ink-900 px-3 py-2 text-xs text-ink-200"
                          >
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-red">
                              BLOCKER
                            </span>
                            <span>{blocker.title}</span>
                          </div>
                        ))}
                      {state.questions
                        .filter((q) => q.status === "open")
                        .map((question) => (
                          <div
                            key={question.id}
                            className="flex items-start gap-3 border-l border-signal-amber bg-ink-900 px-3 py-2 text-xs text-ink-200"
                          >
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-amber">
                              QUESTION
                            </span>
                            <span>{question.prompt}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ======================= BRIEF TEMPLATES OVERLAY ======================= */}
      {showBriefTemplates && state.briefTemplates.length > 0 && (
        <Overlay title="BRIEF TEMPLATES" onClose={() => setShowBriefTemplates(false)}>
          <div className="grid h-full grid-cols-1 gap-px bg-ink-700 lg:grid-cols-3">
            {state.briefTemplates.map((template) => (
              <article key={template.id} className="flex flex-col gap-4 bg-ink-950 p-6">
                <span className="kicker-amber">TEMPLATE</span>
                <h3 className="display text-2xl leading-[1.05]">{template.name}</h3>
                <p className="text-sm leading-6 text-ink-300">{template.description}</p>
                <div className="mt-auto">
                  <button
                    type="button"
                    className="btn-primary justify-center"
                    onClick={() => applyBriefTemplate(template)}
                    disabled={saving === `brief-template-${template.id}` || loading}
                  >
                    {saving === `brief-template-${template.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Use template
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Overlay>
      )}

      {/* ======================= HISTORY OVERLAY ======================= */}
      {showHistory && (
        <Overlay
          title={`BRIEF VERSION HISTORY · ${state.versions.length}`}
          onClose={() => setShowHistory(false)}
          actions={
            <button
              type="button"
              className="btn-ghost"
              onClick={openCompare}
              disabled={!compareLeft || !compareRight || compareLeft.id === compareRight.id}
            >
              <GitCompare className="h-3.5 w-3.5" /> Compare selected
            </button>
          }
        >
          {state.versions.length === 0 ? (
            <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
              NO VERSIONS YET — SAVE THE BRIEF OR APPLY A TEMPLATE TO START TRACKING HISTORY
            </div>
          ) : (
            <div className="grid h-full grid-cols-1 gap-px bg-ink-700 lg:grid-cols-[420px_1fr]">
              <aside className="overflow-y-auto bg-ink-950">
                <ol>
                  {state.versions.map((version) => {
                    const selectedSlot =
                      compareSelection.left === version.id
                        ? "A"
                        : compareSelection.right === version.id
                        ? "B"
                        : null;
                    const isPreview = previewVersionId === version.id;
                    return (
                      <li
                        key={version.id}
                        className={`border-b border-ink-800 px-5 py-4 transition-colors ${
                          isPreview ? "bg-ink-875" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="flex w-full items-baseline gap-3 text-left"
                          onClick={() => setPreviewVersionId(version.id)}
                        >
                          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal-amber">
                            V{String(version.versionNumber).padStart(3, "0")}
                          </span>
                          <span className="leader flex-1" aria-hidden />
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                            {(relative(version.createdAt) || "—").toUpperCase()}
                          </span>
                        </button>
                        <p className="mt-2 line-clamp-2 text-xs text-ink-300">{version.summary}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <SourcePill source={version.source} label={version.sourceLabel} />
                          {version.createdByDisplayName && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                              BY {version.createdByDisplayName.toUpperCase()}
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              className={`btn-ghost text-[10px] ${selectedSlot ? "border-signal-amber text-signal-amber" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompareSelection(version.id);
                              }}
                            >
                              {selectedSlot ? `[${selectedSlot}]` : "Select"}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreVersion(version);
                              }}
                              disabled={saving === `restore-${version.id}`}
                            >
                              {saving === `restore-${version.id}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              Restore
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </aside>
              <section className="overflow-y-auto bg-ink-950 p-8">
                {previewVersion ? (
                  <BriefPreview version={previewVersion} />
                ) : (
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                    SELECT A VERSION ON THE LEFT TO PREVIEW
                  </div>
                )}
              </section>
            </div>
          )}
        </Overlay>
      )}

      {/* ======================= COMPARE OVERLAY ======================= */}
      {compareOpen && compareLeft && compareRight && (
        <Overlay
          title={`COMPARE · V${compareLeft.versionNumber} ⟷ V${compareRight.versionNumber}`}
          onClose={() => setCompareOpen(false)}
        >
          <div className="grid h-full grid-cols-2 divide-x divide-ink-700 overflow-y-auto bg-ink-950">
            <CompareColumn
              version={compareLeft}
              other={compareRight}
              side="left"
              label="A"
            />
            <CompareColumn
              version={compareRight}
              other={compareLeft}
              side="right"
              label="B"
            />
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function SectionHeader({
  kicker,
  title,
  marker,
  meta,
}: {
  kicker: string;
  title: string;
  marker: string;
  meta?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="kicker-amber">{kicker}</div>
        <h2 className="display mt-2 text-3xl leading-[1.02] sm:text-4xl">{title}</h2>
        {meta && <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300">{meta}</p>}
      </div>
      <span className="section-marker shrink-0 pt-1">{marker}</span>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: "warn" }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">{label}</div>
      <div
        className={`num mt-2 font-mono text-3xl tabular-nums ${
          tone === "warn" ? "text-signal-amber" : "text-ink-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-ink-950 px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className="num mt-1 font-mono text-lg text-ink-100 tabular-nums">{value}</div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: "warn";
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">{label}</div>
      <div
        className={`mt-1.5 ${
          mono ? "font-mono text-sm uppercase tracking-[0.04em]" : "text-sm"
        } ${tone === "warn" ? "text-signal-amber" : "text-ink-100"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Banner({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const isError = tone === "error";
  return (
    <div
      className={`flex items-center gap-3 border bg-ink-950 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] ${
        isError
          ? "border-signal-red text-signal-red"
          : "border-signal-green text-signal-green"
      }`}
    >
      <span aria-hidden className={isError ? "text-signal-red" : "text-signal-green"}>
        {isError ? "ERR" : "OK"}
      </span>
      <span className="text-ink-100">{children}</span>
    </div>
  );
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
      <aside className="bg-ink-950 p-6">
        <div className="kicker-amber">DETAIL</div>
        <div className="mt-3 space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            NO NODE SELECTED
          </div>
          <p className="text-sm leading-6 text-ink-300">
            Select a node in the lineage graph to inspect inputs, outputs, and tied blockers or questions.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-5 bg-ink-950 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="kicker-amber">{detail.node.stage.toUpperCase()}</div>
          <h3 className="mt-2 font-mono text-sm uppercase tracking-[0.04em] text-ink-100">
            {detail.node.label}
          </h3>
          {detail.node.sublabel && (
            <p className="mt-1 text-xs text-ink-400">{detail.node.sublabel}</p>
          )}
        </div>
        <button
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 hover:text-signal-amber"
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
        >
          [×]
        </button>
      </div>

      {detail.node.meta && (
        <MetaRow label="UPDATED" value={(relative(detail.node.meta) || "—").toUpperCase()} mono />
      )}

      <DetailGroup title="INPUTS" nodes={detail.upstream} emptyText="NO UPSTREAM" />
      <DetailGroup title="OUTPUTS" nodes={detail.downstream} emptyText="NOTHING DOWNSTREAM" />

      {(detail.blockers.length > 0 || detail.questions.length > 0) && (
        <div className="space-y-2 border-t border-ink-800 pt-4">
          <div className="kicker">TIED CONCERNS</div>
          {detail.blockers.map((blocker) => (
            <div
              key={blocker.id}
              className="border-l border-signal-red bg-ink-875 px-3 py-2 text-xs text-ink-200"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-red">
                BLOCKER ·{" "}
              </span>
              {blocker.title}
            </div>
          ))}
          {detail.questions.map((question) => (
            <div
              key={question.id}
              className="border-l border-signal-amber bg-ink-875 px-3 py-2 text-xs text-ink-200"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-amber">
                QUESTION ·{" "}
              </span>
              {question.prompt}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function DetailGroup({
  title,
  nodes,
  emptyText,
}: {
  title: string;
  nodes: LineageNode[];
  emptyText: string;
}) {
  return (
    <div>
      <div className="kicker mb-2">{title}</div>
      {nodes.length === 0 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {nodes.map((node) => (
            <li key={node.id} className="border-l border-ink-700 bg-ink-875 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                {node.stage}
              </div>
              <div className="mt-0.5 text-sm text-ink-100">{node.label}</div>
              {node.sublabel && (
                <div className="mt-0.5 text-xs text-ink-400">{node.sublabel}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourcePill({ source, label }: { source: WorkflowBriefVersion["source"]; label?: string }) {
  const tone =
    source === "template" ? "pill--warn" : source === "restore" ? "pill--muted" : "pill--muted";
  const text =
    source === "template"
      ? `TEMPLATE${label ? ` · ${label.toUpperCase()}` : ""}`
      : source === "restore"
      ? (label ?? "RESTORED").toUpperCase()
      : "MANUAL";
  return <span className={`pill ${tone}`}>{text}</span>;
}

function Overlay({
  title,
  onClose,
  actions,
  children,
}: {
  title: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-950"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex items-center justify-between gap-4 border-b border-ink-700 px-8 py-5">
        <div className="flex items-baseline gap-4">
          <span className="kicker-amber">OVERLAY</span>
          <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-ink-100">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            aria-label="Close overlay"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function BriefPreview({ version }: { version: WorkflowBriefVersion }) {
  return (
    <div className="space-y-6 text-sm text-ink-200">
      <div>
        <div className="kicker-amber">VERSION</div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-mono text-2xl text-signal-amber">
            V{String(version.versionNumber).padStart(3, "0")}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
            {(relative(version.createdAt) || "—").toUpperCase()}
          </span>
        </div>
      </div>

      <PreviewSection label="SUMMARY">
        <p className="whitespace-pre-wrap text-ink-100">{version.summary}</p>
      </PreviewSection>
      {version.problemStatement && (
        <PreviewSection label="PROBLEM STATEMENT">
          <p>{version.problemStatement}</p>
        </PreviewSection>
      )}
      {version.desiredOutcome && (
        <PreviewSection label="DESIRED OUTCOME">
          <p>{version.desiredOutcome}</p>
        </PreviewSection>
      )}
      {version.audience && (
        <PreviewSection label="AUDIENCE">
          <p>{version.audience}</p>
        </PreviewSection>
      )}
      {version.constraints && (
        <PreviewSection label="CONSTRAINTS">
          <p>{version.constraints}</p>
        </PreviewSection>
      )}
      {version.goals.length > 0 && <PreviewList label="GOALS" items={version.goals} />}
      {version.targetCustomers.length > 0 && (
        <PreviewList label="TARGET CUSTOMERS" items={version.targetCustomers} />
      )}
      {version.successMetrics.length > 0 && (
        <PreviewList label="SUCCESS METRICS" items={version.successMetrics} />
      )}
    </div>
  );
}

function PreviewSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="kicker mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function PreviewList({ label, items }: { label: string; items: string[] }) {
  return (
    <PreviewSection label={label}>
      <ul className="space-y-1">
        {items.map((entry, index) => (
          <li
            key={`${entry}-${index}`}
            className="flex gap-2 border-l border-ink-700 pl-3 text-ink-100"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{entry}</span>
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}

const COMPARE_FIELDS: Array<{ key: keyof WorkflowBriefVersion; label: string; kind: "text" | "list" }> = [
  { key: "summary", label: "SUMMARY", kind: "text" },
  { key: "problemStatement", label: "PROBLEM STATEMENT", kind: "text" },
  { key: "desiredOutcome", label: "DESIRED OUTCOME", kind: "text" },
  { key: "audience", label: "AUDIENCE", kind: "text" },
  { key: "constraints", label: "CONSTRAINTS", kind: "text" },
  { key: "goals", label: "GOALS", kind: "list" },
  { key: "targetCustomers", label: "TARGET CUSTOMERS", kind: "list" },
  { key: "successMetrics", label: "SUCCESS METRICS", kind: "list" },
];

function CompareColumn({
  version,
  other,
  side,
  label,
}: {
  version: WorkflowBriefVersion;
  other: WorkflowBriefVersion;
  side: "left" | "right";
  label: string;
}) {
  return (
    <div className="space-y-6 p-8">
      <header className="border-b border-ink-700 pb-4">
        <div className="flex items-baseline gap-3">
          <span className="kicker-amber">[{label}]</span>
          <span className="font-mono text-2xl text-signal-amber">
            V{String(version.versionNumber).padStart(3, "0")}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <SourcePill source={version.source} label={version.sourceLabel} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {(relative(version.createdAt) || "—").toUpperCase()}
          </span>
        </div>
      </header>
      {COMPARE_FIELDS.map((field) => {
        const value = version[field.key] as string | string[];
        const counterpart = other[field.key] as string | string[];
        const changed =
          field.kind === "text"
            ? (value as string) !== (counterpart as string)
            : !arraysEqual(value as string[], counterpart as string[]);
        const marker = side === "left" ? "−" : "+";
        const markerColor = side === "left" ? "text-signal-red" : "text-signal-amber";
        return (
          <div key={field.key as string}>
            <div className="kicker mb-2">{field.label}</div>
            {field.kind === "text" ? (
              <p className={`whitespace-pre-wrap ${changed ? "text-ink-100" : "text-ink-500"}`}>
                {changed && (
                  <span className={`mr-2 font-mono ${markerColor}`}>{marker}</span>
                )}
                {(value as string) || (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    [EMPTY]
                  </span>
                )}
              </p>
            ) : (value as string[]).length === 0 ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                [EMPTY]
              </span>
            ) : (
              <ul className="space-y-1">
                {(value as string[]).map((entry, index) => {
                  const isChanged =
                    !(counterpart as string[]).includes(entry);
                  return (
                    <li
                      key={`${entry}-${index}`}
                      className={`flex gap-2 ${isChanged ? "text-ink-100" : "text-ink-500"}`}
                    >
                      <span className={`font-mono ${isChanged ? markerColor : "text-ink-700"}`}>
                        {isChanged ? marker : " "}
                      </span>
                      <span>{entry}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
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

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => entry === right[index]);
}

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
