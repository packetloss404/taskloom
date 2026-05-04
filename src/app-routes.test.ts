import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { SESSION_COOKIE_NAME } from "./auth-utils";
import { appRoutes } from "./app-routes";
import { login } from "./taskloom-services";
import {
  clearStoreCacheForTests,
  createSeedStore,
  loadStore,
  mutateStore,
  resetStoreForTests,
  setManagedPostgresStoreClientFactoryForTests,
  type ManagedPostgresStoreClientConfig,
  type ManagedPostgresStoreQueryClient,
  type ManagedPostgresStoreQueryResult,
  type TaskloomData,
} from "./taskloom-store";

const STORE_ENV_KEYS = [
  "TASKLOOM_STORE",
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
  "TASKLOOM_MANAGED_DATABASE_URL",
] as const;

type StoreEnvKey = (typeof STORE_ENV_KEYS)[number];

class FakeManagedPostgresClient implements ManagedPostgresStoreQueryClient {
  payloadJson: string | null = JSON.stringify(createSeedStore());

  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<ManagedPostgresStoreQueryResult<TRow>> {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.startsWith("select payload from taskloom_document_store")) {
      return { rows: this.payloadJson ? [{ payload: this.payloadJson } as unknown as TRow] : [] };
    }
    if (normalized.startsWith("insert into taskloom_document_store")) {
      this.payloadJson = String(params[3]);
    }
    return { rows: [] };
  }

  storedData(): TaskloomData {
    assert.ok(this.payloadJson);
    return JSON.parse(this.payloadJson) as TaskloomData;
  }
}

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

async function withManagedStoreEnv(
  env: Partial<Record<StoreEnvKey, string>>,
  client: FakeManagedPostgresClient,
  run: (configs: ManagedPostgresStoreClientConfig[]) => Promise<void> | void,
) {
  const previous = new Map<StoreEnvKey, string | undefined>();
  for (const key of STORE_ENV_KEYS) previous.set(key, process.env[key]);

  const configs: ManagedPostgresStoreClientConfig[] = [];
  const restoreFactory = setManagedPostgresStoreClientFactoryForTests((config) => {
    configs.push(config);
    return client;
  });

  try {
    for (const key of STORE_ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(env) as Array<[StoreEnvKey, string | undefined]>) {
      if (value !== undefined) process.env[key] = value;
    }
    clearStoreCacheForTests();
    await run(configs);
  } finally {
    clearStoreCacheForTests();
    restoreFactory();
    for (const key of STORE_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("app activation route requires authentication", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/app/activation");
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "authentication required" });
});

test("auth session routes run through the async managed store backend", async () => {
  const client = new FakeManagedPostgresClient();

  await withManagedStoreEnv({
    TASKLOOM_STORE: "postgres",
    TASKLOOM_DATABASE_URL: "postgres://taskloom:secret@db.example.com/taskloom",
  }, client, async (configs) => {
    const app = createTestApp();

    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alpha@taskloom.local", password: "demo12345" }),
    });
    const loginBody = await loginResponse.json() as { authenticated: boolean; user: { id: string } };

    assert.equal(configs[0].envKey, "TASKLOOM_DATABASE_URL");
    assert.equal(loginResponse.status, 200);
    assert.equal(loginBody.authenticated, true);
    assert.equal(loginBody.user.id, "user_alpha");

    const sessionResponse = await app.request("/api/auth/session", {
      headers: authHeaders(cookieValue(loginResponse)),
    });
    const sessionBody = await sessionResponse.json() as { authenticated: boolean; user: { id: string } };

    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionBody.authenticated, true);
    assert.equal(sessionBody.user.id, "user_alpha");
    assert.equal(client.storedData().sessions.some((entry) => entry.userId === "user_alpha"), true);
  });
});

test("app activation detail is scoped to the authenticated workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const response = await app.request("/api/app/activation", {
    headers: authHeaders(alpha.cookieValue),
  });
  const body = await response.json() as { workspace: { id: string }; activities: { workspaceId: string }[] };

  assert.equal(response.status, 200);
  assert.equal(body.workspace.id, "alpha");
  assert.ok(body.activities.length > 0);
  assert.ok(body.activities.every((activity) => activity.workspaceId === "alpha"));
});

test("integration marketplace route requires authentication", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/app/integration-marketplace");
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "authentication required" });
});

test("model routing presets route requires authentication", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/app/model-routing-presets");
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "authentication required" });
});

test("model routing presets route exposes safe workspace-scoped presets", async (t) => {
  resetStoreForTests();
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousFast = process.env.TASKLOOM_MODEL_PRESET_FAST;
  t.after(() => {
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;
    if (previousFast === undefined) delete process.env.TASKLOOM_MODEL_PRESET_FAST;
    else process.env.TASKLOOM_MODEL_PRESET_FAST = previousFast;
  });
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  process.env.OPENAI_API_KEY = "sk-route-secret";
  process.env.TASKLOOM_MODEL_PRESET_FAST = "openai:gpt-4.1-mini";

  const response = await app.request("/api/app/model-routing-presets", {
    headers: authHeaders(alpha.cookieValue),
  });
  const body = await response.json() as {
    routingPresets?: {
      version?: string;
      presets?: {
        fast?: { primary?: { provider?: string; model?: string; envHints?: string[] } };
        smart?: { fallbacks?: Array<{ provider?: string }> };
        local?: { primary?: { provider?: string } };
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.routingPresets?.version, "phase-72-lane-4");
  assert.equal(body.routingPresets?.presets?.fast?.primary?.provider, "openai");
  assert.equal(body.routingPresets?.presets?.fast?.primary?.model, "gpt-4.1-mini");
  assert.ok(body.routingPresets?.presets?.fast?.primary?.envHints?.includes("TASKLOOM_MODEL_PRESET_FAST"));
  assert.equal(JSON.stringify(body).includes("sk-route-secret"), false);

  const aliasResponse = await app.request("/api/app/llm/routing-presets", {
    headers: authHeaders(alpha.cookieValue),
  });
  assert.equal(aliasResponse.status, 200);
});

test("integration marketplace route exposes cards, readiness, config, and test payloads without secrets", async (t) => {
  resetStoreForTests();
  const previousOpenAi = process.env.OPENAI_API_KEY;
  t.after(() => {
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;
  });
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  process.env.OPENAI_API_KEY = "sk-route-secret";

  const response = await app.request("/api/app/integration-marketplace", {
    headers: authHeaders(alpha.cookieValue),
  });
  const body = await response.json() as {
    marketplace?: {
      version?: string;
      cards?: Array<{
        id: string;
        config: { requiredEnv: string[]; secretsRedacted: boolean };
        test: { method: string; path: string; body: Record<string, unknown> };
        readiness: { status: string; blockers: string[] };
      }>;
    };
  };
  const cards = body.marketplace?.cards ?? [];

  assert.equal(response.status, 200);
  assert.equal(body.marketplace?.version, "phase-71-lane-4");
  assert.equal(cards.length, 10);
  assert.ok(cards.some((card) => card.id === "openai" && card.config.requiredEnv.includes("OPENAI_API_KEY")));
  assert.ok(cards.some((card) => card.id === "database" && card.config.requiredEnv.includes("DATABASE_URL")));
  assert.ok(cards.some((card) => card.id === "stripe-payments" && card.test.path.includes("stripe-payments")));
  assert.ok(cards.every((card) => card.config.secretsRedacted));
  assert.equal(JSON.stringify(body).includes("sk-route-secret"), false);

  const aliasResponse = await app.request("/api/app/integrations/marketplace", {
    headers: authHeaders(alpha.cookieValue),
  });
  assert.equal(aliasResponse.status, 200);
});

test("integration marketplace advertised test routes use deterministic sandbox checks", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const headers = { ...authHeaders(alpha.cookieValue), "Content-Type": "application/json" };

  mutateStore((data) => {
    data.workspaceEnvVars.push({
      id: "env_alpha_route_email_test",
      workspaceId: "alpha",
      key: "RESEND_API_KEY",
      value: "re_route_test_secret",
      scope: "runtime",
      secret: true,
      description: "route test email key",
      createdByUserId: "user_alpha",
      createdAt: "2026-05-03T21:00:00.000Z",
      updatedAt: "2026-05-03T21:00:00.000Z",
    });
  });

  const llmResponse = await app.request("/api/app/llm/test", {
    method: "POST",
    headers,
    body: JSON.stringify({ provider: "openai", prompt: "Reply with ok." }),
  });
  const llmBody = await llmResponse.json() as {
    test?: { connectorId?: string; deterministic?: boolean; liveNetworkCalls?: boolean };
    sandbox?: { version?: string };
  };

  assert.equal(llmResponse.status, 200);
  assert.equal(llmBody.test?.connectorId, "model_provider");
  assert.equal(llmBody.test?.deterministic, true);
  assert.equal(llmBody.test?.liveNetworkCalls, false);
  assert.equal(llmBody.sandbox?.version, "phase-71-lane-3");

  const stripeResponse = await app.request("/api/app/integrations/stripe-payments/test", {
    method: "POST",
    headers,
    body: JSON.stringify({ dryRun: true, sample: { id: "cs_test_123" } }),
  });
  const stripeBody = await stripeResponse.json() as { test?: { connectorId?: string } };

  assert.equal(stripeResponse.status, 200);
  assert.equal(stripeBody.test?.connectorId, "payment");

  const emailResponse = await app.request("/api/app/integrations/email/test", {
    method: "POST",
    headers,
    body: JSON.stringify({ dryRun: true, sample: { to: "ops@example.test" } }),
  });
  const emailBody = await emailResponse.json() as { test?: { connectorId?: string; status?: string }; sandbox?: unknown };

  assert.equal(emailResponse.status, 200);
  assert.equal(emailBody.test?.connectorId, "email");
  assert.equal(emailBody.test?.status, "pass");
  assert.equal(JSON.stringify(emailBody).includes("re_route_test_secret"), false);
});

test("activity list and detail do not expose another workspace", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });

  mutateStore((data) => {
    data.activities.unshift(
      {
        id: "activity_beta_private_route_test",
        workspaceId: "beta",
        scope: "activation",
        event: "route.private_beta",
        actor: { type: "system", id: "test" },
        data: { title: "Beta private activity" },
        occurredAt: "2026-01-03T00:00:00.000Z",
      },
      {
        id: "activity_alpha_newer_route_test",
        workspaceId: "alpha",
        scope: "activation",
        event: "route.alpha_newer",
        actor: { type: "system", id: "test" },
        data: { title: "Alpha newer activity" },
        occurredAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "activity_alpha_older_route_test",
        workspaceId: "alpha",
        scope: "activation",
        event: "route.alpha_older",
        actor: { type: "system", id: "test" },
        data: { title: "Alpha older activity" },
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
    );
  });

  const listResponse = await app.request("/api/app/activity", {
    headers: authHeaders(alpha.cookieValue),
  });
  const listBody = await listResponse.json() as { activities: { id: string; workspaceId: string }[] };

  assert.equal(listResponse.status, 200);
  assert.ok(listBody.activities.some((activity) => activity.id === "activity_alpha_newer_route_test"));
  assert.ok(!listBody.activities.some((activity) => activity.id === "activity_beta_private_route_test"));
  assert.ok(listBody.activities.every((activity) => activity.workspaceId === "alpha"));

  const detailResponse = await app.request("/api/app/activity/activity_beta_private_route_test", {
    headers: authHeaders(alpha.cookieValue),
  });
  const detailBody = await detailResponse.json();

  assert.equal(detailResponse.status, 404);
  assert.deepEqual(detailBody, { error: "activity not found" });
});

test("builder agent draft can be approved into an agent", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const headers = { ...authHeaders(alpha.cookieValue), "Content-Type": "application/json" };

  const draftResponse = await app.request("/api/app/builder/agent-draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: "Create a release audit agent that reviews evidence URLs, checks the release label, and reports blockers before launch.",
    }),
  });
  const draftBody = await draftResponse.json() as { draft?: { agent?: { name?: string } } };

  assert.equal(draftResponse.status, 200);
  assert.equal(draftBody.draft?.agent?.name, "Release audit agent");

  const approveResponse = await app.request("/api/app/builder/agent-draft/approve", {
    method: "POST",
    headers,
    body: JSON.stringify({ draft: draftBody.draft, runPreview: true }),
  });
  const approveBody = await approveResponse.json() as { agent?: { id?: string }; firstRun?: { status?: string } };

  assert.equal(approveResponse.status, 201);
  assert.ok(approveBody.agent?.id);
  assert.equal(approveBody.firstRun?.status, "success");
  assert.ok(loadStore().agents.some((agent) => agent.id === approveBody.agent?.id));

  const agentPublishStateResponse = await app.request(`/api/app/builder/publish/state?agentId=${approveBody.agent?.id}`, {
    headers,
  });
  const agentPublishState = await agentPublishStateResponse.json() as { agentId?: string; canPublish?: boolean };

  assert.equal(agentPublishStateResponse.status, 200);
  assert.equal(agentPublishState.agentId, approveBody.agent?.id);
  assert.equal(agentPublishState.canPublish, true);

  const agentPublishResponse = await app.request("/api/app/builder/publishes", {
    method: "POST",
    headers,
    body: JSON.stringify({ agentId: approveBody.agent?.id, target: "agent", visibility: "private" }),
  });
  const agentPublish = await agentPublishResponse.json() as {
    published?: boolean;
    publishId?: string;
    state?: { agentId?: string; publishedUrl?: string; status?: string };
  };

  assert.equal(agentPublishResponse.status, 201);
  assert.equal(agentPublish.published, true);
  assert.ok(agentPublish.publishId);
  assert.equal(agentPublish.state?.agentId, approveBody.agent?.id);
  assert.equal(agentPublish.state?.status, "published");
  assert.match(agentPublish.state?.publishedUrl ?? "", /localhost:8484/);

  const persistedAgentStateResponse = await app.request(`/api/app/builder/publish/state?agentId=${approveBody.agent?.id}`, {
    headers,
  });
  const persistedAgentState = await persistedAgentStateResponse.json() as {
    agentId?: string;
    currentPublishId?: string;
    publishedUrl?: string;
    status?: string;
    history?: unknown[];
  };

  assert.equal(persistedAgentStateResponse.status, 200);
  assert.equal(persistedAgentState.agentId, approveBody.agent?.id);
  assert.equal(persistedAgentState.currentPublishId, agentPublish.publishId);
  assert.equal(persistedAgentState.status, "published");
  assert.equal(persistedAgentState.publishedUrl, agentPublish.state?.publishedUrl);
  assert.ok((persistedAgentState.history?.length ?? 0) >= 1);
});

test("builder app draft can be generated and applied with smoke metadata", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const headers = { ...authHeaders(alpha.cookieValue), "Content-Type": "application/json" };

  const draftResponse = await app.request("/api/app/builder/app-draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: "Build a public booking app with services, appointment slots, staff calendars, and admin controls.",
    }),
  });
  const draftBody = await draftResponse.json() as {
    draft?: {
      intent?: string;
      app?: {
        name?: string;
        slug?: string;
        pages?: Array<{ route: string; access: string; components: string[] }>;
        dataSchema?: Array<{ name: string }>;
        apiRoutes?: Array<{ path: string; authRequired: boolean }>;
      };
      smokeBuildStatus?: { status?: string; checks?: unknown[]; blockers?: string[] };
    };
  };

  assert.equal(draftResponse.status, 200);
  assert.equal(draftBody.draft?.intent, "booking");
  assert.ok(draftBody.draft?.app?.slug);
  assert.ok(draftBody.draft?.app?.pages?.some((page) => page.route === "/book" && page.access === "public" && page.components.length > 0));
  assert.ok(draftBody.draft?.app?.dataSchema?.some((entity) => entity.name === "appointment"));
  assert.ok(draftBody.draft?.app?.apiRoutes?.some((route) => route.path.includes("/api/app/generated/") && route.path.includes("/appointments") && route.authRequired));
  assert.equal(draftBody.draft?.smokeBuildStatus?.status, "pending");
  assert.ok((draftBody.draft?.smokeBuildStatus?.checks?.length ?? 0) > 0);
  assert.deepEqual(draftBody.draft?.smokeBuildStatus?.blockers, []);

  const applyResponse = await app.request("/api/app/builder/app-draft/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({ draft: draftBody.draft, runSmoke: true }),
  });
  const applyBody = await applyResponse.json() as {
    created?: boolean;
    applied?: boolean;
    app?: { id?: string; status?: string; previewUrl?: string };
    checkpoint?: { id?: string; appId?: string };
    previewUrl?: string;
    smokeBuild?: { status?: string; checks?: unknown[] };
  };

  assert.equal(applyResponse.status, 201);
  assert.equal(applyBody.created, true);
  assert.equal(applyBody.applied, true);
  assert.equal(applyBody.app?.status, "built");
  assert.match(applyBody.app?.previewUrl ?? "", /\/builder\/preview\/alpha\//);
  assert.equal(applyBody.previewUrl, applyBody.app?.previewUrl);
  assert.ok(applyBody.checkpoint?.id);
  assert.equal(applyBody.smokeBuild?.status, "pass");
  assert.ok((applyBody.smokeBuild?.checks?.length ?? 0) > 0);
  assert.ok(loadStore().generatedApps?.some((entry) => entry.id === applyBody.app?.id && entry.checkpointId === applyBody.checkpoint?.id));
});

test("builder app iteration can generate a diff, apply it, and rollback checkpoints", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const headers = { ...authHeaders(alpha.cookieValue), "Content-Type": "application/json" };

  const draftResponse = await app.request("/api/app/builder/app-draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: "Build a booking app with public booking, services, appointment slots, and admin controls.",
    }),
  });
  const { draft } = await draftResponse.json() as { draft: Record<string, unknown> };
  const applyResponse = await app.request("/api/app/builder/app-draft/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({ draft, runSmoke: true }),
  });
  const applied = await applyResponse.json() as {
    app: { id: string; previewUrl?: string };
    checkpoint: { id: string };
    draft: Record<string, unknown>;
  };

  const iterationResponse = await app.request("/api/app/builder/app-iteration", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      draft: applied.draft,
      target: { id: "page:/book", kind: "page", label: "Booking", path: "/book" },
      prompt: "Add clearer confirmation copy to the booking page after a customer picks an appointment slot.",
    }),
  });
  const iteration = await iterationResponse.json() as {
    id?: string;
    status?: string;
    files?: Array<{ diff: string; path: string }>;
    draft?: { app?: { pages?: Array<{ route: string; purpose: string; actions: string[] }> } };
    preview?: { status?: string };
    rollback?: { checkpointId?: string };
  };

  assert.equal(iterationResponse.status, 200);
  assert.equal(iteration.status, "generated");
  assert.ok(iteration.id);
  assert.ok(iteration.files?.some((file) => file.path.includes("page") && file.diff.includes("confirmation copy")));
  assert.ok(iteration.draft?.app?.pages?.some((page) => page.route === "/book" && page.purpose.includes("Iteration request")));
  assert.equal(iteration.preview?.status, "pending");
  assert.ok(iteration.rollback?.checkpointId);

  const applyIterationResponse = await app.request("/api/app/builder/app-iteration/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      diffId: iteration.id,
      target: { id: "page:/book", kind: "page", label: "Booking", path: "/book" },
      files: iteration.files,
      diff: iteration,
      runSmoke: true,
    }),
  });
  const appliedIteration = await applyIterationResponse.json() as {
    applied?: boolean;
    checkpoint?: { id?: string };
    previewUrl?: string;
    diff?: { status?: string; draft?: unknown };
    smoke?: { status?: string };
  };

  assert.equal(applyIterationResponse.status, 201);
  assert.equal(appliedIteration.applied, true);
  assert.equal(appliedIteration.diff?.status, "applied");
  assert.equal(appliedIteration.smoke?.status, "pass");
  assert.match(appliedIteration.previewUrl ?? "", /\/builder\/preview\/alpha\//);
  assert.notEqual(appliedIteration.checkpoint?.id, applied.checkpoint.id);

  const checkpointResponse = await app.request(`/api/app/builder/checkpoints?appId=${applied.app.id}`, {
    headers,
  });
  const checkpointBody = await checkpointResponse.json() as { checkpoints?: Array<{ id: string; source: string }> };

  assert.equal(checkpointResponse.status, 200);
  assert.ok(checkpointBody.checkpoints?.some((checkpoint) => checkpoint.id === applied.checkpoint.id));
  assert.ok(checkpointBody.checkpoints?.some((checkpoint) => checkpoint.id === appliedIteration.checkpoint?.id && checkpoint.source === "iteration"));

  const rollbackResponse = await app.request(`/api/app/builder/checkpoints/${applied.checkpoint.id}/rollback`, {
    method: "POST",
    headers,
    body: JSON.stringify({ appId: applied.app.id, reason: "test rollback" }),
  });
  const rollbackBody = await rollbackResponse.json() as {
    rolledBack?: boolean;
    checkpoint?: { id?: string };
    preview?: { message?: string };
  };

  assert.equal(rollbackResponse.status, 200);
  assert.equal(rollbackBody.rolledBack, true);
  assert.ok(rollbackBody.checkpoint?.id);
  assert.ok(rollbackBody.preview?.message?.includes(applied.checkpoint.id));
});

test("builder canonical changes routes validate target app and expose preview, fix, and agent checkpoint contracts", async () => {
  resetStoreForTests();
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const headers = { ...authHeaders(alpha.cookieValue), "Content-Type": "application/json" };

  const draftResponse = await app.request("/api/app/builder/app-draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: "Build a CRM app for companies, contacts, opportunities, and follow-up notes.",
    }),
  });
  const { draft } = await draftResponse.json() as { draft: Record<string, unknown> };
  const applyResponse = await app.request("/api/app/builder/app-draft/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({ draft, runSmoke: true }),
  });
  const applied = await applyResponse.json() as {
    app: { id: string };
    checkpoint: { id: string };
    draft: Record<string, unknown>;
  };

  const changeDraftResponse = await app.request("/api/app/builder/changes/draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      draft: applied.draft,
      target: { id: "api:GET:/api/app/generated/crm/contacts", kind: "api_route", label: "GET contacts", path: "/api/app/generated/crm/contacts" },
      prompt: "Add a draft-safe GitHub issue export action without running live repository operations.",
    }),
  });
  const changeDraft = await changeDraftResponse.json() as {
    changeSet?: { id?: string; status?: string; tools?: { requestedCategories?: string[]; canProceed?: boolean }; draft?: Record<string, unknown> };
  };

  assert.equal(changeDraftResponse.status, 200);
  assert.ok(changeDraft.changeSet?.id);
  assert.equal(changeDraft.changeSet?.status, "generated");
  assert.equal(changeDraft.changeSet?.tools?.canProceed, true);
  assert.ok(changeDraft.changeSet?.tools?.requestedCategories?.includes("github"));

  const blockedDraftResponse = await app.request("/api/app/builder/changes/draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      draft: applied.draft,
      target: { id: "config", kind: "config", label: "Generated app config" },
      prompt: "Create live Stripe checkout and charge customers for subscriptions.",
    }),
  });
  const blockedDraft = await blockedDraftResponse.json() as { changeSet?: { status?: string } };

  assert.equal(blockedDraftResponse.status, 200);
  assert.equal(blockedDraft.changeSet?.status, "blocked");

  const blockedApplyResponse = await app.request("/api/app/builder/changes/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      changeSet: blockedDraft.changeSet,
      runSmoke: true,
    }),
  });
  const blockedApplyBody = await blockedApplyResponse.json() as { error?: string };

  assert.equal(blockedApplyResponse.status, 409);
  assert.match(blockedApplyBody.error ?? "", /blocked change set/);

  const directDraftApplyResponse = await app.request("/api/app/builder/changes/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      draft: changeDraft.changeSet?.draft,
      runSmoke: true,
    }),
  });
  const directDraftApplyBody = await directDraftApplyResponse.json() as { error?: string };

  assert.equal(directDraftApplyResponse.status, 400);
  assert.match(directDraftApplyBody.error ?? "", /reviewed diff or changeSet/);

  const mismatchResponse = await app.request("/api/app/builder/changes/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      changeSet: {
        ...changeDraft.changeSet,
        draft: {
          ...(changeDraft.changeSet?.draft ?? {}),
          app: { ...((changeDraft.changeSet?.draft as { app?: Record<string, unknown> })?.app ?? {}), slug: "different-app" },
        },
      },
      runSmoke: true,
    }),
  });
  const mismatchBody = await mismatchResponse.json() as { error?: string };

  assert.equal(mismatchResponse.status, 409);
  assert.match(mismatchBody.error ?? "", /does not match/);

  const changeApplyResponse = await app.request("/api/app/builder/changes/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      changeSet: changeDraft.changeSet,
      runSmoke: true,
      refreshPreview: true,
    }),
  });
  const changeApply = await changeApplyResponse.json() as {
    applied?: boolean;
    changeSet?: { status?: string };
    checkpoint?: { id?: string };
  };

  assert.equal(changeApplyResponse.status, 201);
  assert.equal(changeApply.applied, true);
  assert.equal(changeApply.changeSet?.status, "applied");
  assert.ok(changeApply.checkpoint?.id);

  const refreshResponse = await app.request("/api/app/builder/preview/refresh", {
    method: "POST",
    headers,
    body: JSON.stringify({ appId: applied.app.id, checkpointId: changeApply.checkpoint?.id, runSmoke: true }),
  });
  const refreshBody = await refreshResponse.json() as { preview?: { status?: string }; smoke?: { status?: string } };

  assert.equal(refreshResponse.status, 200);
  assert.equal(refreshBody.preview?.status, "ready");
  assert.equal(refreshBody.smoke?.status, "pass");

  const fixResponse = await app.request("/api/app/builder/fix-prompt", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: changeApply.checkpoint?.id,
      target: { id: "page:/", kind: "page", label: "Home", path: "/" },
      errorContext: { source: "runtime", message: "ReferenceError: contact is not defined" },
    }),
  });
  const fixBody = await fixResponse.json() as { prompt?: string };

  assert.equal(fixResponse.status, 200);
  assert.match(fixBody.prompt ?? "", /ReferenceError/);
  assert.match(fixBody.prompt ?? "", /Checkpoint/);

  const agentCheckpointResponse = await app.request("/api/app/builder/checkpoints?agentId=agent_alpha_support", {
    headers,
  });
  const agentCheckpointBody = await agentCheckpointResponse.json() as { checkpoints?: Array<{ agentId?: string }> };

  assert.equal(agentCheckpointResponse.status, 200);
  assert.equal(agentCheckpointBody.checkpoints?.[0]?.agentId, "agent_alpha_support");
});

test("builder publish creates self-hosted history, compose export, logs, and rollback result", async (t) => {
  resetStoreForTests();
  const previousSmtpUrl = process.env.SMTP_URL;
  process.env.SMTP_URL = "smtp://localhost";
  t.after(() => {
    if (previousSmtpUrl === undefined) delete process.env.SMTP_URL;
    else process.env.SMTP_URL = previousSmtpUrl;
  });
  const app = createTestApp();
  const alpha = login({ email: "alpha@taskloom.local", password: "demo12345" });
  const headers = { ...authHeaders(alpha.cookieValue), "Content-Type": "application/json" };

  const draftResponse = await app.request("/api/app/builder/app-draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: "Build a booking app with public booking, appointment slots, services, and admin controls.",
    }),
  });
  const { draft } = await draftResponse.json() as { draft: Record<string, unknown> };
  const applyResponse = await app.request("/api/app/builder/app-draft/apply", {
    method: "POST",
    headers,
    body: JSON.stringify({ draft, runSmoke: true }),
  });
  const applied = await applyResponse.json() as {
    app: { id: string };
    checkpoint: { id: string };
  };

  const firstPublishResponse = await app.request("/api/app/builder/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      visibility: "public",
      localPublishRoot: "exports\\taskloom",
      publicBaseUrl: "https://apps.example.test/",
      privateBaseUrl: "http://localhost:8484/",
    }),
  });
  const firstPublish = await firstPublishResponse.json() as {
    published?: boolean;
    publish?: { id: string; status: string; localPublishPath: string; logs: unknown[] };
    dockerComposeExport?: { yaml?: string; services?: string[] };
  };

  assert.equal(firstPublishResponse.status, 201);
  assert.equal(firstPublish.published, true);
  assert.equal(firstPublish.publish?.status, "published");
  assert.match(firstPublish.publish?.localPublishPath ?? "", /^exports\/taskloom\/alpha-workspace\//);
  assert.match(firstPublish.dockerComposeExport?.yaml ?? "", /taskloom-app:/);
  assert.ok(firstPublish.dockerComposeExport?.services?.includes("taskloom-app"));
  assert.ok((firstPublish.publish?.logs.length ?? 0) >= 3);

  const failedCheckpointId = "gapp_ckpt_publish_failed_test";
  mutateStore((data) => {
    const generated = data.generatedApps?.find((entry) => entry.id === applied.app.id);
    assert.ok(generated);
    const baseCheckpoint = generated.checkpoints?.find((checkpoint) => checkpoint.id === applied.checkpoint.id);
    assert.ok(baseCheckpoint);
    generated.checkpoints = [
      ...(generated.checkpoints ?? []),
      {
        ...baseCheckpoint,
        id: failedCheckpointId,
        label: "Failed publish checkpoint",
        buildStatus: "failed",
        smokeStatus: "failed",
        previousCheckpointId: generated.checkpointId,
        createdAt: "2026-05-03T20:00:00.000Z",
      },
    ];
  });

  const failedPublishResponse = await app.request("/api/app/builder/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: failedCheckpointId,
      visibility: "public",
      publicBaseUrl: "https://apps.example.test/",
    }),
  });
  const failedPublish = await failedPublishResponse.json() as { error?: string; validation?: { canPublish?: boolean } };

  assert.equal(failedPublishResponse.status, 409);
  assert.equal(failedPublish.error, "publish validation failed");
  assert.equal(failedPublish.validation?.canPublish, false);
  assert.equal(loadStore().generatedApps?.find((entry) => entry.id === applied.app.id)?.currentPublishId, firstPublish.publish?.id);

  const stateResponse = await app.request(`/api/app/builder/publish/state?appId=${applied.app.id}`, {
    headers,
  });
  const state = await stateResponse.json() as { publishedUrl?: string; history?: unknown[] };

  assert.equal(stateResponse.status, 200);
  assert.match(state.publishedUrl ?? "", /apps\.example\.test/);
  assert.ok((state.history?.length ?? 0) >= 1);

  const composeResponse = await app.request(`/api/app/builder/publish/docker-compose?appId=${applied.app.id}`, {
    headers,
  });
  const compose = await composeResponse.json() as { fileName?: string; contents?: string };

  assert.equal(composeResponse.status, 200);
  assert.equal(compose.fileName, "docker-compose.publish.yml");
  assert.match(compose.contents ?? "", /taskloom-app:/);

  const secondPublishResponse = await app.request("/api/app/builder/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({
      appId: applied.app.id,
      checkpointId: applied.checkpoint.id,
      visibility: "private",
    }),
  });
  const secondPublish = await secondPublishResponse.json() as {
    published?: boolean;
    publish?: { id: string; previousPublishId?: string; rollbackCommand?: { command?: string; toPublishId?: string } };
    rollbackToPrevious?: { command?: string };
  };

  assert.equal(secondPublishResponse.status, 201);
  assert.equal(secondPublish.published, true);
  assert.equal(secondPublish.publish?.previousPublishId, firstPublish.publish?.id);
  assert.equal(secondPublish.publish?.rollbackCommand?.toPublishId, firstPublish.publish?.id);
  assert.match(secondPublish.rollbackToPrevious?.command ?? "", /taskloom publish rollback/);

  const rollbackResponse = await app.request(`/api/app/builder/publish/${secondPublish.publish?.id}/rollback`, {
    method: "POST",
    headers,
    body: JSON.stringify({ appId: applied.app.id, reason: "test publish rollback" }),
  });
  const rollback = await rollbackResponse.json() as {
    rolledBack?: boolean;
    rollback?: { result?: { status?: string; restoredPublishId?: string; supersededPublishId?: string } };
    app?: { currentPublishId?: string };
    history?: Array<{ id: string; status: string; rollbackResult?: { status?: string } }>;
  };

  assert.equal(rollbackResponse.status, 200);
  assert.equal(rollback.rolledBack, true);
  assert.equal(rollback.rollback?.result?.status, "succeeded");
  assert.equal(rollback.rollback?.result?.restoredPublishId, firstPublish.publish?.id);
  assert.equal(rollback.rollback?.result?.supersededPublishId, secondPublish.publish?.id);
  assert.equal(rollback.app?.currentPublishId, firstPublish.publish?.id);
  assert.ok(rollback.history?.some((entry) => entry.id === secondPublish.publish?.id && entry.status === "rolled_back" && entry.rollbackResult?.status === "succeeded"));

  const stored = loadStore().generatedApps?.find((entry) => entry.id === applied.app.id);
  assert.equal(stored?.currentPublishId, firstPublish.publish?.id);
  assert.ok(stored?.publishHistory?.some((entry) => entry.id === secondPublish.publish?.id && entry.rollbackResult?.status === "succeeded"));
});
