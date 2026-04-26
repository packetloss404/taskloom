import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { appRoutes } from "./app-routes.js";
import { SESSION_COOKIE_NAME } from "./auth-utils.js";
import { login } from "./taskloom-services.js";
import { resetStoreForTests } from "./taskloom-store.js";

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
