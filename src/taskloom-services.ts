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
  mutateStore,
  persistStore,
  nextIncompleteStep,
  type ActivityRecord,
  type ActivationSignalRecord,
  type AgentInputField,
  type AgentInputFieldType,
  type AgentPlaybookStep,
  type AgentRecord,
  type AgentRunLogEntry,
  type AgentRunRecord,
  type AgentRunStep,
  type AgentStatus,
  type AgentTriggerKind,
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
import { LOCAL_INVITATION_EMAIL_PROVIDER, invitationEmailSubject, resolveInvitationEmailMode, resolveInvitationEmailRetryMaxAttempts, resolveInvitationEmailWebhookConfig } from "./invitation-email.js";
import { deliverInvitationEmail, type InvitationEmailDeliveryAction } from "./invitation-email-delivery.js";
import { enqueueJob, maintainScheduledAgentJobs } from "./jobs/store.js";
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

export const INVITATION_EMAIL_JOB_TYPE = "invitation.email";

export async function listPublicActivationSummaries() {
  const data = loadStore();
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
  const data = loadStore();
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
    data.activities.unshift(makeActivity(workspaceId, "account", "account.created", { type: "user", id: userId, displayName }, { title: `Account created for ${displayName}` }, timestamp));
    data.activities.unshift(makeActivity(workspaceId, "workspace", "workspace.created", { type: "user", id: userId, displayName }, { title: `Workspace ${workspaceName} created` }, timestamp));

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

export function logout(c: Context) {
  const parsed = parseSessionCookieValue(getCookie(c, SESSION_COOKIE_NAME) ?? "");
  if (parsed) {
    mutateStore((data) => {
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

export async function getPrivateBootstrap(context: AuthenticatedContext) {
  const status = await syncWorkspaceActivation(context.workspace.id, false, { type: "system", id: "bootstrap" });
  const data = loadStore();
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

export async function updateProfile(
  context: AuthenticatedContext,
  input: { displayName: string; timezone: string },
) {
  if (input.displayName.trim().length < 2) throw httpError(400, "display name must be at least 2 characters");
  if (!input.timezone.trim()) throw httpError(400, "timezone is required");

  return mutateStore((data) => {
    const user = data.users.find((entry) => entry.id === context.user.id);
    if (!user) throw httpError(404, "user not found");
    user.displayName = input.displayName.trim();
    user.timezone = input.timezone.trim();
    user.updatedAt = now();
    data.activities.unshift(makeActivity(context.workspace.id, "account", "account.profile_updated", { type: "user", id: user.id, displayName: user.displayName }, { title: "Profile updated" }, user.updatedAt));
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

  const result = mutateStore((data) => {
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

    data.activities.unshift(makeActivity(workspace.id, "workspace", "workspace.updated", { type: "user", id: context.user.id, displayName: context.user.displayName }, { title: "Workspace settings updated" }, workspace.updatedAt));
    return workspace;
  });

  await syncWorkspaceActivation(context.workspace.id, true, { type: "user", id: context.user.id, displayName: context.user.displayName });
  return result;
}

export function listWorkspaceMembers(context: AuthenticatedContext) {
  const data = loadStore();
  const canViewInvitationTokens = context.role === "admin" || context.role === "owner";
  return {
    members: listWorkspaceMembershipsIndexed(context.workspace.id)
      .map((membership) => summarizeWorkspaceMember(data, membership))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    invitations: listWorkspaceInvitationsIndexed(context.workspace.id)
      .map((invitation) => summarizeWorkspaceInvitation(invitation, { includeToken: canViewInvitationTokens })),
  };
}

export async function createWorkspaceInvitation(context: AuthenticatedContext, input: { email: string; role: string }) {
  const email = normalizeEmail(input.email);
  const role = parseWorkspaceRole(input.role);
  if (!email.includes("@")) throw httpError(400, "valid email is required");
  assertCanManageRole(context.role, role);

  const result = mutateStore((data) => {
    const existingUser = findUserByEmailIndexed(email);
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "workspace.invitation_created", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Invitation created for ${email}`, email, role }, timestamp));

    return { invitation: summarizeWorkspaceInvitation(invitation), invitationRecord: { ...invitation } };
  });

  const emailDelivery = await recordWorkspaceInvitationEmailDelivery(context, result.invitationRecord, "create");
  return { invitation: result.invitation, emailDelivery };
}

export function acceptWorkspaceInvitation(context: AuthenticatedContext, token: string) {
  if (!token.trim()) throw httpError(400, "invitation token is required");

  return mutateStore((data) => {
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

    data.activities.unshift(makeActivity(invitation.workspaceId, "workspace", "workspace.invitation_accepted", {
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

  const result = mutateStore((data) => {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "workspace.invitation_resent", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Invitation resent for ${invitation.email}`, email: invitation.email, role: invitation.role }, timestamp));

    return { invitation: summarizeWorkspaceInvitation(invitation), invitationRecord: { ...invitation } };
  });

  const emailDelivery = await recordWorkspaceInvitationEmailDelivery(context, result.invitationRecord, "resend");
  return { invitation: result.invitation, emailDelivery };
}

export function revokeWorkspaceInvitation(context: AuthenticatedContext, invitationId: string) {
  if (!invitationId.trim()) throw httpError(400, "invitation id is required");

  return mutateStore((data) => {
    const invitation = data.workspaceInvitations.find((entry) => {
      return entry.id === invitationId.trim() && entry.workspaceId === context.workspace.id;
    });
    if (!invitation) throw httpError(404, "invitation not found");
    assertCanManageRole(context.role, invitation.role);
    if (invitation.acceptedAt) throw httpError(400, "invitation has already been accepted");
    if (invitation.revokedAt) throw httpError(400, "invitation has already been revoked");

    const timestamp = now();
    invitation.revokedAt = timestamp;

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "workspace.invitation_revoked", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Invitation revoked for ${invitation.email}`, email: invitation.email, role: invitation.role }, timestamp));

    return { invitation: summarizeWorkspaceInvitation(invitation) };
  });
}

export function updateWorkspaceMemberRole(context: AuthenticatedContext, userId: string, input: { role: string }) {
  const role = parseWorkspaceRole(input.role);
  assertCanManageRole(context.role, role);

  return mutateStore((data) => {
    const membership = findWorkspaceMembership(data, context.workspace.id, userId);
    if (!membership) throw httpError(404, "workspace member not found");
    assertCanManageRole(context.role, membership.role);
    assertNotLastOwner(data, context.workspace.id, membership, role);

    membership.role = role;
    const timestamp = now();
    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "workspace.member_role_updated", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: "Workspace member role updated", userId, role }, timestamp));

    return { member: summarizeWorkspaceMember(data, membership) };
  });
}

export function removeWorkspaceMember(context: AuthenticatedContext, userId: string) {
  return mutateStore((data) => {
    const membership = findWorkspaceMembership(data, context.workspace.id, userId);
    if (!membership) throw httpError(404, "workspace member not found");
    assertCanManageRole(context.role, membership.role);
    assertNotLastOwner(data, context.workspace.id, membership, null);

    data.memberships = data.memberships.filter((entry) => {
      return !(entry.workspaceId === context.workspace.id && entry.userId === userId);
    });
    const timestamp = now();
    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "workspace.member_removed", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: "Workspace member removed", userId }, timestamp));

    return { ok: true };
  });
}

export function getOnboarding(context: AuthenticatedContext) {
  const data = loadStore();
  const onboarding = data.onboardingStates.find((entry) => entry.workspaceId === context.workspace.id);
  if (!onboarding) throw httpError(404, "onboarding state not found");
  return onboarding;
}

export async function completeOnboardingStep(context: AuthenticatedContext, stepKey: string) {
  if (!ONBOARDING_STEPS.includes(stepKey as any)) {
    throw httpError(400, "unknown onboarding step");
  }

  const onboarding = mutateStore((data) => {
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

    data.activities.unshift(makeActivity(context.workspace.id, "activation", "onboarding.step_completed", { type: "user", id: context.user.id, displayName: context.user.displayName }, { title: `Completed step: ${stepKey}`, stepKey }, timestamp));
    return record;
  });

  await syncWorkspaceActivation(context.workspace.id, true, { type: "user", id: context.user.id, displayName: context.user.displayName });
  return onboarding;
}

export function listWorkspaceActivities(context: AuthenticatedContext) {
  return listActivitiesForWorkspaceIndexed(context.workspace.id, 50);
}

export function getWorkspaceActivityDetail(context: AuthenticatedContext, activityId: string) {
  const activities = listWorkspaceActivities(context);
  const index = activities.findIndex((entry) => entry.id === activityId);
  if (index === -1) throw httpError(404, "activity not found");

  const activity = activities[index];
  return {
    activity,
    previous: index > 0 ? activities[index - 1] : null,
    next: index < activities.length - 1 ? activities[index + 1] : null,
    related: buildActivityRelatedContext(context.workspace.id, activity),
  };
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

  const agent = agentId ? findAgentForWorkspaceIndexed(workspaceId, agentId) : undefined;
  if (agent) related.agent = summarizeAgent(agent);

  const run = runId ? findAgentRunForWorkspaceIndexed(workspaceId, runId) : undefined;
  if (run) related.run = summarizeAgentRun(run);

  const blocker = blockerId ? findWorkflowConcernForWorkspaceIndexed(workspaceId, blockerId, "blocker") : undefined;
  if (blocker) related.blocker = summarizeWorkflowConcern(blocker);

  const question = questionId ? findWorkflowConcernForWorkspaceIndexed(workspaceId, questionId, "open_question") : undefined;
  if (question) related.question = summarizeWorkflowConcern(question);

  const planItem = planItemId ? findImplementationPlanItemForWorkspaceIndexed(workspaceId, planItemId) : undefined;
  if (planItem) related.planItem = summarizePlanItem(planItem);

  const requirement = requirementId ? findRequirementForWorkspaceIndexed(workspaceId, requirementId) : undefined;
  if (requirement) related.requirement = summarizeRequirement(requirement);

  const evidence = evidenceId ? findValidationEvidenceForWorkspaceIndexed(workspaceId, evidenceId) : undefined;
  if (evidence) related.evidence = summarizeValidationEvidence(evidence);

  const release = releaseId ? findReleaseConfirmationForWorkspaceIndexed(workspaceId, releaseId) : undefined;
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
    runs: listAgentRunsForAgentIndexed(context.workspace.id, agent.id, 20),
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.created", {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.updated", {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.archived", {
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

  const data = loadStore();
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
    return { run };
  }

  return mutateStore((store) => {
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

    store.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.run", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: run.title, agentId: liveAgent.id, runId: run.id, status: run.status, triggerKind }, timestamp));

    return { run };
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

  return mutateStore((store) => {
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

    store.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.run", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: run.title, agentId: agent.id, runId: run.id, status: run.status, triggerKind }, timestamp));

    return { run };
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

export function listAgentTemplates() {
  return { templates: AGENT_TEMPLATES };
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

export function listProviders(context: AuthenticatedContext) {
  return { providers: listProvidersForWorkspaceIndexed(context.workspace.id) };
}

export function createProvider(context: AuthenticatedContext, input: ProviderInput) {
  const normalized = normalizeProviderInput(input);
  const timestamp = now();

  return mutateStore((data) => {
    const provider = upsertProvider(data, {
      workspaceId: context.workspace.id,
      ...normalized,
    }, timestamp);

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "provider.created", {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "provider.updated", {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.run_canceled", {
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
    return { agent };
  });
}

export async function retryAgentRun(context: AuthenticatedContext, runId: string) {
  const previous = findAgentRunForWorkspaceIndexed(context.workspace.id, runId);
  if (!previous) {
    throw httpError(404, "agent run not found");
  }
  if (!previous.agentId) {
    throw httpError(400, "this run is not linked to an agent and cannot be retried");
  }
  const timestamp = now();
  mutateStore((store) => {
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
    upsertActivationActivity(store.activities, makeActivity(context.workspace.id, "activation", "agent.run.retry", {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "env_var.created", {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "env_var.updated", {
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
    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "env_var.deleted", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Env var removed: ${existing.key}`, envVarId: existing.id }, timestamp));
    return { ok: true };
  });
}

export function listReleaseHistory(context: AuthenticatedContext) {
  const data = loadStore();
  const releases = listReleaseConfirmationsForWorkspace(data, context.workspace.id)
    .sort((left, right) => (right.confirmedAt ?? right.updatedAt).localeCompare(left.confirmedAt ?? left.updatedAt));

  const evidence = data.validationEvidence.filter((entry) => entry.workspaceId === context.workspace.id);
  const concerns = data.workflowConcerns.filter((entry) => entry.workspaceId === context.workspace.id);

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
  return {
    ...record,
    value: record.secret ? maskSecret(record.value) : record.value,
    valuePreview: record.secret ? maskSecret(record.value) : null,
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
  const responseAgent = opts.includeWebhookToken === false ? { ...agent, webhookToken: undefined } : agent;
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

function normalizeProviderInput(input: ProviderInput) {
  const name = String(input.name ?? "").trim();
  if (name.length < 2) throw httpError(400, "provider name must be at least 2 characters");
  const defaultModel = String(input.defaultModel ?? "").trim();
  if (defaultModel.length < 2) throw httpError(400, "default model is required");
  const kind = input.kind && ["openai", "anthropic", "azure_openai", "ollama", "custom"].includes(input.kind)
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
        loadSnapshot: async () => snapshotForWorkspace(loadStore(), workspaceId),
      },
      milestones: {
        listForSubject: async () => loadStore().activationMilestones[workspaceId] ?? [],
      },
      derive: deriveActivationStatus,
      readModel: {
        save: async (nextStatus) => {
          mutateStore((data) => {
            const previous = data.activationReadModels[workspaceId];
            data.activationReadModels[workspaceId] = nextStatus;
            data.activationMilestones[workspaceId] = nextStatus.milestones;

            if (emitActivity) {
              emitActivationActivities(data, workspaceId, previous, nextStatus, actor);
            }
          });
        },
        load: async () => loadStore().activationReadModels[workspaceId] ?? null,
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
    data.activities.unshift(makeActivity(workspaceId, "activation", "activation.stage_changed", actor, {
      title: `Activation stage is now ${nextStatus.stage}`,
      previousStage: previous?.stage,
      stage: nextStatus.stage,
    }, timestamp));
  }

  const previousMilestones = new Set((previous?.milestones ?? []).filter((entry) => entry.reached).map((entry) => entry.key));
  for (const milestone of nextStatus.milestones.filter((entry) => entry.reached && !previousMilestones.has(entry.key))) {
    data.activities.unshift(makeActivity(workspaceId, "activation", "activation.milestone_reached", actor, {
      title: `Reached milestone: ${milestone.key}`,
      milestoneKey: milestone.key,
      stage: nextStatus.stage,
    }, milestone.reachedAt ?? timestamp));
  }

  const previousChecklist = new Set((previous?.checklist ?? []).filter((entry) => entry.completed).map((entry) => entry.key));
  for (const item of nextStatus.checklist.filter((entry) => entry.completed && !previousChecklist.has(entry.key))) {
    data.activities.unshift(makeActivity(workspaceId, "activation", "activation.checklist_completed", actor, {
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
  options: { includeToken?: boolean } = { includeToken: true },
) {
  const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    ...(options.includeToken ? { token: invitation.token } : {}),
    invitedByUserId: invitation.invitedByUserId,
    acceptedByUserId: invitation.acceptedByUserId ?? null,
    acceptedAt: invitation.acceptedAt ?? null,
    revokedAt: invitation.revokedAt ?? null,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    status: invitation.acceptedAt ? "accepted" : invitation.revokedAt ? "revoked" : expired ? "expired" : "pending",
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
  const data = loadStore();
  const delivery = await deliverInvitationEmail(data, {
    action: input.action,
    workspaceId: input.invitation.workspaceId,
    workspaceName: input.workspace.name,
    invitationId: input.invitation.id,
    email: input.invitation.email,
    token: input.invitation.token,
    subject: invitationEmailSubject(input.workspace.name),
  });
  persistStore(data);

  const retryJob = input.enqueueRetry && delivery.status === "failed" && resolveInvitationEmailMode() === "webhook"
    ? enqueueJob({
      workspaceId: input.invitation.workspaceId,
      type: INVITATION_EMAIL_JOB_TYPE,
      payload: {
        invitationId: input.invitation.id,
        action: input.action,
        ...(input.requestedByUserId ? { requestedByUserId: input.requestedByUserId } : {}),
      },
      maxAttempts: resolveInvitationEmailRetryMaxAttempts(),
    })
    : null;

  mutateStore((data) => {
    data.activities.unshift(makeActivity(input.invitation.workspaceId, "workspace", "workspace.invitation_email_delivery", input.actor, {
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

  const data = loadStore();
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

function recordSkippedInvitationEmailRetry(
  workspace: WorkspaceRecord,
  actor: ActivityRecord["actor"],
  invitation: WorkspaceInvitationRecord,
  action: InvitationEmailDeliveryAction,
  reason: string,
) {
  const timestamp = now();
  const mode = resolveInvitationEmailMode();
  const provider = mode === "webhook" ? resolveInvitationEmailWebhookConfig().provider : LOCAL_INVITATION_EMAIL_PROVIDER;
  const delivery = mutateStore((data) => {
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
    data.activities.unshift(makeActivity(invitation.workspaceId, "workspace", "workspace.invitation_email_delivery", actor, {
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

export function requireAuthenticatedContext(c: Context): AuthenticatedContext {
  const context = restoreSession(c);
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

function upsertActivationActivity(activities: ActivityRecord[], activity: ActivityRecord): ActivityRecord {
  const existing = activities.find((entry) => entry.id === activity.id);
  if (existing) return existing;
  activities.unshift(activity);
  return activity;
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
