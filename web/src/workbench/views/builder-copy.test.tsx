import assert from "node:assert/strict";
import test from "node:test";
import {
  getPreviewNavigationTarget,
  publishPrimaryActionLabel,
  publishReadinessHeading,
} from "./builder";
import { CHECKS, PREVIEW_TRUTH_COPY } from "./app-preview";

test("preview truth copy stays honest about local-only delivery", () => {
  assert.match(PREVIEW_TRUTH_COPY, /local preview route/i);
  assert.match(PREVIEW_TRUTH_COPY, /not a public deployment/i);
  assert.ok(CHECKS.some((check) => check.label === "Generated source"));
});

test("publish labels describe handoff records instead of hosted deploys", () => {
  assert.equal(publishReadinessHeading(null), "Loading publish handoff");
  assert.equal(publishReadinessHeading({ canPublish: false }), "Publish handoff blocked");
  assert.equal(publishReadinessHeading({ canPublish: true, publishedUrl: "http://localhost:8484/app/alpha/crm" }), "Ready for local publish handoff");
  assert.equal(publishPrimaryActionLabel(false), " Create publish record");
  assert.equal(publishPrimaryActionLabel(true), " Creating publish record...");
});

test("preview navigation stays local unless backend provides an absolute URL", () => {
  assert.equal(getPreviewNavigationTarget(null, "app_123"), "/builder/preview/workspace/app_123");
  assert.equal(getPreviewNavigationTarget("builder/preview/alpha/app_123", "app_123"), "/builder/preview/alpha/app_123");
  assert.equal(getPreviewNavigationTarget("/builder/preview/alpha/app_123", "app_123"), "/builder/preview/alpha/app_123");
  assert.equal(getPreviewNavigationTarget("https://example.test/app", "app_123"), "https://example.test/app");
});
