import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, History, Loader2, RefreshCw, Rocket, ShieldCheck, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import StreamingTextDemo from "@/components/StreamingTextDemo";
import UsageSummaryCard from "@/components/UsageSummaryCard";
import { relative } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { canManageWorkspaceRole } from "@/lib/roles";
import type {
  ConfirmWorkflowReleaseInput,
  JobRecord,
  JobStatus,
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
    listJobs: (limit?: number) => Promise<JobRecord[]>;
    cancelJob: (id: string) => Promise<JobRecord>;
  }>;

interface OperationsState {
  blockers: WorkflowBlocker[];
  questions: WorkflowQuestion[];
  validationEvidence: WorkflowValidationEvidence[];
  releaseConfirmation: WorkflowReleaseConfirmation | null;
  releaseHistory: ReleaseHistoryPayload;
  jobs: JobRecord[];
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
  jobs: [],
};

export default function OperationsPage() {
  const { session } = useAuth();
  const isViewer = session?.workspace.role === "viewer";
  const canManageOperations = canManageWorkspaceRole(session?.workspace.role);
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
    const activeJobs = state.jobs.filter((job) => job.status === "queued" || job.status === "running").length;
    const failedJobs = state.jobs.filter((job) => job.status === "failed").length;
    return { openBlockers, openQuestions, failedValidation, passedValidation, activeJobs, failedJobs };
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

  const cancelJob = (job: JobRecord) =>
    runUpdate(`job-${job.id}`, async () => {
      await workflowApi.cancelJob?.(job.id);
    });

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <div className="kicker mb-3">OPERATIONS · LIVE WORKSPACE STATUS</div>
          <h1 className="display-xl">Operations.</h1>
          <p className="mt-4 max-w-xl font-mono text-xs text-ink-400">
            <span className="text-ink-500">blockers · questions · validation evidence · release confirmation · job queue</span>
          </p>
          {session?.workspace.role && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Workspace role · {session.workspace.role}{isViewer ? " · view-only operations" : ""}
            </p>
          )}
        </div>
        <button className="btn-ghost" type="button" onClick={loadOperations} disabled={loading || Boolean(saving)}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <section className="grid grid-cols-2 divide-x divide-ink-700 border-y border-ink-700 lg:grid-cols-5">
        <Stat label="OPEN BLOCKERS" value={counts.openBlockers} tone={counts.openBlockers > 0 ? "danger" : "good"} />
        <Stat label="OPEN QUESTIONS" value={counts.openQuestions} tone={counts.openQuestions > 0 ? "warn" : "good"} />
        <Stat label="PASSED EVIDENCE" value={counts.passedValidation} tone="good" />
        <Stat label="FAILED CHECKS" value={counts.failedValidation} tone={counts.failedValidation > 0 ? "danger" : "muted"} />
        <Stat label="ACTIVE JOBS" value={counts.activeJobs} tone={counts.failedJobs > 0 ? "warn" : counts.activeJobs > 0 ? "good" : "muted"} />
      </section>

      {error && (
        <div className="mt-6 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          ERR · {error}
        </div>
      )}
      {message && !error && (
        <div className="mt-6 border border-signal-green/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-green">
          OK · {message}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING OPERATIONS</span>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <WorkflowSection
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Job Queue"
            action={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="kicker mb-1">QUEUE HEALTH</div>
                  <p className="font-mono text-xs text-ink-500">
                    {state.jobs.length} recent jobs · {counts.activeJobs} active · {counts.failedJobs} failed
                  </p>
                </div>
                <button className="btn-ghost" type="button" onClick={loadOperations} disabled={loading || Boolean(saving)}>
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh queue
                </button>
              </div>
            }
          >
            {state.jobs.length === 0 ? (
              <EmptyState>No queued jobs.</EmptyState>
            ) : (
              <div className="space-y-3">
                {state.jobs.map((job) => (
                  <RecordRow
                    key={job.id}
                    title={job.type}
                    detail={job.error || summarizeJobPayload(job.payload)}
                    meta={jobMeta(job)}
                    badge={<StatusBadge value={job.status} tone={jobTone(job.status)} />}
                    action={
                      canManageOperations && canCancelJob(job) ? (
                        <button className="btn-ghost" type="button" onClick={() => cancelJob(job)} disabled={saving === `job-${job.id}`}>
                          {saving === `job-${job.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          Cancel
                        </button>
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Blockers"
            action={
              isViewer ? <ReadOnlyRoleNotice /> : <form className="grid gap-3 lg:grid-cols-[1fr_150px_auto] lg:items-end" onSubmit={addBlocker}>
                <Field label="Title">
                  <input name="title" className="workflow-input" required placeholder="Dependency, access, or scope blocker" />
                </Field>
                <Field label="Severity">
                  <select name="severity" className="workflow-input" defaultValue="medium">
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
                    <input name="detail" className="workflow-input" placeholder="Owner, impact, or next step" />
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
                      isViewer ? null : (
                      <button className="btn-ghost" type="button" onClick={() => updateBlockerStatus(blocker)} disabled={saving === `blocker-${blocker.id}`}>
                        {blocker.status === "open" ? "Resolve" : "Reopen"}
                      </button>
                      )
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
              isViewer ? <ReadOnlyRoleNotice /> : <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={addQuestion}>
                <div className="flex-1">
                  <Field label="Question">
                    <input name="prompt" className="workflow-input" required placeholder="Decision or clarification needed" />
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
                    className="border-t border-ink-700 py-3 first:border-t-0"
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
                      className="workflow-input mt-4 resize-none"
                      placeholder="Answer or decision"
                      disabled={isViewer}
                    />
                    {!isViewer && (
                      <div className="mt-3 flex justify-end">
                        <button className="btn-ghost" type="submit" disabled={saving === `question-${question.id}`}>
                          Save answer
                        </button>
                      </div>
                    )}
                  </form>
                ))}
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Validation Evidence"
            action={
              isViewer ? <ReadOnlyRoleNotice /> : <form className="grid gap-3 lg:grid-cols-[1fr_140px_auto] lg:items-end" onSubmit={addEvidence}>
                <Field label="Title">
                  <input name="title" className="workflow-input" required placeholder="Test run, demo, metric, or review" />
                </Field>
                <Field label="Status">
                  <select name="status" className="workflow-input" defaultValue="pending">
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </Field>
                <button className="btn-primary justify-center" type="submit" disabled={saving === "evidence"}>
                  Add evidence
                </button>
                <Field label="Source">
                  <input name="source" className="workflow-input" placeholder="URL, run ID, or owner" />
                </Field>
                <div className="lg:col-span-2">
                  <Field label="Detail">
                    <input name="detail" className="workflow-input" placeholder="Result, scope, or follow-up" />
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
                      isViewer ? null : (
                      <select
                        className="workflow-input min-w-32"
                        value={evidence.status}
                        onChange={(event) => updateEvidenceStatus(evidence, event.target.value as WorkflowValidationStatus)}
                        disabled={saving === `evidence-${evidence.id}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                      )
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
              isViewer ? <ReadOnlyRoleNotice /> : <form className="space-y-4" onSubmit={confirmRelease}>
                <ReleasePreflightPanel preflight={state.releaseHistory.preflight} />
                <Field label="Summary">
                  <textarea
                    name="summary"
                    defaultValue={state.releaseConfirmation?.summary ?? ""}
                    rows={4}
                    className="workflow-input resize-none"
                    placeholder="Release notes, caveats, or rollback context"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Confirmed by">
                    <input
                      name="confirmedBy"
                      className="workflow-input"
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
            <div>
              <div className="border border-ink-700 bg-ink-875 px-4 py-3">
                <div className="kicker mb-1.5">{state.releaseConfirmation?.confirmed ? "RELEASE CONFIRMED" : "RELEASE PENDING"}</div>
                <div className="font-mono text-xs text-ink-400">
                  Updated {relative(state.releaseConfirmation?.updatedAt)}
                </div>
              </div>
              <ReleaseHistoryList history={state.releaseHistory} />
            </div>
          </WorkflowSection>
        </div>
      )}

      {canManageOperations && <ProductionStatusPanel />}

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="kicker-amber mb-2">PROVIDER USAGE & STREAM TEST</div>
            <h2 className="display text-2xl">Live monitors</h2>
          </div>
          <span className="section-marker">§ EOF</span>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <UsageSummaryCard />
          <StreamingTextDemo />
        </div>
      </section>
    </div>
  );
}

type SubsystemStatus = "ok" | "degraded" | "down" | "disabled";

interface SubsystemHealthEntry {
  name: string;
  status: SubsystemStatus;
  detail: string;
  checkedAt: string;
  observedAt?: string;
}

interface OperationsHealth {
  generatedAt: string;
  overall: SubsystemStatus;
  subsystems: SubsystemHealthEntry[];
}

interface ProductionStatus {
  generatedAt: string;
  store: { mode: "json" | "sqlite" };
  scheduler: {
    leaderMode: "off" | "file" | "http";
    leaderTtlMs: number;
    leaderHeldLocally: boolean;
    lockSummary: string;
  };
  jobs: { type: string; queued: number; running: number; succeeded: number; failed: number; canceled: number }[];
  jobMetrics: {
    type: string;
    totalRuns: number;
    succeededRuns: number;
    failedRuns: number;
    canceledRuns: number;
    lastRunStartedAt: string | null;
    lastRunFinishedAt: string | null;
    lastDurationMs: number | null;
    averageDurationMs: number | null;
    p95DurationMs: number | null;
  }[];
  accessLog: { mode: "off" | "stdout" | "file"; path: string | null; maxBytes: number; maxFiles: number };
  runtime: { nodeVersion: string };
}

function ProductionStatusPanel() {
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const [health, setHealth] = useState<OperationsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResult, healthResult] = await Promise.allSettled([
        fetchProductionStatus(),
        fetchOperationsHealth(),
      ]);

      if (statusResult.status === "fulfilled") {
        setStatus(statusResult.value);
      } else {
        const err = statusResult.reason as Error & { status?: number };
        if (err?.status === 401 || err?.status === 403) {
          setHidden(true);
          return;
        }
        setError(err?.message ?? "Failed to load status");
      }

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      } else {
        const err = healthResult.reason as Error & { status?: number };
        if (err?.status === 401 || err?.status === 403) {
          setHealth(null);
        }
        // Silently ignore other health errors so the rest of the panel still renders.
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  if (hidden) return null;

  return (
    <section className="section-band">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="kicker mb-2">PRODUCTION STATUS</div>
          <h2 className="display text-2xl">Production Status</h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
            {status ? `Generated ${relative(status.generatedAt)}` : "Operator snapshot"}
          </p>
        </div>
        <button className="btn-ghost" type="button" onClick={loadStatus} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh status
        </button>
      </div>

      {loading && !status && (
        <div className="flex items-center gap-3 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING STATUS</span>
        </div>
      )}

      {error && !loading && (
        <div className="border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          STATUS UNAVAILABLE · {error}
        </div>
      )}

      {status && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="border border-ink-700 bg-ink-875 px-4 py-3">
            <div className="kicker mb-2">STORE</div>
            <div className="font-mono text-sm text-ink-200">Store: {status.store.mode}</div>
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3">
            <div className="kicker mb-2">RUNTIME</div>
            <div className="font-mono text-sm text-ink-200">Node {status.runtime.nodeVersion}</div>
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <div className="kicker mb-3">SCHEDULER</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KeyValue label="Leader mode" value={status.scheduler.leaderMode} />
              <KeyValue
                label="Leader held locally"
                value={
                  status.scheduler.leaderHeldLocally ? (
                    <span className="inline-flex items-center gap-1.5 text-signal-green">
                      <CheckCircle2 className="h-3.5 w-3.5" /> yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-ink-500">
                      <XCircle className="h-3.5 w-3.5" /> no
                    </span>
                  )
                }
              />
              <KeyValue label="Leader TTL" value={`${(status.scheduler.leaderTtlMs / 1000).toFixed(1)}s`} />
              <KeyValue label="Lock summary" value={status.scheduler.lockSummary || "—"} />
            </div>
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <div className="kicker mb-3">ACCESS LOG</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KeyValue label="Mode" value={status.accessLog.mode} />
              <KeyValue label="Path" value={status.accessLog.path || "—"} />
              <KeyValue
                label="Max bytes"
                value={status.accessLog.maxBytes > 0 ? formatBytes(status.accessLog.maxBytes) : "disabled"}
              />
              <KeyValue label="Max files" value={String(status.accessLog.maxFiles)} />
            </div>
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <div className="kicker mb-3">JOBS</div>
            {status.jobs.length === 0 ? (
              <EmptyState>No queued jobs.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full font-mono text-xs">
                  <thead>
                    <tr className="text-left text-ink-500">
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Type</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Queued</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Running</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Succeeded</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Failed</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Canceled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.jobs.map((entry) => (
                      <tr key={entry.type} className="border-t border-ink-800 text-ink-200">
                        <td className="py-1.5 pr-4">{entry.type}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{entry.queued}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{entry.running}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{entry.succeeded}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{entry.failed}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{entry.canceled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <div className="kicker mb-1">JOB METRICS</div>
            <h3 className="mb-3 font-serif text-base text-ink-100">Job metrics</h3>
            {status.jobMetrics.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">
                No completed runs yet (since process restart)
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full font-mono text-xs">
                  <thead>
                    <tr className="text-left text-ink-500">
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Type</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Last duration</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Avg (rolling)</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">p95</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Last finished</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Total runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.jobMetrics.map((entry) => (
                      <tr key={entry.type} className="border-t border-ink-800 text-ink-200">
                        <td className="py-1.5 pr-4">{entry.type}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{formatDurationMs(entry.lastDurationMs)}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{formatDurationMs(entry.averageDurationMs)}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{formatDurationMs(entry.p95DurationMs)}</td>
                        <td className="py-1.5 pr-4">{entry.lastRunFinishedAt ? relative(entry.lastRunFinishedAt) : "—"}</td>
                        <td className="py-1.5 pr-4 tabular-nums">
                          {entry.totalRuns}
                          <span className="ml-1 text-ink-500">({entry.succeededRuns} / {entry.failedRuns})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <SubsystemHealthSection health={health} />
          </div>
        </div>
      )}

      {!status && !error && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <div className="kicker mb-1">JOB METRICS</div>
            <h3 className="font-serif text-base text-ink-100">Job metrics</h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Awaiting status snapshot
            </p>
          </div>
          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <SubsystemHealthSection health={health} />
          </div>
        </div>
      )}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="kicker mb-1">{label.toUpperCase()}</div>
      <div className="font-mono text-sm text-ink-200">{value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "disabled";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = unitIndex === 0 ? value.toString() : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function formatDurationMs(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

async function fetchProductionStatus(): Promise<ProductionStatus> {
  const response = await fetch("/api/app/operations/status", {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof payload?.error === "string" ? payload.error : `${response.status} ${response.statusText}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as ProductionStatus;
}

async function fetchOperationsHealth(): Promise<OperationsHealth> {
  const response = await fetch("/api/app/operations/health", { credentials: "include" });
  if (!response.ok) {
    const error = new Error(`status ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<OperationsHealth>;
}

function subsystemStatusClasses(status: SubsystemStatus) {
  switch (status) {
    case "ok":
      return "text-emerald-500";
    case "degraded":
      return "text-amber-500";
    case "down":
      return "text-rose-500";
    case "disabled":
    default:
      return "text-slate-500";
  }
}

function SubsystemStatusIcon({ status, className }: { status: SubsystemStatus; className?: string }) {
  const cls = `h-3.5 w-3.5 ${className ?? ""}`.trim();
  if (status === "ok") return <CheckCircle2 className={cls} />;
  if (status === "degraded") return <AlertTriangle className={cls} />;
  if (status === "down") return <XCircle className={cls} />;
  return <HelpCircle className={cls} />;
}

function SubsystemHealthSection({ health }: { health: OperationsHealth | null }) {
  if (!health) {
    return (
      <div>
        <div className="kicker mb-1">SUBSYSTEM HEALTH</div>
        <h3 className="font-serif text-base text-ink-100">Subsystem health</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Awaiting health snapshot
        </p>
      </div>
    );
  }

  const overallColor = subsystemStatusClasses(health.overall);
  const overallLabel = health.overall.toUpperCase();

  return (
    <div>
      <div className="kicker mb-1">SUBSYSTEM HEALTH</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base text-ink-100">Subsystem health</h3>
        <span className={`inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider ${overallColor}`}>
          <SubsystemStatusIcon status={health.overall} />
          OVERALL: {overallLabel}
        </span>
      </div>
      {health.subsystems.length === 0 ? (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">
          No subsystem checks reported.
        </div>
      ) : (
        <ul className="divide-y divide-ink-800">
          {health.subsystems.map((subsystem) => {
            const color = subsystemStatusClasses(subsystem.status);
            const label = subsystem.status.toUpperCase();
            return (
              <li key={subsystem.name} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider ${color}`}>
                      <SubsystemStatusIcon status={subsystem.status} />
                      {label}
                    </span>
                    <span className="font-mono text-sm text-ink-200">{subsystem.name}</span>
                  </div>
                  {subsystem.observedAt && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      observed {relative(subsystem.observedAt)}
                    </span>
                  )}
                </div>
                {subsystem.detail && (
                  <p className="mt-1 font-mono text-[11px] text-ink-500">{subsystem.detail}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WorkflowSection({
  icon: _icon,
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
    <section className="section-band">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="kicker mb-2">{title.toUpperCase()}</div>
          <h2 className="display text-2xl">{title}</h2>
        </div>
      </div>
      <div className="mb-5 border-b border-ink-700 pb-5">{action}</div>
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
    <div className="border-t border-ink-700 py-3 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-base text-ink-100">{title}</h3>
          {detail && <p className="mt-1 text-sm leading-6 text-ink-400">{detail}</p>}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-500">{meta}</p>
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
      <span className="kicker mb-1.5 block">{label.toUpperCase()}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "danger" | "good" | "muted" | "warn" }) {
  const color = {
    danger: "text-signal-red",
    good: "text-signal-green",
    muted: "text-ink-100",
    warn: "text-signal-amber",
  }[tone];

  return (
    <div className="px-5 py-5">
      <div className="kicker">{label}</div>
      <div className={`mt-2 font-mono text-3xl tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ value, tone }: { value: string; tone: "danger" | "good" | "muted" | "warn" }) {
  const cls =
    tone === "danger" ? "pill pill--danger" :
    tone === "good" ? "pill pill--good" :
    tone === "warn" ? "pill pill--warn" :
    "pill pill--muted";
  return <span className={cls}>{value.replaceAll("_", " ")}</span>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">— {children} —</div>;
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

function ReadOnlyRoleNotice() {
  return <div className="border border-ink-700 bg-ink-950/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-500">Viewer role · manage controls hidden</div>;
}

function jobTone(status: JobStatus) {
  if (status === "success") return "good";
  if (status === "failed") return "danger";
  if (status === "queued" || status === "running") return "warn";
  return "muted";
}

function canCancelJob(job: JobRecord) {
  return job.status === "queued" || job.status === "running";
}

function jobMeta(job: JobRecord) {
  const timestamps = [
    `created ${relative(job.createdAt)}`,
    `scheduled ${relative(job.scheduledAt)}`,
    job.startedAt ? `started ${relative(job.startedAt)}` : null,
    job.completedAt ? `completed ${relative(job.completedAt)}` : null,
  ].filter(Boolean);

  return `#${job.id} · attempts ${job.attempts}/${job.maxAttempts}${job.cancelRequested ? " · cancel requested" : ""} · ${timestamps.join(" · ")}`;
}

function summarizeJobPayload(payload: JobRecord["payload"]) {
  const keys = Object.keys(payload);
  if (keys.length === 0) return "No payload";
  return keys.slice(0, 4).join(" · ");
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

  const bannerBorder = preflight.ready ? "border-signal-green/50" : "border-signal-amber/50";
  const bannerText = preflight.ready ? "text-signal-green" : "text-signal-amber";

  return (
    <div className={`border ${bannerBorder} bg-ink-950/40 p-4`}>
      <div className={`flex items-center gap-2 font-mono text-xs uppercase tracking-wider ${bannerText}`}>
        {preflight.ready ? "PREFLIGHT · PASSED" : "PREFLIGHT · WARNINGS"}
        {preflight.openQuestions > 0 && (
          <span className="ml-auto text-ink-500">
            {preflight.openQuestions} open question{preflight.openQuestions === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <ul className="mt-3">
        {checks.map((check) => (
          <li key={check.label} className="flex items-baseline justify-between border-t border-ink-800 py-1.5 leader first:border-t-0">
            <span className="bg-ink-950 pr-2">
              <span className={`mr-2 font-mono text-xs ${check.ok ? "text-signal-green" : "text-signal-red"}`}>
                {check.ok ? "[ ✓ ]" : "[ × ]"}
              </span>
              <span className="text-sm text-ink-200">{check.label}</span>
            </span>
            <span className="bg-ink-950 pl-2 font-mono text-[11px] text-ink-500">{check.detail}</span>
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
    <div className="mt-4">
      <div className="kicker mb-3"><History className="inline h-3 w-3 mr-1" /> RELEASE HISTORY</div>
      <ol>
        {history.releases.map((release) => (
          <li key={release.id} className="border-t border-ink-700 py-3 first:border-t-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-sm text-ink-100">{release.versionLabel}</span>
              <StatusBadge value={release.status} tone={release.confirmed ? "good" : release.status === "rolled_back" ? "danger" : "warn"} />
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-ink-500">
                {release.confirmedBy ? `${release.confirmedBy} · ` : ""}
                {relative(release.confirmedAt ?? release.updatedAt)}
              </span>
            </div>
            {release.summary && <p className="mt-1 text-sm leading-6 text-ink-400">{release.summary}</p>}
            {release.validationEvidenceIds.length > 0 && (
              <p className="mt-1 font-mono text-[10px] text-ink-500">
                {release.validationEvidenceIds.length} evidence link{release.validationEvidenceIds.length === 1 ? "" : "s"}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

async function fetchOperations(): Promise<OperationsState> {
  const [blockers, questions, validationEvidence, releaseConfirmation, releaseHistory, jobs] = await Promise.all([
    listBlockers(),
    listQuestions(),
    listValidationEvidence(),
    getReleaseConfirmation(),
    getReleaseHistory(),
    listJobs(),
  ]);

  return { blockers, questions, validationEvidence, releaseConfirmation, releaseHistory, jobs };
}

async function listJobs() {
  return workflowApi.listJobs ? workflowApi.listJobs(50) : [];
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
