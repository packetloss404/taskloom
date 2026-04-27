import { Hono } from "hono";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import { getOperationsStatus } from "./operations-status.js";
import { redactedErrorMessage } from "./security/redaction.js";

export const operationsStatusRoutes = new Hono();

operationsStatusRoutes.get("/", (c) => {
  try {
    requirePrivateWorkspaceRole(c, "admin");
    return c.json(getOperationsStatus());
  } catch (error) {
    const status = ((error as { status?: number }).status ?? 500) as 401 | 403 | 404 | 500;
    return c.json({ error: redactedErrorMessage(error) }, status);
  }
});
