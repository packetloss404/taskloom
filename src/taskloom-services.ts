import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { readActivationStatus } from "./activation/api";
import type { ActivationMilestoneRecord, ActivationStatusDto, ActivationSubjectRef } from "./activation/domain";
import { deriveActivationStatus } from "./activation/service";
import { buildActivationSummaryCard } from "./activation/view-model";
import {
  defaultWorkspaceIdForUser,
  deleteWorkspaceEnvVar,
  findAgent,
  findProvider,
  findWorkspaceEnvVar,
  listAgentRunsForAgent,
  listAgentRunsForWorkspace,
  listAgentsForWorkspace,
  listProvidersForWorkspace,
  listReleaseConfirmationsForWorkspace,
  listWorkspaceEnvVars,
  loadStore,
  mutateStore,
  nextIncompleteStep,
  type ActivityRecord,
  type AgentInputField,
  type AgentInputFieldType,
  type AgentPlaybookStep,
  type AgentRecord,
  type AgentRunLogEntry,
  type AgentRunRecord,
  type AgentRunStep,
  type AgentStatus,
  type AgentTriggerKind,
  type ProviderKind,
  type WorkspaceEnvVarRecord,
  type WorkspaceEnvVarScope,
  ONBOARDING_STEPS,
  snapshotForWorkspace,
  upsertAgent,
  upsertAgentRun,
  upsertProvider,
  upsertWorkspaceEnvVar,
} from "./taskloom-store";
import { AGENT_TEMPLATES, findAgentTemplate } from "./agent-templates.js";
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
};

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

  const data = loadStore();
  const session = data.sessions.find((entry) => entry.id === parsed.sessionId);
  if (!session) return null;
  if (session.secretHash !== hashSessionSecret(parsed.secret)) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  session.lastAccessedAt = now();
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
  const data = loadStore();
  return data.activities.filter((entry) => entry.workspaceId === context.workspace.id).slice(0, 50);
}

export function getWorkspaceActivityDetail(context: AuthenticatedContext, activityId: string) {
  const activities = listWorkspaceActivities(context);
  const index = activities.findIndex((entry) => entry.id === activityId);
  if (index === -1) throw httpError(404, "activity not found");

  return {
    activity: activities[index],
    previous: index > 0 ? activities[index - 1] : null,
    next: index < activities.length - 1 ? activities[index + 1] : null,
  };
}

export function listAgents(context: AuthenticatedContext) {
  const data = loadStore();
  return {
    agents: listAgentsForWorkspace(data, context.workspace.id).map((agent) => decorateAgent(data, agent)),
  };
}

export function getAgent(context: AuthenticatedContext, agentId: string) {
  const data = loadStore();
  const agent = findAgent(data, agentId);
  if (!agent || agent.workspaceId !== context.workspace.id || agent.status === "archived") {
    throw httpError(404, "agent not found");
  }

  return {
    agent: decorateAgent(data, agent),
    runs: listAgentRunsForAgent(data, context.workspace.id, agent.id).slice(0, 20),
  };
}

export function createAgent(context: AuthenticatedContext, input: AgentInput) {
  const normalized = normalizeAgentInput(input);
  const timestamp = now();

  return mutateStore((data) => {
    validateProvider(data, context.workspace.id, normalized.providerId);

    const agent = upsertAgent(data, {
      workspaceId: context.workspace.id,
      name: normalized.name,
      description: normalized.description,
      instructions: normalized.instructions,
      providerId: normalized.providerId,
      model: normalized.model,
      tools: normalized.tools,
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
}

export function updateAgent(context: AuthenticatedContext, agentId: string, input: Partial<AgentInput>) {
  const timestamp = now();

  return mutateStore((data) => {
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
}

export function archiveAgent(context: AuthenticatedContext, agentId: string) {
  const timestamp = now();

  return mutateStore((data) => {
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
}

export function runAgent(
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

  return mutateStore((data) => {
    const agent = findAgent(data, agentId);
    if (!agent || agent.workspaceId !== context.workspace.id || agent.status === "archived") {
      throw httpError(404, "agent not found");
    }

    const inputs = validateAgentInputs(agent.inputSchema ?? [], rawInputs);
    const provider = agent.providerId ? findProvider(data, agent.providerId) : null;
    const providerReady = !provider || provider.status === "connected";
    const transcript = buildRunTranscript(agent.playbook ?? [], providerReady, timestamp);

    const logs: AgentRunLogEntry[] = [
      { at: timestamp, level: "info", message: `Run started for ${agent.name}.` },
    ];
    if (provider) {
      logs.push({
        at: timestamp,
        level: providerReady ? "info" : "warn",
        message: `Provider ${provider.name} status: ${provider.status}.`,
      });
    }
    for (const field of agent.inputSchema ?? []) {
      if (field.key in inputs) {
        logs.push({ at: timestamp, level: "info", message: `Input ${field.key} = ${formatInputValue(inputs[field.key])}` });
      }
    }
    if (providerReady) {
      logs.push({ at: timestamp, level: "info", message: "Run recorded locally. Attach an execution adapter to perform real work." });
    } else {
      logs.push({ at: timestamp, level: "error", message: "Provider API key is not configured." });
    }

    const output = providerReady ? buildRunOutput(agent.name, inputs) : undefined;

    const run = upsertAgentRun(data, {
      workspaceId: context.workspace.id,
      agentId: agent.id,
      title: providerReady ? `${agent.name} run completed` : `${agent.name} run failed`,
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.run", {
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
  const data = loadStore();
  return { providers: listProvidersForWorkspace(data, context.workspace.id) };
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
  const data = loadStore();
  return { runs: listAgentRunsForWorkspace(data, context.workspace.id).slice(0, 50).map(decorateRun) };
}

export function cancelAgentRun(context: AuthenticatedContext, runId: string) {
  const timestamp = now();
  return mutateStore((data) => {
    const run = data.agentRuns.find((entry) => entry.id === runId);
    if (!run || run.workspaceId !== context.workspace.id) {
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

    data.activities.unshift(makeActivity(context.workspace.id, "workspace", "agent.run_canceled", {
      type: "user",
      id: context.user.id,
      displayName: context.user.displayName,
    }, { title: `Run canceled: ${updated.title}`, agentId: updated.agentId, runId: updated.id }, timestamp));

    return { run: decorateRun(updated) };
  });
}

export function retryAgentRun(context: AuthenticatedContext, runId: string) {
  const data = loadStore();
  const previous = data.agentRuns.find((entry) => entry.id === runId);
  if (!previous || previous.workspaceId !== context.workspace.id) {
    throw httpError(404, "agent run not found");
  }
  if (!previous.agentId) {
    throw httpError(400, "this run is not linked to an agent and cannot be retried");
  }
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

function decorateAgent(data: ReturnType<typeof loadStore>, agent: AgentRecord) {
  const provider = agent.providerId ? findProvider(data, agent.providerId) : null;
  return {
    ...agent,
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
  Pick<AgentRecord, "providerId" | "model" | "schedule" | "triggerKind" | "playbook" | "templateId"> {
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

  return {
    name,
    description,
    instructions,
    providerId: stringOrUndefined(input.providerId),
    model: stringOrUndefined(input.model),
    tools: tools.slice(0, 12),
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
  return { user, workspace };
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

function makeActivity(
  workspaceId: string,
  scope: ActivityRecord["scope"],
  event: string,
  actor: ActivityRecord["actor"],
  data: ActivityRecord["data"],
  timestamp: string,
): ActivityRecord {
  return {
    id: generateId(),
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
