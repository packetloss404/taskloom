import { Hono } from "hono";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import { getOperationsHealth } from "./operations-health.js";
import { redactedErrorMessage } from "./security/redaction.js";

export const operationsHealthRoutes = new Hono();

operationsHealthRoutes.get("/", (c) => {
  try {
    requirePrivateWorkspaceRole(c, "admin");
    return c.json(getOperationsHealth());
  } catch (error) {
    const status = ((error as { status?: number }).status ?? 500) as 401 | 403 | 404 | 500;
    return c.json({ error: redactedErrorMessage(error) }, status);
  }
});
