import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelAgentRun,
  completeOnboardingStep,
  createAgent,
  createWorkspaceEnvVar,
  deleteWorkspaceEnvVarById,
  getAgent,
  getPrivateBootstrap,
  getWorkspaceActivityDetail,
  listAgentRuns,
  listAgents,
  listReleaseHistory,
  listWorkspaceEnvVarsForUser,
  login,
  register,
  retryAgentRun,
  runAgent,
  updateAgent,
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

test("agent playbook is persisted and runs produce a step transcript", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const created = createAgent(auth.context, {
    name: "Playbook Tester",
    description: "Walks through ordered steps.",
    instructions: "Run the playbook end to end and report results.",
    triggerKind: "schedule",
    schedule: "*/30 * * * *",
    playbook: [
      { id: "step-1", title: "Read latest signals", instruction: "Pull recent activity events." },
      { title: "Decide next action", instruction: "Pick the highest-priority follow-up." },
      { title: "", instruction: "Should be dropped because title is blank." },
    ],
  });

  const agent = created.agent;
  assert.equal(agent.triggerKind, "schedule");
  assert.equal(agent.schedule, "*/30 * * * *");
  assert.ok(Array.isArray(agent.playbook));
  assert.equal(agent.playbook?.length, 2);
  assert.equal(agent.playbook?.[0].title, "Read latest signals");
  assert.ok(agent.playbook?.[1].id, "second step should receive a generated id");

  const runResult = await runAgent(auth.context, agent.id, { triggerKind: "manual" });
  assert.equal(runResult.run.triggerKind, "manual");
  assert.equal(runResult.run.status, "success");
  assert.ok(Array.isArray(runResult.run.transcript));
  assert.equal(runResult.run.transcript?.length, 2);
  assert.equal(runResult.run.transcript?.[0].title, "Read latest signals");
  assert.equal(runResult.run.transcript?.[0].status, "success");

  const detail = getAgent(auth.context, agent.id);
  assert.equal(detail.runs[0].id, runResult.run.id);
  assert.equal(detail.agent.playbook?.length, 2);

  const updated = updateAgent(auth.context, agent.id, {
    triggerKind: "webhook",
    playbook: [{ id: "step-1", title: "Read latest signals", instruction: "Updated instruction." }],
  });
  assert.equal(updated.agent.triggerKind, "webhook");
  assert.equal(updated.agent.playbook?.length, 1);
  assert.equal(updated.agent.playbook?.[0].instruction, "Updated instruction.");
});

test("agent tool runtime settings persist on create and update", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const created = createAgent(auth.context, {
    name: "Tool Runner",
    description: "Uses registered tools.",
    instructions: "Use the selected tools to complete the requested workflow.",
    enabledTools: ["read_workflow_brief", "browser_screenshot"],
    routeKey: "agent.reasoning",
  });

  assert.deepEqual(created.agent.enabledTools, ["read_workflow_brief", "browser_screenshot"]);
  assert.equal(created.agent.routeKey, "agent.reasoning");

  const updated = updateAgent(auth.context, created.agent.id, {
    enabledTools: ["list_agents"],
    routeKey: "agent.fast",
  });

  assert.deepEqual(updated.agent.enabledTools, ["list_agents"]);
  assert.equal(updated.agent.routeKey, "agent.fast");
});

test("agent lists do not expose webhook tokens", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const created = createAgent(auth.context, {
    name: "Webhook Agent",
    description: "Receives webhook calls.",
    instructions: "Process incoming webhook payloads for the workspace.",
  });

  const store = loadStore();
  const agent = store.agents.find((entry) => entry.id === created.agent.id);
  assert.ok(agent);
  agent.webhookToken = "whk_test_secret";

  const detail = getAgent(auth.context, created.agent.id);
  assert.equal(detail.agent.webhookToken, "whk_test_secret");
  const listed = listAgents(auth.context).agents.find((entry) => entry.id === created.agent.id);
  assert.equal(listed?.webhookToken, undefined);
});

test("activity detail includes lightweight related domain context", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const store = loadStore();
  const timestamp = new Date().toISOString();

  store.workflowConcerns.push({
    id: "blocker_alpha_test",
    workspaceId: "alpha",
    kind: "blocker",
    title: "Validation handoff is blocked",
    description: "The handoff needs an owner before release.",
    status: "open",
    severity: "high",
    relatedRequirementId: "req_alpha_validation",
    relatedPlanItemId: "plan_alpha_validation",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  store.activities.unshift({
    id: "activity_alpha_related",
    workspaceId: "alpha",
    scope: "activation",
    event: "test.related_context",
    actor: { type: "system", id: "test" },
    data: {
      title: "Related context activity",
      agentId: "agent_alpha_support",
      runId: "run_alpha_support_latest",
      blockerId: "blocker_alpha_test",
      questionId: "question_alpha_reporting",
      planItemId: "plan_alpha_validation",
      requirementId: "req_alpha_validation",
      evidenceId: "evidence_alpha_tests",
      releaseId: "release_alpha_pending",
    },
    occurredAt: timestamp,
  });

  const detail = getWorkspaceActivityDetail(auth.context, "activity_alpha_related");

  assert.equal(detail.activity.id, "activity_alpha_related");
  assert.equal(detail.related.agent?.name, "Support inbox triage");
  assert.equal(detail.related.run?.title, "Support inbox scanned");
  assert.equal(detail.related.blocker?.title, "Validation handoff is blocked");
  assert.equal(detail.related.question?.title, "Is reporting required for the first release?");
  assert.equal(detail.related.planItem?.title, "Collect validation proof");
  assert.equal(detail.related.requirement?.title, "Capture validation evidence before release");
  assert.equal(detail.related.evidence?.title, "Activation validation checks passed");
  assert.equal(detail.related.release?.versionLabel, "alpha-validation");
  assert.doesNotThrow(() => JSON.stringify(detail));
});

test("activity detail related context is workspace isolated", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const store = loadStore();

  store.activities.unshift({
    id: "activity_alpha_cross_workspace_refs",
    workspaceId: "alpha",
    scope: "activation",
    event: "test.cross_workspace_refs",
    actor: { type: "system", id: "test" },
    data: {
      title: "Cross workspace references",
      agentId: "agent_beta_dependency_watch",
      runId: "run_beta_dependency_latest",
      blockerId: "blocker_beta_dependency",
      questionId: "question_beta_scope",
      planItemId: "plan_beta_restart",
      requirementId: "req_beta_dependencies",
      evidenceId: "evidence_beta_failed_retry",
      releaseId: "release_beta_blocked",
    },
    occurredAt: new Date().toISOString(),
  });

  const detail = getWorkspaceActivityDetail(auth.context, "activity_alpha_cross_workspace_refs");

  assert.deepEqual(detail.related, {});
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

  const retried = await retryAgentRun(auth.context, failed.id);
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
