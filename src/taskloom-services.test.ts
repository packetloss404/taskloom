import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelAgentRun,
  buildAgentSampleInputs,
  completeOnboardingStep,
  createAgent,
  createWorkspaceEnvVar,
  deleteWorkspaceEnvVarById,
  getAgent,
  getIntegrationReadiness,
  getPrivateBootstrap,
  getWorkspaceActivityDetail,
  approveAgentBuilderDraftAsync,
  generateAgentDraftFromPrompt,
  generateAgentBuilderDraftAsync,
  listAgentRuns,
  listAgents,
  listReleaseHistory,
  listWorkspaceActivities,
  listWorkspaceEnvVarsForUser,
  login,
  register,
  retryAgentRun,
  runAgent,
  updateAgent,
  updateWorkspace,
  updateWorkspaceEnvVar,
} from "./taskloom-services";
import { loadStore, resetStoreForTests, snapshotForWorkspace } from "./taskloom-store";

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

test("integration readiness summarizes generated plan tool and provider setup gaps", () => {
  resetStoreForTests();
  const auth = login({ email: "beta@taskloom.local", password: "demo12345" });

  const readiness = getIntegrationReadiness(auth.context);

  assert.equal(readiness.status, "needs_setup");
  assert.ok(readiness.tools.availableCount > 0);
  assert.ok(readiness.tools.names.includes("read_workflow_brief"));
  assert.ok(readiness.tools.missingForGeneratedPlans.includes("gmail"));
  assert.deepEqual(readiness.providers.missingApiKeys, [{ provider: "anthropic", providerName: "Anthropic" }]);
  assert.ok(readiness.providers.missingProviderKinds.includes("openai"));
  assert.ok(readiness.recommendedSetup.some((entry) => entry.includes("Store vault keys")));
});

test("integration readiness treats external key configuration as provider ready", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const readiness = getIntegrationReadiness(auth.context);

  assert.equal(readiness.providers.configuredCount, 1);
  assert.equal(readiness.providers.readyCount, 1);
  assert.deepEqual(readiness.providers.missingApiKeys, []);
});

test("agent prompt generation returns a structured builder draft", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const draft = await generateAgentBuilderDraftAsync(auth.context, {
    prompt: "Build an agent that monitors support tickets daily, summarizes urgent escalations, opens blockers for unresolved incidents, and reports outcomes to operators.",
  });

  assert.equal(draft.agent.status, "active");
  assert.equal(draft.agent.triggerKind, "schedule");
  assert.equal(draft.agent.schedule, "0 8 * * 1-5");
  assert.match(draft.agent.name ?? "", /Support|agent/i);
  assert.ok(draft.agent.instructions?.includes("User request"));
  assert.ok(draft.agent.enabledTools?.includes("list_blockers"));
  assert.ok(draft.agent.playbook && draft.agent.playbook.length >= 3);
  assert.ok(draft.agent.inputSchema?.some((field) => field.key === "mailbox"));
  assert.ok(draft.plan.steps.length >= 3);
  assert.equal(draft.readiness.provider.configured, true);
  assert.ok(draft.readiness.firstRun.blockers.length >= 0);
});

test("agent builder drafts carry phase 71 integration flows and env setup references", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const draft = await generateAgentBuilderDraftAsync(auth.context, {
    prompt: "Create a daily agent that reads GitHub issues, sends Slack alerts, emails owners, and updates Stripe billing notes for escalations.",
  });

  assert.equal(draft.agent.triggerKind, "schedule");
  assert.deepEqual(
    draft.integrationMetadata.requested.map((integration) => integration.id),
    ["slack_webhook", "email", "github", "stripe"],
  );
  assert.match(draft.agent.instructions, /GITHUB_TOKEN/);
  assert.match(draft.agent.instructions, /SLACK_WEBHOOK_URL/);
  assert.ok(draft.agent.playbook.some((step) => step.title === "Prepare GitHub connector" && step.instruction.includes("GH_TOKEN")));
  assert.ok(draft.plan.steps.some((step) => step.title === "Prepare Stripe payments" && step.detail.includes("STRIPE_SECRET_KEY")));
  assert.ok(draft.plan.acceptanceChecks.some((check) => check.includes("remains draft-safe until setup is complete")));
  assert.ok(!draft.readiness.firstRun.blockers.some((blocker) => blocker.includes("STRIPE_SECRET_KEY")));
});

test("prompt agent drafts include requested integration setup without blocking unrelated features", () => {
  const draft = generateAgentDraftFromPrompt(
    "Build an agent to watch GitHub pull requests, send Slack webhook notifications, and summarize the result.",
  );

  assert.deepEqual(
    draft.integrationMetadata.requested.map((integration) => integration.id),
    ["slack_webhook", "github"],
  );
  assert.match(draft.agent.instructions, /GITHUB_TOKEN/);
  assert.match(draft.agent.instructions, /SLACK_WEBHOOK_URL/);
  assert.ok(draft.plan.some((item) => item.title === "Configure GitHub connector" && item.detail.includes("GH_TOKEN")));
  assert.ok(draft.assumptions.some((assumption) => assumption.includes("can be drafted before setup")));
});

test("prompt agent drafts include custom API integration setup", () => {
  const draft = generateAgentDraftFromPrompt(
    "Build an agent that calls a custom external API with a bearer token, normalizes the response, and writes a concise summary.",
  );

  assert.ok(draft.integrationMetadata.requested.some((integration) => integration.id === "custom_api"));
  assert.match(draft.agent.instructions, /CUSTOM_API_BASE_URL/);
  assert.ok(draft.plan.some((item) => item.title === "Configure Custom API provider"));
});

test("agent prompt generation can create an approved agent", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const result = await approveAgentBuilderDraftAsync(auth.context, {
    prompt: "Create a webhook agent to triage customer incidents, open blockers for critical risks, and log a concise summary.",
  });

  assert.equal(result.created, true);
  assert.ok(result.agent);
  assert.equal(result.agent.status, "active");
  assert.equal(result.agent.triggerKind, "webhook");
  assert.equal(result.draft.readiness.webhook.recommended, true);

  const detail = getAgent(auth.context, result.agent.id);
  assert.equal(detail.agent.id, result.agent.id);
  assert.equal(detail.agent.playbook?.[0].title, "Understand request");
});

test("agent prompt generation can attach a first preview run with sample inputs", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const result = await approveAgentBuilderDraftAsync(auth.context, {
    prompt: "Create a release audit agent that reviews evidence URLs, checks the release label, and reports blockers before launch.",
    runPreview: true,
  });

  assert.equal(result.created, true);
  assert.ok(result.agent);
  assert.ok(result.firstRun);
  assert.equal(result.firstRun.agentId, result.agent.id);
  assert.equal(result.firstRun.status, "success");
  assert.equal(result.firstRun.inputs?.release_label, "next release");
  assert.equal(result.firstRun.inputs?.evidence_url, "https://example.com");
  assert.match(result.firstRun.output ?? "", /preview run|simulated run completed/i);
  assert.ok(result.firstRun.transcript?.some((step) => step.title === "Understand request"));
  assert.ok(result.firstRun.logs?.some((entry) => entry.message.includes("without invoking tools or a model")));

  const detail = getAgent(auth.context, result.agent.id);
  assert.equal(detail.runs[0].id, result.firstRun.id);
});

test("agent builder preview respects first-run readiness blockers", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const draft = await generateAgentBuilderDraftAsync(auth.context, {
    prompt: "Create a research assistant agent that reviews a source URL and reports the next action.",
  });

  const result = await approveAgentBuilderDraftAsync(auth.context, {
    draft: {
      ...draft,
      readiness: {
        ...draft.readiness,
        firstRun: {
          canRun: false,
          blockers: ["Connect a provider API key before running with LLM tools."],
          message: "The draft can be saved now, but resolve setup blockers before expecting real execution.",
        },
      },
    },
    runPreview: true,
  });

  assert.equal(result.created, true);
  assert.equal(result.firstRun, undefined);
});

test("buildAgentSampleInputs returns valid typed defaults for run previews", () => {
  const sampleInputs = buildAgentSampleInputs([
    { key: "target_url", label: "Target URL", type: "url", required: true },
    { key: "lookback_hours", label: "Lookback", type: "number", required: true, defaultValue: "48" },
    { key: "include_runs", label: "Include runs", type: "boolean", required: false, defaultValue: "false" },
    { key: "audience", label: "Audience", type: "enum", required: false, options: ["internal", "customer"], defaultValue: "customer" },
    { key: "topic", label: "Topic", type: "string", required: true },
  ]);

  assert.deepEqual(sampleInputs, {
    target_url: "https://example.com",
    lookback_hours: 48,
    include_runs: false,
    audience: "customer",
    topic: "topic",
  });
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
  assert.equal(detail.agent.webhookToken, undefined);
  assert.equal(detail.agent.hasWebhookToken, true);
  assert.equal(detail.agent.webhookTokenPreview, "[redacted]:cret");
  const listed = listAgents(auth.context).agents.find((entry) => entry.id === created.agent.id);
  assert.equal(listed?.webhookToken, undefined);
  assert.equal(listed?.hasWebhookToken, true);
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

test("activity and run DTOs redact sensitive values", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const store = loadStore();
  store.activities.unshift({
    id: "activity_alpha_sensitive",
    workspaceId: "alpha",
    scope: "workspace",
    event: "test.sensitive",
    actor: { type: "system", id: "test" },
    data: {
      title: "Webhook failed at /api/public/webhooks/agents/whk_activity_secret",
      token: "invitation-token-1234",
    },
    occurredAt: new Date().toISOString(),
  });

  const activity = listWorkspaceActivities(auth.context).find((entry) => entry.id === "activity_alpha_sensitive");
  assert.ok(activity);
  assert.equal(JSON.stringify(activity).includes("whk_activity_secret"), false);
  assert.equal(JSON.stringify(activity).includes("invitation-token-1234"), false);

  const created = createAgent(auth.context, {
    name: "Sensitive Input Runner",
    description: "Exercises run DTO redaction.",
    instructions: "Record supplied inputs for test verification.",
    inputSchema: [{ key: "api_key", label: "API key", type: "string", required: true }],
  });
  const runResult = await runAgent(auth.context, created.agent.id, { inputs: { api_key: "sk_live_secret_1234" } });
  const detailWithRun = getAgent(auth.context, created.agent.id);

  assert.equal(JSON.stringify(runResult.run).includes("sk_live_secret_1234"), false);
  assert.equal(JSON.stringify(detailWithRun.runs[0]).includes("sk_live_secret_1234"), false);
  assert.notEqual(runResult.run.inputs?.api_key, "sk_live_secret_1234");
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

test("activity list and detail preserve workspace isolation and neighbor ordering", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const store = loadStore();

  store.activities.unshift(
    {
      id: "activity_alpha_newest_test",
      workspaceId: "alpha",
      scope: "activation",
      event: "test.activity_newest",
      actor: { type: "system", id: "test" },
      data: { title: "Newest alpha activity" },
      occurredAt: "2099-01-03T00:00:00.000Z",
    },
    {
      id: "activity_beta_hidden_test",
      workspaceId: "beta",
      scope: "activation",
      event: "test.activity_hidden",
      actor: { type: "system", id: "test" },
      data: { title: "Hidden beta activity" },
      occurredAt: "2099-01-02T00:00:00.000Z",
    },
    {
      id: "activity_alpha_next_test",
      workspaceId: "alpha",
      scope: "activation",
      event: "test.activity_next",
      actor: { type: "system", id: "test" },
      data: { title: "Next alpha activity" },
      occurredAt: "2099-01-01T00:00:00.000Z",
    },
  );

  const activities = listWorkspaceActivities(auth.context);
  assert.deepEqual(activities.map((entry) => entry.id).slice(0, 2), ["activity_alpha_newest_test", "activity_alpha_next_test"]);
  assert.ok(!activities.some((entry) => entry.workspaceId === "beta"));

  const detail = getWorkspaceActivityDetail(auth.context, "activity_alpha_newest_test");
  assert.equal(detail.previous, null);
  assert.equal(detail.next?.id, "activity_alpha_next_test");
});

test("env vars: create masks secrets and sensitive keys, prevents duplicate keys, supports update and delete", async () => {
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
  assert.notEqual(updated.envVar.value, "super-secret-value-1234");
  assert.match(updated.envVar.value, /1234$/);

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
  await retryAgentRun(auth.context, failed.id);

  const store = loadStore();
  const retrySignals = store.activationSignals.filter((entry) => entry.workspaceId === "beta" && entry.kind === "retry" && entry.sourceId === failed.id);
  const retryActivities = store.activities.filter((entry) => entry.workspaceId === "beta" && entry.event === "agent.run.retry" && entry.data.previousRunId === failed.id);
  assert.equal(retrySignals.length, 1);
  assert.equal(retryActivities.length, 1);
  assert.equal(snapshotForWorkspace(store, "beta").retryCount, store.activationSignals.filter((entry) => entry.workspaceId === "beta" && entry.kind === "retry").length);
  assert.equal(retrySignals[0].origin, "user_entered");
  assert.equal(retrySignals[0].data?.origin, "user_action");
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
