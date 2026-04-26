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
export type ProviderKind = "openai" | "anthropic" | "azure_openai" | "ollama" | "custom";
export type ProviderStatus = "connected" | "missing_key" | "disabled";
export type AgentRunStatus = "queued" | "running" | "success" | "failed" | "canceled";

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
  schedule?: string;
  status: AgentStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

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

export type SaveAgentInput = {
  name: string;
  description?: string;
  instructions: string;
  providerId?: string;
  model?: string;
  tools?: string[];
  schedule?: string;
  status?: AgentStatus;
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
