import assert from "node:assert/strict";
import test from "node:test";
import { artifactServingEnabled } from "./server.js";

test("artifact serving is disabled by default in production", () => {
  assert.equal(artifactServingEnabled({ NODE_ENV: "production" }), false);
});

test("artifact serving requires explicit production opt-in", () => {
  assert.equal(artifactServingEnabled({
    NODE_ENV: "production",
    TASKLOOM_ARTIFACT_SERVING_ENABLED: "true",
  }), true);
});

test("artifact serving stays available by default for local development", () => {
  assert.equal(artifactServingEnabled({ NODE_ENV: "development" }), true);
});
