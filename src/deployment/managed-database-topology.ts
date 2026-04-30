export type ManagedDatabaseTopologyStatus = "pass" | "warn" | "fail";
export type ManagedDatabaseTopologyClassification =
  | "local-json"
  | "single-node-sqlite"
  | "managed-database-requested"
  | "production-blocked"
  | "unsupported-store";

export interface ManagedDatabaseTopologyEnv {
  NODE_ENV?: string;
  TASKLOOM_STORE?: string;
  TASKLOOM_DB_PATH?: string;
  TASKLOOM_MANAGED_DATABASE_URL?: string;
  DATABASE_URL?: string;
  TASKLOOM_DATABASE_URL?: string;
  TASKLOOM_MANAGED_DATABASE_ADAPTER?: string;
  TASKLOOM_DATABASE_TOPOLOGY?: string;
}

export interface ManagedDatabaseTopologyObservedEnvValue {
  configured: boolean;
  value: string | null;
  redacted: boolean;
}

export interface ManagedDatabaseTopologyObservedConfig {
  nodeEnv: string;
  isProductionEnv: boolean;
  store: string;
  dbPath: string | null;
  databaseTopology: string | null;
  managedDatabaseUrl: string | null;
  databaseUrl: string | null;
  taskloomDatabaseUrl: string | null;
  managedDatabaseAdapter?: string | null;
  env: Record<string, ManagedDatabaseTopologyObservedEnvValue>;
}

export interface ManagedDatabaseTopologyCheck {
  id: string;
  status: ManagedDatabaseTopologyStatus;
  summary: string;
}

export interface ManagedDatabaseTopologyReport {
  phase: "45";
  status: ManagedDatabaseTopologyStatus;
  classification: ManagedDatabaseTopologyClassification;
  ready: boolean;
  summary: string;
  checks: ManagedDatabaseTopologyCheck[];
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
  observed: ManagedDatabaseTopologyObservedConfig;
  managedDatabase: {
    requested: boolean;
    configured: boolean;
    supported: false;
    syncStartupSupported?: false;
    phase50?: {
      asyncAdapterConfigured: boolean;
      asyncAdapterAvailable: boolean;
      backfillAvailable: boolean;
      adapter: string | null;
    };
  };
}

export interface ManagedDatabaseTopologyDeps {
  supportedLocalModes?: readonly string[];
}

export interface ManagedDatabaseTopologyInput extends ManagedDatabaseTopologyDeps {
  env?: ManagedDatabaseTopologyEnv;
}

const DEFAULT_SQLITE_PATH = "data/taskloom.sqlite";
const OBSERVED_ENV_KEYS = [
  "NODE_ENV",
  "TASKLOOM_STORE",
  "TASKLOOM_DB_PATH",
  "TASKLOOM_MANAGED_DATABASE_URL",
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
  "TASKLOOM_MANAGED_DATABASE_ADAPTER",
  "TASKLOOM_DATABASE_TOPOLOGY",
] as const;
const LOCAL_TOPOLOGIES = new Set(["", "local", "json", "sqlite", "single-node", "single-node-sqlite"]);
const MANAGED_TOPOLOGY_HINTS = new Set([
  "managed",
  "managed-db",
  "managed-database",
  "postgres",
  "postgresql",
  "mysql",
  "mariadb",
  "database",
]);
const MULTI_WRITER_TOPOLOGY_HINTS = new Set([
  "distributed",
  "multi-host",
  "multi-node",
  "multi-region",
  "multi-writer",
  "production",
  "cluster",
]);
const PHASE_50_MANAGED_DATABASE_ADAPTERS = new Set([
  "postgres",
  "postgresql",
  "managed-postgres",
  "managed-postgresql",
]);
const SECRET_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalize(value: string | undefined): string {
  return clean(value).toLowerCase();
}

function configured(value: string | undefined): boolean {
  return clean(value).length > 0;
}

function observedUrlValue(value: string | undefined): Pick<ManagedDatabaseTopologyObservedEnvValue, "value" | "redacted"> {
  const normalized = clean(value);
  if (!normalized) return { value: null, redacted: false };
  return { value: "[redacted]", redacted: true };
}

function observedPlainValue(value: string | undefined): Pick<ManagedDatabaseTopologyObservedEnvValue, "value" | "redacted"> {
  const normalized = clean(value);
  if (!normalized) return { value: null, redacted: false };
  if (SECRET_URL_PATTERN.test(normalized)) return { value: "[redacted]", redacted: true };
  return { value: normalized, redacted: false };
}

function observedEnvValue(
  key: (typeof OBSERVED_ENV_KEYS)[number],
  value: string | undefined,
): ManagedDatabaseTopologyObservedEnvValue {
  const redacted =
    key === "TASKLOOM_MANAGED_DATABASE_URL" ||
    key === "DATABASE_URL" ||
    key === "TASKLOOM_DATABASE_URL"
      ? observedUrlValue(value)
      : observedPlainValue(value);
  return {
    configured: configured(value),
    ...redacted,
  };
}

function buildObservedEnv(env: ManagedDatabaseTopologyEnv): Record<string, ManagedDatabaseTopologyObservedEnvValue> {
  const observed: Record<string, ManagedDatabaseTopologyObservedEnvValue> = {};
  for (const key of OBSERVED_ENV_KEYS) observed[key] = observedEnvValue(key, env[key]);
  return observed;
}

function pushCheck(
  checks: ManagedDatabaseTopologyCheck[],
  id: string,
  status: ManagedDatabaseTopologyStatus,
  summary: string,
): void {
  checks.push({ id, status, summary });
}

function statusFromChecks(checks: ManagedDatabaseTopologyCheck[]): ManagedDatabaseTopologyStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

function supportedStore(store: string, supportedLocalModes: readonly string[]): boolean {
  return supportedLocalModes.includes(store);
}

function managedDatabaseUrlConfigured(env: ManagedDatabaseTopologyEnv): boolean {
  return (
    configured(env.TASKLOOM_MANAGED_DATABASE_URL) ||
    configured(env.DATABASE_URL) ||
    configured(env.TASKLOOM_DATABASE_URL)
  );
}

function phase50AsyncAdapter(env: ManagedDatabaseTopologyEnv, urlConfigured: boolean) {
  const adapter = normalize(env.TASKLOOM_MANAGED_DATABASE_ADAPTER);
  const asyncAdapterConfigured = adapter.length > 0;
  const asyncAdapterAvailable = urlConfigured && PHASE_50_MANAGED_DATABASE_ADAPTERS.has(adapter);
  return {
    asyncAdapterConfigured,
    asyncAdapterAvailable,
    backfillAvailable: asyncAdapterAvailable,
    adapter: adapter || null,
  };
}

function managedTopologyRequested(topology: string, store: string): boolean {
  return MANAGED_TOPOLOGY_HINTS.has(topology) || MANAGED_TOPOLOGY_HINTS.has(store);
}

function multiWriterTopologyRequested(topology: string): boolean {
  return MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
}

function buildNextSteps(checks: ManagedDatabaseTopologyCheck[]): string[] {
  const steps = new Set<string>();

  for (const check of checks) {
    if (check.status === "pass") continue;
    if (check.id === "managed-database-runtime") {
      steps.add("Keep TASKLOOM_STORE set to json or sqlite for the synchronous app runtime until managed startup is explicitly supported.");
      steps.add("Treat Phase 50 async adapter/backfill evidence separately from synchronous startup support.");
    }
    if (check.id === "production-topology") {
      steps.add("Use this Phase 45 report as advisory evidence only; do not treat local JSON or SQLite as a managed production database topology.");
    }
    if (check.id === "supported-local-mode") {
      steps.add("Set TASKLOOM_STORE=json for local JSON storage or TASKLOOM_STORE=sqlite for single-node SQLite storage.");
    }
    if (check.id === "single-writer-topology") {
      steps.add("Keep SQLite deployments to a single writer node until Taskloom has an implemented managed database runtime.");
    }
  }

  if (steps.size === 0) {
    steps.add("Continue using local JSON for contributor workflows or SQLite for single-node persistence.");
  }

  return Array.from(steps);
}

export function assessManagedDatabaseTopology(
  input: ManagedDatabaseTopologyInput = {},
): ManagedDatabaseTopologyReport {
  const env = input.env ?? {};
  const supportedLocalModes = input.supportedLocalModes ?? ["json", "sqlite"];
  const store = normalize(env.TASKLOOM_STORE) || "json";
  const nodeEnv = normalize(env.NODE_ENV) || "development";
  const isProductionEnv = nodeEnv === "production";
  const databaseTopology = normalize(env.TASKLOOM_DATABASE_TOPOLOGY);
  const hasManagedDatabaseUrl = managedDatabaseUrlConfigured(env);
  const phase50 = phase50AsyncAdapter(env, hasManagedDatabaseUrl);
  const hasManagedIntent = hasManagedDatabaseUrl || managedTopologyRequested(databaseTopology, store);
  const hasMultiWriterIntent = multiWriterTopologyRequested(databaseTopology);
  const isLocalTopology = LOCAL_TOPOLOGIES.has(databaseTopology);
  const checks: ManagedDatabaseTopologyCheck[] = [];
  const warnings: string[] = [];

  if (supportedStore(store, supportedLocalModes)) {
    pushCheck(
      checks,
      "supported-local-mode",
      "pass",
      store === "sqlite"
        ? "TASKLOOM_STORE=sqlite is a supported single-node local storage mode."
        : "TASKLOOM_STORE is using the supported local JSON storage mode.",
    );
  } else {
    pushCheck(
      checks,
      "supported-local-mode",
      "fail",
      MANAGED_TOPOLOGY_HINTS.has(store)
        ? `TASKLOOM_STORE=${store} crosses the synchronous managed database runtime boundary; Phase 50 async adapter availability does not make the sync app startup path supported.`
        : `TASKLOOM_STORE=${store} is not a supported Phase 45 runtime storage mode.`,
    );
  }

  pushCheck(
    checks,
    "managed-database-runtime",
    hasManagedIntent ? "fail" : "pass",
    hasManagedIntent
      ? phase50.asyncAdapterAvailable
        ? "Managed database topology is requested and Phase 50 async adapter/backfill capability is configured, but synchronous app startup remains unsupported."
        : "Managed database topology is requested or configured, but Taskloom's synchronous app runtime still has no supported managed database startup path."
      : "No managed database URL or managed database topology hint was detected.",
  );

  pushCheck(
    checks,
    "single-writer-topology",
    hasMultiWriterIntent ? "fail" : "pass",
    hasMultiWriterIntent
      ? "TASKLOOM_DATABASE_TOPOLOGY requests a production, distributed, or multi-writer posture that local JSON/SQLite cannot provide."
      : "No production, distributed, or multi-writer database topology hint was detected.",
  );

  pushCheck(
    checks,
    "production-topology",
    isProductionEnv && store === "json" ? "fail" : "pass",
    isProductionEnv && store === "json"
      ? "NODE_ENV=production with JSON storage is not a production database topology."
      : isProductionEnv
        ? "NODE_ENV=production is using a supported single-node local storage posture; managed database runtime is required only before multi-writer or managed DB rollout."
        : "NODE_ENV is not production; local JSON/SQLite posture can be reported as advisory-supported.",
  );

  if (databaseTopology && !isLocalTopology && !hasManagedIntent && !hasMultiWriterIntent) {
    warnings.push(`Unknown TASKLOOM_DATABASE_TOPOLOGY value "${databaseTopology}" was observed.`);
  }
  if (store === "sqlite" && !configured(env.TASKLOOM_DB_PATH)) {
    warnings.push(`TASKLOOM_DB_PATH is not set; SQLite will use the default local path ${DEFAULT_SQLITE_PATH}.`);
  }
  if (hasManagedDatabaseUrl) {
    warnings.push("Managed database URLs are captured as redacted evidence; they do not enable the synchronous app runtime.");
  }
  if (phase50.asyncAdapterAvailable) {
    warnings.push("Phase 50 async managed adapter/backfill capability is available for handoff evidence, but synchronous startup support remains false.");
  } else if (phase50.asyncAdapterConfigured) {
    warnings.push("TASKLOOM_MANAGED_DATABASE_ADAPTER is configured, but Phase 50 adapter availability also requires a recognized postgres adapter value and managed database URL.");
  }

  const status = statusFromChecks(checks);
  const blockers = checks.filter((check) => check.status === "fail").map((check) => check.summary);
  let classification: ManagedDatabaseTopologyClassification;
  if (hasManagedIntent) {
    classification = "managed-database-requested";
  } else if ((isProductionEnv && store === "json") || hasMultiWriterIntent) {
    classification = "production-blocked";
  } else if (!supportedStore(store, supportedLocalModes)) {
    classification = "unsupported-store";
  } else {
    classification = store === "sqlite" ? "single-node-sqlite" : "local-json";
  }

  const ready = blockers.length === 0;
  const summary = ready
    ? store === "sqlite"
      ? "Phase 45 managed database topology report found supported single-node SQLite posture and no managed database request."
      : "Phase 45 managed database topology report found supported local JSON posture and no managed database request."
    : hasManagedIntent
      ? phase50.asyncAdapterAvailable
        ? "Phase 45 managed database topology report found Phase 50 async adapter/backfill availability, while synchronous managed database startup remains unsupported."
        : "Phase 45 managed database topology report found a managed database runtime boundary; synchronous managed database startup is not supported."
      : "Phase 45 managed database topology report found blockers for managed production database readiness.";
  const observedEnv = buildObservedEnv(env);

  return {
    phase: "45",
    status,
    classification,
    ready,
    summary,
    checks,
    blockers,
    warnings,
    nextSteps: buildNextSteps(checks),
    observed: {
      nodeEnv,
      isProductionEnv,
      store,
      dbPath: store === "sqlite" ? clean(env.TASKLOOM_DB_PATH) || DEFAULT_SQLITE_PATH : null,
      databaseTopology: databaseTopology || null,
      managedDatabaseUrl: observedEnv.TASKLOOM_MANAGED_DATABASE_URL.value,
      databaseUrl: observedEnv.DATABASE_URL.value,
      taskloomDatabaseUrl: observedEnv.TASKLOOM_DATABASE_URL.value,
      managedDatabaseAdapter: phase50.adapter,
      env: observedEnv,
    },
    managedDatabase: {
      requested: hasManagedIntent || hasMultiWriterIntent,
      configured: hasManagedDatabaseUrl,
      supported: false,
      syncStartupSupported: false,
      phase50,
    },
  };
}

export function buildManagedDatabaseTopologyReport(
  env: ManagedDatabaseTopologyEnv = {},
  deps: ManagedDatabaseTopologyDeps = {},
): ManagedDatabaseTopologyReport {
  return assessManagedDatabaseTopology({ env, ...deps });
}
