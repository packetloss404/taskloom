import { randomUUID, randomBytes } from "node:crypto";
import { Hono, type Context } from "hono";
import { requirePrivateWorkspaceRole } from "./rbac.js";
import {
  loadStore,
  mutateStore,
  findWorkspaceBrief,
  listImplementationPlanItemsForWorkspace,
  listRequirementsForWorkspace,
  type ShareTokenRecord,
  type ShareTokenScope,
} from "./taskloom-store.js";

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as 500);
  return c.json({ error: (error as Error).message });
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateToken(): string {
  return randomBytes(18).toString("base64url");
}

const VALID_SCOPES: ShareTokenScope[] = ["brief", "plan", "overview"];

export const shareRoutes = new Hono();

shareRoutes.get("/", (c) => {
  try {
    const ctx = requirePrivateWorkspaceRole(c, "viewer");
    const data = loadStore();
    const tokens = data.shareTokens
      .filter((t) => t.workspaceId === ctx.workspace.id)
      .map((t) => ({
        id: t.id,
        token: t.token,
        scope: t.scope,
        revokedAt: t.revokedAt,
        expiresAt: t.expiresAt,
        readCount: t.readCount,
        lastReadAt: t.lastReadAt,
        createdAt: t.createdAt,
      }));
    return c.json({ tokens });
  } catch (error) {
    return errorResponse(c, error);
  }
});

shareRoutes.post("/", async (c) => {
  try {
    const ctx = requirePrivateWorkspaceRole(c, "admin");
    const body = (await c.req.json().catch(() => ({}))) as { scope?: string; expiresAt?: string };
    const scope = (body.scope ?? "overview") as ShareTokenScope;
    if (!VALID_SCOPES.includes(scope)) {
      return errorResponse(c, Object.assign(new Error(`scope must be one of ${VALID_SCOPES.join(", ")}`), { status: 400 }));
    }
    const record: ShareTokenRecord = {
      id: randomUUID(),
      workspaceId: ctx.workspace.id,
      token: generateToken(),
      scope,
      createdByUserId: ctx.user.id,
      ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}),
      readCount: 0,
      createdAt: nowIso(),
    };
    mutateStore((data) => { data.shareTokens.push(record); });
    return c.json({ token: record }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

shareRoutes.delete("/:id", (c) => {
  try {
    const ctx = requirePrivateWorkspaceRole(c, "admin");
    const id = c.req.param("id");
    const ok = mutateStore((data) => {
      const t = data.shareTokens.find((entry) => entry.id === id && entry.workspaceId === ctx.workspace.id);
      if (!t) return false;
      t.revokedAt = nowIso();
      return true;
    });
    if (!ok) return errorResponse(c, Object.assign(new Error("share token not found"), { status: 404 }));
    return c.json({ ok: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export const publicShareRoutes = new Hono();

publicShareRoutes.get("/:token", (c) => {
  try {
    const tokenParam = c.req.param("token");
    const data = loadStore();
    const record = data.shareTokens.find((t) => t.token === tokenParam);
    if (!record || record.revokedAt) return errorResponse(c, Object.assign(new Error("not found"), { status: 404 }));
    if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
      return errorResponse(c, Object.assign(new Error("share token expired"), { status: 410 }));
    }
    mutateStore((store) => {
      const live = store.shareTokens.find((t) => t.id === record.id);
      if (live) {
        live.lastReadAt = nowIso();
        live.readCount += 1;
      }
    });
    const workspace = data.workspaces.find((w) => w.id === record.workspaceId);
    if (!workspace) return errorResponse(c, Object.assign(new Error("workspace not found"), { status: 404 }));
    const brief = findWorkspaceBrief(data, record.workspaceId);
    const requirements = listRequirementsForWorkspace(data, record.workspaceId);
    const planItems = listImplementationPlanItemsForWorkspace(data, record.workspaceId);
    const payload: Record<string, unknown> = {
      scope: record.scope,
      workspace: { id: workspace.id, name: workspace.name, automationGoal: workspace.automationGoal },
    };
    if (record.scope === "brief" || record.scope === "overview") payload.brief = brief;
    if (record.scope === "plan" || record.scope === "overview") {
      payload.requirements = requirements;
      payload.planItems = planItems;
    }
    return c.json({ shared: payload });
  } catch (error) {
    return errorResponse(c, error);
  }
});
