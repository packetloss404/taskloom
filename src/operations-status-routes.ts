import { Hono } from "hono";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import { getOperationsStatusAsync } from "./operations-status.js";
import { redactedErrorMessage } from "./security/redaction.js";

export const operationsStatusRoutes = new Hono();

operationsStatusRoutes.get("/", async (c) => {
  try {
    requirePrivateWorkspaceRole(c, "admin");
    return c.json(await getOperationsStatusAsync());
  } catch (error) {
    const status = ((error as { status?: number }).status ?? 500) as 401 | 403 | 404 | 500;
    return c.json({ error: redactedErrorMessage(error) }, status);
  }
});
