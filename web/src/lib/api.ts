import type {
  ActivityDetailPayload,
  ActivityRecord,
  AgentRecord,
  AgentRunRecord,
  AgentTemplate,
  ActivationDetailPayload,
  BootstrapPayload,
  ConfirmWorkflowReleaseInput,
  ProviderRecord,
  PublicDashboardPayload,
  ReleaseHistoryPayload,
  SaveAgentInput,
  SaveProviderInput,
  SaveWorkflowBlockerInput,
  SaveWorkspaceEnvVarInput,
  WorkspaceEnvVarRecord,
  SaveWorkflowBriefInput,
  SaveWorkflowPlanItemInput,
  SaveWorkflowQuestionInput,
  SaveWorkflowRequirementInput,
  SaveWorkflowValidationEvidenceInput,
  Session,
  WorkflowBlocker,
  WorkflowBrief,
  WorkflowBriefTemplate,
  WorkflowBriefVersion,
  WorkflowDraftResult,
  WorkflowPlanItem,
  WorkflowQuestion,
  WorkflowReleaseConfirmation,
  WorkflowRequirement,
  WorkflowTemplate,
  WorkflowTemplateApplyResult,
  WorkflowValidationEvidence,
  ApiKeyProviderName,
  MaskedApiKey,
  UsageSummary,
  ProviderCallRecord,
  JobRecord,
  PlanModeResult,
  PlanModePlanItem,
  AvailableTool,
  RunDiagnostic,
  CreateShareTokenInput,
  PublicSharePayload,
  ShareTokenRecord,
} from "@/lib/types";
import { pushExternalToast } from "@/context/ToastContext";

let lastAuthToastAt = 0;

async function j<T>(url: string, init?: RequestInit): Promise<T> {
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
    const error = new Error(typeof payload?.error === "string" ? payload.error : `${response.status} ${response.statusText}`) as Error & { status?: number };
    error.status = response.status;
    if (response.status === 401 && !url.includes("/api/auth/")) {
      const now = Date.now();
      if (now - lastAuthToastAt > 4000) {
        lastAuthToastAt = now;
        pushExternalToast({
          tone: "warn",
          title: "Your session expired",
          description: "Please sign in again to continue.",
        });
      }
    } else if (response.status >= 500) {
      pushExternalToast({
        tone: "error",
        title: "Server error",
        description: error.message,
      });
    }
    throw error;
  }
  return payload as T;
}

export const api = {
  getSession: async (): Promise<Session | null> => {
    const payload = await j<Session | { authenticated: false; user: null; workspace: null; onboarding: null }>("/api/auth/session");
    return payload.authenticated ? (payload as Session) : null;
  },
  signIn: (body: { email: string; password: string }) => j<Session>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  signUp: (body: { displayName: string; email: string; password: string }) => j<Session>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  signOut: () => j<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  getPublicDashboard: () => j<PublicDashboardPayload>("/api/activation"),
  getBootstrap: () => j<BootstrapPayload>("/api/app/bootstrap"),
  getActivationDetail: () => j<ActivationDetailPayload>("/api/app/activation"),
  getOnboarding: () => j<{ onboarding: BootstrapPayload["onboarding"] }>("/api/app/onboarding").then((payload) => payload.onboarding),
  completeOnboardingStep: (stepKey: string) => j<{ onboarding: BootstrapPayload["onboarding"] }>(`/api/app/onboarding/steps/${stepKey}/complete`, { method: "POST" }),
  updateProfile: (body: { displayName: string; timezone: string }) => j<{ profile: Session["user"] }>("/api/app/profile", { method: "PATCH", body: JSON.stringify(body) }).then((payload) => payload.profile),
  updateWorkspace: (body: { name: string; website: string; automationGoal: string }) => j<{ workspace: Session["workspace"] }>("/api/app/workspace", { method: "PATCH", body: JSON.stringify(body) }).then((payload) => payload.workspace),
  listActivity: () => j<{ activities: ActivityRecord[] }>("/api/app/activity").then((payload) => payload.activities),
  getActivityDetail: (id: string) => j<ActivityDetailPayload>(`/api/app/activity/${id}`),
  listAgents: () => j<{ agents: AgentRecord[] }>("/api/app/agents").then((payload) => payload.agents),
  getAgent: (id: string) => j<{ agent: AgentRecord; runs: AgentRunRecord[] }>(`/api/app/agents/${id}`),
  createAgent: (body: SaveAgentInput) => j<{ agent: AgentRecord }>("/api/app/agents", { method: "POST", body: JSON.stringify(body) }).then((payload) => payload.agent),
  updateAgent: (id: string, body: Partial<SaveAgentInput>) =>
    j<{ agent: AgentRecord }>(`/api/app/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((payload) => payload.agent),
  archiveAgent: (id: string) => j<{ agent: AgentRecord }>(`/api/app/agents/${id}`, { method: "DELETE" }).then((payload) => payload.agent),
  runAgent: (id: string, body?: { triggerKind?: string; inputs?: Record<string, string | number | boolean> }) =>
    j<{ run: AgentRunRecord }>(`/api/app/agents/${id}/runs`, { method: "POST", body: JSON.stringify(body ?? {}) }).then((payload) => payload.run),
  listAgentTemplates: () => j<{ templates: AgentTemplate[] }>("/api/app/agent-templates").then((payload) => payload.templates),
  createAgentFromTemplate: (templateId: string, body: { name?: string; providerId?: string; model?: string } = {}) =>
    j<{ agent: AgentRecord }>(`/api/app/agents/from-template/${templateId}`, { method: "POST", body: JSON.stringify(body) }).then((payload) => payload.agent),
  listProviders: () => j<{ providers: ProviderRecord[] }>("/api/app/providers").then((payload) => payload.providers),
  createProvider: (body: SaveProviderInput) =>
    j<{ provider: ProviderRecord }>("/api/app/providers", { method: "POST", body: JSON.stringify(body) }).then((payload) => payload.provider),
  updateProvider: (id: string, body: Partial<SaveProviderInput>) =>
    j<{ provider: ProviderRecord }>(`/api/app/providers/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((payload) => payload.provider),
  listAgentRuns: () => j<{ runs: AgentRunRecord[] }>("/api/app/agent-runs").then((payload) => payload.runs),
  cancelAgentRun: (runId: string) =>
    j<{ run: AgentRunRecord }>(`/api/app/agent-runs/${runId}/cancel`, { method: "POST" }).then((payload) => payload.run),
  retryAgentRun: (runId: string) =>
    j<{ run: AgentRunRecord }>(`/api/app/agent-runs/${runId}/retry`, { method: "POST" }).then((payload) => payload.run),
  listEnvVars: () => j<{ envVars: WorkspaceEnvVarRecord[] }>("/api/app/env-vars").then((payload) => payload.envVars),
  createEnvVar: (body: SaveWorkspaceEnvVarInput) =>
    j<{ envVar: WorkspaceEnvVarRecord }>("/api/app/env-vars", { method: "POST", body: JSON.stringify(body) }).then((payload) => payload.envVar),
  updateEnvVar: (id: string, body: Partial<SaveWorkspaceEnvVarInput>) =>
    j<{ envVar: WorkspaceEnvVarRecord }>(`/api/app/env-vars/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((payload) => payload.envVar),
  deleteEnvVar: (id: string) => j<{ ok: boolean }>(`/api/app/env-vars/${id}`, { method: "DELETE" }),
  getReleaseHistory: () => j<ReleaseHistoryPayload>("/api/app/release-history"),
  getWorkflowBrief: () => j<WorkflowBrief>("/api/app/workflow/brief"),
  saveWorkflowBrief: (body: SaveWorkflowBriefInput) => j<WorkflowBrief>("/api/app/workflow/brief", { method: "PUT", body: JSON.stringify(body) }),
  listWorkflowBriefTemplates: () => j<WorkflowBriefTemplate[]>("/api/app/workflow/brief/templates"),
  applyWorkflowBriefTemplate: (templateId: string) =>
    j<WorkflowBrief>(`/api/app/workflow/brief/templates/${templateId}/apply`, { method: "POST", body: "{}" }),
  listWorkflowBriefVersions: () => j<WorkflowBriefVersion[]>("/api/app/workflow/brief/versions"),
  restoreWorkflowBriefVersion: (versionId: string) =>
    j<WorkflowBrief>(`/api/app/workflow/brief/versions/${versionId}/restore`, { method: "POST", body: "{}" }),
  listWorkflowRequirements: () => j<WorkflowRequirement[]>("/api/app/workflow/requirements"),
  saveWorkflowRequirements: (requirements: SaveWorkflowRequirementInput[]) =>
    j<WorkflowRequirement[]>("/api/app/workflow/requirements", { method: "PUT", body: JSON.stringify(requirements) }),
  listWorkflowPlanItems: () => j<WorkflowPlanItem[]>("/api/app/workflow/plan-items"),
  createWorkflowPlanItem: (body: SaveWorkflowPlanItemInput) => j<WorkflowPlanItem>("/api/app/workflow/plan-items", { method: "POST", body: JSON.stringify(body) }),
  updateWorkflowPlanItem: (itemId: string, body: Partial<SaveWorkflowPlanItemInput>) =>
    j<WorkflowPlanItem>(`/api/app/workflow/plan-items/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
  listWorkflowBlockers: () => j<WorkflowBlocker[]>("/api/app/workflow/blockers"),
  createWorkflowBlocker: (body: SaveWorkflowBlockerInput) => j<WorkflowBlocker>("/api/app/workflow/blockers", { method: "POST", body: JSON.stringify(body) }),
  updateWorkflowBlocker: (blockerId: string, body: Partial<SaveWorkflowBlockerInput>) =>
    j<WorkflowBlocker>(`/api/app/workflow/blockers/${blockerId}`, { method: "PATCH", body: JSON.stringify(body) }),
  listWorkflowQuestions: () => j<WorkflowQuestion[]>("/api/app/workflow/questions"),
  createWorkflowQuestion: (body: SaveWorkflowQuestionInput) => j<WorkflowQuestion>("/api/app/workflow/questions", { method: "POST", body: JSON.stringify(body) }),
  updateWorkflowQuestion: (questionId: string, body: Partial<SaveWorkflowQuestionInput>) =>
    j<WorkflowQuestion>(`/api/app/workflow/questions/${questionId}`, { method: "PATCH", body: JSON.stringify(body) }),
  listWorkflowValidationEvidence: () => j<WorkflowValidationEvidence[]>("/api/app/workflow/validation-evidence"),
  createWorkflowValidationEvidence: (body: SaveWorkflowValidationEvidenceInput) =>
    j<WorkflowValidationEvidence>("/api/app/workflow/validation-evidence", { method: "POST", body: JSON.stringify(body) }),
  updateWorkflowValidationEvidence: (evidenceId: string, body: Partial<SaveWorkflowValidationEvidenceInput>) =>
    j<WorkflowValidationEvidence>(`/api/app/workflow/validation-evidence/${evidenceId}`, { method: "PATCH", body: JSON.stringify(body) }),
  getWorkflowReleaseConfirmation: () => j<WorkflowReleaseConfirmation>("/api/app/workflow/release-confirmation"),
  confirmWorkflowRelease: (body: ConfirmWorkflowReleaseInput) =>
    j<WorkflowReleaseConfirmation>("/api/app/workflow/release-confirmation", { method: "POST", body: JSON.stringify(body) }),
  listWorkflowTemplates: () =>
    j<{ templates: WorkflowTemplate[] }>("/api/app/workflow/templates").then((payload) => payload.templates),
  applyWorkflowTemplate: (templateId: string) =>
    j<WorkflowTemplateApplyResult>(`/api/app/workflow/templates/${templateId}/apply`, { method: "POST" }),
  generateWorkflowFromPrompt: (body: { prompt: string; apply?: boolean }) =>
    j<WorkflowDraftResult>("/api/app/workflow/generate-from-prompt", { method: "POST", body: JSON.stringify(body) }),
  listApiKeys: () => j<{ apiKeys: MaskedApiKey[] }>("/api/app/api-keys").then((payload) => payload.apiKeys),
  createApiKey: (body: { provider: ApiKeyProviderName; label: string; value: string }) =>
    j<{ apiKey: MaskedApiKey }>("/api/app/api-keys", { method: "POST", body: JSON.stringify(body) }).then((p) => p.apiKey),
  deleteApiKey: (id: string) => j<{ ok: boolean }>(`/api/app/api-keys/${id}`, { method: "DELETE" }),
  getUsageSummary: () => j<{ summary: UsageSummary }>("/api/app/usage/summary").then((payload) => payload.summary),
  listProviderCalls: (limit = 100) => j<{ calls: ProviderCallRecord[] }>(`/api/app/usage/calls?limit=${limit}`).then((payload) => payload.calls),
  listJobs: (limit = 50) => j<{ jobs: JobRecord[] }>(`/api/app/jobs?limit=${limit}`).then((payload) => payload.jobs),
  enqueueJob: (body: { type: string; payload: Record<string, unknown>; cron?: string; scheduledAt?: string; maxAttempts?: number }) =>
    j<{ job: JobRecord }>("/api/app/jobs", { method: "POST", body: JSON.stringify(body) }).then((p) => p.job),
  cancelJob: (id: string) => j<{ ok: boolean; job: JobRecord }>(`/api/app/jobs/${id}/cancel`, { method: "POST" }).then((p) => p.job),
  requestPlanMode: () => j<PlanModeResult>("/api/app/workflow/plan-mode", { method: "POST", body: "{}" }),
  applyPlanMode: (planItems: PlanModePlanItem[]) =>
    j<{ planItems: WorkflowPlanItem[] }>("/api/app/workflow/plan-mode/apply", { method: "POST", body: JSON.stringify({ planItems }) }).then((p) => p.planItems),
  listTools: () => j<{ tools: AvailableTool[] }>("/api/app/tools").then((p) => p.tools),
  diagnoseAgentRun: (runId: string) =>
    j<{ diagnostic: RunDiagnostic | null }>(`/api/app/agent-runs/${runId}/diagnose`, { method: "POST" }).then((p) => p.diagnostic),
  recordRunAsPlaybook: (runId: string) =>
    j<{ agent: AgentRecord }>(`/api/app/agent-runs/${runId}/record-as-playbook`, { method: "POST" }).then((p) => p.agent),
  rotateAgentWebhook: (agentId: string) =>
    j<{ webhookToken: string }>(`/api/app/webhooks/agents/${agentId}/rotate`, { method: "POST" }).then((p) => p.webhookToken),
  removeAgentWebhook: (agentId: string) =>
    j<{ ok: boolean }>(`/api/app/webhooks/agents/${agentId}`, { method: "DELETE" }),
  listShareTokens: () => j<{ tokens: ShareTokenRecord[] }>("/api/app/share").then((p) => p.tokens),
  createShareToken: (body: CreateShareTokenInput) =>
    j<{ token: ShareTokenRecord }>("/api/app/share", { method: "POST", body: JSON.stringify(body) }).then((p) => p.token),
  deleteShareToken: (id: string) => j<{ ok: boolean }>(`/api/app/share/${id}`, { method: "DELETE" }),
  getPublicShare: (token: string) => j<{ shared: PublicSharePayload }>(`/api/public/share/${encodeURIComponent(token)}`).then((p) => p.shared),
};
