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
    role?: "owner" | "admin" | "member" | "viewer";
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
  data: Record<string, unknown>;
}

export type WorkspaceRole = NonNullable<Session["workspace"]["role"]>;

export interface WorkspaceMemberRecord {
  userId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token?: string;
  tokenPreview?: string;
  invitedByUserId: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}

export interface WorkspaceMembersPayload {
  members: WorkspaceMemberRecord[];
  invitations: WorkspaceInvitationRecord[];
}

export type CreateWorkspaceInvitationInput = {
  email: string;
  role: WorkspaceRole;
};

export type AgentStatus = "active" | "paused" | "archived";
export type AgentTriggerKind = "manual" | "schedule" | "webhook" | "email";
export type ProviderKind = "openai" | "anthropic" | "minimax" | "azure_openai" | "ollama" | "custom";
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

export type BuilderModelPresetId = "fast" | "smart" | "cheap" | "local";

export interface BuilderModelRoutingChoice {
  provider: ProviderKind | "stub";
  model: string;
  source: "workspace_provider" | "env_hint" | "fallback";
  ready: boolean;
  blockers: string[];
  reason: string;
  providerId?: string;
  providerName?: string;
  envHints: string[];
}

export interface BuilderModelPreset {
  id: BuilderModelPresetId;
  label: string;
  model: string;
  summary: string;
  bestFor: string;
  goal?: string;
  primary?: BuilderModelRoutingChoice;
  fallbacks?: BuilderModelRoutingChoice[];
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

export interface IntegrationReadinessSummary {
  status: "ready" | "needs_setup";
  tools: {
    availableCount: number;
    readCount: number;
    writeCount: number;
    execCount: number;
    names: string[];
    missingForGeneratedPlans: string[];
  };
  providers: {
    configuredCount: number;
    readyCount: number;
    missingProviderKinds: ApiKeyProviderName[];
    missingApiKeys: Array<{ provider: ApiKeyProviderName; providerName: string }>;
  };
  recommendedSetup: string[];
}

export type IntegrationMarketplaceKind =
  | "llm"
  | "local_model"
  | "webhook"
  | "email"
  | "source_control"
  | "browser"
  | "payments"
  | "database"
  | "custom_api";

export type IntegrationSetupActionKind = "api_key" | "provider" | "env_url" | "env_secret" | "webhook";

export interface IntegrationSetupAction {
  kind: IntegrationSetupActionKind;
  label: string;
  envKey?: string;
  provider?: ApiKeyProviderName;
  providerKind?: ProviderKind;
  placeholder?: string;
  secret?: boolean;
  scope?: WorkspaceEnvVarScope;
}

export interface IntegrationMarketplaceCard {
  id: string;
  name: string;
  kind: IntegrationMarketplaceKind;
  summary: string;
  generatedWorkHint: string;
  providerKind?: ProviderKind;
  keyProvider?: ApiKeyProviderName;
  requiredEnvKeys?: string[];
  optionalEnvKeys?: string[];
  actions: IntegrationSetupAction[];
}

export type IntegrationSetupStatus = "configured" | "missing" | "test_passed" | "test_failed";

export interface IntegrationMarketplaceTestResult {
  test: {
    status: "pass" | "fail" | "pending";
    connectorId: string;
    message: string;
    setupGuide: string[];
    deterministic: boolean;
    liveNetworkCalls: boolean;
  };
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
  webhookTokenPreview?: string;
  hasWebhookToken?: boolean;
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

export interface AgentBuilderPlanStep {
  title: string;
  detail: string;
}

export interface AgentBuilderDraft {
  prompt: string;
  intent: string;
  summary: string;
  agent: SaveAgentInput & {
    description?: string;
  };
  sampleInputs: Record<string, string | number | boolean>;
  plan: {
    title: string;
    steps: AgentBuilderPlanStep[];
    acceptanceChecks: string[];
    openQuestions: string[];
  };
  readiness: {
    provider: {
      configured: boolean;
      selectedProviderId?: string;
      selectedProviderName?: string;
      selectedModel?: string;
      message: string;
    };
    tools: {
      recommended: string[];
      available: string[];
      missing: string[];
      message: string;
    };
    webhook: {
      recommended: boolean;
      readyAfterSave: boolean;
      message: string;
      planDetail: string;
      publishSteps: string[];
    };
    firstRun: {
      canRun: boolean;
      blockers: string[];
      message: string;
    };
  };
}

export interface AgentBuilderDraftResult {
  draft: AgentBuilderDraft;
}

export interface AgentBuilderApproveResult {
  draft: AgentBuilderDraft;
  created: true;
  agent?: AgentRecord;
  firstRun?: AgentRunRecord;
  sampleInputs?: Record<string, string | number | boolean>;
}

export type AppBuilderRouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AppBuilderCheckStatus = "pending" | "pass" | "warn" | "fail";
export type AppBuilderRouteAccess = "public" | "private" | "admin";
export type AppBuilderApplyStatus = "draft" | "saved" | "built";

export interface AppBuilderPageDraft {
  name: string;
  route: string;
  access: AppBuilderRouteAccess;
  purpose: string;
  actions: string[];
  components: string[];
}

export interface AppBuilderDataField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "enum" | "json" | "relation";
  required: boolean;
  notes?: string;
}

export interface AppBuilderDataEntity {
  name: string;
  fields: AppBuilderDataField[];
  relationships: string[];
}

export interface AppBuilderApiRoute {
  method: AppBuilderRouteMethod;
  path: string;
  access: AppBuilderRouteAccess;
  purpose: string;
  handler: string;
  authRequired: boolean;
}

export interface AppBuilderCrudFlow {
  entity: string;
  create: string;
  read: string;
  update: string;
  delete: string;
  validation: string[];
}

export interface AppBuilderAuthDecision {
  area: string;
  decision: string;
  rationale: string;
}

export interface AppBuilderBuildCheck {
  name: string;
  status: AppBuilderCheckStatus;
  detail: string;
}

export interface AppBuilderSmokeBuildStatus {
  status: AppBuilderCheckStatus;
  message: string;
  checks: AppBuilderBuildCheck[];
  blockers: string[];
}

export interface AppBuilderDraft {
  prompt: string;
  intent: string;
  summary: string;
  app: {
    slug: string;
    name: string;
    description: string;
    pages: AppBuilderPageDraft[];
    dataSchema: AppBuilderDataEntity[];
    apiRoutes: AppBuilderApiRoute[];
    crudFlows: AppBuilderCrudFlow[];
    authDecisions: AppBuilderAuthDecision[];
  };
  plan: {
    title: string;
    steps: AgentBuilderPlanStep[];
    acceptanceChecks: string[];
    openQuestions: string[];
  };
  smokeBuildStatus: AppBuilderSmokeBuildStatus;
}

export interface AppBuilderDraftResult {
  draft: AppBuilderDraft;
}

export interface AppBuilderApproveResult {
  draft: AppBuilderDraft;
  created: true;
  applied: true;
  app?: {
    id: string;
    slug: string;
    name: string;
    status: AppBuilderApplyStatus;
    previewUrl?: string;
    createdAt: string;
  };
  checkpoint?: {
    id: string;
    appId: string;
    savedAt: string;
  };
  build?: {
    status: string;
    checks: AppBuilderBuildCheck[];
  };
  smoke?: AppBuilderSmokeBuildStatus;
  previewUrl?: string;
  smokeBuild?: AppBuilderSmokeBuildStatus;
}

export type AppBuilderIterationTargetKind = "app" | "page" | "data_entity" | "api_route" | "auth" | "smoke" | "config" | "file" | "agent" | "tool";
export type AppBuilderIterationDiffStatus = "generated" | "pending" | "applied" | "blocked";
export type AppBuilderIterationFileChangeType = "added" | "modified" | "deleted" | "renamed";
export type AppBuilderIterationToolReadinessStatus = "not_requested" | "ready" | "needs_setup" | "blocked";

export interface AppBuilderIterationTarget {
  id: string;
  kind: AppBuilderIterationTargetKind;
  label: string;
  path?: string;
}

export interface AppBuilderIterationDiffFile {
  path: string;
  changeType: AppBuilderIterationFileChangeType;
  summary: string;
  diff: string;
}

export interface AppBuilderIterationResult {
  id: string;
  appId?: string;
  checkpointId?: string;
  target: AppBuilderIterationTarget;
  prompt: string;
  summary: string;
  status: AppBuilderIterationDiffStatus;
  files: AppBuilderIterationDiffFile[];
  draft?: AppBuilderDraft;
  preview?: {
    url?: string;
    refreshedAt?: string;
    status: AppBuilderCheckStatus;
    message: string;
  };
  logs: AgentRunLogEntry[];
  smoke?: AppBuilderSmokeBuildStatus;
  errorFix?: {
    source: "build" | "runtime" | "smoke";
    message: string;
    prompt: string;
  };
  tools?: {
    readinessStatus: AppBuilderIterationToolReadinessStatus;
    canProceed: boolean;
    requestedCategories: string[];
    missingSetup: string[];
    nextSteps: string[];
    requests: Array<{
      category: string;
      label: string;
      requestedTool: string;
      readinessStatus: AppBuilderIterationToolReadinessStatus;
      ready: boolean;
      missingSetup: string[];
      canProceedWithout: boolean;
      requiresLiveSetup: boolean;
      rationale: string;
    }>;
  };
}

export interface AppBuilderIterationRequest {
  appId?: string;
  checkpointId?: string;
  draft: AppBuilderDraft;
  target: AppBuilderIterationTarget;
  prompt: string;
  sourceError?: AppBuilderIterationResult["errorFix"];
}

export interface AppBuilderIterationApplyRequest {
  appId?: string;
  checkpointId?: string;
  diffId: string;
  target: AppBuilderIterationTarget;
  files: AppBuilderIterationDiffFile[];
  diff?: AppBuilderIterationResult;
  changeSet?: AppBuilderIterationResult;
  changeSetId?: string;
  draft?: AppBuilderDraft;
  runBuild?: boolean;
  runSmoke?: boolean;
  refreshPreview?: boolean;
}

export interface AppBuilderIterationApplyResult {
  applied: true;
  checkpoint?: {
    id: string;
    appId: string;
    savedAt: string;
  };
  previewUrl?: string;
  smoke?: AppBuilderSmokeBuildStatus;
  diff?: AppBuilderIterationResult;
  app?: {
    id: string;
    slug: string;
    name: string;
    status: AppBuilderApplyStatus;
    previewUrl?: string;
  };
  changeSet?: AppBuilderIterationResult;
  preview?: {
    status: string;
    label: string;
    reason: string;
    previewUrl?: string;
  };
}

export interface AppBuilderChangeSetResult {
  changeSet: AppBuilderIterationResult;
}

export interface AppBuilderCheckpointSummary {
  id: string;
  appId?: string;
  agentId?: string;
  label: string;
  source: string;
  previewUrl?: string;
  buildStatus?: string;
  smokeStatus?: string;
  previousCheckpointId?: string;
  createdAt: string;
}

export interface AppBuilderCheckpointListResult {
  checkpoints: AppBuilderCheckpointSummary[];
  currentCheckpointId: string;
}

export interface AppBuilderRollbackResult {
  rolledBack: boolean;
  checkpoint?: {
    id: string;
    appId?: string;
    savedAt: string;
  };
  app?: AppBuilderIterationApplyResult["app"];
  preview?: {
    url?: string;
    status: AppBuilderCheckStatus | string;
    message: string;
  };
  build?: { status: string };
  smoke?: AppBuilderSmokeBuildStatus;
  draft?: AppBuilderDraft;
}

export interface AppBuilderFixPromptResult {
  prompt: string;
  changeSet?: AppBuilderIterationResult;
}

export type AppPublishVisibility = "private" | "public";
export type AppBuilderPublishStatus = "not_started" | "ready" | "publishing" | "published" | "failed" | "rolled_back";

export interface AppPublishEnvChecklistItem {
  name: string;
  required: boolean;
  purpose: string;
  ready?: boolean;
}

export interface AppPublishReadiness {
  version: string;
  draftSlug: string;
  workspaceSlug: string;
  localPublishPath: string;
  packaging: {
    runtime: "hono-vite" | string;
    notes: string[];
    buildCommands: string[];
    artifactPaths: string[];
  };
  envChecklist: AppPublishEnvChecklistItem[];
  dockerComposeExport: {
    fileName: "docker-compose.publish.yml" | string;
    services: string[];
    outline: string[];
    contents?: string;
  };
  healthCheck: {
    livePath: string;
    readyPath: string;
    command: string;
  };
  smokeCheck: {
    command: string;
    expected: string[];
  };
  rollbackNote: string;
  urlHandoff: {
    visibility: AppPublishVisibility;
    publicUrl: string;
    privateUrl: string;
    notes: string[];
  };
}

export interface AppBuilderPublishHistoryEntry {
  id: string;
  status: AppBuilderPublishStatus;
  url?: string;
  checkpointId?: string;
  publishedAt: string;
  actor?: string;
  summary: string;
}

export interface AppBuilderPublishState {
  appId?: string;
  checkpointId?: string;
  status: AppBuilderPublishStatus;
  publishedUrl?: string;
  readiness: AppPublishReadiness;
  logs: AgentRunLogEntry[];
  history: AppBuilderPublishHistoryEntry[];
  nextActions: string[];
  canPublish: boolean;
  rollbackActions: Array<{
    id: string;
    label: string;
    checkpointId?: string;
    publishId?: string;
    disabled?: boolean;
  }>;
}

export interface AppBuilderPublishRequest {
  appId: string;
  checkpointId?: string;
  draft?: AppBuilderDraft;
  visibility?: AppPublishVisibility;
  runBuild?: boolean;
  runSmoke?: boolean;
}

export interface AppBuilderPublishResult {
  published: boolean;
  publishId?: string;
  state: AppBuilderPublishState;
}

export interface AppBuilderPublishRollbackResult {
  rolledBack: boolean;
  state: AppBuilderPublishState;
}

export interface AgentPromptPlanItem {
  title: string;
  detail: string;
  status: "todo" | "done";
}

export interface AgentPromptDraft {
  prompt: string;
  agent: SaveAgentInput & {
    description: string;
    enabledTools: string[];
    routeKey: string;
    triggerKind: AgentTriggerKind;
    playbook: AgentPlaybookStep[];
    status: AgentStatus;
    inputSchema: AgentInputField[];
  };
  plan: AgentPromptPlanItem[];
  assumptions: string[];
  readiness: {
    webhook: {
      recommended: boolean;
      readyAfterSave: boolean;
      tokenRequired: boolean;
      tokenManagementRoute: string;
      publicTriggerRoute: string;
      message: string;
      planDetail: string;
    };
  };
}

export interface AgentPromptDraftResult {
  draft: AgentPromptDraft;
  created: boolean;
  agent?: AgentRecord;
  firstRun?: AgentRunRecord;
  sampleInputs?: Record<string, string | number | boolean>;
}

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

export type ShareTokenScope = "brief" | "plan" | "overview";

export interface ShareTokenRecord {
  id: string;
  token?: string;
  tokenPreview?: string;
  scope: ShareTokenScope;
  revokedAt?: string;
  expiresAt?: string;
  readCount: number;
  lastReadAt?: string;
  createdAt: string;
}

export interface PublicSharePayload {
  scope: ShareTokenScope;
  workspace: Pick<Session["workspace"], "id" | "name" | "automationGoal">;
  brief?: WorkflowBrief | null;
  requirements?: WorkflowRequirement[];
  planItems?: WorkflowPlanItem[];
}

export type CreateShareTokenInput = {
  scope: ShareTokenScope;
  expiresAt?: string;
};

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
  modelUsed?: string;
  costUsd?: number;
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
  related?: ActivityRelatedContext;
  agent?: Partial<AgentRecord> | null;
  run?: Partial<AgentRunRecord> | null;
  workflow?: ActivityWorkflowContext | null;
}

export interface ActivityRelatedContext {
  agent?: Partial<AgentRecord> | null;
  run?: Partial<AgentRunRecord> | null;
  blocker?: Partial<WorkflowBlocker> | null;
  question?: Partial<WorkflowQuestion> | null;
  planItem?: Partial<WorkflowPlanItem> | null;
  requirement?: Partial<WorkflowRequirement> | null;
  evidence?: Partial<WorkflowValidationEvidence> | null;
  release?: Partial<WorkflowReleaseConfirmation> | null;
  workflow?: ActivityWorkflowContext | null;
}

export interface ActivityWorkflowContext {
  brief?: Partial<WorkflowBrief> | null;
  requirements?: Partial<WorkflowRequirement>[];
  planItems?: Partial<WorkflowPlanItem>[];
  blockers?: Partial<WorkflowBlocker>[];
  questions?: Partial<WorkflowQuestion>[];
  validationEvidence?: Partial<WorkflowValidationEvidence>[];
  releaseConfirmation?: Partial<WorkflowReleaseConfirmation> | null;
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

// ---------------------------------------------------------------------------
// Sandboxed code-exec subsystem
// ---------------------------------------------------------------------------

export type SandboxDriver = "docker" | "native";
export type SandboxExecStatus = "queued" | "running" | "success" | "failed" | "timeout" | "canceled";

export interface SandboxRuntimeInfo {
  id: string;
  ready: boolean;
  image?: string;
  description?: string;
}

export interface SandboxStatus {
  driver: SandboxDriver;
  available: boolean;
  runtimes: SandboxRuntimeInfo[];
  note?: string;
}

export interface SandboxExecRecord {
  id: string;
  workspaceId: string;
  appId?: string;
  checkpointId?: string;
  sandboxId: string;
  driver: SandboxDriver;
  runtime: string;
  command: string;
  workingDir: string;
  env?: Record<string, string>;
  status: SandboxExecStatus;
  exitCode?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  stdoutPreview?: string;
  stderrPreview?: string;
  errorMessage?: string;
  cpuLimitMs?: number;
  memoryLimitMb?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxExecRequest {
  appId?: string;
  checkpointId?: string;
  command: string;
  runtime?: string;
  workingDir?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  stdin?: string;
}
