import assert from "node:assert/strict";
import test from "node:test";
import { deriveChecklist } from "../checklist";
import { emptySnapshot } from "./fixtures";

test("checklist marks requirements_defined only when requirements and plan exist", () => {
  const checklist = deriveChecklist({
    ...emptySnapshot,
    hasRequirements: true,
    hasPlan: true,
  });

  const item = checklist.find((entry) => entry.key === "requirements_defined");
  assert.equal(item?.completed, true);
});
