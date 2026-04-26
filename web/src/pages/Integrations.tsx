import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Plus, Trash2, Variable } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type {
  ProviderKind,
  ProviderRecord,
  SaveWorkspaceEnvVarInput,
  WorkspaceEnvVarRecord,
  WorkspaceEnvVarScope,
} from "@/lib/types";
import { DashboardStyles } from "./Dashboard";

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [envVars, setEnvVars] = useState<WorkspaceEnvVarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEnv, setSavingEnv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [nextProviders, nextEnvVars] = await Promise.all([api.listProviders(), api.listEnvVars()]);
      setProviders(nextProviders);
      setEnvVars(nextEnvVars);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
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
      await reload();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addEnvVar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: SaveWorkspaceEnvVarInput = {
      key: field(form, "key"),
      value: field(form, "value"),
      scope: (field(form, "scope") as WorkspaceEnvVarScope) || "all",
      secret: form.get("secret") === "on",
      description: field(form, "description") || undefined,
    };
    setSavingEnv("new");
    setError(null);
    setMessage(null);
    try {
      await api.createEnvVar(body);
      event.currentTarget.reset();
      setMessage(`Env var ${body.key} added.`);
      await reload();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSavingEnv(null);
    }
  };

  const removeEnvVar = async (envVar: WorkspaceEnvVarRecord) => {
    setSavingEnv(envVar.id);
    setError(null);
    try {
      await api.deleteEnvVar(envVar.id);
      setMessage(`Env var ${envVar.key} removed.`);
      await reload();
    } catch (removeError) {
      setError((removeError as Error).message);
    } finally {
      setSavingEnv(null);
    }
  };

  const toggleSecret = async (envVar: WorkspaceEnvVarRecord) => {
    setSavingEnv(envVar.id);
    setError(null);
    try {
      await api.updateEnvVar(envVar.id, { secret: !envVar.secret });
      await reload();
    } catch (updateError) {
      setError((updateError as Error).message);
    } finally {
      setSavingEnv(null);
    }
  };

  return (
    <>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-100">Providers & Environment</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
          Connect provider keys, then expose workspace-scoped environment variables to builds and runtime adapters.
        </p>
      </header>

      {error && <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {message && !error && <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading providers and environment...</div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Providers</h2>
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <form className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5" onSubmit={addProvider}>
                <h3 className="text-sm font-semibold text-ink-100">Connect provider</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">Records provider metadata and key status. Secret storage can be wired behind this model later.</p>
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
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Environment variables</h2>
                <p className="mt-1 text-xs text-ink-500">Workspace-scoped key/value pairs. Mark sensitive values as secret to mask them in the UI.</p>
              </div>
              <span className="rounded-full border border-ink-700 bg-ink-900/40 px-3 py-1 text-xs text-ink-300">{envVars.length} variable{envVars.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <form className="rounded-2xl border border-ink-800/80 bg-ink-900/45 p-5" onSubmit={addEnvVar}>
                <h3 className="text-sm font-semibold text-ink-100">Add variable</h3>
                <div className="mt-4 space-y-4">
                  <Field label="Key">
                    <input
                      name="key"
                      className="dashboard-input"
                      placeholder="MY_API_KEY"
                      pattern="[A-Za-z][A-Za-z0-9_]*"
                      title="Letters, digits, and underscores. Must start with a letter."
                      required
                    />
                  </Field>
                  <Field label="Value">
                    <textarea name="value" rows={3} className="dashboard-input resize-none" placeholder="https://example.com or sk-..." required />
                  </Field>
                  <Field label="Scope">
                    <select name="scope" className="dashboard-input" defaultValue="all">
                      <option value="all">All scopes</option>
                      <option value="build">Builds only</option>
                      <option value="runtime">Runtime only</option>
                    </select>
                  </Field>
                  <Field label="Description">
                    <input name="description" className="dashboard-input" placeholder="What this value is used for" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-ink-300">
                    <input name="secret" type="checkbox" className="h-4 w-4 rounded border-ink-700 bg-ink-950" />
                    Mark as secret (mask in UI)
                  </label>
                  <button className="btn-primary w-full justify-center bg-ink-100 text-ink-950 hover:bg-white" type="submit" disabled={savingEnv === "new"}>
                    {savingEnv === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save variable
                  </button>
                </div>
              </form>

              {envVars.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/25 p-8 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-ink-850 text-ink-300"><Variable className="h-5 w-5" /></div>
                  <h3 className="mt-3 text-sm font-semibold text-ink-100">No environment variables yet</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-500">Define keys here and reference them from agents, runtime adapters, or build commands.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {envVars.map((envVar) => (
                    <EnvVarRow
                      key={envVar.id}
                      envVar={envVar}
                      busy={savingEnv === envVar.id}
                      onToggleSecret={() => toggleSecret(envVar)}
                      onDelete={() => removeEnvVar(envVar)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      <DashboardStyles />
    </>
  );
}

function EnvVarRow({
  envVar,
  busy,
  onToggleSecret,
  onDelete,
}: {
  envVar: WorkspaceEnvVarRecord;
  busy: boolean;
  onToggleSecret: () => void;
  onDelete: () => void;
}) {
  const scopeLabel = envVar.scope === "all" ? "All scopes" : envVar.scope === "build" ? "Builds" : "Runtime";
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-900/45 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink-100">{envVar.key}</span>
            {envVar.secret && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
                <Lock className="h-3 w-3" /> secret
              </span>
            )}
            <span className="rounded-full border border-ink-700 bg-ink-950/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">{scopeLabel}</span>
          </div>
          <code className="mt-1.5 block break-all font-mono text-xs text-ink-400">{envVar.value || "(empty)"}</code>
          {envVar.description && <p className="mt-1 text-xs text-ink-500">{envVar.description}</p>}
          <p className="mt-1 text-[11px] text-ink-600">Updated {relative(envVar.updatedAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleSecret}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-700 bg-ink-950/40 text-ink-300 hover:border-ink-500 hover:text-ink-100 disabled:opacity-50"
            title={envVar.secret ? "Mark as plain (show value)" : "Mark as secret (mask value)"}
          >
            {envVar.secret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-700 bg-ink-950/40 text-ink-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink-200">{label}</span>{children}</label>;
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
