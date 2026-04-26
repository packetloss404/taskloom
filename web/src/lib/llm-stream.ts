export interface ProviderStreamUsage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface ProviderStreamChunkPayload {
  delta?: string;
  toolCall?: { id: string; name: string; input: Record<string, unknown> };
  done?: boolean;
  usage?: ProviderStreamUsage;
  error?: string;
}

export interface StreamHandle {
  id: string;
  cancel(): Promise<void>;
}

export interface StreamRequest {
  routeKey: string;
  messages: { role: "system" | "user" | "assistant" | "tool"; content: string; toolCallId?: string; toolName?: string }[];
  tools?: { name: string; description: string; inputSchema: Record<string, unknown> }[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamCallbacks {
  onDelta?: (delta: string) => void;
  onToolCall?: (call: { id: string; name: string; input: Record<string, unknown> }) => void;
  onDone?: (usage?: ProviderStreamUsage) => void;
  onError?: (msg: string) => void;
}

function parseSseEvents(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length > 0) events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

export function streamLLM(req: StreamRequest, cb: StreamCallbacks): StreamHandle {
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const ctrl = new AbortController();
  const handle: StreamHandle = {
    id,
    async cancel() {
      ctrl.abort();
      try {
        await fetch(`/api/app/llm/cancel/${id}`, { method: "POST", credentials: "include" });
      } catch { /* ignore */ }
    },
  };

  (async () => {
    let res: Response;
    try {
      res = await fetch("/api/app/llm/stream", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-stream-id": id },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
    } catch (error) {
      cb.onError?.((error as Error).message);
      return;
    }
    if (!res.ok || !res.body) {
      cb.onError?.(`HTTP ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseEvents(buffer);
        buffer = rest;
        for (const ev of events) {
          if (ev.event === "chunk") {
            try {
              const payload = JSON.parse(ev.data) as ProviderStreamChunkPayload;
              if (payload.delta) cb.onDelta?.(payload.delta);
              if (payload.toolCall) cb.onToolCall?.(payload.toolCall);
            } catch { /* ignore */ }
          } else if (ev.event === "done") {
            cb.onDone?.();
            return;
          } else if (ev.event === "error") {
            try {
              const { error } = JSON.parse(ev.data) as { error: string };
              cb.onError?.(error);
            } catch { cb.onError?.("stream error"); }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") cb.onError?.((error as Error).message);
    }
  })();

  return handle;
}
