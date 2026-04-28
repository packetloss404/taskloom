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
  jobMetricsSnapshots: {
    total: number;
    lastCapturedAt: string | null;
  };
  accessLog: { mode: "off" | "stdout" | "file"; path: string | null; maxBytes: number; maxFiles: number };
  storageTopology: StorageTopologyReport;
  managedDatabaseTopology: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard?: ManagedDatabaseRuntimeGuardReport;
  releaseReadiness: ReleaseReadinessReport;
  releaseEvidence: ReleaseEvidenceBundle;
  runtime: { nodeVersion: string };
}

type StorageTopologyTone = "danger" | "good" | "muted" | "warn";

interface StorageTopologyCheck {
  name?: string;
  label?: string;
  id?: string;
  status?: string;
  ready?: boolean;
  detail?: string;
  message?: string;
  reason?: string;
  path?: string;
  target?: string;
  [key: string]: unknown;
}

interface StorageTopologyRequirement {
  id: string;
  met: boolean;
  summary: string;
}

interface StorageTopologyReport {
  readyForProduction?: boolean;
  ready?: boolean;
  status?: string;
  classification?: string;
  summary?: string;
  mode?: string;
  storeMode?: string;
  dataDir?: string;
  dataPath?: string;
  jsonPath?: string;
  sqlitePath?: string;
  backupDir?: string;
  artifactDir?: string;
  requirements?: StorageTopologyRequirement[];
  warnings?: string[];
  nextSteps?: string[];
  observed?: {
    nodeEnv?: string;
    store?: string;
    dbPath?: string | null;
    schedulerLeaderMode?: string;
    accessLogMode?: string;
    accessLogPath?: string | null;
    distributedRateLimitUrl?: string | null;
  };
  checks?: StorageTopologyCheck[];
  [key: string]: unknown;
}

interface ManagedDatabaseTopologyCheck {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  ready?: boolean;
  passed?: boolean;
  met?: boolean;
  detail?: string;
  message?: string;
  reason?: string;
  summary?: string;
  [key: string]: unknown;
}

interface ManagedDatabaseTopologyReport {
  readyForManagedDatabase?: boolean;
  readyForProductionManagedDatabase?: boolean;
  ready?: boolean;
  status?: string;
  classification?: string;
  summary?: string;
  requested?: boolean;
  configured?: boolean;
  supported?: boolean;
  managedDatabase?: {
    requested?: boolean;
    configured?: boolean;
    supported?: boolean;
  };
  topology?: string;
  provider?: string;
  currentStore?: string;
  store?: string;
  observed?: Record<string, unknown> & {
    databaseTopology?: unknown;
    store?: unknown;
  };
  config?: Record<string, unknown>;
  checks?: ManagedDatabaseTopologyCheck[];
  blockers?: ReleaseReadinessIssue[];
  warnings?: ReleaseReadinessIssue[];
  nextSteps?: ReleaseReadinessIssue[];
  [key: string]: unknown;
}

interface ManagedDatabaseRuntimeGuardCheck {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  classification?: string;
  allowed?: boolean;
  ready?: boolean;
  passed?: boolean;
  detail?: string;
  message?: string;
  reason?: string;
  summary?: string;
  [key: string]: unknown;
}

interface ManagedDatabaseRuntimeGuardReport {
  allowed?: boolean;
  status?: string;
  classification?: string;
  summary?: string;
  checks?: ManagedDatabaseRuntimeGuardCheck[];
  blockers?: ReleaseReadinessIssue[];
  warnings?: ReleaseReadinessIssue[];
  nextSteps?: ReleaseReadinessIssue[];
  observed?: Record<string, unknown>;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

type ReleaseReadinessTone = "danger" | "good" | "muted" | "warn";

interface ReleaseReadinessCheck {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  ready?: boolean;
  passed?: boolean;
  met?: boolean;
  required?: boolean;
  severity?: string;
  detail?: string;
  message?: string;
  reason?: string;
  summary?: string;
  [key: string]: unknown;
}

interface ReleaseReadinessRequirement {
  id: string;
  met: boolean;
  summary: string;
}

type ReleaseReadinessIssue = string | {
  id?: string;
  title?: string;
  summary?: string;
  detail?: string;
  message?: string;
  severity?: string;
  status?: string;
};

interface ReleaseReadinessReport {
  readyForRelease?: boolean;
  ready?: boolean;
  status?: string;
  classification?: string;
  summary?: string;
  phase?: string;
  version?: string;
  generatedAt?: string;
  checks?: ReleaseReadinessCheck[];
  requirements?: ReleaseReadinessRequirement[];
  blockers?: ReleaseReadinessIssue[];
  warnings?: ReleaseReadinessIssue[];
  nextSteps?: ReleaseReadinessIssue[];
  [key: string]: unknown;
}

interface ReleaseEvidenceBundle {
  generatedAt?: string;
  readyForRelease?: boolean;
  ready?: boolean;
  readiness?: string;
  readinessStatus?: string;
  status?: string;
  classification?: string;
  summary?: string;
  includedEvidenceCount?: number;
  evidenceCount?: number;
  attachmentCount?: number;
  includedAttachmentCount?: number;
  includedEvidence?: unknown[] | Record<string, unknown>;
  evidence?: unknown[] | Record<string, unknown>;
  attachments?: unknown[];
  includedAttachments?: unknown[];
  [key: string]: unknown;
}

interface JobMetricSnapshot {
  id: string;
  capturedAt: string;
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
}

interface AlertEvent {
  id: string;
  ruleId: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  observedAt: string;
  context: Record<string, unknown>;
  delivered: boolean;
  deliveryError?: string;
  deliveryAttempts?: number;
  lastDeliveryAttemptAt?: string;
  deadLettered?: boolean;
}

function ProductionStatusPanel() {
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const [health, setHealth] = useState<OperationsHealth | null>(null);
  const [history, setHistory] = useState<JobMetricSnapshot[] | null>(null);
  const [alerts, setAlerts] = useState<AlertEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResult, healthResult, historyResult, alertsResult] = await Promise.allSettled([
        fetchProductionStatus(),
        fetchOperationsHealth(),
        fetchJobMetricsHistory(),
        fetchRecentAlerts(),
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

      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value);
      } else {
        const err = historyResult.reason as Error & { status?: number };
        if (err?.status === 401 || err?.status === 403) {
          setHistory(null);
        }
        // Silently ignore other history errors; the table still renders without a trend.
      }

      if (alertsResult.status === "fulfilled") {
        setAlerts(alertsResult.value);
      } else {
        const err = alertsResult.reason as Error & { status?: number };
        if (err?.status === 401 || err?.status === 403) {
          setAlerts(null);
        }
        // Silently ignore other alert errors; the panel will show no rows.
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
            <StorageTopologySection report={status.storageTopology} />
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <ManagedDatabaseTopologySection report={status.managedDatabaseTopology} />
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <ManagedDatabaseRuntimeGuardSection report={status.managedDatabaseRuntimeGuard} />
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <ReleaseReadinessSection report={status.releaseReadiness} />
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <ReleaseEvidenceSection bundle={status.releaseEvidence} />
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
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Trend</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Last finished</th>
                      <th className="py-1.5 pr-4 font-medium uppercase tracking-wider">Total runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.jobMetrics.map((entry) => {
                      const trendValues = (history ?? [])
                        .filter((snapshot) => snapshot.type === entry.type)
                        .map((snapshot) => snapshot.averageDurationMs)
                        .filter((value): value is number => typeof value === "number");
                      return (
                        <tr key={entry.type} className="border-t border-ink-800 text-ink-200">
                          <td className="py-1.5 pr-4">{entry.type}</td>
                          <td className="py-1.5 pr-4 tabular-nums">{formatDurationMs(entry.lastDurationMs)}</td>
                          <td className="py-1.5 pr-4 tabular-nums">{formatDurationMs(entry.averageDurationMs)}</td>
                          <td className="py-1.5 pr-4 tabular-nums">{formatDurationMs(entry.p95DurationMs)}</td>
                          <td className="py-1.5 pr-4"><Sparkline values={trendValues} /></td>
                          <td className="py-1.5 pr-4">{entry.lastRunFinishedAt ? relative(entry.lastRunFinishedAt) : "—"}</td>
                          <td className="py-1.5 pr-4 tabular-nums">
                            {entry.totalRuns}
                            <span className="ml-1 text-ink-500">({entry.succeededRuns} / {entry.failedRuns})</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  Trend = average duration across recent snapshots (run <span className="text-ink-300">npm run jobs:snapshot-metrics</span> to capture)
                  {status?.jobMetricsSnapshots ? (
                    <>
                      {" "}
                      <span className="ml-1">
                        {status.jobMetricsSnapshots.lastCapturedAt
                          ? `Last snapshot ${relative(status.jobMetricsSnapshots.lastCapturedAt)} (${status.jobMetricsSnapshots.total} total).`
                          : "No snapshots captured yet."}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            )}
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <SubsystemHealthSection health={health} />
          </div>

          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <RecentAlertsSection alerts={alerts} />
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
          <div className="border border-ink-700 bg-ink-875 px-4 py-3 xl:col-span-2">
            <RecentAlertsSection alerts={alerts} />
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

function StorageTopologySection({ report }: { report: StorageTopologyReport | null | undefined }) {
  if (!report) {
    return (
      <div>
        <div className="kicker mb-1">STORAGE TOPOLOGY</div>
        <h3 className="font-serif text-base text-ink-100">Storage topology</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Awaiting topology report
        </p>
      </div>
    );
  }

  const readiness = storageTopologyReadiness(report);
  const fields = storageTopologyFields(report);
  const checks = storageTopologyChecks(report);
  const followUps = [...(report.warnings ?? []), ...(report.nextSteps ?? [])];

  return (
    <div>
      <div className="kicker mb-1">STORAGE TOPOLOGY</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base text-ink-100">Storage topology</h3>
        <StatusBadge value={readiness.label} tone={readiness.tone} />
      </div>
      {report.summary && (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{report.summary}</p>
      )}
      {fields.length > 0 && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((field) => (
            <KeyValue key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      )}
      {checks.length === 0 ? (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">
          No topology checks reported.
        </div>
      ) : (
        <ul className="divide-y divide-ink-800">
          {checks.map((check, index) => {
            const checkReadiness = storageTopologyCheckReadiness(check);
            const detail = storageTopologyCheckDetail(check);
            return (
              <li key={String(check.id ?? check.name ?? check.label ?? index)} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-ink-200">
                    {String(check.label ?? check.name ?? check.id ?? `check ${index + 1}`)}
                  </span>
                  <StatusBadge value={checkReadiness.label} tone={checkReadiness.tone} />
                </div>
                {detail && <p className="mt-1 font-mono text-[11px] text-ink-500">{detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {followUps.length > 0 && (
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-ink-500">
          {followUps.slice(0, 4).map((item, index) => (
            <li key={`${index}-${item}`}>- {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function storageTopologyReadiness(report: StorageTopologyReport): { label: string; tone: StorageTopologyTone } {
  if (typeof report.readyForProduction === "boolean") {
    if (report.readyForProduction) {
      return { label: report.classification ?? "production ready", tone: "good" };
    }
    return storageTopologyStatus(report.classification ?? report.status ?? "not ready");
  }
  if (typeof report.ready === "boolean") {
    return report.ready ? { label: "ready", tone: "good" } : { label: "not ready", tone: "danger" };
  }
  return storageTopologyStatus(report.status ?? report.classification);
}

function storageTopologyCheckReadiness(check: StorageTopologyCheck): { label: string; tone: StorageTopologyTone } {
  if (typeof check.ready === "boolean") {
    return check.ready ? { label: "ready", tone: "good" } : { label: "not ready", tone: "danger" };
  }
  return storageTopologyStatus(check.status);
}

function storageTopologyStatus(status: unknown): { label: string; tone: StorageTopologyTone } {
  const label = typeof status === "string" && status.trim() ? status.trim() : "unknown";
  const normalized = label.toLowerCase().replaceAll(" ", "_");
  if (["ready", "ok", "healthy", "configured", "available", "pass", "passed", "single-node"].includes(normalized)) {
    return { label, tone: "good" };
  }
  if (["warn", "warning", "degraded", "partial", "pending", "local-dev"].includes(normalized)) {
    return { label, tone: "warn" };
  }
  if (["blocked", "error", "down", "missing", "not_ready", "invalid", "fail", "failed", "production-blocked", "unsupported"].includes(normalized)) {
    return { label, tone: "danger" };
  }
  return { label, tone: "muted" };
}

function storageTopologyFields(report: StorageTopologyReport) {
  const entries: Array<[string, unknown]> = [
    ["Mode", report.mode],
    ["Classification", report.classification],
    ["Node env", report.observed?.nodeEnv],
    ["Store", report.observed?.store ?? report.storeMode],
    ["DB path", report.observed?.dbPath ?? report.dataPath ?? report.sqlitePath ?? report.jsonPath],
    ["Leader mode", report.observed?.schedulerLeaderMode],
    ["Access log", report.observed?.accessLogMode],
    ["Access log path", report.observed?.accessLogPath],
    ["Rate limit", report.observed?.distributedRateLimitUrl],
    ["Data dir", report.dataDir],
    ["Backup dir", report.backupDir],
    ["Artifact dir", report.artifactDir],
  ];

  return entries.flatMap(([label, raw]) => {
    const value = formatStorageTopologyValue(raw);
    return value ? [{ label, value }] : [];
  });
}

function storageTopologyChecks(report: StorageTopologyReport): StorageTopologyCheck[] {
  const requirements = (report.requirements ?? []).map((requirement) => ({
    id: requirement.id,
    label: requirement.id,
    ready: requirement.met,
    detail: requirement.summary,
  }));
  const checks = Array.isArray(report.checks) ? report.checks.filter(isStorageTopologyCheck) : [];
  return [...requirements, ...checks];
}

function storageTopologyCheckDetail(check: StorageTopologyCheck): string {
  const detail = check.detail ?? check.message ?? check.reason ?? check.path ?? check.target;
  return typeof detail === "string" ? detail : "";
}

function formatStorageTopologyValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return "";
}

function isStorageTopologyCheck(value: unknown): value is StorageTopologyCheck {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function ManagedDatabaseTopologySection({ report }: { report: ManagedDatabaseTopologyReport | null | undefined }) {
  if (!report) {
    return (
      <div>
        <div className="kicker mb-1">MANAGED DATABASE TOPOLOGY</div>
        <h3 className="font-serif text-base text-ink-100">Managed database topology</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Awaiting managed database topology report
        </p>
      </div>
    );
  }

  const readiness = managedDatabaseTopologyReadiness(report);
  const fields = managedDatabaseTopologyFields(report);
  const checks = managedDatabaseTopologyChecks(report);
  const blockers = releaseReadinessIssues(report.blockers);
  const warnings = releaseReadinessIssues(report.warnings);
  const nextSteps = releaseReadinessIssues(report.nextSteps);

  return (
    <div>
      <div className="kicker mb-1">MANAGED DATABASE TOPOLOGY</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base text-ink-100">Managed database topology</h3>
        <StatusBadge value={readiness.label} tone={readiness.tone} />
      </div>
      {report.summary && (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{report.summary}</p>
      )}
      {fields.length > 0 && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((field) => (
            <KeyValue key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      )}
      {checks.length > 0 && (
        <ul className="divide-y divide-ink-800">
          {checks.slice(0, 6).map((check, index) => {
            const checkReadiness = managedDatabaseTopologyCheckStatus(check);
            const detail = managedDatabaseTopologyCheckDetail(check);
            return (
              <li key={String(check.id ?? check.name ?? check.label ?? index)} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-ink-200">
                    {String(check.label ?? check.name ?? check.id ?? `check ${index + 1}`)}
                  </span>
                  <StatusBadge value={checkReadiness.label} tone={checkReadiness.tone} />
                </div>
                {detail && <p className="mt-1 font-mono text-[11px] text-ink-500">{detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {blockers.length > 0 && <ReleaseReadinessIssueList title="BLOCKERS" tone="danger" items={blockers} />}
      {warnings.length > 0 && <ReleaseReadinessIssueList title="WARNINGS" tone="warn" items={warnings} />}
      {nextSteps.length > 0 && <ReleaseReadinessIssueList title="NEXT STEPS" tone="muted" items={nextSteps} />}
      {fields.length === 0 && checks.length === 0 && blockers.length === 0 && warnings.length === 0 && nextSteps.length === 0 && (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">
          No managed database topology details reported.
        </div>
      )}
    </div>
  );
}

function managedDatabaseTopologyReadiness(report: ManagedDatabaseTopologyReport): { label: string; tone: ReleaseReadinessTone } {
  if (typeof report.readyForProductionManagedDatabase === "boolean") {
    if (report.readyForProductionManagedDatabase) return { label: report.classification ?? report.status ?? "ready", tone: "good" };
    return releaseReadinessTone(report.classification ?? report.status ?? "blocked");
  }
  if (typeof report.readyForManagedDatabase === "boolean") {
    if (report.readyForManagedDatabase) return { label: report.classification ?? report.status ?? "ready", tone: "good" };
    return releaseReadinessTone(report.classification ?? report.status ?? "blocked");
  }
  if (typeof report.ready === "boolean") {
    return report.ready ? { label: "ready", tone: "good" } : releaseReadinessTone(report.status ?? "blocked");
  }
  return releaseReadinessTone(report.status ?? report.classification);
}

function managedDatabaseTopologyCheckStatus(check: ManagedDatabaseTopologyCheck): { label: string; tone: ReleaseReadinessTone } {
  if (typeof check.ready === "boolean") {
    return check.ready ? { label: "ready", tone: "good" } : releaseReadinessTone(check.status ?? "blocked");
  }
  if (typeof check.passed === "boolean") {
    return check.passed ? { label: "passed", tone: "good" } : releaseReadinessTone(check.status ?? "failed");
  }
  if (typeof check.met === "boolean") {
    return check.met ? { label: "met", tone: "good" } : releaseReadinessTone(check.status ?? "missing");
  }
  return releaseReadinessTone(check.status);
}

function managedDatabaseTopologyFields(report: ManagedDatabaseTopologyReport) {
  const observed = report.observed ?? {};
  const config = report.config ?? {};
  const managedDatabase = report.managedDatabase ?? {};
  const entries: Array<[string, unknown]> = [
    ["Requested", report.requested ?? managedDatabase.requested ?? observed.requested ?? config.requested],
    ["Configured", report.configured ?? managedDatabase.configured ?? observed.configured ?? config.configured],
    ["Supported", report.supported ?? managedDatabase.supported ?? observed.supported ?? config.supported],
    ["Topology", report.topology ?? observed.topology ?? observed.databaseTopology ?? config.topology],
    ["Provider", report.provider ?? observed.provider ?? config.provider],
    ["Current store", report.currentStore ?? report.store ?? observed.currentStore ?? observed.store ?? config.currentStore],
  ];

  return entries.flatMap(([label, raw]) => {
    const value = formatStorageTopologyValue(raw);
    return value ? [{ label, value }] : [];
  });
}

function managedDatabaseTopologyChecks(report: ManagedDatabaseTopologyReport): ManagedDatabaseTopologyCheck[] {
  return Array.isArray(report.checks) ? report.checks.filter(isManagedDatabaseTopologyCheck) : [];
}

function managedDatabaseTopologyCheckDetail(check: ManagedDatabaseTopologyCheck): string {
  const detail = check.detail ?? check.message ?? check.reason ?? check.summary;
  return typeof detail === "string" ? detail : "";
}

function isManagedDatabaseTopologyCheck(value: unknown): value is ManagedDatabaseTopologyCheck {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function ManagedDatabaseRuntimeGuardSection({ report }: { report: ManagedDatabaseRuntimeGuardReport | null | undefined }) {
  if (!report) {
    return (
      <div>
        <div className="kicker mb-1">RUNTIME GUARD</div>
        <h3 className="font-serif text-base text-ink-100">Runtime guard</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Awaiting managed database runtime guard report
        </p>
      </div>
    );
  }

  const readiness = managedDatabaseRuntimeGuardReadiness(report);
  const fields = managedDatabaseRuntimeGuardFields(report);
  const checks = managedDatabaseRuntimeGuardChecks(report);
  const blockers = releaseReadinessIssues(report.blockers);
  const warnings = releaseReadinessIssues(report.warnings);
  const nextSteps = releaseReadinessIssues(report.nextSteps);

  return (
    <div>
      <div className="kicker mb-1">RUNTIME GUARD</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base text-ink-100">Runtime guard</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={readiness.allowedLabel} tone={readiness.allowedTone} />
          <StatusBadge value={readiness.label} tone={readiness.tone} />
        </div>
      </div>
      {report.summary && (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{report.summary}</p>
      )}
      {fields.length > 0 && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((field) => (
            <KeyValue key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      )}
      {checks.length > 0 && (
        <ul className="divide-y divide-ink-800">
          {checks.slice(0, 6).map((check, index) => {
            const checkReadiness = managedDatabaseRuntimeGuardCheckStatus(check);
            const detail = managedDatabaseRuntimeGuardCheckDetail(check);
            return (
              <li key={String(check.id ?? check.name ?? check.label ?? index)} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-ink-200">
                    {String(check.label ?? check.name ?? check.id ?? `check ${index + 1}`)}
                  </span>
                  <StatusBadge value={checkReadiness.label} tone={checkReadiness.tone} />
                </div>
                {detail && <p className="mt-1 font-mono text-[11px] text-ink-500">{detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {blockers.length > 0 && <ReleaseReadinessIssueList title="BLOCKERS" tone="danger" items={blockers} />}
      {warnings.length > 0 && <ReleaseReadinessIssueList title="WARNINGS" tone="warn" items={warnings} />}
      {nextSteps.length > 0 && <ReleaseReadinessIssueList title="NEXT STEPS" tone="muted" items={nextSteps} />}
      {fields.length === 0 && checks.length === 0 && blockers.length === 0 && warnings.length === 0 && nextSteps.length === 0 && (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">
          No runtime guard details reported.
        </div>
      )}
    </div>
  );
}

function managedDatabaseRuntimeGuardReadiness(report: ManagedDatabaseRuntimeGuardReport): {
  label: string;
  tone: ReleaseReadinessTone;
  allowedLabel: string;
  allowedTone: ReleaseReadinessTone;
} {
  const allowed = typeof report.allowed === "boolean" ? report.allowed : undefined;
  const status = releaseReadinessTone(report.status ?? report.classification ?? (allowed === false ? "blocked" : "unknown"));
  return {
    ...status,
    allowedLabel: allowed === undefined ? "allowed unknown" : allowed ? "allowed" : "blocking",
    allowedTone: allowed === undefined ? "muted" : allowed ? "good" : "danger",
  };
}

function managedDatabaseRuntimeGuardCheckStatus(check: ManagedDatabaseRuntimeGuardCheck): { label: string; tone: ReleaseReadinessTone } {
  if (typeof check.allowed === "boolean") {
    return check.allowed ? { label: "allowed", tone: "good" } : releaseReadinessTone(check.status ?? check.classification ?? "blocking");
  }
  if (typeof check.ready === "boolean") {
    return check.ready ? { label: "ready", tone: "good" } : releaseReadinessTone(check.status ?? check.classification ?? "blocked");
  }
  if (typeof check.passed === "boolean") {
    return check.passed ? { label: "passed", tone: "good" } : releaseReadinessTone(check.status ?? check.classification ?? "failed");
  }
  return releaseReadinessTone(check.status ?? check.classification);
}

function managedDatabaseRuntimeGuardFields(report: ManagedDatabaseRuntimeGuardReport) {
  const observed = report.observed ?? {};
  const config = report.config ?? {};
  const entries: Array<[string, unknown]> = [
    ["Allowed", report.allowed],
    ["Classification", report.classification],
    ["Topology", observed.topology ?? observed.databaseTopology ?? config.topology],
    ["Provider", observed.provider ?? config.provider],
    ["Store", observed.currentStore ?? observed.store ?? config.currentStore ?? config.store],
    ["Managed intent", observed.managedDatabaseRequested ?? observed.managedIntent ?? config.managedDatabaseRequested],
    ["Multi-writer", observed.multiWriterRequested ?? observed.multiWriterIntent ?? config.multiWriterRequested],
  ];

  return entries.flatMap(([label, raw]) => {
    const value = formatStorageTopologyValue(raw);
    return value ? [{ label, value }] : [];
  });
}

function managedDatabaseRuntimeGuardChecks(report: ManagedDatabaseRuntimeGuardReport): ManagedDatabaseRuntimeGuardCheck[] {
  return Array.isArray(report.checks) ? report.checks.filter(isManagedDatabaseRuntimeGuardCheck) : [];
}

function managedDatabaseRuntimeGuardCheckDetail(check: ManagedDatabaseRuntimeGuardCheck): string {
  const detail = check.detail ?? check.message ?? check.reason ?? check.summary;
  return typeof detail === "string" ? detail : "";
}

function isManagedDatabaseRuntimeGuardCheck(value: unknown): value is ManagedDatabaseRuntimeGuardCheck {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function ReleaseReadinessSection({ report }: { report: ReleaseReadinessReport | null | undefined }) {
  if (!report) {
    return (
      <div>
        <div className="kicker mb-1">RELEASE READINESS</div>
        <h3 className="font-serif text-base text-ink-100">Release readiness</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Awaiting readiness report
        </p>
      </div>
    );
  }

  const readiness = releaseReadinessStatus(report);
  const fields = releaseReadinessFields(report);
  const checks = releaseReadinessChecks(report);
  const blockers = releaseReadinessIssues(report.blockers);
  const warnings = releaseReadinessIssues(report.warnings);
  const nextSteps = releaseReadinessIssues(report.nextSteps);

  return (
    <div>
      <div className="kicker mb-1">RELEASE READINESS</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base text-ink-100">Release readiness</h3>
        <StatusBadge value={readiness.label} tone={readiness.tone} />
      </div>
      {report.summary && (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{report.summary}</p>
      )}
      {fields.length > 0 && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((field) => (
            <KeyValue key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      )}
      {checks.length > 0 && (
        <ul className="divide-y divide-ink-800">
          {checks.slice(0, 8).map((check, index) => {
            const checkReadiness = releaseReadinessCheckStatus(check);
            const detail = releaseReadinessCheckDetail(check);
            return (
              <li key={String(check.id ?? check.name ?? check.label ?? index)} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-ink-200">
                    {String(check.label ?? check.name ?? check.id ?? `check ${index + 1}`)}
                  </span>
                  <StatusBadge value={checkReadiness.label} tone={checkReadiness.tone} />
                </div>
                {detail && <p className="mt-1 font-mono text-[11px] text-ink-500">{detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {blockers.length > 0 && (
        <ReleaseReadinessIssueList title="BLOCKERS" tone="danger" items={blockers} />
      )}
      {warnings.length > 0 && (
        <ReleaseReadinessIssueList title="WARNINGS" tone="warn" items={warnings} />
      )}
      {nextSteps.length > 0 && (
        <ReleaseReadinessIssueList title="NEXT STEPS" tone="muted" items={nextSteps} />
      )}
      {checks.length === 0 && blockers.length === 0 && warnings.length === 0 && nextSteps.length === 0 && (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">
          No release readiness checks reported.
        </div>
      )}
    </div>
  );
}

function ReleaseEvidenceSection({ bundle }: { bundle: ReleaseEvidenceBundle | null | undefined }) {
  if (!bundle) {
    return (
      <div>
        <div className="kicker mb-1">RELEASE EVIDENCE</div>
        <h3 className="font-serif text-base text-ink-100">Release evidence</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          Awaiting evidence bundle
        </p>
      </div>
    );
  }

  const readiness = releaseEvidenceReadiness(bundle);
  const evidenceCount = releaseEvidenceCount(bundle, ["includedEvidenceCount", "evidenceCount"], ["includedEvidence", "evidence"]);
  const attachmentCount = releaseEvidenceCount(
    bundle,
    ["attachmentCount", "includedAttachmentCount"],
    ["attachments", "includedAttachments"],
  );

  return (
    <div>
      <div className="kicker mb-1">RELEASE EVIDENCE</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base text-ink-100">Release evidence</h3>
        <StatusBadge value={readiness.label} tone={readiness.tone} />
      </div>
      {bundle.summary && (
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{bundle.summary}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <KeyValue label="Generated" value={bundle.generatedAt ? relative(bundle.generatedAt) : "unknown"} />
        <KeyValue label="Included evidence" value={String(evidenceCount)} />
        <KeyValue label="Attachments" value={String(attachmentCount)} />
      </div>
    </div>
  );
}

function releaseEvidenceReadiness(bundle: ReleaseEvidenceBundle): { label: string; tone: ReleaseReadinessTone } {
  if (typeof bundle.readyForRelease === "boolean") {
    return bundle.readyForRelease ? { label: "ready", tone: "good" } : releaseReadinessTone(bundle.status ?? "blocked");
  }
  if (typeof bundle.ready === "boolean") {
    return bundle.ready ? { label: "ready", tone: "good" } : releaseReadinessTone(bundle.status ?? "blocked");
  }
  return releaseReadinessTone(bundle.readinessStatus ?? bundle.readiness ?? bundle.status ?? bundle.classification);
}

function releaseEvidenceCount(
  bundle: ReleaseEvidenceBundle,
  countKeys: Array<keyof ReleaseEvidenceBundle>,
  listKeys: Array<keyof ReleaseEvidenceBundle>,
): number {
  for (const key of countKeys) {
    const value = bundle[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  }
  for (const key of listKeys) {
    const value = bundle[key];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
  }
  return 0;
}

function ReleaseReadinessIssueList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: ReleaseReadinessTone;
  items: string[];
}) {
  const color = tone === "danger" ? "text-signal-red" : tone === "warn" ? "text-signal-amber" : "text-ink-500";
  return (
    <div className="mt-3">
      <div className={`kicker mb-1 ${color}`}>{title}</div>
      <ul className="space-y-1 font-mono text-[11px] text-ink-500">
        {items.slice(0, 4).map((item, index) => (
          <li key={`${index}-${item}`}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function releaseReadinessStatus(report: ReleaseReadinessReport): { label: string; tone: ReleaseReadinessTone } {
  if (typeof report.readyForRelease === "boolean") {
    if (report.readyForRelease) {
      return { label: report.classification ?? report.status ?? "ready", tone: "good" };
    }
    return releaseReadinessTone(report.classification ?? report.status ?? "blocked");
  }
  if (typeof report.ready === "boolean") {
    return report.ready ? { label: "ready", tone: "good" } : releaseReadinessTone(report.status ?? "blocked");
  }
  return releaseReadinessTone(report.status ?? report.classification);
}

function releaseReadinessCheckStatus(check: ReleaseReadinessCheck): { label: string; tone: ReleaseReadinessTone } {
  if (typeof check.ready === "boolean") {
    return check.ready ? { label: "ready", tone: "good" } : releaseReadinessTone(check.status ?? "blocked");
  }
  if (typeof check.passed === "boolean") {
    return check.passed ? { label: "passed", tone: "good" } : releaseReadinessTone(check.status ?? "failed");
  }
  if (typeof check.met === "boolean") {
    return check.met ? { label: "met", tone: "good" } : releaseReadinessTone(check.status ?? "missing");
  }
  return releaseReadinessTone(check.status);
}

function releaseReadinessTone(status: unknown): { label: string; tone: ReleaseReadinessTone } {
  const label = typeof status === "string" && status.trim() ? status.trim() : "unknown";
  const normalized = label.toLowerCase().replaceAll(" ", "_");
  if (["ready", "ok", "healthy", "configured", "available", "pass", "passed", "met", "go"].includes(normalized)) {
    return { label, tone: "good" };
  }
  if (["warn", "warning", "degraded", "partial", "pending", "review", "needs_review"].includes(normalized)) {
    return { label, tone: "warn" };
  }
  if (["blocked", "error", "down", "missing", "not_ready", "invalid", "fail", "failed", "no_go"].includes(normalized)) {
    return { label, tone: "danger" };
  }
  return { label, tone: "muted" };
}

function releaseReadinessFields(report: ReleaseReadinessReport) {
  const entries: Array<[string, unknown]> = [
    ["Phase", report.phase],
    ["Version", report.version],
    ["Generated", report.generatedAt ? relative(report.generatedAt) : null],
    ["Classification", report.classification],
  ];

  return entries.flatMap(([label, raw]) => {
    const value = formatStorageTopologyValue(raw);
    return value ? [{ label, value }] : [];
  });
}

function releaseReadinessChecks(report: ReleaseReadinessReport): ReleaseReadinessCheck[] {
  const requirements = (report.requirements ?? []).map((requirement) => ({
    id: requirement.id,
    label: requirement.id,
    met: requirement.met,
    detail: requirement.summary,
  }));
  const checks = Array.isArray(report.checks) ? report.checks.filter(isReleaseReadinessCheck) : [];
  return [...requirements, ...checks];
}

function releaseReadinessCheckDetail(check: ReleaseReadinessCheck): string {
  const detail = check.detail ?? check.message ?? check.reason ?? check.summary;
  const severity = typeof check.severity === "string" && check.severity ? `${check.severity} · ` : "";
  const required = check.required === false ? "optional · " : "";
  return typeof detail === "string" ? `${required}${severity}${detail}` : `${required}${severity}`.trim();
}

function releaseReadinessIssues(items: ReleaseReadinessIssue[] | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (!item || typeof item !== "object") return [];
    const value = item.title ?? item.summary ?? item.detail ?? item.message ?? item.id;
    const prefix = item.severity ? `${item.severity}: ` : "";
    return typeof value === "string" && value.trim() ? [`${prefix}${value.trim()}`] : [];
  });
}

function isReleaseReadinessCheck(value: unknown): value is ReleaseReadinessCheck {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function Sparkline({ values, width = 80, height = 20 }: { values: number[]; width?: number; height?: number }) {
  if (values.length === 0) return <span className="text-slate-500">—</span>;
  if (values.length === 1) return <span className="text-slate-400">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stride = width / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stride;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-emerald-400" />
    </svg>
  );
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

async function fetchJobMetricsHistory(limit = 50): Promise<JobMetricSnapshot[]> {
  const response = await fetch(`/api/app/operations/job-metrics/history?limit=${limit}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      typeof payload?.error === "string" ? payload.error : `${response.status} ${response.statusText}`,
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const snapshots = (payload as { snapshots?: JobMetricSnapshot[] }).snapshots;
  return Array.isArray(snapshots) ? snapshots : [];
}

async function fetchRecentAlerts(limit = 25): Promise<AlertEvent[]> {
  const response = await fetch(`/api/app/operations/alerts?limit=${limit}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      typeof payload?.error === "string" ? payload.error : `${response.status} ${response.statusText}`,
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const alerts = (payload as { alerts?: AlertEvent[] }).alerts;
  return Array.isArray(alerts) ? alerts : [];
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

function alertSeverityClasses(severity: AlertEvent["severity"]) {
  switch (severity) {
    case "critical":
      return "text-rose-500";
    case "warning":
      return "text-amber-500";
    case "info":
    default:
      return "text-slate-400";
  }
}

function AlertSeverityIcon({ severity, className }: { severity: AlertEvent["severity"]; className?: string }) {
  const cls = `h-3.5 w-3.5 ${className ?? ""}`.trim();
  if (severity === "critical") return <XCircle className={cls} />;
  if (severity === "warning") return <AlertTriangle className={cls} />;
  return <HelpCircle className={cls} />;
}

function truncate(text: string, max = 120) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function DeliveryStatusIndicator({ alert }: { alert: AlertEvent }) {
  const attempts = alert.deliveryAttempts ?? 0;

  if (alert.deadLettered) {
    const attemptLabel = alert.deliveryAttempts ?? "?";
    const title = `Dead-lettered after ${attemptLabel} attempt${attemptLabel === 1 ? "" : "s"}${alert.deliveryError ? ` · ${alert.deliveryError}` : ""}`;
    return (
      <span className="inline-flex items-center gap-1.5 text-rose-500" aria-label="dead-lettered" title={title}>
        <XCircle className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-wider">DEAD-LETTERED</span>
      </span>
    );
  }

  if (alert.delivered === false) {
    const title = alert.deliveryError || "Delivery failed, retrying";
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-500" aria-label="retrying delivery" title={title}>
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-wider">RETRYING (attempt {attempts})</span>
      </span>
    );
  }

  if (alert.delivered === true && attempts > 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-500" aria-label="delivered" title={`Delivered after ${attempts} attempts`}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">(after {attempts} attempts)</span>
      </span>
    );
  }

  return (
    <span aria-label="delivered" title="Delivered">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
    </span>
  );
}

function RecentAlertsSection({ alerts }: { alerts: AlertEvent[] | null }) {
  const rows = (alerts ?? []).slice(0, 25);
  const count = rows.length;

  return (
    <div>
      <div className="kicker mb-1">RECENT ALERTS</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-base text-ink-100">Recent alerts</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          {count} in last 25
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center font-mono text-xs text-ink-500">
          — No alerts in the recent window. —
        </div>
      ) : (
        <ul className="divide-y divide-ink-800">
          {rows.map((alert) => {
            const severityColor = alertSeverityClasses(alert.severity);
            const severityLabel = alert.severity.toUpperCase();
            const truncated = truncate(alert.detail, 120);
            return (
              <li key={alert.id} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider ${severityColor}`}>
                      <AlertSeverityIcon severity={alert.severity} />
                      {severityLabel}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink-100">{alert.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      {relative(alert.observedAt)}
                    </span>
                    {alert.lastDeliveryAttemptAt && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500" title={`Last attempt ${alert.lastDeliveryAttemptAt}`}>
                        last attempt {relative(alert.lastDeliveryAttemptAt)}
                      </span>
                    )}
                    <DeliveryStatusIndicator alert={alert} />
                  </div>
                </div>
                {truncated && (
                  <p className="mt-1 font-mono text-[11px] text-ink-500" title={alert.detail}>
                    {truncated}
                  </p>
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
