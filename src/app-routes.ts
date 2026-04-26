import { Hono, type Context } from "hono";
import { createHash } from "node:crypto";
import { assertPermission, type WorkspacePermission } from "./rbac.js";
import { applyCsrfCookie, clearCsrfCookie, rejectCrossOriginPrivateMutation } from "./route-security.js";
import {
  applySessionCookie,
  acceptWorkspaceInvitation,
  completeOnboardingStep,
  createWorkspaceInvitation,
  getActivationDetail,
  getOnboarding,
  getPrivateBootstrap,
  getSessionPayload,
  getWorkspaceActivityDetail,
  listWorkspaceMembers,
  listWorkspaceActivities,
  login,
  logout,
  register,
  removeWorkspaceMember,
  requireAuthenticatedContext,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  restoreSession,
  updateWorkspaceMemberRole,
  updateProfile,
  updateWorkspace,
} from "./taskloom-services.js";
import { findWorkspaceMembership, loadStore, mutateStore, upsertRateLimit } from "./taskloom-store.js";

export const appRoutes = new Hono();

const AUTH_RATE_LIMIT = { maxAttempts: 20, windowMs: 60_000 };
const INVITATION_RATE_LIMIT = { maxAttempts: 20, windowMs: 60_000 };
const RATE_LIMIT_MAX_BUCKETS = 5_000;

export function resetAppRouteSecurityForTests() {
  // Security state is store-backed; tests reset it through resetStoreForTests().
}

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
    enforceRateLimit(c, "auth:register", AUTH_RATE_LIMIT);
    const body = (await c.req.json()) as { email?: string; password?: string; displayName?: string };
    const result = register({
      email: body.email ?? "",
      password: body.password ?? "",
      displayName: body.displayName ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    applyCsrfCookie(c, result.cookieValue);
    c.status(201);
    return c.json(getSessionPayload(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/login", async (c) => {
  try {
    enforceRateLimit(c, "auth:login", AUTH_RATE_LIMIT);
    const body = (await c.req.json()) as { email?: string; password?: string };
    const result = login({
      email: body.email ?? "",
      password: body.password ?? "",
    });
    applySessionCookie(c, result.cookieValue);
    applyCsrfCookie(c, result.cookieValue);
    return c.json(getSessionPayload(result.context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/auth/logout", (c) => {
  const blocked = rejectCrossOriginPrivateMutation(c);
  if (blocked) return blocked;
  logout(c);
  clearCsrfCookie(c);
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

appRoutes.get("/app/members", (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "viewWorkspace");
    return c.json(listWorkspaceMembers(context));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations", async (c) => {
  try {
    enforceRateLimit(c, "invitation:create", INVITATION_RATE_LIMIT);
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { email?: string; role?: string };
    c.status(201);
    return c.json(await createWorkspaceInvitation(context, {
      email: body.email ?? "",
      role: body.role ?? "member",
    }));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations/:token/accept", (c) => {
  try {
    enforceRateLimit(c, "invitation:accept", INVITATION_RATE_LIMIT);
    const context = requireAuthenticatedContext(c);
    return c.json(acceptWorkspaceInvitation(context, c.req.param("token")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations/:invitationId/resend", async (c) => {
  try {
    enforceRateLimit(c, "invitation:resend", INVITATION_RATE_LIMIT);
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "manageWorkspace");
    return c.json(await resendWorkspaceInvitation(context, c.req.param("invitationId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.post("/app/invitations/:invitationId/revoke", (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "manageWorkspace");
    return c.json(revokeWorkspaceInvitation(context, c.req.param("invitationId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.patch("/app/members/:userId", async (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "manageWorkspace");
    const body = (await c.req.json()) as { role?: string };
    return c.json(updateWorkspaceMemberRole(context, c.req.param("userId"), { role: body.role ?? "" }));
  } catch (error) {
    return errorResponse(c, error);
  }
});

appRoutes.delete("/app/members/:userId", (c) => {
  try {
    const context = requireAuthenticatedContext(c);
    requireWorkspacePermission(context, "manageWorkspace");
    return c.json(removeWorkspaceMember(context, c.req.param("userId")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

type AuthenticatedRouteContext = ReturnType<typeof requireAuthenticatedContext>;

function requireWorkspacePermission(context: AuthenticatedRouteContext, permission: WorkspacePermission) {
  const membership = findWorkspaceMembership(loadStore(), context.workspace.id, context.user.id);
  assertPermission(membership, permission);
}

function enforceRateLimit(c: Context, scope: string, options: { maxAttempts: number; windowMs: number }) {
  const timestamp = Date.now();
  const limitedUntil = mutateStore((data) => upsertRateLimit(data, {
    bucketId: `${scope}:${hashedClientKey(clientKey(c))}`,
    maxAttempts: options.maxAttempts,
    windowMs: options.windowMs,
    timestamp,
    maxBuckets: configuredPositiveInteger("TASKLOOM_RATE_LIMIT_MAX_BUCKETS", RATE_LIMIT_MAX_BUCKETS),
  }));

  if (limitedUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((limitedUntil - timestamp) / 1000));
    c.header("Retry-After", String(retryAfterSeconds));
    throw httpRouteError(429, "too many requests");
  }
}

function clientKey(c: Context) {
  if (!trustedProxyEnabled()) return "local";
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")?.trim()
    || "local";
}

function hashedClientKey(clientIdentity: string) {
  const salt = process.env.TASKLOOM_RATE_LIMIT_KEY_SALT ?? "taskloom-rate-limit";
  return `sha256:${createHash("sha256").update(`${salt}:${clientIdentity}`).digest("hex")}`;
}

function trustedProxyEnabled() {
  return ["1", "true", "yes"].includes((process.env.TASKLOOM_TRUST_PROXY ?? "").trim().toLowerCase());
}

function configuredPositiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function httpRouteError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function errorResponse(c: Context, error: unknown) {
  c.status(((error as Error & { status?: number }).status ?? 500) as any);
  return c.json({ error: (error as Error).message });
}
