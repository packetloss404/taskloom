import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { WorkspaceActivationFacts } from "./activation/adapters";
import type { ActivationMilestoneRecord, ActivationStatusDto } from "./activation/domain";
import { buildSignalSnapshotFromFacts } from "./activation/adapters";
import { generateId, hashPassword, now, slugify } from "./auth-utils";

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  secretHash: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
}

export interface WorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  website: string;
  automationGoal: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceMemberRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceBriefRecord {
  workspaceId: string;
  summary: string;
  goals?: string[];
  audience?: string;
  constraints?: string;
  problemStatement?: string;
  targetCustomers?: string[];
  desiredOutcome?: string;
  successMetrics?: string[];
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type RequirementPriority = "must" | "should" | "could";
export type RequirementStatus = "draft" | "approved" | "changed" | "done" | "proposed" | "accepted" | "deferred";

export interface RequirementRecord {
  id: string;
  workspaceId: string;
  title: string;
  detail?: string;
  description?: string;
  priority: RequirementPriority;
  status: RequirementStatus;
  acceptanceCriteria?: string[];
  source?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ImplementationPlanItemStatus = "todo" | "in_progress" | "blocked" | "done";

export interface ImplementationPlanItemRecord {
  id: string;
  workspaceId: string;
  requirementIds: string[];
  title: string;
  description: string;
  status: ImplementationPlanItemStatus;
  ownerUserId?: string;
  order: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowConcernKind = "blocker" | "open_question";
export type WorkflowConcernStatus = "open" | "resolved" | "deferred";
export type WorkflowConcernSeverity = "low" | "medium" | "high" | "critical";

export interface WorkflowConcernRecord {
  id: string;
  workspaceId: string;
  kind: WorkflowConcernKind;
  title: string;
  description: string;
  status: WorkflowConcernStatus;
  severity: WorkflowConcernSeverity;
  relatedPlanItemId?: string;
  relatedRequirementId?: string;
  ownerUserId?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type ValidationEvidenceType = "automated_test" | "manual_check" | "demo" | "metric" | "customer_review";
export type ValidationEvidenceOutcome = "pending" | "passed" | "failed";

export interface ValidationEvidenceRecord {
  id: string;
  workspaceId: string;
  planItemId?: string;
  requirementIds?: string[];
  type?: string;
  title: string;
  detail?: string;
  description?: string;
  status?: ValidationEvidenceOutcome;
  outcome?: string;
  source?: string;
  evidenceUrl?: string;
  capturedByUserId?: string;
  capturedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReleaseConfirmationStatus = "pending" | "confirmed" | "rolled_back";

export interface ReleaseConfirmationRecord {
  workspaceId: string;
  confirmed?: boolean;
  summary?: string;
  confirmedBy?: string;
  id?: string;
  versionLabel?: string;
  status?: ReleaseConfirmationStatus;
  confirmedByUserId?: string;
  confirmedAt?: string;
  releaseNotes?: string;
  validationEvidenceIds?: string[];
  createdAt?: string;
  updatedAt: string;
}

export type WorkspaceBriefCollection = WorkspaceBriefRecord[] | Record<string, WorkspaceBriefRecord>;
export type ReleaseConfirmationCollection = ReleaseConfirmationRecord[] | Record<string, ReleaseConfirmationRecord>;

export interface OnboardingStateRecord {
  workspaceId: string;
  status: "not_started" | "in_progress" | "completed";
  currentStep: OnboardingStepKey;
  completedSteps: OnboardingStepKey[];
  completedAt?: string;
  updatedAt: string;
}

export interface ActivityRecord {
  id: string;
  workspaceId: string;
  scope: "account" | "workspace" | "activation";
  event: string;
  occurredAt: string;
  actor: { type: "user" | "system"; id: string; displayName?: string };
  data: Record<string, string | number | boolean | null | undefined>;
}

export type AgentStatus = "active" | "paused" | "archived";

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  instructions: string;
  providerId?: string;
  model?: string;
  tools: string[];
  schedule?: string;
  status: AgentStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type ProviderKind = "openai" | "anthropic" | "azure_openai" | "ollama" | "custom";
export type ProviderStatus = "connected" | "missing_key" | "disabled";

export interface ProviderRecord {
  id: string;
  workspaceId: string;
  name: string;
  kind: ProviderKind;
  defaultModel: string;
  baseUrl?: string;
  apiKeyConfigured: boolean;
  status: ProviderStatus;
  createdAt: string;
  updatedAt: string;
}

export type AgentRunStatus = "queued" | "running" | "success" | "failed" | "canceled";

export interface AgentRunRecord {
  id: string;
  workspaceId: string;
  agentId?: string;
  title: string;
  status: AgentRunStatus;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type OnboardingStepKey =
  | "create_workspace_profile"
  | "define_requirements"
  | "define_plan"
  | "start_implementation"
  | "validate"
  | "confirm_release";

export type WorkspaceEnvVarScope = "all" | "build" | "runtime";

export interface WorkspaceEnvVarRecord {
  id: string;
  workspaceId: string;
  key: string;
  value: string;
  scope: WorkspaceEnvVarScope;
  secret: boolean;
  description?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskloomData {
  users: UserRecord[];
  sessions: SessionRecord[];
  workspaces: WorkspaceRecord[];
  memberships: WorkspaceMemberRecord[];
  workspaceBriefs: WorkspaceBriefCollection;
  requirements: RequirementRecord[];
  implementationPlanItems: ImplementationPlanItemRecord[];
  workflowConcerns: WorkflowConcernRecord[];
  validationEvidence: ValidationEvidenceRecord[];
  releaseConfirmations: ReleaseConfirmationCollection;
  onboardingStates: OnboardingStateRecord[];
  activities: ActivityRecord[];
  agents: AgentRecord[];
  providers: ProviderRecord[];
  agentRuns: AgentRunRecord[];
  workspaceEnvVars: WorkspaceEnvVarRecord[];
  activationFacts: Record<string, WorkspaceActivationFacts>;
  activationMilestones: Record<string, ActivationMilestoneRecord[]>;
  activationReadModels: Record<string, ActivationStatusDto>;
}

const DATA_FILE = resolve(process.cwd(), "data", "taskloom.json");

let cache: TaskloomData | null = null;

export function loadStore(): TaskloomData {
  if (cache) return cache;

  try {
    cache = normalizeStore(JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<TaskloomData>);
    return cache;
  } catch {
    cache = seedStore();
    persistStore(cache);
    return cache;
  }
}

export function mutateStore<T>(mutator: (data: TaskloomData) => T): T {
  const data = loadStore();
  const result = mutator(data);
  persistStore(data);
  return result;
}

export function persistStore(data: TaskloomData): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function normalizeStore(data: Partial<TaskloomData>): TaskloomData {
  return {
    users: data.users ?? [],
    sessions: data.sessions ?? [],
    workspaces: data.workspaces ?? [],
    memberships: data.memberships ?? [],
    workspaceBriefs: normalizeWorkspaceBriefCollection(data.workspaceBriefs),
    requirements: data.requirements ?? [],
    implementationPlanItems: data.implementationPlanItems ?? [],
    workflowConcerns: data.workflowConcerns ?? [],
    validationEvidence: data.validationEvidence ?? [],
    releaseConfirmations: normalizeReleaseConfirmationCollection(data.releaseConfirmations),
    onboardingStates: data.onboardingStates ?? [],
    activities: data.activities ?? [],
    agents: data.agents ?? [],
    providers: data.providers ?? [],
    agentRuns: data.agentRuns ?? [],
    workspaceEnvVars: data.workspaceEnvVars ?? [],
    activationFacts: data.activationFacts ?? {},
    activationMilestones: data.activationMilestones ?? {},
    activationReadModels: data.activationReadModels ?? {},
  };
}

function normalizeWorkspaceBriefCollection(collection: Partial<TaskloomData>["workspaceBriefs"]): WorkspaceBriefCollection {
  if (!collection) return {};
  if (!Array.isArray(collection)) return collection;
  return Object.fromEntries(collection.map((entry) => [entry.workspaceId, entry]));
}

function normalizeReleaseConfirmationCollection(
  collection: Partial<TaskloomData>["releaseConfirmations"],
): ReleaseConfirmationCollection {
  if (!collection) return {};
  if (!Array.isArray(collection)) return collection;
  return Object.fromEntries(collection.map((entry) => [entry.workspaceId, entry]));
}

function seedStore(): TaskloomData {
  const createdAt = now();
  const users: UserRecord[] = [
    createSeedUser("user_alpha", "alpha@taskloom.local", "Alpha Owner", createdAt),
    createSeedUser("user_beta", "beta@taskloom.local", "Beta Owner", createdAt),
    createSeedUser("user_gamma", "gamma@taskloom.local", "Gamma Owner", createdAt),
  ];

  const workspaces: WorkspaceRecord[] = [
    createWorkspaceRecord("alpha", "Alpha Workspace", "https://alpha.example.com", "Capture the implementation brief and move into validation.", createdAt),
    createWorkspaceRecord("beta", "Beta Workspace", "https://beta.example.com", "Recover from blockers and regain forward progress.", createdAt),
    createWorkspaceRecord("gamma", "Gamma Workspace", "https://gamma.example.com", "Sustain a complete release process for the workspace.", createdAt),
  ];

  const memberships: WorkspaceMemberRecord[] = [
    { workspaceId: "alpha", userId: "user_alpha", role: "owner", joinedAt: createdAt },
    { workspaceId: "beta", userId: "user_beta", role: "owner", joinedAt: createdAt },
    { workspaceId: "gamma", userId: "user_gamma", role: "owner", joinedAt: createdAt },
  ];

  const workspaceBriefs: WorkspaceBriefCollection = {
    alpha: {
      workspaceId: "alpha",
      summary: "Capture a concise onboarding brief and move the workspace into validation.",
      goals: ["Capture validation evidence", "Track remaining launch question"],
      audience: "Implementation lead and customer success manager",
      constraints: "First release should avoid optional reporting scope until it is confirmed.",
      problemStatement: "The implementation scope is understood, but release readiness still needs durable validation evidence.",
      targetCustomers: ["Implementation lead", "Customer success manager"],
      desiredOutcome: "A ready-to-review workspace with one remaining question tracked.",
      successMetrics: ["Validation checklist has passing evidence", "Open questions have owners"],
      updatedByUserId: "user_alpha",
      createdAt: isoDaysAgo(9),
      updatedAt: isoDaysAgo(2),
    },
    beta: {
      workspaceId: "beta",
      summary: "Recover a blocked implementation by clarifying dependencies and ownership.",
      goals: ["Resolve dependency ownership", "Clarify retry scope"],
      audience: "Operations owner and technical lead",
      constraints: "Implementation restart is blocked until the dependency owner is confirmed.",
      problemStatement: "Dependency gaps and unanswered scope questions are preventing forward progress.",
      targetCustomers: ["Operations owner", "Technical lead"],
      desiredOutcome: "Critical blockers are visible and the implementation plan can restart.",
      successMetrics: ["Dependency blocker is resolved", "Critical issue has an owner", "Retry plan is documented"],
      updatedByUserId: "user_beta",
      createdAt: isoDaysAgo(14),
      updatedAt: isoDaysAgo(4),
    },
    gamma: {
      workspaceId: "gamma",
      summary: "Maintain a complete release workflow from requirements through confirmation.",
      goals: ["Preserve release evidence", "Keep confirmation auditable"],
      audience: "Product manager and release owner",
      constraints: "Release records must stay linked to validation evidence.",
      problemStatement: "The workflow is complete and needs a durable audit trail for release confidence.",
      targetCustomers: ["Product manager", "Release owner"],
      desiredOutcome: "Release confirmation remains tied to validation evidence and requirements.",
      successMetrics: ["Release confirmation is recorded", "Validation evidence is linked to the plan"],
      updatedByUserId: "user_gamma",
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(7),
    },
  };

  const requirements: RequirementRecord[] = [
    {
      id: "req_alpha_validation",
      workspaceId: "alpha",
      title: "Capture validation evidence before release",
      detail: "Record proof that the implemented workflow meets the activation checklist.",
      priority: "must",
      status: "approved",
      acceptanceCriteria: ["Evidence includes outcome, owner, and linked plan item", "Failed checks create follow-up work"],
      source: "brief",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(8),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "req_alpha_questions",
      workspaceId: "alpha",
      title: "Track remaining launch questions",
      detail: "Keep unanswered launch questions visible until they are resolved or deferred.",
      priority: "should",
      status: "approved",
      acceptanceCriteria: ["Each question has status and owner", "Resolved questions keep their resolution note"],
      source: "team",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(7),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: "req_beta_dependencies",
      workspaceId: "beta",
      title: "Unblock dependency decisions",
      detail: "Identify dependency blockers and critical scope decisions before restarting implementation.",
      priority: "must",
      status: "changed",
      acceptanceCriteria: ["Critical blockers are marked high or critical", "Dependency owner is assigned"],
      source: "customer",
      createdByUserId: "user_beta",
      createdAt: isoDaysAgo(12),
      updatedAt: isoDaysAgo(5),
    },
    {
      id: "req_gamma_release_audit",
      workspaceId: "gamma",
      title: "Preserve release audit trail",
      detail: "Tie release confirmation to validation evidence and notes for later review.",
      priority: "must",
      status: "done",
      acceptanceCriteria: ["Release version is recorded", "Confirmation references validation evidence"],
      source: "brief",
      createdByUserId: "user_gamma",
      createdAt: isoDaysAgo(28),
      updatedAt: isoDaysAgo(7),
    },
  ];

  const implementationPlanItems: ImplementationPlanItemRecord[] = [
    {
      id: "plan_alpha_validation",
      workspaceId: "alpha",
      requirementIds: ["req_alpha_validation"],
      title: "Collect validation proof",
      description: "Attach the passing test run and manual review notes to the workspace.",
      status: "in_progress",
      ownerUserId: "user_alpha",
      order: 1,
      startedAt: isoDaysAgo(4),
      createdAt: isoDaysAgo(7),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "plan_alpha_questions",
      workspaceId: "alpha",
      requirementIds: ["req_alpha_questions"],
      title: "Resolve launch question",
      description: "Confirm whether the first release needs the optional reporting view.",
      status: "todo",
      ownerUserId: "user_alpha",
      order: 2,
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: "plan_beta_restart",
      workspaceId: "beta",
      requirementIds: ["req_beta_dependencies"],
      title: "Restart implementation after dependency review",
      description: "Document dependency ownership, then move the implementation back to active work.",
      status: "blocked",
      ownerUserId: "user_beta",
      order: 1,
      startedAt: isoDaysAgo(6),
      createdAt: isoDaysAgo(10),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "plan_gamma_release",
      workspaceId: "gamma",
      requirementIds: ["req_gamma_release_audit"],
      title: "Confirm release package",
      description: "Verify evidence links and record release confirmation.",
      status: "done",
      ownerUserId: "user_gamma",
      order: 1,
      startedAt: isoDaysAgo(24),
      completedAt: isoDaysAgo(7),
      createdAt: isoDaysAgo(28),
      updatedAt: isoDaysAgo(7),
    },
  ];

  const workflowConcerns: WorkflowConcernRecord[] = [
    {
      id: "question_alpha_reporting",
      workspaceId: "alpha",
      kind: "open_question",
      title: "Is reporting required for the first release?",
      description: "Confirm whether reporting should ship now or remain a post-release follow-up.",
      status: "open",
      severity: "medium",
      relatedRequirementId: "req_alpha_questions",
      relatedPlanItemId: "plan_alpha_questions",
      ownerUserId: "user_alpha",
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "blocker_beta_dependency",
      workspaceId: "beta",
      kind: "blocker",
      title: "Customer dependency owner is unconfirmed",
      description: "Implementation cannot restart until the external dependency owner is named.",
      status: "open",
      severity: "critical",
      relatedRequirementId: "req_beta_dependencies",
      relatedPlanItemId: "plan_beta_restart",
      ownerUserId: "user_beta",
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "question_beta_scope",
      workspaceId: "beta",
      kind: "open_question",
      title: "Should the retry include the expanded scope?",
      description: "Decide whether the scope change is included in the next implementation retry.",
      status: "open",
      severity: "high",
      relatedRequirementId: "req_beta_dependencies",
      ownerUserId: "user_beta",
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "blocker_gamma_none",
      workspaceId: "gamma",
      kind: "blocker",
      title: "Release audit review completed",
      description: "Historical blocker closed after release evidence was attached.",
      status: "resolved",
      severity: "low",
      relatedRequirementId: "req_gamma_release_audit",
      relatedPlanItemId: "plan_gamma_release",
      ownerUserId: "user_gamma",
      resolvedAt: isoDaysAgo(10),
      resolutionNote: "Evidence and release notes were linked before confirmation.",
      createdAt: isoDaysAgo(18),
      updatedAt: isoDaysAgo(10),
    },
  ];

  const validationEvidence: ValidationEvidenceRecord[] = [
    {
      id: "evidence_alpha_tests",
      workspaceId: "alpha",
      planItemId: "plan_alpha_validation",
      requirementIds: ["req_alpha_validation"],
      type: "automated_test",
      title: "Activation validation checks passed",
      detail: "Latest validation run passed with no critical issues.",
      status: "passed",
      source: "local validation run",
      capturedByUserId: "user_alpha",
      capturedAt: isoDaysAgo(1),
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "evidence_beta_failed_retry",
      workspaceId: "beta",
      planItemId: "plan_beta_restart",
      requirementIds: ["req_beta_dependencies"],
      type: "manual_check",
      title: "Dependency review failed",
      detail: "Manual review found that the dependency owner is still missing.",
      status: "failed",
      source: "dependency review",
      capturedByUserId: "user_beta",
      capturedAt: isoDaysAgo(3),
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: "evidence_gamma_release_demo",
      workspaceId: "gamma",
      planItemId: "plan_gamma_release",
      requirementIds: ["req_gamma_release_audit"],
      type: "demo",
      title: "Release workflow demo accepted",
      detail: "Release owner accepted the final workflow demo.",
      status: "passed",
      source: "release demo",
      capturedByUserId: "user_gamma",
      capturedAt: isoDaysAgo(10),
      createdAt: isoDaysAgo(10),
      updatedAt: isoDaysAgo(10),
    },
  ];

  const providers: ProviderRecord[] = [
    createProvider("provider_alpha_openai", "alpha", "OpenAI", "openai", "gpt-4.1-mini", true, createdAt),
    createProvider("provider_beta_anthropic", "beta", "Anthropic", "anthropic", "claude-3-5-sonnet-latest", false, createdAt),
    createProvider("provider_gamma_ollama", "gamma", "Local Ollama", "ollama", "llama3.1", true, createdAt, "http://localhost:11434"),
  ];

  const agents: AgentRecord[] = [
    createAgent({
      id: "agent_alpha_support",
      workspaceId: "alpha",
      createdByUserId: "user_alpha",
      name: "Support inbox triage",
      description: "Classifies new support emails, drafts replies, and flags urgent requests.",
      instructions: "Watch the support inbox. Classify urgency, draft a concise reply, and alert the owner when severity is high.",
      providerId: "provider_alpha_openai",
      model: "gpt-4.1-mini",
      tools: ["gmail", "email_drafts", "notifications"],
      schedule: "*/15 * * * *",
      status: "active",
      timestamp: createdAt,
    }),
    createAgent({
      id: "agent_alpha_daily_brief",
      workspaceId: "alpha",
      createdByUserId: "user_alpha",
      name: "Daily workspace brief",
      description: "Summarizes open work, recent runs, blockers, and questions every weekday morning.",
      instructions: "Generate a compact morning brief from recent activity, open questions, blockers, and validation state.",
      providerId: "provider_alpha_openai",
      model: "gpt-4.1-mini",
      tools: ["activity", "workflow", "email"],
      schedule: "0 8 * * 1-5",
      status: "active",
      timestamp: createdAt,
    }),
    createAgent({
      id: "agent_beta_dependency_watch",
      workspaceId: "beta",
      createdByUserId: "user_beta",
      name: "Dependency watcher",
      description: "Monitors unresolved implementation dependencies and prepares escalation notes.",
      instructions: "Track critical blockers and summarize what is needed to restart implementation.",
      providerId: "provider_beta_anthropic",
      model: "claude-3-5-sonnet-latest",
      tools: ["workflow", "activity"],
      schedule: "0 9 * * 1-5",
      status: "paused",
      timestamp: createdAt,
    }),
    createAgent({
      id: "agent_gamma_release_audit",
      workspaceId: "gamma",
      createdByUserId: "user_gamma",
      name: "Release audit",
      description: "Checks release evidence and prepares a confirmation summary.",
      instructions: "Review validation evidence, release confirmation, and open questions before release.",
      providerId: "provider_gamma_ollama",
      model: "llama3.1",
      tools: ["validation", "release_notes"],
      schedule: "On demand",
      status: "active",
      timestamp: createdAt,
    }),
  ];

  const workspaceEnvVars: WorkspaceEnvVarRecord[] = [
    {
      id: "env_alpha_api_base",
      workspaceId: "alpha",
      key: "ALPHA_API_BASE",
      value: "https://api.alpha.example.com",
      scope: "all",
      secret: false,
      description: "Base URL for the Alpha workspace integration.",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(8),
      updatedAt: isoDaysAgo(8),
    },
    {
      id: "env_alpha_signing_secret",
      workspaceId: "alpha",
      key: "ALPHA_SIGNING_SECRET",
      value: "alpha_demo_signing_secret",
      scope: "runtime",
      secret: true,
      description: "Webhook signing secret used by runtime handlers.",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(6),
    },
    {
      id: "env_beta_feature_flag",
      workspaceId: "beta",
      key: "BETA_FEATURE_RETRY",
      value: "false",
      scope: "build",
      secret: false,
      description: "Toggle to enable retry experiments during builds.",
      createdByUserId: "user_beta",
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(2),
    },
  ];

  const agentRuns: AgentRunRecord[] = [
    createAgentRun("run_alpha_support_latest", "alpha", "agent_alpha_support", "Support inbox scanned", "success", isoDaysAgo(0)),
    createAgentRun("run_alpha_brief_latest", "alpha", "agent_alpha_daily_brief", "Daily workspace brief generated", "success", isoDaysAgo(1)),
    createAgentRun(
      "run_beta_dependency_latest",
      "beta",
      "agent_beta_dependency_watch",
      "Dependency escalation skipped while provider key is missing",
      "failed",
      isoDaysAgo(2),
      "Provider API key is not configured.",
    ),
    createAgentRun("run_gamma_release_latest", "gamma", "agent_gamma_release_audit", "Release audit completed", "success", isoDaysAgo(7)),
  ];

  const releaseConfirmations: ReleaseConfirmationCollection = {
    alpha: {
      id: "release_alpha_pending",
      workspaceId: "alpha",
      confirmed: false,
      summary: "Waiting for the remaining launch question before confirmation.",
      confirmedBy: "",
      versionLabel: "alpha-validation",
      status: "pending",
      releaseNotes: "Waiting for the remaining launch question before confirmation.",
      validationEvidenceIds: ["evidence_alpha_tests"],
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
    },
    beta: {
      id: "release_beta_blocked",
      workspaceId: "beta",
      confirmed: false,
      summary: "Release remains pending until dependency ownership is resolved.",
      confirmedBy: "",
      versionLabel: "beta-retry",
      status: "pending",
      releaseNotes: "Release remains pending until dependency ownership is resolved.",
      validationEvidenceIds: ["evidence_beta_failed_retry"],
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(2),
    },
    gamma: {
      id: "release_gamma_confirmed",
      workspaceId: "gamma",
      confirmed: true,
      summary: "Initial release confirmed with linked validation evidence.",
      confirmedBy: "Gamma Owner",
      versionLabel: "gamma-1.0",
      status: "confirmed",
      confirmedByUserId: "user_gamma",
      confirmedAt: isoDaysAgo(7),
      releaseNotes: "Initial release confirmed with linked validation evidence.",
      validationEvidenceIds: ["evidence_gamma_release_demo"],
      createdAt: isoDaysAgo(8),
      updatedAt: isoDaysAgo(7),
    },
  };

  const activationFacts: Record<string, WorkspaceActivationFacts> = {
    alpha: {
      now: createdAt,
      createdAt: isoDaysAgo(9),
      briefCapturedAt: isoDaysAgo(9),
      requirementsDefinedAt: isoDaysAgo(7),
      planDefinedAt: isoDaysAgo(7),
      implementationStartedAt: isoDaysAgo(4),
      testsPassedAt: isoDaysAgo(1),
      blockerCount: 0,
      dependencyBlockerCount: 0,
      openQuestionCount: 1,
      criticalIssueCount: 0,
      scopeChangeCount: 1,
      failedValidationCount: 0,
      retryCount: 1,
    },
    beta: {
      now: createdAt,
      createdAt: isoDaysAgo(14),
      briefCapturedAt: isoDaysAgo(14),
      requirementsDefinedAt: isoDaysAgo(11),
      planDefinedAt: isoDaysAgo(10),
      implementationStartedAt: isoDaysAgo(6),
      blockerCount: 2,
      dependencyBlockerCount: 1,
      openQuestionCount: 3,
      criticalIssueCount: 1,
      scopeChangeCount: 2,
      failedValidationCount: 1,
      retryCount: 2,
    },
    gamma: {
      now: createdAt,
      createdAt: isoDaysAgo(30),
      briefCapturedAt: isoDaysAgo(30),
      requirementsDefinedAt: isoDaysAgo(28),
      planDefinedAt: isoDaysAgo(28),
      implementationStartedAt: isoDaysAgo(24),
      completedAt: isoDaysAgo(12),
      testsPassedAt: isoDaysAgo(11),
      validationPassedAt: isoDaysAgo(10),
      releaseConfirmedAt: isoDaysAgo(7),
      blockerCount: 0,
      dependencyBlockerCount: 0,
      openQuestionCount: 0,
      criticalIssueCount: 0,
      scopeChangeCount: 0,
      failedValidationCount: 0,
      retryCount: 0,
    },
  };

  return {
    users,
    sessions: [],
    workspaces,
    memberships,
    workspaceBriefs,
    requirements,
    implementationPlanItems,
    workflowConcerns,
    validationEvidence,
    releaseConfirmations,
    onboardingStates: [
      createOnboardingState("alpha", ["create_workspace_profile", "define_requirements", "define_plan", "start_implementation"], "validate", createdAt),
      createOnboardingState("beta", ["create_workspace_profile", "define_requirements", "define_plan"], "start_implementation", createdAt),
      createOnboardingState("gamma", ["create_workspace_profile", "define_requirements", "define_plan", "start_implementation", "validate", "confirm_release"], "confirm_release", createdAt, true),
    ],
    activities: [
      createActivity("alpha", "account", "account.created", { type: "system", id: "seed" }, { title: "Workspace initialized" }, createdAt),
      createActivity("beta", "account", "account.created", { type: "system", id: "seed" }, { title: "Workspace initialized" }, createdAt),
      createActivity("gamma", "account", "account.created", { type: "system", id: "seed" }, { title: "Workspace initialized" }, createdAt),
    ],
    agents,
    providers,
    agentRuns,
    workspaceEnvVars,
    activationFacts,
    activationMilestones: {},
    activationReadModels: {},
  };
}

export function resetStoreForTests(): TaskloomData {
  cache = seedStore();
  persistStore(cache);
  return cache;
}

function createSeedUser(id: string, email: string, displayName: string, timestamp: string): UserRecord {
  return {
    id,
    email,
    displayName,
    timezone: "UTC",
    passwordHash: hashPassword("demo12345"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createWorkspaceRecord(id: string, name: string, website: string, automationGoal: string, timestamp: string): WorkspaceRecord {
  return {
    id,
    slug: slugify(name) || id,
    name,
    website,
    automationGoal,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createOnboardingState(
  workspaceId: string,
  completedSteps: OnboardingStepKey[],
  currentStep: OnboardingStepKey,
  timestamp: string,
  completed = false,
): OnboardingStateRecord {
  return {
    workspaceId,
    status: completed ? "completed" : completedSteps.length > 0 ? "in_progress" : "not_started",
    currentStep,
    completedSteps,
    completedAt: completed ? timestamp : undefined,
    updatedAt: timestamp,
  };
}

function createActivity(
  workspaceId: string,
  scope: ActivityRecord["scope"],
  event: string,
  actor: ActivityRecord["actor"],
  data: ActivityRecord["data"],
  timestamp: string,
): ActivityRecord {
  return {
    id: `${workspaceId}_${event}_${timestamp}`,
    workspaceId,
    scope,
    event,
    actor,
    data,
    occurredAt: timestamp,
  };
}

function createProvider(
  id: string,
  workspaceId: string,
  name: string,
  kind: ProviderKind,
  defaultModel: string,
  apiKeyConfigured: boolean,
  timestamp: string,
  baseUrl?: string,
): ProviderRecord {
  return {
    id,
    workspaceId,
    name,
    kind,
    defaultModel,
    baseUrl,
    apiKeyConfigured,
    status: apiKeyConfigured ? "connected" : "missing_key",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createAgent(input: {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  description: string;
  instructions: string;
  providerId?: string;
  model?: string;
  tools: string[];
  schedule?: string;
  status: AgentStatus;
  timestamp: string;
}): AgentRecord {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    providerId: input.providerId,
    model: input.model,
    tools: input.tools,
    schedule: input.schedule,
    status: input.status,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
}

function createAgentRun(
  id: string,
  workspaceId: string,
  agentId: string,
  title: string,
  status: AgentRunStatus,
  timestamp: string,
  error?: string,
): AgentRunRecord {
  return {
    id,
    workspaceId,
    agentId,
    title,
    status,
    startedAt: timestamp,
    completedAt: status === "queued" || status === "running" ? undefined : timestamp,
    error,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function defaultWorkspaceIdForUser(data: TaskloomData, userId: string): string | null {
  return data.memberships.find((entry) => entry.userId === userId)?.workspaceId ?? null;
}

export function findWorkspaceMembership(data: TaskloomData, workspaceId: string, userId: string): WorkspaceMemberRecord | null {
  return data.memberships.find((entry) => entry.workspaceId === workspaceId && entry.userId === userId) ?? null;
}

export function upsertWorkspaceMembership(data: TaskloomData, input: WorkspaceMemberRecord): WorkspaceMemberRecord {
  const existing = findWorkspaceMembership(data, input.workspaceId, input.userId);
  if (existing) {
    existing.role = input.role;
    existing.joinedAt = input.joinedAt;
    return existing;
  }

  data.memberships.push(input);
  return input;
}

export type WorkspaceBriefUpsertInput = Omit<WorkspaceBriefRecord, "createdAt" | "updatedAt"> &
  Partial<Pick<WorkspaceBriefRecord, "createdAt" | "updatedAt">>;

export function findWorkspaceBrief(data: TaskloomData, workspaceId: string): WorkspaceBriefRecord | null {
  return workspaceBriefEntries(data.workspaceBriefs).find((entry) => entry.workspaceId === workspaceId) ?? null;
}

export function upsertWorkspaceBrief(
  data: TaskloomData,
  input: WorkspaceBriefUpsertInput,
  timestamp = now(),
): WorkspaceBriefRecord {
  const existing = findWorkspaceBrief(data, input.workspaceId);
  if (existing) {
    Object.assign(existing, input, { updatedAt: input.updatedAt ?? timestamp });
    return existing;
  }

  const next: WorkspaceBriefRecord = {
    ...input,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
  if (Array.isArray(data.workspaceBriefs)) {
    data.workspaceBriefs.push(next);
  } else {
    data.workspaceBriefs[next.workspaceId] = next;
  }
  return next;
}

export type RequirementUpsertInput = Omit<RequirementRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<RequirementRecord, "id" | "createdAt" | "updatedAt">>;

export function listRequirementsForWorkspace(data: TaskloomData, workspaceId: string): RequirementRecord[] {
  return data.requirements.filter((entry) => entry.workspaceId === workspaceId);
}

export function findRequirement(data: TaskloomData, requirementId: string): RequirementRecord | null {
  return data.requirements.find((entry) => entry.id === requirementId) ?? null;
}

export function upsertRequirement(data: TaskloomData, input: RequirementUpsertInput, timestamp = now()): RequirementRecord {
  return upsertRecord(data.requirements, input, timestamp);
}

export type ImplementationPlanItemUpsertInput = Omit<ImplementationPlanItemRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ImplementationPlanItemRecord, "id" | "createdAt" | "updatedAt">>;

export function listImplementationPlanItemsForWorkspace(data: TaskloomData, workspaceId: string): ImplementationPlanItemRecord[] {
  return data.implementationPlanItems
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => left.order - right.order);
}

export function findImplementationPlanItem(data: TaskloomData, planItemId: string): ImplementationPlanItemRecord | null {
  return data.implementationPlanItems.find((entry) => entry.id === planItemId) ?? null;
}

export function upsertImplementationPlanItem(
  data: TaskloomData,
  input: ImplementationPlanItemUpsertInput,
  timestamp = now(),
): ImplementationPlanItemRecord {
  return upsertRecord(data.implementationPlanItems, input, timestamp);
}

export type WorkflowConcernUpsertInput = Omit<WorkflowConcernRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<WorkflowConcernRecord, "id" | "createdAt" | "updatedAt">>;

export function listWorkflowConcernsForWorkspace(
  data: TaskloomData,
  workspaceId: string,
  kind?: WorkflowConcernKind,
): WorkflowConcernRecord[] {
  return data.workflowConcerns.filter((entry) => entry.workspaceId === workspaceId && (!kind || entry.kind === kind));
}

export function findWorkflowConcern(data: TaskloomData, concernId: string): WorkflowConcernRecord | null {
  return data.workflowConcerns.find((entry) => entry.id === concernId) ?? null;
}

export function upsertWorkflowConcern(
  data: TaskloomData,
  input: WorkflowConcernUpsertInput,
  timestamp = now(),
): WorkflowConcernRecord {
  return upsertRecord(data.workflowConcerns, input, timestamp);
}

export type ValidationEvidenceUpsertInput = Omit<ValidationEvidenceRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ValidationEvidenceRecord, "id" | "createdAt" | "updatedAt">>;

export function listValidationEvidenceForWorkspace(data: TaskloomData, workspaceId: string): ValidationEvidenceRecord[] {
  return data.validationEvidence.filter((entry) => entry.workspaceId === workspaceId);
}

export function findValidationEvidence(data: TaskloomData, evidenceId: string): ValidationEvidenceRecord | null {
  return data.validationEvidence.find((entry) => entry.id === evidenceId) ?? null;
}

export function upsertValidationEvidence(
  data: TaskloomData,
  input: ValidationEvidenceUpsertInput,
  timestamp = now(),
): ValidationEvidenceRecord {
  return upsertRecord(data.validationEvidence, input, timestamp);
}

export type ReleaseConfirmationUpsertInput = Omit<ReleaseConfirmationRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ReleaseConfirmationRecord, "id" | "createdAt" | "updatedAt">>;

export function listReleaseConfirmationsForWorkspace(data: TaskloomData, workspaceId: string): ReleaseConfirmationRecord[] {
  return releaseConfirmationEntries(data.releaseConfirmations).filter((entry) => entry.workspaceId === workspaceId);
}

export function findReleaseConfirmation(data: TaskloomData, releaseConfirmationId: string): ReleaseConfirmationRecord | null {
  return releaseConfirmationEntries(data.releaseConfirmations).find((entry) => {
    return entry.id === releaseConfirmationId || entry.workspaceId === releaseConfirmationId;
  }) ?? null;
}

export function upsertReleaseConfirmation(
  data: TaskloomData,
  input: ReleaseConfirmationUpsertInput,
  timestamp = now(),
): ReleaseConfirmationRecord {
  const existing = releaseConfirmationEntries(data.releaseConfirmations).find((entry) => {
    return (input.id && entry.id === input.id) || entry.workspaceId === input.workspaceId;
  });
  if (existing) {
    Object.assign(existing, input, { updatedAt: input.updatedAt ?? timestamp });
    return existing;
  }

  const next: ReleaseConfirmationRecord = {
    ...input,
    id: input.id ?? generateId(),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
  if (Array.isArray(data.releaseConfirmations)) {
    data.releaseConfirmations.push(next);
  } else {
    data.releaseConfirmations[next.workspaceId] = next;
  }
  return next;
}

export type AgentUpsertInput = Omit<AgentRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<AgentRecord, "id" | "createdAt" | "updatedAt">>;

export function listAgentsForWorkspace(data: TaskloomData, workspaceId: string, includeArchived = false): AgentRecord[] {
  return data.agents
    .filter((entry) => entry.workspaceId === workspaceId && (includeArchived || entry.status !== "archived"))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function findAgent(data: TaskloomData, agentId: string): AgentRecord | null {
  return data.agents.find((entry) => entry.id === agentId) ?? null;
}

export function upsertAgent(data: TaskloomData, input: AgentUpsertInput, timestamp = now()): AgentRecord {
  return upsertRecord(data.agents, input, timestamp);
}

export function listProvidersForWorkspace(data: TaskloomData, workspaceId: string): ProviderRecord[] {
  return data.providers
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function findProvider(data: TaskloomData, providerId: string): ProviderRecord | null {
  return data.providers.find((entry) => entry.id === providerId) ?? null;
}

export type ProviderUpsertInput = Omit<ProviderRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ProviderRecord, "id" | "createdAt" | "updatedAt">>;

export function upsertProvider(data: TaskloomData, input: ProviderUpsertInput, timestamp = now()): ProviderRecord {
  return upsertRecord(data.providers, input, timestamp);
}

export type AgentRunUpsertInput = Omit<AgentRunRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<AgentRunRecord, "id" | "createdAt" | "updatedAt">>;

export function listAgentRunsForWorkspace(data: TaskloomData, workspaceId: string): AgentRunRecord[] {
  return data.agentRuns
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listAgentRunsForAgent(data: TaskloomData, workspaceId: string, agentId: string): AgentRunRecord[] {
  return listAgentRunsForWorkspace(data, workspaceId).filter((entry) => entry.agentId === agentId);
}

export function upsertAgentRun(data: TaskloomData, input: AgentRunUpsertInput, timestamp = now()): AgentRunRecord {
  return upsertRecord(data.agentRuns, input, timestamp);
}

export const ONBOARDING_STEPS: OnboardingStepKey[] = [
  "create_workspace_profile",
  "define_requirements",
  "define_plan",
  "start_implementation",
  "validate",
  "confirm_release",
];

export function nextIncompleteStep(completedSteps: OnboardingStepKey[]): OnboardingStepKey {
  return ONBOARDING_STEPS.find((step) => !completedSteps.includes(step)) ?? "confirm_release";
}

export function snapshotForWorkspace(data: TaskloomData, workspaceId: string) {
  return buildSignalSnapshotFromFacts({
    ...data.activationFacts[workspaceId],
    now: now(),
  });
}

function upsertRecord<TRecord extends { id: string; createdAt: string; updatedAt: string }>(
  records: TRecord[],
  input: Omit<TRecord, "id" | "createdAt" | "updatedAt"> & Partial<Pick<TRecord, "id" | "createdAt" | "updatedAt">>,
  timestamp: string,
): TRecord {
  const id = input.id ?? generateId();
  const existing = records.find((entry) => entry.id === id);
  if (existing) {
    Object.assign(existing, input, { id, updatedAt: input.updatedAt ?? timestamp });
    return existing;
  }

  const next = {
    ...input,
    id,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  } as TRecord;
  records.push(next);
  return next;
}

export function listWorkspaceEnvVars(data: TaskloomData, workspaceId: string): WorkspaceEnvVarRecord[] {
  return data.workspaceEnvVars
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function findWorkspaceEnvVar(data: TaskloomData, envVarId: string): WorkspaceEnvVarRecord | null {
  return data.workspaceEnvVars.find((entry) => entry.id === envVarId) ?? null;
}

export type WorkspaceEnvVarUpsertInput = Omit<WorkspaceEnvVarRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<WorkspaceEnvVarRecord, "id" | "createdAt" | "updatedAt">>;

export function upsertWorkspaceEnvVar(
  data: TaskloomData,
  input: WorkspaceEnvVarUpsertInput,
  timestamp = now(),
): WorkspaceEnvVarRecord {
  return upsertRecord(data.workspaceEnvVars, input, timestamp);
}

export function deleteWorkspaceEnvVar(data: TaskloomData, envVarId: string): boolean {
  const before = data.workspaceEnvVars.length;
  data.workspaceEnvVars = data.workspaceEnvVars.filter((entry) => entry.id !== envVarId);
  return data.workspaceEnvVars.length < before;
}

function workspaceBriefEntries(collection: WorkspaceBriefCollection): WorkspaceBriefRecord[] {
  return Array.isArray(collection) ? collection : Object.values(collection);
}

function releaseConfirmationEntries(collection: ReleaseConfirmationCollection): ReleaseConfirmationRecord[] {
  return Array.isArray(collection) ? collection : Object.values(collection);
}
