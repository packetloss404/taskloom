import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { MiniMaxProvider } from "./minimax.js";
import { OllamaProvider } from "./ollama.js";
import { GeminiProvider } from "./gemini.js";
import { getDefaultRouter, hasGeminiEnvKey } from "./router.js";
import { vaultApiKeyResolver } from "../security/api-key-store.js";
import type { ApiKeyResolver, ProviderName } from "./types.js";

let registered = false;

export const DEFAULT_PROVIDER_NAMES = ["anthropic", "openai", "minimax", "ollama", "gemini"] as const satisfies readonly ProviderName[];

const adaptedResolver: ApiKeyResolver = (workspaceId: string, provider: ProviderName) => {
  if (provider === "stub") return Promise.resolve(null);
  return vaultApiKeyResolver(workspaceId, provider);
};

/** Test-only: resets the module-level guard so registration can re-run. */
export function resetRegisteredProvidersForTests(): void {
  registered = false;
}

export function registerDefaultProviders(): void {
  if (registered) return;
  registered = true;
  const router = getDefaultRouter();
  router.register("anthropic", new AnthropicProvider({ apiKeyResolver: adaptedResolver }));
  router.register("openai", new OpenAIProvider({ apiKeyResolver: adaptedResolver }));
  router.register("minimax", new MiniMaxProvider({ apiKeyResolver: adaptedResolver }));
  router.register("ollama", new OllamaProvider());
  // Gemini is opt-in via env: only register when GOOGLE_API_KEY (or
  // GEMINI_API_KEY) is present, so users without a Google key don't see
  // gemini as an available provider. The vault resolver still gets a chance
  // to supply per-workspace keys for callers that explicitly registered the
  // provider another way.
  if (hasGeminiEnvKey()) {
    router.register("gemini", new GeminiProvider({ apiKeyResolver: adaptedResolver }));
  }
}
