export type ManagedDatabaseRuntimeGuardStatus = "pass" | "warn" | "fail";
export type ManagedDatabaseRuntimeGuardClassification =
  | "local-json"
  | "single-node-sqlite"
  | "managed-postgres"
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
  TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER?: string;
  TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL?: string;
  TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN?: string;
  TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN?: string;
  TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN?: string;
  TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN?: string;
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

export interface ManagedDatabaseRuntimeCallSiteMigrationInput {
  remainingSyncCallSiteGroups?: readonly string[];
  managedPostgresStartupSupported?: boolean;
}

export interface ManagedDatabaseRuntimeCallSiteMigrationReport {
  phase: "51";
  tracked: true;
  runtimeCallSitesMigrated: boolean;
  remainingSyncCallSiteGroups: string[];
  managedPostgresStartupSupported: boolean;
  strictBlocker: boolean;
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
  phase51?: ManagedDatabaseRuntimeCallSiteMigrationReport;
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
}

export interface ManagedDatabaseRuntimeGuardDeps {
  supportedLocalModes?: readonly string[];
  phase51?: ManagedDatabaseRuntimeCallSiteMigrationInput;
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
  "TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER",
  "TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL",
  "TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN",
  "TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN",
  "TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN",
  "TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN",
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
const DEFAULT_PHASE_51_REMAINING_SYNC_CALL_SITE_GROUPS: string[] = [];
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

function phase51RuntimeCallSiteMigration(
  input: ManagedDatabaseRuntimeCallSiteMigrationInput | undefined,
): ManagedDatabaseRuntimeCallSiteMigrationReport {
  const remainingSyncCallSiteGroups = Array.from(
    input?.remainingSyncCallSiteGroups ?? DEFAULT_PHASE_51_REMAINING_SYNC_CALL_SITE_GROUPS,
  );
  const runtimeCallSitesMigrated = remainingSyncCallSiteGroups.length === 0;
  const managedPostgresStartupSupported =
    runtimeCallSitesMigrated && input?.managedPostgresStartupSupported === true;
  const strictBlocker = !runtimeCallSitesMigrated;
  const summary = managedPostgresStartupSupported
    ? "Phase 51 runtime call-site migration is complete and includes legacy managed Postgres startup support evidence; Phase 52 separately asserts current startup support."
    : runtimeCallSitesMigrated
      ? "Phase 51 runtime call-site migration is complete; Phase 52 separately decides managed Postgres startup support."
      : `Phase 51 runtime call-site migration is incomplete; ${remainingSyncCallSiteGroups.length} sync call-site group(s) still block managed Postgres startup.`;

  return {
    phase: "51",
    tracked: true,
    runtimeCallSitesMigrated,
    remainingSyncCallSiteGroups,
    managedPostgresStartupSupported,
    strictBlocker,
    summary,
  };
}

function phase52ManagedPostgresStartupSupport(
  phase50: ReturnType<typeof phase50AsyncAdapter>,
  phase51: ManagedDatabaseRuntimeCallSiteMigrationReport,
  hasMultiWriterIntent: boolean,
) {
  const managedPostgresStartupSupported =
    phase50.asyncAdapterAvailable && phase51.runtimeCallSitesMigrated && !hasMultiWriterIntent;
  const strictBlocker = !managedPostgresStartupSupported;
  const summary = hasMultiWriterIntent
    ? "Phase 52 managed Postgres startup support is not asserted for multi-writer, distributed, or active-active topology."
    : managedPostgresStartupSupported
      ? "Phase 52 managed Postgres startup support is asserted because the Phase 50 Postgres adapter is configured and Phase 51 runtime call-site migration is complete."
      : phase50.asyncAdapterAvailable
        ? "Phase 52 managed Postgres startup support is blocked until Phase 51 runtime call-site migration is complete."
        : "Phase 52 managed Postgres startup support requires a managed database URL and recognized Phase 50 Postgres adapter.";

  return {
    managedPostgresStartupSupported,
    strictBlocker,
    summary,
  };
}

function phase53MultiWriterTopologyGate(env: ManagedDatabaseRuntimeGuardEnv, hasMultiWriterIntent: boolean) {
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
  env: ManagedDatabaseRuntimeGuardEnv,
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

function supportedStore(store: string, supportedLocalModes: readonly string[]): boolean {
  return supportedLocalModes.includes(store);
}

function managedStoreRequested(store: string): boolean {
  return MANAGED_TOPOLOGY_HINTS.has(store);
}

function buildNextSteps(
  checks: ManagedDatabaseRuntimeGuardCheck[],
  bypassEnabled: boolean,
  phase51: ManagedDatabaseRuntimeCallSiteMigrationReport,
  phase52: ReturnType<typeof phase52ManagedPostgresStartupSupport>,
  phase53: ReturnType<typeof phase53MultiWriterTopologyGate>,
  phase54: ReturnType<typeof phase54MultiWriterTopologyDesignPackageGate>,
): string[] {
  const steps = new Set<string>();

  for (const check of checks) {
    if (check.status === "pass") continue;
    if (check.id === "supported-runtime-store") {
      steps.add("Set TASKLOOM_STORE=json for local JSON storage or TASKLOOM_STORE=sqlite for single-node SQLite storage.");
    }
    if (check.id === "managed-database-runtime") {
      if (!phase52.managedPostgresStartupSupported) {
        steps.add("Configure TASKLOOM_MANAGED_DATABASE_ADAPTER=postgres with a managed database URL before enabling managed Postgres startup.");
      }
      if (!phase51.runtimeCallSitesMigrated) {
        steps.add("Finish Phase 51 runtime call-site migration before managed/Postgres hints become startup configuration.");
      }
    }
    if (check.id === "single-writer-runtime") {
      steps.add("Keep Taskloom on local JSON or single-node SQLite until multi-writer runtime support exists.");
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
  const phase51 = phase51RuntimeCallSiteMigration(input.phase51);
  const hasManagedIntent = hasManagedDatabaseUrl || managedTopologyRequested(databaseTopology, store);
  const hasMultiWriterIntent = multiWriterTopologyRequested(databaseTopology);
  const phase52 = phase52ManagedPostgresStartupSupport(phase50, phase51, hasMultiWriterIntent);
  const phase53 = phase53MultiWriterTopologyGate(env, hasMultiWriterIntent);
  const phase54 = phase54MultiWriterTopologyDesignPackageGate(env, hasMultiWriterIntent);
  const hasManagedPostgresStartupSupport = phase52.managedPostgresStartupSupported;
  const isLocalTopology = LOCAL_TOPOLOGIES.has(databaseTopology);
  const checks: ManagedDatabaseRuntimeGuardCheck[] = [];
  const warnings: string[] = [];

  if (supportedStore(store, supportedLocalModes) || (managedStoreRequested(store) && hasManagedPostgresStartupSupport)) {
    pushCheck(
      checks,
      "supported-runtime-store",
      "pass",
      managedStoreRequested(store)
        ? `TASKLOOM_STORE=${store} is allowed by Phase 52 managed Postgres startup support.`
        : store === "sqlite"
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
    hasManagedIntent && !hasManagedPostgresStartupSupport ? "fail" : "pass",
    hasManagedIntent
      ? hasManagedPostgresStartupSupport
        ? "Managed database runtime intent is allowed by Phase 52 startup support; Phase 50 Postgres adapter is configured and Phase 51 call-site migration is complete."
        : phase52.summary
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

  if (databaseTopology && !isLocalTopology && !hasManagedIntent && !hasMultiWriterIntent) {
    warnings.push(`Unknown TASKLOOM_DATABASE_TOPOLOGY value "${databaseTopology}" was observed.`);
  }
  if (store === "sqlite" && !configured(env.TASKLOOM_DB_PATH)) {
    warnings.push(`TASKLOOM_DB_PATH is not set; SQLite will use the default local path ${DEFAULT_SQLITE_PATH}.`);
  }
  if (hasManagedDatabaseUrl) {
    warnings.push(
      hasManagedPostgresStartupSupport
        ? "Managed database URL values were redacted; Phase 52 allows them only for single-writer managed Postgres startup."
        : "Managed database URL values were redacted and require Phase 52 managed Postgres startup support.",
    );
  }
  if (phase50.asyncAdapterAvailable) {
    warnings.push("Phase 50 async managed adapter/backfill capability is available; Phase 52 separately decides startup support.");
  } else if (phase50.asyncAdapterConfigured) {
    warnings.push("TASKLOOM_MANAGED_DATABASE_ADAPTER is configured, but Phase 50 adapter availability also requires a recognized postgres adapter value and managed database URL.");
  }
  if (hasManagedIntent && phase51.strictBlocker) {
    warnings.push(
      phase51.remainingSyncCallSiteGroups.length > 0
        ? `${phase51.summary} Remaining sync call-site groups: ${phase51.remainingSyncCallSiteGroups.join(", ")}.`
        : phase51.summary,
    );
  }
  if (hasManagedIntent) {
    warnings.push(phase52.summary);
  }
  if (hasMultiWriterIntent) {
    warnings.push(phase53.summary);
    warnings.push(phase54.summary);
  }
  if (bypassEnabled) {
    warnings.push(`${BYPASS_ENV_KEY}=true bypassed the managed database runtime guard for emergency or development-only use.`);
  }

  const blockers = checks.filter((check) => check.status === "fail").map((check) => check.summary);
  const managedDatabaseRuntimeBlocked = (hasManagedIntent && !hasManagedPostgresStartupSupport) || hasMultiWriterIntent;
  const allowed = blockers.length === 0 || bypassEnabled;
  const status = statusFromChecks(checks, bypassEnabled);
  let classification: ManagedDatabaseRuntimeGuardClassification;
  if (bypassEnabled) {
    classification = "bypassed";
  } else if (hasMultiWriterIntent) {
    classification = "multi-writer-blocked";
  } else if (hasManagedIntent && hasManagedPostgresStartupSupport) {
    classification = "managed-postgres";
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
      : hasManagedIntent && hasManagedPostgresStartupSupport
        ? "Phase 52 managed database runtime guard allows single-writer managed Postgres startup."
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
    nextSteps: buildNextSteps(checks, bypassEnabled, phase51, phase52, phase53, phase54),
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
    phase51,
    phase52,
    phase53,
    phase54,
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
