import assert from "node:assert/strict";
import test from "node:test";
import {
  completeOnboardingStep,
  createAgent,
  getAgent,
  getPrivateBootstrap,
  login,
  register,
  runAgent,
  updateAgent,
  updateWorkspace,
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

  const runResult = runAgent(auth.context, agent.id, { triggerKind: "manual" });
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
