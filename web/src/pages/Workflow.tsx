import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ClipboardList, GitCompare, History, Loader2, Plus, RefreshCw, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type {
  SaveWorkflowPlanItemInput,
  SaveWorkflowRequirementInput,
  WorkflowBrief,
  WorkflowBriefTemplate,
  WorkflowBriefVersion,
  WorkflowPlanItem,
  WorkflowPlanItemStatus,
  WorkflowRequirement,
  WorkflowRequirementPriority,
  WorkflowRequirementStatus,
} from "@/lib/types";

interface WorkflowState {
  brief: WorkflowBrief | null;
  requirements: WorkflowRequirement[];
  planItems: WorkflowPlanItem[];
  versions: WorkflowBriefVersion[];
  templates: WorkflowBriefTemplate[];
}

const EMPTY_STATE: WorkflowState = { brief: null, requirements: [], planItems: [], versions: [], templates: [] };

type CompareSelection = { left: string | null; right: string | null };

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [briefFormKey, setBriefFormKey] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<CompareSelection>({ left: null, right: null });
  const [compareOpen, setCompareOpen] = useState(false);

  const loadWorkflow = async () => {
    setLoading(true);
    setError(null);
    try {
      const [brief, requirements, planItems, versions, templates] = await Promise.all([
        api.getWorkflowBrief(),
        api.listWorkflowRequirements(),
        api.listWorkflowPlanItems(),
        api.listWorkflowBriefVersions().catch(() => [] as WorkflowBriefVersion[]),
        api.listWorkflowBriefTemplates().catch(() => [] as WorkflowBriefTemplate[]),
      ]);
      setState({ brief, requirements, planItems, versions, templates });
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
  }, []);

  const counts = useMemo(() => ({
    must: state.requirements.filter((entry) => entry.priority === "must").length,
    accepted: state.requirements.filter((entry) => entry.status === "accepted").length,
    done: state.planItems.filter((entry) => entry.status === "done").length,
  }), [state]);

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

  const applyTemplate = (template: WorkflowBriefTemplate) =>
    runUpdate(`template-${template.id}`, async () => {
      await api.applyWorkflowBriefTemplate(template.id);
      setShowTemplates(false);
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
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setShowTemplates((open) => !open)}
            disabled={loading || Boolean(saving)}
          >
            <Sparkles className="h-4 w-4" /> Start from template
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setShowHistory((open) => !open)}
            disabled={loading}
          >
            <History className="h-4 w-4" /> History
            {state.versions.length > 0 && (
              <span className="ml-1 rounded-full bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300">{state.versions.length}</span>
            )}
          </button>
          <button className="btn-ghost" type="button" onClick={loadWorkflow} disabled={loading || Boolean(saving)}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Must haves" value={counts.must} />
        <Stat label="Accepted" value={counts.accepted} />
        <Stat label="Plan done" value={`${counts.done}/${state.planItems.length}`} />
      </section>

      {error && <Status tone="error">{error}</Status>}
      {message && !error && <Status tone="success">{message}</Status>}

      {showTemplates && state.templates.length > 0 && (
        <section className="card mb-6 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-accent-500/12 text-accent-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink-100">Brief templates</h2>
                <p className="text-xs text-ink-500">Pick a template to populate the brief. Saves a new version.</p>
              </div>
            </div>
            <button type="button" className="text-ink-500 hover:text-ink-200" onClick={() => setShowTemplates(false)} aria-label="Close templates">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {state.templates.map((template) => (
              <article key={template.id} className="flex flex-col rounded-2xl border border-ink-800 bg-ink-950/40 p-4">
                <h3 className="text-sm font-medium text-ink-100">{template.name}</h3>
                <p className="mt-1 flex-1 text-xs text-ink-400">{template.description}</p>
                <button
                  type="button"
                  className="btn-primary mt-3 justify-center text-xs"
                  onClick={() => applyTemplate(template)}
                  disabled={saving === `template-${template.id}` || loading}
                >
                  {saving === `template-${template.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Use template
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {showHistory && (
        <section className="card mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-accent-500/12 text-accent-300">
                <History className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink-100">Brief history</h2>
                <p className="text-xs text-ink-500">Pick two versions to compare side-by-side, or restore an earlier draft.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={openCompare}
                disabled={!compareLeft || !compareRight || compareLeft.id === compareRight.id}
              >
                <GitCompare className="h-4 w-4" /> Compare selected
              </button>
              <button type="button" className="text-ink-500 hover:text-ink-200" onClick={() => setShowHistory(false)} aria-label="Close history">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {state.versions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-700 px-4 py-6 text-sm text-ink-500">
              No versions yet. Save the brief or apply a template to start tracking history.
            </div>
          ) : (
            <ol className="space-y-2">
              {state.versions.map((version) => {
                const selectedSlot =
                  compareSelection.left === version.id ? "A" : compareSelection.right === version.id ? "B" : null;
                return (
                  <li
                    key={version.id}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                      selectedSlot
                        ? "border-accent-400/60 bg-accent-500/8"
                        : "border-ink-800 bg-ink-950/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-100">
                        <span className="font-semibold">v{version.versionNumber}</span>
                        <SourceBadge source={version.source} label={version.sourceLabel} />
                        <span className="text-xs text-ink-500">{relative(version.createdAt)}</span>
                        {version.createdByDisplayName && (
                          <span className="text-xs text-ink-500">by {version.createdByDisplayName}</span>
                        )}
                      </div>
                      <p className="mt-1 max-w-3xl truncate text-sm text-ink-300">{version.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`btn-ghost text-xs ${selectedSlot ? "border-accent-400/60 text-accent-200" : ""}`}
                        onClick={() => toggleCompareSelection(version.id)}
                      >
                        {selectedSlot ? `Selected ${selectedSlot}` : "Select"}
                      </button>
                      <button type="button" className="btn-ghost text-xs" onClick={() => setPreviewVersionId(version.id)}>
                        Preview
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => restoreVersion(version)}
                        disabled={saving === `restore-${version.id}`}
                      >
                        {saving === `restore-${version.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Restore
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {loading ? (
        <div className="card flex items-center gap-3 p-6 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading workflow…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="card p-6">
            <SectionTitle icon={<ClipboardList className="h-4 w-4" />} title="Workspace Brief" />
            <form key={briefFormKey} className="mt-5 space-y-4" onSubmit={saveBrief}>
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

      {previewVersion && (
        <Modal title={`Brief v${previewVersion.versionNumber} preview`} onClose={() => setPreviewVersionId(null)}>
          <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-6 py-3">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <SourceBadge source={previewVersion.source} label={previewVersion.sourceLabel} />
              <span>{relative(previewVersion.createdAt)}</span>
              {previewVersion.createdByDisplayName && <span>by {previewVersion.createdByDisplayName}</span>}
            </div>
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => restoreVersion(previewVersion)}
              disabled={saving === `restore-${previewVersion.id}`}
            >
              <RotateCcw className="h-3 w-3" /> Restore this version
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <BriefPreview version={previewVersion} />
          </div>
        </Modal>
      )}

      {compareOpen && compareLeft && compareRight && (
        <Modal title={`Compare v${compareLeft.versionNumber} vs v${compareRight.versionNumber}`} onClose={() => setCompareOpen(false)} wide>
          <div className="grid grid-cols-2 gap-px border-b border-ink-800 bg-ink-800 text-xs text-ink-400">
            <div className="bg-ink-900 px-6 py-3">
              <div className="font-semibold text-ink-100">v{compareLeft.versionNumber} (A)</div>
              <div className="mt-1 flex items-center gap-2"><SourceBadge source={compareLeft.source} label={compareLeft.sourceLabel} /> <span>{relative(compareLeft.createdAt)}</span></div>
            </div>
            <div className="bg-ink-900 px-6 py-3">
              <div className="font-semibold text-ink-100">v{compareRight.versionNumber} (B)</div>
              <div className="mt-1 flex items-center gap-2"><SourceBadge source={compareRight.source} label={compareRight.sourceLabel} /> <span>{relative(compareRight.createdAt)}</span></div>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <CompareGrid left={compareLeft} right={compareRight} />
          </div>
        </Modal>
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

function SourceBadge({ source, label }: { source: WorkflowBriefVersion["source"]; label?: string }) {
  const tone =
    source === "template"
      ? "border-accent-400/40 bg-accent-500/10 text-accent-200"
      : source === "restore"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
      : "border-ink-700 bg-ink-800/60 text-ink-300";
  const text = source === "template" ? `Template${label ? ` · ${label}` : ""}` : source === "restore" ? label ?? "Restored" : "Manual";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}>{text}</span>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-5xl" : "max-w-2xl"} overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-card`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-6 py-4">
          <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
          <button type="button" className="text-ink-500 hover:text-ink-200" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BriefPreview({ version }: { version: WorkflowBriefVersion }) {
  return (
    <div className="space-y-4 text-sm text-ink-200">
      <PreviewSection label="Summary"><p className="whitespace-pre-wrap text-ink-100">{version.summary}</p></PreviewSection>
      {version.problemStatement && <PreviewSection label="Problem statement"><p>{version.problemStatement}</p></PreviewSection>}
      {version.desiredOutcome && <PreviewSection label="Desired outcome"><p>{version.desiredOutcome}</p></PreviewSection>}
      {version.audience && <PreviewSection label="Audience"><p>{version.audience}</p></PreviewSection>}
      {version.constraints && <PreviewSection label="Constraints"><p>{version.constraints}</p></PreviewSection>}
      {version.goals.length > 0 && <PreviewList label="Goals" items={version.goals} />}
      {version.targetCustomers.length > 0 && <PreviewList label="Target customers" items={version.targetCustomers} />}
      {version.successMetrics.length > 0 && <PreviewList label="Success metrics" items={version.successMetrics} />}
    </div>
  );
}

function PreviewSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      {children}
    </div>
  );
}

function PreviewList({ label, items }: { label: string; items: string[] }) {
  return (
    <PreviewSection label={label}>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
      </ul>
    </PreviewSection>
  );
}

const COMPARE_FIELDS: Array<{ key: keyof WorkflowBriefVersion; label: string; kind: "text" | "list" }> = [
  { key: "summary", label: "Summary", kind: "text" },
  { key: "problemStatement", label: "Problem statement", kind: "text" },
  { key: "desiredOutcome", label: "Desired outcome", kind: "text" },
  { key: "audience", label: "Audience", kind: "text" },
  { key: "constraints", label: "Constraints", kind: "text" },
  { key: "goals", label: "Goals", kind: "list" },
  { key: "targetCustomers", label: "Target customers", kind: "list" },
  { key: "successMetrics", label: "Success metrics", kind: "list" },
];

function CompareGrid({ left, right }: { left: WorkflowBriefVersion; right: WorkflowBriefVersion }) {
  return (
    <div className="divide-y divide-ink-800">
      {COMPARE_FIELDS.map((field) => {
        const leftValue = left[field.key] as string | string[];
        const rightValue = right[field.key] as string | string[];
        const changed = field.kind === "text"
          ? (leftValue as string) !== (rightValue as string)
          : !arraysEqual(leftValue as string[], rightValue as string[]);
        return (
          <div key={field.key as string} className="grid grid-cols-2 gap-px bg-ink-800">
            <CompareCell label={field.label} value={leftValue} kind={field.kind} changed={changed} side="left" />
            <CompareCell label={field.label} value={rightValue} kind={field.kind} changed={changed} side="right" />
          </div>
        );
      })}
    </div>
  );
}

function CompareCell({
  label,
  value,
  kind,
  changed,
  side,
}: {
  label: string;
  value: string | string[];
  kind: "text" | "list";
  changed: boolean;
  side: "left" | "right";
}) {
  const tone = changed
    ? side === "left"
      ? "bg-rose-500/8"
      : "bg-emerald-500/8"
    : "bg-ink-900";
  return (
    <div className={`px-6 py-4 text-sm text-ink-200 ${tone}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      {kind === "text" ? (
        <p className="whitespace-pre-wrap text-ink-100">{(value as string) || <span className="text-ink-500">—</span>}</p>
      ) : (value as string[]).length === 0 ? (
        <span className="text-ink-500">—</span>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {(value as string[]).map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
        </ul>
      )}
    </div>
  );
}

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
