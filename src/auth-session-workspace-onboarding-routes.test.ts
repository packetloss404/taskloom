import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { appRoutes } from "./app-routes.js";
import { SESSION_COOKIE_NAME } from "./auth-utils.js";
import { login } from "./taskloom-services.js";
import { mutateStore, resetStoreForTests, type WorkspaceRole } from "./taskloom-store.js";

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
