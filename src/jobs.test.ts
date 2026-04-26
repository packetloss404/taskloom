import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupExpiredSessions,
  recomputeActivationReadModels,
  type StoreJobDeps,
} from "./jobs";
import type { TaskloomData } from "./taskloom-store";

test("recomputeActivationReadModels refreshes activation read models for every workspace", async () => {
  const data = makeStore();
  const result = await recomputeActivationReadModels(makeDeps(data));

  assert.equal(result.processed, 2);
  assert.deepEqual(result.workspaceIds, ["alpha", "beta"]);
  assert.equal(data.activationReadModels.alpha.stage, "definition");
  assert.equal(data.activationReadModels.beta.stage, "blocked");
  assert.ok(data.activationMilestones.alpha.length > 0);
  assert.ok(data.activationMilestones.beta.some((milestone) => milestone.key === "blocked" && milestone.reached));
});

test("cleanupExpiredSessions removes expired and invalid sessions", () => {
  const data = makeStore();
  data.sessions = [
    makeSession("expired", "2026-04-22T10:00:00.000Z"),
    makeSession("active", "2026-04-24T10:00:00.000Z"),
    makeSession("invalid", "not-a-date"),
  ];

  const result = cleanupExpiredSessions(makeDeps(data), { now: "2026-04-23T10:00:00.000Z" });

  assert.equal(result.removed, 2);
  assert.deepEqual(result.removedSessionIds, ["expired", "invalid"]);
  assert.deepEqual(data.sessions.map((session) => session.id), ["active"]);
});

function makeDeps(data: TaskloomData): StoreJobDeps {
  return {
    loadStore: () => data,
    mutateStore: (mutator) => mutator(data),
  };
}

function makeStore(): TaskloomData {
  return {
    users: [],
    sessions: [],
    workspaces: [
      {
        id: "alpha",
        slug: "alpha",
        name: "Alpha",
        website: "",
        automationGoal: "",
        createdAt: "2026-04-20T10:00:00.000Z",
        updatedAt: "2026-04-20T10:00:00.000Z",
      },
      {
        id: "beta",
        slug: "beta",
        name: "Beta",
        website: "",
        automationGoal: "",
        createdAt: "2026-04-20T10:00:00.000Z",
        updatedAt: "2026-04-20T10:00:00.000Z",
      },
    ],
    memberships: [],
    workspaceBriefs: [],
    workspaceBriefVersions: [],
    requirements: [],
    implementationPlanItems: [],
    workflowConcerns: [],
    validationEvidence: [],
    releaseConfirmations: [],
    onboardingStates: [],
    activities: [],
    activationFacts: {
      alpha: {
        now: "2026-04-23T10:00:00.000Z",
        briefCapturedAt: "2026-04-20T10:00:00.000Z",
        requirementsDefinedAt: "2026-04-21T10:00:00.000Z",
        planDefinedAt: "2026-04-22T10:00:00.000Z",
      },
      beta: {
        now: "2026-04-23T10:00:00.000Z",
        briefCapturedAt: "2026-04-20T10:00:00.000Z",
        blockerCount: 2,
        criticalIssueCount: 1,
      },
    },
    agents: [],
    providers: [],
    agentRuns: [],
    activationMilestones: {},
    activationReadModels: {},
  };
}

function makeSession(id: string, expiresAt: string) {
  return {
    id,
    userId: "user_1",
    secretHash: "secret",
    createdAt: "2026-04-20T10:00:00.000Z",
    lastAccessedAt: "2026-04-20T10:00:00.000Z",
    expiresAt,
  };
}
