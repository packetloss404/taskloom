import assert from "node:assert/strict";
import test from "node:test";
import { login } from "./taskloom-services";
import { loadStore, resetStoreForTests } from "./taskloom-store";
import {
  getWorkflowOverview,
  readWorkspaceBrief,
  replaceBlockersAndQuestions,
  replacePlanItems,
  replaceRequirements,
  replaceValidationEvidence,
  updateReleaseConfirmation,
  updateWorkspaceBrief,
} from "./workflow-service";

test("workflow brief updates workspace brief facts and activity", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const brief = updateWorkspaceBrief(auth.context, {
    summary: "Ship the roadmap workflow service.",
    targetCustomers: ["Integrators"],
    successMetrics: ["Capture brief", "Validate release"],
  });

  assert.equal(brief.summary, "Ship the roadmap workflow service.");
  assert.deepEqual(brief.successMetrics, ["Capture brief", "Validate release"]);
  assert.equal(readWorkspaceBrief(auth.context).summary, brief.summary);

  const store = loadStore();
  const workspace = store.workspaces.find((entry) => entry.id === auth.context.workspace.id);
  assert.equal(workspace?.automationGoal, brief.summary);
  assert.ok(store.activationFacts[auth.context.workspace.id].briefCapturedAt);
  assert.equal(store.activities[0].event, "workflow.brief_updated");
});

test("workflow surfaces update activation facts and overview", () => {
  resetStoreForTests();
  const auth = login({ email: "beta@taskloom.local", password: "demo12345" });

  replaceRequirements(auth.context, [
    { title: "Track workflow requirements", priority: "must", status: "accepted" },
  ]);
  replacePlanItems(auth.context, [
    { title: "Create service module", status: "done" },
    { title: "Wire routes later", status: "todo" },
  ]);
  replaceBlockersAndQuestions(auth.context, {
    blockers: [{ title: "Await integration route", severity: "high", relatedRequirementId: "req-route" }],
    questions: [{ title: "Which route owns workflow reads?" }],
  });
  replaceValidationEvidence(auth.context, [
    { title: "Service tests pass", outcome: "passed", type: "automated_test", evidenceUrl: "node --test" },
  ]);
  const release = updateReleaseConfirmation(auth.context, {
    confirmed: true,
    summary: "Ready for integration wiring.",
  });

  const overview = getWorkflowOverview(auth.context);
  assert.equal(overview.requirements.length, 1);
  assert.equal(overview.planItems.length, 2);
  assert.equal(overview.blockersAndQuestions.blockers.length, 1);
  assert.equal(overview.validationEvidence[0].outcome, "passed");
  assert.equal(release.status, "confirmed");

  const facts = loadStore().activationFacts[auth.context.workspace.id];
  assert.ok(facts.requirementsDefinedAt);
  assert.ok(facts.planDefinedAt);
  assert.ok(facts.validationPassedAt);
  assert.ok(facts.releaseConfirmedAt);
  assert.equal(facts.blockerCount, 1);
  assert.equal(facts.dependencyBlockerCount, 1);
  assert.equal(facts.openQuestionCount, 1);
});

test("workflow validation rejects invalid surface input", () => {
  resetStoreForTests();
  const auth = login({ email: "gamma@taskloom.local", password: "demo12345" });

  assert.throws(
    () => updateWorkspaceBrief(auth.context, { summary: "x" }),
    /brief summary must be at least 2 characters/,
  );
  assert.throws(
    () => replaceRequirements(auth.context, [{ title: "ok", priority: "urgent" as never }]),
    /unknown requirement priority/,
  );
});
