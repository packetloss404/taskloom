import assert from "node:assert/strict";
import test from "node:test";
import { buildWebhookTriggerReadiness } from "./webhook-readiness";

test("webhook trigger readiness identifies publish requirements", () => {
  const readiness = buildWebhookTriggerReadiness("webhook");

  assert.equal(readiness.recommended, true);
  assert.equal(readiness.readyAfterSave, true);
  assert.equal(readiness.tokenRequired, true);
  assert.equal(readiness.tokenManagementRoute, "/api/app/webhooks/agents/:agentId/rotate");
  assert.equal(readiness.publicTriggerRoute, "/api/public/webhooks/agents/:token");
  assert.match(readiness.message, /Save the agent/);
  assert.match(readiness.planDetail, /POST \/api\/app\/webhooks\/agents\/:agentId\/rotate/);
});

test("webhook trigger readiness remains optional for non-webhook triggers", () => {
  const readiness = buildWebhookTriggerReadiness("manual");

  assert.equal(readiness.recommended, false);
  assert.equal(readiness.readyAfterSave, false);
  assert.equal(readiness.tokenRequired, false);
  assert.match(readiness.message, /optional/);
});
