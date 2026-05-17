// -----------------------------------------------------------------------------
// STUB FILE — DELETE AT MERGE TIME
// -----------------------------------------------------------------------------
// A parallel worktree is creating the real `src/providers/gemini.ts` adapter
// (Google Generative Language REST API). This stub exists only so this
// worktree's router-routing refactor typechecks and runs end-to-end before the
// real adapter lands.
//
// On merge:
//   - PREFER the parallel worktree's real implementation.
//   - This file's only purpose is to keep `bootstrap.ts` compiling. The real
//     adapter must still export `GeminiProvider` (class) and
//     `GEMINI_DEFAULT_MODEL` (constant) so the registration callsite keeps
//     working.
//   - If the real file lacks `GEMINI_DEFAULT_MODEL`, add it there (do not
//     re-introduce this stub).
// -----------------------------------------------------------------------------
import type {
  ApiKeyResolver,
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
  ProviderStreamChunk,
} from "./types.js";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export const GEMINI_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
};

export interface GeminiProviderOptions {
  apiKeyResolver?: ApiKeyResolver;
}

export class GeminiProvider implements LLMProvider {
  name = "gemini" as const;
  // Held for the real implementation; the stub never reads it.
  private apiKeyResolver?: ApiKeyResolver;

  constructor(opts: GeminiProviderOptions = {}) {
    this.apiKeyResolver = opts.apiKeyResolver;
    void this.apiKeyResolver;
  }

  async call(_opts: ProviderCallOptions): Promise<ProviderCallResult> {
    throw new Error("gemini: stub provider — real adapter not merged yet");
  }

  async *stream(_opts: ProviderCallOptions): AsyncIterable<ProviderStreamChunk> {
    yield { error: "gemini: stub provider — real adapter not merged yet" };
  }

  async models(): Promise<string[]> {
    return Object.keys(GEMINI_MODEL_PRICING);
  }
}
