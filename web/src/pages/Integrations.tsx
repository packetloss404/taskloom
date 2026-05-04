import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  PlugZap,
  Webhook,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { relative } from "@/lib/format";
import { canManageWorkspaceRole } from "@/lib/roles";
import type {
  ApiKeyProviderName,
  IntegrationMarketplaceCard,
  IntegrationReadinessSummary,
  IntegrationSetupAction,
  IntegrationSetupStatus,
  MaskedApiKey,
  ProviderKind,
  ProviderRecord,
  SaveWorkspaceEnvVarInput,
  WorkspaceEnvVarRecord,
  WorkspaceEnvVarScope,
} from "@/lib/types";

const VAULT_PROVIDERS: ApiKeyProviderName[] = ["anthropic", "openai", "minimax", "ollama"];

const MARKETPLACE_CARDS: IntegrationMarketplaceCard[] = [
  {
    id: "openai",
    name: "OpenAI",
    kind: "llm",
    summary: "Model routing for app drafts, agent runs, fixes, and summaries.",
    generatedWorkHint: "Generated agents can select OpenAI models once the provider record and key are ready.",
    providerKind: "openai",
    keyProvider: "openai",
    actions: [
      { kind: "api_key", label: "Store key", provider: "openai", placeholder: "sk-..." },
      { kind: "provider", label: "Add provider", providerKind: "openai", placeholder: "gpt-4.1-mini" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "llm",
    summary: "Claude planning, agent drafting, and long-context generation.",
    generatedWorkHint: "Builder plans can route high-context work to Claude after the key is present.",
    providerKind: "anthropic",
    keyProvider: "anthropic",
    actions: [
      { kind: "api_key", label: "Store key", provider: "anthropic", placeholder: "sk-ant-..." },
      { kind: "provider", label: "Add provider", providerKind: "anthropic", placeholder: "claude-3-5-sonnet-latest" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama / local",
    kind: "local_model",
    summary: "Local model endpoint for private drafts and offline experiments.",
    generatedWorkHint: "Generated work can use local models when the base URL and model record exist.",
    providerKind: "ollama",
    keyProvider: "ollama",
    requiredEnvKeys: ["OLLAMA_BASE_URL"],
    actions: [
      { kind: "env_url", label: "Set URL", envKey: "OLLAMA_BASE_URL", placeholder: "http://localhost:11434", scope: "runtime" },
      { kind: "provider", label: "Add provider", providerKind: "ollama", placeholder: "llama3.1" },
    ],
  },
  {
    id: "custom-api",
    name: "Custom API",
    kind: "custom_api",
    summary: "External REST APIs used by generated pages, jobs, and agents.",
    generatedWorkHint: "Plans can request custom endpoints by env key without exposing secrets.",
    providerKind: "custom",
    requiredEnvKeys: ["CUSTOM_API_BASE_URL"],
    optionalEnvKeys: ["CUSTOM_API_TOKEN"],
    actions: [
      { kind: "env_url", label: "Set base URL", envKey: "CUSTOM_API_BASE_URL", placeholder: "https://api.example.com", scope: "runtime" },
      { kind: "env_secret", label: "Set token", envKey: "CUSTOM_API_TOKEN", placeholder: "Bearer token", secret: true, scope: "runtime" },
      { kind: "provider", label: "Add provider", providerKind: "custom", placeholder: "custom-model" },
    ],
  },
  {
    id: "slack-webhook",
    name: "Slack / webhook",
    kind: "webhook",
    summary: "Incoming triggers and outbound notifications for generated agents.",
    generatedWorkHint: "Generated agents can ask for webhook URLs and store only masked env values.",
    requiredEnvKeys: ["SLACK_WEBHOOK_URL"],
    actions: [
      { kind: "webhook", label: "Set webhook", envKey: "SLACK_WEBHOOK_URL", placeholder: "https://hooks.slack.com/...", secret: true, scope: "runtime" },
    ],
  },
  {
    id: "email",
    name: "Email",
    kind: "email",
    summary: "Transactional email credentials for notices, invites, and receipts.",
    generatedWorkHint: "Generated apps can list required SMTP or provider envs before publish.",
    requiredEnvKeys: ["RESEND_API_KEY", "SENDGRID_API_KEY", "POSTMARK_TOKEN", "SMTP_URL"],
    actions: [
      { kind: "env_url", label: "Set SMTP URL", envKey: "SMTP_URL", placeholder: "smtp://user:pass@smtp.example.com:587", secret: true, scope: "runtime" },
      { kind: "env_secret", label: "Set Resend key", envKey: "RESEND_API_KEY", placeholder: "re_...", secret: true, scope: "runtime" },
    ],
  },
  {
    id: "github-webhook",
    name: "GitHub webhook",
    kind: "source_control",
    summary: "Repository event intake for release, issue, and workflow automations.",
    generatedWorkHint: "Generated agents can document webhook secrets and callback URLs as setup gaps.",
    requiredEnvKeys: ["GITHUB_WEBHOOK_SECRET"],
    optionalEnvKeys: ["GITHUB_APP_URL"],
    actions: [
      { kind: "env_secret", label: "Set secret", envKey: "GITHUB_WEBHOOK_SECRET", placeholder: "webhook secret", secret: true, scope: "runtime" },
      { kind: "env_url", label: "Set app URL", envKey: "GITHUB_APP_URL", placeholder: "https://github.com/apps/...", scope: "runtime" },
    ],
  },
  {
    id: "browser",
    name: "Browser scraping",
    kind: "browser",
    summary: "Read-side browser tool access for research and extraction steps.",
    generatedWorkHint: "Generated plans can use browser-style tools when available in the tool catalog.",
    actions: [],
  },
  {
    id: "stripe",
    name: "Stripe / payments",
    kind: "payments",
    summary: "Checkout, billing webhooks, and payment-status callbacks.",
    generatedWorkHint: "Generated apps can require payment secrets without blocking non-payment pages.",
    requiredEnvKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    actions: [
      { kind: "env_secret", label: "Set secret key", envKey: "STRIPE_SECRET_KEY", placeholder: "sk_live_...", secret: true, scope: "runtime" },
      { kind: "webhook", label: "Set webhook secret", envKey: "STRIPE_WEBHOOK_SECRET", placeholder: "whsec_...", secret: true, scope: "runtime" },
    ],
  },
  {
    id: "database",
    name: "Database",
    kind: "database",
    summary: "Generated data-backed apps, publish envs, and migration handoff.",
    generatedWorkHint: "Generated CRUD apps can call out DATABASE_URL readiness before publish.",
    requiredEnvKeys: ["DATABASE_URL"],
    actions: [
      { kind: "env_secret", label: "Set database URL", envKey: "DATABASE_URL", placeholder: "postgres://...", secret: true, scope: "runtime" },
    ],
  },
];

type SetupCheck = {
  status: IntegrationSetupStatus;
  checkedAt: string;
  detail: string;
};

export default function IntegrationsPage() {
  const { session } = useAuth();
  const canManageIntegrations = canManageWorkspaceRole(session?.workspace.role);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [envVars, setEnvVars] = useState<WorkspaceEnvVarRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<MaskedApiKey[]>([]);
  const [readiness, setReadiness] = useState<IntegrationReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEnv, setSavingEnv] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [setupChecks, setSetupChecks] = useState<Record<string, SetupCheck>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [nextProviders, nextEnvVars, nextKeys, nextReadiness] = await Promise.all([
        api.listProviders(),
        api.listEnvVars(),
        api.listApiKeys().catch(() => [] as MaskedApiKey[]),
        api.getIntegrationReadiness().catch(() => null),
      ]);
      setProviders(nextProviders);
      setEnvVars(nextEnvVars);
      setApiKeys(nextKeys);
      setReadiness(nextReadiness);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const cardStatuses = useMemo(
    () => MARKETPLACE_CARDS.map((card) => ({ card, status: buildCardStatus(card, providers, envVars, apiKeys, readiness) })),
    [apiKeys, envVars, providers, readiness],
  );

  const configuredCount = cardStatuses.filter(({ status }) => status.configured).length;
  const missingCount = cardStatuses.length - configuredCount;
  const testedCount = Object.values(setupChecks).filter((check) => check.status === "test_passed").length;

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
      setOpenAction(null);
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
    setSavingEnv(field(form, "actionId") || "new");
    setError(null);
    setMessage(null);
    try {
      await api.createEnvVar(body);
      event.currentTarget.reset();
      setMessage(`Env var ${body.key} added.`);
      setOpenAction(null);
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
    setSavingKey(field(form, "actionId") || "new");
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
      setOpenAction(null);
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

  const runSetupCheck = async (card: IntegrationMarketplaceCard) => {
    setError(null);
    setMessage(`${card.name} sandbox check running.`);
    try {
      const result = await api.testIntegrationMarketplaceCard(card.id);
      const passed = result.test.status === "pass";
      const next: SetupCheck = {
        status: passed ? "test_passed" : "test_failed",
        checkedAt: new Date().toISOString(),
        detail: passed ? result.test.message : result.test.setupGuide[0] ?? result.test.message,
      };
      setSetupChecks((current) => ({ ...current, [card.id]: next }));
      setMessage(`${card.name} sandbox check ${passed ? "passed" : "needs setup"}.`);
    } catch (checkError) {
      const fallback = buildCardStatus(card, providers, envVars, apiKeys, readiness);
      setSetupChecks((current) => ({
        ...current,
        [card.id]: {
          status: "test_failed",
          checkedAt: new Date().toISOString(),
          detail: fallback.missing.length > 0 ? `Missing ${fallback.missing.join(", ")}.` : (checkError as Error).message,
        },
      }));
      setError((checkError as Error).message);
    }
  };

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <div className="kicker mb-3">MARKETPLACE · SETUP · GENERATED WORK</div>
          <h1 className="display-xl">Integrations.</h1>
          <p className="mt-4 max-w-2xl font-mono text-xs text-ink-400">
            <span className="text-ink-500">connect provider keys, webhooks, URLs, and runtime envs without exposing secret values.</span>
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
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="kicker-amber mb-2">INTEGRATION MARKETPLACE LITE</div>
                <h2 className="display text-2xl">Setup wizard</h2>
                <p className="mt-2 max-w-2xl font-mono text-xs text-ink-500">
                  Cards show configured, missing, and test status for generated apps and agents.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="pill pill--good">{configuredCount} configured</span>
                <span className={missingCount ? "pill pill--warn" : "pill pill--muted"}>{missingCount} missing</span>
                <span className="pill pill--muted">{testedCount} tested</span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {cardStatuses.map(({ card, status }) => (
                <IntegrationCard
                  key={card.id}
                  card={card}
                  status={status}
                  check={setupChecks[card.id]}
                  openAction={openAction}
                  canManage={canManageIntegrations}
                  savingEnv={savingEnv}
                  savingKey={savingKey}
                  savingProvider={saving}
                  onAction={(actionId) => setOpenAction(openAction === actionId ? null : actionId)}
                  onRunCheck={() => runSetupCheck(card)}
                  onAddApiKey={addApiKey}
                  onAddEnvVar={addEnvVar}
                  onAddProvider={addProvider}
                />
              ))}
            </div>
          </section>

          {readiness && <ReadinessSummary readiness={readiness} />}

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
                      <td className="font-mono text-[11px] text-ink-500">{k.lastUsedAt ? relative(k.lastUsedAt) : "-"}</td>
                      <td className="font-mono text-[11px] text-ink-500">{relative(k.createdAt)}</td>
                      <td>
                        {canManageIntegrations && (
                        <button type="button" className="font-mono text-xs text-ink-500 hover:text-signal-red" onClick={() => removeApiKey(k)} disabled={savingKey === k.id}>
                          x DEL
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
                      <td className="text-sm text-ink-400">{v.description || "-"}</td>
                      <td className="font-mono text-[11px] text-ink-500">{relative(v.updatedAt)}</td>
                      <td>
                        {canManageIntegrations && (
                        <button type="button" className="font-mono text-xs text-ink-500 hover:text-signal-red" onClick={() => removeEnvVar(v)} disabled={savingEnv === v.id}>
                          x DEL
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
                  <option value="minimax">minimax</option>
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
                      <td className="font-mono text-[11px] text-ink-500">{p.baseUrl || "-"}</td>
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

function IntegrationCard({
  card,
  status,
  check,
  openAction,
  canManage,
  savingEnv,
  savingKey,
  savingProvider,
  onAction,
  onRunCheck,
  onAddApiKey,
  onAddEnvVar,
  onAddProvider,
}: {
  card: IntegrationMarketplaceCard;
  status: ReturnType<typeof buildCardStatus>;
  check?: SetupCheck;
  openAction: string | null;
  canManage: boolean;
  savingEnv: string | null;
  savingKey: string | null;
  savingProvider: boolean;
  onAction: (actionId: string) => void;
  onRunCheck: () => void;
  onAddApiKey: (event: FormEvent<HTMLFormElement>) => void;
  onAddEnvVar: (event: FormEvent<HTMLFormElement>) => void;
  onAddProvider: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeStatus = check?.status === "test_passed" ? "test_passed" : check?.status === "test_failed" ? "test_failed" : status.configured ? "configured" : "missing";
  const tone = activeStatus === "test_passed" || activeStatus === "configured" ? "pill pill--good" : activeStatus === "test_failed" ? "pill pill--danger" : "pill pill--warn";
  const Icon = status.configured ? CheckCircle2 : AlertTriangle;

  return (
    <article className="spec-frame spec-frame--tight">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="kicker mb-2">{card.kind.replace("_", " ")}</div>
          <h3 className="font-serif text-lg font-semibold text-ink-100">{card.name}</h3>
        </div>
        <span className={tone}>
          <Icon className="h-3.5 w-3.5" />
          {activeStatus.replace("_", " ")}
        </span>
      </div>

      <p className="mt-3 min-h-10 text-sm leading-5 text-ink-400">{card.summary}</p>

      <div className="mt-4 grid gap-2 border-y border-ink-700 py-3">
        <StatusRow label="Provider" ready={status.providerReady} detail={status.providerDetail} />
        <StatusRow label="Key" ready={status.keyReady} detail={status.keyDetail} />
        <StatusRow label="URL/env" ready={status.envReady} detail={status.envDetail} />
      </div>

      <div className="mt-4 rounded-none border border-ink-800 bg-ink-950/40 p-3">
        <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <PlugZap className="h-3.5 w-3.5" /> Generated-work usage
        </div>
        <p className="text-xs leading-5 text-ink-400">{card.generatedWorkHint}</p>
        {status.missing.length > 0 && (
          <p className="mt-2 font-mono text-[11px] text-signal-amber">Missing: {status.missing.join(", ")}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {card.actions.map((action, index) => {
          const actionId = `${card.id}:${index}`;
          return (
            <button
              key={actionId}
              type="button"
              className="btn-ghost"
              disabled={!canManage}
              onClick={() => onAction(actionId)}
            >
              {actionIcon(action)}
              {action.label}
            </button>
          );
        })}
        <button type="button" className="btn-ghost" onClick={onRunCheck}>
          <FlaskConical className="h-3.5 w-3.5" />
          Test
        </button>
      </div>

      {check && (
        <div className="mt-3 font-mono text-[11px] text-ink-500">
          Test status · {check.detail} {relative(check.checkedAt)}
        </div>
      )}

      {card.actions.map((action, index) => {
        const actionId = `${card.id}:${index}`;
        if (openAction !== actionId) return null;
        return (
          <SetupActionForm
            key={actionId}
            card={card}
            action={action}
            actionId={actionId}
            savingEnv={savingEnv}
            savingKey={savingKey}
            savingProvider={savingProvider}
            onAddApiKey={onAddApiKey}
            onAddEnvVar={onAddEnvVar}
            onAddProvider={onAddProvider}
          />
        );
      })}
    </article>
  );
}

function SetupActionForm({
  card,
  action,
  actionId,
  savingEnv,
  savingKey,
  savingProvider,
  onAddApiKey,
  onAddEnvVar,
  onAddProvider,
}: {
  card: IntegrationMarketplaceCard;
  action: IntegrationSetupAction;
  actionId: string;
  savingEnv: string | null;
  savingKey: string | null;
  savingProvider: boolean;
  onAddApiKey: (event: FormEvent<HTMLFormElement>) => void;
  onAddEnvVar: (event: FormEvent<HTMLFormElement>) => void;
  onAddProvider: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (action.kind === "api_key" && action.provider) {
    return (
      <form className="mt-4 grid gap-3 border-t border-ink-700 pt-4" onSubmit={onAddApiKey}>
        <input type="hidden" name="actionId" value={actionId} />
        <input type="hidden" name="provider" value={action.provider} />
        <Field label="LABEL">
          <input name="label" className="workflow-input" defaultValue="default" required />
        </Field>
        <Field label="API KEY">
          <input name="value" type="password" className="workflow-input font-mono" placeholder={action.placeholder ?? "secret"} required />
        </Field>
        <button className="btn-primary justify-center" type="submit" disabled={savingKey === actionId}>
          {savingKey === actionId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          Store key
        </button>
      </form>
    );
  }

  if (action.kind === "provider" && action.providerKind) {
    return (
      <form className="mt-4 grid gap-3 border-t border-ink-700 pt-4" onSubmit={onAddProvider}>
        <Field label="NAME">
          <input name="name" className="workflow-input" defaultValue={card.name} required />
        </Field>
        <input type="hidden" name="kind" value={action.providerKind} />
        <Field label="DEFAULT MODEL">
          <input name="defaultModel" className="workflow-input" placeholder={action.placeholder ?? "model"} required />
        </Field>
        <Field label="BASE URL">
          <input name="baseUrl" className="workflow-input" placeholder="https://api.example.com/v1" />
        </Field>
        <label className="flex items-center gap-2 font-mono text-xs text-ink-300">
          <input name="apiKeyConfigured" type="checkbox" className="h-3.5 w-3.5 accent-signal-amber" />
          KEY CONFIGURED OUTSIDE UI
        </label>
        <button className="btn-primary justify-center" type="submit" disabled={savingProvider}>
          {savingProvider ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
          Save provider
        </button>
      </form>
    );
  }

  return (
    <form className="mt-4 grid gap-3 border-t border-ink-700 pt-4" onSubmit={onAddEnvVar}>
      <input type="hidden" name="actionId" value={actionId} />
      <input type="hidden" name="key" value={action.envKey ?? ""} />
      <input type="hidden" name="scope" value={action.scope ?? "runtime"} />
      <input type="hidden" name="secret" value={action.secret || action.kind === "webhook" ? "on" : ""} />
      <input type="hidden" name="description" value={`${card.name} setup value`} />
      <Field label={action.envKey ?? "ENV KEY"}>
        <input
          name="value"
          type={action.secret || action.kind === "webhook" ? "password" : "text"}
          className="workflow-input font-mono"
          placeholder={action.placeholder ?? "value"}
          required
        />
      </Field>
      <button className="btn-primary justify-center" type="submit" disabled={savingEnv === actionId}>
        {savingEnv === actionId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : actionIcon(action)}
        Save setup
      </button>
    </form>
  );
}

function actionIcon(action: IntegrationSetupAction) {
  if (action.kind === "api_key" || action.kind === "env_secret") return <KeyRound className="h-3.5 w-3.5" />;
  if (action.kind === "webhook") return <Webhook className="h-3.5 w-3.5" />;
  if (action.kind === "env_url") return <LinkIcon className="h-3.5 w-3.5" />;
  return <PlugZap className="h-3.5 w-3.5" />;
}

function StatusRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2 text-xs">
      <span className="font-mono uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className="truncate text-ink-300">{detail}</span>
      <span className={ready ? "pill pill--good" : "pill pill--warn"}>{ready ? "OK" : "Setup"}</span>
    </div>
  );
}

function buildCardStatus(
  card: IntegrationMarketplaceCard,
  providers: ProviderRecord[],
  envVars: WorkspaceEnvVarRecord[],
  apiKeys: MaskedApiKey[],
  readiness: IntegrationReadinessSummary | null,
) {
  const providerRecord = card.providerKind ? providers.find((provider) => provider.kind === card.providerKind) : undefined;
  const providerMissing = card.keyProvider ? readiness?.providers.missingProviderKinds.includes(card.keyProvider) : false;
  const providerReady = card.providerKind ? Boolean(providerRecord) && !providerMissing : true;
  const providerDetail = card.providerKind ? providerRecord?.name ?? "provider record missing" : "not required";
  const externalKeyReady = Boolean(providerRecord?.apiKeyConfigured);
  const storedKeyReady = card.keyProvider ? apiKeys.some((key) => key.provider === card.keyProvider) : true;
  const keyReady = card.keyProvider ? storedKeyReady || externalKeyReady : true;
  const keyDetail = card.keyProvider ? (keyReady ? (storedKeyReady ? "vault key stored" : "external key marked") : "key missing") : "not required";
  const requiredEnvKeys = card.requiredEnvKeys ?? [];
  let missingEnvKeys = requiredEnvKeys.filter((key) => !envVars.some((envVar) => envVar.key === key));
  if (card.id === "email") {
    const emailEnvReady = ["RESEND_API_KEY", "SENDGRID_API_KEY", "POSTMARK_TOKEN", "SMTP_URL"]
      .some((key) => envVars.some((envVar) => envVar.key === key));
    missingEnvKeys = emailEnvReady ? [] : ["RESEND_API_KEY or SENDGRID_API_KEY or POSTMARK_TOKEN or SMTP_URL"];
  }
  const toolReady = card.id === "browser" ? Boolean(readiness?.tools.names.some((name) => name.toLowerCase().includes("browser"))) : true;
  const envReady = missingEnvKeys.length === 0 && toolReady;
  const envDetail = card.id === "browser"
    ? (toolReady ? "browser tool available" : "browser tool missing")
    : requiredEnvKeys.length === 0
      ? "not required"
      : missingEnvKeys.length === 0
        ? `${requiredEnvKeys.length} env ready`
        : missingEnvKeys.join(", ");
  const missing = [
    ...(!providerReady ? ["provider"] : []),
    ...(!keyReady ? ["key"] : []),
    ...missingEnvKeys,
    ...(!toolReady ? ["browser tool"] : []),
  ];

  return {
    configured: providerReady && keyReady && envReady,
    providerReady,
    providerDetail,
    keyReady,
    keyDetail,
    envReady,
    envDetail,
    missing,
  };
}

function ReadinessSummary({ readiness }: { readiness: IntegrationReadinessSummary }) {
  const statusClass = readiness.status === "ready" ? "pill pill--good" : "pill pill--warn";
  return (
    <section className="section-band">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker-amber mb-2">GENERATED PLAN READINESS</div>
          <h2 className="display text-2xl">Tools & provider setup</h2>
        </div>
        <span className={statusClass}>{readiness.status.replace("_", " ")}</span>
      </div>

      <div className="grid gap-px bg-ink-700 md:grid-cols-3">
        <ReadinessMetric label="TOOLS" value={`${readiness.tools.availableCount}`} detail={`${readiness.tools.readCount} read · ${readiness.tools.writeCount} write · ${readiness.tools.execCount} exec`} />
        <ReadinessMetric label="PROVIDERS" value={`${readiness.providers.readyCount}/${readiness.providers.configuredCount}`} detail="ready / configured" />
        <ReadinessMetric label="SETUP GAPS" value={`${readiness.providers.missingApiKeys.length + readiness.tools.missingForGeneratedPlans.length}`} detail={`${readiness.providers.missingProviderKinds.length} provider records`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="kicker mb-2">AVAILABLE TOOLS</div>
          <p className="font-mono text-xs leading-6 text-ink-300">
            {readiness.tools.names.slice(0, 12).join(", ")}
            {readiness.tools.names.length > 12 ? `, +${readiness.tools.names.length - 12} more` : ""}
          </p>
        </div>
        <div>
          <div className="kicker mb-2">RECOMMENDED SETUP</div>
          <ul className="space-y-2">
            {readiness.recommendedSetup.map((item) => (
              <li key={item} className="font-mono text-xs leading-5 text-ink-300">{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ReadinessMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-ink-875 p-4">
      <div className="kicker mb-2">{label}</div>
      <div className="font-serif text-2xl text-ink-100">{value}</div>
      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">{detail}</div>
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
