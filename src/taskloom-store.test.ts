import assert from "node:assert/strict";
import test from "node:test";
import {
  findWorkspaceBrief,
  findWorkspaceMembership,
  listAgentRunsForWorkspace,
  listAgentsForWorkspace,
  listProvidersForWorkspace,
  listReleaseConfirmationsForWorkspace,
  listRequirementsForWorkspace,
  listValidationEvidenceForWorkspace,
  listWorkflowConcernsForWorkspace,
  resetStoreForTests,
  upsertRequirement,
  upsertWorkspaceBrief,
  upsertWorkspaceMembership,
  type WorkspaceRole,
} from "./taskloom-store";

test("seed store includes product workflow records for each workspace", () => {
  const store = resetStoreForTests();

  for (const workspaceId of ["alpha", "beta", "gamma"]) {
    assert.ok(findWorkspaceBrief(store, workspaceId));
    assert.ok(listRequirementsForWorkspace(store, workspaceId).length > 0);
    assert.ok(listWorkflowConcernsForWorkspace(store, workspaceId).length > 0);
    assert.ok(listValidationEvidenceForWorkspace(store, workspaceId).length > 0);
    assert.ok(listReleaseConfirmationsForWorkspace(store, workspaceId).length > 0);
    assert.ok(listProvidersForWorkspace(store, workspaceId).length > 0);
    assert.ok(listAgentsForWorkspace(store, workspaceId).length > 0);
    assert.ok(listAgentRunsForWorkspace(store, workspaceId).length > 0);
  }

  assert.equal(listWorkflowConcernsForWorkspace(store, "beta", "blocker").length, 1);
  assert.equal(listReleaseConfirmationsForWorkspace(store, "gamma")[0]?.status, "confirmed");
});

test("upsert helpers create and update records by natural key", () => {
  const store = resetStoreForTests();
  const timestamp = "2026-01-02T03:04:05.000Z";

  const brief = upsertWorkspaceBrief(store, {
    workspaceId: "alpha",
    summary: "Updated alpha brief",
    goals: ["Clarify the release path"],
    audience: "Product lead",
    constraints: "Keep the validation scope focused.",
    problemStatement: "A clearer problem statement.",
    targetCustomers: ["Product lead"],
    desiredOutcome: "A clearer release path.",
    successMetrics: ["Brief is updated"],
    updatedByUserId: "user_alpha",
  }, timestamp);

  assert.equal(brief.summary, "Updated alpha brief");
  assert.equal(brief.updatedAt, timestamp);
  assert.notEqual(brief.createdAt, timestamp);
  assert.equal(findWorkspaceBrief(store, "alpha")?.summary, "Updated alpha brief");

  const requirement = upsertRequirement(store, {
    workspaceId: "alpha",
    title: "New durable requirement",
    detail: "Exercise generated IDs and timestamps.",
    priority: "could",
    status: "draft",
    acceptanceCriteria: ["Record exists"],
    source: "team",
    createdByUserId: "user_alpha",
  }, timestamp);

  assert.ok(requirement.id);
  assert.equal(requirement.createdAt, timestamp);
  assert.equal(findWorkspaceBrief(store, "alpha")?.summary, "Updated alpha brief");
});

test("workspace memberships support expanded roles", () => {
  const store = resetStoreForTests();
  const role: WorkspaceRole = "viewer";

  upsertWorkspaceMembership(store, {
    workspaceId: "alpha",
    userId: "user_beta",
    role,
    joinedAt: "2026-01-02T03:04:05.000Z",
  });

  assert.equal(findWorkspaceMembership(store, "alpha", "user_beta")?.role, "viewer");
});
