export type ManagedDatabaseTopologyStatus = "pass" | "warn" | "fail";
export type ManagedDatabaseTopologyClassification =
  | "local-json"
  | "single-node-sqlite"
  | "managed-postgres"
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
  TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER?: string;
  TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL?: string;
  TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN?: string;
  TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN?: string;
  TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN?: string;
  TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN?: string;
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
    supported: boolean;
    syncStartupSupported?: boolean;
    phase50?: {
      asyncAdapterConfigured: boolean;
      asyncAdapterAvailable: boolean;
      backfillAvailable: boolean;
      adapter: string | null;
    };
    phase52?: {
      managedPostgresStartupSupported: boolean;
      strictBlocker: boolean;
      summary: string;
    };
    phase53?: {
      multiWriterTopologyRequested: boolean;
      requirementsEvidenceConfigured: boolean;
      designEvidenceConfigured: boolean;
      requirementsDesignGatePassed: boolean;
      runtimeSupport: false;
      strictBlocker: boolean;
      summary: string;
    };
    phase54?: {
      multiWriterTopologyRequested: boolean;
      topologyOwnerConfigured: boolean;
      consistencyModelConfigured: boolean;
      failoverPitrPlanConfigured: boolean;
      migrationBackfillPlanConfigured: boolean;
      observabilityPlanConfigured: boolean;
      rollbackPlanConfigured: boolean;
      designPackageGatePassed: boolean;
      runtimeSupport: false;
      strictBlocker: boolean;
      summary: string;
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
  "TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER",
  "TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL",
  "TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN",
  "TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN",
  "TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN",
  "TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN",
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
  "active-active",
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
const PHASE_52_MANAGED_POSTGRES_STORES = new Set(["managed", "postgres", "postgresql"]);
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

function managedStoreRequested(store: string): boolean {
  return PHASE_52_MANAGED_POSTGRES_STORES.has(store);
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

function phase52ManagedPostgresStartupSupport(
  phase50: ReturnType<typeof phase50AsyncAdapter>,
  hasMultiWriterIntent: boolean,
) {
  const managedPostgresStartupSupported = phase50.asyncAdapterAvailable && !hasMultiWriterIntent;
  const strictBlocker = !managedPostgresStartupSupported;
  const summary = hasMultiWriterIntent
    ? "Phase 52 managed Postgres startup support is not asserted for multi-writer, distributed, or active-active topology."
    : managedPostgresStartupSupported
      ? "Phase 52 managed Postgres startup support is asserted separately from Phase 50 adapter/backfill evidence; Phase 51 call-site migration is complete for startup."
      : "Phase 52 managed Postgres startup support requires a managed database URL and recognized Phase 50 Postgres adapter.";

  return {
    managedPostgresStartupSupported,
    strictBlocker,
    summary,
  };
}

function phase53MultiWriterTopologyGate(env: ManagedDatabaseTopologyEnv, hasMultiWriterIntent: boolean) {
  const requirementsEvidenceConfigured = configured(env.TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE);
  const designEvidenceConfigured = configured(env.TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE);
  const requirementsDesignGatePassed =
    !hasMultiWriterIntent || (requirementsEvidenceConfigured && designEvidenceConfigured);
  const strictBlocker = hasMultiWriterIntent && !requirementsDesignGatePassed;
  const summary = hasMultiWriterIntent
    ? requirementsDesignGatePassed
      ? "Phase 53 multi-writer topology requirements and design evidence are configured; runtime support remains blocked."
      : "Phase 53 requires explicit multi-writer requirements and design evidence before topology design can proceed."
    : "No multi-writer, distributed, or active-active topology requested for Phase 53.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    requirementsEvidenceConfigured,
    designEvidenceConfigured,
    requirementsDesignGatePassed,
    runtimeSupport: false as const,
    strictBlocker,
    summary,
  };
}

function phase54MultiWriterTopologyDesignPackageGate(
  env: ManagedDatabaseTopologyEnv,
  hasMultiWriterIntent: boolean,
) {
  const topologyOwnerConfigured = configured(env.TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER);
  const consistencyModelConfigured = configured(env.TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL);
  const failoverPitrPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN);
  const migrationBackfillPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN);
  const observabilityPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN);
  const rollbackPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN);
  const designPackageGatePassed =
    !hasMultiWriterIntent ||
    (topologyOwnerConfigured &&
      consistencyModelConfigured &&
      failoverPitrPlanConfigured &&
      migrationBackfillPlanConfigured &&
      observabilityPlanConfigured &&
      rollbackPlanConfigured);
  const strictBlocker = hasMultiWriterIntent && !designPackageGatePassed;
  const summary = hasMultiWriterIntent
    ? designPackageGatePassed
      ? "Phase 54 multi-writer topology design package is complete; runtime support remains blocked."
      : "Phase 54 requires topology owner, consistency model, failover/PITR plan, migration/backfill plan, observability plan, and rollback plan evidence before multi-writer topology can proceed."
    : "No multi-writer, distributed, or active-active topology requested for Phase 54.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    topologyOwnerConfigured,
    consistencyModelConfigured,
    failoverPitrPlanConfigured,
    migrationBackfillPlanConfigured,
    observabilityPlanConfigured,
    rollbackPlanConfigured,
    designPackageGatePassed,
    runtimeSupport: false as const,
    strictBlocker,
    summary,
  };
}

function managedTopologyRequested(topology: string, store: string): boolean {
  return MANAGED_TOPOLOGY_HINTS.has(topology) || MANAGED_TOPOLOGY_HINTS.has(store);
}

function multiWriterTopologyRequested(topology: string): boolean {
  return MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
}

function buildNextSteps(
  checks: ManagedDatabaseTopologyCheck[],
  phase53: ReturnType<typeof phase53MultiWriterTopologyGate>,
  phase54: ReturnType<typeof phase54MultiWriterTopologyDesignPackageGate>,
): string[] {
  const steps = new Set<string>();

  for (const check of checks) {
    if (check.status === "pass") continue;
    if (check.id === "managed-database-runtime") {
      steps.add("Configure TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres with a managed database URL before enabling managed Postgres startup.");
    }
    if (check.id === "production-topology") {
      steps.add("Use this Phase 45 report as advisory evidence only; do not treat local JSON or SQLite as a managed production database topology.");
    }
    if (check.id === "supported-local-mode") {
      steps.add("Set TASKLOOM_STORE=json for local JSON storage or TASKLOOM_STORE=sqlite for single-node SQLite storage.");
    }
    if (check.id === "single-writer-topology") {
      steps.add("Keep managed Postgres, JSON, or SQLite deployments to a single writer node until multi-writer runtime support exists.");
    }
    if (check.id === "phase53-multi-writer-design") {
      if (!phase53.requirementsEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE with the approved multi-writer topology requirements reference.");
      }
      if (!phase53.designEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE with the approved multi-writer topology design reference.");
      }
    }
    if (check.id === "phase54-multi-writer-design-package") {
      if (!phase54.topologyOwnerConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER with the accountable multi-writer topology owner.");
      }
      if (!phase54.consistencyModelConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL with the approved consistency model evidence.");
      }
      if (!phase54.failoverPitrPlanConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN with the failover and PITR plan evidence.");
      }
      if (!phase54.migrationBackfillPlanConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN with the migration and backfill plan evidence.");
      }
      if (!phase54.observabilityPlanConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN with the observability plan evidence.");
      }
      if (!phase54.rollbackPlanConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN with the rollback plan evidence.");
      }
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
  const phase52 = phase52ManagedPostgresStartupSupport(phase50, hasMultiWriterIntent);
  const phase53 = phase53MultiWriterTopologyGate(env, hasMultiWriterIntent);
  const phase54 = phase54MultiWriterTopologyDesignPackageGate(env, hasMultiWriterIntent);
  const hasManagedPostgresStartupSupport = phase52.managedPostgresStartupSupported;
  const isLocalTopology = LOCAL_TOPOLOGIES.has(databaseTopology);
  const checks: ManagedDatabaseTopologyCheck[] = [];
  const warnings: string[] = [];

  if (supportedStore(store, supportedLocalModes) || (managedStoreRequested(store) && hasManagedPostgresStartupSupport)) {
    pushCheck(
      checks,
      "supported-local-mode",
      "pass",
      managedStoreRequested(store)
        ? `TASKLOOM_STORE=${store} is allowed by Phase 52 managed Postgres startup support.`
        : store === "sqlite"
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
    hasManagedIntent && !hasManagedPostgresStartupSupport ? "fail" : "pass",
    hasManagedIntent
      ? hasManagedPostgresStartupSupport
        ? "Managed database topology is allowed by Phase 52 startup support; Phase 50 Postgres adapter is configured and Phase 51 migration is complete."
        : phase52.summary
      : "No managed database URL or managed database topology hint was detected.",
  );

  pushCheck(
    checks,
    "single-writer-topology",
    hasMultiWriterIntent ? "fail" : "pass",
    hasMultiWriterIntent
      ? "TASKLOOM_DATABASE_TOPOLOGY requests a production, distributed, active-active, or multi-writer posture that is not supported."
      : "No production, distributed, active-active, or multi-writer database topology hint was detected.",
  );

  pushCheck(
    checks,
    "phase53-multi-writer-design",
    phase53.strictBlocker ? "fail" : "pass",
    phase53.summary,
  );

  pushCheck(
    checks,
    "phase54-multi-writer-design-package",
    phase54.strictBlocker ? "fail" : "pass",
    phase54.summary,
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
    warnings.push(
      hasManagedPostgresStartupSupport
        ? "Managed database URLs are captured as redacted evidence; Phase 52 allows them only for single-writer managed Postgres startup."
        : "Managed database URLs are captured as redacted evidence and require Phase 52 managed Postgres startup support.",
    );
  }
  if (phase50.asyncAdapterAvailable) {
    warnings.push("Phase 50 async managed adapter/backfill capability is available; Phase 52 separately reports startup support.");
  } else if (phase50.asyncAdapterConfigured) {
    warnings.push("TASKLOOM_MANAGED_DATABASE_ADAPTER is configured, but Phase 50 adapter availability also requires a recognized postgres adapter value and managed database URL.");
  }
  if (hasManagedIntent) {
    warnings.push(phase52.summary);
  }
  if (hasMultiWriterIntent) {
    warnings.push(phase53.summary);
    warnings.push(phase54.summary);
  }

  const status = statusFromChecks(checks);
  const blockers = checks.filter((check) => check.status === "fail").map((check) => check.summary);
  let classification: ManagedDatabaseTopologyClassification;
  if (hasManagedIntent && hasManagedPostgresStartupSupport) {
    classification = "managed-postgres";
  } else if (hasManagedIntent) {
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
    ? hasManagedIntent && hasManagedPostgresStartupSupport
      ? "Phase 52 managed database topology report found single-writer managed Postgres startup support."
      : store === "sqlite"
      ? "Phase 45 managed database topology report found supported single-node SQLite posture and no managed database request."
      : "Phase 45 managed database topology report found supported local JSON posture and no managed database request."
    : hasManagedIntent
      ? "Phase 45 managed database topology report found a managed database runtime boundary; Phase 52 managed Postgres startup support is not available."
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
    nextSteps: buildNextSteps(checks, phase53, phase54),
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
      supported: hasManagedPostgresStartupSupport,
      syncStartupSupported: hasManagedPostgresStartupSupport,
      phase50,
      phase52,
      phase53,
      phase54,
    },
  };
}

export function buildManagedDatabaseTopologyReport(
  env: ManagedDatabaseTopologyEnv = {},
  deps: ManagedDatabaseTopologyDeps = {},
): ManagedDatabaseTopologyReport {
  return assessManagedDatabaseTopology({ env, ...deps });
}
