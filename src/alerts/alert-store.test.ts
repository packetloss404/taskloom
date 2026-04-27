import assert from "node:assert/strict";
import test from "node:test";
import { listAlerts, recordAlerts } from "./alert-store.js";
import type { AlertEvent } from "./alert-engine.js";
import type { AlertEventRecord, TaskloomData } from "../taskloom-store.js";

function makeStore(records: AlertEventRecord[] = []): TaskloomData {
  return { alertEvents: [...records] } as unknown as TaskloomData;
}

function makeStoreDeps(data: TaskloomData) {
  return {
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
  return {
    id: overrides.id,
    ruleId: overrides.ruleId ?? "subsystem-degraded",
    severity: overrides.severity ?? "warning",
    title: overrides.title ?? "Title",
    detail: overrides.detail ?? "Detail",
    observedAt: overrides.observedAt,
    context: overrides.context ?? {},
    delivered: overrides.delivered ?? true,
    ...(overrides.deliveryError !== undefined ? { deliveryError: overrides.deliveryError } : {}),
  };
}

test("recordAlerts inserts events as records with delivery flags", () => {
  const data = makeStore();
  const events: AlertEvent[] = [
    makeEvent({ id: "evt_a", severity: "warning" }),
    makeEvent({ id: "evt_b", severity: "critical" }),
  ];

  const result = recordAlerts(events, true, undefined, {}, makeStoreDeps(data));

  assert.deepEqual(result, { stored: 2, pruned: 0 });
  assert.equal(data.alertEvents.length, 2);
  assert.equal(data.alertEvents[0].id, "evt_a");
  assert.equal(data.alertEvents[0].delivered, true);
  assert.equal(data.alertEvents[0].deliveryError, undefined);
  assert.equal(data.alertEvents[1].id, "evt_b");
});

test("recordAlerts with deliveryOk=false stores deliveryError", () => {
  const data = makeStore();
  const events: AlertEvent[] = [makeEvent({ id: "evt_a" })];

  const result = recordAlerts(events, false, "network: timeout", {}, makeStoreDeps(data));

  assert.deepEqual(result, { stored: 1, pruned: 0 });
  assert.equal(data.alertEvents[0].delivered, false);
  assert.equal(data.alertEvents[0].deliveryError, "network: timeout");
});

test("recordAlerts with retentionDays prunes older rows", () => {
  const data = makeStore([
    makeRecord({ id: "ancient", observedAt: "2026-01-01T00:00:00.000Z" }),
    makeRecord({ id: "stale", observedAt: "2026-04-10T00:00:00.000Z" }),
    makeRecord({ id: "fresh", observedAt: "2026-04-25T00:00:00.000Z" }),
  ]);
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
  const ids = data.alertEvents.map((entry) => entry.id).sort();
  assert.deepEqual(ids, ["fresh", "new"]);
});

test("recordAlerts with retentionDays=0 disables pruning", () => {
  const data = makeStore([
    makeRecord({ id: "ancient", observedAt: "2020-01-01T00:00:00.000Z" }),
  ]);
  const events: AlertEvent[] = [makeEvent({ id: "new", observedAt: "2026-04-26T11:00:00.000Z" })];

  const result = recordAlerts(
    events,
    true,
    undefined,
    { retentionDays: 0, now: () => new Date("2026-04-26T12:00:00.000Z") },
    makeStoreDeps(data),
  );

  assert.equal(result.stored, 1);
  assert.equal(result.pruned, 0);
  assert.equal(data.alertEvents.length, 2);
});

test("listAlerts returns descending by observedAt", () => {
  const data = makeStore([
    makeRecord({ id: "a", observedAt: "2026-04-26T01:00:00.000Z" }),
    makeRecord({ id: "c", observedAt: "2026-04-26T03:00:00.000Z" }),
    makeRecord({ id: "b", observedAt: "2026-04-26T02:00:00.000Z" }),
  ]);

  const result = listAlerts({}, { loadStore: () => data });
  assert.deepEqual(result.map((entry) => entry.id), ["c", "b", "a"]);
});

test("listAlerts filters by severity", () => {
  const data = makeStore([
    makeRecord({ id: "warn_1", severity: "warning", observedAt: "2026-04-26T01:00:00.000Z" }),
    makeRecord({ id: "crit_1", severity: "critical", observedAt: "2026-04-26T02:00:00.000Z" }),
    makeRecord({ id: "warn_2", severity: "warning", observedAt: "2026-04-26T03:00:00.000Z" }),
  ]);

  const result = listAlerts({ severity: "critical" }, { loadStore: () => data });
  assert.deepEqual(result.map((entry) => entry.id), ["crit_1"]);
});

test("listAlerts filters by since and until", () => {
  const data = makeStore([
    makeRecord({ id: "old", observedAt: "2026-04-20T00:00:00.000Z" }),
    makeRecord({ id: "mid", observedAt: "2026-04-22T00:00:00.000Z" }),
    makeRecord({ id: "new", observedAt: "2026-04-25T00:00:00.000Z" }),
  ]);

  const sinceFiltered = listAlerts({ since: "2026-04-21T00:00:00.000Z" }, { loadStore: () => data });
  assert.deepEqual(sinceFiltered.map((entry) => entry.id), ["new", "mid"]);

  const untilFiltered = listAlerts({ until: "2026-04-23T00:00:00.000Z" }, { loadStore: () => data });
  assert.deepEqual(untilFiltered.map((entry) => entry.id), ["mid", "old"]);

  const ranged = listAlerts(
    { since: "2026-04-21T00:00:00.000Z", until: "2026-04-23T00:00:00.000Z" },
    { loadStore: () => data },
  );
  assert.deepEqual(ranged.map((entry) => entry.id), ["mid"]);
});

test("listAlerts honors limit defaulting to 100 and capping at 500", () => {
  const many: AlertEventRecord[] = [];
  for (let index = 0; index < 600; index += 1) {
    const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, index)).toISOString();
    many.push(makeRecord({ id: `alert_${index.toString().padStart(4, "0")}`, observedAt: stamp }));
  }
  const data = makeStore(many);

  const defaultLimit = listAlerts({}, { loadStore: () => data });
  assert.equal(defaultLimit.length, 100);
  // descending order — newest first
  assert.equal(defaultLimit[0].id, "alert_0599");

  const explicit = listAlerts({ limit: 250 }, { loadStore: () => data });
  assert.equal(explicit.length, 250);

  const capped = listAlerts({ limit: 1000 }, { loadStore: () => data });
  assert.equal(capped.length, 500);
});
