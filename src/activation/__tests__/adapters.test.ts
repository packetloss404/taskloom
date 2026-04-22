import assert from "node:assert/strict";
import test from "node:test";
import { buildSignalSnapshotFromFacts } from "../adapters";

test("buildSignalSnapshotFromFacts maps timestamps to booleans", () => {
  const snapshot = buildSignalSnapshotFromFacts({
    now: "2026-04-22T10:00:00.000Z",
    briefCapturedAt: "2026-04-20T10:00:00.000Z",
    requirementsDefinedAt: "2026-04-20T12:00:00.000Z",
    planDefinedAt: "2026-04-20T13:00:00.000Z",
    implementationStartedAt: "2026-04-21T08:00:00.000Z",
    testsPassedAt: "2026-04-21T16:00:00.000Z",
  });

  assert.equal(snapshot.hasBrief, true);
  assert.equal(snapshot.hasRequirements, true);
  assert.equal(snapshot.hasPlan, true);
  assert.equal(snapshot.hasImplementation, true);
  assert.equal(snapshot.hasTests, true);
});
