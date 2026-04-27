import { randomUUID } from "node:crypto";
import { listProviderCallsForWorkspaceIndexed, mutateStore, type ProviderCallRecord } from "../taskloom-store.js";
import { redactedErrorMessage, redactSensitiveString } from "../security/redaction.js";
import type { ProviderName, ProviderStreamChunk, ProviderUsage } from "./types.js";

export interface LedgerContext {
  workspaceId: string;
  routeKey: string;
  provider: ProviderName;
  model: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function appendCall(record: ProviderCallRecord): void {
  mutateStore((data) => {
    data.providerCalls.push(record);
    if (data.providerCalls.length > 5_000) {
      data.providerCalls.splice(0, data.providerCalls.length - 5_000);
    }
  });
}

function emptyUsage(): ProviderUsage {
  return { promptTokens: 0, completionTokens: 0, costUsd: 0 };
}

export async function recordedCall<T extends { usage: ProviderUsage }>(
  ctx: LedgerContext,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = nowIso();
  const t0 = Date.now();
  try {
    const result = await fn();
    appendCall({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      routeKey: ctx.routeKey,
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      costUsd: result.usage.costUsd,
      durationMs: Date.now() - t0,
      status: "success",
      startedAt,
      completedAt: nowIso(),
    });
    return result;
  } catch (error) {
    appendCall({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      routeKey: ctx.routeKey,
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - t0,
      status: "error",
      errorMessage: redactedErrorMessage(error),
      startedAt,
      completedAt: nowIso(),
    });
    throw error;
  }
}

export async function* recordedStream<T extends ProviderStreamChunk>(
  ctx: LedgerContext,
  iter: AsyncIterable<T>,
): AsyncIterable<T> {
  const startedAt = nowIso();
  const t0 = Date.now();
  let usage: ProviderUsage = emptyUsage();
  let errorMessage: string | undefined;
  let canceled = false;
  try {
    for await (const chunk of iter) {
      if (chunk.usage) usage = chunk.usage;
      if (chunk.error) {
        errorMessage = redactSensitiveString(chunk.error);
        if (chunk.error === "aborted") canceled = true;
      }
      yield chunk;
    }
  } catch (error) {
    errorMessage = redactedErrorMessage(error);
    throw error;
  } finally {
    appendCall({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      routeKey: ctx.routeKey,
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      costUsd: usage.costUsd,
      durationMs: Date.now() - t0,
      status: errorMessage ? (canceled ? "canceled" : "error") : "success",
      ...(errorMessage ? { errorMessage } : {}),
      startedAt,
      completedAt: nowIso(),
    });
  }
}

export interface UsageSummary {
  totalCalls: number;
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  last24h: { calls: number; costUsd: number };
  byProvider: { provider: ProviderName; calls: number; costUsd: number }[];
  byRoute: { routeKey: string; calls: number; costUsd: number }[];
  recent: ProviderCallRecord[];
}

export function summarizeUsage(workspaceId: string): UsageSummary {
  const entries = listProviderCallsForWorkspaceIndexed(workspaceId);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let last24Calls = 0, last24Cost = 0;
  let totalCost = 0, totalPrompt = 0, totalCompletion = 0;
  const byProvider = new Map<ProviderName, { calls: number; costUsd: number }>();
  const byRoute = new Map<string, { calls: number; costUsd: number }>();
  for (const c of entries) {
    totalCost += c.costUsd;
    totalPrompt += c.promptTokens;
    totalCompletion += c.completionTokens;
    const ts = Date.parse(c.completedAt);
    if (ts >= cutoff) { last24Calls++; last24Cost += c.costUsd; }
    const p = byProvider.get(c.provider) ?? { calls: 0, costUsd: 0 };
    p.calls++; p.costUsd += c.costUsd; byProvider.set(c.provider, p);
    const r = byRoute.get(c.routeKey) ?? { calls: 0, costUsd: 0 };
    r.calls++; r.costUsd += c.costUsd; byRoute.set(c.routeKey, r);
  }
  return {
    totalCalls: entries.length,
    totalCostUsd: totalCost,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    last24h: { calls: last24Calls, costUsd: last24Cost },
    byProvider: [...byProvider.entries()].map(([provider, v]) => ({ provider, ...v })).sort((a, b) => b.calls - a.calls),
    byRoute: [...byRoute.entries()].map(([routeKey, v]) => ({ routeKey, ...v })).sort((a, b) => b.calls - a.calls),
    recent: entries.slice(0, 50),
  };
}

export function listProviderCalls(
  workspaceId: string,
  opts: { since?: string; limit?: number } = {},
): ProviderCallRecord[] {
  return listProviderCallsForWorkspaceIndexed(workspaceId, opts);
}
