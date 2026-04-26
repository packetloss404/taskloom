export interface ToolContext {
  workspaceId: string;
  userId: string;
  runId?: string;
  agentId?: string;
  signal: AbortSignal;
  artifactDir?: string;
}

export interface ToolResult {
  ok: boolean;
  output?: unknown;
  error?: string;
  artifacts?: { path: string; bytes: number; kind: string }[];
}

export interface ToolDefinition<TInput = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  side: "read" | "write" | "exec";
  timeoutMs?: number;
  handle(input: TInput, ctx: ToolContext): Promise<ToolResult>;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  durationMs: number;
  startedAt: string;
  completedAt: string;
  status: "ok" | "error" | "timeout";
}
