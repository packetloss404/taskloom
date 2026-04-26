import { Hono, type Context } from "hono";
import { assertPermission, type WorkspacePermission } from "./rbac.js";
import {
  applySessionCookie,
  completeOnboardingStep,
  getActivationDetail,
  getOnboarding,
  getPrivateBootstrap,
  getSessionPayload,
  getWorkspaceActivityDetail,
  listWorkspaceActivities,
  login,
  logout,
  register,
  requireAuthenticatedContext,
  restoreSession,
  updateProfile,
  updateWorkspace,
} from "./taskloom-services.js";
import { findWorkspaceMembership, loadStore } from "./taskloom-store.js";

export const appRoutes = new Hono();

appRoutes.get("/auth/session", (c) => {
  try {
    const context = restoreSession(c);
    if (!context) {
      return c.json({ authenticated: false, user: null, workspace: null, onboarding: null });
    }

    requireWorkspacePermission(context, "viewWorkspace");
    return c.json(getSessionPayload(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/register", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string; password?: string; displayName?: string };
    const result = register({
      email: body.email ?? "",
      password: body.password ?? "",
      displayName: body.displayName ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    c.status(201);
    return c.json(getSessionPayload(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/login", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string; password?: string };
    const result = login({
      email: body.email ?? "",
      password: body.password ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    return c.json(getSessionPayload(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/logout", (c) => {
  logout(c);
  return c.json({ ok: true });
});

appRoutes.get("/app/bootstrap", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "viewWorkspace");
    return c.json(await getPrivateBootstrap(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/activation", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "viewWorkspace");
    return c.json(await getActivationDetail(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/activity", (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "viewWorkspace");
    return c.json({ activities: listWorkspaceActivities(context) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/activity/:id", (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "viewWorkspace");
    return c.json(getWorkspaceActivityDetail(context, c.req.param("id")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.get("/app/onboarding", (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "viewWorkspace");
    return c.json({ onboarding: getOnboarding(context) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/onboarding/steps/:stepKey/complete", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "editWorkflow");
    return c.json({ onboarding: await completeOnboardingStep(context, c.req.param("stepKey")) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.patch("/app/profile", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    const body = (await c.req.json()) as { displayName?: string; timezone?: string };
    const user = await updateProfile(context, {
      displayName: body.displayName ?? "",
      timezone: body.timezone ?? "",
    });
    return c.json({
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        timezone: user.timezone,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.patch("/app/workspace", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { name?: string; website?: string; automationGoal?: string };
    const workspace = await updateWorkspace(context, {
      name: body.name ?? "",
      website: body.website ?? "",
      automationGoal: body.automationGoal ?? "",
    });
    return c.json({ workspace });
  } catch (error) {
    return errorResponse(c, error);
  }
});

type AuthenticatedRouteContext = ReturnType<typeof requireAuthenticatedContext>;

function requireWorkspacePermission(context: AuthenticatedRouteContext, permission: WorkspacePermission) {
  const membership = findWorkspaceMembership(loadStore(), context.workspace.id, context.user.id);
  assertPermission(membership, permission);
}

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as any);
  return c.json({ error: (error as Error).message });
}
