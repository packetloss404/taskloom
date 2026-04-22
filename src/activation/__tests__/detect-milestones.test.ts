import assert from "node:assert/strict";
import test from "node:test";
import { detectMilestones } from "../milestones";
import { emptySnapshot } from "./fixtures";

test("brief reaches intake_ready milestone", () => {
  const milestones = detectMilestones({
    ...emptySnapshot,
    hasBrief: true,
  });

  const intake = milestones.find((entry) => entry.key === "intake_ready");
  assert.equal(intake?.reached, true);
});

test("prior reached milestone keeps its original reachedAt", () => {
  const milestones = detectMilestones(
    {
      ...emptySnapshot,
      hasBrief: true,
      now: "2026-04-21T12:00:00.000Z",
    },
    [
      {
        key: "intake_ready",
        reached: true,
        reachedAt: "2026-04-20T12:00:00.000Z",
        reason: "Earlier run",
      },
    ],
  );

  const intake = milestones.find((entry) => entry.key === "intake_ready");
  assert.equal(intake?.reachedAt, "2026-04-20T12:00:00.000Z");
});
