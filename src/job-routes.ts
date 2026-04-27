import { Hono, type Context } from "hono";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import { cancelJob, enqueueJob, findJob, listJobs } from "./jobs/store.js";
import { parseCron } from "./jobs/cron.js";
import { findAgentForWorkspaceIndexed } from "./taskloom-store.js";
import type { JobRecord, JobStatus } from "./taskloom-store.js";
import { redactSensitiveString, redactSensitiveValue } from "./security/redaction.js";

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as 500);
  return c.json({ error: redactSensitiveString((error as Error).message) });
}

function serializeJob(job: JobRecord): JobRecord {
  return {
    ...job,
    payload: redactSensitiveValue(job.payload) as Record<string, unknown>,
    result: redactSensitiveValue(job.result),
    error: job.error ? redactSensitiveString(job.error) : undefined,
  };
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function validateJobInput(body: Partial<{
  type: string;
  payload: Record<string, unknown>;
  scheduledAt: string;
  cron: string;
  maxAttempts: number;
}>, workspaceId: string) {
  if (body.scheduledAt !== undefined && Number.isNaN(Date.parse(body.scheduledAt))) {
    throw badRequest("scheduledAt must be a valid date");
  }
  if (body.cron !== undefined) {
    try {
      parseCron(body.cron);
    } catch {
      throw badRequest("cron must be a valid 5-field expression");
    }
  }
  if (body.maxAttempts !== undefined && (!Number.isInteger(body.maxAttempts) || body.maxAttempts < 1)) {
    throw badRequest("maxAttempts must be a positive integer");
  }
  if (body.type === "agent.run") {
    const agentId = body.payload?.agentId;
    if (typeof agentId !== "string") throw badRequest("agent.run payload.agentId is required");
    const agent = findAgentForWorkspaceIndexed(workspaceId, agentId);
    if (!agent) {
      throw badRequest("agent.run payload.agentId must reference an agent in this workspace");
    }
  }
}

export const jobRoutes = new Hono();

jobRoutes.get("/", (c) => {
  try {
    const { workspace } = requirePrivateWorkspaceRole(c, "viewer");
    const status = c.req.query("status") as JobStatus | undefined;
    const limit = Number(c.req.query("limit") ?? 50);
    return c.json({ jobs: listJobs(workspace.id, { status, limit }).map(serializeJob) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

jobRoutes.post("/", async (c) => {
  try {
    const { workspace } = requirePrivateWorkspaceRole(c, "admin");
    const body = (await c.req.json().catch(() => ({}))) as Partial<{
      type: string;
      payload: Record<string, unknown>;
      scheduledAt: string;
      cron: string;
      maxAttempts: number;
    }>;
    if (!body.type) return errorResponse(c, badRequest("type is required"));
    validateJobInput(body, workspace.id);
    const job = enqueueJob({
      workspaceId: workspace.id,
      type: body.type,
      payload: body.payload ?? {},
      ...(body.scheduledAt ? { scheduledAt: body.scheduledAt } : {}),
      ...(body.cron ? { cron: body.cron } : {}),
      ...(body.maxAttempts !== undefined ? { maxAttempts: body.maxAttempts } : {}),
    });
    return c.json({ job: serializeJob(job) }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

jobRoutes.get("/:id", (c) => {
  try {
    const { workspace } = requirePrivateWorkspaceRole(c, "viewer");
    const job = findJob(c.req.param("id"));
    if (!job || job.workspaceId !== workspace.id) return errorResponse(c, Object.assign(new Error("not found"), { status: 404 }));
    return c.json({ job: serializeJob(job) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

jobRoutes.post("/:id/cancel", (c) => {
  try {
    const { workspace } = requirePrivateWorkspaceRole(c, "admin");
    const existing = findJob(c.req.param("id"));
    if (!existing || existing.workspaceId !== workspace.id) return errorResponse(c, Object.assign(new Error("not found"), { status: 404 }));
    const job = cancelJob(existing.id);
    if (!job) return errorResponse(c, Object.assign(new Error("not found"), { status: 404 }));
    return c.json({ ok: true, job: serializeJob(job) });
  } catch (error) {
    return errorResponse(c, error);
  }
});
