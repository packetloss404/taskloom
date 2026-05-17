import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";
import { MiniMaxProvider } from "./minimax.js";
import { OllamaProvider } from "./ollama.js";
import { getDefaultRouter } from "./router.js";
import { vaultApiKeyResolver } from "../security/api-key-store.js";
import type { ApiKeyResolver, ProviderName } from "./types.js";

let registered = false;

export const DEFAULT_PROVIDER_NAMES = ["anthropic", "openai", "minimax", "ollama"] as const satisfies readonly ProviderName[];

const adaptedResolver: ApiKeyResolver = (workspaceId: string, provider: ProviderName) => {
  if (provider === "stub") return Promise.resolve(null);
  return vaultApiKeyResolver(workspaceId, provider);
};

export function registerDefaultProviders(): void {
  if (registered) return;
  registered = true;
  const router = getDefaultRouter();
  router.register("anthropic", new AnthropicProvider({ apiKeyResolver: adaptedResolver }));
  router.register("openai", new OpenAIProvider({ apiKeyResolver: adaptedResolver }));
  router.register("minimax", new MiniMaxProvider({ apiKeyResolver: adaptedResolver }));
  router.register("ollama", new OllamaProvider());
  // OpenRouter: only register when the env key is present. The vault-backed
  // resolver still works once registered, but absent any signal we keep the
  // provider unregistered so the router fall-back warning surfaces normally.
  // (Parallel agents may register adjacent providers here; keep this line
  // standalone to avoid merge conflicts.)
  if (process.env.OPENROUTER_API_KEY) {
    router.register("openrouter", new OpenRouterProvider({ apiKeyResolver: adaptedResolver }));
  }
}

export function resetRegisteredProvidersForTests(): void {
  registered = false;
}
