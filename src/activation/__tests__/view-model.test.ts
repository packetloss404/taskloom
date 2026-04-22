import assert from "node:assert/strict";
import test from "node:test";
import { buildActivationSummaryCard } from "../view-model";
import { deriveActivationStatus } from "../service";
import { emptySnapshot, subject } from "./fixtures";

test("buildActivationSummaryCard returns progress and next recommended action", () => {
  const status = deriveActivationStatus(subject, {
    ...emptySnapshot,
    hasBrief: true,
    hasRequirements: true,
    hasPlan: true,
  });

  const card = buildActivationSummaryCard(status);
  assert.equal(card.progressPercent, 40);
  assert.equal(card.items.length, 5);
  assert.equal(card.nextRecommendedAction, "Start building against the agreed scope.");
});
