import type {
  ApiKeyResolver,
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
  ProviderMessage,
  ProviderStreamChunk,
  ProviderToolCall,
  ProviderToolDef,
} from "./types.js";

export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
}

interface OllamaToolDef {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  tools?: OllamaToolDef[];
  options?: { temperature?: number; num_predict?: number };
  stream?: boolean;
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string; tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[] };
  done: boolean;
  done_reason?: "stop" | "length" | string;
  prompt_eval_count?: number;
  eval_count?: number;
}

function mapMessages(messages: ProviderMessage[]): OllamaChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function mapTools(tools: ProviderToolDef[] | undefined): OllamaToolDef[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
}

function mapDoneReason(reason?: string): ProviderCallResult["finishReason"] {
  if (reason === "length") return "length";
  return "stop";
}

export interface OllamaProviderOptions {
  apiKeyResolver?: ApiKeyResolver;
  baseURL?: string;
  fetchFn?: typeof fetch;
  modelsCacheMs?: number;
}

export class OllamaProvider implements LLMProvider {
  name = "ollama" as const;
  private baseURL: string;
  private fetchFn: typeof fetch;
  private modelsCacheMs: number;
  private modelsCache: { value: string[]; at: number } | null = null;

  constructor(opts: OllamaProviderOptions = {}) {
    this.baseURL = opts.baseURL ?? process.env.OLLAMA_BASE_URL ?? OLLAMA_DEFAULT_BASE_URL;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.modelsCacheMs = opts.modelsCacheMs ?? 60_000;
  }

  async call(opts: ProviderCallOptions): Promise<ProviderCallResult> {
    const body: OllamaChatRequest = {
      model: opts.model,
      messages: mapMessages(opts.messages),
      stream: false,
      ...(opts.tools ? { tools: mapTools(opts.tools) } : {}),
      ...((opts.temperature !== undefined || opts.maxTokens !== undefined)
        ? { options: { ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}), ...(opts.maxTokens !== undefined ? { num_predict: opts.maxTokens } : {}) } }
        : {}),
    };
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseURL}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (error) {
      throw new Error(`ollama: connection failed (is Ollama running at ${this.baseURL}?): ${(error as Error).message}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ollama: HTTP ${res.status} ${text}`);
    }
    const json = (await res.json()) as OllamaChatResponse;
    const toolCalls: ProviderToolCall[] = [];
    if (json.message.tool_calls) {
      for (const tc of json.message.tool_calls) {
        toolCalls.push({ id: `ollama-${toolCalls.length}`, name: tc.function.name, input: tc.function.arguments });
      }
    }
    return {
      content: json.message.content ?? "",
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      finishReason: mapDoneReason(json.done_reason),
      usage: { promptTokens: json.prompt_eval_count ?? 0, completionTokens: json.eval_count ?? 0, costUsd: 0 },
      model: json.model,
      providerName: "ollama",
    };
  }

  async *stream(opts: ProviderCallOptions): AsyncIterable<ProviderStreamChunk> {
    const body: OllamaChatRequest = {
      model: opts.model,
      messages: mapMessages(opts.messages),
      stream: true,
      ...(opts.tools ? { tools: mapTools(opts.tools) } : {}),
      ...((opts.temperature !== undefined || opts.maxTokens !== undefined)
        ? { options: { ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}), ...(opts.maxTokens !== undefined ? { num_predict: opts.maxTokens } : {}) } }
        : {}),
    };
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseURL}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (error) {
      yield { error: `ollama: connection failed (is Ollama running at ${this.baseURL}?): ${(error as Error).message}` };
      return;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      yield { error: `ollama: HTTP ${res.status} ${text}` };
      return;
    }
    if (!res.body) { yield { error: "ollama: empty stream body" }; return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let prompt = 0, completion = 0;

    try {
      while (true) {
        if (opts.signal?.aborted) { yield { error: "aborted" }; return; }
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let parsed: OllamaChatResponse;
          try { parsed = JSON.parse(trimmed) as OllamaChatResponse; } catch { continue; }
          if (parsed.message?.content) yield { delta: parsed.message.content };
          if (parsed.message?.tool_calls) {
            for (const tc of parsed.message.tool_calls) {
              yield { toolCall: { id: `ollama-${tc.function.name}`, name: tc.function.name, input: tc.function.arguments } };
            }
          }
          if (parsed.done) {
            prompt = parsed.prompt_eval_count ?? prompt;
            completion = parsed.eval_count ?? completion;
          }
        }
      }
    } catch (error) { yield { error: (error as Error).message }; return; }

    yield { done: true, usage: { promptTokens: prompt, completionTokens: completion, costUsd: 0 } };
  }

  async models(): Promise<string[]> {
    if (this.modelsCache && Date.now() - this.modelsCache.at < this.modelsCacheMs) {
      return this.modelsCache.value.slice();
    }
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseURL}/api/tags`);
    } catch {
      return [];
    }
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: { name: string }[] };
    const names = (json.models ?? []).map((m) => m.name);
    this.modelsCache = { value: names, at: Date.now() };
    return names.slice();
  }
}
