import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import {
  activationSignalRepository,
  clearStoreCacheForTests,
  createInvitationEmailDelivery,
  findInvitationEmailDelivery,
  findSessionByIdIndexed,
  findShareTokenByTokenIndexed,
  findUserByEmailIndexed,
  findUserByIdIndexed,
  findWorkspaceInvitationByTokenIndexed,
  findWorkspaceMembershipIndexed,
  findWorkspaceBrief,
  listActivitiesForWorkspaceIndexed,
  listAgentRunsForWorkspaceIndexed,
  listAgentsForWorkspaceIndexed,
  listImplementationPlanItemsForWorkspaceIndexed,
  listJobsForWorkspaceIndexed,
  listProviderCallsForWorkspaceIndexed,
  listRequirementsForWorkspaceIndexed,
  loadStore,
  listSessionsForUserIndexed,
  listShareTokensForWorkspaceIndexed,
  listActivationSignalsForWorkspace,
  listInvitationEmailDeliveries,
  listInvitationEmailDeliveriesIndexed,
  listValidationEvidenceForWorkspaceIndexed,
  listWorkspaceBriefVersionsIndexed,
  listWorkspaceRecordsIndexed,
  listWorkflowConcernsForWorkspaceIndexed,
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
  markInvitationEmailDeliveryFailed,
  markInvitationEmailDeliverySent,
  markInvitationEmailDeliverySkipped,
  mutateStore,
  resetStoreForTests,
  upsertActivationSignal,
  upsertRequirement,
  upsertWorkspaceBrief,
  upsertWorkspaceMembership,
  type WorkspaceRole,
} from "./taskloom-store";
import { recordLocalInvitationEmailDelivery, TASKLOOM_INVITATION_EMAIL_MODE_ENV } from "./invitation-email";

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

test("invitation email deliveries record local sent and skipped attempts", () => {
  const previousMode = process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV];

  try {
    delete process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV];
    const store = resetStoreForTests();
    const invitation = {
      id: "invite_email_delivery",
      workspaceId: "alpha",
      email: "Invitee@Example.Com",
      role: "member" as const,
      token: "invite-email-delivery-token",
      invitedByUserId: "user_alpha",
      expiresAt: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
    };

    const sent = recordLocalInvitationEmailDelivery(store, {
      invitation,
      workspaceName: "Alpha Workspace",
      deliveryId: "delivery_sent",
      timestamp: "2026-04-01T00:00:01.000Z",
    });

    assert.equal(sent.status, "sent");
    assert.equal(sent.mode, "dev");
    assert.equal(sent.provider, "local");
    assert.equal(sent.recipientEmail, "invitee@example.com");
    assert.equal(sent.subject, "You're invited to Alpha Workspace on Taskloom");
    assert.equal(sent.sentAt, "2026-04-01T00:00:01.000Z");

    process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV] = "skip";
    const skipped = recordLocalInvitationEmailDelivery(store, {
      invitation: { ...invitation, id: "invite_email_delivery_skipped" },
      deliveryId: "delivery_skipped",
      timestamp: "2026-04-01T00:00:02.000Z",
    });

    assert.equal(skipped.status, "skipped");
    assert.equal(skipped.mode, "skip");
    assert.equal(skipped.sentAt, undefined);
    assert.equal(skipped.error, `${TASKLOOM_INVITATION_EMAIL_MODE_ENV}=skip`);
    assert.deepEqual(listInvitationEmailDeliveries(store, "alpha").map((entry) => entry.id), ["delivery_skipped", "delivery_sent"]);
    assert.deepEqual(listInvitationEmailDeliveries(store, "alpha", "invite_email_delivery").map((entry) => entry.id), ["delivery_sent"]);
  } finally {
    if (previousMode === undefined) delete process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV];
    else process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV] = previousMode;
  }
});

test("invitation email delivery helpers create and mark durable records", () => {
  const store = resetStoreForTests();
  const delivery = createInvitationEmailDelivery(store, {
    id: "delivery_marking",
    workspaceId: "alpha",
    invitationId: "invite_marking",
    recipientEmail: "Mark.Me@Example.Com",
    subject: "Invitation",
    provider: "local",
    mode: "dev",
  }, "2026-04-02T00:00:00.000Z");

  assert.equal(delivery.status, "pending");
  assert.equal(delivery.recipientEmail, "mark.me@example.com");
  assert.equal(markInvitationEmailDeliverySent(store, "delivery_marking", "2026-04-02T00:00:01.000Z")?.sentAt, "2026-04-02T00:00:01.000Z");
  assert.equal(markInvitationEmailDeliverySkipped(store, "delivery_marking", "not needed")?.status, "skipped");
  assert.equal(findInvitationEmailDelivery(store, "delivery_marking")?.sentAt, undefined);
  assert.equal(markInvitationEmailDeliveryFailed(store, "delivery_marking", "boom")?.error, "boom");
  assert.equal(findInvitationEmailDelivery(store, "missing_delivery"), null);
});

test("activation signal repository deduplicates JSON records by stable key", () => {
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;

  try {
    delete process.env.TASKLOOM_STORE;
    delete process.env.TASKLOOM_DB_PATH;
    const store = resetStoreForTests();

    const direct = upsertActivationSignal(store, {
      workspaceId: "alpha",
      kind: "retry",
      source: "user_fact",
      stableKey: "alpha:retry:user-entered",
      data: { reason: "Initial user-entered retry" },
    }, "2026-04-01T00:00:00.000Z");
    assert.equal(direct.source, "user_fact");
    assert.equal(direct.origin, "user_entered");

    const repository = activationSignalRepository();
    const first = repository.upsert({
      workspaceId: "alpha",
      kind: "retry",
      source: "user_fact",
      stableKey: "alpha:retry:repository",
      data: { reason: "Entered by a user" },
    }, "2026-04-02T00:00:00.000Z");
    const second = repository.upsert({
      workspaceId: "alpha",
      kind: "retry",
      source: "system_fact",
      stableKey: "alpha:retry:repository",
      data: { reason: "Observed by the system" },
    }, "2026-04-03T00:00:00.000Z");

    assert.equal(second.id, first.id);
    assert.equal(second.createdAt, first.createdAt);
    assert.equal(second.updatedAt, "2026-04-03T00:00:00.000Z");
    assert.equal(second.source, "system_fact");
    assert.equal(second.origin, "system_observed");
    assert.equal(repository.listForWorkspace("alpha").filter((entry) => entry.stableKey === "alpha:retry:repository").length, 1);
    assert.equal(listActivationSignalsForWorkspace(loadStore(), "alpha").some((entry) => entry.id === first.id), true);
  } finally {
    clearStoreCacheForTests();
    if (previousStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = previousStore;
    if (previousDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = previousDbPath;
  }
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

test("activation signal repository persists and lists SQLite records by workspace", () => {
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-store-signals-"));
  const dbPath = join(tempDir, "taskloom.sqlite");

  try {
    process.env.TASKLOOM_STORE = "sqlite";
    process.env.TASKLOOM_DB_PATH = dbPath;

    resetStoreForTests();
    const repository = activationSignalRepository();
    const first = repository.upsert({
      workspaceId: "workspace_sqlite_signals",
      kind: "scope_change",
      source: "system_fact",
      stableKey: "workspace_sqlite_signals:scope:billing",
      sourceId: "activity_scope_billing",
      data: { area: "billing" },
    }, "2026-04-04T00:00:00.000Z");
    const second = repository.upsert({
      workspaceId: "workspace_sqlite_signals",
      kind: "scope_change",
      source: "user_fact",
      stableKey: "workspace_sqlite_signals:scope:billing",
      sourceId: "manual_scope_billing",
      data: { area: "billing", confirmed: true },
    }, "2026-04-05T00:00:00.000Z");

    assert.equal(second.id, first.id);
    assert.equal(repository.listForWorkspace("workspace_sqlite_signals").length, 1);
    assert.equal(repository.listForWorkspace("workspace_sqlite_signals")[0]?.source, "user_fact");
    assert.equal(repository.listForWorkspace("workspace_sqlite_signals")[0]?.origin, "user_entered");
    assert.equal(activationSignalRowCount(dbPath, "workspace_sqlite_signals"), 1);

    clearStoreCacheForTests();
    const reloaded = loadStore();
    const signals = listActivationSignalsForWorkspace(reloaded, "workspace_sqlite_signals");
    assert.equal(signals.length, 1);
    assert.equal(signals[0]?.stableKey, "workspace_sqlite_signals:scope:billing");
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
      data.invitationEmailDeliveries.push({
        id: "delivery_sqlite_index",
        workspaceId: "workspace_sqlite_index",
        invitationId: "invite_sqlite_index",
        recipientEmail: "invitee@example.com",
        subject: "You're invited to SQLite Index on Taskloom",
        status: "sent",
        provider: "local",
        mode: "dev",
        createdAt: "2026-03-01T00:00:01.000Z",
        sentAt: "2026-03-01T00:00:01.000Z",
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
    assert.equal(listInvitationEmailDeliveriesIndexed("workspace_sqlite_index")[0]?.id, "delivery_sqlite_index");
    assert.equal(listInvitationEmailDeliveriesIndexed("workspace_sqlite_index", "invite_sqlite_index")[0]?.recipientEmail, "invitee@example.com");
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

test("sqlite workspace record helpers read scoped collections with route ordering", () => {
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-store-workspace-records-"));
  const dbPath = join(tempDir, "taskloom.sqlite");

  try {
    process.env.TASKLOOM_STORE = "sqlite";
    process.env.TASKLOOM_DB_PATH = dbPath;

    resetStoreForTests();
    mutateStore((data) => {
      data.activities.push({
        id: "activity_workspace_records_old",
        workspaceId: "workspace_records",
        scope: "workspace",
        event: "workspace.old",
        occurredAt: "2026-03-01T00:00:00.000Z",
        actor: { type: "system", id: "test" },
        data: {},
      });
      data.activities.push({
        id: "activity_workspace_records_new",
        workspaceId: "workspace_records",
        scope: "workspace",
        event: "workspace.new",
        occurredAt: "2026-03-02T00:00:00.000Z",
        actor: { type: "system", id: "test" },
        data: {},
      });
      data.activities.push({
        id: "activity_other_workspace",
        workspaceId: "other_workspace",
        scope: "workspace",
        event: "workspace.private",
        occurredAt: "2026-03-03T00:00:00.000Z",
        actor: { type: "system", id: "test" },
        data: {},
      });
      data.requirements.push({
        id: "req_workspace_records",
        workspaceId: "workspace_records",
        title: "Workspace-scoped requirement",
        priority: "must",
        status: "approved",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.implementationPlanItems.push({
        id: "plan_workspace_records_second",
        workspaceId: "workspace_records",
        requirementIds: ["req_workspace_records"],
        title: "Second plan item",
        description: "Sorts after the first item.",
        status: "todo",
        order: 2,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.implementationPlanItems.push({
        id: "plan_workspace_records_first",
        workspaceId: "workspace_records",
        requirementIds: ["req_workspace_records"],
        title: "First plan item",
        description: "Sorts before the second item.",
        status: "todo",
        order: 1,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.workflowConcerns.push({
        id: "concern_workspace_records_question",
        workspaceId: "workspace_records",
        kind: "open_question",
        title: "Question",
        description: "Question for workspace helper.",
        status: "open",
        severity: "medium",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.validationEvidence.push({
        id: "evidence_workspace_records",
        workspaceId: "workspace_records",
        title: "Evidence",
        status: "passed",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.agents.push({
        id: "agent_workspace_records_old",
        workspaceId: "workspace_records",
        name: "Old agent",
        description: "Older agent.",
        instructions: "Do the old thing.",
        tools: [],
        status: "active",
        createdByUserId: "user_alpha",
        inputSchema: [],
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.agents.push({
        id: "agent_workspace_records_new",
        workspaceId: "workspace_records",
        name: "New agent",
        description: "Newer agent.",
        instructions: "Do the new thing.",
        tools: [],
        status: "active",
        createdByUserId: "user_alpha",
        inputSchema: [],
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      });
      data.agentRuns.push({
        id: "run_workspace_records_old",
        workspaceId: "workspace_records",
        agentId: "agent_workspace_records_new",
        title: "Old run",
        status: "success",
        logs: [],
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.agentRuns.push({
        id: "run_workspace_records_new",
        workspaceId: "workspace_records",
        agentId: "agent_workspace_records_new",
        title: "New run",
        status: "success",
        logs: [],
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      });
      data.providerCalls.push({
        id: "provider_call_workspace_records_old",
        workspaceId: "workspace_records",
        routeKey: "test.route",
        provider: "stub",
        model: "stub",
        promptTokens: 1,
        completionTokens: 1,
        costUsd: 0,
        durationMs: 1,
        status: "success",
        startedAt: "2026-03-01T00:00:00.000Z",
        completedAt: "2026-03-01T00:00:00.000Z",
      });
      data.providerCalls.push({
        id: "provider_call_workspace_records_new",
        workspaceId: "workspace_records",
        routeKey: "test.route",
        provider: "stub",
        model: "stub",
        promptTokens: 1,
        completionTokens: 1,
        costUsd: 0,
        durationMs: 1,
        status: "success",
        startedAt: "2026-03-02T00:00:00.000Z",
        completedAt: "2026-03-02T00:00:00.000Z",
      });
      data.jobs.push({
        id: "job_workspace_records_old",
        workspaceId: "workspace_records",
        type: "test",
        payload: {},
        status: "success",
        attempts: 1,
        maxAttempts: 1,
        scheduledAt: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
      data.jobs.push({
        id: "job_workspace_records_new",
        workspaceId: "workspace_records",
        type: "test",
        payload: {},
        status: "queued",
        attempts: 0,
        maxAttempts: 1,
        scheduledAt: "2026-03-02T00:00:00.000Z",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      });
      data.workspaceBriefVersions.push({
        id: "brief_version_workspace_records_1",
        workspaceId: "workspace_records",
        versionNumber: 1,
        summary: "First version",
        goals: [],
        audience: "",
        constraints: "",
        problemStatement: "",
        targetCustomers: [],
        desiredOutcome: "",
        successMetrics: [],
        source: "manual",
        createdAt: "2026-03-01T00:00:00.000Z",
      });
      data.workspaceBriefVersions.push({
        id: "brief_version_workspace_records_2",
        workspaceId: "workspace_records",
        versionNumber: 2,
        summary: "Second version",
        goals: [],
        audience: "",
        constraints: "",
        problemStatement: "",
        targetCustomers: [],
        desiredOutcome: "",
        successMetrics: [],
        source: "manual",
        createdAt: "2026-03-02T00:00:00.000Z",
      });
    });

    clearStoreCacheForTests();
    assert.deepEqual(listActivitiesForWorkspaceIndexed("workspace_records", 1).map((entry) => entry.id), ["activity_workspace_records_new"]);
    assert.deepEqual(listImplementationPlanItemsForWorkspaceIndexed("workspace_records").map((entry) => entry.id), ["plan_workspace_records_first", "plan_workspace_records_second"]);
    assert.deepEqual(listAgentsForWorkspaceIndexed("workspace_records").map((entry) => entry.id), ["agent_workspace_records_new", "agent_workspace_records_old"]);
    assert.deepEqual(listAgentRunsForWorkspaceIndexed("workspace_records").map((entry) => entry.id), ["run_workspace_records_new", "run_workspace_records_old"]);
    assert.deepEqual(listProviderCallsForWorkspaceIndexed("workspace_records", { limit: 1 }).map((entry) => entry.id), ["provider_call_workspace_records_new"]);
    assert.deepEqual(listJobsForWorkspaceIndexed("workspace_records", { status: "queued", limit: 1 }).map((entry) => entry.id), ["job_workspace_records_new"]);
    assert.deepEqual(listWorkspaceBriefVersionsIndexed("workspace_records").map((entry) => entry.id), ["brief_version_workspace_records_2", "brief_version_workspace_records_1"]);
    assert.equal(listRequirementsForWorkspaceIndexed("workspace_records").some((entry) => entry.id === "req_workspace_records"), true);
    assert.equal(listWorkflowConcernsForWorkspaceIndexed("workspace_records", "open_question").length, 1);
    assert.equal(listValidationEvidenceForWorkspaceIndexed("workspace_records").length, 1);
    assert.equal(listWorkspaceRecordsIndexed("activities", "workspace_records").some((entry) => entry.workspaceId === "other_workspace"), false);

    mutateStore((data) => {
      const requirement = data.requirements.find((entry) => entry.id === "req_workspace_records");
      assert.ok(requirement);
      requirement.title = "Updated workspace-scoped requirement";
      requirement.updatedAt = "2026-03-03T00:00:00.000Z";
      data.validationEvidence = data.validationEvidence.filter((entry) => entry.id !== "evidence_workspace_records");
    });

    clearStoreCacheForTests();
    assert.equal(listRequirementsForWorkspaceIndexed("workspace_records")[0]?.title, "Updated workspace-scoped requirement");
    assert.equal(listValidationEvidenceForWorkspaceIndexed("workspace_records").length, 0);
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

function activationSignalRowCount(dbPath: string, workspaceId: string): number {
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare("select count(*) as count from app_records where collection = 'activationSignals' and workspace_id = ?").get(workspaceId) as { count: number };
    return row.count;
  } finally {
    db.close();
  }
}
