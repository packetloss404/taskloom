import { randomUUID } from "node:crypto";
import type { ToolCallRecord, ToolContext, ToolDefinition } from "./types.js";

export interface ExecuteToolParams {
  tool: ToolDefinition;
  input: Record<string, unknown>;
  context: Omit<ToolContext, "signal"> & { signal?: AbortSignal };
}

export async function executeTool({ tool, input, context }: ExecuteToolParams): Promise<ToolCallRecord> {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const internalCtrl = new AbortController();
  if (context.signal) {
    if (context.signal.aborted) internalCtrl.abort();
    else context.signal.addEventListener("abort", () => internalCtrl.abort(), { once: true });
  }

  const timeoutMs = tool.timeoutMs ?? 30_000;
  const timer = setTimeout(() => internalCtrl.abort(), timeoutMs);

  const ctx: ToolContext = { ...context, signal: internalCtrl.signal };

  try {
    const result = await tool.handle(input, ctx);
    return {
      id,
      toolName: tool.name,
      input,
      output: result.output,
      ...(result.error ? { error: result.error } : {}),
      ...(result.artifacts ? { artifacts: result.artifacts } : {}),
      durationMs: Date.now() - t0,
      startedAt,
      completedAt: new Date().toISOString(),
      status: result.ok ? "ok" : "error",
    };
  } catch (error) {
    const aborted = internalCtrl.signal.aborted;
    return {
      id,
      toolName: tool.name,
      input,
      error: aborted ? `tool "${tool.name}" timed out after ${timeoutMs}ms` : (error as Error).message,
      durationMs: Date.now() - t0,
      startedAt,
      completedAt: new Date().toISOString(),
      status: aborted ? "timeout" : "error",
    };
  } finally {
    clearTimeout(timer);
  }
}
