import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelAgentRun,
  completeOnboardingStep,
  createWorkspaceEnvVar,
  deleteWorkspaceEnvVarById,
  getPrivateBootstrap,
  listAgentRuns,
  listReleaseHistory,
  listWorkspaceEnvVarsForUser,
  login,
  register,
  retryAgentRun,
  updateWorkspace,
  updateWorkspaceEnvVar,
} from "./taskloom-services";
import { loadStore, resetStoreForTests } from "./taskloom-store";

test("register creates a new user and workspace", async () => {
  resetStoreForTests();
  const result = register({
    email: "new@taskloom.local",
    password: "supersecret",
    displayName: "New Owner",
  });

  assert.ok(result.cookieValue.includes("."));
  assert.equal(result.context.user.email, "new@taskloom.local");
  assert.match(result.context.workspace.name, /workspace/i);

  const store = loadStore();
  assert.ok(store.users.some((entry) => entry.email === "new@taskloom.local"));
  assert.ok(store.workspaces.some((entry) => entry.id === result.context.workspace.id));
});

test("login rejects invalid credentials", () => {
  resetStoreForTests();
  assert.throws(
    () => login({ email: "alpha@taskloom.local", password: "wrongpass" }),
    /invalid email or password/,
  );
});

test("env vars: create masks secrets, prevents duplicate keys, supports update and delete", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const created = createWorkspaceEnvVar(auth.context, {
    key: "test_token",
    value: "super-secret-value-1234",
    scope: "runtime",
    secret: true,
    description: "Token for tests",
  });

  assert.equal(created.envVar.key, "TEST_TOKEN");
  assert.notEqual(created.envVar.value, "super-secret-value-1234");
  assert.match(created.envVar.value, /1234$/);
  assert.equal(created.envVar.valueLength, "super-secret-value-1234".length);

  assert.throws(
    () => createWorkspaceEnvVar(auth.context, { key: "TEST_TOKEN", value: "other" }),
    /already exists/,
  );

  assert.throws(
    () => createWorkspaceEnvVar(auth.context, { key: "1bad", value: "x" }),
    /key must start with a letter/,
  );

  const updated = updateWorkspaceEnvVar(auth.context, created.envVar.id, { secret: false });
  assert.equal(updated.envVar.secret, false);
  assert.equal(updated.envVar.value, "super-secret-value-1234");

  const list = listWorkspaceEnvVarsForUser(auth.context);
  assert.ok(list.envVars.some((entry) => entry.id === created.envVar.id));

  const deleted = deleteWorkspaceEnvVarById(auth.context, created.envVar.id);
  assert.equal(deleted.ok, true);
  const after = listWorkspaceEnvVarsForUser(auth.context);
  assert.equal(after.envVars.find((entry) => entry.id === created.envVar.id), undefined);
});

test("agent runs: list adds duration and capability flags; cancel and retry behave correctly", async () => {
  resetStoreForTests();
  const auth = login({ email: "beta@taskloom.local", password: "demo12345" });

  const list = listAgentRuns(auth.context);
  const failed = list.runs.find((entry) => entry.status === "failed");
  assert.ok(failed, "expected a failed seed run");
  assert.equal(typeof failed.durationMs, "number");
  assert.equal(failed.canRetry, true);
  assert.equal(failed.canCancel, false);

  assert.throws(
    () => cancelAgentRun(auth.context, failed.id),
    /only queued or running runs can be canceled/,
  );

  const retried = retryAgentRun(auth.context, failed.id);
  assert.ok(retried.run.id !== failed.id);
});

test("release history exposes preflight and prior confirmations", async () => {
  resetStoreForTests();
  const gamma = login({ email: "gamma@taskloom.local", password: "demo12345" });
  const history = listReleaseHistory(gamma.context);
  assert.ok(history.releases.length > 0);
  assert.equal(history.preflight.failedEvidence, 0);
  assert.equal(history.preflight.openBlockers, 0);
  assert.equal(history.preflight.ready, true);

  const beta = login({ email: "beta@taskloom.local", password: "demo12345" });
  const betaHistory = listReleaseHistory(beta.context);
  assert.equal(betaHistory.preflight.ready, false);
  assert.ok(betaHistory.preflight.openBlockers > 0 || betaHistory.preflight.failedEvidence > 0);
});

test("workspace update and onboarding completion affect private bootstrap", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  await updateWorkspace(auth.context, {
    name: "Alpha Workspace Updated",
    website: "https://updated.example.com",
    automationGoal: "Define a better implementation brief and validate the release process.",
  });

  await completeOnboardingStep(auth.context, "validate");

  const bootstrap = await getPrivateBootstrap(auth.context);
  assert.equal(bootstrap.workspace.name, "Alpha Workspace Updated");
  assert.equal(bootstrap.activation.status.stage, "validation");
  assert.ok(bootstrap.activities.length > 0);
});
