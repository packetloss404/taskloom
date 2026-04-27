import { Hono, type Context } from "hono";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import { listProviderCalls, summarizeUsage } from "./providers/ledger.js";
import { redactedErrorMessage } from "./security/redaction.js";

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as 500);
  return c.json({ error: redactedErrorMessage(error) });
}

export const usageRoutes = new Hono();

usageRoutes.get("/summary", (c) => {
  try {
    const { workspace } = requirePrivateWorkspaceRole(c, "viewer");
    return c.json({ summary: summarizeUsage(workspace.id) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

usageRoutes.get("/calls", (c) => {
  try {
    const { workspace } = requirePrivateWorkspaceRole(c, "viewer");
    const limit = Number(c.req.query("limit") ?? 100);
    return c.json({ calls: listProviderCalls(workspace.id, { limit }) });
  } catch (error) {
    return errorResponse(c, error);
  }
});
