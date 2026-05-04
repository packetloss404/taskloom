import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { readActivationStatus } from "./activation/api";
import type { ActivationMilestoneRecord, ActivationStatusDto, ActivationSubjectRef } from "./activation/domain";
import { deriveActivationStatus } from "./activation/service";
import { buildActivationSummaryCard } from "./activation/view-model";
import {
  defaultWorkspaceIdForUser,
  findAgentForWorkspaceIndexed,
  findAgentRunForWorkspaceIndexed,
  findSessionByIdIndexed,
  findImplementationPlanItemForWorkspaceIndexed,
  findReleaseConfirmationForWorkspaceIndexed,
  findRequirementForWorkspaceIndexed,
  findUserByEmailIndexed,
  findValidationEvidenceForWorkspaceIndexed,
  findWorkflowConcernForWorkspaceIndexed,
  deleteWorkspaceEnvVar,
  findAgent,
  findProvider,
  findWorkspaceInvitationByToken,
  findWorkspaceMembership,
  findWorkspaceEnvVar,
  createInvitationEmailDelivery,
  listAgentRunsForAgentIndexed,
  listAgentRunsForWorkspaceIndexed,
  listAgentsForWorkspaceIndexed,
  listProvidersForWorkspaceIndexed,
  listReleaseConfirmationsForWorkspace,
  listActivitiesForWorkspaceIndexed,
  listWorkspaceInvitationsIndexed,
  listWorkspaceInvitations,
  listWorkspaceMembershipsIndexed,
  listWorkspaceEnvVars,
  loadStore,
  loadStoreAsync,
  mutateStore,
  mutateStoreAsync,
  nextIncompleteStep,
  recordActivity,
  type ActivityRecord,
  type ActivationSignalRecord,
  type AgentInputField,
  type AgentInputFieldType,
  type AgentPlaybookStep,
  type AgentRecord,
  type AgentRunLogEntry,
  type AgentRunRecord,
  type AgentRunStep,
  type AgentRunToolCall,
  type AgentStatus,
  type AgentTriggerKind,
  type ApiKeyProvider,
  type ImplementationPlanItemRecord,
  type ProviderKind,
  type ProviderRecord,
  type ReleaseConfirmationRecord,
  type RequirementRecord,
  type ValidationEvidenceRecord,
  type WorkflowConcernRecord,
  type WorkspaceEnvVarRecord,
  type WorkspaceEnvVarScope,
  type WorkspaceInvitationRecord,
  type WorkspaceMemberRecord,
  type WorkspaceRecord,
  type WorkspaceRole,
  type JobRecord,
  type TaskloomData,
  ONBOARDING_STEPS,
  snapshotForWorkspace,
  upsertActivationSignal,
  upsertAgent,
  upsertAgentRun,
  upsertProvider,
  upsertWorkspaceInvitation,
  upsertWorkspaceMembership,
  upsertWorkspaceEnvVar,
} from "./taskloom-store";
import { AGENT_TEMPLATES, findAgentTemplate } from "./agent-templates.js";
import { DEFAULT_PROVIDER_NAMES } from "./providers/bootstrap.js";
import { listDefaultToolSummaries } from "./tools/bootstrap.js";
import { buildWebhookTriggerReadiness, type WebhookTriggerReadiness } from "./webhook-readiness.js";
import { getDefaultToolRegistry } from "./tools/registry.js";
import { LOCAL_INVITATION_EMAIL_PROVIDER, invitationEmailSubject, resolveInvitationEmailMode, resolveInvitationEmailRetryMaxAttempts, resolveInvitationEmailWebhookConfig } from "./invitation-email.js";
import { deliverInvitationEmail, type InvitationEmailDeliveryAction } from "./invitation-email-delivery.js";
import { maintainScheduledAgentJobs } from "./jobs/store.js";
import { detectPhase71Integrations, type Phase71IntegrationMetadata } from "./app-builder-service.js";
import { isSensitiveKey, maskSecret as maskBearerSecret, redactSensitiveString, redactSensitiveValue } from "./security/redaction.js";
import {
  buildSessionCookieValue,
  generateId,
  generateSessionSecret,
  hashPassword,
  hashSessionSecret,
  normalizeEmail,
  now,
  parseSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  slugify,
  verifyPassword,
} from "./auth-utils";

type AuthenticatedContext = {
  user: import("./taskloom-store").UserRecord;
  workspace: import("./taskloom-store").WorkspaceRecord;
  role: import("./taskloom-store").WorkspaceRole;
};

export interface AgentDraftOptions {
  providerId?: string | null;
  model?: string | null;
  status?: AgentStatus;
}

export interface AgentDraftInput extends AgentDraftOptions {
  prompt?: string;
  create?: boolean;
  approve?: boolean;
  runPreview?: boolean;
  sampleInputs?: Record<string, unknown>;
}

export interface AgentDraftPlanItem {
  title: string;
  detail: string;
  status: "todo" | "done";
}

export interface AgentDraft {
  prompt: string;
  integrationMetadata: Phase71IntegrationMetadata;
  agent: {
    name: string;
    description: string;
    instructions: string;
    providerId?: string;
    model?: string;
    tools: string[];
    enabledTools: string[];
    routeKey: string;
    schedule?: string;
    triggerKind: AgentTriggerKind;
    playbook: AgentPlaybookStep[];
    status: AgentStatus;
    inputSchema: AgentInputField[];
  };
  plan: AgentDraftPlanItem[];
  assumptions: string[];
  readiness: {
    webhook: WebhookTriggerReadiness;
  };
}

export interface AgentDraftResult {
  draft: AgentDraft;
  created: boolean;
  agent?: ReturnType<typeof decorateAgentWithProvider>;
  firstRun?: ReturnType<typeof decorateRun>;
  sampleInputs?: Record<string, string | number | boolean>;
}

export interface AgentBuilderPromptInput {
  prompt?: string;
}

interface AgentBuilderWebhookTriggerReadiness extends WebhookTriggerReadiness {
  publishSteps: string[];
}

interface AgentBuilderDraftPlan {
  title: string;
  steps: Array<{ title: string; detail: string }>;
  acceptanceChecks: string[];
  openQuestions: string[];
}

export interface AgentBuilderDraft {
  prompt: string;
  intent: string;
  summary: string;
  integrationMetadata: Phase71IntegrationMetadata;
  agent: {
    name: string;
    description: string;
    instructions: string;
    providerId?: string;
    model?: string;
    tools: string[];
    enabledTools: string[];
    routeKey: string;
    triggerKind: AgentTriggerKind;
    schedule?: string;
    playbook: AgentPlaybookStep[];
    status: AgentStatus;
    inputSchema: AgentInputField[];
  };
  sampleInputs: Record<string, string | number | boolean>;
  plan: AgentBuilderDraftPlan;
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
    webhook: AgentBuilderWebhookTriggerReadiness;
    firstRun: {
      canRun: boolean;
      blockers: string[];
      message: string;
    };
  };
}

export interface AgentBuilderApproveInput {
  prompt?: string;
  draft?: AgentBuilderDraft;
  runPreview?: boolean;
  sampleInputs?: Record<string, unknown>;
  status?: AgentStatus;
}

export interface AgentBuilderApproveResult {
  draft: AgentBuilderDraft;
  created: true;
  agent: ReturnType<typeof decorateAgentWithProvider>;
  firstRun?: ReturnType<typeof decorateRun>;
  sampleInputs?: Record<string, string | number | boolean>;
}

export const INVITATION_EMAIL_JOB_TYPE = "invitation.email";

export async function listPublicActivationSummaries() {
  const data = await loadStoreAsync();
  const summaries = [];
  for (const workspace of data.workspaces) {
    const status = await syncWorkspaceActivation(workspace.id, false, { type: "system", id: "public-read" });
    summaries.push({
      subject: toSubject(workspace.id),
      status,
      summary: buildActivationSummaryCard(status),
    });
  }
  return summaries;
}

export async function getPublicActivationSummary(workspaceId: string) {
  const data = await loadStoreAsync();
  const workspace = data.workspaces.find((entry) => entry.id === workspaceId);
  if (!workspace) return null;
  const status = await syncWorkspaceActivation(workspace.id, false, { type: "system", id: "public-read" });
  return {
    subject: toSubject(workspace.id),
    status,
    summary: buildActivationSummaryCard(status),
  };
}

export function register(input: { email: string; password: string; displayName: string }) {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw httpError(400, "valid email is required");
  if (input.password.length < 8) throw httpError(400, "password must be at least 8 characters");
  if (input.displayName.trim().length < 2) throw httpError(400, "display name must be at least 2 characters");

  return mutateStore((data) => {
    if (data.users.some((user) => normalizeEmail(user.email) === email)) {
      throw httpError(409, "an account with that email already exists");
    }

    const timestamp = now();
    const userId = generateId();
    const workspaceId = generateId();
    const displayName = input.displayName.trim();
    const workspaceName = `${displayName.split(" ")[0] || "Taskloom"} workspace`;

    data.users.push({
      id: userId,
      email,
      displayName,
      timezone: "UTC",
      passwordHash: hashPassword(input.password),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    data.workspaces.push({
      id: workspaceId,
      slug: slugify(workspaceName) || workspaceId,
      name: workspaceName,
      website: "",
      automationGoal: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    data.memberships.push({
      workspaceId,
      userId,
      role: "owner",
      joinedAt: timestamp,
    });

    data.onboardingStates.push({
      workspaceId,
      status: "not_started",
      currentStep: "create_workspace_profile",
      completedSteps: [],
      updatedAt: timestamp,
    });

    data.activationFacts[workspaceId] = { now: timestamp };
    recordActivity(data, makeActivity(workspaceId, "account", "account.created", { type: "user", id: userId, displayName }, { title: `Account created for ${displayName}` }, timestamp));
    recordActivity(data, makeActivity(workspaceId, "workspace", "workspace.created", { type: "user", id: userId, displayName }, { title: `Workspace ${workspaceName} created` }, timestamp));

    const session = createSessionRecord(userId, timestamp);
    data.sessions.push(session.record);
    return {
      cookieValue: session.cookieValue,
      context: buildAuthenticatedContext(data, userId),
    };
  });
}

export async function registerAsync(input: { email: string; password: string; displayName: string }) {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw httpError(400, "valid email is required");
  if (input.password.length < 8) throw httpError(400, "password must be at least 8 characters");
  if (input.displayName.trim().length < 2) throw httpError(400, "display name must be at least 2 characters");

  return mutateStoreAsync((data) => {
    if (data.users.some((user) => normalizeEmail(user.email) === email)) {
      throw httpError(409, "an account with that email already exists");
    }

    const timestamp = now();
    const userId = generateId();
    const workspaceId = generateId();
    const displayName = input.displayName.trim();
    const workspaceName = `${displayName.split(" ")[0] || "Taskloom"} workspace`;

    data.users.push({
      id: userId,
      email,
      displayName,
      timezone: "UTC",
      passwordHash: hashPassword(input.password),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    data.workspaces.push({
      id: workspaceId,
      slug: slugify(workspaceName) || workspaceId,
      name: workspaceName,
      website: "",
      automationGoal: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    data.memberships.push({
      workspaceId,
      userId,
      role: "owner",
      joinedAt: timestamp,
    });

    data.onboardingStates.push({
      workspaceId,
      status: "not_started",
      currentStep: "create_workspace_profile",
      completedSteps: [],
      updatedAt: timestamp,
    });

    data.activationFacts[workspaceId] = { now: timestamp };
    recordActivity(data, makeActivity(workspaceId, "account", "account.created", { type: "user", id: userId, displayName }, { title: `Account created for ${displayName}` }, timestamp));
    recordActivity(data, makeActivity(workspaceId, "workspace", "workspace.created", { type: "user", id: userId, displayName }, { title: `Workspace ${workspaceName} created` }, timestamp));

    const session = createSessionRecord(userId, timestamp);
    data.sessions.push(session.record);
    return {
      cookieValue: session.cookieValue,
      context: buildAuthenticatedContext(data, userId),
    };
  });
}

export function login(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  return mutateStore((data) => {
    const user = data.users.find((entry) => normalizeEmail(entry.email) === email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw httpError(401, "invalid email or password");
    }

    const session = createSessionRecord(user.id, now());
    data.sessions = data.sessions.filter((entry) => entry.userId !== user.id);
    data.sessions.push(session.record);
    return {
      cookieValue: session.cookieValue,
      context: buildAuthenticatedContext(data, user.id),
    };
  });
}

export async function loginAsync(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  return mutateStoreAsync((data) => {
    const user = data.users.find((entry) => normalizeEmail(entry.email) === email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw httpError(401, "invalid email or password");
    }

    const session = createSessionRecord(user.id, now());
    data.sessions = data.sessions.filter((entry) => entry.userId !== user.id);
    data.sessions.push(session.record);
    return {
      cookieValue: session.cookieValue,
      context: buildAuthenticatedContext(data, user.id),
    };
  });
}

export function logout(c: Context) {
  const parsed = parseSessionCookieValue(getCookie(c, SESSION_COOKIE_NAME) ?? "");
  if (parsed) {
    mutateStore((data) => {
      data.sessions = data.sessions.filter((entry) => entry.id !== parsed.sessionId);
    });
  }
  clearSessionCookie(c);
}

export async function logoutAsync(c: Context) {
  const parsed = parseSessionCookieValue(getCookie(c, SESSION_COOKIE_NAME) ?? "");
  if (parsed) {
    await mutateStoreAsync((data) => {
      data.sessions = data.sessions.filter((entry) => entry.id !== parsed.sessionId);
    });
  }
  clearSessionCookie(c);
}

export function restoreSession(c: Context): AuthenticatedContext | null {
  const parsed = parseSessionCookieValue(getCookie(c, SESSION_COOKIE_NAME) ?? "");
  if (!parsed) return null;

  const session = findSessionByIdIndexed(parsed.sessionId);
  if (!session) return null;
  if (session.secretHash !== hashSessionSecret(parsed.secret)) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const data = loadStore();
  const liveSession = data.sessions.find((entry) => entry.id === session.id);
  if (liveSession) liveSession.lastAccessedAt = now();
  const context = buildAuthenticatedContext(data, session.userId);
  return context;
}

export async function restoreSessionAsync(c: Context): Promise<AuthenticatedContext | null> {
  const parsed = parseSessionCookieValue(getCookie(c, SESSION_COOKIE_NAME) ?? "");
  if (!parsed) return null;

  return mutateStoreAsync((data) => {
    const session = data.sessions.find((entry) => entry.id === parsed.sessionId);
    if (!session) return null;
    if (session.secretHash !== hashSessionSecret(parsed.secret)) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    session.lastAccessedAt = now();
    return buildAuthenticatedContext(data, session.userId);
  });
}

export async function getPrivateBootstrap(context: AuthenticatedContext) {
  const status = await syncWorkspaceActivation(context.workspace.id, false, { type: "system", id: "bootstrap" });
  const data = await loadStoreAsync();
  const onboarding = data.onboardingStates.find((entry) => entry.workspaceId === context.workspace.id);
  const activities = data.activities.filter((entry) => entry.workspaceId === context.workspace.id).slice(0, 20);

  return {
    user: {
      id: context.user.id,
      email: context.user.email,
      displayName: context.user.displayName,
      timezone: context.user.timezone,
    },
    workspace: {
      id: context.workspace.id,
      slug: context.workspace.slug,
      name: context.workspace.name,
      website: context.workspace.website,
      automationGoal: context.workspace.automationGoal,
      role: context.role,
    },
    onboarding,
    activation: {
      status,
      summary: buildActivationSummaryCard(status),
    },
    activities,
  };
}

export async function getActivationDetail(context: AuthenticatedContext) {
  const bootstrap = await getPrivateBootstrap(context);
  return {
    workspace: bootstrap.workspace,
    onboarding: bootstrap.onboarding,
    activation: bootstrap.activation,
    activities: bootstrap.activities,
  };
}

export function getSessionPayload(context: AuthenticatedContext) {
  const data = loadStore();
  const onboarding = data.onboardingStates.find((entry) => entry.workspaceId === context.workspace.id);

  return {
    authenticated: true,
    user: {
      id: context.user.id,
      email: context.user.email,
      displayName: context.user.displayName,
      timezone: context.user.timezone,
    },
    workspace: {
      id: context.workspace.id,
      slug: context.workspace.slug,
      name: context.workspace.name,
      website: context.workspace.website,
      automationGoal: context.workspace.automationGoal,
      role: context.role,
    },
    onboarding: onboarding
      ? {
          status: onboarding.status,
          currentStep: onboarding.currentStep,
          completed: onboarding.status === "completed",
          completedSteps: onboarding.completedSteps,
          completedAt: onboarding.completedAt ?? null,
        }
      : {
          status: "not_started",
          currentStep: "create_workspace_profile",
          completed: false,
          completedSteps: [],
          completedAt: null,
        },
  };
}

export async function getSessionPayloadAsync(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  const onboarding = data.onboardingStates.find((entry) => entry.workspaceId === context.workspace.id);

  return {
    authenticated: true,
    user: {
      id: context.user.id,
      email: context.user.email,
      displayName: context.user.displayName,
      timezone: context.user.timezone,
    },
    workspace: {
      id: context.workspace.id,
      slug: context.workspace.slug,
      name: context.workspace.name,
      website: context.workspace.website,
      automationGoal: context.workspace.automationGoal,
      role: context.role,
    },
    onboarding: onboarding
      ? {
          status: onboarding.status,
          currentStep: onboarding.currentStep,
          completed: onboarding.status === "completed",
          completedSteps: onboarding.completedSteps,
          completedAt: onboarding.completedAt ?? null,
        }
      : {
          status: "not_started",
          currentStep: "create_workspace_profile",
          completed: false,
          completedSteps: [],
          completedAt: null,
        },
  };
}

export async function updateProfile(
  context: AuthenticatedContext,
  input: { displayName: string; timezone: string },
) {
  if (input.displayName.trim().length < 2) throw httpError(400, "display name must be at least 2 characters");
  if (!input.timezone.trim()) throw httpError(400, "timezone is required");

  return mutateStoreAsync((data) => {
    const user = data.users.find((entry) => entry.id === context.user.id);
    if (!user) throw httpError(404, "user not found");
    user.displayName = input.displayName.trim();
    user.timezone = input.timezone.trim();
    user.updatedAt = now();
    recordActivity(data, makeActivity(context.workspace.id, "account", "account.profile_updated", { type: "user", id: user.id, displayName: user.displayName }, { title: "Profile updated" }, user.updatedAt));
    return user;
  });
}

export async function updateWorkspace(
  context: AuthenticatedContext,
  input: { name: string; website: string; automationGoal: string },
) {
  if (input.name.trim().length < 2) throw httpError(400, "workspace name must be at least 2 characters");
  if (input.website.trim()) {
    try {
      const url = new URL(input.website.trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("invalid website");
      }
    } catch {
      throw httpError(400, "website must be a valid URL");
    }
  }

  const result = await mutateStoreAsync((data) => {
    const workspace = data.workspaces.find((entry) => entry.id === context.workspace.id);
    if (!workspace) throw httpError(404, "workspace not found");
    workspace.name = input.name.trim();
    workspace.slug = slugify(workspace.name) || workspace.id;
    workspace.website = input.website.trim();
    workspace.automationGoal = input.automationGoal.trim();
    workspace.updatedAt = now();

    const facts = data.activationFacts[workspace.id] ?? { now: now() };
    if (workspace.automationGoal && !facts.briefCapturedAt) {
      facts.briefCapturedAt = now();
    }
    data.activationFacts[workspace.id] = facts;

    recordActivity(data, makeActivity(workspace.id, "workspace", "workspace.updated", { type: "user", id: context.user.id, displayName: context.user.displayName }, { title: "Workspace settings updated" }, workspace.updatedAt));
    return workspace;
  });

  await syncWorkspaceActivation(context.workspace.id, true, { type: "user", id: context.user.id, displayName: context.user.displayName });
  return result;
}

export async function listWorkspaceMembers(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  return {
    members: data.memberships
      .filter((membership) => membership.workspaceId === context.workspace.id)
      .map((membership) => summarizeWorkspaceMember(data, membership))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    invitations: data.workspaceInvitations
      .filter((invitation) => invitation.workspaceId === context.workspace.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((invitation) => summarizeWorkspaceInvitation(invitation)),
  };
}

export async function createWorkspaceInvitation(context: AuthenticatedContext, input: { email: string; role: string }) {
  const email = normalizeEmail(input.email);
  const role = parseWorkspaceRole(input.role);
  if (!email.includes("@")) throw httpError(400, "valid email is required");
  assertCanManageRole(context.role, role);

  const result = await mutateStoreAsync((data) => {
    const existingUser = data.users.find((entry) => normalizeEmail(entry.email) === email);
    if (existingUser && findWorkspaceMembership(data, context.workspace.id, existingUser.id)) {
      throw httpError(409, "user is already a workspace member");
    }

    const existingInvitation = data.workspaceInvitations.find((entry) => {
      return entry.workspaceId === context.workspace.id
        && normalizeEmail(entry.email) === email
        && !entry.acceptedAt
        && !entry.revokedAt
        && new Date(entry.expiresAt).getTime() > Date.now();
    });
    if (existingInvitation) throw httpError(409, "an active invitation already exists for that email");

    const timestamp = now();
    const invitation = upsertWorkspaceInvitation(data, {
      id: generateId(),
      workspaceId: context.workspace.id,
      email,
      role,
      token: generateId(),
      invitedByUserId: context.user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      createdAt: timestamp,
    });

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "workspace.invitation_created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Invitation created for ${email}`, email, role }, timestamp));

    return { invitation: summarizeWorkspaceInvitation(invitation, { includeToken: true }), invitationRecord: { ...invitation } };
  });

  const emailDelivery = await recordWorkspaceInvitationEmailDelivery(context, result.invitationRecord, "create");
  return { invitation: result.invitation, emailDelivery };
}

export async function acceptWorkspaceInvitation(context: AuthenticatedContext, token: string) {
  if (!token.trim()) throw httpError(400, "invitation token is required");

  return mutateStoreAsync((data) => {
    const invitation = findWorkspaceInvitationByToken(data, token.trim());
    if (!invitation) throw httpError(404, "invitation not found");
    if (invitation.revokedAt) throw httpError(400, "invitation has been revoked");
    if (invitation.acceptedAt) throw httpError(400, "invitation has already been accepted");
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) throw httpError(400, "invitation has expired");
    if (normalizeEmail(context.user.email) !== normalizeEmail(invitation.email)) {
      throw httpError(403, "invitation does not match the authenticated user");
    }

    const timestamp = now();
    const membership = upsertWorkspaceMembership(data, {
      workspaceId: invitation.workspaceId,
      userId: context.user.id,
      role: invitation.role,
      joinedAt: timestamp,
    });
    invitation.acceptedAt = timestamp;
    invitation.acceptedByUserId = context.user.id;

    recordActivity(data, makeActivity(invitation.workspaceId, "workspace", "workspace.invitation_accepted", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `${context.user.displayName} joined the workspace`, email: context.user.email, role: invitation.role }, timestamp));

    return {
      membership: summarizeWorkspaceMember(data, membership),
      invitation: summarizeWorkspaceInvitation(invitation),
    };
  });
}

export async function resendWorkspaceInvitation(context: AuthenticatedContext, invitationId: string) {
  if (!invitationId.trim()) throw httpError(400, "invitation id is required");

  const result = await mutateStoreAsync((data) => {
    const invitation = data.workspaceInvitations.find((entry) => {
      return entry.id === invitationId.trim() && entry.workspaceId === context.workspace.id;
    });
    if (!invitation) throw httpError(404, "invitation not found");
    assertCanManageRole(context.role, invitation.role);
    if (invitation.revokedAt) throw httpError(400, "invitation has been revoked");
    if (invitation.acceptedAt) throw httpError(400, "invitation has already been accepted");

    const timestamp = now();
    invitation.token = generateId();
    invitation.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    invitation.invitedByUserId = context.user.id;

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "workspace.invitation_resent", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Invitation resent for ${invitation.email}`, email: invitation.email, role: invitation.role }, timestamp));

    return { invitation: summarizeWorkspaceInvitation(invitation, { includeToken: true }), invitationRecord: { ...invitation } };
  });

  const emailDelivery = await recordWorkspaceInvitationEmailDelivery(context, result.invitationRecord, "resend");
  return { invitation: result.invitation, emailDelivery };
}

export async function revokeWorkspaceInvitation(context: AuthenticatedContext, invitationId: string) {
  if (!invitationId.trim()) throw httpError(400, "invitation id is required");

  return mutateStoreAsync((data) => {
    const invitation = data.workspaceInvitations.find((entry) => {
      return entry.id === invitationId.trim() && entry.workspaceId === context.workspace.id;
    });
    if (!invitation) throw httpError(404, "invitation not found");
    assertCanManageRole(context.role, invitation.role);
    if (invitation.acceptedAt) throw httpError(400, "invitation has already been accepted");
    if (invitation.revokedAt) throw httpError(400, "invitation has already been revoked");

    const timestamp = now();
    invitation.revokedAt = timestamp;

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "workspace.invitation_revoked", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Invitation revoked for ${invitation.email}`, email: invitation.email, role: invitation.role }, timestamp));

    return { invitation: summarizeWorkspaceInvitation(invitation) };
  });
}

export async function updateWorkspaceMemberRole(context: AuthenticatedContext, userId: string, input: { role: string }) {
  const role = parseWorkspaceRole(input.role);
  assertCanManageRole(context.role, role);

  return mutateStoreAsync((data) => {
    const membership = findWorkspaceMembership(data, context.workspace.id, userId);
    if (!membership) throw httpError(404, "workspace member not found");
    assertCanManageRole(context.role, membership.role);
    assertNotLastOwner(data, context.workspace.id, membership, role);

    membership.role = role;
    const timestamp = now();
    recordActivity(data, makeActivity(context.workspace.id, "workspace", "workspace.member_role_updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: "Workspace member role updated", userId, role }, timestamp));

    return { member: summarizeWorkspaceMember(data, membership) };
  });
}

export async function removeWorkspaceMember(context: AuthenticatedContext, userId: string) {
  return mutateStoreAsync((data) => {
    const membership = findWorkspaceMembership(data, context.workspace.id, userId);
    if (!membership) throw httpError(404, "workspace member not found");
    assertCanManageRole(context.role, membership.role);
    assertNotLastOwner(data, context.workspace.id, membership, null);

    data.memberships = data.memberships.filter((entry) => {
      return !(entry.workspaceId === context.workspace.id && entry.userId === userId);
    });
    const timestamp = now();
    recordActivity(data, makeActivity(context.workspace.id, "workspace", "workspace.member_removed", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: "Workspace member removed", userId }, timestamp));

    return { ok: true };
  });
}

export async function getOnboarding(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  const onboarding = data.onboardingStates.find((entry) => entry.workspaceId === context.workspace.id);
  if (!onboarding) throw httpError(404, "onboarding state not found");
  return onboarding;
}

export async function completeOnboardingStep(context: AuthenticatedContext, stepKey: string) {
  if (!ONBOARDING_STEPS.includes(stepKey as any)) {
    throw httpError(400, "unknown onboarding step");
  }

  const onboarding = await mutateStoreAsync((data) => {
    const record = data.onboardingStates.find((entry) => entry.workspaceId === context.workspace.id);
    if (!record) throw httpError(404, "onboarding state not found");
    if (!record.completedSteps.includes(stepKey as any)) {
      record.completedSteps.push(stepKey as any);
    }

    const timestamp = now();
    record.currentStep = nextIncompleteStep(record.completedSteps);
    record.status = record.completedSteps.length === ONBOARDING_STEPS.length ? "completed" : "in_progress";
    record.completedAt = record.status === "completed" ? timestamp : undefined;
    record.updatedAt = timestamp;

    const facts = data.activationFacts[context.workspace.id] ?? { now: timestamp };
    applyOnboardingStepToFacts(facts, stepKey as any, timestamp);
    data.activationFacts[context.workspace.id] = facts;

    recordActivity(data, makeActivity(context.workspace.id, "activation", "onboarding.step_completed", { type: "user", id: context.user.id, displayName: context.user.displayName }, { title: `Completed step: ${stepKey}`, stepKey }, timestamp));
    return record;
  });

  await syncWorkspaceActivation(context.workspace.id, true, { type: "user", id: context.user.id, displayName: context.user.displayName });
  return onboarding;
}

export function listWorkspaceActivities(context: AuthenticatedContext) {
  return workspaceActivitiesFromData(loadStore(), context.workspace.id, 50).map(redactActivity);
}

export async function listWorkspaceActivitiesAsync(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  return workspaceActivitiesFromData(data, context.workspace.id, 50).map(redactActivity);
}

export function getWorkspaceActivityDetail(context: AuthenticatedContext, activityId: string) {
  const data = loadStore();
  return getWorkspaceActivityDetailFromData(data, context, activityId);
}

export async function getWorkspaceActivityDetailAsync(context: AuthenticatedContext, activityId: string) {
  const data = await loadStoreAsync();
  return getWorkspaceActivityDetailFromData(data, context, activityId);
}

function getWorkspaceActivityDetailFromData(data: TaskloomData, context: AuthenticatedContext, activityId: string) {
  const activities = workspaceActivitiesFromData(data, context.workspace.id, 50).map(redactActivity);
  const index = activities.findIndex((entry) => entry.id === activityId);
  if (index === -1) throw httpError(404, "activity not found");

  const activity = activities[index];
  return {
    activity,
    previous: index > 0 ? activities[index - 1] : null,
    next: index < activities.length - 1 ? activities[index + 1] : null,
    related: buildActivityRelatedContext(data, context.workspace.id, activity),
  };
}

function workspaceActivitiesFromData(data: TaskloomData, workspaceId: string, limit?: number) {
  const activities = data.activities
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => {
      const cmp = right.occurredAt.localeCompare(left.occurredAt);
      return cmp !== 0 ? cmp : right.id.localeCompare(left.id);
    });
  return limit && limit > 0 ? activities.slice(0, limit) : activities;
}

type ActivityRelatedContext = {
  agent?: ReturnType<typeof summarizeAgent>;
  run?: ReturnType<typeof summarizeAgentRun>;
  blocker?: ReturnType<typeof summarizeWorkflowConcern>;
  question?: ReturnType<typeof summarizeWorkflowConcern>;
  planItem?: ReturnType<typeof summarizePlanItem>;
  requirement?: ReturnType<typeof summarizeRequirement>;
  evidence?: ReturnType<typeof summarizeValidationEvidence>;
  release?: ReturnType<typeof summarizeReleaseConfirmation>;
  workflow?: {
    requirements?: ReturnType<typeof summarizeRequirement>[];
    planItems?: ReturnType<typeof summarizePlanItem>[];
    blockers?: ReturnType<typeof summarizeWorkflowConcern>[];
    questions?: ReturnType<typeof summarizeWorkflowConcern>[];
    validationEvidence?: ReturnType<typeof summarizeValidationEvidence>[];
    releaseConfirmation?: ReturnType<typeof summarizeReleaseConfirmation>;
  };
};

function buildActivityRelatedContext(
  data: TaskloomData,
  workspaceId: string,
  activity: ActivityRecord,
): ActivityRelatedContext {
  const related: ActivityRelatedContext = {};
  const agentId = stringDataValue(activity.data, "agentId");
  const runId = stringDataValue(activity.data, "runId");
  const blockerId = stringDataValue(activity.data, "blockerId");
  const questionId = stringDataValue(activity.data, "questionId");
  const planItemId = stringDataValue(activity.data, "planItemId");
  const requirementId = stringDataValue(activity.data, "requirementId");
  const evidenceId = stringDataValue(activity.data, "evidenceId");
  const releaseId = stringDataValue(activity.data, "releaseId");

  const agent = agentId ? data.agents.find((entry) => entry.workspaceId === workspaceId && entry.id === agentId) : undefined;
  if (agent) related.agent = summarizeAgent(agent);

  const run = runId ? data.agentRuns.find((entry) => entry.workspaceId === workspaceId && entry.id === runId) : undefined;
  if (run) related.run = summarizeAgentRun(run);

  const blocker = blockerId ? data.workflowConcerns.find((entry) => entry.workspaceId === workspaceId && entry.id === blockerId && entry.kind === "blocker") : undefined;
  if (blocker) related.blocker = summarizeWorkflowConcern(blocker);

  const question = questionId ? data.workflowConcerns.find((entry) => entry.workspaceId === workspaceId && entry.id === questionId && entry.kind === "open_question") : undefined;
  if (question) related.question = summarizeWorkflowConcern(question);

  const planItem = planItemId ? data.implementationPlanItems.find((entry) => entry.workspaceId === workspaceId && entry.id === planItemId) : undefined;
  if (planItem) related.planItem = summarizePlanItem(planItem);

  const requirement = requirementId ? data.requirements.find((entry) => entry.workspaceId === workspaceId && entry.id === requirementId) : undefined;
  if (requirement) related.requirement = summarizeRequirement(requirement);

  const evidence = evidenceId ? data.validationEvidence.find((entry) => entry.workspaceId === workspaceId && entry.id === evidenceId) : undefined;
  if (evidence) related.evidence = summarizeValidationEvidence(evidence);

  const release = releaseId ? listReleaseConfirmationsForWorkspace(data, workspaceId).find((entry) => entry.id === releaseId || entry.workspaceId === releaseId) : undefined;
  if (release) related.release = summarizeReleaseConfirmation(release);

  const workflow = {
    ...(related.requirement ? { requirements: [related.requirement] } : {}),
    ...(related.planItem ? { planItems: [related.planItem] } : {}),
    ...(related.blocker ? { blockers: [related.blocker] } : {}),
    ...(related.question ? { questions: [related.question] } : {}),
    ...(related.evidence ? { validationEvidence: [related.evidence] } : {}),
    ...(related.release ? { releaseConfirmation: related.release } : {}),
  };
  if (Object.keys(workflow).length > 0) related.workflow = workflow;

  return related;
}

function stringDataValue(data: ActivityRecord["data"], key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function summarizeAgent(agent: AgentRecord) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    triggerKind: agent.triggerKind,
    model: agent.model,
    updatedAt: agent.updatedAt,
  };
}

function summarizeAgentRun(run: AgentRunRecord) {
  return {
    id: run.id,
    agentId: run.agentId,
    title: run.title,
    status: run.status,
    triggerKind: run.triggerKind,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

function summarizeWorkflowConcern(concern: WorkflowConcernRecord) {
  return {
    id: concern.id,
    kind: concern.kind,
    title: concern.title,
    status: concern.status,
    severity: concern.severity,
    relatedPlanItemId: concern.relatedPlanItemId,
    relatedRequirementId: concern.relatedRequirementId,
    updatedAt: concern.updatedAt,
  };
}

function summarizePlanItem(planItem: ImplementationPlanItemRecord) {
  return {
    id: planItem.id,
    title: planItem.title,
    status: planItem.status,
    order: planItem.order,
    requirementIds: planItem.requirementIds,
    ownerUserId: planItem.ownerUserId,
    updatedAt: planItem.updatedAt,
  };
}

function summarizeRequirement(requirement: RequirementRecord) {
  return {
    id: requirement.id,
    title: requirement.title,
    priority: requirement.priority,
    status: requirement.status,
    updatedAt: requirement.updatedAt,
  };
}

function summarizeValidationEvidence(evidence: ValidationEvidenceRecord) {
  return {
    id: evidence.id,
    title: evidence.title,
    type: evidence.type,
    status: evidence.status,
    planItemId: evidence.planItemId,
    requirementIds: evidence.requirementIds,
    capturedAt: evidence.capturedAt,
    updatedAt: evidence.updatedAt,
  };
}

function summarizeReleaseConfirmation(release: ReleaseConfirmationRecord) {
  return {
    id: release.id,
    versionLabel: release.versionLabel,
    status: release.status,
    confirmed: release.confirmed,
    confirmedAt: release.confirmedAt,
    summary: release.summary,
    updatedAt: release.updatedAt,
  };
}

export function listAgents(context: AuthenticatedContext) {
  const providersById = new Map(listProvidersForWorkspaceIndexed(context.workspace.id).map((provider) => [provider.id, provider]));
  return {
    agents: listAgentsForWorkspaceIndexed(context.workspace.id)
      .map((agent) => decorateAgentWithProvider(agent, agent.providerId ? providersById.get(agent.providerId) ?? null : null, { includeWebhookToken: false })),
  };
}

export async function listAgentsAsync(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  const providersById = new Map(
    data.providers
      .filter((provider) => provider.workspaceId === context.workspace.id)
      .map((provider) => [provider.id, provider]),
  );
  return {
    agents: data.agents
      .filter((agent) => agent.workspaceId === context.workspace.id && agent.status !== "archived")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((agent) => decorateAgentWithProvider(agent, agent.providerId ? providersById.get(agent.providerId) ?? null : null, { includeWebhookToken: false })),
  };
}

export function getAgent(context: AuthenticatedContext, agentId: string) {
  const agent = findAgentForWorkspaceIndexed(context.workspace.id, agentId);
  if (!agent || agent.status === "archived") {
    throw httpError(404, "agent not found");
  }
  const provider = agent.providerId
    ? listProvidersForWorkspaceIndexed(context.workspace.id).find((entry) => entry.id === agent.providerId) ?? null
    : null;

  return {
    agent: decorateAgentWithProvider(agent, provider),
    runs: listAgentRunsForAgentIndexed(context.workspace.id, agent.id, 20).map(decorateRun),
  };
}

export function generateAgentDraftFromPrompt(prompt: string, options: AgentDraftOptions = {}): AgentDraft {
  const trimmed = String(prompt ?? "").trim();
  if (trimmed.length < 8) throw httpError(400, "prompt must be at least 8 characters");

  const sentences = splitPromptSentences(trimmed);
  const actionPhrases = extractAgentActions(sentences);
  const primaryAction = actionPhrases[0] ?? "automate workspace follow-up";
  const name = buildAgentName(primaryAction, trimmed);
  const triggerKind = inferPromptAgentTriggerKind(trimmed);
  const schedule = triggerKind === "schedule" ? inferPromptAgentSchedule(trimmed) : undefined;
  const inputSchema = buildAgentInputSchema(trimmed);
  const enabledTools = inferAgentTools(trimmed);
  const integrationMetadata = buildAgentPhase71IntegrationMetadata(trimmed);
  const playbook = applyAgentIntegrationPlaybookSteps(buildAgentPlaybook(sentences, actionPhrases, enabledTools), integrationMetadata);
  const webhookReadiness = buildWebhookTriggerReadiness(triggerKind);

  return {
    prompt: trimmed,
    integrationMetadata,
    agent: {
      name,
      description: summarizePromptAgentDraft(sentences, name),
      instructions: applyAgentIntegrationInstructions(buildAgentInstructions(trimmed, actionPhrases, enabledTools), integrationMetadata),
      providerId: stringOrUndefined(options.providerId),
      model: stringOrUndefined(options.model),
      tools: enabledTools,
      enabledTools,
      routeKey: "agent.reasoning",
      schedule,
      triggerKind,
      playbook,
      status: options.status && ["active", "paused", "archived"].includes(options.status) ? options.status : "paused",
      inputSchema,
    },
    plan: applyAgentIntegrationDraftPlan(buildAgentDraftPlan(triggerKind, enabledTools, inputSchema), integrationMetadata),
    assumptions: applyAgentIntegrationAssumptions(buildAgentDraftAssumptions(triggerKind, enabledTools, inputSchema), integrationMetadata),
    readiness: {
      webhook: webhookReadiness,
    },
  };
}

export async function generateAgentFromPromptAsync(context: AuthenticatedContext, input: AgentDraftInput): Promise<AgentDraftResult> {
  const draft = generateAgentDraftFromPrompt(input.prompt ?? "", {
    providerId: input.providerId,
    model: input.model,
    status: input.status,
  });
  const shouldCreate = Boolean(input.create ?? input.approve);
  if (!shouldCreate) return { draft, created: false };

  const created = await createAgentAsync(context, {
    ...draft.agent,
    status: input.status ?? "active",
  });
  if (!input.runPreview) {
    return { draft, created: true, agent: created.agent };
  }

  const sampleInputs = validateAgentInputs(
    created.agent.inputSchema ?? [],
    input.sampleInputs ?? buildAgentSampleInputs(created.agent.inputSchema ?? []),
  );
  const firstRun = await recordAgentPreviewRun(context, created.agent, sampleInputs);
  return { draft, created: true, agent: created.agent, firstRun, sampleInputs };
}

export async function getAgentAsync(context: AuthenticatedContext, agentId: string) {
  const data = await loadStoreAsync();
  const agent = data.agents.find((entry) =>
    entry.workspaceId === context.workspace.id && entry.id === agentId
  );
  if (!agent || agent.status === "archived") {
    throw httpError(404, "agent not found");
  }
  const provider = agent.providerId
    ? data.providers.find((entry) => entry.workspaceId === context.workspace.id && entry.id === agent.providerId) ?? null
    : null;

  return {
    agent: decorateAgentWithProvider(agent, provider),
    runs: data.agentRuns
      .filter((entry) => entry.workspaceId === context.workspace.id && entry.agentId === agent.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 20)
      .map(decorateRun),
  };
}

export function createAgent(context: AuthenticatedContext, input: AgentInput) {
  const normalized = normalizeAgentInput(input);
  const timestamp = now();

  const result = mutateStore((data) => {
    validateProvider(data, context.workspace.id, normalized.providerId);

    const agent = upsertAgent(data, {
      workspaceId: context.workspace.id,
      name: normalized.name,
      description: normalized.description,
      instructions: normalized.instructions,
      providerId: normalized.providerId,
      model: normalized.model,
      tools: normalized.tools,
      enabledTools: normalized.enabledTools,
      routeKey: normalized.routeKey,
      schedule: normalized.schedule,
      triggerKind: normalized.triggerKind,
      playbook: normalized.playbook,
      status: normalized.status,
      templateId: normalized.templateId,
      inputSchema: normalized.inputSchema,
      createdByUserId: context.user.id,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Agent created: ${agent.name}`, agentId: agent.id }, timestamp));

    return { agent: decorateAgent(data, agent) };
  });
  maintainScheduledAgentJobs(result.agent.id);
  return result;
}

export async function createAgentAsync(context: AuthenticatedContext, input: AgentInput) {
  const normalized = normalizeAgentInput(input);
  const timestamp = now();

  const result = await mutateStoreAsync((data) => {
    validateProvider(data, context.workspace.id, normalized.providerId);

    const agent = upsertAgent(data, {
      workspaceId: context.workspace.id,
      name: normalized.name,
      description: normalized.description,
      instructions: normalized.instructions,
      providerId: normalized.providerId,
      model: normalized.model,
      tools: normalized.tools,
      enabledTools: normalized.enabledTools,
      routeKey: normalized.routeKey,
      schedule: normalized.schedule,
      triggerKind: normalized.triggerKind,
      playbook: normalized.playbook,
      status: normalized.status,
      templateId: normalized.templateId,
      inputSchema: normalized.inputSchema,
      createdByUserId: context.user.id,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Agent created: ${agent.name}`, agentId: agent.id }, timestamp));

    return { agent: decorateAgent(data, agent) };
  });
  maintainScheduledAgentJobs(result.agent.id);
  return result;
}

export function updateAgent(context: AuthenticatedContext, agentId: string, input: Partial<AgentInput>) {
  const timestamp = now();

  const result = mutateStore((data) => {
    const existing = findAgent(data, agentId);
    if (!existing || existing.workspaceId !== context.workspace.id || existing.status === "archived") {
      throw httpError(404, "agent not found");
    }

    const normalized = normalizeAgentInput({ ...existing, ...input });
    validateProvider(data, context.workspace.id, normalized.providerId);

    const agent = upsertAgent(data, {
      ...existing,
      name: normalized.name,
      description: normalized.description,
      instructions: normalized.instructions,
      providerId: normalized.providerId,
      model: normalized.model,
      tools: normalized.tools,
      enabledTools: normalized.enabledTools,
      routeKey: normalized.routeKey,
      schedule: normalized.schedule,
      triggerKind: normalized.triggerKind,
      playbook: normalized.playbook,
      status: normalized.status,
      templateId: normalized.templateId ?? existing.templateId,
      inputSchema: normalized.inputSchema,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Agent updated: ${agent.name}`, agentId: agent.id }, timestamp));

    return { agent: decorateAgent(data, agent) };
  });
  maintainScheduledAgentJobs(result.agent.id);
  return result;
}

export async function updateAgentAsync(context: AuthenticatedContext, agentId: string, input: Partial<AgentInput>) {
  const timestamp = now();

  const result = await mutateStoreAsync((data) => {
    const existing = findAgent(data, agentId);
    if (!existing || existing.workspaceId !== context.workspace.id || existing.status === "archived") {
      throw httpError(404, "agent not found");
    }

    const normalized = normalizeAgentInput({ ...existing, ...input });
    validateProvider(data, context.workspace.id, normalized.providerId);

    const agent = upsertAgent(data, {
      ...existing,
      name: normalized.name,
      description: normalized.description,
      instructions: normalized.instructions,
      providerId: normalized.providerId,
      model: normalized.model,
      tools: normalized.tools,
      enabledTools: normalized.enabledTools,
      routeKey: normalized.routeKey,
      schedule: normalized.schedule,
      triggerKind: normalized.triggerKind,
      playbook: normalized.playbook,
      status: normalized.status,
      templateId: normalized.templateId ?? existing.templateId,
      inputSchema: normalized.inputSchema,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Agent updated: ${agent.name}`, agentId: agent.id }, timestamp));

    return { agent: decorateAgent(data, agent) };
  });
  maintainScheduledAgentJobs(result.agent.id);
  return result;
}

export function archiveAgent(context: AuthenticatedContext, agentId: string) {
  const timestamp = now();

  const result = mutateStore((data) => {
    const existing = findAgent(data, agentId);
    if (!existing || existing.workspaceId !== context.workspace.id || existing.status === "archived") {
      throw httpError(404, "agent not found");
    }

    const agent = upsertAgent(data, {
      ...existing,
      status: "archived",
      archivedAt: timestamp,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.archived", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Agent archived: ${agent.name}`, agentId: agent.id }, timestamp));

    return { agent: decorateAgent(data, agent) };
  });
  maintainScheduledAgentJobs(result.agent.id);
  return result;
}

export async function archiveAgentAsync(context: AuthenticatedContext, agentId: string) {
  const timestamp = now();

  const result = await mutateStoreAsync((data) => {
    const existing = findAgent(data, agentId);
    if (!existing || existing.workspaceId !== context.workspace.id || existing.status === "archived") {
      throw httpError(404, "agent not found");
    }

    const agent = upsertAgent(data, {
      ...existing,
      status: "archived",
      archivedAt: timestamp,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.archived", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Agent archived: ${agent.name}`, agentId: agent.id }, timestamp));

    return { agent: decorateAgent(data, agent) };
  });
  maintainScheduledAgentJobs(result.agent.id);
  return result;
}

export async function runAgent(
  context: AuthenticatedContext,
  agentId: string,
  input: { triggerKind?: string; inputs?: Record<string, unknown> } = {},
) {
  const timestamp = now();
  const requestedTriggerRaw = stringOrUndefined(input?.triggerKind);
  const triggerKind: AgentTriggerKind = requestedTriggerRaw && (TRIGGER_KINDS as string[]).includes(requestedTriggerRaw)
    ? (requestedTriggerRaw as AgentTriggerKind)
    : "manual";
  const rawInputs: Record<string, unknown> = input?.inputs ?? {};

  const data = await loadStoreAsync();
  const agent = findAgent(data, agentId);
  if (!agent || agent.workspaceId !== context.workspace.id || agent.status === "archived") {
    throw httpError(404, "agent not found");
  }
  const inputs = validateAgentInputs(agent.inputSchema ?? [], rawInputs);
  const enabledTools = agent.enabledTools ?? [];
  const useToolLoop = enabledTools.length > 0;

  if (useToolLoop) {
    const { run } = await runAgentWithToolLoop({
      context,
      agent,
      inputs,
      triggerKind,
      timestamp,
    });
    return { run: decorateRun(run) };
  }

  return mutateStoreAsync((store) => {
    const liveAgent = findAgent(store, agentId);
    if (!liveAgent) throw httpError(404, "agent not found");
    const provider = liveAgent.providerId ? findProvider(store, liveAgent.providerId) : null;
    const providerReady = !provider || provider.status === "connected";
    const transcript = buildRunTranscript(liveAgent.playbook ?? [], providerReady, timestamp);

    const logs: AgentRunLogEntry[] = [
      { at: timestamp, level: "info", message: `Run started for ${liveAgent.name}.` },
    ];
    if (provider) {
      logs.push({
        at: timestamp,
        level: providerReady ? "info" : "warn",
        message: `Provider ${provider.name} status: ${provider.status}.`,
      });
    }
    for (const field of liveAgent.inputSchema ?? []) {
      if (field.key in inputs) {
        logs.push({ at: timestamp, level: "info", message: `Input ${field.key} = ${formatInputValue(inputs[field.key])}` });
      }
    }
    if (providerReady) {
      logs.push({ at: timestamp, level: "info", message: "Run recorded locally. Attach an execution adapter to perform real work." });
    } else {
      logs.push({ at: timestamp, level: "error", message: "Provider API key is not configured." });
    }

    const output = providerReady ? buildRunOutput(liveAgent.name, inputs) : undefined;

    const run = upsertAgentRun(store, {
      workspaceId: context.workspace.id,
      agentId: liveAgent.id,
      title: providerReady ? `${liveAgent.name} run completed` : `${liveAgent.name} run failed`,
      status: providerReady ? "success" : "failed",
      triggerKind,
      transcript,
      startedAt: timestamp,
      completedAt: timestamp,
      inputs: Object.keys(inputs).length ? inputs : undefined,
      output,
      error: providerReady ? undefined : "Provider API key is not configured.",
      logs,
    }, timestamp);

    recordActivity(store, makeActivity(context.workspace.id, "workspace", "agent.run", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: run.title, agentId: liveAgent.id, runId: run.id, status: run.status, triggerKind }, timestamp));

    return { run: decorateRun(run) };
  });
}

async function runAgentWithToolLoop(args: {
  context: AuthenticatedContext;
  agent: AgentRecord;
  inputs: Record<string, string | number | boolean>;
  triggerKind: AgentTriggerKind;
  timestamp: string;
}): Promise<{ run: AgentRunRecord }> {
  const { context, agent, inputs, triggerKind, timestamp } = args;
  const { runAgentLoop } = await import("./tools/agent-loop.js");
  const { closeBrowserSession } = await import("./tools/browser-runtime.js");
  const enabledTools = agent.enabledTools ?? [];
  const routeKey = agent.routeKey || "agent.reasoning";
  const runId = generateId();

  const userPromptParts = [agent.instructions];
  if (Object.keys(inputs).length > 0) {
    userPromptParts.push("INPUTS:");
    for (const [k, v] of Object.entries(inputs)) userPromptParts.push(`- ${k}: ${formatInputValue(v)}`);
  }
  if ((agent.playbook ?? []).length > 0) {
    userPromptParts.push("PLAYBOOK:");
    for (const step of agent.playbook ?? []) userPromptParts.push(`- ${step.title}: ${step.instruction}`);
  }

  const logs: AgentRunLogEntry[] = [
    { at: timestamp, level: "info", message: `Tool-loop run started for ${agent.name}.` },
    { at: timestamp, level: "info", message: `Tools enabled: ${enabledTools.join(", ")}` },
  ];

  let loopResult: Awaited<ReturnType<typeof runAgentLoop>> | null = null;
  let loopError: string | undefined;
  try {
    loopResult = await runAgentLoop({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      runId,
      agentId: agent.id,
      routeKey,
      systemPrompt: "You are a workspace agent. Use the supplied tools to complete the user's task. When finished, return a concise final answer.",
      userPrompt: userPromptParts.join("\n"),
      toolNames: enabledTools,
      maxTurns: 8,
    });
  } catch (error) {
    loopError = (error as Error).message;
    logs.push({ at: new Date().toISOString(), level: "error", message: `Loop crashed: ${loopError}` });
  } finally {
    try { await closeBrowserSession(runId); } catch { /* ignore */ }
  }

  const completedAt = new Date().toISOString();
  const ok = loopResult !== null && !loopError && loopResult.finishReason !== "error";
  for (const tc of loopResult?.toolCalls ?? []) {
    logs.push({
      at: tc.completedAt,
      level: tc.status === "ok" ? "info" : tc.status === "timeout" ? "warn" : "error",
      message: `${tc.toolName}: ${tc.status}${tc.error ? ` — ${tc.error}` : ""}`,
    });
  }
  if (loopResult) {
    logs.push({ at: completedAt, level: "info", message: `Finished in ${loopResult.turnsUsed} turn(s) using ${loopResult.modelUsed} ($${loopResult.costUsd.toFixed(4)}).` });
  }

  return mutateStoreAsync((store) => {
    const run = upsertAgentRun(store, {
      workspaceId: context.workspace.id,
      agentId: agent.id,
      title: ok ? `${agent.name} run completed` : `${agent.name} run failed`,
      status: ok ? "success" : "failed",
      triggerKind,
      startedAt: timestamp,
      completedAt,
      inputs: Object.keys(inputs).length ? inputs : undefined,
      output: loopResult?.finalContent,
      error: loopError ?? (loopResult?.finishReason === "max_turns" ? "Loop exceeded max_turns." : undefined),
      logs,
      toolCalls: loopResult?.toolCalls.map((tc) => ({
        id: tc.id,
        toolName: tc.toolName,
        input: tc.input,
        output: tc.output,
        ...(tc.error ? { error: tc.error } : {}),
        ...(tc.artifacts ? { artifacts: tc.artifacts } : {}),
        durationMs: tc.durationMs,
        startedAt: tc.startedAt,
        completedAt: tc.completedAt,
        status: tc.status,
      })),
      modelUsed: loopResult?.modelUsed,
      costUsd: loopResult?.costUsd,
    }, timestamp);

    recordActivity(store, makeActivity(context.workspace.id, "workspace", "agent.run", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: run.title, agentId: agent.id, runId: run.id, status: run.status, triggerKind }, timestamp));

    return { run: decorateRun(run) };
  });
}

function buildRunTranscript(playbook: AgentPlaybookStep[], providerReady: boolean, timestamp: string): AgentRunStep[] {
  if (playbook.length === 0) {
    return [
      {
        id: generateId(),
        title: "Execute instructions",
        status: providerReady ? "success" : "failed",
        output: providerReady
          ? "Instructions executed against the configured provider."
          : "Provider API key is not configured.",
        durationMs: providerReady ? 420 : 60,
        startedAt: timestamp,
      },
    ];
  }

  if (!providerReady) {
    return playbook.map((step, index) => ({
      id: generateId(),
      title: step.title,
      status: index === 0 ? "failed" : "skipped",
      output: index === 0 ? "Provider API key is not configured." : "Skipped because the previous step failed.",
      durationMs: index === 0 ? 60 : 0,
      startedAt: timestamp,
    }));
  }

  return playbook.map((step) => ({
    id: generateId(),
    title: step.title,
    status: "success",
    output: step.instruction ? `Completed: ${step.instruction.slice(0, 160)}` : "Step completed.",
    durationMs: 200 + Math.floor(Math.random() * 600),
    startedAt: timestamp,
  }));
}

export async function generateAgentBuilderDraftAsync(context: AuthenticatedContext, input: AgentBuilderPromptInput): Promise<AgentBuilderDraft> {
  const prompt = String(input.prompt ?? "").trim();
  if (prompt.length < 12) throw httpError(400, "prompt must be at least 12 characters");
  if (prompt.length > 2_000) throw httpError(400, "prompt must be 2000 characters or fewer");

  const data = await loadStoreAsync();
  const providers = data.providers
    .filter((provider) => provider.workspaceId === context.workspace.id && provider.status !== "disabled")
    .sort((left, right) => Number(right.status === "connected") - Number(left.status === "connected") || left.name.localeCompare(right.name));
  const selectedProvider = providers.find((provider) => provider.status === "connected" && provider.apiKeyConfigured) ?? providers[0] ?? null;
  const registeredTools = getDefaultToolRegistry().list().map((tool) => tool.name);
  const availableTools = (registeredTools.length > 0 ? registeredTools : listDefaultToolSummaries().map((tool) => tool.name)).sort();
  const intent = inferAgentBuilderIntent(prompt);
  const recommendedTools = recommendAgentTools(intent, prompt, availableTools);
  const inputSchema = buildAgentBuilderInputSchema(intent, prompt);
  const integrationMetadata = buildAgentPhase71IntegrationMetadata(prompt);
  const sampleInputs = buildAgentSampleInputs(inputSchema);
  const triggerKind = inferAgentTriggerKind(intent, prompt);
  const schedule = triggerKind === "schedule" ? inferAgentSchedule(prompt) : undefined;
  const webhookReadiness = buildAgentBuilderWebhookReadiness(triggerKind);
  const name = buildAgentBuilderName(prompt, intent);
  const playbook = applyAgentIntegrationPlaybookSteps(buildAgentBuilderPlaybook(intent, prompt), integrationMetadata);
  const missingTools = recommendedTools.filter((tool) => !availableTools.includes(tool));
  const providerConfigured = selectedProvider ? isProviderReadyForAgentRuns(data, context.workspace.id, selectedProvider) : false;
  const blockers = [
    ...(!providerConfigured ? ["Connect a provider API key before running with LLM tools."] : []),
    ...(missingTools.length > 0 ? [`Remove or implement missing tools: ${missingTools.join(", ")}.`] : []),
  ];

  return {
    prompt,
    intent,
    summary: `${name} will ${summarizeAgentPrompt(prompt)}`,
    integrationMetadata,
    agent: {
      name,
      description: summarizeAgentPrompt(prompt),
      instructions: applyAgentIntegrationInstructions(buildAgentBuilderInstructions(prompt, intent), integrationMetadata),
      providerId: selectedProvider?.id,
      model: selectedProvider?.defaultModel,
      tools: recommendedTools,
      enabledTools: recommendedTools.filter((tool) => availableTools.includes(tool)),
      routeKey: "agent.reasoning",
      triggerKind,
      schedule,
      playbook,
      status: "active",
      inputSchema,
    },
    sampleInputs,
    plan: {
      title: `Build ${name}`,
      steps: [
        { title: "Capture the job", detail: "Turn the prompt into clear agent instructions, typed inputs, and a first-run sample." },
        { title: "Wire useful tools", detail: recommendedTools.length > 0 ? `Enable ${recommendedTools.join(", ")} for the first run.` : "Keep the first draft tool-light until an integration is selected." },
        ...buildAgentBuilderIntegrationPlanSteps(integrationMetadata),
        { title: "Choose the trigger", detail: triggerKind === "schedule" ? `Run on ${schedule}.` : triggerKind === "webhook" ? webhookReadiness.planDetail : "Start with manual runs while the draft is validated." },
        ...(triggerKind === "webhook" ? [{ title: "Prepare webhook publish readiness", detail: webhookReadiness.message }] : []),
        { title: "Run once", detail: "Save the draft, run it with sample inputs, then inspect transcript, tool calls, and output." },
      ],
      acceptanceChecks: [
        "Agent draft is saved with generated instructions, input schema, tools, and trigger.",
        "Missing provider or tool setup is visible before first run.",
        ...integrationMetadata.requested.map((integration) => `${integration.label} flow references ${integration.envVars.join(", ")} and remains draft-safe until setup is complete.`),
        "First test run records output, logs, transcript, and any tool calls.",
      ],
      openQuestions: buildAgentBuilderOpenQuestions(intent, prompt),
    },
    readiness: {
      provider: {
        configured: providerConfigured,
        ...(selectedProvider ? {
          selectedProviderId: selectedProvider.id,
          selectedProviderName: selectedProvider.name,
          selectedModel: selectedProvider.defaultModel,
        } : {}),
        message: providerConfigured
          ? `${selectedProvider?.name} is ready for first run.`
          : selectedProvider
          ? `${selectedProvider.name} exists but still needs an API key or connected status.`
          : "Add an OpenAI, Anthropic, Ollama, or custom provider before real LLM execution.",
      },
      tools: {
        recommended: recommendedTools,
        available: recommendedTools.filter((tool) => availableTools.includes(tool)),
        missing: missingTools,
        message: missingTools.length === 0
          ? "Recommended tools are available in this workspace runtime."
          : `Some requested tools are not registered yet: ${missingTools.join(", ")}.`,
      },
      webhook: webhookReadiness,
      firstRun: {
        canRun: blockers.length === 0,
        blockers,
        message: blockers.length === 0
          ? "Ready to save and run with the generated sample inputs."
          : "The draft can be saved now, but resolve setup blockers before expecting real execution.",
      },
    },
  };
}

export async function approveAgentBuilderDraftAsync(context: AuthenticatedContext, input: AgentBuilderApproveInput): Promise<AgentBuilderApproveResult> {
  const draft = input.draft ?? await generateAgentBuilderDraftAsync(context, { prompt: input.prompt });
  const created = await createAgentAsync(context, {
    ...draft.agent,
    status: input.status ?? draft.agent.status ?? "active",
  });

  if (!input.runPreview) return { draft, created: true, agent: created.agent };
  if (!draft.readiness.firstRun.canRun) return { draft, created: true, agent: created.agent };

  const sampleInputs = validateAgentInputs(
    created.agent.inputSchema ?? [],
    input.sampleInputs ?? draft.sampleInputs ?? {},
  );
  const firstRun = await recordAgentPreviewRun(context, created.agent, sampleInputs);
  return { draft, created: true, agent: created.agent, firstRun, sampleInputs };
}

async function recordAgentPreviewRun(
  context: AuthenticatedContext,
  agent: Pick<AgentRecord, "id" | "name" | "playbook">,
  inputs: Record<string, string | number | boolean>,
) {
  const timestamp = now();
  return mutateStoreAsync((store) => {
    const liveAgent = findAgent(store, agent.id);
    if (!liveAgent || liveAgent.workspaceId !== context.workspace.id || liveAgent.status === "archived") {
      throw httpError(404, "agent not found");
    }

    const run = upsertAgentRun(store, {
      workspaceId: context.workspace.id,
      agentId: liveAgent.id,
      title: `${liveAgent.name} preview run completed`,
      status: "success",
      triggerKind: "manual",
      transcript: buildRunTranscript(liveAgent.playbook ?? [], true, timestamp),
      startedAt: timestamp,
      completedAt: timestamp,
      inputs: Object.keys(inputs).length ? inputs : undefined,
      output: buildRunOutput(liveAgent.name, inputs),
      logs: [
        { at: timestamp, level: "info", message: `Preview run started for ${liveAgent.name}.` },
        { at: timestamp, level: "info", message: "Sample inputs generated for first-run visibility." },
        { at: timestamp, level: "info", message: "Preview run recorded locally without invoking tools or a model." },
      ],
    }, timestamp);

    recordActivity(store, makeActivity(context.workspace.id, "workspace", "agent.run.preview", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: run.title, agentId: liveAgent.id, runId: run.id, status: run.status, triggerKind: run.triggerKind }, timestamp));

    return decorateRun(run);
  });
}

function buildAgentPhase71IntegrationMetadata(prompt: string): Phase71IntegrationMetadata {
  const requested = detectPhase71Integrations(prompt);
  return {
    requested,
    setupGuidance: requested.flatMap((integration) => integration.setupGuidance),
  };
}

function applyAgentIntegrationInstructions(instructions: string, metadata: Phase71IntegrationMetadata): string {
  if (metadata.requested.length === 0) return instructions;
  return [
    instructions,
    "",
    "Phase 71 integration setup:",
    ...metadata.requested.map((integration) => `- ${integration.label}: reference ${integration.envVars.join(", ")} and keep unrelated features draft-safe if setup is missing.`),
  ].join("\n");
}

function applyAgentIntegrationPlaybookSteps(
  playbook: AgentPlaybookStep[],
  metadata: Phase71IntegrationMetadata,
): AgentPlaybookStep[] {
  if (metadata.requested.length === 0) return playbook;
  const integrationSteps = metadata.requested.map((integration): AgentPlaybookStep => ({
    id: `integration-${integration.id}`,
    title: `Prepare ${integration.label}`,
    instruction: `${integration.flows.join(" ")} Required setup references: ${integration.envVars.join(", ")}.`,
  }));
  return [
    playbook[0],
    ...integrationSteps,
    ...playbook.slice(1),
  ].filter(Boolean);
}

function applyAgentIntegrationDraftPlan(
  plan: AgentDraftPlanItem[],
  metadata: Phase71IntegrationMetadata,
): AgentDraftPlanItem[] {
  if (metadata.requested.length === 0) return plan;
  return [
    ...plan,
    ...metadata.requested.map((integration): AgentDraftPlanItem => ({
      title: `Configure ${integration.label}`,
      detail: `${integration.setupGuidance.join(" ")} Generated flow: ${integration.flows[0]}`,
      status: "todo",
    })),
  ];
}

function applyAgentIntegrationAssumptions(
  assumptions: string[],
  metadata: Phase71IntegrationMetadata,
): string[] {
  if (metadata.requested.length === 0) return assumptions;
  return [
    ...assumptions,
    ...metadata.requested.map((integration) => `${integration.label} can be drafted before setup; live calls require ${integration.envVars.join(", ")}.`),
  ];
}

function buildAgentBuilderIntegrationPlanSteps(
  metadata: Phase71IntegrationMetadata,
): Array<{ title: string; detail: string }> {
  return metadata.requested.map((integration) => ({
    title: `Prepare ${integration.label}`,
    detail: `${integration.flows[0]} Setup references: ${integration.envVars.join(", ")}.`,
  }));
}

function inferAgentBuilderIntent(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b(support|ticket|inbox|customer|reply)\b/.test(lower)) return "support";
  if (/\b(lead|sales|crm|enrich|prospect)\b/.test(lower)) return "lead_enrichment";
  if (/\b(release|audit|validation|evidence)\b/.test(lower)) return "release";
  if (/\b(research|summarize|web|url|scrape|competitor)\b/.test(lower)) return "research";
  if (/\b(report|brief|digest|daily|weekly|summary)\b/.test(lower)) return "reporting";
  if (/\b(slack|discord|webhook|notify|message)\b/.test(lower)) return "notification";
  return "custom";
}

function inferAgentTriggerKind(intent: string, prompt: string): AgentTriggerKind {
  const lower = prompt.toLowerCase();
  if (/\b(webhook|incoming|when.*received|on event|external trigger)\b/.test(lower)) return "webhook";
  if (/\b(daily|weekly|hourly|every|schedule|morning|nightly|cron)\b/.test(lower)) return "schedule";
  if (/\b(email|inbox|mailbox)\b/.test(lower) && intent === "support") return "email";
  return "manual";
}

function inferAgentSchedule(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\bweekly|friday\b/.test(lower)) return "0 16 * * 5";
  if (/\bhourly\b/.test(lower)) return "0 * * * *";
  if (/\bevery 15|quarter-hour|inbox\b/.test(lower)) return "*/15 * * * *";
  if (/\bnightly|overnight\b/.test(lower)) return "0 2 * * *";
  return "0 8 * * 1-5";
}

function recommendAgentTools(intent: string, prompt: string, availableTools: string[]): string[] {
  const lower = prompt.toLowerCase();
  const desired = new Set<string>();
  if (["research", "lead_enrichment"].includes(intent) || /\b(url|website|web|scrape|research)\b/.test(lower)) desired.add("http_get");
  if (["reporting", "release"].includes(intent) || /\b(workflow|requirement|plan|blocker|release)\b/.test(lower)) {
    desired.add("read_workflow_brief");
    desired.add("list_requirements");
    desired.add("list_plan_items");
    desired.add("list_blockers");
  }
  if (/\b(blocker|risk|incident|escalat|urgent)\b/.test(lower)) desired.add("list_blockers");
  if (/\b(agent|run|runs)\b/.test(lower)) {
    desired.add("list_agents");
    desired.add("list_recent_runs");
  }
  if (/\b(create task|open blocker|log note|write|update)\b/.test(lower)) desired.add("log_note");
  if (/\b(browser|click|page|form)\b/.test(lower)) {
    for (const tool of availableTools.filter((name) => name.startsWith("browser_"))) desired.add(tool);
  }
  return [...desired].slice(0, 8);
}

function buildAgentBuilderInputSchema(intent: string, prompt: string): AgentInputField[] {
  const lower = prompt.toLowerCase();
  if (intent === "support") {
    return [
      { key: "mailbox", label: "Mailbox", type: "string", required: true, description: "Inbox, label, or queue to review.", defaultValue: "support" },
      { key: "urgency_threshold", label: "Urgency threshold", type: "enum", required: true, options: ["low", "medium", "high"], defaultValue: "medium" },
    ];
  }
  if (intent === "lead_enrichment") {
    return [
      { key: "lead_source", label: "Lead source", type: "string", required: true, description: "CRM view, CSV name, or inbound source.", defaultValue: "new leads" },
      { key: "company_website", label: "Company website", type: "url", required: false },
    ];
  }
  if (intent === "release") {
    return [
      { key: "release_label", label: "Release label", type: "string", required: true, defaultValue: "next release" },
      { key: "evidence_url", label: "Evidence URL", type: "url", required: false },
    ];
  }
  if (intent === "research" || /\burl|website\b/.test(lower)) {
    return [
      { key: "source_url", label: "Source URL", type: "url", required: true },
      { key: "depth", label: "Depth", type: "enum", required: false, options: ["quick", "deep"], defaultValue: "quick" },
    ];
  }
  if (intent === "reporting") {
    return [
      { key: "lookback_hours", label: "Lookback hours", type: "number", required: true, defaultValue: "24" },
      { key: "audience", label: "Audience", type: "enum", required: false, options: ["internal", "customer"], defaultValue: "internal" },
    ];
  }
  return [
    { key: "task", label: "Task", type: "string", required: true, description: "The work item this agent should complete.", defaultValue: truncateSentence(prompt, 80) },
  ];
}

function buildAgentBuilderWebhookReadiness(triggerKind: AgentTriggerKind): AgentBuilderWebhookTriggerReadiness {
  const readiness = buildWebhookTriggerReadiness(triggerKind);
  return {
    ...readiness,
    publishSteps: readiness.recommended
      ? ["Save the agent", "Create or rotate the webhook token", "Send a test payload", "Rotate the token before sharing broadly"]
      : [],
  };
}

function buildAgentBuilderName(prompt: string, intent: string): string {
  const quoted = prompt.match(/"([^"]{3,50})"/)?.[1];
  if (quoted) return truncateSentence(`${quoted} agent`, 80);
  if (intent === "lead_enrichment") return "Lead enrichment agent";
  if (intent === "support") return "Support triage agent";
  if (intent === "research") return "Research agent";
  if (intent === "reporting") return "Report writer agent";
  if (intent === "release") return "Release audit agent";
  if (intent === "notification") return "Notification agent";
  return "Workspace agent";
}

function buildAgentBuilderInstructions(prompt: string, intent: string): string {
  return [
    `User request: ${prompt}`,
    "",
    `You are a ${intent.replace(/_/g, " ")} workspace agent. Complete the request with clear, auditable steps.`,
    "Before taking action, identify the input, expected output, and any missing setup.",
    "Use enabled tools when they help. If a provider, credential, or integration is missing, explain the blocker.",
    "Return a concise final answer with completed work, follow-up items, and risks.",
  ].join("\n");
}

function buildAgentBuilderPlaybook(intent: string, prompt: string): AgentPlaybookStep[] {
  return [
    { id: "understand", title: "Understand request", instruction: `Restate the goal from this prompt: ${truncateSentence(prompt, 180)}` },
    { id: "collect", title: "Collect context", instruction: "Use inputs and enabled tools to gather the minimum context needed." },
    { id: "produce", title: "Produce output", instruction: intent === "notification" ? "Draft and prepare the message or notification." : "Create the requested summary, action, or recommendation." },
    { id: "report", title: "Report result", instruction: "Return what changed, what was found, and what still needs setup or approval." },
  ];
}

function buildAgentBuilderOpenQuestions(intent: string, prompt: string): string[] {
  const questions: string[] = [];
  if (!/\b(slack|email|webhook|browser|url|database|crm|github)\b/i.test(prompt)) {
    questions.push("Which external system should this agent connect to first?");
  }
  if (inferAgentTriggerKind(intent, prompt) === "manual") {
    questions.push("Should this run manually, on a schedule, or from a webhook?");
  }
  if (!/\b(success|done|metric|alert|notify)\b/i.test(prompt)) {
    questions.push("What should count as a successful run?");
  }
  return questions.slice(0, 3);
}

function summarizeAgentPrompt(prompt: string): string {
  const summary = truncateSentence(prompt.replace(/\s+/g, " "), 140);
  return summary.endsWith(".") ? summary : `${summary}.`;
}

function truncateSentence(value: string, max: number): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function splitPromptSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function summarizePromptAgentDraft(sentences: string[], fallbackName: string): string {
  const summary = sentences[0] ?? `${fallbackName} generated from prompt.`;
  return summary.length > 180 ? `${summary.slice(0, 177).trim()}...` : summary;
}

function extractAgentActions(sentences: string[]): string[] {
  const verbs = [
    "monitor", "summarize", "draft", "review", "route", "triage", "notify", "send",
    "track", "collect", "capture", "validate", "research", "report", "analyze",
    "sync", "escalate", "respond", "create", "open", "update", "publish", "schedule",
  ];
  const actions: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    for (const verb of verbs) {
      const match = sentence.match(new RegExp(`\\b${verb}\\b\\s+([^.;\\n]{2,80})`, "i"));
      if (!match) continue;
      const phrase = `${verb} ${match[1]}`.replace(/\s+/g, " ").trim();
      const key = phrase.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        actions.push(phrase);
      }
    }
  }
  if (actions.length === 0) actions.push(sentences[0]?.slice(0, 80) ?? "automate workspace follow-up");
  return actions.slice(0, 5);
}

function buildAgentName(primaryAction: string, prompt: string): string {
  const topic = primaryAction
    .replace(/^(monitor|summarize|draft|review|route|triage|notify|send|track|collect|capture|validate|research|report|analyze|sync|escalate|respond|create|open|update|publish|schedule)\s+/i, "")
    .replace(/\b(every|daily|weekly|hourly|when|with|for|to|and|then)\b.*$/i, "")
    .replace(/[^a-z0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fallback = /\bsupport|ticket|inbox|customer/i.test(prompt) ? "Support Triage" : "Workflow";
  const base = titleCase(topic || fallback);
  const name = `${base} Agent`;
  return name.length <= 80 ? name : `${name.slice(0, 74).trim()} Agent`;
}

function inferPromptAgentTriggerKind(prompt: string): AgentTriggerKind {
  if (/\b(webhook|incoming request|payload|event)\b/i.test(prompt)) return "webhook";
  if (/\b(email|inbox|mailbox)\b/i.test(prompt)) return "email";
  if (/\b(schedule|scheduled|daily|weekly|hourly|every\s+\d+|each morning|each day)\b/i.test(prompt)) return "schedule";
  return "manual";
}

function inferPromptAgentSchedule(prompt: string): string {
  if (/\bhourly|every hour\b/i.test(prompt)) return "0 * * * *";
  if (/\bweekly|each week\b/i.test(prompt)) return "0 9 * * 1";
  if (/\bnightly|overnight\b/i.test(prompt)) return "0 2 * * *";
  return "0 9 * * *";
}

function buildAgentInputSchema(prompt: string): AgentInputField[] {
  const fields: AgentInputField[] = [];
  if (/\b(url|website|page|site|http)\b/i.test(prompt)) {
    fields.push({ key: "target_url", label: "Target URL", type: "url", required: true, description: "Page or endpoint the agent should inspect." });
  }
  if (/\b(email|inbox|mailbox)\b/i.test(prompt)) {
    fields.push({ key: "mailbox", label: "Mailbox", type: "string", required: false, description: "Mailbox, queue, or label to inspect." });
  }
  if (/\b(ticket|issue|case|incident)\b/i.test(prompt)) {
    fields.push({ key: "ticket_id", label: "Ticket ID", type: "string", required: false, description: "Optional ticket, issue, or case identifier." });
  }
  if (/\b(customer|account|client)\b/i.test(prompt)) {
    fields.push({ key: "account_name", label: "Account", type: "string", required: false, description: "Customer, client, or account name." });
  }
  if (/\brelease|evidence\b/i.test(prompt)) {
    fields.push({ key: "release_label", label: "Release label", type: "string", required: true, defaultValue: "next release" });
  }
  if (/\bevidence url|evidence urls|url\b/i.test(prompt)) {
    fields.push({ key: "evidence_url", label: "Evidence URL", type: "url", required: false });
  }
  return fields.slice(0, 6);
}

function inferAgentTools(prompt: string): string[] {
  const tools = new Set<string>(["read_workflow_brief", "list_requirements", "list_plan_items"]);
  if (/\b(run|runs|failure|failed|status|monitor|recent)\b/i.test(prompt)) tools.add("list_recent_runs");
  if (/\b(blocker|question|risk|escalat|urgent|incident)\b/i.test(prompt)) tools.add("list_blockers");
  if (/\b(create|open|update|write|log|blocker|question|plan item|follow-up|follow up)\b/i.test(prompt)) tools.add("create_blocker");
  if (/\b(note|log|summary|summarize|report)\b/i.test(prompt)) tools.add("log_note");
  if (/\b(url|website|page|site|http|research|fetch)\b/i.test(prompt)) tools.add("http_get");
  if (/\b(browser|click|form|screenshot|page|website)\b/i.test(prompt)) {
    tools.add("browser_goto");
    tools.add("browser_extract");
    tools.add("browser_screenshot");
  }
  return Array.from(tools).slice(0, 12);
}

function buildAgentPlaybook(sentences: string[], actions: string[], enabledTools: string[]): AgentPlaybookStep[] {
  const steps = [
    {
      title: "Read workspace context",
      instruction: "Review the workspace brief, accepted requirements, current plan items, and recent activity before taking action.",
    },
    ...actions.slice(0, 3).map((action) => ({
      title: titleCase(action).slice(0, 120),
      instruction: matchingSentence(sentences, action) || `Complete this requested action: ${action}.`,
    })),
    {
      title: "Record outcome",
      instruction: enabledTools.includes("log_note")
        ? "Write a concise note with the result, any unresolved risks, and recommended next action."
        : "Return a concise result with unresolved risks and recommended next action.",
    },
  ];
  return steps.slice(0, 6).map((step, index) => ({ id: `draft_step_${index + 1}`, ...step }));
}

function buildAgentInstructions(prompt: string, actions: string[], enabledTools: string[]): string {
  const actionList = actions.map((action, index) => `${index + 1}. ${titleCase(action)}`).join("\n");
  const toolList = enabledTools.length ? enabledTools.join(", ") : "no tools";
  return [
    "You are a Taskloom workspace agent generated from an operator prompt.",
    "Turn the prompt into reliable, auditable work and keep outputs concise.",
    "",
    `Original prompt: ${prompt}`,
    "",
    "Primary actions:",
    actionList,
    "",
    `Use these enabled tools when useful: ${toolList}.`,
    "Before making changes, inspect relevant workspace context. After each run, summarize what changed, what remains uncertain, and the next recommended step.",
  ].join("\n");
}

function buildAgentDraftPlan(triggerKind: AgentTriggerKind, enabledTools: string[], inputSchema: AgentInputField[]): AgentDraftPlanItem[] {
  const webhookReadiness = buildWebhookTriggerReadiness(triggerKind);
  return [
    { title: "Review generated agent instructions", detail: "Confirm the generated name, instructions, and playbook match the operational intent.", status: "todo" },
    ...(inputSchema.length > 0
      ? [{ title: "Confirm run inputs", detail: `Check generated inputs: ${inputSchema.map((field) => field.key).join(", ")}.`, status: "todo" as const }]
      : []),
    { title: "Configure runtime access", detail: enabledTools.length > 0 ? `Verify enabled tools are appropriate: ${enabledTools.join(", ")}.` : "No tools were inferred.", status: "todo" },
    ...(triggerKind === "webhook"
      ? [{ title: "Prepare webhook trigger readiness", detail: webhookReadiness.planDetail, status: "todo" as const }]
      : []),
    { title: triggerKind === "schedule" ? "Verify schedule" : "Run a manual smoke test", detail: triggerKind === "schedule" ? "Confirm the cron schedule before activating the agent." : "Run once manually and inspect the transcript.", status: "todo" },
  ];
}

function buildAgentDraftAssumptions(triggerKind: AgentTriggerKind, enabledTools: string[], inputSchema: AgentInputField[]): string[] {
  const assumptions = [
    `Trigger inferred as ${triggerKind}.`,
    "Generated agents start paused unless they are explicitly created from the approval flow.",
  ];
  if (enabledTools.length > 0) assumptions.push("Tool selection is heuristic and should be reviewed before enabling production runs.");
  if (inputSchema.length === 0) assumptions.push("No required runtime inputs were inferred from the prompt.");
  if (triggerKind === "webhook") assumptions.push("Webhook-triggered drafts need a saved agent and generated token before external events can reach the public trigger route.");
  return assumptions;
}

function matchingSentence(sentences: string[], action: string): string {
  const verb = action.split(/\s+/)[0] ?? "";
  return sentences.find((sentence) => new RegExp(`\\b${escapeRegex(verb)}\\b`, "i").test(sentence)) ?? "";
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sampleInputValue(field: AgentInputField): string | number | boolean {
  if (field.type === "number") return Number(field.defaultValue ?? 24);
  if (field.type === "boolean") return field.defaultValue === "false" ? false : true;
  if (field.type === "url") return field.defaultValue || "https://example.com";
  if (field.type === "enum") return field.defaultValue || field.options?.[0] || "";
  return field.defaultValue || field.label.toLowerCase();
}

export function buildAgentSampleInputs(schema: AgentInputField[]): Record<string, string | number | boolean> {
  return Object.fromEntries(schema.map((field) => [field.key, sampleInputValue(field)]));
}

export function listAgentTemplates() {
  return { templates: AGENT_TEMPLATES };
}

export type IntegrationReadinessSummary = {
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
    missingProviderKinds: ApiKeyProvider[];
    missingApiKeys: Array<{ provider: ApiKeyProvider; providerName: string }>;
  };
  recommendedSetup: string[];
};

const DEFAULT_WORKSPACE_PROVIDER_KINDS = [...DEFAULT_PROVIDER_NAMES] as ApiKeyProvider[];

export function getIntegrationReadiness(context: AuthenticatedContext): IntegrationReadinessSummary {
  return buildIntegrationReadinessSummary(loadStore(), context.workspace.id);
}

export async function getIntegrationReadinessAsync(context: AuthenticatedContext): Promise<IntegrationReadinessSummary> {
  return buildIntegrationReadinessSummary(await loadStoreAsync(), context.workspace.id);
}

export function createAgentFromTemplate(context: AuthenticatedContext, templateId: string, overrides: { name?: string; providerId?: string; model?: string } = {}) {
  const template = findAgentTemplate(templateId);
  if (!template) throw httpError(404, "agent template not found");

  return createAgent(context, {
    name: overrides.name?.trim() || template.name,
    description: template.description,
    instructions: template.instructions,
    providerId: overrides.providerId,
    model: overrides.model,
    tools: template.tools,
    schedule: template.schedule,
    status: "active",
    templateId: template.id,
    inputSchema: template.inputSchema,
  });
}

export async function createAgentFromTemplateAsync(context: AuthenticatedContext, templateId: string, overrides: { name?: string; providerId?: string; model?: string } = {}) {
  const template = findAgentTemplate(templateId);
  if (!template) throw httpError(404, "agent template not found");

  return createAgentAsync(context, {
    name: overrides.name?.trim() || template.name,
    description: template.description,
    instructions: template.instructions,
    providerId: overrides.providerId,
    model: overrides.model,
    tools: template.tools,
    schedule: template.schedule,
    status: "active",
    templateId: template.id,
    inputSchema: template.inputSchema,
  });
}

export function listProviders(context: AuthenticatedContext) {
  return { providers: listProvidersForWorkspaceIndexed(context.workspace.id) };
}

export async function listProvidersAsync(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  return {
    providers: data.providers
      .filter((entry) => entry.workspaceId === context.workspace.id)
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function createProvider(context: AuthenticatedContext, input: ProviderInput) {
  const normalized = normalizeProviderInput(input);
  const timestamp = now();

  return mutateStore((data) => {
    const provider = upsertProvider(data, {
      workspaceId: context.workspace.id,
      ...normalized,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "provider.created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Provider connected: ${provider.name}`, providerId: provider.id }, timestamp));

    return { provider };
  });
}

export async function createProviderAsync(context: AuthenticatedContext, input: ProviderInput) {
  const normalized = normalizeProviderInput(input);
  const timestamp = now();

  return mutateStoreAsync((data) => {
    const provider = upsertProvider(data, {
      workspaceId: context.workspace.id,
      ...normalized,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "provider.created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Provider connected: ${provider.name}`, providerId: provider.id }, timestamp));

    return { provider };
  });
}

export function updateProvider(context: AuthenticatedContext, providerId: string, input: Partial<ProviderInput>) {
  const timestamp = now();

  return mutateStore((data) => {
    const existing = findProvider(data, providerId);
    if (!existing || existing.workspaceId !== context.workspace.id) {
      throw httpError(404, "provider not found");
    }

    const normalized = normalizeProviderInput({ ...existing, ...input });
    const provider = upsertProvider(data, {
      ...existing,
      ...normalized,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "provider.updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Provider updated: ${provider.name}`, providerId: provider.id }, timestamp));

    return { provider };
  });
}

export async function updateProviderAsync(context: AuthenticatedContext, providerId: string, input: Partial<ProviderInput>) {
  const timestamp = now();

  return mutateStoreAsync((data) => {
    const existing = findProvider(data, providerId);
    if (!existing || existing.workspaceId !== context.workspace.id) {
      throw httpError(404, "provider not found");
    }

    const normalized = normalizeProviderInput({ ...existing, ...input });
    const provider = upsertProvider(data, {
      ...existing,
      ...normalized,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "provider.updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Provider updated: ${provider.name}`, providerId: provider.id }, timestamp));

    return { provider };
  });
}

export function listAgentRuns(context: AuthenticatedContext) {
  return { runs: listAgentRunsForWorkspaceIndexed(context.workspace.id, 50).map(decorateRun) };
}

export async function listAgentRunsAsync(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  return {
    runs: data.agentRuns
      .filter((entry) => entry.workspaceId === context.workspace.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 50)
      .map(decorateRun),
  };
}

export function cancelAgentRun(context: AuthenticatedContext, runId: string) {
  const timestamp = now();
  const run = findAgentRunForWorkspaceIndexed(context.workspace.id, runId);
  if (!run) {
    throw httpError(404, "agent run not found");
  }
  if (run.status !== "queued" && run.status !== "running") {
    throw httpError(409, "only queued or running runs can be canceled");
  }
  return mutateStore((data) => {
    const updated = upsertAgentRun(data, {
      ...run,
      status: "canceled",
      completedAt: timestamp,
      error: run.error ?? "Canceled by operator.",
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.run_canceled", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Run canceled: ${updated.title}`, agentId: updated.agentId, runId: updated.id }, timestamp));

    return { run: decorateRun(updated) };
  });
}

export async function cancelAgentRunAsync(context: AuthenticatedContext, runId: string) {
  const timestamp = now();
  return mutateStoreAsync((data) => {
    const run = data.agentRuns.find((entry) => entry.workspaceId === context.workspace.id && entry.id === runId);
    if (!run) {
      throw httpError(404, "agent run not found");
    }
    if (run.status !== "queued" && run.status !== "running") {
      throw httpError(409, "only queued or running runs can be canceled");
    }
    const updated = upsertAgentRun(data, {
      ...run,
      status: "canceled",
      completedAt: timestamp,
      error: run.error ?? "Canceled by operator.",
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "agent.run_canceled", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Run canceled: ${updated.title}`, agentId: updated.agentId, runId: updated.id }, timestamp));

    return { run: decorateRun(updated) };
  });
}

export function recordRunAsPlaybook(context: AuthenticatedContext, runId: string) {
  return mutateStore((data) => {
    const run = data.agentRuns.find((r) => r.id === runId && r.workspaceId === context.workspace.id);
    if (!run) throw httpError(404, "agent run not found");
    if (!run.agentId) throw httpError(400, "this run is not linked to an agent");
    const agent = findAgent(data, run.agentId);
    if (!agent || agent.workspaceId !== context.workspace.id) throw httpError(404, "agent not found");
    if (!run.toolCalls || run.toolCalls.length === 0) throw httpError(400, "run has no tool calls to record");
    const playbook: AgentPlaybookStep[] = run.toolCalls.map((call, index) => ({
      id: generateId(),
      title: `${index + 1}. ${call.toolName}`,
      instruction: `Call ${call.toolName} with: ${JSON.stringify(call.input).slice(0, 380)}`,
    }));
    agent.playbook = playbook.slice(0, 20);
    agent.updatedAt = now();
    return { agent: decorateAgent(data, agent) };
  });
}

export async function recordRunAsPlaybookAsync(context: AuthenticatedContext, runId: string) {
  return mutateStoreAsync((data) => {
    const run = data.agentRuns.find((r) => r.id === runId && r.workspaceId === context.workspace.id);
    if (!run) throw httpError(404, "agent run not found");
    if (!run.agentId) throw httpError(400, "this run is not linked to an agent");
    const agent = findAgent(data, run.agentId);
    if (!agent || agent.workspaceId !== context.workspace.id) throw httpError(404, "agent not found");
    if (!run.toolCalls || run.toolCalls.length === 0) throw httpError(400, "run has no tool calls to record");
    const playbook: AgentPlaybookStep[] = run.toolCalls.map((call, index) => ({
      id: generateId(),
      title: `${index + 1}. ${call.toolName}`,
      instruction: `Call ${call.toolName} with: ${JSON.stringify(call.input).slice(0, 380)}`,
    }));
    agent.playbook = playbook.slice(0, 20);
    agent.updatedAt = now();
    return { agent: decorateAgent(data, agent) };
  });
}

export async function retryAgentRun(context: AuthenticatedContext, runId: string) {
  const data = await loadStoreAsync();
  const previous = data.agentRuns.find((entry) => entry.workspaceId === context.workspace.id && entry.id === runId);
  if (!previous) {
    throw httpError(404, "agent run not found");
  }
  if (!previous.agentId) {
    throw httpError(400, "this run is not linked to an agent and cannot be retried");
  }
  const timestamp = now();
  await mutateStoreAsync((store) => {
    const existingSignal = store.activationSignals.find((entry) =>
      entry.workspaceId === context.workspace.id && entry.kind === "retry" && entry.sourceId === previous.id
    );
    const stableKey = existingSignal?.stableKey ?? activationSignalStableKey(context.workspace.id, "retry", "agent_run", previous.id);
    const signal = upsertActivationSignal(store, {
      id: existingSignal?.id,
      workspaceId: context.workspace.id,
      kind: "retry",
      source: "agent_run",
      origin: "user_entered",
      sourceId: previous.id,
      stableKey,
      data: {
        origin: "user_action",
        observedBy: "service",
        previousRunId: previous.id,
        agentId: previous.agentId,
      },
    }, timestamp);
    upsertActivationActivity(store, makeActivity(context.workspace.id, "activation", "agent.run.retry", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, {
      title: `Run retried: ${previous.title}`,
      activationSignalKind: "retry",
      activationSignalId: signal.id,
      sourceId: previous.id,
      previousRunId: previous.id,
      agentId: previous.agentId,
      origin: "user_action",
      observedBy: "service",
    }, timestamp, activationActivityId(context.workspace.id, "agent.run.retry", signal.id)));
  });
  return runAgent(context, previous.agentId);
}

export function listWorkspaceEnvVarsForUser(context: AuthenticatedContext) {
  const data = loadStore();
  return { envVars: listWorkspaceEnvVars(data, context.workspace.id).map(maskEnvVar) };
}

export async function listWorkspaceEnvVarsForUserAsync(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  return { envVars: listWorkspaceEnvVars(data, context.workspace.id).map(maskEnvVar) };
}

export function createWorkspaceEnvVar(context: AuthenticatedContext, input: WorkspaceEnvVarInput) {
  const normalized = normalizeEnvVarInput(input);
  const timestamp = now();

  return mutateStore((data) => {
    const conflict = listWorkspaceEnvVars(data, context.workspace.id)
      .find((entry) => entry.key === normalized.key);
    if (conflict) throw httpError(409, `env var ${normalized.key} already exists`);

    const created = upsertWorkspaceEnvVar(data, {
      workspaceId: context.workspace.id,
      key: normalized.key,
      value: normalized.value,
      scope: normalized.scope,
      secret: normalized.secret,
      description: normalized.description,
      createdByUserId: context.user.id,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "env_var.created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Env var added: ${created.key}`, envVarId: created.id, scope: created.scope, secret: created.secret }, timestamp));

    return { envVar: maskEnvVar(created) };
  });
}

export async function createWorkspaceEnvVarAsync(context: AuthenticatedContext, input: WorkspaceEnvVarInput) {
  const normalized = normalizeEnvVarInput(input);
  const timestamp = now();

  return mutateStoreAsync((data) => {
    const conflict = listWorkspaceEnvVars(data, context.workspace.id)
      .find((entry) => entry.key === normalized.key);
    if (conflict) throw httpError(409, `env var ${normalized.key} already exists`);

    const created = upsertWorkspaceEnvVar(data, {
      workspaceId: context.workspace.id,
      key: normalized.key,
      value: normalized.value,
      scope: normalized.scope,
      secret: normalized.secret,
      description: normalized.description,
      createdByUserId: context.user.id,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "env_var.created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Env var added: ${created.key}`, envVarId: created.id, scope: created.scope, secret: created.secret }, timestamp));

    return { envVar: maskEnvVar(created) };
  });
}

export function updateWorkspaceEnvVar(
  context: AuthenticatedContext,
  envVarId: string,
  input: Partial<WorkspaceEnvVarInput>,
) {
  const timestamp = now();

  return mutateStore((data) => {
    const existing = findWorkspaceEnvVar(data, envVarId);
    if (!existing || existing.workspaceId !== context.workspace.id) {
      throw httpError(404, "env var not found");
    }

    const merged = normalizeEnvVarInput({
      key: input.key ?? existing.key,
      value: input.value ?? existing.value,
      scope: input.scope ?? existing.scope,
      secret: input.secret ?? existing.secret,
      description: input.description ?? existing.description,
    });

    if (merged.key !== existing.key) {
      const conflict = listWorkspaceEnvVars(data, context.workspace.id)
        .find((entry) => entry.key === merged.key && entry.id !== existing.id);
      if (conflict) throw httpError(409, `env var ${merged.key} already exists`);
    }

    const updated = upsertWorkspaceEnvVar(data, {
      ...existing,
      key: merged.key,
      value: merged.value,
      scope: merged.scope,
      secret: merged.secret,
      description: merged.description,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "env_var.updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Env var updated: ${updated.key}`, envVarId: updated.id }, timestamp));

    return { envVar: maskEnvVar(updated) };
  });
}

export async function updateWorkspaceEnvVarAsync(
  context: AuthenticatedContext,
  envVarId: string,
  input: Partial<WorkspaceEnvVarInput>,
) {
  const timestamp = now();

  return mutateStoreAsync((data) => {
    const existing = findWorkspaceEnvVar(data, envVarId);
    if (!existing || existing.workspaceId !== context.workspace.id) {
      throw httpError(404, "env var not found");
    }

    const merged = normalizeEnvVarInput({
      key: input.key ?? existing.key,
      value: input.value ?? existing.value,
      scope: input.scope ?? existing.scope,
      secret: input.secret ?? existing.secret,
      description: input.description ?? existing.description,
    });

    if (merged.key !== existing.key) {
      const conflict = listWorkspaceEnvVars(data, context.workspace.id)
        .find((entry) => entry.key === merged.key && entry.id !== existing.id);
      if (conflict) throw httpError(409, `env var ${merged.key} already exists`);
    }

    const updated = upsertWorkspaceEnvVar(data, {
      ...existing,
      key: merged.key,
      value: merged.value,
      scope: merged.scope,
      secret: merged.secret,
      description: merged.description,
    }, timestamp);

    recordActivity(data, makeActivity(context.workspace.id, "workspace", "env_var.updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Env var updated: ${updated.key}`, envVarId: updated.id }, timestamp));

    return { envVar: maskEnvVar(updated) };
  });
}

export function deleteWorkspaceEnvVarById(context: AuthenticatedContext, envVarId: string) {
  const timestamp = now();
  return mutateStore((data) => {
    const existing = findWorkspaceEnvVar(data, envVarId);
    if (!existing || existing.workspaceId !== context.workspace.id) {
      throw httpError(404, "env var not found");
    }
    deleteWorkspaceEnvVar(data, envVarId);
    recordActivity(data, makeActivity(context.workspace.id, "workspace", "env_var.deleted", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Env var removed: ${existing.key}`, envVarId: existing.id }, timestamp));
    return { ok: true };
  });
}

export async function deleteWorkspaceEnvVarByIdAsync(context: AuthenticatedContext, envVarId: string) {
  const timestamp = now();
  return mutateStoreAsync((data) => {
    const existing = findWorkspaceEnvVar(data, envVarId);
    if (!existing || existing.workspaceId !== context.workspace.id) {
      throw httpError(404, "env var not found");
    }
    deleteWorkspaceEnvVar(data, envVarId);
    recordActivity(data, makeActivity(context.workspace.id, "workspace", "env_var.deleted", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Env var removed: ${existing.key}`, envVarId: existing.id }, timestamp));
    return { ok: true };
  });
}

export function listReleaseHistory(context: AuthenticatedContext) {
  const data = loadStore();
  return listReleaseHistoryFromData(data, context.workspace.id);
}

export async function listReleaseHistoryAsync(context: AuthenticatedContext) {
  const data = await loadStoreAsync();
  return listReleaseHistoryFromData(data, context.workspace.id);
}

function listReleaseHistoryFromData(data: TaskloomData, workspaceId: string) {
  const releases = listReleaseConfirmationsForWorkspace(data, workspaceId)
    .sort((left, right) => (right.confirmedAt ?? right.updatedAt).localeCompare(left.confirmedAt ?? left.updatedAt));

  const evidence = data.validationEvidence.filter((entry) => entry.workspaceId === workspaceId);
  const concerns = data.workflowConcerns.filter((entry) => entry.workspaceId === workspaceId);

  const passedEvidence = evidence.filter((entry) => entry.status === "passed").length;
  const failedEvidence = evidence.filter((entry) => entry.status === "failed").length;
  const pendingEvidence = evidence.filter((entry) => !entry.status || entry.status === "pending").length;
  const openBlockers = concerns.filter((entry) => entry.kind === "blocker" && entry.status === "open").length;
  const openQuestions = concerns.filter((entry) => entry.kind === "open_question" && entry.status === "open").length;

  return {
    releases: releases.map((entry) => ({
      id: entry.id ?? entry.workspaceId,
      workspaceId: entry.workspaceId,
      versionLabel: entry.versionLabel ?? "release",
      status: entry.status ?? (entry.confirmed ? "confirmed" : "pending"),
      confirmed: Boolean(entry.confirmed || entry.status === "confirmed"),
      summary: entry.summary ?? entry.releaseNotes ?? "",
      confirmedBy: entry.confirmedBy ?? "",
      confirmedAt: entry.confirmedAt ?? null,
      validationEvidenceIds: entry.validationEvidenceIds ?? [],
      updatedAt: entry.updatedAt,
    })),
    preflight: {
      passedEvidence,
      failedEvidence,
      pendingEvidence,
      openBlockers,
      openQuestions,
      ready: failedEvidence === 0 && openBlockers === 0 && passedEvidence > 0,
    },
  };
}

type WorkspaceEnvVarInput = {
  key?: string;
  value?: string;
  scope?: WorkspaceEnvVarScope;
  secret?: boolean;
  description?: string;
};

const ENV_VAR_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,254}$/;

function normalizeEnvVarInput(input: WorkspaceEnvVarInput) {
  const key = String(input.key ?? "").trim().toUpperCase();
  if (!ENV_VAR_KEY_PATTERN.test(key)) {
    throw httpError(400, "key must start with a letter and contain only A-Z, 0-9, and underscores");
  }
  const value = String(input.value ?? "");
  if (value.length > 5000) throw httpError(400, "value must be 5000 characters or fewer");
  const scope: WorkspaceEnvVarScope = input.scope === "build" || input.scope === "runtime" ? input.scope : "all";
  const secret = Boolean(input.secret);
  const description = stringOrUndefined(input.description);
  return { key, value, scope, secret, description };
}

function maskEnvVar(record: WorkspaceEnvVarRecord) {
  const shouldMask = record.secret || isSensitiveKey(record.key);
  return {
    ...record,
    value: shouldMask ? maskSecret(record.value) : record.value,
    valuePreview: shouldMask ? maskSecret(record.value) : null,
    valueLength: record.value.length,
  };
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "•".repeat(value.length);
  return `${"•".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
}

function decorateRun(run: AgentRunRecord) {
  const start = run.startedAt ? Date.parse(run.startedAt) : NaN;
  const end = run.completedAt ? Date.parse(run.completedAt) : NaN;
  const durationMs = Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
  return {
    ...run,
    transcript: run.transcript?.map((step) => ({ ...step, output: redactSensitiveString(step.output) })),
    inputs: run.inputs ? redactSensitiveValue(run.inputs) as AgentRunRecord["inputs"] : undefined,
    output: run.output ? redactSensitiveString(run.output) : undefined,
    error: run.error ? redactSensitiveString(run.error) : undefined,
    logs: run.logs.map((entry) => ({ ...entry, message: redactSensitiveString(entry.message) })),
    toolCalls: run.toolCalls?.map((call) => ({
      ...call,
      input: redactSensitiveValue(call.input) as AgentRunToolCall["input"],
      output: redactSensitiveValue(call.output),
      error: call.error ? redactSensitiveString(call.error) : undefined,
    })),
    durationMs,
    canCancel: run.status === "queued" || run.status === "running",
    canRetry: Boolean(run.agentId) && (run.status === "failed" || run.status === "canceled" || run.status === "success"),
  };
}

type AgentInput = {
  name?: string;
  description?: string;
  instructions?: string;
  providerId?: string | null;
  model?: string | null;
  tools?: string[] | string;
  enabledTools?: string[] | null;
  routeKey?: string | null;
  schedule?: string | null;
  triggerKind?: AgentTriggerKind | string | null;
  playbook?: Array<Partial<AgentPlaybookStep>> | null;
  status?: AgentStatus;
  templateId?: string | null;
  inputSchema?: AgentInputField[];
};

const TRIGGER_KINDS: AgentTriggerKind[] = ["manual", "schedule", "webhook", "email"];

type ProviderInput = {
  name?: string;
  kind?: ProviderKind;
  defaultModel?: string;
  baseUrl?: string | null;
  apiKeyConfigured?: boolean;
  status?: "connected" | "missing_key" | "disabled";
};

function decorateAgent(data: ReturnType<typeof loadStore>, agent: AgentRecord, opts: { includeWebhookToken?: boolean } = {}) {
  const provider = agent.providerId ? findProvider(data, agent.providerId) : null;
  return decorateAgentWithProvider(agent, provider, opts);
}

function decorateAgentWithProvider(agent: AgentRecord, provider: ProviderRecord | null, opts: { includeWebhookToken?: boolean } = {}) {
  const responseAgent = opts.includeWebhookToken
    ? { ...agent, webhookTokenPreview: agent.webhookToken ? maskBearerSecret(agent.webhookToken) : undefined, hasWebhookToken: Boolean(agent.webhookToken) }
    : { ...agent, webhookToken: undefined, webhookTokenPreview: agent.webhookToken ? maskBearerSecret(agent.webhookToken) : undefined, hasWebhookToken: Boolean(agent.webhookToken) };
  return {
    ...responseAgent,
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          kind: provider.kind,
          defaultModel: provider.defaultModel,
          status: provider.status,
          apiKeyConfigured: provider.apiKeyConfigured,
        }
      : null,
  };
}

function normalizeAgentInput(input: AgentInput): Required<Pick<AgentRecord, "name" | "description" | "instructions" | "tools" | "status" | "inputSchema">> &
  Pick<AgentRecord, "providerId" | "model" | "schedule" | "triggerKind" | "playbook" | "templateId" | "enabledTools" | "routeKey"> {
  const name = String(input.name ?? "").trim();
  if (name.length < 2) throw httpError(400, "agent name must be at least 2 characters");
  if (name.length > 80) throw httpError(400, "agent name must be 80 characters or fewer");

  const instructions = String(input.instructions ?? "").trim();
  if (instructions.length < 10) throw httpError(400, "instructions must be at least 10 characters");

  const description = String(input.description ?? "").trim();
  const tools = Array.isArray(input.tools)
    ? input.tools
    : String(input.tools ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
  const status = input.status && ["active", "paused", "archived"].includes(input.status) ? input.status : "active";
  const inputSchema = normalizeInputSchema(input.inputSchema);

  const triggerKindRaw = stringOrUndefined(input.triggerKind);
  const triggerKind: AgentTriggerKind | undefined = triggerKindRaw && (TRIGGER_KINDS as string[]).includes(triggerKindRaw)
    ? (triggerKindRaw as AgentTriggerKind)
    : undefined;

  const playbook = normalizePlaybook(input.playbook ?? undefined);

  const enabledTools = Array.isArray(input.enabledTools)
    ? input.enabledTools.map((t) => String(t).trim()).filter(Boolean).slice(0, 24)
    : undefined;

  return {
    name,
    description,
    instructions,
    providerId: stringOrUndefined(input.providerId),
    model: stringOrUndefined(input.model),
    tools: tools.slice(0, 12),
    enabledTools,
    routeKey: stringOrUndefined(input.routeKey),
    schedule: stringOrUndefined(input.schedule),
    triggerKind,
    playbook,
    status,
    templateId: stringOrUndefined(input.templateId),
    inputSchema,
  };
}

function normalizePlaybook(input: Array<Partial<AgentPlaybookStep>> | undefined): AgentPlaybookStep[] | undefined {
  if (!input) return undefined;
  if (!Array.isArray(input)) return [];
  const cleaned: AgentPlaybookStep[] = [];
  for (const entry of input.slice(0, 20)) {
    const title = String(entry?.title ?? "").trim();
    if (!title) continue;
    const instruction = String(entry?.instruction ?? "").trim();
    cleaned.push({
      id: stringOrUndefined(entry?.id) ?? generateId(),
      title: title.slice(0, 120),
      instruction: instruction.slice(0, 600),
    });
  }
  return cleaned;
}

const FIELD_TYPES: AgentInputFieldType[] = ["string", "number", "boolean", "url", "enum"];

function normalizeInputSchema(raw: unknown): AgentInputField[] {
  if (!Array.isArray(raw)) return [];
  const seenKeys = new Set<string>();
  const fields: AgentInputField[] = [];

  for (const candidate of raw.slice(0, 12)) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as Record<string, unknown>;
    const key = String(item.key ?? "").trim();
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) {
      throw httpError(400, "input field keys must be 1-40 chars of letters, numbers, or underscores");
    }
    if (seenKeys.has(key)) throw httpError(400, `duplicate input field key: ${key}`);
    seenKeys.add(key);

    const type = FIELD_TYPES.includes(item.type as AgentInputFieldType) ? (item.type as AgentInputFieldType) : "string";
    const label = String(item.label ?? "").trim() || key;
    const description = stringOrUndefined(item.description);
    const required = Boolean(item.required);
    const defaultValue = stringOrUndefined(item.defaultValue);
    let options: string[] | undefined;
    if (type === "enum") {
      options = Array.isArray(item.options)
        ? item.options.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 16)
        : [];
      if (!options.length) throw httpError(400, `enum field "${key}" requires at least one option`);
    }

    fields.push({ key, label, type, required, description, options, defaultValue });
  }

  return fields;
}

function validateAgentInputs(schema: AgentInputField[], raw: Record<string, unknown>): Record<string, string | number | boolean> {
  const inputs: Record<string, string | number | boolean> = {};

  for (const field of schema) {
    const provided = raw[field.key];
    const hasValue = provided !== undefined && provided !== null && String(provided).length > 0;

    if (!hasValue) {
      if (field.defaultValue !== undefined && field.defaultValue !== "") {
        inputs[field.key] = coerceInputValue(field, field.defaultValue);
        continue;
      }
      if (field.required) throw httpError(400, `input ${field.key} is required`);
      continue;
    }

    inputs[field.key] = coerceInputValue(field, provided);
  }

  return inputs;
}

function coerceInputValue(field: AgentInputField, value: unknown): string | number | boolean {
  switch (field.type) {
    case "number": {
      const next = Number(value);
      if (!Number.isFinite(next)) throw httpError(400, `input ${field.key} must be a number`);
      return next;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const text = String(value).trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(text)) return true;
      if (["false", "0", "no", "off", ""].includes(text)) return false;
      throw httpError(400, `input ${field.key} must be a boolean`);
    }
    case "url": {
      const text = String(value).trim();
      try {
        const url = new URL(text);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("scheme");
      } catch {
        throw httpError(400, `input ${field.key} must be a valid http(s) URL`);
      }
      return text;
    }
    case "enum": {
      const text = String(value).trim();
      if (!field.options?.includes(text)) {
        throw httpError(400, `input ${field.key} must be one of: ${(field.options ?? []).join(", ")}`);
      }
      return text;
    }
    default:
      return String(value);
  }
}

function formatInputValue(value: string | number | boolean): string {
  if (typeof value === "string" && value.length > 80) return `${value.slice(0, 77)}...`;
  return String(value);
}

function buildRunOutput(agentName: string, inputs: Record<string, string | number | boolean>): string {
  const inputSummary = Object.keys(inputs).length === 0
    ? "no inputs"
    : Object.entries(inputs).map(([key, value]) => `${key}=${formatInputValue(value)}`).join(", ");
  return `${agentName} simulated run completed with ${inputSummary}.`;
}

function validateProvider(data: ReturnType<typeof loadStore>, workspaceId: string, providerId?: string) {
  if (!providerId) return;
  const provider = findProvider(data, providerId);
  if (!provider || provider.workspaceId !== workspaceId) {
    throw httpError(400, "provider does not exist in this workspace");
  }
}

function isProviderReadyForAgentRuns(data: TaskloomData, workspaceId: string, provider: ProviderRecord): boolean {
  if (provider.status === "disabled") return false;
  const apiKeyProvider = apiKeyProviderForKind(provider.kind);
  if (!apiKeyProvider || provider.kind === "ollama") return true;
  return provider.apiKeyConfigured || data.apiKeys.some((key) => key.workspaceId === workspaceId && key.provider === apiKeyProvider);
}

function buildIntegrationReadinessSummary(data: TaskloomData, workspaceId: string): IntegrationReadinessSummary {
  const tools = listDefaultToolSummaries();
  const toolNames = [...new Set(tools.map((tool) => tool.name))].sort();
  const generatedPlanTools = [...new Set(AGENT_TEMPLATES.flatMap((template) => template.tools))].sort();
  const missingForGeneratedPlans = generatedPlanTools.filter((tool) => !toolNames.includes(tool));

  const providers = data.providers.filter((provider) => provider.workspaceId === workspaceId);
  const apiKeys = new Set(
    data.apiKeys
      .filter((key) => key.workspaceId === workspaceId)
      .map((key) => key.provider),
  );
  const providerKinds = new Set(providers.map((provider) => provider.kind));

  const providerReadiness = providers.map((provider) => {
    const apiKeyProvider = apiKeyProviderForKind(provider.kind);
    const requiresApiKey = Boolean(apiKeyProvider && provider.kind !== "ollama");
    const hasVaultKey = apiKeyProvider ? apiKeys.has(apiKeyProvider) : false;
    const apiKeyReady = !requiresApiKey || provider.apiKeyConfigured || hasVaultKey;
    return {
      provider,
      apiKeyProvider,
      ready: provider.status !== "disabled" && apiKeyReady,
      apiKeyReady,
      requiresApiKey,
    };
  });

  const missingProviderKinds = DEFAULT_WORKSPACE_PROVIDER_KINDS.filter((kind) => !providerKinds.has(kind));
  const missingApiKeys = providerReadiness
    .filter((entry) => entry.apiKeyProvider && entry.requiresApiKey && !entry.apiKeyReady && entry.provider.status !== "disabled")
    .map((entry) => ({
      provider: entry.apiKeyProvider as ApiKeyProvider,
      providerName: entry.provider.name,
    }));

  const recommendedSetup: string[] = [];
  if (providers.length === 0) {
    recommendedSetup.push("Add a workspace provider so generated agents have a model target.");
  }
  if (missingProviderKinds.length > 0) {
    recommendedSetup.push(`Add provider records for ${missingProviderKinds.join(", ")} if generated plans should target them.`);
  }
  if (missingApiKeys.length > 0) {
    recommendedSetup.push(`Store vault keys or mark external key readiness for ${missingApiKeys.map((entry) => entry.providerName).join(", ")}.`);
  }
  if (missingForGeneratedPlans.length > 0) {
    recommendedSetup.push(`Back generated plan tools with runtime adapters or replace labels: ${missingForGeneratedPlans.slice(0, 8).join(", ")}.`);
  }
  if (recommendedSetup.length === 0) {
    recommendedSetup.push("Generated agent plans have provider, API key, and runtime tool coverage.");
  }

  const readyCount = providerReadiness.filter((entry) => entry.ready).length;
  const status = readyCount > 0 && missingApiKeys.length === 0 && missingForGeneratedPlans.length === 0
    ? "ready"
    : "needs_setup";

  return {
    status,
    tools: {
      availableCount: toolNames.length,
      readCount: tools.filter((tool) => tool.side === "read").length,
      writeCount: tools.filter((tool) => tool.side === "write").length,
      execCount: tools.filter((tool) => tool.side === "exec").length,
      names: toolNames,
      missingForGeneratedPlans,
    },
    providers: {
      configuredCount: providers.length,
      readyCount,
      missingProviderKinds,
      missingApiKeys,
    },
    recommendedSetup,
  };
}

function apiKeyProviderForKind(kind: ProviderKind): ApiKeyProvider | null {
  return (DEFAULT_WORKSPACE_PROVIDER_KINDS as ProviderKind[]).includes(kind) ? (kind as ApiKeyProvider) : null;
}

function normalizeProviderInput(input: ProviderInput) {
  const name = String(input.name ?? "").trim();
  if (name.length < 2) throw httpError(400, "provider name must be at least 2 characters");
  const defaultModel = String(input.defaultModel ?? "").trim();
  if (defaultModel.length < 2) throw httpError(400, "default model is required");
  const kind = input.kind && ["openai", "anthropic", "minimax", "azure_openai", "ollama", "custom"].includes(input.kind)
    ? input.kind
    : "custom";
  const apiKeyConfigured = Boolean(input.apiKeyConfigured);
  const status = input.status && ["connected", "missing_key", "disabled"].includes(input.status)
    ? input.status
    : apiKeyConfigured || kind === "ollama" ? "connected" : "missing_key";

  return {
    name,
    kind,
    defaultModel,
    baseUrl: stringOrUndefined(input.baseUrl),
    apiKeyConfigured,
    status,
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function createSessionRecord(userId: string, timestamp: string) {
  const sessionId = generateId();
  const sessionSecret = generateSessionSecret();
  return {
    record: {
      id: sessionId,
      userId,
      secretHash: hashSessionSecret(sessionSecret),
      createdAt: timestamp,
      lastAccessedAt: timestamp,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    },
    cookieValue: buildSessionCookieValue(sessionId, sessionSecret),
  };
}

function buildAuthenticatedContext(data: ReturnType<typeof loadStore>, userId: string): AuthenticatedContext {
  const user = data.users.find((entry) => entry.id === userId);
  if (!user) throw httpError(404, "user not found");
  const workspaceId = defaultWorkspaceIdForUser(data, userId);
  const workspace = data.workspaces.find((entry) => entry.id === workspaceId);
  if (!workspace) throw httpError(404, "workspace not found");
  const membership = data.memberships.find((entry) => entry.workspaceId === workspace.id && entry.userId === user.id);
  return { user, workspace, role: membership?.role ?? "viewer" };
}

async function syncWorkspaceActivation(
  workspaceId: string,
  emitActivity: boolean,
  actor: ActivityRecord["actor"],
): Promise<ActivationStatusDto> {
  const status = await readActivationStatus(
    {
      signals: {
        loadSnapshot: async () => snapshotForWorkspace(await loadStoreAsync(), workspaceId),
      },
      milestones: {
        listForSubject: async () => (await loadStoreAsync()).activationMilestones[workspaceId] ?? [],
      },
      derive: deriveActivationStatus,
      readModel: {
        save: async (nextStatus) => {
          await mutateStoreAsync((data) => {
            const previous = data.activationReadModels[workspaceId];
            data.activationReadModels[workspaceId] = nextStatus;
            data.activationMilestones[workspaceId] = nextStatus.milestones;

            if (emitActivity) {
              emitActivationActivities(data, workspaceId, previous, nextStatus, actor);
            }
          });
        },
        load: async () => (await loadStoreAsync()).activationReadModels[workspaceId] ?? null,
      },
    },
    { subject: toSubject(workspaceId) },
  );

  return status.status;
}

function emitActivationActivities(
  data: ReturnType<typeof loadStore>,
  workspaceId: string,
  previous: ActivationStatusDto | undefined,
  nextStatus: ActivationStatusDto,
  actor: ActivityRecord["actor"],
) {
  const timestamp = now();

  if (!previous || previous.stage !== nextStatus.stage) {
    recordActivity(data, makeActivity(workspaceId, "activation", "activation.stage_changed", actor, {
      title: `Activation stage is now ${nextStatus.stage}`,
      previousStage: previous?.stage,
      stage: nextStatus.stage,
    }, timestamp));
  }

  const previousMilestones = new Set((previous?.milestones ?? []).filter((entry) => entry.reached).map((entry) => entry.key));
  for (const milestone of nextStatus.milestones.filter((entry) => entry.reached && !previousMilestones.has(entry.key))) {
    recordActivity(data, makeActivity(workspaceId, "activation", "activation.milestone_reached", actor, {
      title: `Reached milestone: ${milestone.key}`,
      milestoneKey: milestone.key,
      stage: nextStatus.stage,
    }, milestone.reachedAt ?? timestamp));
  }

  const previousChecklist = new Set((previous?.checklist ?? []).filter((entry) => entry.completed).map((entry) => entry.key));
  for (const item of nextStatus.checklist.filter((entry) => entry.completed && !previousChecklist.has(entry.key))) {
    recordActivity(data, makeActivity(workspaceId, "activation", "activation.checklist_completed", actor, {
      title: `Checklist completed: ${item.key}`,
      checklistItemKey: item.key,
    }, item.completedAt ?? timestamp));
  }
}

function applyOnboardingStepToFacts(facts: any, stepKey: string, timestamp: string) {
  switch (stepKey) {
    case "create_workspace_profile":
      facts.briefCapturedAt ??= timestamp;
      break;
    case "define_requirements":
      facts.requirementsDefinedAt ??= timestamp;
      break;
    case "define_plan":
      facts.planDefinedAt ??= timestamp;
      break;
    case "start_implementation":
      facts.implementationStartedAt ??= timestamp;
      facts.startedAt ??= timestamp;
      break;
    case "validate":
      facts.testsPassedAt ??= timestamp;
      facts.validationPassedAt ??= timestamp;
      facts.completedAt ??= timestamp;
      break;
    case "confirm_release":
      facts.releaseConfirmedAt ??= timestamp;
      facts.releasedAt ??= timestamp;
      break;
  }
}

const workspaceRoles = new Set<WorkspaceRole>(["viewer", "member", "admin", "owner"]);

function parseWorkspaceRole(role: string): WorkspaceRole {
  if (!workspaceRoles.has(role as WorkspaceRole)) throw httpError(400, "valid workspace role is required");
  return role as WorkspaceRole;
}

function assertCanManageRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole) {
  if (targetRole === "owner" && actorRole !== "owner") {
    throw httpError(403, "workspace role owner is required");
  }
}

function assertNotLastOwner(
  data: ReturnType<typeof loadStore>,
  workspaceId: string,
  currentMembership: WorkspaceMemberRecord,
  nextRole: WorkspaceRole | null,
) {
  if (currentMembership.role !== "owner" || nextRole === "owner") return;
  const ownerCount = data.memberships.filter((entry) => entry.workspaceId === workspaceId && entry.role === "owner").length;
  if (ownerCount <= 1) throw httpError(400, "workspace must keep at least one owner");
}

function summarizeWorkspaceMember(data: ReturnType<typeof loadStore>, membership: WorkspaceMemberRecord) {
  const user = data.users.find((entry) => entry.id === membership.userId);
  return {
    userId: membership.userId,
    email: user?.email ?? "",
    displayName: user?.displayName ?? "Unknown user",
    role: membership.role,
    joinedAt: membership.joinedAt,
  };
}

function summarizeWorkspaceInvitation(
  invitation: WorkspaceInvitationRecord,
  options: { includeToken?: boolean } = {},
) {
  const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    ...(options.includeToken ? { token: invitation.token } : {}),
    tokenPreview: maskBearerSecret(invitation.token),
    invitedByUserId: invitation.invitedByUserId,
    acceptedByUserId: invitation.acceptedByUserId ?? null,
    acceptedAt: invitation.acceptedAt ?? null,
    revokedAt: invitation.revokedAt ?? null,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    status: invitation.acceptedAt ? "accepted" : invitation.revokedAt ? "revoked" : expired ? "expired" : "pending",
  };
}

function redactActivity(activity: ActivityRecord): ActivityRecord {
  return {
    ...activity,
    data: redactSensitiveValue(activity.data) as ActivityRecord["data"],
  };
}

async function recordWorkspaceInvitationEmailDelivery(
  context: AuthenticatedContext,
  invitation: WorkspaceInvitationRecord,
  action: InvitationEmailDeliveryAction,
  options: { enqueueRetry?: boolean } = {},
) {
  return recordInvitationEmailDeliveryForWorkspace({
    workspace: context.workspace,
    actor: { type: "user", id: context.user.id, displayName: context.user.displayName },
    requestedByUserId: context.user.id,
    invitation,
    action,
    enqueueRetry: options.enqueueRetry ?? true,
  });
}

async function recordInvitationEmailDeliveryForWorkspace(input: {
  workspace: WorkspaceRecord;
  actor: ActivityRecord["actor"];
  requestedByUserId?: string;
  invitation: WorkspaceInvitationRecord;
  action: InvitationEmailDeliveryAction;
  enqueueRetry: boolean;
}) {
  const delivery = await mutateStoreAsync((data) => {
    return deliverInvitationEmail(data, {
      action: input.action,
      workspaceId: input.invitation.workspaceId,
      workspaceName: input.workspace.name,
      invitationId: input.invitation.id,
      email: input.invitation.email,
      token: input.invitation.token,
      subject: invitationEmailSubject(input.workspace.name),
    });
  });

  const retryJob = input.enqueueRetry && delivery.status === "failed" && resolveInvitationEmailMode() === "webhook"
    ? await enqueueInvitationEmailRetryJob(input)
    : null;

  await mutateStoreAsync((data) => {
    recordActivity(data, makeActivity(input.invitation.workspaceId, "workspace", "workspace.invitation_email_delivery", input.actor, {
      title: delivery.status === "sent" ? `Invitation email sent to ${input.invitation.email}` : `Invitation email ${delivery.status} for ${input.invitation.email}`,
      invitationId: input.invitation.id,
      email: input.invitation.email,
      role: input.invitation.role,
      action: input.action,
      deliveryId: delivery.id,
      status: delivery.status,
      ...(delivery.error ? { error: delivery.error } : {}),
      ...(retryJob ? { retryJobId: retryJob.id } : {}),
    }, new Date().toISOString()));
  });

  return {
    id: delivery.id,
    status: delivery.status,
    action: input.action,
    error: delivery.error ?? null,
    retryJobId: retryJob?.id ?? null,
  };
}

export async function handleInvitationEmailJob(job: JobRecord) {
  if (job.type !== INVITATION_EMAIL_JOB_TYPE) throw new Error(`unsupported invitation email job type "${job.type}"`);
  const payload = job.payload as { invitationId?: unknown; action?: unknown; requestedByUserId?: unknown };
  if (typeof payload.invitationId !== "string" || !payload.invitationId.trim()) throw new Error("invitation.email job missing invitationId");
  if (payload.action !== "create" && payload.action !== "resend") throw new Error("invitation.email job missing action");

  const data = await loadStoreAsync();
  const invitation = data.workspaceInvitations.find((entry) => entry.id === payload.invitationId && entry.workspaceId === job.workspaceId);
  if (!invitation) throw new Error(`invitation ${payload.invitationId} not found`);
  const workspace = data.workspaces.find((entry) => entry.id === job.workspaceId);
  if (!workspace) throw new Error(`workspace ${job.workspaceId} not found`);

  const actorUser = typeof payload.requestedByUserId === "string"
    ? data.users.find((entry) => entry.id === payload.requestedByUserId)
    : undefined;
  const actor = actorUser
    ? { type: "user" as const, id: actorUser.id, displayName: actorUser.displayName }
    : { type: "system" as const, id: "invitation-email-retry", displayName: "Invitation email retry" };

  const inactiveReason = inactiveInvitationRetryReason(invitation);
  if (inactiveReason) return recordSkippedInvitationEmailRetry(workspace, actor, invitation, payload.action, inactiveReason);

  const delivery = await recordInvitationEmailDeliveryForWorkspace({
    workspace,
    actor,
    requestedByUserId: actorUser?.id,
    invitation: { ...invitation },
    action: payload.action,
    enqueueRetry: false,
  });
  if (delivery.status === "failed") throw new Error(delivery.error ?? "invitation email delivery failed");
  return delivery;
}

function inactiveInvitationRetryReason(invitation: WorkspaceInvitationRecord): string | null {
  if (invitation.revokedAt) return "invitation was revoked before email retry";
  if (invitation.acceptedAt) return "invitation was accepted before email retry";
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return "invitation expired before email retry";
  return null;
}

async function recordSkippedInvitationEmailRetry(
  workspace: WorkspaceRecord,
  actor: ActivityRecord["actor"],
  invitation: WorkspaceInvitationRecord,
  action: InvitationEmailDeliveryAction,
  reason: string,
) {
  const timestamp = now();
  const mode = resolveInvitationEmailMode();
  const provider = mode === "webhook" ? resolveInvitationEmailWebhookConfig().provider : LOCAL_INVITATION_EMAIL_PROVIDER;
  const delivery = await mutateStoreAsync((data) => {
    const record = createInvitationEmailDelivery(data, {
      workspaceId: invitation.workspaceId,
      invitationId: invitation.id,
      recipientEmail: invitation.email,
      subject: invitationEmailSubject(workspace.name),
      status: "skipped",
      provider,
      mode,
      error: reason,
    }, timestamp);
    recordActivity(data, makeActivity(invitation.workspaceId, "workspace", "workspace.invitation_email_delivery", actor, {
      title: `Invitation email skipped for ${invitation.email}`,
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      action,
      deliveryId: record.id,
      status: record.status,
      error: reason,
    }, timestamp));
    return record;
  });

  return { id: delivery.id, status: delivery.status, action, error: delivery.error ?? null, retryJobId: null };
}

async function enqueueInvitationEmailRetryJob(input: {
  invitation: WorkspaceInvitationRecord;
  action: InvitationEmailDeliveryAction;
  requestedByUserId?: string;
}): Promise<JobRecord> {
  const timestamp = now();
  return mutateStoreAsync((data) => {
    const record: JobRecord = {
      id: generateId(),
      workspaceId: input.invitation.workspaceId,
      type: INVITATION_EMAIL_JOB_TYPE,
      payload: {
        invitationId: input.invitation.id,
        action: input.action,
        ...(input.requestedByUserId ? { requestedByUserId: input.requestedByUserId } : {}),
      },
      status: "queued",
      attempts: 0,
      maxAttempts: resolveInvitationEmailRetryMaxAttempts(),
      scheduledAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    data.jobs.push(record);
    return record;
  });
}

export function requireAuthenticatedContext(c: Context): AuthenticatedContext {
  const context = restoreSession(c);
  if (!context) throw httpError(401, "authentication required");
  return context;
}

export async function requireAuthenticatedContextAsync(c: Context): Promise<AuthenticatedContext> {
  const context = await restoreSessionAsync(c);
  if (!context) throw httpError(401, "authentication required");
  return context;
}

export function applySessionCookie(c: Context, cookieValue: string) {
  setCookie(c, SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
}

export function toSubject(workspaceId: string): ActivationSubjectRef {
  return { workspaceId, subjectType: "workspace", subjectId: workspaceId };
}

function activationSignalStableKey(
  workspaceId: string,
  kind: ActivationSignalRecord["kind"],
  source: ActivationSignalRecord["source"],
  sourceId: string,
): string {
  return `${workspaceId}:${kind}:${source}:${sourceId}`;
}

function activationActivityId(workspaceId: string, event: string, signalId: string): string {
  return `activity_${stableIdPart(workspaceId)}_${stableIdPart(event)}_${stableIdPart(signalId)}`;
}

function stableIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function upsertActivationActivity(data: TaskloomData, activity: ActivityRecord): ActivityRecord {
  return recordActivity(data, activity, { dedupe: true });
}

function makeActivity(
  workspaceId: string,
  scope: ActivityRecord["scope"],
  event: string,
  actor: ActivityRecord["actor"],
  data: ActivityRecord["data"],
  timestamp: string,
  id = generateId(),
): ActivityRecord {
  return {
    id,
    workspaceId,
    scope,
    event,
    actor,
    data,
    occurredAt: timestamp,
  };
}

export function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
