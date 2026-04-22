import assert from "node:assert/strict";
import test from "node:test";
import { deriveStage } from "../milestones";
import { calculateRisk } from "../risk";
import { emptySnapshot } from "./fixtures";

test("empty snapshot yields not_started stage", () => {
  const result = deriveStage(emptySnapshot);
  assert.equal(result.stage, "not_started");
});

test("risk is low for empty snapshot", () => {
  const stage = deriveStage(emptySnapshot).stage;
  const risk = calculateRisk(emptySnapshot, stage);
  assert.equal(risk.level, "low");
});
