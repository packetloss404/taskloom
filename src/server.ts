import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import {
  applySessionCookie,
  archiveAgent,
  cancelAgentRun,
  completeOnboardingStep,
  createAgent,
  createAgentFromTemplate,
  createProvider,
  createWorkspaceEnvVar,
  deleteWorkspaceEnvVarById,
  getActivationDetail,
  getAgent,
  getOnboarding,
  getPrivateBootstrap,
  getPublicActivationSummary,
  getWorkspaceActivityDetail,
  getSessionPayload,
  listPublicActivationSummaries,
  listAgentRuns,
  listAgentTemplates,
  listAgents,
  listProviders,
  listReleaseHistory,
  listWorkspaceActivities,
  listWorkspaceEnvVarsForUser,
  login,
  logout,
  register,
  requireAuthenticatedContext,
  restoreSession,
  retryAgentRun,
  recordRunAsPlaybook,
  runAgent,
  updateAgent,
  updateProvider,
  updateProfile,
  updateWorkspace,
  updateWorkspaceEnvVar,
} from "./taskloom-services.js";
import { workflowRoutes } from "./workflow-routes.js";
import { apiKeyRoutes } from "./api-key-routes.js";
import { usageRoutes } from "./usage-routes.js";
import { llmStreamRoutes } from "./llm-stream-routes.js";
import { jobRoutes } from "./job-routes.js";
import { JobScheduler } from "./jobs/scheduler.js";
import { registerDefaultProviders } from "./providers/bootstrap.js";
import { registerDefaultTools } from "./tools/bootstrap.js";
import { shareRoutes, publicShareRoutes } from "./share-routes.js";
import { agentWebhookRoutes, publicWebhookRoutes } from "./webhook-routes.js";

registerDefaultProviders();
registerDefaultTools();

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/activation", async (c) => {
  const summaries = await listPublicActivationSummaries();
  return c.json({ summaries });
});

app.get("/api/activation/:workspaceId", async (c) => {
  const summary = await getPublicActivationSummary(c.req.param("workspaceId"));
  if (!summary) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json(summary);
});

app.get("/api/auth/session", (c) => {
  const context = restoreSession(c);
  if (!context) {
    return c.json({ authenticated: false, user: null, workspace: null, onboarding: null });
  }

  return c.json(getSessionPayload(context));
});

app.post("/api/auth/register", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string; password?: string; displayName?: string };
    const result = register({
      email: body.email ?? "",
      password: body.password ?? "",
      displayName: body.displayName ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    c.status(201);
    return c.json(getSessionPayload(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/auth/login", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string; password?: string };
    const result = login({
      email: body.email ?? "",
      password: body.password ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    return c.json(getSessionPayload(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/auth/logout", (c) => {
  logout(c);
  return c.json({ ok: true });
});

app.get("/api/app/bootstrap", async (c) => {
  try {
    return c.json(await getPrivateBootstrap(requireAuthenticatedContext(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/activation", async (c) => {
  try {
    return c.json(await getActivationDetail(requireAuthenticatedContext(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/onboarding", (c) => {
  try {
    return c.json({ onboarding: getOnboarding(requireAuthenticatedContext(c)) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/onboarding/steps/:stepKey/complete", async (c) => {
  try {
    return c.json({ onboarding: await completeOnboardingStep(requireAuthenticatedContext(c), c.req.param("stepKey")) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.patch("/api/app/profile", async (c) => {
  try {
    const body = (await c.req.json()) as { displayName?: string; timezone?: string };
    const user = await updateProfile(requireAuthenticatedContext(c), {
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

app.patch("/api/app/workspace", async (c) => {
  try {
    const body = (await c.req.json()) as { name?: string; website?: string; automationGoal?: string };
    const workspace = await updateWorkspace(requireAuthenticatedContext(c), {
      name: body.name ?? "",
      website: body.website ?? "",
      automationGoal: body.automationGoal ?? "",
    });
    return c.json({ workspace });
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/activity", (c) => {
  try {
    return c.json({ activities: listWorkspaceActivities(requireAuthenticatedContext(c)) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/activity/:id", (c) => {
  try {
    return c.json(getWorkspaceActivityDetail(requireAuthenticatedContext(c), c.req.param("id")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/agents", (c) => {
  try {
    return c.json(listAgents(requireAuthenticatedContext(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agents", async (c) => {
  try {
    return c.json(createAgent(requireAuthenticatedContext(c), await readJsonBody(c)), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/agents/:agentId", (c) => {
  try {
    return c.json(getAgent(requireAuthenticatedContext(c), c.req.param("agentId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.patch("/api/app/agents/:agentId", async (c) => {
  try {
    return c.json(updateAgent(requireAuthenticatedContext(c), c.req.param("agentId"), await readJsonBody(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.delete("/api/app/agents/:agentId", (c) => {
  try {
    return c.json(archiveAgent(requireAuthenticatedContext(c), c.req.param("agentId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agents/:agentId/runs", async (c) => {
  try {
    const body = (await readJsonBody(c)) as { triggerKind?: string; inputs?: Record<string, unknown> };
    const inputs = body && typeof body.inputs === "object" && body.inputs !== null ? body.inputs : {};
    return c.json(await runAgent(requireAuthenticatedContext(c), c.req.param("agentId"), {
      triggerKind: body?.triggerKind,
      inputs,
    }), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/agent-templates", (c) => {
  try {
    requireAuthenticatedContext(c);
    return c.json(listAgentTemplates());
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agents/from-template/:templateId", async (c) => {
  try {
    const body = await readJsonBody(c);
    return c.json(createAgentFromTemplate(requireAuthenticatedContext(c), c.req.param("templateId"), {
      name: typeof body.name === "string" ? body.name : undefined,
      providerId: typeof body.providerId === "string" ? body.providerId : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
    }), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/providers", (c) => {
  try {
    return c.json(listProviders(requireAuthenticatedContext(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/providers", async (c) => {
  try {
    return c.json(createProvider(requireAuthenticatedContext(c), await readJsonBody(c)), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.patch("/api/app/providers/:providerId", async (c) => {
  try {
    return c.json(updateProvider(requireAuthenticatedContext(c), c.req.param("providerId"), await readJsonBody(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/agent-runs", (c) => {
  try {
    return c.json(listAgentRuns(requireAuthenticatedContext(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/cancel", (c) => {
  try {
    return c.json(cancelAgentRun(requireAuthenticatedContext(c), c.req.param("runId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/retry", async (c) => {
  try {
    return c.json(await retryAgentRun(requireAuthenticatedContext(c), c.req.param("runId")), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/record-as-playbook", (c) => {
  try {
    return c.json(recordRunAsPlaybook(requireAuthenticatedContext(c), c.req.param("runId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/diagnose", async (c) => {
  try {
    const ctx = requireAuthenticatedContext(c);
    const { loadStore } = await import("./taskloom-store.js");
    const data = loadStore();
    const run = data.agentRuns.find((r) => r.id === c.req.param("runId") && r.workspaceId === ctx.workspace.id);
    if (!run) return errorResponse(c, Object.assign(new Error("agent run not found"), { status: 404 }));
    const { diagnoseFailedRun } = await import("./diagnostics.js");
    const diagnostic = await diagnoseFailedRun({ workspaceId: ctx.workspace.id, run });
    return c.json({ diagnostic });
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/tools", (c) => {
  try {
    requireAuthenticatedContext(c);
    const { getDefaultToolRegistry } = require("./tools/registry.js");
    const registry = getDefaultToolRegistry();
    return c.json({
      tools: registry.list().map((t: { name: string; description: string; side: string }) => ({
        name: t.name,
        description: t.description,
        side: t.side,
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/env-vars", (c) => {
  try {
    return c.json(listWorkspaceEnvVarsForUser(requireAuthenticatedContext(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/env-vars", async (c) => {
  try {
    return c.json(createWorkspaceEnvVar(requireAuthenticatedContext(c), await readJsonBody(c)), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.patch("/api/app/env-vars/:envVarId", async (c) => {
  try {
    return c.json(updateWorkspaceEnvVar(requireAuthenticatedContext(c), c.req.param("envVarId"), await readJsonBody(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.delete("/api/app/env-vars/:envVarId", (c) => {
  try {
    return c.json(deleteWorkspaceEnvVarById(requireAuthenticatedContext(c), c.req.param("envVarId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/release-history", (c) => {
  try {
    return c.json(listReleaseHistory(requireAuthenticatedContext(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.route("/api/app/workflow", workflowRoutes);
app.route("/api/app/api-keys", apiKeyRoutes);
app.route("/api/app/usage", usageRoutes);
app.route("/api/app/llm", llmStreamRoutes);
app.route("/api/app/jobs", jobRoutes);
app.route("/api/app/share", shareRoutes);
app.route("/api/public/share", publicShareRoutes);
app.route("/api/app/webhooks", agentWebhookRoutes);
app.route("/api/public/webhooks", publicWebhookRoutes);

const scheduler = new JobScheduler();
scheduler.register({
  type: "agent.run",
  async handle(job) {
    const payload = job.payload as { agentId?: string; triggerKind?: string; inputs?: Record<string, unknown> };
    if (!payload.agentId) throw new Error("agent.run job missing agentId");
    const { loadStore } = await import("./taskloom-store.js");
    const data = loadStore();
    const agent = data.agents.find((a) => a.id === payload.agentId);
    if (!agent) throw new Error(`agent ${payload.agentId} not found`);
    const owner = data.users.find((u) => u.id === agent.createdByUserId);
    if (!owner) throw new Error(`agent owner not found`);
    const context = {
      user: { id: owner.id, email: owner.email, displayName: owner.displayName, timezone: owner.timezone },
      workspace: { id: agent.workspaceId, name: "", slug: "", website: "", automationGoal: "", createdAt: "", updatedAt: "" },
    };
    const liveWorkspace = data.workspaces.find((w) => w.id === agent.workspaceId);
    if (liveWorkspace) Object.assign(context.workspace, liveWorkspace);
    const { runAgent } = await import("./taskloom-services.js");
    const result = await runAgent(context as never, agent.id, {
      triggerKind: payload.triggerKind,
      inputs: payload.inputs,
    });
    return { runId: result.run.id, status: result.run.status };
  },
});
scheduler.start();
const shutdown = async () => {
  await scheduler.stop();
  try {
    const { shutdownAllBrowserSessions } = await import("./tools/browser-runtime.js");
    await shutdownAllBrowserSessions();
  } catch { /* ignore */ }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.use("/data/artifacts/*", serveStatic({ root: "./" }));

if (existsSync("./web/dist/index.html")) {
  app.use("/*", serveStatic({ root: "./web/dist" }));
  app.get("*", serveStatic({ path: "./web/dist/index.html" }));
}

const port = Number(process.env.PORT ?? 8484);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`taskloom listening on http://localhost:${info.port}`);
});

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as any);
  return c.json({ error: (error as Error).message });
}

async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("application/json")) return {};
  try {
    const body = await c.req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    throw Object.assign(new Error("request body must be valid JSON"), { status: 400 });
  }
}
