import { Hono } from "hono";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import { getOperationsHealthAsync } from "./operations-health.js";
import { redactedErrorMessage } from "./security/redaction.js";

export const operationsHealthRoutes = new Hono();

operationsHealthRoutes.get("/", async (c) => {
  try {
    requirePrivateWorkspaceRole(c, "admin");
    return c.json(await getOperationsHealthAsync());
  } catch (error) {
    const status = ((error as { status?: number }).status ?? 500) as 401 | 403 | 404 | 500;
    return c.json({ error: redactedErrorMessage(error) }, status);
  }
});
