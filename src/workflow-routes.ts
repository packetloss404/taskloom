import { Hono, type Context } from "hono";
import { assertPermission, type WorkspacePermission } from "./rbac.js";
import { requireAuthenticatedContext } from "./taskloom-services.js";
import { findWorkspaceMembership, loadStore } from "./taskloom-store.js";
import {
  applyWorkflowDraft,
  applyWorkflowTemplate,
  listWorkflowTemplates,
} from "./workflow-prompt-service.js";
import { llmDraftWorkflow, llmPlanMode } from "./workflow-llm-service.js";
import { replacePlanItems } from "./workflow-service.js";
import { redactedErrorMessage } from "./security/redaction.js";

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
workflowRoutes.put("/brief", (c) => runWorkflowOperation(c, "saveBrief", readJsonBody, [], "editWorkflow"));

workflowRoutes.get("/brief/templates", (c) => runWorkflowOperation(c, "listBriefTemplates"));
workflowRoutes.post("/brief/templates/:templateId/apply", (c) =>
  runWorkflowOperation(c, "applyBriefTemplate", readJsonBody, ["templateId"], "editWorkflow"),
);

workflowRoutes.get("/brief/versions", (c) => runWorkflowOperation(c, "listBriefVersions"));
workflowRoutes.post("/brief/versions/:versionId/restore", (c) =>
  runWorkflowOperation(c, "restoreBriefVersion", readJsonBody, ["versionId"], "editWorkflow"),
);

workflowRoutes.get("/requirements", (c) => runWorkflowOperation(c, "getRequirements"));
workflowRoutes.put("/requirements", (c) => runWorkflowOperation(c, "saveRequirements", readJsonBody, [], "editWorkflow"));

workflowRoutes.get("/plan-items", (c) => runWorkflowOperation(c, "listPlanItems"));
workflowRoutes.put("/plan-items", (c) => runWorkflowOperation(c, "savePlanItems", readJsonBody, [], "editWorkflow"));
workflowRoutes.post("/plan-items", (c) => runWorkflowOperation(c, "createPlanItem", readJsonBody, [], "editWorkflow"));
workflowRoutes.patch("/plan-items/:itemId", (c) =>
  runWorkflowOperation(c, "updatePlanItem", readJsonBody, ["itemId"], "editWorkflow"),
);

workflowRoutes.get("/blockers-questions", (c) => runWorkflowOperation(c, "getBlockersAndQuestions"));
workflowRoutes.put("/blockers-questions", (c) =>
  runWorkflowOperation(c, "saveBlockersAndQuestions", readJsonBody, [], "editWorkflow"),
);

workflowRoutes.get("/blockers", (c) => runWorkflowOperation(c, "listBlockers"));
workflowRoutes.post("/blockers", (c) => runWorkflowOperation(c, "createBlocker", readJsonBody, [], "editWorkflow"));
workflowRoutes.patch("/blockers/:blockerId", (c) =>
  runWorkflowOperation(c, "updateBlocker", readJsonBody, ["blockerId"], "editWorkflow"),
);

workflowRoutes.get("/questions", (c) => runWorkflowOperation(c, "listQuestions"));
workflowRoutes.post("/questions", (c) => runWorkflowOperation(c, "createQuestion", readJsonBody, [], "editWorkflow"));
workflowRoutes.patch("/questions/:questionId", (c) =>
  runWorkflowOperation(c, "updateQuestion", readJsonBody, ["questionId"], "editWorkflow"),
);

workflowRoutes.get("/validation-evidence", (c) => runWorkflowOperation(c, "listValidationEvidence"));
workflowRoutes.put("/validation-evidence", (c) =>
  runWorkflowOperation(c, "saveValidationEvidence", readJsonBody, [], "editWorkflow"),
);
workflowRoutes.post("/validation-evidence", (c) =>
  runWorkflowOperation(c, "createValidationEvidence", readJsonBody, [], "editWorkflow"),
);
workflowRoutes.patch("/validation-evidence/:evidenceId", (c) =>
  runWorkflowOperation(c, "updateValidationEvidence", readJsonBody, ["evidenceId"], "editWorkflow"),
);

workflowRoutes.get("/release-confirmation", (c) => runWorkflowOperation(c, "getReleaseConfirmation"));
workflowRoutes.put("/release-confirmation", (c) =>
  runWorkflowOperation(c, "confirmRelease", readJsonBody, [], "editWorkflow"),
);
workflowRoutes.post("/release-confirmation", (c) =>
  runWorkflowOperation(c, "confirmRelease", readJsonBody, [], "editWorkflow"),
);

workflowRoutes.get("/templates", (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkflowPermission(context, "viewWorkspace");
    return c.json({ templates: listWorkflowTemplates() });
  } catch (error) {
    return errorResponse(c, error);
  }
});

workflowRoutes.post("/templates/:templateId/apply", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkflowPermission(context, "editWorkflow");
    const result = await applyWorkflowTemplate(context, c.req.param("templateId"));
    return c.json(result);
  } catch (error) {
    return errorResponse(c, error);
  }
});

workflowRoutes.post("/generate-from-prompt", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkflowPermission(context, "editWorkflow");
    const body = (await readJsonBody(c)) as { prompt?: string; apply?: boolean } | undefined;
    const prompt = body?.prompt ?? "";
    const apply = Boolean(body?.apply);
    const llm = await llmDraftWorkflow({ workspaceId: context.workspace.id, prompt });
    if (!apply) {
      return c.json({ draft: llm.draft, applied: false, modelUsed: llm.modelUsed, costUsd: llm.costUsd });
    }
    return c.json({ ...applyWorkflowDraft(context, llm.draft), modelUsed: llm.modelUsed, costUsd: llm.costUsd });
  } catch (error) {
    return errorResponse(c, error);
  }
});

workflowRoutes.post("/plan-mode", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkflowPermission(context, "editWorkflow");
    const result = await llmPlanMode(context);
    return c.json(result);
  } catch (error) {
    return errorResponse(c, error);
  }
});

workflowRoutes.post("/plan-mode/apply", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkflowPermission(context, "editWorkflow");
    const body = (await readJsonBody(c)) as { planItems?: { summary: string; status?: string }[] } | undefined;
    const items = (body?.planItems ?? []).map((p) => {
      const raw = String(p.status ?? "todo");
      const status: "todo" | "in_progress" | "done" =
        raw === "in_progress" || raw === "doing" ? "in_progress" : raw === "done" ? "done" : "todo";
      return { title: p.summary, description: "", status };
    }).filter((p) => p.title.length > 0);
    const planItems = replacePlanItems(context, items);
    return c.json({ planItems });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default workflowRoutes;

async function runWorkflowOperation(
  c: Context,
  operation: WorkflowOperation,
  readBody?: (c: Context) => Promise<unknown>,
  paramNames: string[] = [],
  permission: WorkspacePermission = "viewWorkspace",
) {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkflowPermission(context, permission);
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

function requireWorkflowPermission(context: AuthenticatedContext, permission: WorkspacePermission) {
  const membership = findWorkspaceMembership(loadStore(), context.workspace.id, context.user.id);
  assertPermission(membership, permission);
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
  return c.json({ error: redactedErrorMessage(error) });
}

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
