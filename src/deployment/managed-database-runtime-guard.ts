export type ManagedDatabaseRuntimeGuardStatus = "pass" | "warn" | "fail";
export type ManagedDatabaseRuntimeGuardClassification =
  | "local-json"
  | "single-node-sqlite"
  | "managed-database-blocked"
  | "multi-writer-blocked"
  | "unsupported-store"
  | "bypassed";

export interface ManagedDatabaseRuntimeGuardEnv {
  NODE_ENV?: string;
  TASKLOOM_STORE?: string;
  TASKLOOM_DB_PATH?: string;
  TASKLOOM_MANAGED_DATABASE_URL?: string;
  DATABASE_URL?: string;
  TASKLOOM_DATABASE_URL?: string;
  TASKLOOM_MANAGED_DATABASE_ADAPTER?: string;
  TASKLOOM_DATABASE_TOPOLOGY?: string;
  TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS?: string;
}

export interface ManagedDatabaseRuntimeGuardObservedEnvValue {
  configured: boolean;
  value: string | null;
  redacted: boolean;
}

export interface ManagedDatabaseRuntimeGuardObservedConfig {
  nodeEnv: string;
  store: string;
  dbPath: string | null;
  databaseTopology: string | null;
  bypassEnabled: boolean;
  managedDatabaseUrl: string | null;
  databaseUrl: string | null;
  taskloomDatabaseUrl: string | null;
  managedDatabaseAdapter?: string | null;
  env: Record<string, ManagedDatabaseRuntimeGuardObservedEnvValue>;
}

export interface ManagedDatabaseRuntimeGuardCheck {
  id: string;
  status: ManagedDatabaseRuntimeGuardStatus;
  summary: string;
}

export interface ManagedDatabaseRuntimeGuardReport {
  phase: "46";
  allowed: boolean;
  managedDatabaseRuntimeBlocked?: boolean;
  status: ManagedDatabaseRuntimeGuardStatus;
  classification: ManagedDatabaseRuntimeGuardClassification;
  summary: string;
  checks: ManagedDatabaseRuntimeGuardCheck[];
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
  observed: ManagedDatabaseRuntimeGuardObservedConfig;
  phase50?: {
    asyncAdapterConfigured: boolean;
    asyncAdapterAvailable: boolean;
    backfillAvailable: boolean;
    adapter: string | null;
    syncStartupSupported: false;
  };
}

export interface ManagedDatabaseRuntimeGuardDeps {
  supportedLocalModes?: readonly string[];
}

export interface ManagedDatabaseRuntimeGuardInput extends ManagedDatabaseRuntimeGuardDeps {
  env?: ManagedDatabaseRuntimeGuardEnv;
}

export class ManagedDatabaseRuntimeGuardError extends Error {
  constructor(readonly report: ManagedDatabaseRuntimeGuardReport) {
    super(report.summary);
    this.name = "ManagedDatabaseRuntimeGuardError";
  }
}

const DEFAULT_SQLITE_PATH = "data/taskloom.sqlite";
const BYPASS_ENV_KEY = "TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS";
const OBSERVED_ENV_KEYS = [
  "NODE_ENV",
  "TASKLOOM_STORE",
  "TASKLOOM_DB_PATH",
  "TASKLOOM_MANAGED_DATABASE_URL",
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
  "TASKLOOM_MANAGED_DATABASE_ADAPTER",
  "TASKLOOM_DATABASE_TOPOLOGY",
  BYPASS_ENV_KEY,
] as const;
const LOCAL_TOPOLOGIES = new Set(["", "local", "json", "sqlite", "single-node", "single-node-sqlite"]);
const MANAGED_TOPOLOGY_HINTS = new Set([
  "managed",
  "managed-db",
  "managed-database",
  "postgres",
  "postgresql",
]);
const MULTI_WRITER_TOPOLOGY_HINTS = new Set([
  "active-active",
  "distributed",
  "multi-region",
  "multi-writer",
]);
const PHASE_50_MANAGED_DATABASE_ADAPTERS = new Set([
  "postgres",
  "postgresql",
  "managed-postgres",
  "managed-postgresql",
]);
const URL_LIKE_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalize(value: string | undefined): string {
  return clean(value).toLowerCase();
}

function configured(value: string | undefined): boolean {
  return clean(value).length > 0;
}

function redactedValue(key: string, value: string | undefined): Pick<ManagedDatabaseRuntimeGuardObservedEnvValue, "value" | "redacted"> {
  const normalized = clean(value);
  if (!normalized) return { value: null, redacted: false };
  if (
    key === "TASKLOOM_MANAGED_DATABASE_URL" ||
    key === "DATABASE_URL" ||
    key === "TASKLOOM_DATABASE_URL" ||
    URL_LIKE_PATTERN.test(normalized)
  ) {
    return { value: "[redacted]", redacted: true };
  }
  return { value: normalized, redacted: false };
}

function observedEnvValue(
  key: (typeof OBSERVED_ENV_KEYS)[number],
  value: string | undefined,
): ManagedDatabaseRuntimeGuardObservedEnvValue {
  return {
    configured: configured(value),
    ...redactedValue(key, value),
  };
}

function buildObservedEnv(
  env: ManagedDatabaseRuntimeGuardEnv,
): Record<string, ManagedDatabaseRuntimeGuardObservedEnvValue> {
  const observed: Record<string, ManagedDatabaseRuntimeGuardObservedEnvValue> = {};
  for (const key of OBSERVED_ENV_KEYS) observed[key] = observedEnvValue(key, env[key]);
  return observed;
}

function pushCheck(
  checks: ManagedDatabaseRuntimeGuardCheck[],
  id: string,
  status: ManagedDatabaseRuntimeGuardStatus,
  summary: string,
): void {
  checks.push({ id, status, summary });
}

function statusFromChecks(
  checks: ManagedDatabaseRuntimeGuardCheck[],
  bypassEnabled: boolean,
): ManagedDatabaseRuntimeGuardStatus {
  if (checks.some((check) => check.status === "fail")) return bypassEnabled ? "warn" : "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

function managedDatabaseUrlConfigured(env: ManagedDatabaseRuntimeGuardEnv): boolean {
  return (
    configured(env.TASKLOOM_MANAGED_DATABASE_URL) ||
    configured(env.DATABASE_URL) ||
    configured(env.TASKLOOM_DATABASE_URL)
  );
}

function phase50AsyncAdapter(env: ManagedDatabaseRuntimeGuardEnv, urlConfigured: boolean) {
  const adapter = normalize(env.TASKLOOM_MANAGED_DATABASE_ADAPTER);
  const asyncAdapterConfigured = adapter.length > 0;
  const asyncAdapterAvailable = urlConfigured && PHASE_50_MANAGED_DATABASE_ADAPTERS.has(adapter);
  return {
    asyncAdapterConfigured,
    asyncAdapterAvailable,
    backfillAvailable: asyncAdapterAvailable,
    adapter: adapter || null,
    syncStartupSupported: false as const,
  };
}

function managedTopologyRequested(topology: string, store: string): boolean {
  return MANAGED_TOPOLOGY_HINTS.has(topology) || MANAGED_TOPOLOGY_HINTS.has(store);
}

function multiWriterTopologyRequested(topology: string): boolean {
  return MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
}

function supportedStore(store: string, supportedLocalModes: readonly string[]): boolean {
  return supportedLocalModes.includes(store);
}

function buildNextSteps(checks: ManagedDatabaseRuntimeGuardCheck[], bypassEnabled: boolean): string[] {
  const steps = new Set<string>();

  for (const check of checks) {
    if (check.status === "pass") continue;
    if (check.id === "supported-runtime-store") {
      steps.add("Set TASKLOOM_STORE=json for local JSON storage or TASKLOOM_STORE=sqlite for single-node SQLite storage.");
    }
    if (check.id === "managed-database-runtime") {
      steps.add("Do not use managed database URL environment variables as synchronous app startup configuration.");
      steps.add("Treat Phase 50 async adapter/backfill evidence separately from synchronous startup support.");
    }
    if (check.id === "single-writer-runtime") {
      steps.add("Keep Taskloom on local JSON or single-node SQLite until multi-writer runtime support exists.");
    }
  }

  if (bypassEnabled) {
    steps.add(`Unset ${BYPASS_ENV_KEY} after emergency or development-only validation is complete.`);
  }
  if (steps.size === 0) {
    steps.add("Continue using local JSON for contributor workflows or SQLite for single-node persistence.");
  }

  return Array.from(steps);
}

export function assessManagedDatabaseRuntimeGuard(
  input: ManagedDatabaseRuntimeGuardInput = {},
): ManagedDatabaseRuntimeGuardReport {
  const env = input.env ?? {};
  const supportedLocalModes = input.supportedLocalModes ?? ["json", "sqlite"];
  const store = normalize(env.TASKLOOM_STORE) || "json";
  const nodeEnv = normalize(env.NODE_ENV) || "development";
  const databaseTopology = normalize(env.TASKLOOM_DATABASE_TOPOLOGY);
  const bypassEnabled = normalize(env.TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS) === "true";
  const hasManagedDatabaseUrl = managedDatabaseUrlConfigured(env);
  const phase50 = phase50AsyncAdapter(env, hasManagedDatabaseUrl);
  const hasManagedIntent = hasManagedDatabaseUrl || managedTopologyRequested(databaseTopology, store);
  const hasMultiWriterIntent = multiWriterTopologyRequested(databaseTopology);
  const isLocalTopology = LOCAL_TOPOLOGIES.has(databaseTopology);
  const checks: ManagedDatabaseRuntimeGuardCheck[] = [];
  const warnings: string[] = [];

  if (supportedStore(store, supportedLocalModes)) {
    pushCheck(
      checks,
      "supported-runtime-store",
      "pass",
      store === "sqlite"
        ? "TASKLOOM_STORE=sqlite is supported only for single-node SQLite runtime."
        : "TASKLOOM_STORE is using the supported local JSON runtime.",
    );
  } else {
    pushCheck(
      checks,
      "supported-runtime-store",
      "fail",
      MANAGED_TOPOLOGY_HINTS.has(store)
        ? `TASKLOOM_STORE=${store} crosses the synchronous managed database runtime boundary; Phase 50 async adapter availability does not make the sync app startup path supported.`
        : `TASKLOOM_STORE=${store} is not a supported Phase 46 runtime storage mode.`,
    );
  }

  pushCheck(
    checks,
    "managed-database-runtime",
    hasManagedIntent ? "fail" : "pass",
    hasManagedIntent
      ? phase50.asyncAdapterAvailable
        ? "Managed database runtime intent was detected and Phase 50 async adapter/backfill capability is configured, but synchronous app startup remains blocked."
        : "Managed database runtime intent was detected, but Taskloom's synchronous app runtime still has no supported managed database startup path."
      : "No managed database URL or managed database runtime hint was detected.",
  );

  pushCheck(
    checks,
    "single-writer-runtime",
    hasMultiWriterIntent ? "fail" : "pass",
    hasMultiWriterIntent
      ? "TASKLOOM_DATABASE_TOPOLOGY requests multi-writer, multi-region, active-active, or distributed runtime behavior that is not supported."
      : "No multi-writer, multi-region, active-active, or distributed runtime hint was detected.",
  );

  if (databaseTopology && !isLocalTopology && !hasManagedIntent && !hasMultiWriterIntent) {
    warnings.push(`Unknown TASKLOOM_DATABASE_TOPOLOGY value "${databaseTopology}" was observed.`);
  }
  if (store === "sqlite" && !configured(env.TASKLOOM_DB_PATH)) {
    warnings.push(`TASKLOOM_DB_PATH is not set; SQLite will use the default local path ${DEFAULT_SQLITE_PATH}.`);
  }
  if (hasManagedDatabaseUrl) {
    warnings.push("Managed database URL values were redacted and are blocked as synchronous app startup configuration.");
  }
  if (phase50.asyncAdapterAvailable) {
    warnings.push("Phase 50 async managed adapter/backfill capability is available for evidence, but the synchronous app runtime remains blocked for managed startup.");
  } else if (phase50.asyncAdapterConfigured) {
    warnings.push("TASKLOOM_MANAGED_DATABASE_ADAPTER is configured, but Phase 50 adapter availability also requires a recognized postgres adapter value and managed database URL.");
  }
  if (bypassEnabled) {
    warnings.push(`${BYPASS_ENV_KEY}=true bypassed the managed database runtime guard for emergency or development-only use.`);
  }

  const blockers = checks.filter((check) => check.status === "fail").map((check) => check.summary);
  const managedDatabaseRuntimeBlocked = hasManagedIntent || hasMultiWriterIntent;
  const allowed = blockers.length === 0 || bypassEnabled;
  const status = statusFromChecks(checks, bypassEnabled);
  let classification: ManagedDatabaseRuntimeGuardClassification;
  if (bypassEnabled) {
    classification = "bypassed";
  } else if (hasMultiWriterIntent) {
    classification = "multi-writer-blocked";
  } else if (hasManagedIntent) {
    classification = "managed-database-blocked";
  } else if (!supportedStore(store, supportedLocalModes)) {
    classification = "unsupported-store";
  } else {
    classification = store === "sqlite" ? "single-node-sqlite" : "local-json";
  }

  const summary = allowed
    ? bypassEnabled
      ? "Phase 46 managed database runtime guard was bypassed; unsupported runtime configuration remains present."
      : store === "sqlite"
        ? "Phase 46 managed database runtime guard allows supported single-node SQLite runtime."
        : "Phase 46 managed database runtime guard allows supported local JSON runtime."
    : "Phase 46 managed database runtime guard blocked unsupported managed database or multi-writer runtime configuration.";
  const observedEnv = buildObservedEnv(env);

  return {
    phase: "46",
    allowed,
    managedDatabaseRuntimeBlocked,
    status,
    classification,
    summary,
    checks,
    blockers,
    warnings,
    nextSteps: buildNextSteps(checks, bypassEnabled),
    observed: {
      nodeEnv,
      store,
      dbPath: store === "sqlite" ? clean(env.TASKLOOM_DB_PATH) || DEFAULT_SQLITE_PATH : null,
      databaseTopology: databaseTopology || null,
      bypassEnabled,
      managedDatabaseUrl: observedEnv.TASKLOOM_MANAGED_DATABASE_URL.value,
      databaseUrl: observedEnv.DATABASE_URL.value,
      taskloomDatabaseUrl: observedEnv.TASKLOOM_DATABASE_URL.value,
      managedDatabaseAdapter: phase50.adapter,
      env: observedEnv,
    },
    phase50,
  };
}

export function buildManagedDatabaseRuntimeGuardReport(
  env: ManagedDatabaseRuntimeGuardEnv = {},
  deps: ManagedDatabaseRuntimeGuardDeps = {},
): ManagedDatabaseRuntimeGuardReport {
  return assessManagedDatabaseRuntimeGuard({ env, ...deps });
}

export function assertManagedDatabaseRuntimeSupported(
  env: ManagedDatabaseRuntimeGuardEnv = {},
  deps: ManagedDatabaseRuntimeGuardDeps = {},
): ManagedDatabaseRuntimeGuardReport {
  const report = buildManagedDatabaseRuntimeGuardReport(env, deps);
  if (!report.allowed) throw new ManagedDatabaseRuntimeGuardError(report);
  return report;
}
