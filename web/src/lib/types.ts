export interface Session {
  authenticated: true;
  user: {
    id: string;
    email: string;
    displayName: string;
    timezone: string;
  };
  workspace: {
    id: string;
    slug: string;
    name: string;
    website: string;
    automationGoal: string;
  };
  onboarding: {
    status: string;
    currentStep: string;
    completed: boolean;
    completedSteps: string[];
    completedAt: string | null;
  };
}

export interface ActivationSummaryItem {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  completedAt?: string;
}

export interface ActivationSummary {
  title: string;
  progressPercent: number;
  progressLabel: string;
  stageLabel: string;
  riskLabel: string;
  riskLevel: "low" | "medium" | "high";
  items: ActivationSummaryItem[];
  nextRecommendedAction: string | null;
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
export type AgentTriggerKind = "manual" | "schedule" | "webhook" | "email";
export type ProviderKind = "openai" | "anthropic" | "azure_openai" | "ollama" | "custom";
export type ProviderStatus = "connected" | "missing_key" | "disabled";
export type AgentRunStatus = "queued" | "running" | "success" | "failed" | "canceled";
export type AgentRunStepStatus = "success" | "failed" | "skipped";
export type AgentInputFieldType = "string" | "number" | "boolean" | "url" | "enum";
export type AgentRunLogLevel = "info" | "warn" | "error";

export interface AgentPlaybookStep {
  id: string;
  title: string;
  instruction: string;
}

export interface AgentRunStep {
  id: string;
  title: string;
  status: AgentRunStepStatus;
  output: string;
  durationMs: number;
  startedAt: string;
}

export interface AgentInputField {
  key: string;
  label: string;
  type: AgentInputFieldType;
  required: boolean;
  description?: string;
  options?: string[];
  defaultValue?: string;
}

export interface AgentRunLogEntry {
  at: string;
  level: AgentRunLogLevel;
  message: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  category: "support" | "operations" | "release" | "research" | "comms";
  summary: string;
  description: string;
  instructions: string;
  tools: string[];
  schedule?: string;
  inputSchema: AgentInputField[];
}

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

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  instructions: string;
  providerId?: string;
  provider?: Pick<ProviderRecord, "id" | "name" | "kind" | "defaultModel" | "status" | "apiKeyConfigured"> | null;
  model?: string;
  tools: string[];
  enabledTools?: string[];
  routeKey?: string;
  webhookToken?: string;
  schedule?: string;
  triggerKind?: AgentTriggerKind;
  playbook?: AgentPlaybookStep[];
  status: AgentStatus;
  createdByUserId: string;
  templateId?: string;
  inputSchema?: AgentInputField[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface AgentRunToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  artifacts?: { path: string; bytes: number; kind: string }[];
  durationMs: number;
  startedAt: string;
  completedAt: string;
  status: "ok" | "error" | "timeout";
}

export interface AgentRunRecord {
  id: string;
  workspaceId: string;
  agentId?: string;
  title: string;
  status: AgentRunStatus;
  triggerKind?: AgentTriggerKind;
  transcript?: AgentRunStep[];
  startedAt?: string;
  completedAt?: string;
  inputs?: Record<string, string | number | boolean>;
  output?: string;
  error?: string;
  logs?: AgentRunLogEntry[];
  toolCalls?: AgentRunToolCall[];
  modelUsed?: string;
  costUsd?: number;
  createdAt: string;
  updatedAt: string;
  durationMs?: number | null;
  canCancel?: boolean;
  canRetry?: boolean;
}

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
  valuePreview?: string | null;
  valueLength?: number;
}

export type SaveWorkspaceEnvVarInput = {
  key: string;
  value: string;
  scope?: WorkspaceEnvVarScope;
  secret?: boolean;
  description?: string;
};

export interface ReleaseHistoryEntry {
  id: string;
  workspaceId: string;
  versionLabel: string;
  status: "pending" | "confirmed" | "rolled_back";
  confirmed: boolean;
  summary: string;
  confirmedBy: string;
  confirmedAt: string | null;
  validationEvidenceIds: string[];
  updatedAt: string;
}

export interface ReleasePreflight {
  passedEvidence: number;
  failedEvidence: number;
  pendingEvidence: number;
  openBlockers: number;
  openQuestions: number;
  ready: boolean;
}

export interface ReleaseHistoryPayload {
  releases: ReleaseHistoryEntry[];
  preflight: ReleasePreflight;
}

export type SaveAgentInput = {
  name: string;
  description?: string;
  instructions: string;
  providerId?: string;
  model?: string;
  tools?: string[];
  enabledTools?: string[];
  routeKey?: string;
  schedule?: string;
  triggerKind?: AgentTriggerKind;
  playbook?: AgentPlaybookStep[];
  status?: AgentStatus;
  templateId?: string;
  inputSchema?: AgentInputField[];
};

export type SaveProviderInput = {
  name: string;
  kind: ProviderKind;
  defaultModel: string;
  baseUrl?: string;
  apiKeyConfigured?: boolean;
  status?: ProviderStatus;
};

export type WorkflowRequirementPriority = "must" | "should" | "could";
export type WorkflowRequirementStatus = "proposed" | "accepted" | "deferred";
export type WorkflowPlanItemStatus = "todo" | "in_progress" | "blocked" | "done";
export type WorkflowBlockerSeverity = "low" | "medium" | "high" | "critical";
export type WorkflowBlockerStatus = "open" | "resolved";
export type WorkflowQuestionStatus = "open" | "answered";
export type WorkflowValidationStatus = "pending" | "passed" | "failed";

export interface WorkflowBrief {
  workspaceId: string;
  summary: string;
  goals: string[];
  audience: string;
  constraints: string;
  problemStatement?: string;
  targetCustomers?: string[];
  desiredOutcome?: string;
  successMetrics?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowBriefVersion {
  id: string;
  workspaceId: string;
  versionNumber: number;
  summary: string;
  goals: string[];
  audience: string;
  constraints: string;
  problemStatement: string;
  targetCustomers: string[];
  desiredOutcome: string;
  successMetrics: string[];
  source: "manual" | "template" | "restore";
  sourceLabel?: string;
  createdByUserId?: string;
  createdByDisplayName?: string;
  createdAt: string;
}

export interface WorkflowBriefTemplate {
  id: string;
  name: string;
  description: string;
  brief: SaveWorkflowBriefInput;
}

export interface WorkflowRequirement {
  id: string;
  workspaceId: string;
  title: string;
  detail: string;
  priority: WorkflowRequirementPriority;
  status: WorkflowRequirementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowPlanItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: WorkflowPlanItemStatus;
  owner?: string;
  ownerUserId?: string;
  dueDate?: string;
  order: number;
  requirementIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowBlocker {
  id: string;
  workspaceId: string;
  title: string;
  detail: string;
  description?: string;
  severity: WorkflowBlockerSeverity;
  dependency?: boolean;
  relatedPlanItemId?: string;
  relatedRequirementId?: string;
  status: WorkflowBlockerStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface WorkflowQuestion {
  id: string;
  workspaceId: string;
  prompt: string;
  title?: string;
  answer: string;
  description?: string;
  status: WorkflowQuestionStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt?: string;
}

export interface WorkflowValidationEvidence {
  id: string;
  workspaceId: string;
  title: string;
  detail: string;
  description?: string;
  status: WorkflowValidationStatus;
  source: string;
  planItemId?: string;
  requirementIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowReleaseConfirmation {
  workspaceId: string;
  confirmed: boolean;
  summary: string;
  confirmedBy: string;
  confirmedAt?: string;
  updatedAt: string;
}

export interface WorkflowBlockersAndQuestionsPayload {
  blockers: WorkflowBlocker[];
  questions: WorkflowQuestion[];
}

export interface WorkflowOverviewPayload {
  brief: WorkflowBrief;
  requirements: WorkflowRequirement[];
  planItems: WorkflowPlanItem[];
  blockersAndQuestions: WorkflowBlockersAndQuestionsPayload;
  validationEvidence: WorkflowValidationEvidence[];
  releaseConfirmation: WorkflowReleaseConfirmation;
}

export type SaveWorkflowBriefInput = {
  summary: string;
  goals?: string[];
  audience?: string;
  constraints?: string;
  problemStatement?: string;
  targetCustomers?: string[];
  desiredOutcome?: string;
  successMetrics?: string[];
};

export type SaveWorkflowRequirementInput = {
  id?: string;
  title: string;
  detail?: string;
  description?: string;
  priority?: WorkflowRequirementPriority;
  status?: WorkflowRequirementStatus;
};

export type SaveWorkflowPlanItemInput = {
  id?: string;
  title: string;
  description?: string;
  status?: WorkflowPlanItemStatus;
  owner?: string;
  dueDate?: string;
};

export type SaveWorkflowBlockerInput = {
  id?: string;
  title: string;
  detail?: string;
  description?: string;
  severity?: WorkflowBlockerSeverity;
  dependency?: boolean;
  status?: WorkflowBlockerStatus;
};

export type SaveWorkflowQuestionInput = {
  id?: string;
  prompt: string;
  title?: string;
  answer?: string;
  description?: string;
  status?: WorkflowQuestionStatus;
};

export type SaveWorkflowValidationEvidenceInput = {
  id?: string;
  title: string;
  detail?: string;
  description?: string;
  status?: WorkflowValidationStatus;
  source?: string;
};

export type ConfirmWorkflowReleaseInput = {
  confirmed: boolean;
  summary?: string;
  confirmedBy?: string;
};

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  brief: {
    summary: string;
    problemStatement: string;
    desiredOutcome: string;
    audience: string;
    constraints: string;
    targetCustomers: string[];
    successMetrics: string[];
    goals: string[];
  };
  requirements: Array<{ title: string; detail: string; priority: WorkflowRequirementPriority }>;
  planItems: Array<{ title: string; description: string }>;
}

export interface WorkflowTemplateApplyResult {
  template: WorkflowTemplate;
  brief: WorkflowBrief;
  requirements: WorkflowRequirement[];
  planItems: WorkflowPlanItem[];
}

export interface WorkflowDraft {
  prompt: string;
  brief: {
    summary: string;
    problemStatement: string;
    desiredOutcome: string;
    targetCustomers: string[];
    successMetrics: string[];
    goals: string[];
    audience: string;
    constraints: string;
  };
  requirements: Array<{
    title: string;
    detail: string;
    priority: WorkflowRequirementPriority;
    status: "accepted";
  }>;
  planItems: Array<{ title: string; description: string; status: "todo" }>;
}

export interface WorkflowDraftResult {
  draft: WorkflowDraft;
  applied: boolean;
  brief?: WorkflowBrief;
  requirements?: WorkflowRequirement[];
  planItems?: WorkflowPlanItem[];
}

export interface DashboardFilterMetadata {
  stages?: Array<{ value: string; label: string; count: number }>;
  risks?: Array<{ value: ActivationSummary["riskLevel"]; label: string; count: number }>;
  statuses?: Array<{ value: "healthy" | "attention" | "failing"; label: string; count: number }>;
}

export interface ActivationDetailPayload {
  workspace: Session["workspace"];
  onboarding: BootstrapPayload["onboarding"];
  activation: BootstrapPayload["activation"];
  activities: ActivityRecord[];
}

export interface ActivityDetailPayload {
  activity: ActivityRecord;
  previous: ActivityRecord | null;
  next: ActivityRecord | null;
}

export interface BootstrapPayload {
  user: Session["user"];
  workspace: Session["workspace"];
  onboarding: {
    workspaceId: string;
    status: string;
    currentStep: string;
    completedSteps: string[];
    completedAt?: string;
    updatedAt: string;
  };
  activation: {
    status: {
      stage: string;
      risk: { score: number; level: "low" | "medium" | "high"; reasons: string[] };
      milestones: Array<{ key: string; reached: boolean; reachedAt?: string; reason: string }>;
      checklist: Array<{ key: string; completed: boolean; completedAt?: string; reason: string }>;
    };
    summary: ActivationSummary;
  };
  activities: ActivityRecord[];
}

export interface PublicDashboardPayload {
  filters?: DashboardFilterMetadata;
  summaries: Array<{
    subject: {
      workspaceId: string;
      subjectType: string;
      subjectId: string;
    };
    status: BootstrapPayload["activation"]["status"];
    summary: ActivationSummary;
  }>;
}

export type ApiKeyProviderName = "anthropic" | "openai" | "minimax" | "ollama";

export interface MaskedApiKey {
  id: string;
  workspaceId: string;
  provider: ApiKeyProviderName;
  label: string;
  masked: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCallRecord {
  id: string;
  workspaceId: string;
  routeKey: string;
  provider: ApiKeyProviderName | "stub";
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
  status: "success" | "error" | "canceled";
  errorMessage?: string;
  startedAt: string;
  completedAt: string;
}

export interface UsageSummary {
  totalCalls: number;
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  last24h: { calls: number; costUsd: number };
  byProvider: { provider: ApiKeyProviderName | "stub"; calls: number; costUsd: number }[];
  byRoute: { routeKey: string; calls: number; costUsd: number }[];
  recent: ProviderCallRecord[];
}

export type JobStatus = "queued" | "running" | "success" | "failed" | "canceled";

export interface JobRecord {
  id: string;
  workspaceId: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  cron?: string;
  result?: unknown;
  error?: string;
  cancelRequested?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanModePlanItem {
  summary: string;
  status: "todo" | "doing" | "done";
}

export interface PlanModeResult {
  planItems: PlanModePlanItem[];
  rationale: string;
  modelUsed: string;
  costUsd: number;
}

export interface AvailableTool {
  name: string;
  description: string;
  side: "read" | "write" | "exec";
}

export interface RunDiagnostic {
  summary: string;
  likelyCause: string;
  suggestion: string;
  modelUsed: string;
  costUsd: number;
}
