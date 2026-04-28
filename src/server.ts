import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import {
  archiveAgent,
  cancelAgentRun,
  createAgent,
  createAgentFromTemplate,
  createProvider,
  createWorkspaceEnvVar,
  deleteWorkspaceEnvVarById,
  getAgent,
  getPublicActivationSummary,
  handleInvitationEmailJob,
  INVITATION_EMAIL_JOB_TYPE,
  listPublicActivationSummaries,
  listAgentRuns,
  listAgentTemplates,
  listAgents,
  listProviders,
  listReleaseHistory,
  listWorkspaceEnvVarsForUser,
  retryAgentRun,
  recordRunAsPlaybook,
  runAgent,
  updateAgent,
  updateProvider,
  updateWorkspaceEnvVar,
} from "./taskloom-services.js";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import { appRoutes } from "./app-routes.js";
import { workflowRoutes } from "./workflow-routes.js";
import { apiKeyRoutes } from "./api-key-routes.js";
import { usageRoutes } from "./usage-routes.js";
import { llmStreamRoutes } from "./llm-stream-routes.js";
import { jobRoutes } from "./job-routes.js";
import { JobScheduler } from "./jobs/scheduler.js";
import { selectSchedulerLeaderLock } from "./jobs/scheduler-leader-selection.js";
import {
  ensureMetricsSnapshotCronJob,
  handleMetricsSnapshotJob,
  METRICS_SNAPSHOT_JOB_TYPE,
  type MetricsSnapshotJobPayload,
} from "./jobs/metrics-snapshot-handler.js";
import { registerDefaultProviders } from "./providers/bootstrap.js";
import { registerDefaultTools } from "./tools/bootstrap.js";
import { getDefaultToolRegistry } from "./tools/registry.js";
import { shareRoutes, publicShareRoutes } from "./share-routes.js";
import { agentWebhookRoutes, publicWebhookRoutes } from "./webhook-routes.js";
import { invitationEmailWebhookRoutes } from "./invitation-email-webhook-routes.js";
import { enforcePrivateAppMutationSecurity } from "./route-security.js";
import { redactedErrorMessage } from "./security/redaction.js";
import { accessLogMiddleware } from "./security/access-log.js";
import { healthRoutes } from "./health-routes.js";
import { operationsStatusRoutes } from "./operations-status-routes.js";
import { operationsHealthRoutes } from "./operations-health-routes.js";
import { operationsJobMetricsRoutes } from "./operations-job-metrics-routes.js";
import { operationsAlertsRoutes } from "./operations-alerts-routes.js";
import {
  ALERTS_EVALUATE_JOB_TYPE,
  ensureAlertsCronJob,
  handleAlertsEvaluateJob,
  type AlertsEvaluateJobPayload,
} from "./alerts/alerts-evaluate-handler.js";
import {
  ALERTS_DELIVER_JOB_TYPE,
  handleAlertsDeliverJob,
  type AlertsDeliverJobPayload,
} from "./alerts/alerts-deliver-handler.js";
import { assertManagedDatabaseRuntimeSupported } from "./deployment/managed-database-runtime-guard.js";

registerDefaultProviders();
registerDefaultTools();

const app = new Hono();

app.use("*", accessLogMiddleware());

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/health", healthRoutes);

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

app.use("/api/app/*", enforcePrivateAppMutationSecurity);

app.route("/api", appRoutes);

app.get("/api/app/agents", (c) => {
  try {
    return c.json(listAgents(requirePrivateWorkspaceRole(c, "viewer")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agents", async (c) => {
  try {
    return c.json(createAgent(requirePrivateWorkspaceRole(c, "admin"), await readJsonBody(c)), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/agents/:agentId", (c) => {
  try {
    return c.json(getAgent(requirePrivateWorkspaceRole(c, "viewer"), c.req.param("agentId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.patch("/api/app/agents/:agentId", async (c) => {
  try {
    return c.json(updateAgent(requirePrivateWorkspaceRole(c, "admin"), c.req.param("agentId"), await readJsonBody(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.delete("/api/app/agents/:agentId", (c) => {
  try {
    return c.json(archiveAgent(requirePrivateWorkspaceRole(c, "admin"), c.req.param("agentId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agents/:agentId/runs", async (c) => {
  try {
    const body = (await readJsonBody(c)) as { triggerKind?: string; inputs?: Record<string, unknown> };
    const inputs = body && typeof body.inputs === "object" && body.inputs !== null ? body.inputs : {};
    return c.json(await runAgent(requirePrivateWorkspaceRole(c, "member"), c.req.param("agentId"), {
      triggerKind: body?.triggerKind,
      inputs,
    }), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/agent-templates", (c) => {
  try {
    requirePrivateWorkspaceRole(c, "viewer");
    return c.json(listAgentTemplates());
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agents/from-template/:templateId", async (c) => {
  try {
    const body = await readJsonBody(c);
    return c.json(createAgentFromTemplate(requirePrivateWorkspaceRole(c, "admin"), c.req.param("templateId"), {
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
    return c.json(listProviders(requirePrivateWorkspaceRole(c, "viewer")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/providers", async (c) => {
  try {
    return c.json(createProvider(requirePrivateWorkspaceRole(c, "admin"), await readJsonBody(c)), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.patch("/api/app/providers/:providerId", async (c) => {
  try {
    return c.json(updateProvider(requirePrivateWorkspaceRole(c, "admin"), c.req.param("providerId"), await readJsonBody(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/agent-runs", (c) => {
  try {
    return c.json(listAgentRuns(requirePrivateWorkspaceRole(c, "viewer")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/cancel", (c) => {
  try {
    return c.json(cancelAgentRun(requirePrivateWorkspaceRole(c, "member"), c.req.param("runId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/retry", async (c) => {
  try {
    return c.json(await retryAgentRun(requirePrivateWorkspaceRole(c, "member"), c.req.param("runId")), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/record-as-playbook", (c) => {
  try {
    return c.json(recordRunAsPlaybook(requirePrivateWorkspaceRole(c, "member"), c.req.param("runId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/agent-runs/:runId/diagnose", async (c) => {
  try {
    const ctx = requirePrivateWorkspaceRole(c, "member");
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
    requirePrivateWorkspaceRole(c, "viewer");
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
    return c.json(listWorkspaceEnvVarsForUser(requirePrivateWorkspaceRole(c, "viewer")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.post("/api/app/env-vars", async (c) => {
  try {
    return c.json(createWorkspaceEnvVar(requirePrivateWorkspaceRole(c, "admin"), await readJsonBody(c)), 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.patch("/api/app/env-vars/:envVarId", async (c) => {
  try {
    return c.json(updateWorkspaceEnvVar(requirePrivateWorkspaceRole(c, "admin"), c.req.param("envVarId"), await readJsonBody(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.delete("/api/app/env-vars/:envVarId", (c) => {
  try {
    return c.json(deleteWorkspaceEnvVarById(requirePrivateWorkspaceRole(c, "admin"), c.req.param("envVarId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

app.get("/api/app/release-history", (c) => {
  try {
    return c.json(listReleaseHistory(requirePrivateWorkspaceRole(c, "viewer")));
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
app.route("/api/public/webhooks/invitation-email", invitationEmailWebhookRoutes);
app.route("/api/app/operations/status", operationsStatusRoutes);
app.route("/api/app/operations/health", operationsHealthRoutes);
app.route("/api/app/operations/job-metrics", operationsJobMetricsRoutes);
app.route("/api/app/operations/alerts", operationsAlertsRoutes);

const scheduler = new JobScheduler({ leaderLock: selectSchedulerLeaderLock() });
scheduler.register({
  type: "agent.run",
  async handle(job) {
    const payload = job.payload as { agentId?: string; triggerKind?: string; inputs?: Record<string, unknown> };
    if (!payload.agentId) throw new Error("agent.run job missing agentId");
    const { loadStore } = await import("./taskloom-store.js");
    const data = loadStore();
    const agent = data.agents.find((a) => a.id === payload.agentId);
    if (!agent) throw new Error(`agent ${payload.agentId} not found`);
    if (agent.workspaceId !== job.workspaceId) throw new Error(`agent ${payload.agentId} is not in job workspace`);
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
scheduler.register({
  type: INVITATION_EMAIL_JOB_TYPE,
  async handle(job) {
    return handleInvitationEmailJob(job);
  },
});
scheduler.register({
  type: METRICS_SNAPSHOT_JOB_TYPE,
  async handle(job) {
    return handleMetricsSnapshotJob(job.payload as MetricsSnapshotJobPayload);
  },
});
scheduler.register({
  type: ALERTS_EVALUATE_JOB_TYPE,
  async handle(job) {
    return handleAlertsEvaluateJob(job.payload as AlertsEvaluateJobPayload);
  },
});
scheduler.register({
  type: ALERTS_DELIVER_JOB_TYPE,
  async handle(job) {
    return handleAlertsDeliverJob(job.payload as unknown as AlertsDeliverJobPayload);
  },
});
assertManagedDatabaseRuntimeSupported(process.env);
scheduler.start();
ensureMetricsSnapshotCronJob();
ensureAlertsCronJob();
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
  return c.json({ error: redactedErrorMessage(error) });
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
