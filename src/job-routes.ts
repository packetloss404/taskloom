import { Hono, type Context } from "hono";
import { requireAuthenticatedContext } from "./taskloom-services.js";
import { cancelJob, enqueueJob, findJob, listJobs } from "./jobs/store.js";
import type { JobStatus } from "./taskloom-store.js";

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as 500);
  return c.json({ error: (error as Error).message });
}

export const jobRoutes = new Hono();

jobRoutes.get("/", (c) => {
  try {
    const { workspace } = requireAuthenticatedContext(c);
    const status = c.req.query("status") as JobStatus | undefined;
    const limit = Number(c.req.query("limit") ?? 50);
    return c.json({ jobs: listJobs(workspace.id, { status, limit }) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

jobRoutes.post("/", async (c) => {
  try {
    const { workspace } = requireAuthenticatedContext(c);
    const body = (await c.req.json().catch(() => ({}))) as Partial<{
      type: string;
      payload: Record<string, unknown>;
      scheduledAt: string;
      cron: string;
      maxAttempts: number;
    }>;
    if (!body.type) return errorResponse(c, Object.assign(new Error("type is required"), { status: 400 }));
    const job = enqueueJob({
      workspaceId: workspace.id,
      type: body.type,
      payload: body.payload ?? {},
      ...(body.scheduledAt ? { scheduledAt: body.scheduledAt } : {}),
      ...(body.cron ? { cron: body.cron } : {}),
      ...(body.maxAttempts !== undefined ? { maxAttempts: body.maxAttempts } : {}),
    });
    return c.json({ job }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

jobRoutes.get("/:id", (c) => {
  try {
    requireAuthenticatedContext(c);
    const job = findJob(c.req.param("id"));
    if (!job) return errorResponse(c, Object.assign(new Error("not found"), { status: 404 }));
    return c.json({ job });
  } catch (error) {
    return errorResponse(c, error);
  }
});

jobRoutes.post("/:id/cancel", (c) => {
  try {
    requireAuthenticatedContext(c);
    const job = cancelJob(c.req.param("id"));
    if (!job) return errorResponse(c, Object.assign(new Error("not found"), { status: 404 }));
    return c.json({ ok: true, job });
  } catch (error) {
    return errorResponse(c, error);
  }
});
