import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { relative } from "@/lib/format";
import { canManageWorkspaceRole } from "@/lib/roles";
import type {
  ApiKeyProviderName,
  MaskedApiKey,
  ProviderKind,
  ProviderRecord,
  SaveWorkspaceEnvVarInput,
  WorkspaceEnvVarRecord,
  WorkspaceEnvVarScope,
} from "@/lib/types";

const VAULT_PROVIDERS: ApiKeyProviderName[] = ["anthropic", "openai", "minimax", "ollama"];

export default function IntegrationsPage() {
  const { session } = useAuth();
  const canManageIntegrations = canManageWorkspaceRole(session?.workspace.role);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [envVars, setEnvVars] = useState<WorkspaceEnvVarRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<MaskedApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEnv, setSavingEnv] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [nextProviders, nextEnvVars, nextKeys] = await Promise.all([
        api.listProviders(),
        api.listEnvVars(),
        api.listApiKeys().catch(() => [] as MaskedApiKey[]),
      ]);
      setProviders(nextProviders);
      setEnvVars(nextEnvVars);
      setApiKeys(nextKeys);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageIntegrations) return;
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
    if (!canManageIntegrations) return;
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
    if (!canManageIntegrations) return;
    setSavingEnv(envVar.id);
    setError(null);
    try {
      await api.deleteEnvVar(envVar.id);
      setMessage(`Env var ${envVar.key} removed.`);
      await reload();
    } catch (e) { setError((e as Error).message); }
    finally { setSavingEnv(null); }
  };

  const addApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageIntegrations) return;
    const form = new FormData(event.currentTarget);
    setSavingKey("new");
    setError(null);
    setMessage(null);
    try {
      await api.createApiKey({
        provider: field(form, "provider") as ApiKeyProviderName,
        label: field(form, "label"),
        value: field(form, "value"),
      });
      event.currentTarget.reset();
      setMessage("Provider key stored encrypted.");
      await reload();
    } catch (e) { setError((e as Error).message); }
    finally { setSavingKey(null); }
  };

  const removeApiKey = async (key: MaskedApiKey) => {
    if (!canManageIntegrations) return;
    setSavingKey(key.id);
    setError(null);
    try {
      await api.deleteApiKey(key.id);
      setMessage(`Key ${key.label} removed.`);
      await reload();
    } catch (e) { setError((e as Error).message); }
    finally { setSavingKey(null); }
  };

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <div className="kicker mb-3">PROVIDERS · KEYS · ENV</div>
          <h1 className="display-xl">Integrations.</h1>
          <p className="mt-4 max-w-xl font-mono text-xs text-ink-400">
            <span className="text-ink-500">connect provider keys, store secrets in the AES-GCM vault, expose env vars to runtime.</span>
          </p>
        </div>
      </header>

      {error && <div className="mb-6 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">ERR · {error}</div>}
      {message && !error && <div className="mb-6 border border-signal-green/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-green">OK · {message}</div>}
      {!canManageIntegrations && (
        <div className="mb-6 border border-ink-700 bg-ink-950/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
          Admin role required to store keys, manage env vars, or create providers.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING</span>
        </div>
      ) : (
        <>
          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker-amber mb-2">PROVIDER KEYS · {apiKeys.length} STORED</div>
                <h2 className="display text-2xl">Encrypted vault</h2>
                <p className="mt-2 max-w-xl font-mono text-xs text-ink-500">
                  AES-256-GCM at rest. Keys decrypt only at provider-call time.
                </p>
              </div>
              <span className="section-marker">§ 01 / 03</span>
            </div>

            {canManageIntegrations ? <form className="grid gap-3 border-b border-ink-700 pb-5 md:grid-cols-[160px_1fr_2fr_120px] md:items-end" onSubmit={addApiKey}>
              <Field label="PROVIDER">
                <select name="provider" className="workflow-input" defaultValue="anthropic">
                  {VAULT_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="LABEL">
                <input name="label" className="workflow-input" placeholder="default" required />
              </Field>
              <Field label="API KEY">
                <input name="value" type="password" className="workflow-input font-mono" placeholder="sk-..." required />
              </Field>
              <button className="btn-primary justify-center" type="submit" disabled={savingKey === "new"}>
                {savingKey === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "+"} Store
              </button>
            </form> : <ReadOnlyRoleNotice />}

            {apiKeys.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-6 py-8 text-center">
                <div className="kicker mb-1.5">VAULT EMPTY</div>
                <p className="font-mono text-xs text-ink-500">Stub provider in use until a key is added.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Label</th>
                    <th>Masked</th>
                    <th>Last used</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.id}>
                      <td className="font-mono text-[11px] text-ink-200 lowercase">{k.provider}</td>
                      <td className="text-sm text-ink-100">{k.label}</td>
                      <td className="font-mono text-[11px] text-ink-400">{k.masked}</td>
                      <td className="font-mono text-[11px] text-ink-500">{k.lastUsedAt ? relative(k.lastUsedAt) : "—"}</td>
                      <td className="font-mono text-[11px] text-ink-500">{relative(k.createdAt)}</td>
                      <td>
                        {canManageIntegrations && (
                        <button type="button" className="font-mono text-xs text-ink-500 hover:text-signal-red" onClick={() => removeApiKey(k)} disabled={savingKey === k.id}>
                          × DEL
                        </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">ENV VARIABLES · {envVars.length}</div>
                <h2 className="display text-2xl">Workspace environment</h2>
                <p className="mt-2 max-w-xl font-mono text-xs text-ink-500">
                  Workspace-scoped key/value pairs. Mark sensitive values as secret to mask them in the UI.
                </p>
              </div>
              <span className="section-marker">§ 02 / 03</span>
            </div>

            {canManageIntegrations ? <form className="grid gap-3 border-b border-ink-700 pb-5 md:grid-cols-2" onSubmit={addEnvVar}>
              <Field label="KEY">
                <input
                  name="key"
                  className="workflow-input font-mono"
                  placeholder="MY_API_KEY"
                  pattern="[A-Za-z][A-Za-z0-9_]*"
                  required
                />
              </Field>
              <Field label="SCOPE">
                <select name="scope" className="workflow-input" defaultValue="all">
                  <option value="all">all scopes</option>
                  <option value="build">build only</option>
                  <option value="runtime">runtime only</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="VALUE">
                  <textarea name="value" rows={2} className="workflow-input resize-none" placeholder="https://example.com or sk-..." required />
                </Field>
              </div>
              <Field label="DESCRIPTION">
                <input name="description" className="workflow-input" placeholder="What this value is used for" />
              </Field>
              <label className="flex items-center gap-3 self-end font-mono text-xs text-ink-300">
                <input name="secret" type="checkbox" className="h-3.5 w-3.5 accent-signal-amber" />
                MARK AS SECRET (MASK IN UI)
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button className="btn-primary" type="submit" disabled={savingEnv === "new"}>
                  {savingEnv === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "+"} Save variable
                </button>
              </div>
            </form> : <ReadOnlyRoleNotice />}

            {envVars.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-6 py-8 text-center">
                <div className="kicker mb-1.5">NO ENV VARIABLES</div>
                <p className="font-mono text-xs text-ink-500">Define keys here and reference them from agents and runtime adapters.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Scope</th>
                    <th>Description</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {envVars.map((v) => (
                    <tr key={v.id}>
                      <td className="font-mono text-[12px] text-ink-100">
                        {v.key}
                        {v.secret && <span className="ml-2 pill pill--warn">SECRET</span>}
                      </td>
                      <td className="break-all font-mono text-[11px] text-ink-400">{v.value || "(empty)"}</td>
                      <td className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{v.scope}</td>
                      <td className="text-sm text-ink-400">{v.description || "—"}</td>
                      <td className="font-mono text-[11px] text-ink-500">{relative(v.updatedAt)}</td>
                      <td>
                        {canManageIntegrations && (
                        <button type="button" className="font-mono text-xs text-ink-500 hover:text-signal-red" onClick={() => removeEnvVar(v)} disabled={savingEnv === v.id}>
                          × DEL
                        </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="section-band">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="kicker mb-2">EXTERNAL PROVIDERS · {providers.length}</div>
                <h2 className="display text-2xl">Provider registry</h2>
                <p className="mt-2 max-w-xl font-mono text-xs text-ink-500">
                  Provider metadata used by the agent editor. Storage of the actual key happens in the encrypted vault above.
                </p>
              </div>
              <span className="section-marker">§ 03 / 03</span>
            </div>

            {canManageIntegrations ? <form className="grid gap-3 border-b border-ink-700 pb-5 md:grid-cols-[1fr_140px_1fr_1fr_auto] md:items-end" onSubmit={addProvider}>
              <Field label="NAME">
                <input name="name" className="workflow-input" placeholder="OpenAI" required />
              </Field>
              <Field label="KIND">
                <select name="kind" className="workflow-input" defaultValue="openai">
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                  <option value="azure_openai">azure_openai</option>
                  <option value="ollama">ollama</option>
                  <option value="custom">custom</option>
                </select>
              </Field>
              <Field label="DEFAULT MODEL">
                <input name="defaultModel" className="workflow-input" placeholder="gpt-4.1-mini" required />
              </Field>
              <Field label="BASE URL">
                <input name="baseUrl" className="workflow-input" placeholder="https://api.openai.com/v1" />
              </Field>
              <button className="btn-primary justify-center" type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "+"} Add
              </button>
              <label className="md:col-span-5 flex items-center gap-2 font-mono text-xs text-ink-300">
                <input name="apiKeyConfigured" type="checkbox" className="h-3.5 w-3.5 accent-signal-amber" />
                API KEY CONFIGURED OUTSIDE UI
              </label>
            </form> : <ReadOnlyRoleNotice />}

            {providers.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-6 py-8 text-center">
                <div className="kicker mb-1.5">NO PROVIDERS</div>
                <p className="font-mono text-xs text-ink-500">Add a provider to make it selectable in the agent editor.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Kind</th>
                    <th>Default model</th>
                    <th>Base URL</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td className="font-serif text-base text-ink-100">{p.name}</td>
                      <td className="font-mono text-[11px] text-ink-300">{p.kind.replace("_", " ")}</td>
                      <td className="font-mono text-[11px] text-ink-300">{p.defaultModel}</td>
                      <td className="font-mono text-[11px] text-ink-500">{p.baseUrl || "—"}</td>
                      <td>
                        <span className={p.status === "connected" ? "pill pill--good" : "pill pill--warn"}>
                          {p.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ReadOnlyRoleNotice() {
  return (
    <div className="border border-ink-700 bg-ink-950/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
      Admin role required for changes.
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kicker mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
