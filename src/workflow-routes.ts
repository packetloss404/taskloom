import { Hono, type Context } from "hono";
import { requireAuthenticatedContext } from "./taskloom-services.js";

type AuthenticatedContext = ReturnType<typeof requireAuthenticatedContext>;
type WorkflowServiceFunction = (context: AuthenticatedContext, input?: unknown) => unknown;
type WorkflowServiceModule = Record<string, unknown>;

const workflowServiceFunctions = {
  getOverview: ["getWorkflowOverview", "getOverview"],
  getBrief: ["getWorkflowBrief", "readWorkspaceBrief", "getBrief"],
  saveBrief: ["saveWorkflowBrief", "updateWorkspaceBrief", "updateWorkflowBrief", "upsertWorkflowBrief"],
  listBriefVersions: ["listWorkspaceBriefHistory", "listBriefVersions"],
  restoreBriefVersion: ["restoreWorkspaceBriefVersion", "restoreBriefVersion"],
  listBriefTemplates: ["listWorkspaceBriefTemplates", "listBriefTemplates"],
  applyBriefTemplate: ["applyWorkspaceBriefTemplate", "applyBriefTemplate"],
  getRequirements: ["getWorkflowRequirements", "listRequirements", "getRequirements"],
  saveRequirements: ["saveWorkflowRequirements", "replaceRequirements", "updateWorkflowRequirements", "upsertWorkflowRequirements"],
  listPlanItems: ["listWorkflowPlanItems", "listPlanItems", "getWorkflowPlanItems"],
  savePlanItems: ["saveWorkflowPlanItems", "replacePlanItems", "updateWorkflowPlanItems"],
  createPlanItem: ["createWorkflowPlanItem", "addWorkflowPlanItem"],
  updatePlanItem: ["updateWorkflowPlanItem", "saveWorkflowPlanItem"],
  getBlockersAndQuestions: ["getWorkflowBlockersAndQuestions", "listBlockersAndQuestions"],
  saveBlockersAndQuestions: ["saveWorkflowBlockersAndQuestions", "replaceBlockersAndQuestions"],
  listBlockers: ["listWorkflowBlockers", "getWorkflowBlockers"],
  createBlocker: ["createWorkflowBlocker", "addWorkflowBlocker"],
  updateBlocker: ["updateWorkflowBlocker", "saveWorkflowBlocker"],
  listQuestions: ["listWorkflowQuestions", "getWorkflowQuestions"],
  createQuestion: ["createWorkflowQuestion", "addWorkflowQuestion"],
  updateQuestion: ["updateWorkflowQuestion", "saveWorkflowQuestion"],
  listValidationEvidence: ["listWorkflowValidationEvidence", "listValidationEvidence", "getWorkflowValidationEvidence"],
  saveValidationEvidence: ["saveWorkflowValidationEvidence", "replaceValidationEvidence", "updateWorkflowValidationEvidence"],
  createValidationEvidence: ["createWorkflowValidationEvidence", "addWorkflowValidationEvidence"],
  updateValidationEvidence: ["updateWorkflowValidationEvidence", "saveWorkflowValidationEvidence"],
  getReleaseConfirmation: ["getWorkflowReleaseConfirmation", "readReleaseConfirmation", "getReleaseConfirmation"],
  confirmRelease: ["confirmWorkflowRelease", "updateReleaseConfirmation", "saveWorkflowReleaseConfirmation", "confirmRelease"],
} as const;

type WorkflowOperation = keyof typeof workflowServiceFunctions;

export const workflowRoutes = new Hono();

workflowRoutes.get("/", (c) => runWorkflowOperation(c, "getOverview"));

workflowRoutes.get("/brief", (c) => runWorkflowOperation(c, "getBrief"));
workflowRoutes.put("/brief", (c) => runWorkflowOperation(c, "saveBrief", readJsonBody));

workflowRoutes.get("/brief/templates", (c) => runWorkflowOperation(c, "listBriefTemplates"));
workflowRoutes.post("/brief/templates/:templateId/apply", (c) =>
  runWorkflowOperation(c, "applyBriefTemplate", readJsonBody, ["templateId"]),
);

workflowRoutes.get("/brief/versions", (c) => runWorkflowOperation(c, "listBriefVersions"));
workflowRoutes.post("/brief/versions/:versionId/restore", (c) =>
  runWorkflowOperation(c, "restoreBriefVersion", readJsonBody, ["versionId"]),
);

workflowRoutes.get("/requirements", (c) => runWorkflowOperation(c, "getRequirements"));
workflowRoutes.put("/requirements", (c) => runWorkflowOperation(c, "saveRequirements", readJsonBody));

workflowRoutes.get("/plan-items", (c) => runWorkflowOperation(c, "listPlanItems"));
workflowRoutes.put("/plan-items", (c) => runWorkflowOperation(c, "savePlanItems", readJsonBody));
workflowRoutes.post("/plan-items", (c) => runWorkflowOperation(c, "createPlanItem", readJsonBody));
workflowRoutes.patch("/plan-items/:itemId", (c) => runWorkflowOperation(c, "updatePlanItem", readJsonBody, ["itemId"]));

workflowRoutes.get("/blockers-questions", (c) => runWorkflowOperation(c, "getBlockersAndQuestions"));
workflowRoutes.put("/blockers-questions", (c) => runWorkflowOperation(c, "saveBlockersAndQuestions", readJsonBody));

workflowRoutes.get("/blockers", (c) => runWorkflowOperation(c, "listBlockers"));
workflowRoutes.post("/blockers", (c) => runWorkflowOperation(c, "createBlocker", readJsonBody));
workflowRoutes.patch("/blockers/:blockerId", (c) => runWorkflowOperation(c, "updateBlocker", readJsonBody, ["blockerId"]));

workflowRoutes.get("/questions", (c) => runWorkflowOperation(c, "listQuestions"));
workflowRoutes.post("/questions", (c) => runWorkflowOperation(c, "createQuestion", readJsonBody));
workflowRoutes.patch("/questions/:questionId", (c) => runWorkflowOperation(c, "updateQuestion", readJsonBody, ["questionId"]));

workflowRoutes.get("/validation-evidence", (c) => runWorkflowOperation(c, "listValidationEvidence"));
workflowRoutes.put("/validation-evidence", (c) => runWorkflowOperation(c, "saveValidationEvidence", readJsonBody));
workflowRoutes.post("/validation-evidence", (c) => runWorkflowOperation(c, "createValidationEvidence", readJsonBody));
workflowRoutes.patch("/validation-evidence/:evidenceId", (c) =>
  runWorkflowOperation(c, "updateValidationEvidence", readJsonBody, ["evidenceId"]),
);

workflowRoutes.get("/release-confirmation", (c) => runWorkflowOperation(c, "getReleaseConfirmation"));
workflowRoutes.put("/release-confirmation", (c) => runWorkflowOperation(c, "confirmRelease", readJsonBody));
workflowRoutes.post("/release-confirmation", (c) => runWorkflowOperation(c, "confirmRelease", readJsonBody));

export default workflowRoutes;

async function runWorkflowOperation(
  c: Context,
  operation: WorkflowOperation,
  readBody?: (c: Context) => Promise<unknown>,
  paramNames: string[] = [],
) {
  try {
    const context = requireAuthenticatedContext(c);
    const service = await loadWorkflowService();
    if (!service) {
      throw httpError(501, "workflow service module is not available");
    }

    const handler = findServiceFunction(service, workflowServiceFunctions[operation]);
    if (!handler) {
      throw httpError(501, `workflow service handler is not available for ${operation}`);
    }

    const body = readBody ? await readBody(c) : {};
    const params = Object.fromEntries(paramNames.map((name) => [name, c.req.param(name)]));
    const input = paramNames.length > 0 ? { ...(isRecord(body) ? body : { value: body }), ...params } : body;

    const result = await handler(context, input);
    return c.json(result === undefined ? { ok: true } : (result as any));
  } catch (error) {
    return errorResponse(c, error);
  }
}

let workflowServicePromise: Promise<WorkflowServiceModule | null> | null = null;

async function loadWorkflowService(): Promise<WorkflowServiceModule | null> {
  workflowServicePromise ??= import("./workflow-service.js")
    .then((module) => module as WorkflowServiceModule)
    .catch((error: unknown) => {
      if (isMissingWorkflowService(error)) {
        return null;
      }
      throw error;
    });

  return workflowServicePromise;
}

function findServiceFunction(service: WorkflowServiceModule, names: readonly string[]): WorkflowServiceFunction | null {
  for (const name of names) {
    const candidate = service[name];
    if (typeof candidate === "function") {
      return candidate as WorkflowServiceFunction;
    }
  }
  return null;
}

async function readJsonBody(c: Context): Promise<unknown> {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    const body = await c.req.json();
    return body as unknown;
  } catch {
    throw httpError(400, "request body must be valid JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingWorkflowService(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  const message = (error as Error).message ?? "";
  return code === "ERR_MODULE_NOT_FOUND" && message.includes("workflow-service");
}

function errorResponse(c: Context, error: unknown) {
  const status = (error as Error & { status?: number }).status ?? 500;
  c.status(status as any);
  return c.json({ error: (error as Error).message });
}

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
