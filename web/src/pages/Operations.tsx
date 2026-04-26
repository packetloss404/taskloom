import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, History, Loader2, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import type {
  ConfirmWorkflowReleaseInput,
  ReleaseHistoryPayload,
  SaveWorkflowBlockerInput,
  SaveWorkflowQuestionInput,
  SaveWorkflowValidationEvidenceInput,
  WorkflowBlocker,
  WorkflowBlockerSeverity,
  WorkflowQuestion,
  WorkflowReleaseConfirmation,
  WorkflowValidationEvidence,
  WorkflowValidationStatus,
} from "@/lib/types";

type WorkflowPayload<T, K extends string> = T[] | Record<K, T[]>;
type SinglePayload<T, K extends string> = T | Record<K, T>;

type WorkflowApi = typeof api &
  Partial<{
    listWorkflowBlockers: () => Promise<WorkflowPayload<WorkflowBlocker, "blockers">>;
    createWorkflowBlocker: (body: SaveWorkflowBlockerInput) => Promise<SinglePayload<WorkflowBlocker, "blocker">>;
    updateWorkflowBlocker: (
      id: string,
      body: Partial<SaveWorkflowBlockerInput>,
    ) => Promise<SinglePayload<WorkflowBlocker, "blocker">>;
    listWorkflowQuestions: () => Promise<WorkflowPayload<WorkflowQuestion, "questions">>;
    createWorkflowQuestion: (body: SaveWorkflowQuestionInput) => Promise<SinglePayload<WorkflowQuestion, "question">>;
    updateWorkflowQuestion: (
      id: string,
      body: Partial<SaveWorkflowQuestionInput>,
    ) => Promise<SinglePayload<WorkflowQuestion, "question">>;
    listWorkflowValidationEvidence: () => Promise<WorkflowPayload<WorkflowValidationEvidence, "validationEvidence">>;
    createWorkflowValidationEvidence: (
      body: SaveWorkflowValidationEvidenceInput,
    ) => Promise<SinglePayload<WorkflowValidationEvidence, "validationEvidence">>;
    updateWorkflowValidationEvidence: (
      id: string,
      body: Partial<SaveWorkflowValidationEvidenceInput>,
    ) => Promise<SinglePayload<WorkflowValidationEvidence, "validationEvidence">>;
    getWorkflowReleaseConfirmation: () => Promise<SinglePayload<WorkflowReleaseConfirmation, "releaseConfirmation">>;
    confirmWorkflowRelease: (
      body: ConfirmWorkflowReleaseInput,
    ) => Promise<SinglePayload<WorkflowReleaseConfirmation, "releaseConfirmation">>;
  }>;

interface OperationsState {
  blockers: WorkflowBlocker[];
  questions: WorkflowQuestion[];
  validationEvidence: WorkflowValidationEvidence[];
  releaseConfirmation: WorkflowReleaseConfirmation | null;
  releaseHistory: ReleaseHistoryPayload;
}

const workflowApi = api as WorkflowApi;
const EMPTY_HISTORY: ReleaseHistoryPayload = {
  releases: [],
  preflight: { passedEvidence: 0, failedEvidence: 0, pendingEvidence: 0, openBlockers: 0, openQuestions: 0, ready: false },
};
const EMPTY_STATE: OperationsState = {
  blockers: [],
  questions: [],
  validationEvidence: [],
  releaseConfirmation: null,
  releaseHistory: EMPTY_HISTORY,
};

export default function OperationsPage() {
  const { session } = useAuth();
  const [state, setState] = useState<OperationsState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadOperations = async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await fetchOperations());
    } catch (loadError) {
      setError((loadError as Error).message);
      setState(EMPTY_STATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOperations();
  }, []);

  const counts = useMemo(() => {
    const openBlockers = state.blockers.filter((blocker) => blocker.status === "open").length;
    const openQuestions = state.questions.filter((question) => question.status === "open").length;
    const failedValidation = state.validationEvidence.filter((evidence) => evidence.status === "failed").length;
    const passedValidation = state.validationEvidence.filter((evidence) => evidence.status === "passed").length;
    return { openBlockers, openQuestions, failedValidation, passedValidation };
  }, [state]);

  const runUpdate = async (label: string, action: () => Promise<OperationsState | void>) => {
    setSaving(label);
    setMessage(null);
    setError(null);
    try {
      const next = await action();
      setState(next ?? (await fetchOperations()));
      setMessage("Operations updated.");
    } catch (updateError) {
      setError((updateError as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const addBlocker = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = fieldValue(form, "title");
    if (!title) return;

    await runUpdate("blocker", async () => {
      await createBlocker({
        title,
        detail: fieldValue(form, "detail"),
        severity: fieldValue(form, "severity") as WorkflowBlockerSeverity,
        dependency: form.get("dependency") === "on",
        status: "open",
      });
      event.currentTarget.reset();
    });
  };

  const updateBlockerStatus = (blocker: WorkflowBlocker) =>
    runUpdate(`blocker-${blocker.id}`, async () => {
      await updateBlocker(blocker.id, {
        title: blocker.title,
        status: blocker.status === "open" ? "resolved" : "open",
      });
    });

  const addQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prompt = fieldValue(form, "prompt");
    if (!prompt) return;

    await runUpdate("question", async () => {
      await createQuestion({
        prompt,
        answer: "",
        status: "open",
      });
      event.currentTarget.reset();
    });
  };

  const saveQuestionAnswer = (question: WorkflowQuestion, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answer = fieldValue(form, "answer");

    return runUpdate(`question-${question.id}`, async () => {
      await updateQuestion(question.id, {
        prompt: question.prompt,
        answer,
        status: answer ? "answered" : "open",
      });
    });
  };

  const addEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = fieldValue(form, "title");
    if (!title) return;

    await runUpdate("evidence", async () => {
      await createValidationEvidence({
        title,
        detail: fieldValue(form, "detail"),
        status: fieldValue(form, "status") as WorkflowValidationStatus,
        source: fieldValue(form, "source"),
      });
      event.currentTarget.reset();
    });
  };

  const updateEvidenceStatus = (evidence: WorkflowValidationEvidence, status: WorkflowValidationStatus) =>
    runUpdate(`evidence-${evidence.id}`, async () => {
      await updateValidationEvidence(evidence.id, {
        title: evidence.title,
        detail: evidence.detail,
        source: evidence.source,
        status,
      });
    });

  const confirmRelease = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runUpdate("release", async () => {
      await saveReleaseConfirmation({
        confirmed: form.get("confirmed") === "on",
        summary: fieldValue(form, "summary"),
        confirmedBy: fieldValue(form, "confirmedBy") || session?.user.displayName || session?.user.email,
      });
    });
  };

  return (
    <>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-100">Operations</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-400">
            Blockers, questions, validation evidence, and release confirmation for the current workspace.
          </p>
        </div>
        <button className="btn-ghost" type="button" onClick={loadOperations} disabled={loading || Boolean(saving)}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open blockers" value={counts.openBlockers} tone={counts.openBlockers > 0 ? "danger" : "good"} />
        <Stat label="Open questions" value={counts.openQuestions} tone={counts.openQuestions > 0 ? "warn" : "good"} />
        <Stat label="Passed evidence" value={counts.passedValidation} tone="good" />
        <Stat label="Failed checks" value={counts.failedValidation} tone={counts.failedValidation > 0 ? "danger" : "muted"} />
      </section>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {message && !error && (
        <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      {loading ? (
        <div className="card flex items-center gap-3 p-6 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading operations…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <WorkflowSection
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Blockers"
            action={
              <form className="grid gap-3 lg:grid-cols-[1fr_150px_auto] lg:items-end" onSubmit={addBlocker}>
                <Field label="Title">
                  <input name="title" className="ops-input" required placeholder="Dependency, access, or scope blocker" />
                </Field>
                <Field label="Severity">
                  <select name="severity" className="ops-input" defaultValue="medium">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </Field>
                <button className="btn-primary justify-center" type="submit" disabled={saving === "blocker"}>
                  Add blocker
                </button>
                <div className="lg:col-span-2">
                  <Field label="Detail">
                    <input name="detail" className="ops-input" placeholder="Owner, impact, or next step" />
                  </Field>
                </div>
                <label className="flex items-center gap-2 self-center text-sm text-ink-300">
                  <input name="dependency" type="checkbox" className="h-4 w-4 rounded border-ink-600 bg-ink-950 text-accent-500" />
                  Dependency
                </label>
              </form>
            }
          >
            {state.blockers.length === 0 ? (
              <EmptyState>No blockers tracked.</EmptyState>
            ) : (
              <div className="space-y-3">
                {state.blockers.map((blocker) => (
                  <RecordRow
                    key={blocker.id}
                    title={blocker.title}
                    detail={blocker.detail}
                    meta={`${blocker.severity} severity${blocker.dependency ? " · dependency" : ""} · updated ${relative(blocker.updatedAt)}`}
                    badge={<StatusBadge value={blocker.status} tone={blocker.status === "open" ? "danger" : "good"} />}
                    action={
                      <button className="btn-ghost" type="button" onClick={() => updateBlockerStatus(blocker)} disabled={saving === `blocker-${blocker.id}`}>
                        {blocker.status === "open" ? "Resolve" : "Reopen"}
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            icon={<HelpCircle className="h-4 w-4" />}
            title="Open Questions"
            action={
              <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={addQuestion}>
                <div className="flex-1">
                  <Field label="Question">
                    <input name="prompt" className="ops-input" required placeholder="Decision or clarification needed" />
                  </Field>
                </div>
                <button className="btn-primary justify-center" type="submit" disabled={saving === "question"}>
                  Add question
                </button>
              </form>
            }
          >
            {state.questions.length === 0 ? (
              <EmptyState>No open questions tracked.</EmptyState>
            ) : (
              <div className="space-y-3">
                {state.questions.map((question) => (
                  <form
                    key={question.id}
                    className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4"
                    onSubmit={(event) => saveQuestionAnswer(question, event)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-ink-100">{question.prompt}</h3>
                        <p className="mt-1 text-xs text-ink-500">Updated {relative(question.updatedAt)}</p>
                      </div>
                      <StatusBadge value={question.status} tone={question.status === "open" ? "warn" : "good"} />
                    </div>
                    <textarea
                      name="answer"
                      defaultValue={question.answer}
                      rows={3}
                      className="ops-input mt-4 resize-none"
                      placeholder="Answer or decision"
                    />
                    <div className="mt-3 flex justify-end">
                      <button className="btn-ghost" type="submit" disabled={saving === `question-${question.id}`}>
                        Save answer
                      </button>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Validation Evidence"
            action={
              <form className="grid gap-3 lg:grid-cols-[1fr_140px_auto] lg:items-end" onSubmit={addEvidence}>
                <Field label="Title">
                  <input name="title" className="ops-input" required placeholder="Test run, demo, metric, or review" />
                </Field>
                <Field label="Status">
                  <select name="status" className="ops-input" defaultValue="pending">
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </Field>
                <button className="btn-primary justify-center" type="submit" disabled={saving === "evidence"}>
                  Add evidence
                </button>
                <Field label="Source">
                  <input name="source" className="ops-input" placeholder="URL, run ID, or owner" />
                </Field>
                <div className="lg:col-span-2">
                  <Field label="Detail">
                    <input name="detail" className="ops-input" placeholder="Result, scope, or follow-up" />
                  </Field>
                </div>
              </form>
            }
          >
            {state.validationEvidence.length === 0 ? (
              <EmptyState>No validation evidence tracked.</EmptyState>
            ) : (
              <div className="space-y-3">
                {state.validationEvidence.map((evidence) => (
                  <RecordRow
                    key={evidence.id}
                    title={evidence.title}
                    detail={evidence.detail}
                    meta={`${evidence.source || "No source"} · updated ${relative(evidence.updatedAt)}`}
                    badge={<StatusBadge value={evidence.status} tone={validationTone(evidence.status)} />}
                    action={
                      <select
                        className="ops-input min-w-32"
                        value={evidence.status}
                        onChange={(event) => updateEvidenceStatus(evidence, event.target.value as WorkflowValidationStatus)}
                        disabled={saving === `evidence-${evidence.id}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                    }
                  />
                ))}
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            icon={<Rocket className="h-4 w-4" />}
            title="Release Confirmation"
            action={
              <form className="space-y-4" onSubmit={confirmRelease}>
                <ReleasePreflightPanel preflight={state.releaseHistory.preflight} />
                <Field label="Summary">
                  <textarea
                    name="summary"
                    defaultValue={state.releaseConfirmation?.summary ?? ""}
                    rows={4}
                    className="ops-input resize-none"
                    placeholder="Release notes, caveats, or rollback context"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Confirmed by">
                    <input
                      name="confirmedBy"
                      className="ops-input"
                      defaultValue={state.releaseConfirmation?.confirmedBy || session?.user.displayName || session?.user.email || ""}
                    />
                  </Field>
                  <label className="flex h-10 items-center gap-2 text-sm text-ink-300">
                    <input
                      name="confirmed"
                      type="checkbox"
                      defaultChecked={state.releaseConfirmation?.confirmed ?? false}
                      className="h-4 w-4 rounded border-ink-600 bg-ink-950 text-accent-500"
                    />
                    Confirmed
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ReleaseStatus release={state.releaseConfirmation} />
                  <button className="btn-primary" type="submit" disabled={saving === "release"}>
                    Promote release
                  </button>
                </div>
              </form>
            }
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/12 text-accent-300">
                    {state.releaseConfirmation?.confirmed ? <CheckCircle2 className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink-100">
                      {state.releaseConfirmation?.confirmed ? "Release confirmed" : "Release pending"}
                    </div>
                    <div className="mt-1 text-xs text-ink-500">
                      Updated {relative(state.releaseConfirmation?.updatedAt)}
                    </div>
                  </div>
                </div>
              </div>
              <ReleaseHistoryList history={state.releaseHistory} />
            </div>
          </WorkflowSection>
        </div>
      )}

      <style>{`
        .ops-input {
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
        .ops-input::placeholder { color: rgb(107 110 133); }
        .ops-input:focus {
          border-color: rgb(161 161 170 / 0.5);
          box-shadow: 0 0 0 3px rgb(161 161 170 / 0.14);
        }
        .ops-input:disabled { opacity: 0.65; cursor: not-allowed; }
      `}</style>
    </>
  );
}

function WorkflowSection({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-500/12 text-accent-300">{icon}</div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">{title}</h2>
      </div>
      <div className="mb-5">{action}</div>
      {children}
    </section>
  );
}

function RecordRow({
  title,
  detail,
  meta,
  badge,
  action,
}: {
  title: string;
  detail: string;
  meta: string;
  badge: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink-100">{title}</h3>
          {detail && <p className="mt-1 text-sm text-ink-400">{detail}</p>}
          <p className="mt-2 text-xs text-ink-500">{meta}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-200">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "danger" | "good" | "muted" | "warn" }) {
  const color = {
    danger: "text-rose-300",
    good: "text-emerald-300",
    muted: "text-ink-200",
    warn: "text-amber-300",
  }[tone];

  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ value, tone }: { value: string; tone: "danger" | "good" | "muted" | "warn" }) {
  const color = {
    danger: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    muted: "border-ink-700 bg-ink-900/80 text-ink-300",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  }[tone];

  return <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${color}`}>{value.replaceAll("_", " ")}</span>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-500">{children}</div>;
}

function ReleaseStatus({ release }: { release: WorkflowReleaseConfirmation | null }) {
  if (!release) return <span className="text-xs text-ink-500">No release record yet.</span>;
  if (!release.confirmed) return <StatusBadge value="pending" tone="warn" />;
  return (
    <span className="text-xs text-ink-400">
      Confirmed by <span className="text-ink-200">{release.confirmedBy || "Unknown"}</span> {relative(release.confirmedAt)}
    </span>
  );
}

function validationTone(status: WorkflowValidationStatus) {
  if (status === "passed") return "good";
  if (status === "failed") return "danger";
  return "warn";
}

function ReleasePreflightPanel({ preflight }: { preflight: ReleaseHistoryPayload["preflight"] }) {
  const checks = [
    {
      label: "Validation evidence passed",
      ok: preflight.passedEvidence > 0,
      detail: `${preflight.passedEvidence} passed${preflight.pendingEvidence ? ` · ${preflight.pendingEvidence} pending` : ""}`,
    },
    {
      label: "No failed validation",
      ok: preflight.failedEvidence === 0,
      detail: preflight.failedEvidence === 0 ? "All checks clear" : `${preflight.failedEvidence} failed check${preflight.failedEvidence === 1 ? "" : "s"}`,
    },
    {
      label: "No open blockers",
      ok: preflight.openBlockers === 0,
      detail: preflight.openBlockers === 0 ? "No blockers" : `${preflight.openBlockers} open blocker${preflight.openBlockers === 1 ? "" : "s"}`,
    },
  ];

  const banner = preflight.ready
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
    : "border-amber-400/30 bg-amber-500/10 text-amber-200";

  return (
    <div className={`rounded-2xl border p-4 ${banner}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {preflight.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {preflight.ready ? "Release preflight passed" : "Release preflight has warnings"}
        {preflight.openQuestions > 0 && (
          <span className="ml-auto text-xs opacity-80">
            {preflight.openQuestions} open question{preflight.openQuestions === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2">
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
              check.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}>
              {check.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            </span>
            <span className="text-ink-200">{check.label}</span>
            <span className="ml-auto text-ink-500">{check.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReleaseHistoryList({ history }: { history: ReleaseHistoryPayload }) {
  if (history.releases.length === 0) {
    return <EmptyState>No releases recorded yet.</EmptyState>;
  }
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
        <History className="h-3.5 w-3.5" /> Release history
      </div>
      <ol className="space-y-3">
        {history.releases.map((release) => (
          <li key={release.id} className="flex items-start gap-3 border-l-2 border-ink-800 pl-3">
            <div className={`mt-1 grid h-2 w-2 shrink-0 place-items-center rounded-full ${
              release.confirmed ? "bg-emerald-400" : release.status === "rolled_back" ? "bg-rose-400" : "bg-amber-400"
            }`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-sm text-ink-100">{release.versionLabel}</span>
                <StatusBadge value={release.status} tone={release.confirmed ? "good" : release.status === "rolled_back" ? "danger" : "warn"} />
              </div>
              {release.summary && <p className="mt-1 text-xs text-ink-400">{release.summary}</p>}
              <p className="mt-1 text-[11px] text-ink-500">
                {release.confirmedBy ? `${release.confirmedBy} · ` : ""}
                {relative(release.confirmedAt ?? release.updatedAt)}
                {release.validationEvidenceIds.length > 0 && ` · ${release.validationEvidenceIds.length} evidence link${release.validationEvidenceIds.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

async function fetchOperations(): Promise<OperationsState> {
  const [blockers, questions, validationEvidence, releaseConfirmation, releaseHistory] = await Promise.all([
    listBlockers(),
    listQuestions(),
    listValidationEvidence(),
    getReleaseConfirmation(),
    getReleaseHistory(),
  ]);

  return { blockers, questions, validationEvidence, releaseConfirmation, releaseHistory };
}

async function getReleaseHistory(): Promise<ReleaseHistoryPayload> {
  try {
    return await api.getReleaseHistory();
  } catch {
    return EMPTY_HISTORY;
  }
}

async function listBlockers() {
  const payload = workflowApi.listWorkflowBlockers
    ? await workflowApi.listWorkflowBlockers()
    : await request<WorkflowPayload<WorkflowBlocker, "blockers">>("/api/app/workflow/blockers");
  return normalizeList(payload, "blockers");
}

async function createBlocker(body: SaveWorkflowBlockerInput) {
  const payload = workflowApi.createWorkflowBlocker
    ? await workflowApi.createWorkflowBlocker(body)
    : await request<SinglePayload<WorkflowBlocker, "blocker">>("/api/app/workflow/blockers", {
        method: "POST",
        body: JSON.stringify(body),
      });
  return normalizeSingle(payload, "blocker");
}

async function updateBlocker(id: string, body: Partial<SaveWorkflowBlockerInput>) {
  const payload = workflowApi.updateWorkflowBlocker
    ? await workflowApi.updateWorkflowBlocker(id, body)
    : await request<SinglePayload<WorkflowBlocker, "blocker">>(`/api/app/workflow/blockers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
  return normalizeSingle(payload, "blocker");
}

async function listQuestions() {
  const payload = workflowApi.listWorkflowQuestions
    ? await workflowApi.listWorkflowQuestions()
    : await request<WorkflowPayload<WorkflowQuestion, "questions">>("/api/app/workflow/questions");
  return normalizeList(payload, "questions");
}

async function createQuestion(body: SaveWorkflowQuestionInput) {
  const payload = workflowApi.createWorkflowQuestion
    ? await workflowApi.createWorkflowQuestion(body)
    : await request<SinglePayload<WorkflowQuestion, "question">>("/api/app/workflow/questions", {
        method: "POST",
        body: JSON.stringify(body),
      });
  return normalizeSingle(payload, "question");
}

async function updateQuestion(id: string, body: Partial<SaveWorkflowQuestionInput>) {
  const payload = workflowApi.updateWorkflowQuestion
    ? await workflowApi.updateWorkflowQuestion(id, body)
    : await request<SinglePayload<WorkflowQuestion, "question">>(`/api/app/workflow/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
  return normalizeSingle(payload, "question");
}

async function listValidationEvidence() {
  const payload = workflowApi.listWorkflowValidationEvidence
    ? await workflowApi.listWorkflowValidationEvidence()
    : await request<WorkflowPayload<WorkflowValidationEvidence, "validationEvidence">>("/api/app/workflow/validation-evidence");
  return normalizeList(payload, "validationEvidence");
}

async function createValidationEvidence(body: SaveWorkflowValidationEvidenceInput) {
  const payload = workflowApi.createWorkflowValidationEvidence
    ? await workflowApi.createWorkflowValidationEvidence(body)
    : await request<SinglePayload<WorkflowValidationEvidence, "validationEvidence">>("/api/app/workflow/validation-evidence", {
        method: "POST",
        body: JSON.stringify(body),
      });
  return normalizeSingle(payload, "validationEvidence");
}

async function updateValidationEvidence(id: string, body: Partial<SaveWorkflowValidationEvidenceInput>) {
  const payload = workflowApi.updateWorkflowValidationEvidence
    ? await workflowApi.updateWorkflowValidationEvidence(id, body)
    : await request<SinglePayload<WorkflowValidationEvidence, "validationEvidence">>(`/api/app/workflow/validation-evidence/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
  return normalizeSingle(payload, "validationEvidence");
}

async function getReleaseConfirmation() {
  const payload = workflowApi.getWorkflowReleaseConfirmation
    ? await workflowApi.getWorkflowReleaseConfirmation()
    : await request<SinglePayload<WorkflowReleaseConfirmation, "releaseConfirmation">>("/api/app/workflow/release-confirmation");
  return normalizeSingle(payload, "releaseConfirmation");
}

async function saveReleaseConfirmation(body: ConfirmWorkflowReleaseInput) {
  const payload = workflowApi.confirmWorkflowRelease
    ? await workflowApi.confirmWorkflowRelease(body)
    : await request<SinglePayload<WorkflowReleaseConfirmation, "releaseConfirmation">>("/api/app/workflow/release-confirmation", {
        method: "POST",
        body: JSON.stringify(body),
      });
  return normalizeSingle(payload, "releaseConfirmation");
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : `${response.status} ${response.statusText}`);
  }
  return payload as T;
}

function normalizeList<T, K extends string>(payload: WorkflowPayload<T, K>, key: K): T[] {
  if (Array.isArray(payload)) return payload;
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

function normalizeSingle<T, K extends string>(payload: SinglePayload<T, K>, key: K): T {
  if (payload && typeof payload === "object" && key in payload) {
    return (payload as Record<K, T>)[key];
  }
  return payload as T;
}

function fieldValue(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
