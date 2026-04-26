import { test } from "node:test";
import assert from "node:assert/strict";
import { resetStoreForTests, loadStore } from "../../taskloom-store.js";
import { listProviderCalls, recordedCall, recordedStream, summarizeUsage } from "../ledger.js";
import type { ProviderStreamChunk } from "../types.js";

test("recordedCall writes a success record with measured duration", async () => {
  resetStoreForTests();
  const result = await recordedCall(
    { workspaceId: "alpha", routeKey: "workflow.draft", provider: "stub", model: "stub-small" },
    async () => ({ usage: { promptTokens: 5, completionTokens: 8, costUsd: 0 } }),
  );
  assert.deepEqual(result.usage, { promptTokens: 5, completionTokens: 8, costUsd: 0 });
  const calls = listProviderCalls("alpha");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, "success");
  assert.equal(calls[0].promptTokens, 5);
  assert.ok(calls[0].durationMs >= 0);
});

test("recordedCall writes an error record and re-throws", async () => {
  resetStoreForTests();
  await assert.rejects(
    () => recordedCall(
      { workspaceId: "alpha", routeKey: "agent.summary", provider: "openai", model: "gpt-4o-mini" },
      async () => { throw new Error("boom"); },
    ),
    /boom/,
  );
  const calls = listProviderCalls("alpha");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, "error");
  assert.equal(calls[0].errorMessage, "boom");
});

test("recordedStream records once with accumulated final usage", async () => {
  resetStoreForTests();
  async function* iter(): AsyncIterable<ProviderStreamChunk> {
    yield { delta: "hi" };
    yield { delta: " world" };
    yield { done: true, usage: { promptTokens: 3, completionTokens: 7, costUsd: 0.001 } };
  }
  const collected: ProviderStreamChunk[] = [];
  for await (const c of recordedStream(
    { workspaceId: "alpha", routeKey: "agent.reasoning", provider: "anthropic", model: "claude-opus-4-7" },
    iter(),
  )) {
    collected.push(c);
  }
  const calls = listProviderCalls("alpha");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].promptTokens, 3);
  assert.equal(calls[0].completionTokens, 7);
  assert.ok(calls[0].costUsd > 0);
  assert.equal(collected.length, 3);
});

test("recordedStream with chunk error marks status error", async () => {
  resetStoreForTests();
  async function* iter(): AsyncIterable<ProviderStreamChunk> {
    yield { delta: "x" };
    yield { error: "no key" };
  }
  for await (const _ of recordedStream(
    { workspaceId: "alpha", routeKey: "x", provider: "stub", model: "stub-small" },
    iter(),
  )) { /* drain */ }
  const calls = listProviderCalls("alpha");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, "error");
  assert.equal(calls[0].errorMessage, "no key");
});

test("listProviderCalls returns newest-first and respects limit", async () => {
  resetStoreForTests();
  for (let i = 0; i < 5; i++) {
    await recordedCall(
      { workspaceId: "alpha", routeKey: `r${i}`, provider: "stub", model: "stub-small" },
      async () => ({ usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } }),
    );
  }
  const last3 = listProviderCalls("alpha", { limit: 3 });
  assert.equal(last3.length, 3);
  assert.equal(last3[0].routeKey, "r4");
});

test("summarizeUsage aggregates across providers and routes", async () => {
  resetStoreForTests();
  await recordedCall({ workspaceId: "alpha", routeKey: "workflow.draft", provider: "anthropic", model: "claude-opus-4-7" },
    async () => ({ usage: { promptTokens: 10, completionTokens: 20, costUsd: 0.01 } }));
  await recordedCall({ workspaceId: "alpha", routeKey: "workflow.draft", provider: "anthropic", model: "claude-opus-4-7" },
    async () => ({ usage: { promptTokens: 5, completionTokens: 5, costUsd: 0.005 } }));
  await recordedCall({ workspaceId: "alpha", routeKey: "agent.summary", provider: "openai", model: "gpt-4o-mini" },
    async () => ({ usage: { promptTokens: 2, completionTokens: 3, costUsd: 0.001 } }));
  const summary = summarizeUsage("alpha");
  assert.equal(summary.totalCalls, 3);
  assert.ok(Math.abs(summary.totalCostUsd - 0.016) < 1e-9);
  assert.equal(summary.byProvider.find((p) => p.provider === "anthropic")?.calls, 2);
  assert.equal(summary.byRoute.find((r) => r.routeKey === "workflow.draft")?.calls, 2);
  assert.equal(summary.last24h.calls, 3);
});

test("summarizeUsage excludes records older than 24h from last24h block", () => {
  resetStoreForTests();
  const data = loadStore();
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  data.providerCalls.push({
    id: "p1", workspaceId: "alpha", routeKey: "x", provider: "stub", model: "stub-small",
    promptTokens: 1, completionTokens: 1, costUsd: 0.5, durationMs: 1, status: "success",
    startedAt: old, completedAt: old,
  });
  const summary = summarizeUsage("alpha");
  assert.equal(summary.totalCalls, 1);
  assert.equal(summary.last24h.calls, 0);
  assert.equal(summary.last24h.costUsd, 0);
});
