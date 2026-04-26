import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import {
  clearStoreCacheForTests,
  findSessionByIdIndexed,
  findShareTokenByTokenIndexed,
  findUserByEmailIndexed,
  findUserByIdIndexed,
  findWorkspaceInvitationByTokenIndexed,
  findWorkspaceMembershipIndexed,
  findWorkspaceBrief,
  loadStore,
  listSessionsForUserIndexed,
  listShareTokensForWorkspaceIndexed,
  listWorkspaceInvitationsIndexed,
  listWorkspaceMembershipsIndexed,
  findWorkspaceMembership,
  listAgentRunsForWorkspace,
  listAgentsForWorkspace,
  listProvidersForWorkspace,
  listReleaseConfirmationsForWorkspace,
  listRequirementsForWorkspace,
  listValidationEvidenceForWorkspace,
  listWorkflowConcernsForWorkspace,
  mutateStore,
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

test("sqlite store persists mutations across cache reloads", () => {
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-store-"));

  try {
    process.env.TASKLOOM_STORE = "sqlite";
    process.env.TASKLOOM_DB_PATH = join(tempDir, "taskloom.sqlite");

    resetStoreForTests();
    mutateStore((data) => {
      upsertRequirement(data, {
        id: "req_sqlite_reload",
        workspaceId: "alpha",
        title: "SQLite reload requirement",
        detail: "Persists through the database-backed store adapter.",
        priority: "must",
        status: "approved",
        acceptanceCriteria: ["Requirement survives cache clear"],
        source: "test",
        createdByUserId: "user_alpha",
      }, "2026-02-03T04:05:06.000Z");
    });

    clearStoreCacheForTests();
    const reloaded = loadStore();

    assert.equal(reloaded.requirements.some((entry) => entry.id === "req_sqlite_reload"), true);
    assert.equal(findWorkspaceBrief(reloaded, "alpha")?.workspaceId, "alpha");
  } finally {
    clearStoreCacheForTests();
    if (previousStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = previousStore;
    if (previousDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = previousDbPath;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("sqlite indexed helpers read high-value records and stay in sync", () => {
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-store-index-"));
  const dbPath = join(tempDir, "taskloom.sqlite");

  try {
    process.env.TASKLOOM_STORE = "sqlite";
    process.env.TASKLOOM_DB_PATH = dbPath;

    resetStoreForTests();
    mutateStore((data) => {
      data.users.push({
        id: "user_sqlite_index",
        email: "Indexed.User@Example.Com",
        displayName: "Indexed User",
        timezone: "UTC",
        passwordHash: "hash",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.sessions.push({
        id: "session_sqlite_index",
        userId: "user_sqlite_index",
        secretHash: "secret",
        createdAt: "2026-03-01T00:00:00.000Z",
        lastAccessedAt: "2026-03-01T00:00:00.000Z",
        expiresAt: "2026-04-01T00:00:00.000Z",
      });
      data.workspaces.push({
        id: "workspace_sqlite_index",
        slug: "sqlite-index",
        name: "SQLite Index",
        website: "",
        automationGoal: "",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.memberships.push({
        workspaceId: "workspace_sqlite_index",
        userId: "user_sqlite_index",
        role: "admin",
        joinedAt: "2026-03-01T00:00:00.000Z",
      });
      data.workspaceInvitations.push({
        id: "invite_sqlite_index",
        workspaceId: "workspace_sqlite_index",
        email: "invitee@example.com",
        role: "member",
        token: "invite-token-sqlite-index",
        invitedByUserId: "user_sqlite_index",
        expiresAt: "2026-04-01T00:00:00.000Z",
        createdAt: "2026-03-01T00:00:00.000Z",
      });
      data.shareTokens.push({
        id: "share_sqlite_index",
        workspaceId: "workspace_sqlite_index",
        token: "share-token-sqlite-index",
        scope: "overview",
        createdByUserId: "user_sqlite_index",
        readCount: 0,
        createdAt: "2026-03-01T00:00:00.000Z",
      });
    });

    clearStoreCacheForTests();
    assert.ok(indexRowCount(dbPath) >= 5);
    assert.equal(findUserByEmailIndexed("indexed.user@example.com")?.id, "user_sqlite_index");
    assert.equal(findUserByIdIndexed("user_sqlite_index")?.email, "Indexed.User@Example.Com");
    assert.equal(findSessionByIdIndexed("session_sqlite_index")?.userId, "user_sqlite_index");
    assert.equal(listSessionsForUserIndexed("user_sqlite_index").some((entry) => entry.id === "session_sqlite_index"), true);
    assert.equal(findWorkspaceMembershipIndexed("workspace_sqlite_index", "user_sqlite_index")?.role, "admin");
    assert.equal(listWorkspaceMembershipsIndexed("workspace_sqlite_index").some((entry) => entry.userId === "user_sqlite_index"), true);
    assert.equal(findWorkspaceInvitationByTokenIndexed("invite-token-sqlite-index")?.id, "invite_sqlite_index");
    assert.equal(listWorkspaceInvitationsIndexed("workspace_sqlite_index")[0]?.id, "invite_sqlite_index");
    assert.equal(findShareTokenByTokenIndexed("share-token-sqlite-index")?.id, "share_sqlite_index");
    assert.equal(listShareTokensForWorkspaceIndexed("workspace_sqlite_index")[0]?.id, "share_sqlite_index");

    mutateStore((data) => {
      const user = data.users.find((entry) => entry.id === "user_sqlite_index");
      assert.ok(user);
      user.email = "updated.index@example.com";
      user.updatedAt = "2026-03-02T00:00:00.000Z";
      data.sessions = data.sessions.filter((entry) => entry.id !== "session_sqlite_index");
      const shareToken = data.shareTokens.find((entry) => entry.id === "share_sqlite_index");
      assert.ok(shareToken);
      shareToken.token = "share-token-sqlite-updated";
      shareToken.readCount = 3;
    });

    clearStoreCacheForTests();
    assert.equal(findUserByEmailIndexed("indexed.user@example.com"), null);
    assert.equal(findUserByEmailIndexed("updated.index@example.com")?.id, "user_sqlite_index");
    assert.equal(findSessionByIdIndexed("session_sqlite_index"), null);
    assert.equal(findShareTokenByTokenIndexed("share-token-sqlite-index"), null);
    assert.equal(findShareTokenByTokenIndexed("share-token-sqlite-updated")?.readCount, 3);
  } finally {
    clearStoreCacheForTests();
    if (previousStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = previousStore;
    if (previousDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = previousDbPath;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function indexRowCount(dbPath: string): number {
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare("select count(*) as count from app_record_search").get() as { count: number };
    return row.count;
  } finally {
    db.close();
  }
}
