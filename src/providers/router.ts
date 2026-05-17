import type {
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
  ProviderName,
  ProviderStreamChunk,
} from "./types.js";
import { StubProvider } from "./stub.js";

export interface ProviderRoute {
  provider: ProviderName;
  model: string;
}

export const DEFAULT_ROUTES: Record<string, ProviderRoute> = {
  "workflow.draft": { provider: "anthropic", model: "claude-opus-4-7" },
  "workflow.brief_rewrite": { provider: "anthropic", model: "claude-sonnet-4-6" },
  "workflow.plan_mode": { provider: "anthropic", model: "claude-opus-4-7" },
  "agent.summary": { provider: "openai", model: "gpt-4o-mini" },
  "agent.reasoning": { provider: "anthropic", model: "claude-opus-4-7" },
  "code.generation": { provider: "minimax", model: "abab6.5-chat" },
  "local.dev": { provider: "ollama", model: "llama3.2" },
  // OpenRouter presets: when a user only has an OPENROUTER_API_KEY they still
  // get usable defaults for the cheap/fast/smart tiers via OpenRouter's proxy.
  "byok.openrouter.cheap": { provider: "openrouter", model: "qwen/qwen3-coder" },
  "byok.openrouter.fast": { provider: "openrouter", model: "anthropic/claude-haiku-4-5" },
  "byok.openrouter.smart": { provider: "openrouter", model: "anthropic/claude-sonnet-4-6" },
};

const FALLBACK_ROUTE: ProviderRoute = { provider: "stub", model: "stub-small" };

export class ProviderRouter {
  private routes: Map<string, ProviderRoute>;
  private providers: Map<ProviderName, LLMProvider>;

  constructor(routes: Record<string, ProviderRoute> = DEFAULT_ROUTES) {
    this.routes = new Map(Object.entries(routes));
    this.providers = new Map();
    this.providers.set("stub", new StubProvider());
  }

  register(name: ProviderName, instance: LLMProvider): void {
    this.providers.set(name, instance);
  }

  setRoute(routeKey: string, route: ProviderRoute): void {
    this.routes.set(routeKey, route);
  }

  resolve(routeKey: string): ProviderRoute {
    return this.routes.get(routeKey) ?? FALLBACK_ROUTE;
  }

  private select(routeKey: string, modelOverride?: string, providerOverride?: ProviderName): { provider: LLMProvider; route: ProviderRoute } {
    const baseRoute = this.resolve(routeKey);
    const route = providerOverride ? { ...baseRoute, provider: providerOverride } : baseRoute;
    let provider = this.providers.get(route.provider);
    if (!provider) {
      console.warn(
        `[provider-router] no provider registered for "${route.provider}" (route "${routeKey}"), falling back to stub`,
      );
      provider = this.providers.get("stub")!;
    }
    return {
      provider,
      route: { provider: provider.name, model: modelOverride && modelOverride.length > 0 ? modelOverride : route.model },
    };
  }

  async call(opts: Omit<ProviderCallOptions, "model"> & { model?: string; provider?: ProviderName }): Promise<ProviderCallResult> {
    const { provider, route } = this.select(opts.routeKey, opts.model, opts.provider);
    return provider.call({ ...opts, model: route.model });
  }

  stream(opts: Omit<ProviderCallOptions, "model"> & { model?: string; provider?: ProviderName }): AsyncIterable<ProviderStreamChunk> {
    const { provider, route } = this.select(opts.routeKey, opts.model, opts.provider);
    return provider.stream({ ...opts, model: route.model });
  }

  has(name: ProviderName): boolean {
    return this.providers.get(name) !== undefined && (name === "stub" || this.providers.get(name) !== this.providers.get("stub"));
  }
}

let defaultRouter: ProviderRouter | null = null;

export function getDefaultRouter(): ProviderRouter {
  if (!defaultRouter) defaultRouter = new ProviderRouter();
  return defaultRouter;
}

export function setDefaultRouter(router: ProviderRouter): void {
  defaultRouter = router;
}

export function resetDefaultRouterForTests(): void {
  defaultRouter = null;
}
