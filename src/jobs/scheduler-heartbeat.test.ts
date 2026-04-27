import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __resetSchedulerHeartbeatForTests,
  getSchedulerHeartbeat,
  recordSchedulerStart,
  recordSchedulerStop,
  recordTickEnd,
  recordTickStart,
} from "./scheduler-heartbeat.js";

function fixedNow(date: Date): () => Date {
  return () => date;
}

test("baseline heartbeat state is null/zero", () => {
  __resetSchedulerHeartbeatForTests();
  const snapshot = getSchedulerHeartbeat();
  assert.equal(snapshot.schedulerStartedAt, null);
  assert.equal(snapshot.lastTickStartedAt, null);
  assert.equal(snapshot.lastTickEndedAt, null);
  assert.equal(snapshot.lastTickDurationMs, null);
  assert.equal(snapshot.ticksSinceStart, 0);
});

test("recordSchedulerStart sets startedAt and resets tick counters", () => {
  __resetSchedulerHeartbeatForTests();
  recordTickStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:00.100Z")));
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:01:00.000Z")));
  const snapshot = getSchedulerHeartbeat();
  assert.equal(snapshot.schedulerStartedAt, "2026-04-26T10:01:00.000Z");
  assert.equal(snapshot.lastTickStartedAt, null);
  assert.equal(snapshot.lastTickEndedAt, null);
  assert.equal(snapshot.lastTickDurationMs, null);
  assert.equal(snapshot.ticksSinceStart, 0);
});

test("recordTickStart sets lastTickStartedAt and leaves lastTickEndedAt null on first tick", () => {
  __resetSchedulerHeartbeatForTests();
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));
  recordTickStart(fixedNow(new Date("2026-04-26T10:00:01.000Z")));
  const snapshot = getSchedulerHeartbeat();
  assert.equal(snapshot.lastTickStartedAt, "2026-04-26T10:00:01.000Z");
  assert.equal(snapshot.lastTickEndedAt, null);
  assert.equal(snapshot.lastTickDurationMs, null);
  assert.equal(snapshot.ticksSinceStart, 0);
});

test("recordTickEnd after recordTickStart computes durationMs and increments ticksSinceStart", () => {
  __resetSchedulerHeartbeatForTests();
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));
  recordTickStart(fixedNow(new Date("2026-04-26T10:00:01.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:01.250Z")));
  const snapshot = getSchedulerHeartbeat();
  assert.equal(snapshot.lastTickStartedAt, "2026-04-26T10:00:01.000Z");
  assert.equal(snapshot.lastTickEndedAt, "2026-04-26T10:00:01.250Z");
  assert.equal(snapshot.lastTickDurationMs, 250);
  assert.equal(snapshot.ticksSinceStart, 1);
});

test("multiple ticks accumulate ticksSinceStart and refresh durations", () => {
  __resetSchedulerHeartbeatForTests();
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));

  recordTickStart(fixedNow(new Date("2026-04-26T10:00:01.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:01.100Z")));

  recordTickStart(fixedNow(new Date("2026-04-26T10:00:02.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:02.300Z")));

  recordTickStart(fixedNow(new Date("2026-04-26T10:00:03.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:03.050Z")));

  const snapshot = getSchedulerHeartbeat();
  assert.equal(snapshot.ticksSinceStart, 3);
  assert.equal(snapshot.lastTickStartedAt, "2026-04-26T10:00:03.000Z");
  assert.equal(snapshot.lastTickEndedAt, "2026-04-26T10:00:03.050Z");
  assert.equal(snapshot.lastTickDurationMs, 50);
});

test("recordTickEnd without a prior recordTickStart leaves duration null", () => {
  __resetSchedulerHeartbeatForTests();
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:01.000Z")));
  const snapshot = getSchedulerHeartbeat();
  assert.equal(snapshot.lastTickStartedAt, null);
  assert.equal(snapshot.lastTickEndedAt, "2026-04-26T10:00:01.000Z");
  assert.equal(snapshot.lastTickDurationMs, null);
  assert.equal(snapshot.ticksSinceStart, 1);
});

test("tick-in-progress is observable when lastTickStartedAt is later than lastTickEndedAt", () => {
  __resetSchedulerHeartbeatForTests();
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));
  recordTickStart(fixedNow(new Date("2026-04-26T10:00:01.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:01.100Z")));
  recordTickStart(fixedNow(new Date("2026-04-26T10:00:02.000Z")));
  const snapshot = getSchedulerHeartbeat();
  assert.ok(snapshot.lastTickStartedAt !== null && snapshot.lastTickEndedAt !== null);
  assert.ok(snapshot.lastTickStartedAt > snapshot.lastTickEndedAt);
  assert.equal(snapshot.ticksSinceStart, 1);
});

test("recordSchedulerStop resets all fields to baseline", () => {
  __resetSchedulerHeartbeatForTests();
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));
  recordTickStart(fixedNow(new Date("2026-04-26T10:00:01.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:01.500Z")));
  recordSchedulerStop();
  const snapshot = getSchedulerHeartbeat();
  assert.equal(snapshot.schedulerStartedAt, null);
  assert.equal(snapshot.lastTickStartedAt, null);
  assert.equal(snapshot.lastTickEndedAt, null);
  assert.equal(snapshot.lastTickDurationMs, null);
  assert.equal(snapshot.ticksSinceStart, 0);
});

test("getSchedulerHeartbeat returns an isolated snapshot copy", () => {
  __resetSchedulerHeartbeatForTests();
  recordSchedulerStart(fixedNow(new Date("2026-04-26T10:00:00.000Z")));
  recordTickStart(fixedNow(new Date("2026-04-26T10:00:01.000Z")));
  recordTickEnd(fixedNow(new Date("2026-04-26T10:00:01.250Z")));
  const snapshot = getSchedulerHeartbeat();
  snapshot.schedulerStartedAt = "tampered";
  snapshot.lastTickStartedAt = "tampered";
  snapshot.lastTickEndedAt = "tampered";
  snapshot.lastTickDurationMs = 9999;
  snapshot.ticksSinceStart = 9999;
  const fresh = getSchedulerHeartbeat();
  assert.equal(fresh.schedulerStartedAt, "2026-04-26T10:00:00.000Z");
  assert.equal(fresh.lastTickStartedAt, "2026-04-26T10:00:01.000Z");
  assert.equal(fresh.lastTickEndedAt, "2026-04-26T10:00:01.250Z");
  assert.equal(fresh.lastTickDurationMs, 250);
  assert.equal(fresh.ticksSinceStart, 1);
});
