import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { login } from "./taskloom-services";
import { resetStoreForTests } from "./taskloom-store";
import { workflowRoutes } from "./workflow-routes";
import { ProviderRouter, resetDefaultRouterForTests, setDefaultRouter } from "./providers/router";
import type { LLMProvider, ProviderCallOptions, ProviderCallResult } from "./providers/types";

function createTestApp() {
  const app = new Hono();
  app.route("/api/app/workflow", workflowRoutes);
  return app;
}

test("workflow routes require authentication", async () => {
  resetStoreForTests();
  const app = createTestApp();

  const response = await app.request("/api/app/workflow/brief");
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "authentication required" });
});

test("generate-from-prompt applies the LLM-shaped draft", async () => {
  resetStoreForTests();
  const router = new ProviderRouter({ "workflow.draft": { provider: "stub", model: "stub-small" } });
  router.register("stub", new JsonDraftProvider());
  setDefaultRouter(router);

  try {
    const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
    const app = createTestApp();
    const response = await app.request("/api/app/workflow/generate-from-prompt", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `taskloom_session=${auth.cookieValue}`,
      },
      body: JSON.stringify({ prompt: "Build a workflow from this user prompt", apply: true }),
    });
    const body = await response.json() as { draft: { brief: { summary: string } }; brief: { summary: string } };

    assert.equal(response.status, 200);
    assert.equal(body.draft.brief.summary, "LLM generated workflow summary");
    assert.equal(body.brief.summary, "LLM generated workflow summary");
  } finally {
    resetDefaultRouterForTests();
  }
});

class JsonDraftProvider implements LLMProvider {
  name = "stub" as const;

  async call(_opts: ProviderCallOptions): Promise<ProviderCallResult> {
    return {
      content: JSON.stringify({
        brief: {
          summary: "LLM generated workflow summary",
          problem: "The team needs structured workflow planning.",
          outcome: "The workflow is planned and ready for delivery.",
          customers: ["Product lead"],
          metrics: ["Workflow draft accepted"],
        },
        requirements: [{ summary: "Capture the generated requirement", priority: "must" }],
        planItems: [{ summary: "Implement the generated plan item", status: "todo" }],
      }),
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 },
      model: "stub-small",
      providerName: "stub",
    };
  }

  async *stream(): AsyncIterable<never> {}

  async models(): Promise<string[]> {
    return ["stub-small"];
  }
}
