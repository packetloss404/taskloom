// -----------------------------------------------------------------------------
// STUB FILE — DELETE AT MERGE TIME
// -----------------------------------------------------------------------------
// A parallel worktree is creating the real `src/providers/openrouter.ts`
// adapter. This stub exists only so this worktree's router-routing refactor
// typechecks and runs end-to-end before the real adapter lands.
//
// On merge:
//   - PREFER the parallel worktree's real implementation.
//   - This file's only purpose is to keep `bootstrap.ts` compiling. The real
//     adapter must still export `OpenRouterProvider` (class) and
//     `OPENROUTER_DEFAULT_MODEL` (constant) so the registration callsite keeps
//     working.
//   - If the real file lacks `OPENROUTER_DEFAULT_MODEL`, add it there (do not
//     re-introduce this stub).
// -----------------------------------------------------------------------------
import type {
  ApiKeyResolver,
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
  ProviderStreamChunk,
} from "./types.js";

// OpenRouter exposes a wide range of models; pick a cheap default that's a good
// match for the "cheap" preset.
export const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash";

export interface OpenRouterProviderOptions {
  apiKeyResolver?: ApiKeyResolver;
}

export class OpenRouterProvider implements LLMProvider {
  name = "openrouter" as const;
  // Held for the real implementation; the stub never reads it.
  private apiKeyResolver?: ApiKeyResolver;

  constructor(opts: OpenRouterProviderOptions = {}) {
    this.apiKeyResolver = opts.apiKeyResolver;
    void this.apiKeyResolver;
  }

  async call(_opts: ProviderCallOptions): Promise<ProviderCallResult> {
    throw new Error("openrouter: stub provider — real adapter not merged yet");
  }

  async *stream(_opts: ProviderCallOptions): AsyncIterable<ProviderStreamChunk> {
    yield { error: "openrouter: stub provider — real adapter not merged yet" };
  }

  async models(): Promise<string[]> {
    return [OPENROUTER_DEFAULT_MODEL];
  }
}
