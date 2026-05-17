import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { MiniMaxProvider } from "./minimax.js";
import { OllamaProvider } from "./ollama.js";
import { GeminiProvider } from "./gemini.js";
import { OpenRouterProvider } from "./openrouter.js";
import { getDefaultRouter } from "./router.js";
import { vaultApiKeyResolver } from "../security/api-key-store.js";
import type { ApiKeyProvider } from "../taskloom-store.js";
import type { ApiKeyResolver, ProviderName } from "./types.js";

let registered = false;

export const DEFAULT_PROVIDER_NAMES = [
  "anthropic",
  "openai",
  "minimax",
  "ollama",
  "gemini",
  "openrouter",
] as const satisfies readonly ProviderName[];

const VAULT_PROVIDERS: ReadonlySet<ProviderName> = new Set(["anthropic", "openai", "minimax", "ollama"]);

const adaptedResolver: ApiKeyResolver = (workspaceId: string, provider: ProviderName) => {
  if (provider === "stub") return Promise.resolve(null);
  // Gemini and OpenRouter aren't in the ApiKeyProvider vault enum yet; once
  // those vault keys are added, drop this guard and pass them through.
  if (!VAULT_PROVIDERS.has(provider)) return Promise.resolve(null);
  return vaultApiKeyResolver(workspaceId, provider as ApiKeyProvider);
};

export function registerDefaultProviders(): void {
  if (registered) return;
  registered = true;
  const router = getDefaultRouter();
  router.register("anthropic", new AnthropicProvider({ apiKeyResolver: adaptedResolver }));
  router.register("openai", new OpenAIProvider({ apiKeyResolver: adaptedResolver }));
  router.register("minimax", new MiniMaxProvider({ apiKeyResolver: adaptedResolver }));
  router.register("ollama", new OllamaProvider());
  router.register("gemini", new GeminiProvider({ apiKeyResolver: adaptedResolver }));
  router.register("openrouter", new OpenRouterProvider({ apiKeyResolver: adaptedResolver }));
}
