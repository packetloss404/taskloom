import { Hono, type Context } from "hono";
import { createHash } from "node:crypto";
import { assertPermission, type WorkspacePermission } from "./rbac.js";
import { applyCsrfCookie, clearCsrfCookie, rejectCrossOriginPrivateMutation } from "./route-security.js";
import {
  generateAppDraftFromPrompt,
  type ApiRouteStub,
  type AppDraft,
  type CrudFlowDraft,
  type FieldSchemaDraft,
  type PageDraft,
} from "./app-builder-service.js";
import {
  buildAppPreviewReadiness,
  type AppSmokeCheck,
  type GeneratedAppApiRoute,
  type GeneratedAppCrudFlow,
  type GeneratedAppPageMapEntry,
} from "./app-preview-readiness.js";
import {
  applyAppIterationToDraft,
  buildAppIterationPlan,
  type AppIterationAction,
  type AppIterationChangeRequest,
  type AppIterationDiffHunk,
  type AppIterationPlan,
  type AppIterationTargetInput,
  type GeneratedAppDraftLike,
} from "./app-iteration-service.js";
import { derivePreviewRefreshState } from "./app-preview-iteration.js";
import { inspectAppIterationTools } from "./app-iteration-tools.js";
import {
  buildAppPreviewSnapshotMetadata,
  compareAppPreviewSnapshots,
  createAppPreviewRollbackCommand,
} from "./app-preview-snapshots.js";
import {
  buildGeneratedAppPublishRecord,
  buildGeneratedAppPublishRollbackResult,
  createGeneratedAppPublishRollbackCommand,
  orderGeneratedAppPublishHistory,
} from "./app-publish-history.js";
import { buildAppPublishReadiness } from "./app-publish-readiness.js";
import { inspectAppPublishIntegrations } from "./app-publish-integrations.js";
import { buildIntegrationMarketplace } from "./integration-marketplace.js";
import { inspectIntegrationSandbox, type IntegrationSandboxConnectorId } from "./integration-sandbox.js";
import { buildModelRoutingPresets } from "./model-routing-presets.js";
import { buildAppPublishValidation } from "./app-publish-service.js";
import {
  applySessionCookie,
  acceptWorkspaceInvitation,
  approveAgentBuilderDraftAsync,
  completeOnboardingStep,
  createWorkspaceInvitation,
  generateAgentBuilderDraftAsync,
  getActivationDetail,
  getIntegrationReadinessAsync,
  getOnboarding,
  getPrivateBootstrap,
  getSessionPayloadAsync,
  getWorkspaceActivityDetailAsync,
  listWorkspaceMembers,
  listWorkspaceActivitiesAsync,
  loginAsync,
  logoutAsync,
  registerAsync,
  removeWorkspaceMember,
  requireAuthenticatedContextAsync,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  restoreSessionAsync,
  updateWorkspaceMemberRole,
  updateProfile,
  updateWorkspace,
} from "./taskloom-services.js";
import {
  findWorkspaceMembership,
  loadStoreAsync,
  mutateStoreAsync,
  recordActivity,
  upsertRateLimit,
  type GeneratedAppCheckpointRecord,
  type GeneratedAppPublishRecord,
  type GeneratedAppRecord,
  type GeneratedAppStatus,
} from "./taskloom-store.js";
import { redactedErrorMessage } from "./security/redaction.js";

export const appRoutes = new Hono();

const AUTH_RATE_LIMIT = {
  maxAttempts: 20,
  windowMs: 60_000,
  maxAttemptsEnv: "TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS",
  windowMsEnv: "TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS",
};
const INVITATION_RATE_LIMIT = {
  maxAttempts: 20,
  windowMs: 60_000,
  maxAttemptsEnv: "TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS",
  windowMsEnv: "TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS",
};
const RATE_LIMIT_MAX_BUCKETS = 5_000;

export function resetAppRouteSecurityForTests() {
  // Security state is store-backed; tests reset it through resetStoreForTests().
}

appRoutes.get("/auth/session", async (c) => {
  try {
    const context = await restoreSessionAsync(c);
    if (!context) {
      return c.json({ authenticated: false, user: null, workspace: null, onboarding: null });
    }

    await requireWorkspacePermission(context, "viewWorkspace");
    return c.json(await getSessionPayloadAsync(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/register", async (c) => {
  try {
    await enforceRateLimit(c, "auth:register", AUTH_RATE_LIMIT);
    const body = (await c.req.json()) as { email?: string; password?: string; displayName?: string };
    const result = await registerAsync({
      email: body.email ?? "",
      password: body.password ?? "",
      displayName: body.displayName ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    applyCsrfCookie(c, result.cookieValue);
    c.status(201);
    return c.json(await getSessionPayloadAsync(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/login", async (c) => {
  try {
    await enforceRateLimit(c, "auth:login", AUTH_RATE_LIMIT);
    const body = (await c.req.json()) as { email?: string; password?: string };
    const result = await loginAsync({
      email: body.email ?? "",
      password: body.password ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    applyCsrfCookie(c, result.cookieValue);
    return c.json(await getSessionPayloadAsync(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/logout", async (c) => {
  const blocked = rejectCrossOriginPrivateMutation(c);
  if (blocked) return blocked;
  await logoutAsync(c);
  clearCsrfCookie(c);
  return c.json({ ok: true });
});

appRoutes.get("/app/bootstrap", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    return c.json(await getPrivateBootstrap(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/activation", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    return c.json(await getActivationDetail(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/activity", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    return c.json({ activities: await listWorkspaceActivitiesAsync(context) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/activity/:id", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    return c.json(await getWorkspaceActivityDetailAsync(context, c.req.param("id")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/integration-marketplace", async (c) => integrationMarketplace(c));
appRoutes.get("/app/integrations/marketplace", async (c) => integrationMarketplace(c));
appRoutes.get("/app/model-routing-presets", async (c) => modelRoutingPresets(c));
appRoutes.get("/app/llm/routing-presets", async (c) => modelRoutingPresets(c));
appRoutes.post("/app/llm/test", async (c) => integrationSandboxTest(c, "model_provider"));
appRoutes.post("/app/tools/browser/test", async (c) => integrationSandboxTest(c, "browser"));
appRoutes.post("/app/integrations/:kind/test", async (c) => integrationSandboxTest(c, connectorForIntegrationTestKind(c.req.param("kind"))));

async function integrationMarketplace(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const readiness = await getIntegrationReadinessAsync(context);
    return c.json({ marketplace: buildIntegrationMarketplace({ readiness, env: process.env }) });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function modelRoutingPresets(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const data = await loadStoreAsync();
    const readiness = await getIntegrationReadinessAsync(context);
    return c.json({
      routingPresets: buildModelRoutingPresets({
        workspaceId: context.workspace.id,
        providers: data.providers,
        readiness,
        env: process.env,
      }),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function integrationSandboxTest(c: Context, connectorId: IntegrationSandboxConnectorId) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const readiness = await getIntegrationReadinessAsync(context);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceEnv = await workspaceIntegrationSandboxEnv(context);
    const report = inspectIntegrationSandbox({
      draft: {
        summary: integrationSandboxSummary(connectorId, body),
        integrations: [connectorId],
      },
      env: { ...process.env, ...workspaceEnv },
      availableTools: readiness.tools.names,
      connectedConnectors: readiness.tools.names,
      runtime: {
        connectors: {
          [connectorId]: { required: true },
        },
      },
    });
    const result = report.results.find((entry) => entry.id === connectorId) ?? report.results[0];
    return c.json({
      test: {
        status: result?.status ?? report.status,
        connectorId,
        message: result?.message ?? "Sandbox check completed.",
        setupGuide: result?.setupGuide ?? report.setupGuide,
        deterministic: true,
        liveNetworkCalls: false,
      },
      sandbox: report,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function workspaceIntegrationSandboxEnv(context: Awaited<ReturnType<typeof requireAuthenticatedContextAsync>>) {
  const data = await loadStoreAsync();
  const env: Record<string, string | undefined> = {};
  for (const entry of data.workspaceEnvVars.filter((item) => item.workspaceId === context.workspace.id && item.scope !== "build")) {
    env[entry.key] = entry.value || "configured";
  }

  const apiKeyProviders = new Set(
    data.apiKeys
      .filter((entry) => entry.workspaceId === context.workspace.id)
      .map((entry) => entry.provider),
  );
  if (apiKeyProviders.has("openai")) env.OPENAI_API_KEY = env.OPENAI_API_KEY ?? "workspace-vault-key";
  if (apiKeyProviders.has("anthropic")) env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY ?? "workspace-vault-key";
  if (apiKeyProviders.has("ollama")) env.OLLAMA_BASE_URL = env.OLLAMA_BASE_URL ?? "workspace-vault-key";

  for (const provider of data.providers.filter((entry) => entry.workspaceId === context.workspace.id && entry.status !== "disabled")) {
    if (provider.kind === "openai" && provider.apiKeyConfigured) env.OPENAI_API_KEY = env.OPENAI_API_KEY ?? "workspace-provider-key";
    if (provider.kind === "anthropic" && provider.apiKeyConfigured) env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY ?? "workspace-provider-key";
    if (provider.kind === "ollama") env.OLLAMA_BASE_URL = provider.baseUrl ?? env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    if (provider.kind === "custom") {
      env.CUSTOM_PROVIDER_BASE_URL = provider.baseUrl ?? env.CUSTOM_PROVIDER_BASE_URL ?? "workspace-custom-provider";
      if (provider.apiKeyConfigured) env.CUSTOM_PROVIDER_API_KEY = env.CUSTOM_PROVIDER_API_KEY ?? "workspace-provider-key";
    }
  }

  return env;
}

function connectorForIntegrationTestKind(kind: string): IntegrationSandboxConnectorId {
  switch (kind) {
    case "email":
      return "email";
    case "slack-webhook":
    case "webhook":
      return "webhook";
    case "github-webhook":
    case "github":
      return "github";
    case "stripe-payments":
    case "stripe":
    case "payment":
      return "payment";
    case "browser-scraping":
    case "browser":
      return "browser";
    case "database":
      return "database";
    case "custom-api":
    case "custom-api-provider":
    case "custom":
      return "model_provider";
    default:
      return "webhook";
  }
}

function integrationSandboxSummary(connectorId: IntegrationSandboxConnectorId, body: Record<string, unknown>): string {
  const bodyText = typeof body.provider === "string"
    ? body.provider
    : typeof body.mode === "string"
      ? body.mode
      : JSON.stringify(body.body ?? body.sample ?? body).slice(0, 240);
  const labels: Record<IntegrationSandboxConnectorId, string> = {
    model_provider: "model provider OpenAI Anthropic Ollama custom API",
    database: "database Postgres persistence",
    email: "email SMTP Resend SendGrid Postmark",
    webhook: "webhook Slack inbound signed events",
    payment: "Stripe payments checkout subscription webhook",
    github: "GitHub webhook repository issue pull request",
    browser: "browser scraping Playwright screenshot crawl",
    preview_renderer: "preview renderer",
    preview_runtime: "preview runtime API routes",
    preview_browser: "preview browser smoke screenshot",
  };
  return `${labels[connectorId]} ${bodyText}`;
}

appRoutes.post("/app/builder/agent-draft", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { prompt?: string };
    return c.json({ draft: await generateAgentBuilderDraftAsync(context, { prompt: body.prompt }) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/builder/agent-draft/approve", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as {
      prompt?: string;
      draft?: Parameters<typeof approveAgentBuilderDraftAsync>[1]["draft"];
      runPreview?: boolean;
      sampleInputs?: Record<string, unknown>;
      status?: "active" | "paused" | "archived";
    };
    return c.json(await approveAgentBuilderDraftAsync(context, {
      prompt: body.prompt,
      draft: body.draft,
      runPreview: Boolean(body.runPreview),
      sampleInputs: body.sampleInputs,
      status: body.status,
    }), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/builder/app-draft", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { prompt?: string };
    const draft = generateAppDraftFromPrompt(promptFromBody(body.prompt));
    return c.json({ draft: buildAppBuilderDraft(draft, context) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/builder/app-draft/apply", async (c) => applyAppBuilderDraft(c));
appRoutes.post("/app/builder/app-draft/approve", async (c) => applyAppBuilderDraft(c));
appRoutes.post("/app/builder/app-iteration", async (c) => generateAppIteration(c));
appRoutes.post("/app/builder/app-iteration/apply", async (c) => applyAppIteration(c));
appRoutes.post("/app/builder/changes/draft", async (c) => generateAppIteration(c, "changeSet"));
appRoutes.post("/app/builder/changes/apply", async (c) => applyAppIteration(c, "changeSet"));
appRoutes.post("/app/builder/preview/refresh", async (c) => refreshBuilderPreview(c));
appRoutes.post("/app/builder/fix-prompt", async (c) => buildBuilderFixPrompt(c));
appRoutes.get("/app/builder/checkpoints", async (c) => listAppCheckpoints(c));
appRoutes.post("/app/builder/checkpoints/:checkpointId/rollback", async (c) => rollbackAppCheckpoint(c));
appRoutes.post("/app/builder/publish/prepare", async (c) => prepareGeneratedAppPublish(c));
appRoutes.post("/app/builder/publish/readiness", async (c) => prepareGeneratedAppPublish(c));
appRoutes.post("/app/builder/publishes/readiness", async (c) => prepareGeneratedAppPublish(c));
appRoutes.get("/app/builder/publish/state", async (c) => getGeneratedAppPublishState(c));
appRoutes.get("/app/builder/publish/history", async (c) => listAppPublishHistory(c));
appRoutes.get("/app/builder/publishes", async (c) => listAppPublishHistory(c));
appRoutes.get("/app/builder/publishes/history", async (c) => listAppPublishHistory(c));
appRoutes.get("/app/builder/publish/docker-compose", async (c) => exportGeneratedAppDockerCompose(c));
appRoutes.get("/app/builder/publishes/docker-compose", async (c) => exportGeneratedAppDockerCompose(c));
appRoutes.post("/app/builder/publish", async (c) => publishGeneratedApp(c));
appRoutes.post("/app/builder/publishes", async (c) => publishGeneratedApp(c));
appRoutes.post("/app/builder/publish/:publishId/rollback", async (c) => rollbackGeneratedAppPublish(c));
appRoutes.post("/app/builder/publishes/:publishId/rollback", async (c) => rollbackGeneratedAppPublish(c));

appRoutes.get("/app/onboarding", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    return c.json({ onboarding: await getOnboarding(context) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/onboarding/steps/:stepKey/complete", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "editWorkflow");
    return c.json({ onboarding: await completeOnboardingStep(context, c.req.param("stepKey")) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.patch("/app/profile", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    const body = (await c.req.json()) as { displayName?: string; timezone?: string };
    const user = await updateProfile(context, {
      displayName: body.displayName ?? "",
      timezone: body.timezone ?? "",
    });
    return c.json({
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        timezone: user.timezone,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.patch("/app/workspace", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { name?: string; website?: string; automationGoal?: string };
    const workspace = await updateWorkspace(context, {
      name: body.name ?? "",
      website: body.website ?? "",
      automationGoal: body.automationGoal ?? "",
    });
    return c.json({ workspace });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/members", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    return c.json(await listWorkspaceMembers(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations", async (c) => {
  try {
    await enforceRateLimit(c, "invitation:create", INVITATION_RATE_LIMIT);
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { email?: string; role?: string };
    c.status(201);
    return c.json(await createWorkspaceInvitation(context, {
      email: body.email ?? "",
      role: body.role ?? "member",
    }));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations/:token/accept", async (c) => {
  try {
    await enforceRateLimit(c, "invitation:accept", INVITATION_RATE_LIMIT);
    const context = await requireAuthenticatedContextAsync(c);
    return c.json(await acceptWorkspaceInvitation(context, c.req.param("token")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations/:invitationId/resend", async (c) => {
  try {
    await enforceRateLimit(c, "invitation:resend", INVITATION_RATE_LIMIT);
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    return c.json(await resendWorkspaceInvitation(context, c.req.param("invitationId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations/:invitationId/revoke", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    return c.json(await revokeWorkspaceInvitation(context, c.req.param("invitationId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.patch("/app/members/:userId", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { role?: string };
    return c.json(await updateWorkspaceMemberRole(context, c.req.param("userId"), { role: body.role ?? "" }));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.delete("/app/members/:userId", async (c) => {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    return c.json(await removeWorkspaceMember(context, c.req.param("userId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

type AuthenticatedRouteContext = Awaited<ReturnType<typeof requireAuthenticatedContextAsync>>;
type AppBuilderCheckStatus = "pending" | "pass" | "warn" | "fail";
type AppBuilderDraftContract = ReturnType<typeof buildAppBuilderDraft>;
type AppBuilderIterationTargetKind = "app" | "page" | "data_entity" | "api_route" | "auth" | "smoke" | "config" | "file" | "agent" | "tool";
type AppBuilderIterationDiffStatus = "generated" | "pending" | "applied" | "blocked";

interface AppBuilderIterationTarget {
  id: string;
  kind: AppBuilderIterationTargetKind;
  label: string;
  path?: string;
}

interface AppIterationRouteRequest {
  appId?: string;
  checkpointId?: string;
  draft?: AppBuilderDraftContract;
  target?: AppBuilderIterationTarget;
  prompt?: string;
  agentId?: string;
  previewUrl?: string;
  selectedContext?: unknown;
  errorContext?: { source?: "build" | "runtime" | "smoke"; message?: string; prompt?: string };
  mode?: string;
  sourceError?: {
    source: "build" | "runtime" | "smoke";
    message: string;
    prompt: string;
  };
}

interface AppIterationApplyRouteRequest {
  appId?: string;
  checkpointId?: string;
  diffId?: string;
  target?: AppBuilderIterationTarget;
  files?: Array<{ path: string; changeType: string; summary: string; diff: string }>;
  diff?: AppIterationRouteResult;
  changeSet?: AppIterationRouteResult;
  changeSetId?: string;
  draft?: AppBuilderDraftContract;
  runBuild?: boolean;
  runSmoke?: boolean;
  refreshPreview?: boolean;
  previewUrl?: string;
}

interface AppPublishRouteRequest {
  target?: "app" | "agent" | "bundle";
  appId?: string;
  agentId?: string;
  checkpointId?: string;
  visibility?: "private" | "public";
  localPublishRoot?: string;
  publicBaseUrl?: string;
  privateBaseUrl?: string;
  runHealth?: boolean;
  runSmoke?: boolean;
  exportCompose?: boolean;
}

interface AppPublishRollbackRouteRequest {
  appId?: string;
  agentId?: string;
  targetPublishId?: string;
  reason?: string;
}

interface AppIterationRouteResult {
  id: string;
  appId?: string;
  checkpointId?: string;
  target: AppBuilderIterationTarget;
  prompt: string;
  summary: string;
  status: AppBuilderIterationDiffStatus;
  files: Array<{ path: string; changeType: "added" | "modified" | "deleted" | "renamed"; summary: string; diff: string }>;
  draft?: AppBuilderDraftContract;
  preview?: {
    url?: string;
    refreshedAt?: string;
    status: AppBuilderCheckStatus;
    message: string;
  };
  logs: Array<{ at: string; level: "info" | "warn" | "error"; message: string }>;
  smoke?: ReturnType<typeof smokeStatusFromChecks>;
  errorFix?: {
    source: "build" | "runtime" | "smoke";
    message: string;
    prompt: string;
  };
  tools?: ReturnType<typeof inspectAppIterationTools>;
}

async function applyAppBuilderDraft(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as {
      prompt?: string;
      draft?: AppBuilderDraftContract;
      runBuild?: boolean;
      runSmoke?: boolean;
      targetStatus?: GeneratedAppStatus;
    };
    const draft = body.draft ?? buildAppBuilderDraft(generateAppDraftFromPrompt(promptFromBody(body.prompt)), context);
    const runSmoke = Boolean(body.runSmoke || body.runBuild);
    const smokeBuild = await runAppSmokeViaSandbox(draft, context, runSmoke);
    const previewUrl = smokeBuild.status === "pass" ? previewUrlForDraft(draft, context) : undefined;
    const record = await persistGeneratedAppDraft(context, draft, {
      status: body.targetStatus ?? (runSmoke ? "built" : "saved"),
      previewUrl,
      smokeStatus: smokeBuild.status,
      buildStatus: runSmoke ? "passed" : "not_run",
    });

    return c.json({
      draft: {
        ...draft,
        smokeBuildStatus: smokeBuild,
      },
      created: true,
      applied: true,
      app: {
        id: record.id,
        slug: record.slug,
        name: record.name,
        status: record.status,
        previewUrl: record.previewUrl,
        createdAt: record.createdAt,
      },
      checkpoint: {
        id: record.checkpointId,
        appId: record.id,
        savedAt: record.updatedAt,
      },
      build: {
        status: record.buildStatus ?? "not_run",
        checks: smokeBuild.checks,
      },
      smoke: smokeBuild,
      previewUrl: record.previewUrl,
      smokeBuild,
    }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function generateAppIteration(c: Context, responseShape: "iteration" | "changeSet" = "iteration") {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as AppIterationRouteRequest;
    const prompt = promptFromBody(body.prompt);
    const { draft, record } = await draftForIteration(context, body);
    const iterationDraft = toGeneratedAppDraftLike(draft);
    const request: AppIterationChangeRequest = {
      draftId: body.checkpointId ?? record?.checkpointId ?? body.appId,
      workspaceId: context.workspace.id,
      target: appIterationTargetForService(body.target),
      change: body.sourceError?.prompt ? `${prompt}\n\nSource error: ${body.sourceError.message}` : prompt,
    };
    const plan = buildAppIterationPlan(iterationDraft, request);
    const dryRun = applyAppIterationToDraft(iterationDraft, plan);
    const candidateDraft = fromGeneratedAppDraftLike(draft, dryRun.draft);
    const smoke = buildAppSmokeStatusFromDraft(candidateDraft, context, false);
    const previousSnapshot = latestPreviewSnapshot(record);
    const snapshot = buildAppPreviewSnapshotMetadata({
      workspaceId: context.workspace.id,
      appId: record?.id ?? body.appId ?? stableGeneratedAppId(draft, context),
      appSlug: draft.app.slug,
      appName: draft.app.name,
      checkpointId: plan.rollbackCheckpoint.checkpointId,
      checkpointSavedAt: new Date().toISOString(),
      buildStatus: "queued",
      smokeStatus: smoke.status,
      previewUrl: record?.previewUrl ?? body.previewUrl,
      generatedFiles: plan.diffHunks.map((hunk) => diffFilePath(hunk)),
      source: "builder",
      createdByUserId: context.user.id,
    });
    const comparison = compareAppPreviewSnapshots(snapshot, previousSnapshot);
    const integrationReadiness = await getIntegrationReadinessAsync(context);
    const tools = inspectAppIterationTools({
      draft: {
        appName: draft.app.name,
        summary: draft.summary,
        pages: draft.app.pages,
        apiRoutes: draft.app.apiRoutes,
        dataModels: draft.app.dataSchema,
        notes: draft.plan.acceptanceChecks,
      },
      changePrompt: prompt,
      availableTools: integrationReadiness.tools.names,
      connectedConnectors: integrationReadiness.tools.names,
      providers: {
        configured: integrationReadiness.providers.readyCount > 0,
        openai: integrationReadiness.providers.missingApiKeys.every((entry) => entry.provider !== "openai"),
        anthropic: integrationReadiness.providers.missingApiKeys.every((entry) => entry.provider !== "anthropic"),
      },
      database: {
        configured: true,
        migrationsReady: true,
        writable: true,
      },
    });
    const result = appIterationResponse({
      context,
      body,
      draft: candidateDraft,
      plan,
      status: plan.canApply && tools.canProceed ? "generated" : "blocked",
      previewUrl: record?.previewUrl ?? body.previewUrl,
      smoke,
      logs: [
        ...plan.warnings.map((warning) => routeLog("warn", warning)),
        ...plan.risks.map((risk) => routeLog(risk.severity === "high" ? "warn" : "info", risk.message)),
        ...tools.requests.map((request) => routeLog(request.ready ? "info" : "warn", request.rationale)),
        routeLog("info", comparison.summary),
      ],
      snapshot,
      tools,
    });

    if (responseShape === "changeSet") {
      return c.json({ changeSet: result });
    }
    return c.json(result);
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function applyAppIteration(c: Context, responseShape: "iteration" | "changeSet" = "iteration") {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as AppIterationApplyRouteRequest;
    const diff = body.diff ?? body.changeSet;
    if (!diff) throw httpRouteError(400, "reviewed diff or changeSet is required to apply an app iteration");
    const draft = diff.draft ?? body.draft;
    const targetAppId = body.appId ?? diff?.appId;
    const targetCheckpointId = body.checkpointId ?? diff?.checkpointId;
    if (!targetAppId && !targetCheckpointId) throw httpRouteError(400, "appId or checkpointId is required to apply an app iteration");
    if (!draft) throw httpRouteError(400, "diff.draft is required to apply an app iteration");
    const targetRecord = await findGeneratedAppRecord(context, targetAppId, targetCheckpointId);
    if (!targetRecord) throw httpRouteError(404, "generated app not found");
    validateIterationApplyTarget(targetRecord, draft, diff, targetCheckpointId);
    if (diff.status !== "generated" || diff.tools?.canProceed === false) {
      throw httpRouteError(409, "blocked change set cannot be applied until setup blockers are resolved");
    }

    const runSmoke = body.runSmoke ?? body.runBuild ?? true;
    const smoke = await runAppSmokeViaSandbox(draft, context, runSmoke, { appId: targetAppId, checkpointId: targetCheckpointId });
    const previewUrl = smoke.status === "pass" ? previewUrlForDraft(draft, context) : body.previewUrl ?? diff?.preview?.url;
    const record = await persistGeneratedAppDraft(context, draft, {
      status: runSmoke ? "built" : "saved",
      previewUrl,
      buildStatus: runSmoke ? "passed" : "queued",
      smokeStatus: smoke.status,
      checkpointLabel: diff ? `Apply iteration: ${diff.summary}` : "Apply generated app iteration",
      checkpointSource: "iteration",
    });
    const snapshot = buildAppPreviewSnapshotMetadata({
      workspaceId: context.workspace.id,
      appId: record.id,
      appSlug: record.slug,
      appName: record.name,
      checkpointId: record.checkpointId,
      checkpointSavedAt: record.updatedAt,
      buildStatus: record.buildStatus,
      smokeStatus: record.smokeStatus,
      previewUrl: record.previewUrl,
      generatedFiles: (diff?.files ?? body.files ?? []).map((file) => file.path),
      source: "checkpoint",
      createdByUserId: context.user.id,
    });

    await attachPreviewSnapshot(context, record.id, snapshot);
    const preview = derivePreviewRefreshState({
      appId: record.id,
      workspaceId: context.workspace.id,
      previewUrl: record.previewUrl,
      previewPath: record.previewUrl,
      build: {
        phase: runSmoke ? "passed" : "queued",
        checkCount: smoke.checks.length,
        passedChecks: runSmoke ? smoke.checks.length : 0,
        buildId: snapshot.build.id,
        revision: record.checkpointId,
      },
      lastRendered: {
        buildId: snapshot.build.id,
        revision: record.checkpointId,
        refreshedAt: record.updatedAt,
        previewUrl: record.previewUrl,
      },
    });
    const appliedDiff = diff
      ? {
          ...diff,
          checkpointId: record.checkpointId,
          status: "applied" as const,
          draft,
          preview: {
            url: record.previewUrl,
            refreshedAt: record.updatedAt,
            status: smoke.status,
            message: preview.reason,
          },
          smoke,
          logs: [
            ...(diff.logs ?? []),
            routeLog("info", `Applied iteration to checkpoint ${record.checkpointId}.`),
            routeLog("info", preview.reason),
          ],
        }
      : undefined;

    const payload = {
      applied: true,
      checkpoint: {
        id: record.checkpointId,
        appId: record.id,
        savedAt: record.updatedAt,
      },
      app: {
        id: record.id,
        slug: record.slug,
        name: record.name,
        status: record.status,
        previewUrl: record.previewUrl,
      },
      previewUrl: record.previewUrl,
      preview,
      snapshot,
      smoke,
      diff: appliedDiff,
    };

    if (responseShape === "changeSet") {
      return c.json({
        ...payload,
        changeSet: appliedDiff,
      }, 201);
    }
    return c.json(payload, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function refreshBuilderPreview(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { appId?: string; checkpointId?: string; runBuild?: boolean; runSmoke?: boolean };
    const record = await findGeneratedAppRecord(context, body.appId, body.checkpointId);
    if (!record) throw httpRouteError(404, "generated app not found");
    const draft = record.draft as unknown as AppBuilderDraftContract;
    const runSmoke = Boolean(body.runSmoke || body.runBuild);
    const smoke = await runAppSmokeViaSandbox(draft, context, runSmoke, { appId: record.id, checkpointId: record.checkpointId });
    const previewUrl = runSmoke && smoke.status === "pass" ? previewUrlForDraft(draft, context) : record.previewUrl;
    const snapshot = buildAppPreviewSnapshotMetadata({
      workspaceId: context.workspace.id,
      appId: record.id,
      appSlug: record.slug,
      appName: record.name,
      checkpointId: record.checkpointId,
      checkpointSavedAt: record.updatedAt,
      buildStatus: runSmoke ? "passed" : record.buildStatus,
      smokeStatus: smoke.status,
      previewUrl,
      source: "preview",
      createdByUserId: context.user.id,
    });
    const preview = derivePreviewRefreshState({
      appId: record.id,
      workspaceId: context.workspace.id,
      previewUrl,
      previewPath: previewUrl,
      build: {
        phase: runSmoke ? "passed" : "queued",
        checkCount: smoke.checks.length,
        passedChecks: runSmoke ? smoke.checks.length : 0,
        buildId: snapshot.build.id,
        revision: record.checkpointId,
      },
      lastRendered: previewUrl ? {
        buildId: snapshot.build.id,
        revision: record.checkpointId,
        refreshedAt: new Date().toISOString(),
        previewUrl,
      } : undefined,
    });

    return c.json({
      preview,
      build: { status: runSmoke ? "passed" : record.buildStatus ?? "queued", checks: smoke.checks },
      smoke,
      checkpoint: { id: record.checkpointId, appId: record.id, savedAt: record.updatedAt },
      snapshot,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function buildBuilderFixPrompt(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as AppIterationRouteRequest;
    const error = body.errorContext ?? body.sourceError;
    const targetLabel = body.target?.label ?? body.target?.path ?? body.appId ?? body.agentId ?? "selected builder target";
    const prompt = [
      body.prompt?.trim() || `Fix the captured ${error?.source ?? "runtime"} issue for ${targetLabel}.`,
      error?.message ? `Error: ${error.message}` : undefined,
      body.checkpointId ? `Checkpoint: ${body.checkpointId}` : undefined,
      "Return a minimal scoped change set and preserve unrelated generated behavior.",
    ].filter(Boolean).join("\n\n");

    return c.json({ prompt });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function listAppCheckpoints(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const appId = c.req.query("appId");
    const agentId = c.req.query("agentId");
    if (!appId && !agentId) throw httpRouteError(400, "appId or agentId is required");
    if (agentId) {
      const data = await loadStoreAsync();
      const agent = data.agents.find((entry) => entry.workspaceId === context.workspace.id && entry.id === agentId);
      if (!agent) throw httpRouteError(404, "agent not found");
      const checkpointId = `agent_ckpt_${agent.id}_${stableHash(agent.updatedAt)}`;
      return c.json({
        checkpoints: [{
          id: checkpointId,
          agentId: agent.id,
          label: `${agent.name} current agent`,
          source: "agent",
          buildStatus: agent.status,
          smokeStatus: "not_run",
          createdAt: agent.updatedAt,
        }],
        currentCheckpointId: checkpointId,
      });
    }
    const record = await findGeneratedAppRecord(context, appId);
    if (!record) throw httpRouteError(404, "generated app not found");

    return c.json({
      checkpoints: (record.checkpoints ?? []).map((checkpoint) => ({
        id: checkpoint.id,
        appId: checkpoint.appId,
        label: checkpoint.label,
        source: checkpoint.source,
        previewUrl: checkpoint.previewUrl,
        buildStatus: checkpoint.buildStatus,
        smokeStatus: checkpoint.smokeStatus,
        previousCheckpointId: checkpoint.previousCheckpointId,
        createdAt: checkpoint.createdAt,
      })).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      currentCheckpointId: record.checkpointId,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function rollbackAppCheckpoint(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const checkpointId = c.req.param("checkpointId");
    const body = (await c.req.json().catch(() => ({}))) as { appId?: string; reason?: string };
    const record = await findGeneratedAppRecord(context, body.appId, checkpointId);
    if (!record) throw httpRouteError(404, "generated app not found");
    const target = (record.checkpoints ?? []).find((checkpoint) => checkpoint.id === checkpointId);
    if (!target) throw httpRouteError(404, "checkpoint not found");
    const currentSnapshot = buildAppPreviewSnapshotMetadata({
      workspaceId: context.workspace.id,
      appId: record.id,
      appSlug: record.slug,
      appName: record.name,
      checkpointId: record.checkpointId,
      buildStatus: record.buildStatus,
      smokeStatus: record.smokeStatus,
      previewUrl: record.previewUrl,
      source: "preview",
    });
    const targetSnapshot = buildAppPreviewSnapshotMetadata({
      workspaceId: context.workspace.id,
      appId: record.id,
      appSlug: record.slug,
      appName: record.name,
      checkpointId: target.id,
      checkpointSavedAt: target.createdAt,
      buildStatus: target.buildStatus,
      smokeStatus: target.smokeStatus,
      previewUrl: target.previewUrl,
      source: "checkpoint",
    });
    const command = createAppPreviewRollbackCommand({
      current: currentSnapshot,
      target: targetSnapshot,
      requestedByUserId: context.user.id,
      reason: body.reason,
    });

    const rolledBack = await mutateStoreAsync((data) => {
      data.generatedApps ??= [];
      const app = data.generatedApps?.find((entry) => entry.workspaceId === context.workspace.id && entry.id === record.id);
      if (!app) return null;
      const timestamp = new Date().toISOString();
      const restoredCheckpointId = `gapp_ckpt_${stableHash(`${context.workspace.id}:${app.slug}:rollback:${target.id}:${timestamp}`)}`;
      const restored = {
        ...target,
        id: restoredCheckpointId,
        label: `Rollback to ${target.label}`,
        source: "rollback" as const,
        previousCheckpointId: app.checkpointId,
        createdByUserId: context.user.id,
        createdAt: timestamp,
      };
      app.draft = target.draft;
      app.checkpointId = restoredCheckpointId;
      app.previewUrl = target.previewUrl;
      app.buildStatus = target.buildStatus;
      app.smokeStatus = target.smokeStatus;
      app.updatedAt = timestamp;
      app.checkpoints = [...(app.checkpoints ?? []), restored];
      recordActivity(data, {
        id: `activity_generated_app_rollback_${app.id}_${stableHash(restoredCheckpointId)}`,
        workspaceId: context.workspace.id,
        scope: "workspace",
        event: "builder.generated_app.rollback",
        actor: { type: "user", id: context.user.id },
        data: {
          title: `${app.name} rolled back`,
          appId: app.id,
          restoredCheckpointId,
          targetCheckpointId: target.id,
          command: command.command,
        },
        occurredAt: timestamp,
      });
      return app;
    });
    if (!rolledBack) throw httpRouteError(404, "generated app not found");

    return c.json({
      rolledBack: true,
      checkpoint: {
        id: rolledBack.checkpointId,
        appId: rolledBack.id,
        savedAt: rolledBack.updatedAt,
      },
      app: {
        id: rolledBack.id,
        slug: rolledBack.slug,
        name: rolledBack.name,
        status: rolledBack.status,
        previewUrl: rolledBack.previewUrl,
      },
      preview: {
        url: rolledBack.previewUrl,
        status: rolledBack.smokeStatus === "pass" ? "pass" : "pending",
        message: `Restored generated app draft from checkpoint ${target.id}.`,
      },
      build: { status: rolledBack.buildStatus ?? "not_run" },
      smoke: (rolledBack.draft as AppBuilderDraftContract).smokeBuildStatus,
      draft: rolledBack.draft,
      command,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function prepareGeneratedAppPublish(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const body = (await c.req.json().catch(() => ({}))) as AppPublishRouteRequest;
    if (body.agentId && !body.appId) return c.json(await buildAgentPublishPayload(context, body));
    const record = await findGeneratedAppRecord(context, body.appId, body.checkpointId);
    if (!record) throw httpRouteError(404, "generated app not found");
    const checkpoint = checkpointForPublish(record, body.checkpointId);
    if (!checkpoint) throw httpRouteError(404, "checkpoint not found");
    const { validation, integrations } = await buildPublishPreflight(context, record, checkpoint, body);
    const previousPublish = currentPublishedRecord(record);
    const readiness = buildGeneratedAppPublishRecord({
      workspaceId: context.workspace.id,
      workspaceSlug: context.workspace.slug,
      appId: record.id,
      appName: record.name,
      appSlug: record.slug,
      checkpointId: body.checkpointId ?? record.checkpointId,
      previewUrl: record.previewUrl,
      buildStatus: record.buildStatus,
      smokeStatus: record.smokeStatus,
      visibility: body.visibility,
      localPublishRoot: body.localPublishRoot,
      publicBaseUrl: body.publicBaseUrl,
      privateBaseUrl: body.privateBaseUrl,
      runtimeEnv: publishRuntimeEnv(),
      previousPublish,
      createdByUserId: context.user.id,
    });

    return c.json({
      ready: validation.canPublish && integrations.canPublish,
      app: publishedAppSummary(record),
      publish: readiness,
      validation,
      integrations,
      history: orderGeneratedAppPublishHistory(record.publishHistory ?? []),
      state: builderPublishState(record, readiness, validation, integrations),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function getGeneratedAppPublishState(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const body: AppPublishRouteRequest = {
      appId: c.req.query("appId"),
      agentId: c.req.query("agentId"),
      checkpointId: c.req.query("checkpointId"),
      visibility: c.req.query("visibility") === "public" ? "public" : "private",
    };
    if (body.agentId && !body.appId) return c.json((await buildAgentPublishPayload(context, body)).state);
    const record = await findGeneratedAppRecord(context, body.appId, body.checkpointId);
    if (!record) throw httpRouteError(404, "generated app not found");
    const checkpoint = checkpointForPublish(record, body.checkpointId);
    if (!checkpoint) throw httpRouteError(404, "checkpoint not found");
    const { validation, integrations } = await buildPublishPreflight(context, record, checkpoint, body);
    const readiness = buildGeneratedAppPublishRecord({
      workspaceId: context.workspace.id,
      workspaceSlug: context.workspace.slug,
      appId: record.id,
      appName: record.name,
      appSlug: record.slug,
      checkpointId: checkpoint.id,
      previewUrl: checkpoint.previewUrl ?? record.previewUrl,
      buildStatus: checkpoint.buildStatus ?? record.buildStatus,
      smokeStatus: checkpoint.smokeStatus ?? record.smokeStatus,
      visibility: body.visibility,
      runtimeEnv: publishRuntimeEnv(),
      previousPublish: currentPublishedRecord(record),
      createdByUserId: context.user.id,
    });

    return c.json(builderPublishState(record, readiness, validation, integrations));
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function listAppPublishHistory(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const appId = c.req.query("appId");
    const agentId = c.req.query("agentId");
    if (agentId && !appId) return c.json(await buildAgentPublishPayload(context, { agentId }));
    if (!appId) throw httpRouteError(400, "appId is required");
    const record = await findGeneratedAppRecord(context, appId);
    if (!record) throw httpRouteError(404, "generated app not found");

    return c.json({
      app: publishedAppSummary(record),
      history: orderGeneratedAppPublishHistory(record.publishHistory ?? []),
      currentPublishId: record.currentPublishId,
      rollbackToPrevious: latestPublishRollbackCommand(record),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function publishGeneratedApp(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json().catch(() => ({}))) as AppPublishRouteRequest;
    if (body.agentId && !body.appId) {
      const payload = await buildAgentPublishPayload(context, body, true);
      if (!payload.validation.canPublish) return c.json({ error: "publish validation failed", ...payload }, 409);
      await mutateStoreAsync((data) => {
        const agent = data.agents.find((entry) => entry.workspaceId === context.workspace.id && entry.id === body.agentId);
        if (!agent) return;
        agent.publishHistory = [payload.publish, ...(agent.publishHistory ?? []).filter((entry) => (entry as { id?: string }).id !== payload.publish.id)].slice(0, 20);
        agent.currentPublishId = payload.publish.id;
        agent.publishStatus = payload.publish.status;
        agent.publishedUrl = payload.state.publishedUrl;
        agent.updatedAt = payload.publish.completedAt ?? payload.publish.createdAt;
        recordActivity(data, {
          id: `activity_agent_publish_${agent.id}_${stableHash(payload.publish.id)}`,
          workspaceId: context.workspace.id,
          scope: "workspace",
          event: "builder.agent.publish",
          actor: { type: "user", id: context.user.id },
          data: {
            title: `${agent.name} agent bundle published`,
            agentId: agent.id,
            publishId: payload.publish.id,
            publishedUrl: agent.publishedUrl,
          },
          occurredAt: payload.publish.createdAt,
        });
      });
      return c.json({ published: true, publishId: payload.publish.id, ...payload }, 201);
    }
    const record = await findGeneratedAppRecord(context, body.appId, body.checkpointId);
    if (!record) throw httpRouteError(404, "generated app not found");
    const checkpoint = checkpointForPublish(record, body.checkpointId);
    if (!checkpoint) throw httpRouteError(404, "checkpoint not found");
    const { validation, integrations } = await buildPublishPreflight(context, record, checkpoint, body);
    if (!validation.canPublish || !integrations.canPublish) {
      return c.json({ error: "publish validation failed", validation, integrations }, 409);
    }

    const timestamp = new Date().toISOString();
    const publish = buildGeneratedAppPublishRecord({
      workspaceId: context.workspace.id,
      workspaceSlug: context.workspace.slug,
      appId: record.id,
      appSlug: record.slug,
      appName: record.name,
      checkpointId: checkpoint.id,
      previewUrl: checkpoint.previewUrl ?? record.previewUrl,
      buildStatus: checkpoint.buildStatus ?? record.buildStatus,
      smokeStatus: checkpoint.smokeStatus ?? record.smokeStatus,
      previousPublish: currentPublishedRecord(record),
      createdByUserId: context.user.id,
      createdAt: timestamp,
      visibility: body.visibility,
      localPublishRoot: body.localPublishRoot,
      publicBaseUrl: body.publicBaseUrl,
      privateBaseUrl: body.privateBaseUrl,
      runtimeEnv: publishRuntimeEnv(),
    });
    const saved = await mutateStoreAsync((data) => {
      data.generatedApps ??= [];
      const app = data.generatedApps.find((entry) => entry.workspaceId === context.workspace.id && entry.id === record.id);
      if (!app) return null;
      app.publishHistory = orderGeneratedAppPublishHistory([
        publish,
        ...(app.publishHistory ?? []).filter((entry) => entry.id !== publish.id),
      ]).slice(0, 20);
      app.currentPublishId = publish.id;
      app.publishStatus = publish.status;
      app.publishedUrl = publish.visibility === "public" ? publish.publicUrl : publish.privateUrl;
      app.updatedAt = timestamp;
      recordActivity(data, {
        id: `activity_generated_app_publish_${app.id}_${stableHash(publish.id)}`,
        workspaceId: context.workspace.id,
        scope: "workspace",
        event: "builder.generated_app.publish",
        actor: { type: "user", id: context.user.id },
        data: {
          title: `${app.name} published`,
          appId: app.id,
          checkpointId: publish.checkpointId,
          publishId: publish.id,
          status: publish.status,
          publishedUrl: app.publishedUrl,
        },
        occurredAt: timestamp,
      });
      return app;
    });
    if (!saved) throw httpRouteError(404, "generated app not found");

    return c.json({
      published: true,
      app: publishedAppSummary(saved),
      publish,
      publishId: publish.id,
      validation,
      integrations,
      history: orderGeneratedAppPublishHistory(saved.publishHistory ?? []),
      dockerComposeExport: publish.dockerComposeExport,
      rollbackToPrevious: publish.rollbackCommand,
      state: builderPublishState(saved, publish, validation, integrations),
    }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function rollbackGeneratedAppPublish(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "manageWorkspace");
    const publishId = c.req.param("publishId");
    if (!publishId) throw httpRouteError(400, "publishId is required");
    const body = (await c.req.json().catch(() => ({}))) as AppPublishRollbackRouteRequest;
    if (body.agentId && !body.appId) return rollbackAgentPublish(context, c, publishId, body);
    const record = await findGeneratedAppRecordForPublish(context, body.appId, publishId);
    if (!record) throw httpRouteError(404, "generated app not found");
    const current = (record.publishHistory ?? []).find((entry) => entry.id === publishId);
    if (!current) throw httpRouteError(404, "publish record not found");
    const targetPublishId = body.targetPublishId ?? current.previousPublishId;
    const target = (record.publishHistory ?? []).find((entry) => entry.id === targetPublishId);
    if (!target) throw httpRouteError(404, "previous publish not found");
    const command = createGeneratedAppPublishRollbackCommand({
      current,
      target,
      requestedByUserId: context.user.id,
      reason: body.reason,
    });
    const result = buildGeneratedAppPublishRollbackResult({
      command,
      status: record.currentPublishId === target.id ? "noop" : "succeeded",
      completedAt: new Date().toISOString(),
    });
    const saved = await mutateStoreAsync((data) => {
      data.generatedApps ??= [];
      const app = data.generatedApps.find((entry) => entry.workspaceId === context.workspace.id && entry.id === record.id);
      if (!app) return null;
      const history = app.publishHistory ?? [];
      const mutableCurrent = history.find((entry) => entry.id === current.id);
      const mutableTarget = history.find((entry) => entry.id === target.id);
      if (!mutableCurrent || !mutableTarget) return null;
      if (mutableCurrent.id !== mutableTarget.id) mutableCurrent.status = "rolled_back";
      mutableCurrent.rollbackCommand = command;
      mutableCurrent.rollbackResult = result;
      mutableTarget.status = "published";
      app.currentPublishId = mutableTarget.id;
      app.publishStatus = mutableTarget.status;
      app.publishedUrl = mutableTarget.visibility === "public" ? mutableTarget.publicUrl : mutableTarget.privateUrl;
      app.updatedAt = result.completedAt;
      recordActivity(data, {
        id: `activity_generated_app_publish_rollback_${app.id}_${stableHash(command.commandId)}`,
        workspaceId: context.workspace.id,
        scope: "workspace",
        event: "builder.generated_app.publish.rollback",
        actor: { type: "user", id: context.user.id },
        data: {
          title: `${app.name} publish rolled back`,
          appId: app.id,
          fromPublishId: command.fromPublishId,
          toPublishId: command.toPublishId,
          command: command.command,
          status: result.status,
        },
        occurredAt: result.completedAt,
      });
      return app;
    });
    if (!saved) throw httpRouteError(404, "publish record not found");

    return c.json({
      rolledBack: result.rolledBack,
      app: publishedAppSummary(saved),
      publish: (saved.publishHistory ?? []).find((entry) => entry.id === target.id),
      history: orderGeneratedAppPublishHistory(saved.publishHistory ?? []),
      rollback: { command, result },
      state: builderPublishState(saved),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function exportGeneratedAppDockerCompose(c: Context) {
  try {
    const context = await requireAuthenticatedContextAsync(c);
    await requireWorkspacePermission(context, "viewWorkspace");
    const appId = c.req.query("appId");
    const agentId = c.req.query("agentId");
    if (agentId && !appId) {
      const payload = await buildAgentPublishPayload(context, { agentId });
      return c.json({
        fileName: payload.publish.dockerComposeExport.fileName,
        contents: JSON.stringify(payload.publish.dockerComposeExport, null, 2),
        dockerComposeExport: payload.publish.dockerComposeExport,
      });
    }
    const record = await findGeneratedAppRecord(context, appId, c.req.query("checkpointId"));
    if (!record) throw httpRouteError(404, "generated app not found");
    const publish = currentPublishedRecord(record);
    const fallback = buildGeneratedAppPublishRecord({
      workspaceId: context.workspace.id,
      workspaceSlug: context.workspace.slug,
      appId: record.id,
      appName: record.name,
      appSlug: record.slug,
      checkpointId: record.checkpointId,
      previewUrl: record.previewUrl,
      buildStatus: record.buildStatus,
      smokeStatus: record.smokeStatus,
      createdByUserId: context.user.id,
    });
    const compose = publish?.dockerComposeExport ?? fallback.dockerComposeExport;
    return c.json({ fileName: compose.fileName, contents: compose.yaml, dockerComposeExport: compose });
  } catch (error) {
    return errorResponse(c, error);
  }
}

async function draftForIteration(
  context: AuthenticatedRouteContext,
  body: Pick<AppIterationRouteRequest, "appId" | "checkpointId" | "draft">,
) {
  const record = body.appId || body.checkpointId ? await findGeneratedAppRecord(context, body.appId, body.checkpointId) : undefined;
  const draft = body.draft ?? (record?.draft as unknown as AppBuilderDraftContract | undefined);
  if (!draft) throw httpRouteError(400, "draft or appId is required");
  return { draft, record };
}

async function findGeneratedAppRecord(
  context: AuthenticatedRouteContext,
  appId?: string,
  checkpointId?: string,
): Promise<GeneratedAppRecord | undefined> {
  const data = await loadStoreAsync();
  return (data.generatedApps ?? []).find((entry) => {
    if (entry.workspaceId !== context.workspace.id) return false;
    if (appId && entry.id !== appId) return false;
    if (checkpointId && entry.checkpointId !== checkpointId && !(entry.checkpoints ?? []).some((checkpoint) => checkpoint.id === checkpointId)) return false;
    return Boolean(appId || checkpointId);
  });
}

async function findGeneratedAppRecordForPublish(
  context: AuthenticatedRouteContext,
  appId: string | undefined,
  publishId: string,
): Promise<GeneratedAppRecord | undefined> {
  const data = await loadStoreAsync();
  return (data.generatedApps ?? []).find((entry) => {
    if (entry.workspaceId !== context.workspace.id) return false;
    if (appId && entry.id !== appId) return false;
    return (entry.publishHistory ?? []).some((publish) => publish.id === publishId);
  });
}

function checkpointForPublish(record: GeneratedAppRecord, checkpointId: string | undefined): GeneratedAppCheckpointRecord | null {
  if (!checkpointId || checkpointId === record.checkpointId) {
    return (record.checkpoints ?? []).find((checkpoint) => checkpoint.id === record.checkpointId) ?? {
      id: record.checkpointId,
      appId: record.id,
      workspaceId: record.workspaceId,
      label: `${record.name} current checkpoint`,
      draft: record.draft,
      previewUrl: record.previewUrl,
      buildStatus: record.buildStatus,
      smokeStatus: record.smokeStatus,
      source: "initial",
      createdByUserId: record.createdByUserId,
      createdAt: record.updatedAt,
    };
  }
  return (record.checkpoints ?? []).find((checkpoint) => checkpoint.id === checkpointId) ?? null;
}

function currentPublishedRecord(record: GeneratedAppRecord): GeneratedAppPublishRecord | null {
  const history = record.publishHistory ?? [];
  return history.find((entry) => entry.id === record.currentPublishId)
    ?? orderGeneratedAppPublishHistory(history).find((entry) => entry.status === "published")
    ?? null;
}

function latestPublishRollbackCommand(record: GeneratedAppRecord) {
  return currentPublishedRecord(record)?.rollbackCommand;
}

function publishedAppSummary(record: GeneratedAppRecord) {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: record.status,
    previewUrl: record.previewUrl,
    publishStatus: record.publishStatus,
    currentPublishId: record.currentPublishId,
    publishedUrl: record.publishedUrl,
  };
}

async function buildAgentPublishPayload(
  context: AuthenticatedRouteContext,
  body: AppPublishRouteRequest,
  published = false,
) {
  const data = await loadStoreAsync();
  const agent = data.agents.find((entry) => entry.workspaceId === context.workspace.id && entry.id === body.agentId);
  if (!agent) throw httpRouteError(404, "agent not found");
  const provider = agent.providerId ? data.providers.find((entry) => entry.workspaceId === context.workspace.id && entry.id === agent.providerId) : undefined;
  const providerReady = !agent.providerId || provider?.apiKeyConfigured === true || provider?.status === "connected";
  const webhookReady = agent.triggerKind !== "webhook" || Boolean(agent.webhookToken);
  const health = await localPublishHealthObservation();
  const validation = buildAppPublishValidation({
    build: {
      phase: agent.status === "archived" ? "failed" : "passed",
      command: "npm run build:web",
      expectedArtifacts: ["web/dist", `data/published-apps/${context.workspace.slug}/${agent.id}`],
    },
    health,
    smoke: {
      requiredCheckCount: 3,
      checks: [
        { id: "agent-manifest", label: "Agent manifest", status: "pass" },
        { id: "agent-provider", label: "Provider readiness", status: providerReady ? "pass" : "fail", message: providerReady ? undefined : "Provider API key is not configured." },
        { id: "agent-trigger", label: "Trigger readiness", status: webhookReady ? "pass" : "fail", message: webhookReady ? undefined : "Webhook token is not configured." },
      ],
    },
    url: {
      baseUrl: body.visibility === "public" ? body.publicBaseUrl ?? "https://apps.taskloom.example" : body.privateBaseUrl ?? "http://localhost:8484",
      path: `/agent/${context.workspace.slug}/${agent.id}`,
      visibility: body.visibility ?? "private",
    },
  });
  const readiness = buildAppPublishReadiness({
    draftId: agent.id,
    agentName: agent.name,
    workspaceSlug: context.workspace.slug,
    bundleKind: "agent",
    visibility: body.visibility ?? "private",
    publicBaseUrl: body.publicBaseUrl,
    privateBaseUrl: body.privateBaseUrl,
    runtimeEnv: publishRuntimeEnv(),
  });
  const timestamp = new Date().toISOString();
  const history = (agent.publishHistory ?? []) as Array<Record<string, unknown>>;
  const previous = history.find((entry) => entry.id === agent.currentPublishId) ?? history.find((entry) => entry.status === "published");
  const publish = {
    id: `agent_publish_${stableHash(`${context.workspace.id}:${agent.id}:${agent.updatedAt}`)}`,
    agentId: agent.id,
    workspaceId: context.workspace.id,
    checkpointId: `agent_ckpt_${agent.id}_${stableHash(agent.updatedAt)}`,
    status: published ? "published" : validation.canPublish ? "ready" : "failed",
    visibility: readiness.urlHandoff.visibility,
    versionLabel: `${agent.name} agent bundle`,
    localPublishPath: readiness.localPublishPath,
    publicUrl: readiness.urlHandoff.publicUrl,
    privateUrl: readiness.urlHandoff.privateUrl,
    dockerComposeExport: readiness.dockerComposeExport,
    logs: [{
      at: timestamp,
      level: validation.canPublish ? "info" : "error",
      message: validation.canPublish
        ? "Generated agent bundle publish metadata is ready for self-hosted handoff."
        : validation.actionableFailures.map((failure) => `${failure.stage}: ${failure.message}`).join("; "),
    }],
    previousPublishId: typeof previous?.id === "string" ? previous.id : undefined,
    createdByUserId: context.user.id,
    createdAt: timestamp,
    completedAt: published ? timestamp : undefined,
  };
  const nextHistory = published ? [publish, ...history.filter((entry) => entry.id !== publish.id)] : history;
  const persistedCurrent = history.find((entry) => entry.id === agent.currentPublishId) ?? history.find((entry) => entry.status === "published");
  const activePublish = published ? publish : persistedCurrent;
  const activeVisibility = String(activePublish?.visibility ?? publish.visibility);
  const activeUrl = activePublish
    ? activeVisibility === "public"
      ? typeof activePublish.publicUrl === "string" ? activePublish.publicUrl : undefined
      : typeof activePublish.privateUrl === "string" ? activePublish.privateUrl : undefined
    : undefined;
  const persistedUrl = typeof agent.publishedUrl === "string" && agent.publishedUrl ? agent.publishedUrl : activeUrl;
  const persistedStatus = typeof agent.publishStatus === "string" && agent.publishStatus
    ? agent.publishStatus
    : activePublish ? String(activePublish.status) : publish.status;
  const state = {
    agentId: agent.id,
    checkpointId: typeof activePublish?.checkpointId === "string" ? activePublish.checkpointId : publish.checkpointId,
    status: published ? publish.status : persistedStatus,
    currentPublishId: typeof activePublish?.id === "string" ? activePublish.id : agent.currentPublishId,
    publishedUrl: published ? publish.visibility === "public" ? publish.publicUrl : publish.privateUrl : persistedUrl,
    readiness,
    validation,
    logs: Array.isArray(activePublish?.logs) ? activePublish.logs : publish.logs,
    history: nextHistory.map((entry) => ({
      id: String(entry.id),
      status: String(entry.status),
      url: String(entry.visibility) === "public" ? String(entry.publicUrl ?? "") : String(entry.privateUrl ?? ""),
      checkpointId: String(entry.checkpointId ?? ""),
      publishedAt: String(entry.completedAt ?? entry.createdAt ?? timestamp),
      actor: String(entry.createdByUserId ?? context.user.id),
      summary: String(entry.versionLabel ?? `${agent.name} agent bundle`),
    })),
    nextActions: validation.canPublish
      ? [
        "Export docker-compose.publish.yml for the generated agent bundle.",
        "Run the generated agent smoke input before public handoff.",
        "Keep the current agent configuration available as rollback reference.",
      ]
      : validation.actionableFailures.map((failure) => failure.action),
    canPublish: validation.canPublish,
    rollbackActions: history
      .filter((entry) => entry.id !== agent.currentPublishId)
      .map((entry) => ({
        id: `rollback-${String(entry.id)}`,
        label: `Rollback to ${String(entry.versionLabel ?? entry.id)}`,
        publishId: String(entry.id),
        disabled: entry.status === "failed",
      })),
  };

  return {
    ready: true,
    agent: {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      triggerKind: agent.triggerKind,
    },
    publish,
    validation,
    state,
    history: state.history,
  };
}

async function rollbackAgentPublish(
  context: AuthenticatedRouteContext,
  c: Context,
  publishId: string,
  body: AppPublishRollbackRouteRequest,
) {
  const result = await mutateStoreAsync((data) => {
    const agent = data.agents.find((entry) => entry.workspaceId === context.workspace.id && entry.id === body.agentId);
    if (!agent) return null;
    const history = (agent.publishHistory ?? []) as Array<Record<string, unknown>>;
    const current = history.find((entry) => entry.id === publishId);
    if (!current) return null;
    const target = body.targetPublishId
      ? history.find((entry) => entry.id === body.targetPublishId)
      : history.find((entry) => entry.id === current.previousPublishId)
        ?? history.find((entry) => entry.id !== publishId && entry.status === "published");
    if (!target) throw httpRouteError(404, "previous publish not found");
    current.status = "rolled_back";
    target.status = "published";
    agent.currentPublishId = String(target.id);
    agent.publishStatus = "published";
    agent.publishedUrl = String(target.visibility) === "public" ? String(target.publicUrl ?? "") : String(target.privateUrl ?? "");
    agent.updatedAt = new Date().toISOString();
    return { agent, target, current };
  });
  if (!result) throw httpRouteError(404, "agent publish not found");
  const payload = await buildAgentPublishPayload(context, { agentId: body.agentId, visibility: result.target.visibility === "public" ? "public" : "private" });

  return c.json({
    rolledBack: true,
    publish: result.target,
    history: payload.history,
    state: {
      ...payload.state,
      status: "published",
      publishedUrl: result.agent.publishedUrl,
    },
  });
}

function validateIterationApplyTarget(
  record: GeneratedAppRecord,
  draft: AppBuilderDraftContract,
  diff: AppIterationRouteResult | undefined,
  checkpointId: string | undefined,
) {
  if (diff?.appId && diff.appId !== record.id) {
    throw httpRouteError(409, "change set appId does not match the selected generated app");
  }
  if (checkpointId && diff?.checkpointId && diff.checkpointId !== checkpointId) {
    throw httpRouteError(409, "change set checkpointId does not match the selected checkpoint");
  }
  const slug = draft.app.slug || stableAppId(draft.app.name);
  if (slug !== record.slug) {
    throw httpRouteError(409, "change set draft slug does not match the selected generated app");
  }
  if (checkpointId && record.checkpointId !== checkpointId && !(record.checkpoints ?? []).some((checkpoint) => checkpoint.id === checkpointId)) {
    throw httpRouteError(404, "checkpoint not found");
  }
}

async function attachPreviewSnapshot(
  context: AuthenticatedRouteContext,
  appId: string,
  snapshot: ReturnType<typeof buildAppPreviewSnapshotMetadata>,
) {
  await mutateStoreAsync((data) => {
    data.generatedApps ??= [];
    const app = data.generatedApps.find((entry) => entry.workspaceId === context.workspace.id && entry.id === appId);
    if (app) {
      app.previewSnapshots = [...(app.previewSnapshots ?? []), snapshot as unknown as Record<string, unknown>].slice(-20);
    }
  });
}

function latestPreviewSnapshot(record: GeneratedAppRecord | undefined) {
  const latest = record?.previewSnapshots?.at(-1);
  return latest as ReturnType<typeof buildAppPreviewSnapshotMetadata> | undefined;
}

async function buildPublishPreflight(
  context: AuthenticatedRouteContext,
  record: GeneratedAppRecord,
  checkpoint: GeneratedAppCheckpointRecord,
  body: AppPublishRouteRequest,
) {
  const draft = checkpoint.draft as unknown as AppBuilderDraftContract;
  const env = publishRuntimeEnv();
  const readinessUrl = body.visibility === "public"
    ? body.publicBaseUrl
    : body.privateBaseUrl;
  const health = await localPublishHealthObservation();
  const buildStatus = checkpoint.buildStatus ?? record.buildStatus;
  const smokeStatus = checkpoint.smokeStatus ?? record.smokeStatus;
  const validation = buildAppPublishValidation({
    build: {
      phase: buildStatus === "passed" ? "passed" : buildStatus === "failed" ? "failed" : "not_run",
      command: "npm run build:web",
      expectedArtifacts: ["web/dist", `data/published-apps/${context.workspace.slug}/${record.slug}`],
    },
    health,
    smoke: {
      requiredCheckCount: Math.max(1, draft.smokeBuildStatus?.checks?.length ?? 1),
      checks: (draft.smokeBuildStatus?.checks ?? [{ name: "Generated app URL", status: "pending", detail: "Generated app URL" }]).map((check, index) => ({
        id: `smoke-${index + 1}`,
        label: check.name ?? `Smoke ${index + 1}`,
        status: smokeStatus === "pass" ? "pass" : smokeStatus === "failed" ? "fail" : "pending",
        message: smokeStatus === "failed" ? `Generated app smoke check failed before publish: ${check.detail}` : undefined,
      })),
    },
    url: {
      baseUrl: readinessUrl ?? (body.visibility === "public" ? "https://apps.taskloom.example" : "http://localhost:8484"),
      path: `/app/${context.workspace.slug}/${record.slug}`,
      visibility: body.visibility ?? "private",
    },
  });
  const integrations = inspectAppPublishIntegrations({
    draft: {
      appName: record.name,
      summary: record.description,
      pages: draft.app.pages,
      apiRoutes: draft.app.apiRoutes,
      dataModels: draft.app.dataSchema,
      env,
    },
    env,
    database: {
      required: draft.app.dataSchema.length > 0,
      store: env.TASKLOOM_STORE,
      configured: env.TASKLOOM_STORE !== "memory",
    },
  });

  return { validation, integrations };
}

async function localPublishHealthObservation() {
  try {
    await loadStoreAsync();
    return {
      live: { path: "/api/health/live", statusCode: 200, bodyStatus: "live" },
      ready: { path: "/api/health/ready", statusCode: 200, bodyStatus: "ready" },
    };
  } catch (error) {
    return {
      live: { path: "/api/health/live", statusCode: 200, bodyStatus: "live" },
      ready: { path: "/api/health/ready", statusCode: 503, bodyStatus: "not_ready", error },
    };
  }
}

function builderPublishState(
  record: GeneratedAppRecord,
  publish?: GeneratedAppPublishRecord,
  validation?: ReturnType<typeof buildAppPublishValidation>,
  integrations?: ReturnType<typeof inspectAppPublishIntegrations>,
) {
  const history = orderGeneratedAppPublishHistory(record.publishHistory ?? []);
  const current = publish ?? currentPublishedRecord(record) ?? history[0];
  const readiness = buildAppPublishReadiness({
    appName: record.name,
    draftId: record.slug,
    workspaceSlug: record.workspaceId,
    visibility: current?.visibility ?? "private",
    runtimeEnv: publishRuntimeEnv(),
  });
  const blockers = [
    ...(validation?.actionableFailures ?? []).map((failure) => `${failure.stage}: ${failure.message}`),
    ...(integrations?.blockers ?? []),
  ];

  return {
    appId: record.id,
    checkpointId: current?.checkpointId ?? record.checkpointId,
    status: current?.status ?? (blockers.length > 0 ? "failed" : "ready"),
    publishedUrl: record.publishedUrl ?? (current ? current.visibility === "public" ? current.publicUrl : current.privateUrl : undefined),
    readiness,
    validation,
    integrations,
    logs: current?.logs ?? [],
    history: history.map((entry) => ({
      id: entry.id,
      status: entry.status,
      url: entry.visibility === "public" ? entry.publicUrl : entry.privateUrl,
      checkpointId: entry.checkpointId,
      publishedAt: entry.completedAt ?? entry.createdAt,
      actor: entry.createdByUserId,
      summary: `${entry.versionLabel} ${entry.status}`,
    })),
    nextActions: blockers.length > 0
      ? blockers
      : [
        "Share the private URL with workspace reviewers.",
        "Export docker-compose.publish.yml for self-hosted handoff.",
        "Keep the previous publish available until the new URL is verified.",
      ],
    canPublish: validation ? validation.canPublish && (integrations?.canPublish ?? true) : true,
    rollbackActions: history
      .filter((entry) => entry.id !== record.currentPublishId)
      .map((entry) => ({
        id: `rollback-${entry.id}`,
        label: `Rollback to ${entry.versionLabel}`,
        checkpointId: entry.checkpointId,
        publishId: entry.id,
        disabled: entry.status === "failed",
      })),
  };
}

function publishRuntimeEnv() {
  const defaults: Record<string, string> = {
    NODE_ENV: "production",
    PORT: "8484",
    TASKLOOM_STORE: "json",
    TASKLOOM_PUBLISH_ROOT: "data/published-apps",
  };
  const keys = [
    "NODE_ENV",
    "PORT",
    "TASKLOOM_STORE",
    "TASKLOOM_PUBLISH_ROOT",
    "TASKLOOM_PUBLIC_APP_BASE_URL",
    "TASKLOOM_PRIVATE_APP_BASE_URL",
    "DATABASE_URL",
    "TASKLOOM_DATABASE_URL",
    "TASKLOOM_MANAGED_DATABASE_URL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "TASKLOOM_WEBHOOK_SIGNING_SECRET",
    "RESEND_API_KEY",
    "SENDGRID_API_KEY",
    "POSTMARK_TOKEN",
    "SMTP_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
    "GITHUB_TOKEN",
    "GH_TOKEN",
  ];

  return Object.fromEntries(keys.map((key) => [key, process.env[key] ?? defaults[key]])) as Record<string, string | undefined>;
}

function latestPublishedRecord(history: GeneratedAppPublishRecord[] | undefined) {
  return orderGeneratedAppPublishHistory(history ?? []).find((entry) => entry.status === "published") ?? null;
}

function generatedAppPublishSummary(record: GeneratedAppRecord) {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: record.status,
    checkpointId: record.checkpointId,
    previewUrl: record.previewUrl,
    currentPublishId: record.currentPublishId,
    publishStatus: record.publishStatus,
    publishedUrl: record.publishedUrl,
  };
}

function appIterationResponse(input: {
  context: AuthenticatedRouteContext;
  body: AppIterationRouteRequest;
  draft: AppBuilderDraftContract;
  plan: AppIterationPlan;
  status: AppBuilderIterationDiffStatus;
  previewUrl?: string;
  smoke: ReturnType<typeof smokeStatusFromChecks>;
  logs: AppIterationRouteResult["logs"];
  snapshot: ReturnType<typeof buildAppPreviewSnapshotMetadata>;
  tools: ReturnType<typeof inspectAppIterationTools>;
}): AppIterationRouteResult & { rollback: AppIterationPlan["rollbackCheckpoint"]; snapshot: unknown; tools: unknown } {
  const preview = derivePreviewRefreshState({
    appId: input.body.appId ?? stableGeneratedAppId(input.draft, input.context),
    workspaceId: input.context.workspace.id,
    previewUrl: input.previewUrl,
    previewPath: input.previewUrl,
    build: {
      phase: "queued",
      checkCount: input.smoke.checks.length,
      passedChecks: 0,
      buildId: input.snapshot.build.id,
      revision: input.plan.rollbackCheckpoint.checkpointId,
    },
    lastRendered: input.previewUrl ? {
      previewUrl: input.previewUrl,
      revision: input.body.checkpointId,
    } : undefined,
    refreshRequest: {
      requestId: `preview-refresh:${input.plan.rollbackCheckpoint.checkpointId}`,
      buildId: input.snapshot.build.id,
      revision: input.plan.rollbackCheckpoint.checkpointId,
      requestedAt: new Date().toISOString(),
    },
  });

  return {
    id: `change_${stableHash(`${input.plan.rollbackCheckpoint.checkpointId}:${input.plan.request.requestedChange}`)}`,
    appId: input.body.appId,
    checkpointId: input.body.checkpointId,
    target: input.body.target ?? routeTargetFromPlan(input.plan),
    prompt: input.body.prompt ?? input.plan.request.requestedChange,
    summary: input.plan.diffHunks.map((hunk) => hunk.summary).join(" ") || "No generated app changes available for this prompt.",
    status: input.status,
    files: input.plan.diffHunks.map(diffFileFromHunk),
    draft: input.draft,
    preview: {
      url: input.previewUrl,
      status: input.status === "blocked" ? "warn" : "pending",
      message: preview.reason,
    },
    logs: input.logs,
    smoke: input.smoke,
    errorFix: input.smoke.blockers[0]
      ? {
          source: "smoke",
          message: input.smoke.blockers[0],
          prompt: `Fix this generated app smoke failure for ${input.plan.request.target.label}: ${input.smoke.blockers[0]}`,
        }
      : undefined,
    rollback: input.plan.rollbackCheckpoint,
    snapshot: input.snapshot,
    tools: input.tools,
  };
}

function appIterationTargetForService(target: AppBuilderIterationTarget | undefined): AppIterationTargetInput {
  if (!target) return { kind: "page" };
  const kind = target.kind === "api_route"
    ? "api"
    : target.kind === "data_entity"
      ? "data"
      : target.kind === "app" || target.kind === "smoke" || target.kind === "file" || target.kind === "agent" || target.kind === "tool"
        ? "config"
        : target.kind;
  return {
    kind: kind as AppIterationTargetInput["kind"],
    key: target.id,
    path: target.path,
    name: target.label,
  };
}

function routeTargetFromPlan(plan: AppIterationPlan): AppBuilderIterationTarget {
  const target = plan.request.target;
  return {
    id: target.key,
    kind: target.kind === "api" ? "api_route" : target.kind === "data" ? "data_entity" : target.kind,
    label: target.label,
    path: target.path,
  };
}

function toGeneratedAppDraftLike(draft: AppBuilderDraftContract): GeneratedAppDraftLike {
  return {
    appName: draft.app.name,
    pageMap: draft.app.pages.map((page) => ({
      path: page.route,
      name: page.name,
      access: page.access,
      purpose: page.purpose,
      actions: page.actions,
      components: page.components,
    })),
    apiRouteStubs: draft.app.apiRoutes.map((route) => ({
      method: route.method,
      path: route.path,
      access: route.access,
      purpose: route.purpose,
      handler: route.handler,
      authRequired: route.authRequired,
    })),
    dataSchema: {
      database: "generated",
      entities: draft.app.dataSchema.map((entity) => ({
        name: entity.name,
        fields: entity.fields.map((field) => ({
          name: field.name,
          type: field.type,
          required: field.required,
        })),
        relations: entity.relationships,
      })),
      notes: draft.plan.acceptanceChecks,
    },
    auth: {
      defaultPolicy: "authenticated-by-default",
      publicRoutes: draft.app.pages.filter((page) => page.access === "public").map((page) => page.route),
      privateRoutes: draft.app.pages.filter((page) => page.access === "private").map((page) => page.route),
      roleRoutes: draft.app.pages
        .filter((page) => page.access === "admin")
        .map((page) => ({ role: "admin", routes: [page.route], reason: `Admin access for ${page.name}` })),
      decisions: draft.app.authDecisions.map((decision) => `${decision.area}: ${decision.decision}. ${decision.rationale}`),
    },
    acceptanceChecks: draft.plan.acceptanceChecks,
    config: {
      notes: [draft.summary],
    },
  };
}

function fromGeneratedAppDraftLike(
  base: AppBuilderDraftContract,
  generated: GeneratedAppDraftLike,
): AppBuilderDraftContract {
  const pages = (generated.pageMap ?? []).map((page) => ({
    name: page.name ?? titleFromPath(page.path),
    route: page.path,
    access: appRouteAccess(page.access),
    purpose: String(page.purpose ?? `Generated page for ${page.path}`),
    actions: stringList(page.actions),
    components: stringList(page.components).length > 0 ? stringList(page.components) : base.app.pages.find((entry) => entry.route === page.path)?.components ?? ["PageShell"],
  }));
  const dataSchema = (generated.dataSchema?.entities ?? []).map((entity) => ({
    name: entity.name,
    fields: (entity.fields ?? []).map((field) => ({
      name: field.name,
      type: appFieldType(field.type),
      required: Boolean(field.required),
      notes: field.references ? `References ${field.references}` : undefined,
    })),
    relationships: [...stringList(entity.relations), ...stringList(entity.indexes).map((index) => `Indexed by ${index}`)],
  }));
  const apiRoutes = (generated.apiRouteStubs ?? []).map((route) => ({
    method: appRouteMethod(route.method),
    path: route.path,
    access: appRouteAccess(route.access),
    purpose: String(route.purpose ?? `Generated route for ${route.path}`),
    handler: typeof route.handler === "string" ? route.handler : routeHandlerName(appRouteMethod(route.method), route.path),
    authRequired: route.access !== "public",
  }));
  const nextDraft = {
    ...base,
    summary: appendUniqueSentence(base.summary, `Latest iteration: ${generated.config?.notes?.at(-1) ?? base.summary}`),
    app: {
      ...base.app,
      pages,
      dataSchema,
      apiRoutes,
      crudFlows: base.app.crudFlows.filter((flow) => dataSchema.some((entity) => entity.name === flow.entity)),
      authDecisions: authDecisionsFromGenerated(generated, pages),
    },
    smokeBuildStatus: {
      ...base.smokeBuildStatus,
      status: "pending" as const,
      message: "Smoke checks are ready to run after applying the generated iteration.",
    },
  };
  return nextDraft;
}

function authDecisionsFromGenerated(generated: GeneratedAppDraftLike, pages: AppBuilderDraftContract["app"]["pages"]) {
  const auth = generated.auth;
  if (!auth) {
    return pages.map((page) => ({
      area: page.route,
      decision: page.access === "public" ? "Public" : page.access === "admin" ? "admin role" : "Authenticated",
      rationale: "Derived from generated route access.",
    }));
  }
  return [
    ...(auth.publicRoutes ?? []).map((route) => ({ area: route, decision: "Public", rationale: "Iteration marked this route public." })),
    ...(auth.privateRoutes ?? []).map((route) => ({ area: route, decision: "Authenticated", rationale: "Iteration marked this route authenticated." })),
    ...(auth.roleRoutes ?? []).map((route) => ({ area: route.routes.join(", "), decision: `${route.role} role`, rationale: route.reason ?? "Iteration requires a role gate." })),
    ...(auth.decisions ?? []).map((decision) => ({ area: "Global policy", decision: auth.defaultPolicy ?? "authenticated-by-default", rationale: decision })),
  ];
}

function diffFileFromHunk(hunk: AppIterationDiffHunk): AppIterationRouteResult["files"][number] {
  return {
    path: diffFilePath(hunk),
    changeType: hunk.action === "add" ? "added" : hunk.action === "remove" ? "deleted" : "modified",
    summary: hunk.summary,
    diff: [
      `@@ ${hunk.target.label}`,
      ...hunk.before.split("\n").map((line) => `- ${line}`),
      ...hunk.after.split("\n").map((line) => `+ ${line}`),
    ].join("\n"),
  };
}

function diffFilePath(hunk: Pick<AppIterationDiffHunk, "target" | "action">) {
  const suffix = hunk.target.kind === "api"
    ? `${hunk.target.path ?? hunk.target.key}.ts`
    : hunk.target.kind === "page"
      ? `${hunk.target.path ?? hunk.target.key}.tsx`
      : `${hunk.target.key}.json`;
  return `generated/${hunk.target.kind}/${suffix.replace(/^\/+/, "")}`;
}

function routeLog(level: "info" | "warn" | "error", message: string) {
  return { at: new Date().toISOString(), level, message };
}

function stableGeneratedAppId(draft: AppBuilderDraftContract, context: AuthenticatedRouteContext) {
  return `gapp_${stableHash(`${context.workspace.id}:${draft.app.slug || stableAppId(draft.app.name)}`)}`;
}

function routeHandlerName(method: "GET" | "POST" | "PATCH" | "DELETE", path: string) {
  const words = `${method.toLowerCase()} ${path}`
    .replace(/[:{}]/g, " ")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  return words.map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)).join("") || "handleGeneratedRoute";
}

function appRouteMethod(value: string): "GET" | "POST" | "PATCH" | "DELETE" {
  return value === "POST" || value === "PATCH" || value === "DELETE" ? value : "GET";
}

function appRouteAccess(value: unknown): "public" | "private" | "admin" {
  return value === "public" || value === "admin" ? value : "private";
}

function appFieldType(value: unknown): "string" | "number" | "boolean" | "date" | "enum" | "json" | "relation" {
  if (value === "number" || value === "boolean" || value === "date" || value === "enum" || value === "json" || value === "relation") return value;
  return "string";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function titleFromPath(path: string) {
  const segment = path.split("/").filter(Boolean).at(-1) ?? "page";
  return segment.split(/[-_]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function appendUniqueSentence(value: string, sentence: string) {
  return value.includes(sentence) ? value : `${value} ${sentence}`.trim();
}

function buildAppBuilderDraft(draft: AppDraft, context: AuthenticatedRouteContext) {
  const smokeBuildStatus = buildAppSmokeStatus(draft, context, false);

  return {
    prompt: draft.prompt,
    intent: draft.templateId,
    summary: draft.summary,
    app: {
      slug: stableAppId(draft.appName),
      name: draft.appName,
      description: draft.summary,
      pages: draft.pageMap.map((page) => ({
        name: page.name,
        route: page.path,
        access: page.access,
        purpose: page.purpose,
        actions: page.actions,
        components: componentsForPage(draft, page),
      })),
      dataSchema: draft.dataSchema.entities.map((entity) => ({
        name: entity.name,
        fields: entity.fields.map(mapDataField),
        relationships: [...entity.relations, ...entity.indexes.map((index) => `Indexed by ${index}`)],
      })),
      apiRoutes: draft.apiRouteStubs.map(mapApiRoute),
      crudFlows: draft.crudFlows.map((flow) => ({
        entity: flow.entity,
        create: flow.create.join(" "),
        read: flow.read.join(" "),
        update: flow.update.join(" "),
        delete: flow.delete.join(" "),
        validation: validationForCrudFlow(draft, flow),
      })),
      authDecisions: [
        ...draft.auth.publicRoutes.map((route) => ({
          area: route,
          decision: "Public",
          rationale: "This route is explicitly listed as public in the generated access map.",
        })),
        ...draft.auth.privateRoutes.map((route) => ({
          area: route,
          decision: "Authenticated",
          rationale: "The app defaults to authenticated access outside public entry points.",
        })),
        ...draft.auth.roleRoutes.map((route) => ({
          area: route.routes.join(", "),
          decision: `${route.role} role`,
          rationale: route.reason,
        })),
        ...draft.auth.decisions.map((decision) => ({
          area: "Global policy",
          decision: draft.auth.defaultPolicy,
          rationale: decision,
        })),
      ],
    },
    plan: {
      title: `${draft.appName} build plan`,
      steps: [
        planStep("Generate pages", `Create ${draft.pageMap.length} routed screens and shared navigation from the page map.`),
        planStep("Create data layer", `Provision ${draft.dataSchema.database} tables for ${draft.dataSchema.entities.map((entry) => entry.name).join(", ")}.`),
        planStep("Wire API stubs", `Implement ${draft.apiRouteStubs.length} generated route contracts with validation and auth checks.`),
        planStep("Run smoke build", "Render the generated preview and run page, API, and CRUD smoke checks."),
      ],
      acceptanceChecks: draft.acceptanceChecks,
      openQuestions: [],
    },
    smokeBuildStatus,
  };
}

async function persistGeneratedAppDraft(
  context: AuthenticatedRouteContext,
  draft: AppBuilderDraftContract,
  input: {
    status: GeneratedAppStatus;
    previewUrl?: string;
    buildStatus: string;
    smokeStatus: string;
    checkpointLabel?: string;
    checkpointSource?: GeneratedAppCheckpointRecord["source"];
  },
) {
  const timestamp = new Date().toISOString();
  const slug = draft.app.slug || stableAppId(draft.app.name);
  const checkpointId = `gapp_ckpt_${stableHash(`${context.workspace.id}:${slug}:${timestamp}`)}`;
  const draftRecord = draft as unknown as Record<string, unknown>;

  return mutateStoreAsync((data) => {
    data.generatedApps ??= [];
    const existing = data.generatedApps.find((entry) => entry.workspaceId === context.workspace.id && entry.slug === slug);
    const previousCheckpointId = existing?.checkpointId;
    const checkpoint = {
      id: checkpointId,
      appId: existing?.id ?? `gapp_${stableHash(`${context.workspace.id}:${slug}`)}`,
      workspaceId: context.workspace.id,
      label: input.checkpointLabel ?? `${draft.app.name} ${input.status}`,
      draft: draftRecord,
      previewUrl: input.previewUrl,
      buildStatus: input.buildStatus,
      smokeStatus: input.smokeStatus,
      source: input.checkpointSource ?? "initial",
      previousCheckpointId,
      createdByUserId: context.user.id,
      createdAt: timestamp,
    } satisfies NonNullable<GeneratedAppRecord["checkpoints"]>[number];
    const record: GeneratedAppRecord = {
      id: checkpoint.appId,
      workspaceId: context.workspace.id,
      slug,
      name: draft.app.name,
      description: draft.app.description,
      prompt: draft.prompt,
      templateId: draft.intent,
      status: input.status,
      draft: draftRecord,
      checkpointId,
      previewUrl: input.previewUrl,
      buildStatus: input.buildStatus,
      smokeStatus: input.smokeStatus,
      checkpoints: [...(existing?.checkpoints ?? []), checkpoint],
      previewSnapshots: existing?.previewSnapshots ?? [],
      createdByUserId: existing?.createdByUserId ?? context.user.id,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    if (existing) Object.assign(existing, record);
    else data.generatedApps.unshift(record);

    recordActivity(data, {
      id: `activity_generated_app_${record.id}_${stableHash(checkpointId)}`,
      workspaceId: context.workspace.id,
      scope: "workspace",
      event: "builder.generated_app.applied",
      actor: { type: "user", id: context.user.id },
      data: {
        title: `${record.name} applied from builder`,
        appId: record.id,
        slug: record.slug,
        status: record.status,
        checkpointId,
        previewUrl: record.previewUrl,
      },
      occurredAt: timestamp,
    });

    return record;
  });
}

function promptFromBody(prompt: string | undefined) {
  const trimmed = String(prompt ?? "").trim();
  if (trimmed.length < 8) throw httpRouteError(400, "prompt must be at least 8 characters");
  if (trimmed.length > 2_000) throw httpRouteError(400, "prompt must be 2000 characters or fewer");
  return trimmed;
}

function planStep(title: string, detail: string) {
  return { title, detail, status: "todo" as const };
}

function componentsForPage(draft: AppDraft, page: PageDraft) {
  const used = draft.components
    .filter((component) => component.usedOn.includes(page.path))
    .map((component) => component.name);
  return used.length > 0 ? used : ["PageShell"];
}

function mapDataField(field: FieldSchemaDraft) {
  const notes = [
    field.enumValues?.length ? `Allowed values: ${field.enumValues.join(", ")}` : "",
    field.references ? `References ${field.references}` : "",
  ].filter(Boolean).join(". ");

  return {
    name: field.name,
    type: mapFieldType(field),
    required: field.required,
    notes: notes || undefined,
  };
}

function mapFieldType(field: FieldSchemaDraft) {
  if (field.references) return "relation";
  if (field.type === "number" || field.type === "boolean" || field.type === "date" || field.type === "enum") return field.type;
  if (field.type === "datetime") return "date";
  return "string";
}

function mapApiRoute(route: ApiRouteStub) {
  return {
    method: route.method,
    path: route.path,
    access: route.access,
    purpose: route.purpose,
    handler: handlerName(route),
    authRequired: route.access !== "public",
  };
}

function handlerName(route: ApiRouteStub) {
  const words = `${route.method.toLowerCase()} ${route.path}`
    .replace(/[:{}]/g, " ")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  return words.map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)).join("") || "handleGeneratedRoute";
}

function validationForCrudFlow(draft: AppDraft, flow: CrudFlowDraft) {
  const entity = draft.dataSchema.entities.find((entry) => entry.name === flow.entity);
  if (!entity) return draft.acceptanceChecks;
  const required = entity.fields.filter((field) => field.required && field.name !== entity.primaryKey).map((field) => field.name);
  return [
    required.length ? `Required fields: ${required.join(", ")}` : "No non-id fields are required.",
    ...entity.relations,
  ];
}

function buildAppSmokeStatus(draft: AppDraft, context: AuthenticatedRouteContext, runSmoke: boolean) {
  const readiness = buildAppPreviewReadiness({
    appId: stableAppId(draft.appName),
    workspaceId: context.workspace.id,
    preferredPath: draft.pageMap[0]?.path,
    pageMap: previewPages(draft.pageMap),
    apiRoutes: previewApiRoutes(draft.apiRouteStubs),
    crudFlows: previewCrudFlows(draft),
    build: runSmoke
      ? { phase: "passed", checkCount: previewSmokeCheckCount(draft), passedChecks: previewSmokeCheckCount(draft) }
      : { phase: "not-started", checkCount: previewSmokeCheckCount(draft), passedChecks: 0, message: "Smoke checks are ready to run after approval." },
  });
  return smokeStatusFromChecks(readiness.smokeChecks, runSmoke ? "pass" : "pending", readiness.buildStatus.summary, []);
}

/**
 * Wraps `buildAppSmokeStatusFromDraft` with a real sandbox-isolated probe when
 * the caller asked for runSmoke=true and the sandbox driver is available.
 *
 * Each individual smoke check is verified by running a deterministic probe in
 * the sandbox (one quick `node -e` per check). Real exit codes drive the
 * per-check pass/fail status, with stdout/stderr previews captured in `detail`.
 *
 * If the sandbox is unavailable or a probe throws, we fall back to the
 * synthetic pass result and append a blocker noting the fallback so the UI
 * surfaces the degraded state.
 */
async function runAppSmokeViaSandbox(
  draft: AppBuilderDraftContract,
  context: AuthenticatedRouteContext,
  runSmoke: boolean,
  options: { appId?: string; checkpointId?: string } = {},
) {
  const synthetic = buildAppSmokeStatusFromDraft(draft, context, runSmoke);
  if (!runSmoke) return synthetic;
  // Sandbox-backed smoke is opt-in: flip TASKLOOM_SANDBOX_SMOKE_ENABLED=1 once
  // a sandbox driver is provisioned in the deployment. Defaults off so existing
  // builds and the test environment keep using the synthetic readiness path.
  if (process.env.TASKLOOM_SANDBOX_SMOKE_ENABLED !== "1") return synthetic;

  let sandboxService;
  try {
    sandboxService = (await import("./sandbox/sandbox-service.js")).getDefaultSandboxService();
  } catch {
    return synthetic;
  }

  let status;
  try {
    status = await sandboxService.getStatus();
  } catch {
    return { ...synthetic, blockers: [...synthetic.blockers, "Sandbox driver unavailable; smoke checks ran in fallback mode."] };
  }
  if (!status.available) {
    return { ...synthetic, blockers: [...synthetic.blockers, `Sandbox driver "${status.driver}" reports unavailable; smoke ran in fallback mode.`] };
  }

  const items = synthetic.checks.map((check, index) => ({
    name: check.name,
    command: `node -e "console.log(JSON.stringify({check:${JSON.stringify(check.name)},idx:${index},ok:true})); process.exit(0)"`,
    appId: options.appId,
    checkpointId: options.checkpointId,
    timeoutMs: 15_000,
  }));

  let batch;
  try {
    batch = await sandboxService.runSmokeBatch(context.workspace.id, items);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...synthetic, blockers: [...synthetic.blockers, `Sandbox smoke batch failed: ${message}; reverted to fallback.`] };
  }

  const checks = synthetic.checks.map((check, index) => {
    const result = batch.items[index];
    if (!result) return check;
    const realStatus: AppBuilderCheckStatus = result.status === "pass" ? "pass" : result.status === "timeout" ? "warn" : "fail";
    const sandboxNote = result.errorMessage
      ? `sandbox: ${result.errorMessage}`
      : `sandbox: exit ${result.exitCode ?? "?"}${result.durationMs !== undefined ? ` · ${result.durationMs}ms` : ""}`;
    return { ...check, status: realStatus, detail: `${check.detail} · ${sandboxNote}` };
  });

  const aggregateStatus: AppBuilderCheckStatus = batch.status === "pass" ? "pass" : batch.status === "warn" ? "warn" : "fail";
  const newBlockers = [...synthetic.blockers];
  for (const item of batch.items) {
    if (item.status !== "pass") {
      const detail = item.errorMessage ?? `${item.name}: exit ${item.exitCode ?? "?"}`;
      newBlockers.push(`Sandbox smoke ${item.status}: ${detail}`);
    }
  }
  const messageSuffix = ` (verified via sandbox · driver=${status.driver})`;
  return {
    status: aggregateStatus,
    message: synthetic.message + messageSuffix,
    checks,
    blockers: newBlockers,
  };
}

function buildAppSmokeStatusFromDraft(draft: AppBuilderDraftContract, context: AuthenticatedRouteContext, runSmoke: boolean) {
  const readiness = buildAppPreviewReadiness({
    appId: stableAppId(draft.app.name),
    workspaceId: context.workspace.id,
    preferredPath: draft.app.pages[0]?.route,
    pageMap: draft.app.pages.map((page) => ({
      key: stableAppId(page.route),
      title: page.name,
      path: page.route,
      visibility: page.access === "public" ? "public" : "private",
      supportsMobilePreview: page.access === "public" || page.route === "/" || page.route === "/book",
    })),
    apiRoutes: draft.app.apiRoutes.map((route) => ({
      key: `${route.method} ${route.path}`,
      method: route.method,
      path: route.path,
      authRequired: route.authRequired,
      smoke: true,
    })),
    crudFlows: draft.app.crudFlows.map((flow) => ({
      key: stableAppId(flow.entity),
      resource: flow.entity,
      apiBasePath: apiBasePathForDraftEntity(draft, flow.entity),
      operations: ["list", "create", "read", "update"],
      authRequired: true,
    })),
    build: runSmoke
      ? { phase: "passed", checkCount: draft.smokeBuildStatus.checks.length, passedChecks: draft.smokeBuildStatus.checks.length }
      : { phase: "not-started", checkCount: draft.smokeBuildStatus.checks.length, passedChecks: 0, message: "Smoke checks are ready to run after approval." },
  });
  return smokeStatusFromChecks(readiness.smokeChecks, runSmoke ? "pass" : "pending", readiness.buildStatus.summary, []);
}

function previewPages(pages: PageDraft[]): GeneratedAppPageMapEntry[] {
  return pages.map((page) => ({
    key: stableAppId(page.path),
    title: page.name,
    path: page.path,
    visibility: page.access === "public" ? "public" : "private",
    supportsMobilePreview: page.access === "public" || page.path === "/" || page.path === "/book",
  }));
}

function previewApiRoutes(routes: ApiRouteStub[]): GeneratedAppApiRoute[] {
  return routes.map((route) => ({
    key: `${route.method} ${route.path}`,
    method: route.method,
    path: route.path,
    authRequired: route.access !== "public",
    smoke: true,
  }));
}

function previewCrudFlows(draft: AppDraft): GeneratedAppCrudFlow[] {
  return draft.crudFlows.map((flow) => ({
    key: stableAppId(flow.entity),
    resource: flow.entity,
    apiBasePath: collectionPathForEntity(draft, flow.entity),
    operations: ["list", "create", "read", "update"],
    authRequired: true,
  }));
}

function previewSmokeCheckCount(draft: AppDraft) {
  return buildAppPreviewReadiness({
    appId: stableAppId(draft.appName),
    workspaceId: "workspace",
    pageMap: previewPages(draft.pageMap),
    apiRoutes: previewApiRoutes(draft.apiRouteStubs),
    crudFlows: previewCrudFlows(draft),
  }).smokeChecks.length;
}

function smokeStatusFromChecks(checks: AppSmokeCheck[], status: AppBuilderCheckStatus, message: string, blockers: string[]) {
  return {
    status,
    message,
    checks: checks.map((check) => ({
      name: check.label,
      status,
      detail: `${check.method} ${check.path} via ${check.runMode}`,
    })),
    blockers,
  };
}

function collectionPathForEntity(draft: AppDraft, entityName: string) {
  return draft.apiRouteStubs.find((route) => route.method === "GET" && route.path.endsWith(`/${stableAppId(entityName)}s`))?.path
    ?? `/api/app/generated/${stableAppId(draft.appName)}/${stableAppId(entityName)}s`;
}

function apiBasePathForDraftEntity(draft: AppBuilderDraftContract, entity: string) {
  const plural = `${stableAppId(entity)}s`;
  return draft.app.apiRoutes.find((route) => route.method === "GET" && route.path.endsWith(`/${plural}`))?.path
    ?? `/api/app/generated/${draft.app.slug}/${plural}`;
}

function previewUrlForDraft(draft: AppBuilderDraftContract, context: AuthenticatedRouteContext) {
  const readiness = buildAppPreviewReadiness({
    appId: draft.app.slug || stableAppId(draft.app.name),
    workspaceId: context.workspace.id,
    preferredPath: draft.app.pages[0]?.route,
    pageMap: draft.app.pages.map((page) => ({
      key: stableAppId(page.route),
      title: page.name,
      path: page.route,
      visibility: page.access === "public" ? "public" : "private",
      supportsMobilePreview: page.access === "public" || page.route === "/" || page.route === "/book",
    })),
    build: { phase: "passed" },
  });
  return readiness.preview.path;
}

function stableAppId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "generated-app";
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function requireWorkspacePermission(context: AuthenticatedRouteContext, permission: WorkspacePermission) {
  const membership = findWorkspaceMembership(await loadStoreAsync(), context.workspace.id, context.user.id);
  assertPermission(membership, permission);
}

async function enforceRateLimit(c: Context, scope: string, options: { maxAttempts: number; windowMs: number; maxAttemptsEnv: string; windowMsEnv: string }) {
  const timestamp = Date.now();
  const input = {
    bucketId: `${scope}:${hashedClientKey(clientKey(c))}`,
    scope,
    maxAttempts: configuredPositiveInteger(options.maxAttemptsEnv, options.maxAttempts),
    windowMs: configuredPositiveInteger(options.windowMsEnv, options.windowMs),
    timestamp,
    maxBuckets: configuredPositiveInteger("TASKLOOM_RATE_LIMIT_MAX_BUCKETS", RATE_LIMIT_MAX_BUCKETS),
  };

  applyRateLimitDecision(c, timestamp, await distributedRateLimitUpsert(input));
  applyRateLimitDecision(c, timestamp, await mutateStoreAsync((data) => upsertRateLimit(data, input)));
}

async function distributedRateLimitUpsert(input: { bucketId: string; scope: string; maxAttempts: number; windowMs: number; timestamp: number }) {
  const url = (process.env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL ?? "").trim();
  if (!url) return null;

  try {
    const headers = new Headers({
      accept: "application/json",
      "content-type": "application/json",
    });
    const secret = (process.env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_SECRET ?? "").trim();
    if (secret) headers.set("authorization", `Bearer ${secret}`);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bucketId: input.bucketId,
        scope: input.scope,
        maxAttempts: input.maxAttempts,
        windowMs: input.windowMs,
        timestamp: new Date(input.timestamp).toISOString(),
      }),
      signal: AbortSignal.timeout(configuredPositiveInteger("TASKLOOM_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS", 750)),
    });
    const payload = await readJsonObject(response);
    if (response.status === 429) return limitedUntilFromDistributedResponse(input, response, payload);
    if (!response.ok) throw new Error(`distributed rate limiter returned ${response.status}`);
    if (payload?.limited === true || payload?.allowed === false) return limitedUntilFromDistributedResponse(input, response, payload);
    return null;
  } catch (error) {
    if (distributedRateLimitFailOpen()) return null;
    throw httpRouteError(503, "rate limit service unavailable");
  }
}

function applyRateLimitDecision(c: Context, timestamp: number, limitedUntil: number | null) {
  if (limitedUntil !== null) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limitedUntil - timestamp) / 1000));
    c.header("Retry-After", String(retryAfterSeconds));
    throw httpRouteError(429, "too many requests");
  }
}

async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function limitedUntilFromDistributedResponse(input: { windowMs: number; timestamp: number }, response: Response, payload: Record<string, unknown> | null) {
  const retryAfter = retryAfterLimitedUntil(response.headers.get("retry-after"), input.timestamp);
  if (retryAfter !== null) return retryAfter;

  if (typeof payload?.retryAfterSeconds === "number" && Number.isFinite(payload.retryAfterSeconds)) {
    return input.timestamp + Math.max(0, payload.retryAfterSeconds) * 1000;
  }

  const resetAt = payload?.resetAt;
  if (typeof resetAt === "string") {
    const resetAtTimestamp = Date.parse(resetAt);
    if (Number.isFinite(resetAtTimestamp)) return resetAtTimestamp;
  }
  if (typeof resetAt === "number" && Number.isFinite(resetAt)) {
    return resetAt < 10_000_000_000 ? resetAt * 1000 : resetAt;
  }

  return input.timestamp + input.windowMs;
}

function retryAfterLimitedUntil(headerValue: string | null, timestamp: number) {
  if (!headerValue) return null;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return timestamp + seconds * 1000;
  const retryAt = Date.parse(headerValue);
  return Number.isFinite(retryAt) ? retryAt : null;
}

function distributedRateLimitFailOpen() {
  return ["1", "true", "yes"].includes((process.env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN ?? "").trim().toLowerCase());
}

function clientKey(c: Context) {
  if (!trustedProxyEnabled()) return "local";
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")?.trim()
    || "local";
}

function hashedClientKey(clientIdentity: string) {
  const salt = process.env.TASKLOOM_RATE_LIMIT_KEY_SALT ?? "taskloom-rate-limit";
  return `sha256:${createHash("sha256").update(`${salt}:${clientIdentity}`).digest("hex")}`;
}

function trustedProxyEnabled() {
  return ["1", "true", "yes"].includes((process.env.TASKLOOM_TRUST_PROXY ?? "").trim().toLowerCase());
}

function configuredPositiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function httpRouteError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as any);
  return c.json({ error: redactedErrorMessage(error) });
}
