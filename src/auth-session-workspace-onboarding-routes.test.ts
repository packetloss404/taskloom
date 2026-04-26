import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { appRoutes, resetAppRouteSecurityForTests } from "./app-routes.js";
import { SESSION_COOKIE_NAME } from "./auth-utils.js";
import { login } from "./taskloom-services.js";
import { loadStore, mutateStore, resetStoreForTests, type WorkspaceRole } from "./taskloom-store.js";

function createTestApp() {
  const app = new Hono();
  app.route("/api", appRoutes);
  return app;
}

function authHeaders(cookieValue: string) {
  return { Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` };
}

function cookieValue(response: Response) {
  const cookie = response.headers.get("set-cookie") ?? "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  assert.ok(match?.[1], "expected response to set a session cookie");
  return match[1];
}

function setAlphaRole(role: WorkspaceRole) {
  mutateStore((data) => {
    const membership = data.memberships.find((entry) => entry.workspaceId === "alpha" && entry.userId === "user_alpha");
    assert.ok(membership, "expected alpha membership");
    membership.role = role;
  });
}

test("session route reports unauthenticated without a valid session cookie", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/auth/session");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { authenticated: false, user: null, workspace: null, onboarding: null });
});

test("register creates an authenticated session response and session cookie", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "New.User@Example.com", password: "demo12345", displayName: "New User" }),
  });
  const body = await response.json() as { authenticated: boolean; user: { email: string }; workspace: { name: string } };

  assert.equal(response.status, 201);
  assert.equal(body.authenticated, true);
  assert.equal(body.user.email, "new.user@example.com");
  assert.equal(body.workspace.name, "New workspace");
  assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`${SESSION_COOKIE_NAME}=`));
});

test("login rejects invalid credentials with route-level 401 response", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();

  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "alpha@taskloom.local", password: "wrong-password" }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "invalid email or password" });
});

test("auth routes rate limit repeated local attempts", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();

  for (let index = 0; index < 20; index += 1) {
    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ email: "not-an-email", password: "demo12345", displayName: "New User" }),
    });
    assert.equal(response.status, 400);
  }

  const limitedRegister = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ email: "not-an-email", password: "demo12345", displayName: "New User" }),
  });
  assert.equal(limitedRegister.status, 429);
  assert.deepEqual(await limitedRegister.json(), { error: "too many requests" });
  assert.ok(limitedRegister.headers.get("retry-after"));

  for (let index = 0; index < 20; index += 1) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.11" },
      body: JSON.stringify({ email: "alpha@taskloom.local", password: "wrong-password" }),
    });
    assert.equal(response.status, 401);
  }

  const limitedLogin = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.11" },
    body: JSON.stringify({ email: "alpha@taskloom.local", password: "wrong-password" }),
  });
  assert.equal(limitedLogin.status, 429);
  assert.deepEqual(await limitedLogin.json(), { error: "too many requests" });
});

test("logout removes the current session so subsequent session reads are anonymous", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const logoutResponse = await app.request("/api/auth/logout", {
    method: "POST",
    headers: authHeaders(auth.cookieValue),
  });
  const sessionResponse = await app.request("/api/auth/session", {
    headers: authHeaders(auth.cookieValue),
  });
  const sessionBody = await sessionResponse.json();

  assert.equal(logoutResponse.status, 200);
  assert.deepEqual(sessionBody, { authenticated: false, user: null, workspace: null, onboarding: null });
});

test("workspace route requires auth, validates website, and returns the updated workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const unauthorized = await app.request("/api/app/workspace", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { error: "authentication required" });

  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const invalid = await app.request("/api/app/workspace", {
    method: "PATCH",
    headers: { ...authHeaders(auth.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ name: "Alpha Workspace", website: "not-a-url", automationGoal: "Automate triage" }),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "website must be a valid URL" });

  const valid = await app.request("/api/app/workspace", {
    method: "PATCH",
    headers: { ...authHeaders(auth.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ name: "Alpha Ops", website: "https://alpha.example", automationGoal: "Automate triage" }),
  });
  const body = await valid.json() as { workspace: { name: string; slug: string; website: string; automationGoal: string } };

  assert.equal(valid.status, 200);
  assert.equal(body.workspace.name, "Alpha Ops");
  assert.equal(body.workspace.slug, "alpha-ops");
  assert.equal(body.workspace.website, "https://alpha.example");
  assert.equal(body.workspace.automationGoal, "Automate triage");
});

test("workspace settings require admin or owner membership", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  for (const role of ["viewer", "member"] as const) {
    setAlphaRole(role);
    const denied = await app.request("/api/app/workspace", {
      method: "PATCH",
      headers: { ...authHeaders(auth.cookieValue), "content-type": "application/json" },
      body: JSON.stringify({ name: "Alpha Ops", website: "https://alpha.example", automationGoal: "Automate triage" }),
    });

    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: "workspace role admin is required" });
  }

  setAlphaRole("admin");
  const allowed = await app.request("/api/app/workspace", {
    method: "PATCH",
    headers: { ...authHeaders(auth.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ name: "Alpha Admin Ops", website: "https://alpha.example", automationGoal: "Automate triage" }),
  });
  const body = await allowed.json() as { workspace: { name: string } };

  assert.equal(allowed.status, 200);
  assert.equal(body.workspace.name, "Alpha Admin Ops");
});

test("viewer memberships can read shared app state and update their own profile", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  setAlphaRole("viewer");

  for (const path of ["/api/auth/session", "/api/app/bootstrap", "/api/app/activation", "/api/app/activity", "/api/app/onboarding"] as const) {
    const response = await app.request(path, { headers: authHeaders(auth.cookieValue) });
    assert.equal(response.status, 200, `${path} should allow viewer reads`);
  }

  const profile = await app.request("/api/app/profile", {
    method: "PATCH",
    headers: { ...authHeaders(auth.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ displayName: "Alpha Viewer", timezone: "America/New_York" }),
  });
  const body = await profile.json() as { profile: { displayName: string; timezone: string } };

  assert.equal(profile.status, 200);
  assert.equal(body.profile.displayName, "Alpha Viewer");
  assert.equal(body.profile.timezone, "America/New_York");
});

test("activation route reflects normalized durable activation signals", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const registration = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "signals@example.com", password: "demo12345", displayName: "Signals User" }),
  });
  const authCookie = cookieValue(registration);
  const registered = await registration.json() as { workspace: { id: string } };

  mutateStore((data) => {
    data.activationSignals.push(
      {
        id: "signal_registered_retry",
        workspaceId: registered.workspace.id,
        kind: "retry",
        source: "agent_run",
        sourceId: "run_registered_failed",
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z",
      },
      {
        id: "signal_registered_scope",
        workspaceId: registered.workspace.id,
        kind: "scope_change",
        source: "workflow",
        sourceId: "brief_registered_v2",
        createdAt: "2026-04-22T11:00:00.000Z",
        updatedAt: "2026-04-22T11:00:00.000Z",
      },
    );
  });

  const response = await app.request("/api/app/activation", { headers: authHeaders(authCookie) });
  const body = await response.json() as { activation: { status: { risk: { reasons: string[] } } } };

  assert.equal(response.status, 200);
  assert.ok(body.activation.status.risk.reasons.includes("Work required retries."));
  assert.ok(body.activation.status.risk.reasons.includes("Scope changed during execution."));
});

test("onboarding completion requires member or above membership", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  setAlphaRole("viewer");
  const denied = await app.request("/api/app/onboarding/steps/create_workspace_profile/complete", {
    method: "POST",
    headers: authHeaders(auth.cookieValue),
  });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "workspace role member is required" });

  setAlphaRole("member");
  const allowed = await app.request("/api/app/onboarding/steps/create_workspace_profile/complete", {
    method: "POST",
    headers: authHeaders(auth.cookieValue),
  });
  const body = await allowed.json() as { onboarding: { completedSteps: string[] } };

  assert.equal(allowed.status, 200);
  assert.ok(body.onboarding.completedSteps.includes("create_workspace_profile"));
});

test("onboarding routes expose current state and reject unknown completion steps", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const registration = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "onboarding@example.com", password: "demo12345", displayName: "Onboarding User" }),
  });
  const authCookie = cookieValue(registration);

  const current = await app.request("/api/app/onboarding", { headers: authHeaders(authCookie) });
  const currentBody = await current.json() as { onboarding: { status: string; currentStep: string; completedSteps: string[] } };
  assert.equal(current.status, 200);
  assert.equal(currentBody.onboarding.status, "not_started");
  assert.equal(currentBody.onboarding.currentStep, "create_workspace_profile");
  assert.deepEqual(currentBody.onboarding.completedSteps, []);

  const invalid = await app.request("/api/app/onboarding/steps/not-a-step/complete", {
    method: "POST",
    headers: authHeaders(authCookie),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "unknown onboarding step" });

  const completed = await app.request("/api/app/onboarding/steps/create_workspace_profile/complete", {
    method: "POST",
    headers: authHeaders(authCookie),
  });
  const completedBody = await completed.json() as { onboarding: { status: string; currentStep: string; completedSteps: string[] } };

  assert.equal(completed.status, 200);
  assert.equal(completedBody.onboarding.status, "in_progress");
  assert.equal(completedBody.onboarding.currentStep, "define_requirements");
  assert.deepEqual(completedBody.onboarding.completedSteps, ["create_workspace_profile"]);
});

test("member and invitation routes enforce workspace management permissions", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  setAlphaRole("viewer");
  const list = await app.request("/api/app/members", { headers: authHeaders(auth.cookieValue) });
  assert.equal(list.status, 200);
  assert.ok((await list.json() as { members: unknown[] }).members.length > 0);

  for (const role of ["viewer", "member"] as const) {
    setAlphaRole(role);
    const denied = await app.request("/api/app/invitations", {
      method: "POST",
      headers: { ...authHeaders(auth.cookieValue), "content-type": "application/json" },
      body: JSON.stringify({ email: "beta@taskloom.local", role: "member" }),
    });

    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: "workspace role admin is required" });
  }
});

test("private mutating app routes reject cross-origin browser requests", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const rejected = await app.request("/api/app/workspace", {
    method: "PATCH",
    headers: {
      ...authHeaders(auth.cookieValue),
      "content-type": "application/json",
      host: "localhost",
      origin: "https://evil.example",
    },
    body: JSON.stringify({ name: "Blocked", website: "", automationGoal: "" }),
  });

  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { error: "cross-origin requests are not allowed" });
});

test("member listing hides invitation tokens from non-admin roles", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  setAlphaRole("admin");

  const created = await app.request("/api/app/invitations", {
    method: "POST",
    headers: { ...authHeaders(auth.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ email: "beta@taskloom.local", role: "member" }),
  });
  assert.equal(created.status, 201);

  const adminList = await app.request("/api/app/members", { headers: authHeaders(auth.cookieValue) });
  const adminBody = await adminList.json() as { invitations: Array<{ token?: string }> };
  assert.ok(adminBody.invitations[0]?.token);

  setAlphaRole("viewer");
  const viewerList = await app.request("/api/app/members", { headers: authHeaders(auth.cookieValue) });
  const viewerBody = await viewerList.json() as { invitations: Array<{ token?: string }> };
  assert.equal(viewerList.status, 200);
  assert.equal(viewerBody.invitations[0]?.token, undefined);
});

test("admins can invite an existing user and that user can accept", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const beta = login({ email: "beta@taskloom.local", password: "demo12345" });
  setAlphaRole("admin");

  const created = await app.request("/api/app/invitations", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ email: "Beta@Taskloom.Local", role: "member" }),
  });
  const createdBody = await created.json() as { invitation: { token: string; email: string; role: string; status: string } };

  assert.equal(created.status, 201);
  assert.equal(createdBody.invitation.email, "beta@taskloom.local");
  assert.equal(createdBody.invitation.role, "member");
  assert.equal(createdBody.invitation.status, "pending");
  assert.ok(createdBody.invitation.token);

  const accepted = await app.request(`/api/app/invitations/${createdBody.invitation.token}/accept`, {
    method: "POST",
    headers: authHeaders(beta.cookieValue),
  });
  const acceptedBody = await accepted.json() as { membership: { userId: string; role: string }; invitation: { status: string } };

  assert.equal(accepted.status, 200);
  assert.equal(acceptedBody.membership.userId, "user_beta");
  assert.equal(acceptedBody.membership.role, "member");
  assert.equal(acceptedBody.invitation.status, "accepted");
  assert.equal(loadStore().memberships.some((entry) => entry.workspaceId === "alpha" && entry.userId === "user_beta"), true);
});

test("invitation create, accept, and resend routes are rate limited", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const beta = login({ email: "beta@taskloom.local", password: "demo12345" });
  setAlphaRole("admin");

  for (let index = 0; index < 20; index += 1) {
    const response = await app.request("/api/app/invitations", {
      method: "POST",
      headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
      body: JSON.stringify({ email: "not-an-email", role: "member" }),
    });
    assert.equal(response.status, 400);
  }
  const createLimited = await app.request("/api/app/invitations", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
    body: JSON.stringify({ email: "not-an-email", role: "member" }),
  });
  assert.equal(createLimited.status, 429);

  const created = await app.request("/api/app/invitations", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json", "x-forwarded-for": "203.0.113.21" },
    body: JSON.stringify({ email: "beta@taskloom.local", role: "member" }),
  });
  const createdBody = await created.json() as { invitation: { id: string; token: string } };

  for (let index = 0; index < 20; index += 1) {
    const response = await app.request(`/api/app/invitations/${createdBody.invitation.id}/resend`, {
      method: "POST",
      headers: { ...authHeaders(alpha.cookieValue), "x-forwarded-for": "203.0.113.22" },
    });
    assert.equal(response.status, 200);
  }
  const resendLimited = await app.request(`/api/app/invitations/${createdBody.invitation.id}/resend`, {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "x-forwarded-for": "203.0.113.22" },
  });
  assert.equal(resendLimited.status, 429);

  for (let index = 0; index < 20; index += 1) {
    const response = await app.request("/api/app/invitations/missing-token/accept", {
      method: "POST",
      headers: { ...authHeaders(beta.cookieValue), "x-forwarded-for": "203.0.113.23" },
    });
    assert.equal(response.status, 404);
  }
  const acceptLimited = await app.request("/api/app/invitations/missing-token/accept", {
    method: "POST",
    headers: { ...authHeaders(beta.cookieValue), "x-forwarded-for": "203.0.113.23" },
  });
  assert.equal(acceptLimited.status, 429);
});

test("admins can resend invitations by rotating token and expiry", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const beta = login({ email: "beta@taskloom.local", password: "demo12345" });
  setAlphaRole("admin");

  const created = await app.request("/api/app/invitations", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ email: "beta@taskloom.local", role: "member" }),
  });
  const createdBody = await created.json() as { invitation: { id: string; token: string; expiresAt: string } };

  mutateStore((data) => {
    const invitation = data.workspaceInvitations.find((entry) => entry.id === createdBody.invitation.id);
    assert.ok(invitation, "expected invitation");
    invitation.expiresAt = "2000-01-01T00:00:00.000Z";
  });

  const resent = await app.request(`/api/app/invitations/${createdBody.invitation.id}/resend`, {
    method: "POST",
    headers: authHeaders(alpha.cookieValue),
  });
  const resentBody = await resent.json() as { invitation: { token: string; expiresAt: string; status: string } };

  assert.equal(resent.status, 200);
  assert.notEqual(resentBody.invitation.token, createdBody.invitation.token);
  assert.equal(resentBody.invitation.status, "pending");
  assert.ok(new Date(resentBody.invitation.expiresAt).getTime() > Date.now());

  const oldToken = await app.request(`/api/app/invitations/${createdBody.invitation.token}/accept`, {
    method: "POST",
    headers: authHeaders(beta.cookieValue),
  });
  assert.equal(oldToken.status, 404);

  const accepted = await app.request(`/api/app/invitations/${resentBody.invitation.token}/accept`, {
    method: "POST",
    headers: authHeaders(beta.cookieValue),
  });
  assert.equal(accepted.status, 200);
});

test("invitation revoke and resend enforce workspace roles", async () => {
  resetStoreForTests();
  resetAppRouteSecurityForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  setAlphaRole("admin");

  const created = await app.request("/api/app/invitations", {
    method: "POST",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ email: "beta@taskloom.local", role: "member" }),
  });
  const createdBody = await created.json() as { invitation: { id: string; token: string } };

  setAlphaRole("member");
  const deniedResend = await app.request(`/api/app/invitations/${createdBody.invitation.id}/resend`, {
    method: "POST",
    headers: authHeaders(alpha.cookieValue),
  });
  assert.equal(deniedResend.status, 403);
  assert.deepEqual(await deniedResend.json(), { error: "workspace role admin is required" });

  setAlphaRole("viewer");
  const deniedRevoke = await app.request(`/api/app/invitations/${createdBody.invitation.id}/revoke`, {
    method: "POST",
    headers: authHeaders(alpha.cookieValue),
  });
  assert.equal(deniedRevoke.status, 403);
  assert.deepEqual(await deniedRevoke.json(), { error: "workspace role admin is required" });

  setAlphaRole("admin");
  const revoked = await app.request(`/api/app/invitations/${createdBody.invitation.id}/revoke`, {
    method: "POST",
    headers: authHeaders(alpha.cookieValue),
  });
  const revokedBody = await revoked.json() as { invitation: { status: string; revokedAt: string | null } };
  assert.equal(revoked.status, 200);
  assert.equal(revokedBody.invitation.status, "revoked");
  assert.ok(revokedBody.invitation.revokedAt);

  const accepted = await app.request(`/api/app/invitations/${createdBody.invitation.token}/accept`, {
    method: "POST",
    headers: authHeaders(login({ email: "beta@taskloom.local", password: "demo12345" }).cookieValue),
  });
  assert.equal(accepted.status, 400);
  assert.deepEqual(await accepted.json(), { error: "invitation has been revoked" });
});

test("member role updates and removals protect owner-only operations", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });

  mutateStore((data) => {
    data.memberships.push({ workspaceId: "alpha", userId: "user_beta", role: "member", joinedAt: new Date().toISOString() });
  });
  setAlphaRole("admin");

  const promotedToOwner = await app.request("/api/app/members/user_beta", {
    method: "PATCH",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ role: "owner" }),
  });
  assert.equal(promotedToOwner.status, 403);
  assert.deepEqual(await promotedToOwner.json(), { error: "workspace role owner is required" });

  const updated = await app.request("/api/app/members/user_beta", {
    method: "PATCH",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ role: "viewer" }),
  });
  const updatedBody = await updated.json() as { member: { role: string } };
  assert.equal(updated.status, 200);
  assert.equal(updatedBody.member.role, "viewer");

  setAlphaRole("owner");
  const demoteLastOwner = await app.request("/api/app/members/user_alpha", {
    method: "PATCH",
    headers: { ...authHeaders(alpha.cookieValue), "content-type": "application/json" },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.equal(demoteLastOwner.status, 400);
  assert.deepEqual(await demoteLastOwner.json(), { error: "workspace must keep at least one owner" });

  const removed = await app.request("/api/app/members/user_beta", {
    method: "DELETE",
    headers: authHeaders(alpha.cookieValue),
  });
  assert.equal(removed.status, 200);
  assert.equal(loadStore().memberships.some((entry) => entry.workspaceId === "alpha" && entry.userId === "user_beta"), false);
});
