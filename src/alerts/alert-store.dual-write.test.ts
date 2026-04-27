import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "../db/cli.js";
import { recordAlerts, updateAlertDeliveryStatus } from "./alert-store.js";
import type { AlertEvent } from "./alert-engine.js";
import type { AlertEventRecord, TaskloomData } from "../taskloom-store.js";

interface AlertEventRow {
  id: string;
  rule_id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  observed_at: string;
  context: string;
  delivered: number;
  delivery_error: string | null;
  delivery_attempts: number | null;
  last_delivery_attempt_at: string | null;
  dead_lettered: number | null;
}

function makeStore(records: AlertEventRecord[] = []): TaskloomData {
  return { alertEvents: [...records] } as unknown as TaskloomData;
}

function makeStoreDeps(data: TaskloomData) {
  return {
    loadStore: () => data,
    mutateStore: <T,>(mutator: (target: TaskloomData) => T) => mutator(data),
  };
}

function makeEvent(overrides: Partial<AlertEvent> & { id: string }): AlertEvent {
  return {
    id: overrides.id,
    ruleId: overrides.ruleId ?? "subsystem-degraded",
    severity: overrides.severity ?? "warning",
    title: overrides.title ?? "Title",
    detail: overrides.detail ?? "Detail",
    observedAt: overrides.observedAt ?? "2026-04-26T12:00:00.000Z",
    context: overrides.context ?? {},
  };
}

function makeRecord(overrides: Partial<AlertEventRecord> & { id: string; observedAt: string }): AlertEventRecord {
  const record: AlertEventRecord = {
    id: overrides.id,
    ruleId: overrides.ruleId ?? "subsystem-degraded",
    severity: overrides.severity ?? "warning",
    title: overrides.title ?? "Title",
    detail: overrides.detail ?? "Detail",
    observedAt: overrides.observedAt,
    context: overrides.context ?? {},
    delivered: overrides.delivered ?? false,
    deliveryAttempts: overrides.deliveryAttempts ?? 1,
    lastDeliveryAttemptAt: overrides.lastDeliveryAttemptAt ?? overrides.observedAt,
    deadLettered: overrides.deadLettered ?? false,
  };
  if (overrides.deliveryError !== undefined) record.deliveryError = overrides.deliveryError;
  return record;
}

function readDedicated(dbPath: string): AlertEventRow[] {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare(`
      select id, rule_id, severity, title, detail, observed_at, context,
        delivered, delivery_error, delivery_attempts, last_delivery_attempt_at, dead_lettered
      from alert_events
      order by observed_at, id
    `).all() as unknown as AlertEventRow[];
  } finally {
    db.close();
  }
}

function seedDedicated(dbPath: string, record: AlertEventRecord): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare(`
      insert or replace into alert_events (
        id, rule_id, severity, title, detail, observed_at, context,
        delivered, delivery_error, delivery_attempts, last_delivery_attempt_at, dead_lettered
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.ruleId,
      record.severity,
      record.title,
      record.detail,
      record.observedAt,
      JSON.stringify(record.context ?? {}),
      record.delivered ? 1 : 0,
      record.deliveryError ?? null,
      record.deliveryAttempts ?? null,
      record.lastDeliveryAttemptAt ?? null,
      record.deadLettered === undefined ? null : record.deadLettered ? 1 : 0,
    );
  } finally {
    db.close();
  }
}

function withSqliteEnv(dbPath: string) {
  const previousStore = process.env.TASKLOOM_STORE;
  const previousDbPath = process.env.TASKLOOM_DB_PATH;
  process.env.TASKLOOM_STORE = "sqlite";
  process.env.TASKLOOM_DB_PATH = dbPath;
  return () => {
    if (previousStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = previousStore;
    if (previousDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = previousDbPath;
  };
}

test("recordAlerts dual-writes JSON-side and dedicated alert_events table in SQLite mode", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-alert-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const data = makeStore();
    const events: AlertEvent[] = [
      makeEvent({ id: "evt_a", severity: "warning" }),
      makeEvent({ id: "evt_b", severity: "critical" }),
    ];

    const result = recordAlerts(
      events,
      true,
      undefined,
      { retentionDays: 0, now: () => new Date("2026-04-26T12:30:00.000Z") },
      makeStoreDeps(data),
    );

    assert.equal(result.stored, 2);
    assert.equal(data.alertEvents.length, 2);
    const dedicated = readDedicated(dbPath);
    assert.equal(dedicated.length, 2);
    const ids = dedicated.map((row) => row.id).sort();
    assert.deepEqual(ids, ["evt_a", "evt_b"]);
    const evtA = dedicated.find((row) => row.id === "evt_a");
    assert.ok(evtA);
    assert.equal(evtA?.delivered, 1);
    assert.equal(evtA?.delivery_attempts, 1);
    assert.equal(evtA?.last_delivery_attempt_at, "2026-04-26T12:30:00.000Z");
    assert.equal(evtA?.dead_lettered, 0);
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("recordAlerts dual-writes deliveryError into the dedicated table when delivery fails", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-alert-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const data = makeStore();
    const events: AlertEvent[] = [makeEvent({ id: "evt_a" })];

    recordAlerts(
      events,
      false,
      "network: timeout",
      { retentionDays: 0, now: () => new Date("2026-04-26T12:30:00.000Z") },
      makeStoreDeps(data),
    );

    const dedicated = readDedicated(dbPath);
    assert.equal(dedicated.length, 1);
    assert.equal(dedicated[0].delivered, 0);
    assert.equal(dedicated[0].delivery_error, "network: timeout");
    assert.equal(data.alertEvents[0].deliveryError, "network: timeout");
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("recordAlerts retention prune deletes from JSON-side and dedicated alert_events in SQLite mode", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-alert-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const ancient = makeRecord({ id: "ancient", observedAt: "2026-01-01T00:00:00.000Z" });
    const stale = makeRecord({ id: "stale", observedAt: "2026-04-10T00:00:00.000Z" });
    const fresh = makeRecord({ id: "fresh", observedAt: "2026-04-25T00:00:00.000Z" });
    const data = makeStore([ancient, stale, fresh]);
    seedDedicated(dbPath, ancient);
    seedDedicated(dbPath, stale);
    seedDedicated(dbPath, fresh);

    const events: AlertEvent[] = [makeEvent({ id: "new", observedAt: "2026-04-26T11:00:00.000Z" })];

    const result = recordAlerts(
      events,
      true,
      undefined,
      { retentionDays: 7, now: () => new Date("2026-04-26T12:00:00.000Z") },
      makeStoreDeps(data),
    );

    assert.equal(result.stored, 1);
    assert.equal(result.pruned, 2);
    const jsonIds = data.alertEvents.map((entry) => entry.id).sort();
    assert.deepEqual(jsonIds, ["fresh", "new"]);
    const dedicated = readDedicated(dbPath);
    const dedicatedIds = dedicated.map((row) => row.id).sort();
    assert.deepEqual(dedicatedIds, ["fresh", "new"]);
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("updateAlertDeliveryStatus dual-writes delivery patch to JSON-side and dedicated table in SQLite mode", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-alert-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const seeded = makeRecord({
      id: "evt_a",
      observedAt: "2026-04-26T12:00:00.000Z",
      delivered: false,
      deliveryError: "network: timeout",
    });
    const data = makeStore([seeded]);
    seedDedicated(dbPath, seeded);

    const result = updateAlertDeliveryStatus(
      {
        alertId: "evt_a",
        delivered: true,
        attemptedAt: "2026-04-26T13:00:00.000Z",
      },
      makeStoreDeps(data),
    );

    assert.ok(result);
    assert.equal(result?.delivered, true);
    assert.equal(result?.deliveryAttempts, 2);
    assert.equal(data.alertEvents[0].delivered, true);
    assert.equal(data.alertEvents[0].deliveryError, undefined);

    const dedicated = readDedicated(dbPath);
    assert.equal(dedicated.length, 1);
    assert.equal(dedicated[0].delivered, 1);
    assert.equal(dedicated[0].delivery_error, null);
    assert.equal(dedicated[0].delivery_attempts, 2);
    assert.equal(dedicated[0].last_delivery_attempt_at, "2026-04-26T13:00:00.000Z");
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("updateAlertDeliveryStatus dual-writes deadLettered flag to both sides", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-alert-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const restore = withSqliteEnv(dbPath);
  try {
    const seeded = makeRecord({
      id: "evt_a",
      observedAt: "2026-04-26T12:00:00.000Z",
      delivered: false,
    });
    const data = makeStore([seeded]);
    seedDedicated(dbPath, seeded);

    updateAlertDeliveryStatus(
      {
        alertId: "evt_a",
        delivered: false,
        deliveryError: "exhausted",
        deadLettered: true,
        attemptedAt: "2026-04-26T13:00:00.000Z",
      },
      makeStoreDeps(data),
    );

    assert.equal(data.alertEvents[0].deadLettered, true);
    assert.equal(data.alertEvents[0].deliveryError, "exhausted");
    const dedicated = readDedicated(dbPath);
    assert.equal(dedicated[0].dead_lettered, 1);
    assert.equal(dedicated[0].delivery_error, "exhausted");
  } finally {
    restore();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("recordAlerts is a no-op for the dedicated alert_events table in JSON-default mode", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "taskloom-alert-dual-"));
  const dbPath = join(tempDir, "taskloom.sqlite");
  migrateDatabase({ dbPath });
  const previousStore = process.env.TASKLOOM_STORE;
  delete process.env.TASKLOOM_STORE;
  try {
    const data = makeStore();
    const events: AlertEvent[] = [makeEvent({ id: "evt_a" })];

    recordAlerts(
      events,
      true,
      undefined,
      { retentionDays: 0, now: () => new Date("2026-04-26T12:00:00.000Z") },
      makeStoreDeps(data),
    );

    assert.equal(data.alertEvents.length, 1);
    const dedicated = readDedicated(dbPath);
    assert.equal(dedicated.length, 0);
  } finally {
    if (previousStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = previousStore;
    rmSync(tempDir, { recursive: true, force: true });
  }
});
