import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
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
}
