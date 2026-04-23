import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { ProviderKind, ProviderRecord } from "@/lib/types";
import { DashboardStyles } from "./Dashboard";

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProviders = async () => {
    setError(null);
    return api.listProviders()
      .then(setProviders)
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const addProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.createProvider({
        name: field(form, "name"),
        kind: field(form, "kind") as ProviderKind,
        defaultModel: field(form, "defaultModel"),
        baseUrl: field(form, "baseUrl") || undefined,
        apiKeyConfigured: form.get("apiKeyConfigured") === "on",
      });
      event.currentTarget.reset();
      setMessage("Provider saved.");
      await loadProviders();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Providers</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
          Bring your own API keys, local runtimes, or Agent SDK-compatible providers. Keys are represented by backend status, not frontend-only state.
        </p>
      </header>

      {error && <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {message && !error && <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading providers...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <form className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5" onSubmit={addProvider}>
            <h2 className="text-sm font-semibold text-ink-100">Connect provider</h2>
            <p className="mt-2 text-sm leading-6 text-ink-500">This records provider metadata and key status. Secret storage can be wired behind this model later.</p>
            <div className="mt-4 space-y-4">
              <Field label="Name"><input name="name" className="dashboard-input" placeholder="OpenAI" required /></Field>
              <Field label="Kind">
                <select name="kind" className="dashboard-input" defaultValue="openai">
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="azure_openai">Azure OpenAI</option>
                  <option value="ollama">Ollama</option>
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <Field label="Default model"><input name="defaultModel" className="dashboard-input" placeholder="gpt-4.1-mini" required /></Field>
              <Field label="Base URL"><input name="baseUrl" className="dashboard-input" placeholder="https://api.openai.com/v1" /></Field>
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input name="apiKeyConfigured" type="checkbox" className="h-4 w-4 rounded border-ink-700 bg-ink-950" />
                API key configured outside UI
              </label>
              <button className="btn-primary w-full justify-center bg-ink-100 text-ink-950 hover:bg-white" type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save provider
              </button>
            </div>
          </form>

          {providers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/25 p-8 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-ink-850 text-ink-300"><KeyRound className="h-5 w-5" /></div>
              <h2 className="mt-3 text-sm font-semibold text-ink-100">No providers configured</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-500">Add a provider to make it selectable in the agent editor.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {providers.map((provider) => (
                <article key={provider.id} className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-ink-100">{provider.name}</h2>
                      <p className="mt-2 text-sm text-ink-400">{provider.kind.replace("_", " ")} · {provider.defaultModel}</p>
                      {provider.baseUrl && <p className="mt-1 text-xs text-ink-500">{provider.baseUrl}</p>}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${
                      provider.status === "connected"
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                    }`}>
                      {provider.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl border border-ink-800 bg-ink-950/35 px-3 py-2 text-xs text-ink-500">
                    API key: {provider.apiKeyConfigured ? "configured in backend" : "missing"}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
      <DashboardStyles />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink-200">{label}</span>{children}</label>;
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
