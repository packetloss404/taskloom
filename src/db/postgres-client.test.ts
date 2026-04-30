import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { PoolConfig, QueryConfig, QueryResult, QueryResultRow } from "pg";
import {
  closeManagedPostgresPool,
  createManagedPostgresClient,
  createManagedPostgresPool,
  getManagedPostgresPool,
  ManagedPostgresConfigError,
  type ManagedPostgresPool,
  type ManagedPostgresPoolClient,
  resolveManagedPostgresConfig,
} from "./postgres-client.js";

const managedUrl = "postgres://taskloom:super-secret@db.example.com:5432/taskloom";
const taskloomUrl = "postgres://taskloom:taskloom-secret@taskloom.internal/taskloom";
const databaseUrl = "postgres://taskloom:database-secret@database.internal/taskloom";

class FakePool implements ManagedPostgresPool {
  static instances: FakePool[] = [];

  readonly queries: Array<{ queryTextOrConfig: string | QueryConfig<unknown[]>; values?: unknown[] }> = [];
  readonly clients: FakeClient[] = [];
  ended = false;

  constructor(readonly poolConfig: PoolConfig) {
    FakePool.instances.push(this);
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    queryTextOrConfig: string | QueryConfig<unknown[]>,
    values?: unknown[],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ queryTextOrConfig, values });
    return {
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
      rows: [{ ok: true }] as unknown as Row[],
    };
  }

  async connect(): Promise<ManagedPostgresPoolClient> {
    const client = new FakeClient();
    this.clients.push(client);
    return client;
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

class FakeClient implements ManagedPostgresPoolClient {
  released = false;

  async query<Row extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<Row>> {
    return {
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: [],
      rows: [],
    };
  }

  release(): void {
    this.released = true;
  }
}

afterEach(async () => {
  await closeManagedPostgresPool();
  FakePool.instances = [];
});

test("resolves managed Postgres URL using the documented env priority", () => {
  const config = resolveManagedPostgresConfig({
    TASKLOOM_MANAGED_DATABASE_URL: ` ${managedUrl} `,
    TASKLOOM_DATABASE_URL: taskloomUrl,
    DATABASE_URL: databaseUrl,
  });

  assert.equal(config.configured, true);
  assert.equal(config.source, "TASKLOOM_MANAGED_DATABASE_URL");
  assert.equal(config.connectionString, managedUrl);
  assert.equal(config.redactedConnectionString, "[redacted]");
  assert.equal(config.summary, "Managed Postgres is configured from TASKLOOM_MANAGED_DATABASE_URL ([redacted]).");
  assert.equal(config.summary.includes("super-secret"), false);
  assert.equal(config.summary.includes("db.example.com"), false);
});

test("falls back to TASKLOOM_DATABASE_URL before DATABASE_URL", () => {
  const config = resolveManagedPostgresConfig({
    TASKLOOM_MANAGED_DATABASE_URL: " ",
    TASKLOOM_DATABASE_URL: taskloomUrl,
    DATABASE_URL: databaseUrl,
  });

  assert.equal(config.configured, true);
  assert.equal(config.source, "TASKLOOM_DATABASE_URL");
  assert.equal(config.connectionString, taskloomUrl);
  assert.equal(config.summary.includes("taskloom-secret"), false);
});

test("reports an unconfigured client without constructing a Pool", () => {
  const config = resolveManagedPostgresConfig({});

  assert.equal(config.configured, false);
  assert.equal(config.source, null);
  assert.equal(config.connectionString, null);
  assert.equal(config.redactedConnectionString, null);
  assert.equal(config.summary, "Managed Postgres is not configured.");
  assert.equal(FakePool.instances.length, 0);
});

test("constructs a Pool only when the pool helper is called", () => {
  const pool = createManagedPostgresPool({
    env: { DATABASE_URL: databaseUrl },
    poolConfig: { max: 4, application_name: "taskloom-test" },
    PoolCtor: FakePool,
  });

  assert.equal(pool, FakePool.instances[0]);
  assert.equal(FakePool.instances.length, 1);
  assert.equal(FakePool.instances[0]?.poolConfig.connectionString, databaseUrl);
  assert.equal(FakePool.instances[0]?.poolConfig.max, 4);
  assert.equal(FakePool.instances[0]?.poolConfig.application_name, "taskloom-test");
});

test("client forwards query, connect, and close to the underlying pool", async () => {
  const client = createManagedPostgresClient({
    env: { TASKLOOM_MANAGED_DATABASE_URL: managedUrl },
    PoolCtor: FakePool,
  });

  const result = await client.query("select $1::text as value", ["ready"]);
  const connected = await client.connect();
  connected.release();
  await client.close();

  const pool = FakePool.instances[0];
  assert.equal(client.config.source, "TASKLOOM_MANAGED_DATABASE_URL");
  assert.equal(result.rows[0]?.ok, true);
  assert.deepEqual(pool?.queries, [{ queryTextOrConfig: "select $1::text as value", values: ["ready"] }]);
  assert.equal(pool?.clients[0]?.released, true);
  assert.equal(pool?.ended, true);
});

test("shared pool helper reuses and closes the lazily-created Pool", async () => {
  const first = getManagedPostgresPool({
    env: { TASKLOOM_MANAGED_DATABASE_URL: managedUrl },
    PoolCtor: FakePool,
  });
  const second = getManagedPostgresPool({
    env: { TASKLOOM_MANAGED_DATABASE_URL: taskloomUrl },
    PoolCtor: FakePool,
  });

  assert.equal(first, second);
  assert.equal(FakePool.instances.length, 1);
  assert.equal(FakePool.instances[0]?.poolConfig.connectionString, managedUrl);

  await closeManagedPostgresPool();

  assert.equal(FakePool.instances[0]?.ended, true);
});

test("pool creation fails with a redacted config error when no URL is configured", () => {
  assert.throws(
    () => createManagedPostgresPool({ env: {}, PoolCtor: FakePool }),
    (error: unknown) => {
      assert.ok(error instanceof ManagedPostgresConfigError);
      assert.equal(error.config.summary, "Managed Postgres is not configured.");
      return true;
    },
  );
  assert.equal(FakePool.instances.length, 0);
});
