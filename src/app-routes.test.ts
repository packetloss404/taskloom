import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { SESSION_COOKIE_NAME } from "./auth-utils";
import { appRoutes } from "./app-routes";
import { login } from "./taskloom-services";
import {
  clearStoreCacheForTests,
  createSeedStore,
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
