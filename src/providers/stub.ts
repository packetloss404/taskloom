import type {
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
  ProviderStreamChunk,
} from "./types.js";

const STUB_MODELS = ["stub-small", "stub-large"];

function lastUserMessage(opts: ProviderCallOptions): string {
  for (let i = opts.messages.length - 1; i >= 0; i--) {
    const msg = opts.messages[i];
    if (msg.role === "user") return msg.content;
  }
  return "";
}

function approximateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function stubBody(opts: ProviderCallOptions): string {
  const last = lastUserMessage(opts);
  return `[stub:${opts.routeKey}] ${last.split("").reverse().join("")}`;
}

export class StubProvider implements LLMProvider {
  name = "stub" as const;

  async call(opts: ProviderCallOptions): Promise<ProviderCallResult> {
    const content = stubBody(opts);
    const promptText = opts.messages.map((m) => m.content).join("\n");
    return {
      content,
      finishReason: "stop",
      usage: {
        promptTokens: approximateTokens(promptText),
        completionTokens: approximateTokens(content),
        costUsd: 0,
      },
      model: opts.model || "stub-small",
      providerName: "stub",
    };
  }

  async *stream(opts: ProviderCallOptions): AsyncIterable<ProviderStreamChunk> {
    const content = stubBody(opts);
    const tokens = content.split(/(\s+)/);
    for (const token of tokens) {
      if (opts.signal?.aborted) {
        yield { error: "aborted" };
        return;
      }
      yield { delta: token };
    }
    const promptText = opts.messages.map((m) => m.content).join("\n");
    yield {
      done: true,
      usage: {
        promptTokens: approximateTokens(promptText),
        completionTokens: approximateTokens(content),
        costUsd: 0,
      },
    };
  }

  async models(): Promise<string[]> {
    return [...STUB_MODELS];
  }
}
