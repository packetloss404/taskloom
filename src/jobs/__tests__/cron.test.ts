import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, nextAfter, parseCron } from "../cron.js";

test("parses */5 * * * * to fire on minutes divisible by 5", () => {
  const expr = parseCron("*/5 * * * *");
  assert.equal(matches(expr, new Date(2026, 0, 1, 12, 0)), true);
  assert.equal(matches(expr, new Date(2026, 0, 1, 12, 5)), true);
  assert.equal(matches(expr, new Date(2026, 0, 1, 12, 7)), false);
});

test("parses 0 9 * * 1-5 (weekday 9am)", () => {
  const expr = parseCron("0 9 * * 1-5");
  // 2026-01-05 is a Monday
  assert.equal(matches(expr, new Date(2026, 0, 5, 9, 0)), true);
  // Saturday
  assert.equal(matches(expr, new Date(2026, 0, 3, 9, 0)), false);
  // 8:59 Mon
  assert.equal(matches(expr, new Date(2026, 0, 5, 8, 59)), false);
});

test("invalid expression throws", () => {
  assert.throws(() => parseCron("nope"));
  assert.throws(() => parseCron("60 * * * *"));
  assert.throws(() => parseCron("* * * *"));
});

test("nextAfter returns the next matching minute", () => {
  const next = nextAfter("*/15 * * * *", new Date(2026, 0, 1, 12, 7, 30));
  assert.equal(next.getMinutes(), 15);
  assert.equal(next.getHours(), 12);
});
