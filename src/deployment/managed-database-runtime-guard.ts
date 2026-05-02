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
  TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER?: string;
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER?: string;
  TASKLOOM_MULTI_WRITER_REVIEW_STATUS?: string;
  TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE?: string;
  TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF?: string;
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN?: string;
  TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN?: string;
  TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN?: string;
  TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN?: string;
  TASKLOOM_MULTI_WRITER_CUTOVER_PLAN?: string;
  TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG?: string;
  TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK?: string;
  TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG?: string;
  TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION?: string;
  TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION?: string;
  TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE?: string;
  TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE?: string;
  TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL?: string;
  TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN?: string;
  TASKLOOM_SCHEDULER_LEADER_MODE?: string;
  TASKLOOM_SCHEDULER_LEADER_HTTP_URL?: string;
  TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN?: string;
  TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE?: string;
  TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE?: string;
  TASKLOOM_ACCESS_LOG_MODE?: string;
  TASKLOOM_ACCESS_LOG_PATH?: string;
  TASKLOOM_ACCESS_LOG_SHIPPING_ASSERTION?: string;
  TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE?: string;
  TASKLOOM_ALERT_EVALUATE_CRON?: string;
  TASKLOOM_ALERT_WEBHOOK_URL?: string;
  TASKLOOM_ALERT_DELIVERY_EVIDENCE?: string;
  TASKLOOM_HEALTH_MONITORING_ASSERTION?: string;
  TASKLOOM_HEALTH_MONITORING_EVIDENCE?: string;
  TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE?: string;
  TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE?: string;
  TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE?: string;
  TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE?: string;
  TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION?: string;
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
  phase55?: {
    multiWriterTopologyRequested: boolean;
    designReviewerConfigured: boolean;
    implementationApproverConfigured: boolean;
    reviewStatus: string | null;
    reviewStatusConfigured: boolean;
    reviewStatusApproved: boolean;
    approvedImplementationScopeConfigured: boolean;
    safetySignoffConfigured: boolean;
    implementationAuthorizationGatePassed: boolean;
    runtimeSupport: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase56?: {
    multiWriterTopologyRequested: boolean;
    implementationAuthorizationGatePassed: boolean;
    implementationPlanConfigured: boolean;
    rolloutPlanConfigured: boolean;
    testValidationPlanConfigured: boolean;
    dataSafetyPlanConfigured: boolean;
    cutoverPlanConfigured: boolean;
    rollbackDrillEvidenceConfigured: boolean;
    implementationReadinessEvidenceConfigured: boolean;
    rolloutSafetyEvidenceConfigured: boolean;
    implementationReadinessGatePassed: boolean;
    runtimeSupport: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase57?: {
    multiWriterTopologyRequested: boolean;
    implementationReadinessGatePassed: boolean;
    implementationScopeLockConfigured: boolean;
    runtimeFeatureFlagConfigured: boolean;
    validationEvidenceConfigured: boolean;
    migrationCutoverLockConfigured: boolean;
    releaseOwnerSignoffConfigured: boolean;
    implementationScopeGatePassed: boolean;
    runtimeSupport: false;
    releaseAllowed: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase58?: {
    multiWriterTopologyRequested: boolean;
    implementationScopeGatePassed: boolean;
    runtimeImplementationEvidenceConfigured: boolean;
    consistencyValidationEvidenceConfigured: boolean;
    failoverValidationEvidenceConfigured: boolean;
    dataIntegrityValidationEvidenceConfigured: boolean;
    operationsRunbookConfigured: boolean;
    runtimeReleaseSignoffConfigured: boolean;
    runtimeImplementationValidationGatePassed: boolean;
    runtimeSupport: false;
    releaseAllowed: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase59?: {
    multiWriterTopologyRequested: boolean;
    runtimeImplementationValidationGatePassed: boolean;
    runtimeEnablementDecisionConfigured: boolean;
    runtimeEnablementApproverConfigured: boolean;
    runtimeEnablementRolloutWindowConfigured: boolean;
    runtimeEnablementMonitoringSignoffConfigured: boolean;
    runtimeEnablementAbortPlanConfigured: boolean;
    runtimeEnablementReleaseTicketConfigured: boolean;
    runtimeReleaseEnablementApprovalGatePassed: boolean;
    runtimeSupport: false;
    runtimeSupported: false;
    multiWriterSupported: false;
    runtimeImplementationBlocked: true;
    runtimeSupportBlocked: true;
    releaseAllowed: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase60?: {
    multiWriterTopologyRequested: boolean;
    runtimeReleaseEnablementApprovalGatePassed: boolean;
    runtimeSupportImplementationPresentConfigured: boolean;
    runtimeSupportExplicitSupportStatementConfigured: boolean;
    runtimeSupportCompatibilityMatrixConfigured: boolean;
    runtimeSupportCutoverEvidenceConfigured: boolean;
    runtimeSupportReleaseAutomationApprovalConfigured: boolean;
    runtimeSupportOwnerAcceptanceConfigured: boolean;
    runtimeSupportPresenceAssertionGatePassed: boolean;
    runtimeSupport: false;
    runtimeSupported: false;
    multiWriterSupported: false;
    runtimeImplementationBlocked: true;
    runtimeSupportBlocked: true;
    releaseAllowed: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase61?: {
    multiWriterTopologyRequested: boolean;
    runtimeSupportPresenceAssertionGatePassed: boolean;
    runtimeActivationDecisionConfigured: boolean;
    runtimeActivationOwnerConfigured: boolean;
    runtimeActivationWindowConfigured: boolean;
    runtimeActivationFlagConfigured: boolean;
    runtimeActivationReleaseAutomationAssertionConfigured: boolean;
    activationControlsReady: boolean;
    activationGatePassed: boolean;
    runtimeSupport: false;
    runtimeSupported: false;
    multiWriterSupported: false;
    runtimeImplementationBlocked: true;
    runtimeSupportBlocked: true;
    releaseAllowed: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase62?: {
    horizontalWriterTopologyRequested: boolean;
    managedPostgresStartupSupported: boolean;
    phase61ActivationControlsReady: boolean;
    phase61ActivationGatePassed: boolean;
    phase61ActivationReady: boolean;
    horizontalWriterHardeningImplementationConfigured: boolean;
    horizontalWriterConcurrencyTestEvidenceConfigured: boolean;
    horizontalWriterTransactionRetryEvidenceConfigured: boolean;
    horizontalWriterHardeningReady: boolean;
    horizontalWriterRuntimeSupported: boolean;
    activeActiveSupported: false;
    regionalFailoverSupported: false;
    pitrRuntimeSupported: false;
    distributedSqliteSupported: false;
    genericMultiWriterDatabaseSupported: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase63?: {
    required: boolean;
    horizontalWriterTopologyRequested: boolean;
    phase62HorizontalWriterRuntimeSupported: boolean;
    distributedRateLimitConfigured: boolean;
    distributedRateLimitFailClosed: boolean;
    distributedRateLimitReady: boolean;
    schedulerHttpLeaderConfigured: boolean;
    schedulerHttpLeaderFailClosed: boolean;
    schedulerCoordinationReady: boolean;
    durableJobExecutionPostureReady: boolean;
    accessLogShippingConfigured: boolean;
    alertEvaluationConfigured: boolean;
    alertDeliveryConfigured: boolean;
    alertDeliveryReady: boolean;
    healthMonitoringConfigured: boolean;
    distributedDependencyEnforcementReady: boolean;
    dependencyEnforcementReady: boolean;
    missingDependencies: Array<
      | "distributedRateLimiting"
      | "schedulerCoordination"
      | "durableJobExecution"
      | "accessLogShipping"
      | "alertDelivery"
      | "healthMonitoring"
    >;
    activationAllowed: boolean;
    releaseAllowed: false;
    strictBlocker: boolean;
    summary: string;
  };
  phase64?: {
    required: boolean;
    horizontalWriterTopologyRequested: boolean;
    phase63DistributedDependencyEnforcementReady: boolean;
    backupRestoreEvidenceConfigured: boolean;
    pitrRehearsalEvidenceConfigured: boolean;
    failoverRehearsalEvidenceConfigured: boolean;
    dataIntegrityValidationEvidenceConfigured: boolean;
    recoveryTimeExpectationConfigured: boolean;
    recoveryValidationReady: boolean;
    managedPostgresRecoveryClaimsValidated: boolean;
    supportedPosture: "managed-postgres-horizontal-app-writers-provider-ha-pitr";
    providerOwnedHaPitrRequired: true;
    appOwnedRegionalFailoverSupported: false;
    appOwnedPitrRuntimeSupported: false;
    activeActiveSupported: false;
    distributedSqliteSupported: false;
    activationAllowed: boolean;
    releaseAllowed: false;
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
  "TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER",
  "TASKLOOM_MULTI_WRITER_REVIEW_STATUS",
  "TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE",
  "TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN",
  "TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN",
  "TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN",
  "TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN",
  "TASKLOOM_MULTI_WRITER_CUTOVER_PLAN",
  "TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK",
  "TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG",
  "TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK",
  "TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK",
  "TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL",
  "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG",
  "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION",
  "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION",
  "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE",
  "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE",
  "TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL",
  "TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN",
  "TASKLOOM_SCHEDULER_LEADER_MODE",
  "TASKLOOM_SCHEDULER_LEADER_HTTP_URL",
  "TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN",
  "TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE",
  "TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE",
  "TASKLOOM_ACCESS_LOG_MODE",
  "TASKLOOM_ACCESS_LOG_PATH",
  "TASKLOOM_ACCESS_LOG_SHIPPING_ASSERTION",
  "TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE",
  "TASKLOOM_ALERT_EVALUATE_CRON",
  "TASKLOOM_ALERT_WEBHOOK_URL",
  "TASKLOOM_ALERT_DELIVERY_EVIDENCE",
  "TASKLOOM_HEALTH_MONITORING_ASSERTION",
  "TASKLOOM_HEALTH_MONITORING_EVIDENCE",
  "TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE",
  "TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE",
  "TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE",
  "TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE",
  "TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION",
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
  "regional",
  "regional-pitr",
  "pitr",
  "failover-pitr",
  "multi-region",
  "multi-writer",
]);
const DURABLE_JOB_EXECUTION_POSTURES = new Set([
  "managed-postgres-transactional-queue",
  "managed-postgres-durable-jobs",
  "shared-managed-postgres",
  "external-durable-queue",
]);
const HORIZONTAL_WRITER_TOPOLOGY_HINTS = new Set([
  "horizontal-app-writers",
  "horizontal-writers",
  "managed-postgres-horizontal-app-writers",
  "managed-postgres-horizontal-writers",
  "postgres-horizontal-app-writers",
  "postgres-horizontal-writers",
]);
const PHASE_50_MANAGED_DATABASE_ADAPTERS = new Set([
  "postgres",
  "postgresql",
  "managed-postgres",
  "managed-postgresql",
]);
const DEFAULT_PHASE_51_REMAINING_SYNC_CALL_SITE_GROUPS: string[] = [];
const PHASE_55_APPROVED_REVIEW_STATUSES = new Set([
  "approved",
  "authorized",
  "implementation-approved",
  "implementation-authorized",
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

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(normalize(value));
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

function phase55MultiWriterImplementationAuthorizationGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  hasMultiWriterIntent: boolean,
  designPackageGatePassed: boolean,
) {
  const designReviewerConfigured = configured(env.TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER);
  const implementationApproverConfigured = configured(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER);
  const reviewStatus = normalize(env.TASKLOOM_MULTI_WRITER_REVIEW_STATUS);
  const reviewStatusConfigured = reviewStatus.length > 0;
  const reviewStatusApproved = PHASE_55_APPROVED_REVIEW_STATUSES.has(reviewStatus);
  const approvedImplementationScopeConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE,
  );
  const safetySignoffConfigured = configured(env.TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF);
  const implementationAuthorizationGatePassed =
    !hasMultiWriterIntent ||
    (designPackageGatePassed &&
      designReviewerConfigured &&
      implementationApproverConfigured &&
      reviewStatusApproved &&
      approvedImplementationScopeConfigured &&
      safetySignoffConfigured);
  const strictBlocker = hasMultiWriterIntent && !implementationAuthorizationGatePassed;
  const summary = hasMultiWriterIntent
    ? implementationAuthorizationGatePassed
      ? "Phase 55 multi-writer design-package review and implementation authorization evidence are configured; runtime support remains blocked."
      : "Phase 55 requires a complete Phase 54 design package plus design reviewer, implementation approver, approved review status, approved implementation scope, and safety signoff before multi-writer runtime implementation can be authorized."
    : "No multi-writer, distributed, or active-active topology requested for Phase 55.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    designReviewerConfigured,
    implementationApproverConfigured,
    reviewStatus: reviewStatus || null,
    reviewStatusConfigured,
    reviewStatusApproved,
    approvedImplementationScopeConfigured,
    safetySignoffConfigured,
    implementationAuthorizationGatePassed,
    runtimeSupport: false as const,
    strictBlocker,
    summary,
  };
}

function phase56MultiWriterImplementationReadinessGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  hasMultiWriterIntent: boolean,
  implementationAuthorizationGatePassed: boolean,
) {
  const implementationPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN);
  const rolloutPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN);
  const testValidationPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN);
  const dataSafetyPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN);
  const cutoverPlanConfigured = configured(env.TASKLOOM_MULTI_WRITER_CUTOVER_PLAN);
  const rollbackDrillEvidenceConfigured = configured(env.TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE);
  const implementationReadinessEvidenceConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE,
  );
  const rolloutSafetyEvidenceConfigured = configured(env.TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE);
  const detailedEvidenceConfigured =
    implementationPlanConfigured &&
    rolloutPlanConfigured &&
    testValidationPlanConfigured &&
    dataSafetyPlanConfigured &&
    cutoverPlanConfigured &&
    rollbackDrillEvidenceConfigured;
  const bundledEvidenceConfigured =
    implementationReadinessEvidenceConfigured &&
    rolloutSafetyEvidenceConfigured;
  const implementationReadinessGatePassed =
    !hasMultiWriterIntent ||
    (implementationAuthorizationGatePassed && (detailedEvidenceConfigured || bundledEvidenceConfigured));
  const strictBlocker = hasMultiWriterIntent && !implementationReadinessGatePassed;
  const summary = hasMultiWriterIntent
    ? implementationReadinessGatePassed
      ? "Phase 56 multi-writer implementation readiness and rollout-safety evidence are configured; runtime support remains blocked."
      : "Phase 56 requires Phase 55 implementation authorization plus implementation plan, rollout plan, test/validation plan, data safety plan, cutover plan, and rollback drill evidence before any multi-writer runtime support can be claimed."
    : "No multi-writer, distributed, or active-active topology requested for Phase 56.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    implementationAuthorizationGatePassed,
    implementationPlanConfigured,
    rolloutPlanConfigured,
    testValidationPlanConfigured,
    dataSafetyPlanConfigured,
    cutoverPlanConfigured,
    rollbackDrillEvidenceConfigured,
    implementationReadinessEvidenceConfigured,
    rolloutSafetyEvidenceConfigured,
    implementationReadinessGatePassed,
    runtimeSupport: false as const,
    strictBlocker,
    summary,
  };
}

function phase57MultiWriterImplementationScopeGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  hasMultiWriterIntent: boolean,
  implementationReadinessGatePassed: boolean,
) {
  const implementationScopeLockConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK,
  );
  const runtimeFeatureFlagConfigured = configured(env.TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG);
  const validationEvidenceConfigured = configured(env.TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE);
  const migrationCutoverLockConfigured = configured(env.TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK);
  const releaseOwnerSignoffConfigured = configured(env.TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF);
  const implementationScopeGatePassed =
    !hasMultiWriterIntent ||
    (implementationReadinessGatePassed &&
      implementationScopeLockConfigured &&
      runtimeFeatureFlagConfigured &&
      validationEvidenceConfigured &&
      migrationCutoverLockConfigured &&
      releaseOwnerSignoffConfigured);
  const strictBlocker = hasMultiWriterIntent && !implementationScopeGatePassed;
  const summary = hasMultiWriterIntent
    ? implementationScopeGatePassed
      ? "Phase 57 multi-writer implementation scope evidence is configured; runtime support and release remain blocked."
      : "Phase 57 requires Phase 56 implementation readiness plus implementation scope lock, runtime feature-flag evidence, validation evidence, migration cutover lock, and release owner signoff before any multi-writer runtime implementation claim can proceed."
    : "No multi-writer, distributed, or active-active topology requested for Phase 57.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    implementationReadinessGatePassed,
    implementationScopeLockConfigured,
    runtimeFeatureFlagConfigured,
    validationEvidenceConfigured,
    migrationCutoverLockConfigured,
    releaseOwnerSignoffConfigured,
    implementationScopeGatePassed,
    runtimeSupport: false as const,
    releaseAllowed: false as const,
    strictBlocker,
    summary,
  };
}

function phase58MultiWriterRuntimeImplementationValidationGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  hasMultiWriterIntent: boolean,
  implementationScopeGatePassed: boolean,
) {
  const runtimeImplementationEvidenceConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE,
  );
  const consistencyValidationEvidenceConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE,
  );
  const failoverValidationEvidenceConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE,
  );
  const dataIntegrityValidationEvidenceConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE,
  );
  const operationsRunbookConfigured = configured(env.TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK);
  const runtimeReleaseSignoffConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF,
  );
  const runtimeImplementationValidationGatePassed =
    !hasMultiWriterIntent ||
    (implementationScopeGatePassed &&
      runtimeImplementationEvidenceConfigured &&
      consistencyValidationEvidenceConfigured &&
      failoverValidationEvidenceConfigured &&
      dataIntegrityValidationEvidenceConfigured &&
      operationsRunbookConfigured &&
      runtimeReleaseSignoffConfigured);
  const strictBlocker = hasMultiWriterIntent;
  const summary = hasMultiWriterIntent
    ? runtimeImplementationValidationGatePassed
      ? "Phase 58 multi-writer runtime implementation validation evidence is configured; runtime support and release remain blocked."
      : "Phase 58 requires Phase 57 implementation scope plus runtime implementation evidence, consistency validation evidence, failover validation evidence, data integrity validation evidence, operations runbook, and runtime release signoff before implementation validation can be recorded."
    : "No multi-writer, distributed, or active-active topology requested for Phase 58.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    implementationScopeGatePassed,
    runtimeImplementationEvidenceConfigured,
    consistencyValidationEvidenceConfigured,
    failoverValidationEvidenceConfigured,
    dataIntegrityValidationEvidenceConfigured,
    operationsRunbookConfigured,
    runtimeReleaseSignoffConfigured,
    runtimeImplementationValidationGatePassed,
    runtimeSupport: false as const,
    releaseAllowed: false as const,
    strictBlocker,
    summary,
  };
}

function phase59MultiWriterRuntimeReleaseEnablementApprovalGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  hasMultiWriterIntent: boolean,
  runtimeImplementationValidationGatePassed: boolean,
) {
  const runtimeEnablementDecisionConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION,
  );
  const runtimeEnablementApproverConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER,
  );
  const runtimeEnablementRolloutWindowConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW,
  );
  const runtimeEnablementMonitoringSignoffConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF,
  );
  const runtimeEnablementAbortPlanConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN,
  );
  const runtimeEnablementReleaseTicketConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET,
  );
  const runtimeReleaseEnablementApprovalGatePassed =
    !hasMultiWriterIntent ||
    (runtimeImplementationValidationGatePassed &&
      runtimeEnablementDecisionConfigured &&
      runtimeEnablementApproverConfigured &&
      runtimeEnablementRolloutWindowConfigured &&
      runtimeEnablementMonitoringSignoffConfigured &&
      runtimeEnablementAbortPlanConfigured &&
      runtimeEnablementReleaseTicketConfigured);
  const strictBlocker = hasMultiWriterIntent;
  const summary = hasMultiWriterIntent
    ? runtimeReleaseEnablementApprovalGatePassed
      ? "Phase 59 multi-writer runtime release-enable approval evidence is configured; runtime support and release remain blocked."
      : "Phase 59 requires complete Phase 58 runtime implementation validation plus release-enable decision, approver, rollout window, monitoring signoff, abort plan, and release ticket before release-enable approval evidence can be recorded."
    : "No multi-writer, distributed, or active-active topology requested for Phase 59.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    runtimeImplementationValidationGatePassed,
    runtimeEnablementDecisionConfigured,
    runtimeEnablementApproverConfigured,
    runtimeEnablementRolloutWindowConfigured,
    runtimeEnablementMonitoringSignoffConfigured,
    runtimeEnablementAbortPlanConfigured,
    runtimeEnablementReleaseTicketConfigured,
    runtimeReleaseEnablementApprovalGatePassed,
    runtimeSupport: false as const,
    runtimeSupported: false as const,
    multiWriterSupported: false as const,
    runtimeImplementationBlocked: true as const,
    runtimeSupportBlocked: true as const,
    releaseAllowed: false as const,
    strictBlocker,
    summary,
  };
}

function phase60MultiWriterRuntimeSupportPresenceAssertionGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  hasMultiWriterIntent: boolean,
  runtimeReleaseEnablementApprovalGatePassed: boolean,
) {
  const runtimeSupportImplementationPresentConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT,
  );
  const runtimeSupportExplicitSupportStatementConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT,
  );
  const runtimeSupportCompatibilityMatrixConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX,
  );
  const runtimeSupportCutoverEvidenceConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE,
  );
  const runtimeSupportReleaseAutomationApprovalConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL,
  );
  const runtimeSupportOwnerAcceptanceConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE,
  );
  const runtimeSupportPresenceAssertionGatePassed =
    !hasMultiWriterIntent ||
    (runtimeReleaseEnablementApprovalGatePassed &&
      runtimeSupportImplementationPresentConfigured &&
      runtimeSupportExplicitSupportStatementConfigured &&
      runtimeSupportCompatibilityMatrixConfigured &&
      runtimeSupportCutoverEvidenceConfigured &&
      runtimeSupportReleaseAutomationApprovalConfigured &&
      runtimeSupportOwnerAcceptanceConfigured);
  const strictBlocker = hasMultiWriterIntent;
  const summary = hasMultiWriterIntent
    ? runtimeSupportPresenceAssertionGatePassed
      ? "Phase 60 multi-writer runtime support presence assertion evidence is configured; runtime support and release remain blocked."
      : "Phase 60 requires complete Phase 59 release-enable approval plus runtime support implementation presence, explicit support statement, compatibility matrix, cutover evidence, release automation approval, and owner acceptance before runtime support presence assertion evidence can be recorded."
    : "No multi-writer, distributed, or active-active topology requested for Phase 60.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    runtimeReleaseEnablementApprovalGatePassed,
    runtimeSupportImplementationPresentConfigured,
    runtimeSupportExplicitSupportStatementConfigured,
    runtimeSupportCompatibilityMatrixConfigured,
    runtimeSupportCutoverEvidenceConfigured,
    runtimeSupportReleaseAutomationApprovalConfigured,
    runtimeSupportOwnerAcceptanceConfigured,
    runtimeSupportPresenceAssertionGatePassed,
    runtimeSupport: false as const,
    runtimeSupported: false as const,
    multiWriterSupported: false as const,
    runtimeImplementationBlocked: true as const,
    runtimeSupportBlocked: true as const,
    releaseAllowed: false as const,
    strictBlocker,
    summary,
  };
}

function phase61MultiWriterRuntimeActivationControlsGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  hasMultiWriterIntent: boolean,
  runtimeSupportPresenceAssertionGatePassed: boolean,
) {
  const runtimeActivationDecisionConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION,
  );
  const runtimeActivationOwnerConfigured = configured(env.TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER);
  const runtimeActivationWindowConfigured = configured(env.TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW);
  const runtimeActivationFlagConfigured = configured(env.TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG);
  const runtimeActivationReleaseAutomationAssertionConfigured = configured(
    env.TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION,
  );
  const activationControlsReady =
    runtimeActivationDecisionConfigured &&
    runtimeActivationOwnerConfigured &&
    runtimeActivationWindowConfigured &&
    runtimeActivationFlagConfigured &&
    runtimeActivationReleaseAutomationAssertionConfigured;
  const activationGatePassed =
    !hasMultiWriterIntent || (runtimeSupportPresenceAssertionGatePassed && activationControlsReady);
  const strictBlocker = hasMultiWriterIntent;
  const summary = hasMultiWriterIntent
    ? activationGatePassed
      ? "Phase 61 multi-writer runtime activation controls are configured; activation controls are ready, but runtime support and release remain blocked."
      : "Phase 61 requires complete Phase 60 runtime support presence assertion plus activation decision, owner, window, flag, and release automation assertion before activation controls can be recorded."
    : "No multi-writer, distributed, or active-active topology requested for Phase 61.";

  return {
    multiWriterTopologyRequested: hasMultiWriterIntent,
    runtimeSupportPresenceAssertionGatePassed,
    runtimeActivationDecisionConfigured,
    runtimeActivationOwnerConfigured,
    runtimeActivationWindowConfigured,
    runtimeActivationFlagConfigured,
    runtimeActivationReleaseAutomationAssertionConfigured,
    activationControlsReady,
    activationGatePassed,
    runtimeSupport: false as const,
    runtimeSupported: false as const,
    multiWriterSupported: false as const,
    runtimeImplementationBlocked: true as const,
    runtimeSupportBlocked: true as const,
    releaseAllowed: false as const,
    strictBlocker,
    summary,
  };
}

function phase62ManagedPostgresHorizontalWriterHardeningGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  horizontalWriterTopologyRequested: boolean,
  managedPostgresStartupSupported: boolean,
  phase61: ReturnType<typeof phase61MultiWriterRuntimeActivationControlsGate>,
) {
  const horizontalWriterHardeningImplementationConfigured = configured(
    env.TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION,
  );
  const horizontalWriterConcurrencyTestEvidenceConfigured = configured(
    env.TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE,
  );
  const horizontalWriterTransactionRetryEvidenceConfigured = configured(
    env.TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE,
  );
  const phase61ActivationReady = phase61.activationControlsReady && phase61.activationGatePassed;
  const horizontalWriterHardeningReady =
    !horizontalWriterTopologyRequested ||
    (managedPostgresStartupSupported &&
      phase61ActivationReady &&
      horizontalWriterHardeningImplementationConfigured &&
      horizontalWriterConcurrencyTestEvidenceConfigured &&
      horizontalWriterTransactionRetryEvidenceConfigured);
  const strictBlocker = horizontalWriterTopologyRequested && !horizontalWriterHardeningReady;
  const summary = horizontalWriterTopologyRequested
    ? horizontalWriterHardeningReady
      ? "Phase 62 managed Postgres horizontal app-writer concurrency hardening is configured; this supports horizontal Taskloom app writers on one managed Postgres database only."
      : "Phase 62 requires Phase 61 activation controls, managed Postgres startup support, hardening implementation evidence, concurrency test evidence, and transaction retry or compare-and-swap evidence before horizontal app-writer posture is hardened."
    : "No managed Postgres horizontal app-writer topology requested for Phase 62.";

  return {
    horizontalWriterTopologyRequested,
    managedPostgresStartupSupported,
    phase61ActivationControlsReady: phase61.activationControlsReady,
    phase61ActivationGatePassed: phase61.activationGatePassed,
    phase61ActivationReady,
    horizontalWriterHardeningImplementationConfigured,
    horizontalWriterConcurrencyTestEvidenceConfigured,
    horizontalWriterTransactionRetryEvidenceConfigured,
    horizontalWriterHardeningReady,
    horizontalWriterRuntimeSupported:
      horizontalWriterTopologyRequested && horizontalWriterHardeningReady,
    activeActiveSupported: false as const,
    regionalFailoverSupported: false as const,
    pitrRuntimeSupported: false as const,
    distributedSqliteSupported: false as const,
    genericMultiWriterDatabaseSupported: false as const,
    strictBlocker,
    summary,
  };
}

function phase63DistributedDependencyEnforcementGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  horizontalWriterTopologyRequested: boolean,
  phase62: ReturnType<typeof phase62ManagedPostgresHorizontalWriterHardeningGate>,
) {
  const distributedRateLimitConfigured = configured(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL);
  const distributedRateLimitFailClosed = !truthy(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN);
  const distributedRateLimitReady = distributedRateLimitConfigured && distributedRateLimitFailClosed;
  const schedulerLeaderMode = normalize(env.TASKLOOM_SCHEDULER_LEADER_MODE);
  const schedulerHttpLeaderConfigured =
    schedulerLeaderMode === "http" && configured(env.TASKLOOM_SCHEDULER_LEADER_HTTP_URL);
  const schedulerHttpLeaderFailClosed = !truthy(env.TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN);
  const schedulerCoordinationReady = schedulerHttpLeaderConfigured && schedulerHttpLeaderFailClosed;
  const durableJobExecutionPosture = normalize(env.TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE);
  const durableJobExecutionPostureReady =
    phase62.horizontalWriterRuntimeSupported &&
    DURABLE_JOB_EXECUTION_POSTURES.has(durableJobExecutionPosture) &&
    configured(env.TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE);
  const accessLogMode = normalize(env.TASKLOOM_ACCESS_LOG_MODE);
  const accessLogShippingEvidenceConfigured =
    configured(env.TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE) ||
    configured(env.TASKLOOM_ACCESS_LOG_SHIPPING_ASSERTION);
  const accessLogShippingConfigured =
    (accessLogMode === "stdout" && accessLogShippingEvidenceConfigured) ||
    (accessLogMode === "file" &&
      configured(env.TASKLOOM_ACCESS_LOG_PATH) &&
      accessLogShippingEvidenceConfigured);
  const alertEvaluationConfigured = configured(env.TASKLOOM_ALERT_EVALUATE_CRON);
  const alertDeliveryConfigured = configured(env.TASKLOOM_ALERT_WEBHOOK_URL);
  const alertDeliveryEvidenceConfigured = configured(env.TASKLOOM_ALERT_DELIVERY_EVIDENCE);
  const alertDeliveryReady = alertEvaluationConfigured && alertDeliveryConfigured && alertDeliveryEvidenceConfigured;
  const healthMonitoringConfigured =
    configured(env.TASKLOOM_HEALTH_MONITORING_EVIDENCE) ||
    configured(env.TASKLOOM_HEALTH_MONITORING_ASSERTION);
  const distributedDependencyEnforcementReady =
    !horizontalWriterTopologyRequested ||
    (phase62.horizontalWriterRuntimeSupported &&
      distributedRateLimitReady &&
      schedulerCoordinationReady &&
      durableJobExecutionPostureReady &&
      accessLogShippingConfigured &&
      alertDeliveryReady &&
      healthMonitoringConfigured);
  const strictBlocker = horizontalWriterTopologyRequested && !distributedDependencyEnforcementReady;
  const missingDependencies = [
    ...(!distributedRateLimitReady ? ["distributedRateLimiting" as const] : []),
    ...(!schedulerCoordinationReady ? ["schedulerCoordination" as const] : []),
    ...(!durableJobExecutionPostureReady ? ["durableJobExecution" as const] : []),
    ...(!accessLogShippingConfigured ? ["accessLogShipping" as const] : []),
    ...(!alertDeliveryReady ? ["alertDelivery" as const] : []),
    ...(!healthMonitoringConfigured ? ["healthMonitoring" as const] : []),
  ];
  const summary = horizontalWriterTopologyRequested
    ? distributedDependencyEnforcementReady
      ? "Phase 63 distributed dependency enforcement is configured; activation uses shared rate limiting, HTTP scheduler coordination, durable managed Postgres jobs, shipped access logs, alert delivery, and health monitoring."
      : "Phase 63 requires production-safe distributed dependencies before horizontal app-writer activation: shared fail-closed rate limiting, HTTP scheduler coordination, durable managed Postgres job execution, shipped access logs, alert delivery, and health monitoring."
    : "No managed Postgres horizontal app-writer topology requested for Phase 63 distributed dependency enforcement.";

  return {
    required: horizontalWriterTopologyRequested,
    horizontalWriterTopologyRequested,
    phase62HorizontalWriterRuntimeSupported: phase62.horizontalWriterRuntimeSupported,
    distributedRateLimitConfigured,
    distributedRateLimitFailClosed,
    distributedRateLimitReady,
    schedulerHttpLeaderConfigured,
    schedulerHttpLeaderFailClosed,
    schedulerCoordinationReady,
    durableJobExecutionPostureReady,
    accessLogShippingConfigured,
    alertEvaluationConfigured,
    alertDeliveryConfigured,
    alertDeliveryReady,
    healthMonitoringConfigured,
    distributedDependencyEnforcementReady,
    dependencyEnforcementReady: distributedDependencyEnforcementReady,
    missingDependencies,
    activationAllowed: horizontalWriterTopologyRequested && distributedDependencyEnforcementReady,
    releaseAllowed: false as const,
    strictBlocker,
    summary,
  };
}

function phase64ManagedPostgresRecoveryValidationGate(
  env: ManagedDatabaseRuntimeGuardEnv,
  horizontalWriterTopologyRequested: boolean,
  phase63: ReturnType<typeof phase63DistributedDependencyEnforcementGate>,
) {
  const backupRestoreEvidenceConfigured = configured(env.TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE);
  const pitrRehearsalEvidenceConfigured = configured(env.TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE);
  const failoverRehearsalEvidenceConfigured = configured(env.TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE);
  const dataIntegrityValidationEvidenceConfigured = configured(
    env.TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE,
  );
  const recoveryTimeExpectationConfigured = configured(env.TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION);
  const recoveryValidationReady =
    !horizontalWriterTopologyRequested ||
    (phase63.distributedDependencyEnforcementReady &&
      backupRestoreEvidenceConfigured &&
      pitrRehearsalEvidenceConfigured &&
      failoverRehearsalEvidenceConfigured &&
      dataIntegrityValidationEvidenceConfigured &&
      recoveryTimeExpectationConfigured);
  const strictBlocker = horizontalWriterTopologyRequested && !recoveryValidationReady;
  const summary = horizontalWriterTopologyRequested
    ? recoveryValidationReady
      ? "Phase 64 recovery validation is configured; backup restore, PITR rehearsal, failover rehearsal, data-integrity validation, and recovery-time expectations are recorded for managed Postgres provider-owned HA/PITR."
      : "Phase 64 requires completed Phase 63 distributed dependencies plus backup restore evidence, PITR rehearsal evidence, failover rehearsal evidence, data-integrity validation evidence, and recovery-time expectations before horizontal app-writer recovery claims are valid."
    : "No managed Postgres horizontal app-writer topology requested for Phase 64 recovery validation.";

  return {
    required: horizontalWriterTopologyRequested,
    horizontalWriterTopologyRequested,
    phase63DistributedDependencyEnforcementReady: phase63.distributedDependencyEnforcementReady,
    backupRestoreEvidenceConfigured,
    pitrRehearsalEvidenceConfigured,
    failoverRehearsalEvidenceConfigured,
    dataIntegrityValidationEvidenceConfigured,
    recoveryTimeExpectationConfigured,
    recoveryValidationReady,
    managedPostgresRecoveryClaimsValidated: horizontalWriterTopologyRequested && recoveryValidationReady,
    supportedPosture: "managed-postgres-horizontal-app-writers-provider-ha-pitr" as const,
    providerOwnedHaPitrRequired: true as const,
    appOwnedRegionalFailoverSupported: false as const,
    appOwnedPitrRuntimeSupported: false as const,
    activeActiveSupported: false as const,
    distributedSqliteSupported: false as const,
    activationAllowed: horizontalWriterTopologyRequested && recoveryValidationReady,
    releaseAllowed: false as const,
    strictBlocker,
    summary,
  };
}

function managedTopologyRequested(topology: string, store: string): boolean {
  return (
    MANAGED_TOPOLOGY_HINTS.has(topology) ||
    HORIZONTAL_WRITER_TOPOLOGY_HINTS.has(topology) ||
    MANAGED_TOPOLOGY_HINTS.has(store)
  );
}

function multiWriterTopologyRequested(topology: string): boolean {
  return MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
}

function horizontalWriterTopologyRequested(topology: string): boolean {
  return HORIZONTAL_WRITER_TOPOLOGY_HINTS.has(topology);
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
  phase55: ReturnType<typeof phase55MultiWriterImplementationAuthorizationGate>,
  phase56: ReturnType<typeof phase56MultiWriterImplementationReadinessGate>,
  phase57: ReturnType<typeof phase57MultiWriterImplementationScopeGate>,
  phase58: ReturnType<typeof phase58MultiWriterRuntimeImplementationValidationGate>,
  phase59: ReturnType<typeof phase59MultiWriterRuntimeReleaseEnablementApprovalGate>,
  phase60: ReturnType<typeof phase60MultiWriterRuntimeSupportPresenceAssertionGate>,
  phase61: ReturnType<typeof phase61MultiWriterRuntimeActivationControlsGate>,
  phase62: ReturnType<typeof phase62ManagedPostgresHorizontalWriterHardeningGate>,
  phase63: ReturnType<typeof phase63DistributedDependencyEnforcementGate>,
  phase64: ReturnType<typeof phase64ManagedPostgresRecoveryValidationGate>,
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
    if (check.id === "phase55-multi-writer-implementation-authorization") {
      if (!phase54.designPackageGatePassed) {
        steps.add("Complete the Phase 54 multi-writer topology design package before requesting implementation authorization.");
      }
      if (!phase55.designReviewerConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER with the design-package reviewer.");
      }
      if (!phase55.implementationApproverConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER with the implementation authorizer.");
      }
      if (!phase55.reviewStatusApproved) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_REVIEW_STATUS=approved after the design-package review is complete.");
      }
      if (!phase55.approvedImplementationScopeConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE with the approved implementation scope.");
      }
      if (!phase55.safetySignoffConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF with the explicit safety signoff evidence.");
      }
    }
    if (check.id === "phase56-multi-writer-implementation-readiness") {
      if (!phase55.implementationAuthorizationGatePassed) {
        steps.add("Complete Phase 55 multi-writer implementation authorization before claiming implementation readiness.");
      }
      if (!phase56.implementationPlanConfigured && !phase56.implementationReadinessEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN with the approved implementation plan evidence.");
      }
      if (!phase56.rolloutPlanConfigured && !phase56.rolloutSafetyEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN with the rollout plan evidence.");
      }
      if (!phase56.testValidationPlanConfigured && !phase56.implementationReadinessEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN with the test and validation plan evidence.");
      }
      if (!phase56.dataSafetyPlanConfigured && !phase56.implementationReadinessEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN with the data safety plan evidence.");
      }
      if (!phase56.cutoverPlanConfigured && !phase56.rolloutSafetyEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_CUTOVER_PLAN with the cutover plan evidence.");
      }
      if (!phase56.rollbackDrillEvidenceConfigured && !phase56.rolloutSafetyEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE with rollback drill evidence.");
      }
    }
    if (check.id === "phase57-multi-writer-implementation-scope") {
      if (!phase56.implementationReadinessGatePassed) {
        steps.add("Complete Phase 56 multi-writer implementation readiness and rollout-safety evidence before claiming implementation scope.");
      }
      if (!phase57.implementationScopeLockConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK with the locked Phase 57 implementation scope evidence.");
      }
      if (!phase57.runtimeFeatureFlagConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG with the guarded runtime feature-flag evidence.");
      }
      if (!phase57.validationEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE with the Phase 57 validation evidence.");
      }
      if (!phase57.migrationCutoverLockConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK with the migration cutover lock evidence.");
      }
      if (!phase57.releaseOwnerSignoffConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF with the release owner signoff evidence.");
      }
    }
    if (check.id === "phase58-multi-writer-runtime-implementation-validation") {
      if (!phase57.implementationScopeGatePassed) {
        steps.add("Complete Phase 57 multi-writer implementation scope before recording runtime implementation validation.");
      }
      if (!phase58.runtimeImplementationEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE with the Phase 58 runtime implementation evidence.");
      }
      if (!phase58.consistencyValidationEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE with the consistency validation evidence.");
      }
      if (!phase58.failoverValidationEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE with the failover validation evidence.");
      }
      if (!phase58.dataIntegrityValidationEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE with the data integrity validation evidence.");
      }
      if (!phase58.operationsRunbookConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK with the operations runbook evidence.");
      }
      if (!phase58.runtimeReleaseSignoffConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF with the runtime release signoff evidence.");
      }
      if (phase58.runtimeImplementationValidationGatePassed) {
        steps.add("Keep multi-writer runtime support and release disabled; Phase 58 records implementation validation evidence only.");
      }
    }
    if (check.id === "phase59-multi-writer-runtime-release-enable-approval") {
      if (!phase58.runtimeImplementationValidationGatePassed) {
        steps.add("Complete Phase 58 multi-writer runtime implementation validation before recording release-enable approval evidence.");
      }
      if (!phase59.runtimeEnablementDecisionConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION with the Phase 59 release-enable decision evidence.");
      }
      if (!phase59.runtimeEnablementApproverConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER with the release-enable approver evidence.");
      }
      if (!phase59.runtimeEnablementRolloutWindowConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW with the approved rollout window evidence.");
      }
      if (!phase59.runtimeEnablementMonitoringSignoffConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF with monitoring signoff evidence.");
      }
      if (!phase59.runtimeEnablementAbortPlanConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN with the release abort plan evidence.");
      }
      if (!phase59.runtimeEnablementReleaseTicketConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET with the release ticket evidence.");
      }
      if (phase59.runtimeReleaseEnablementApprovalGatePassed) {
        steps.add("Keep multi-writer runtime support and release disabled; Phase 59 records release-enable approval evidence only.");
      }
    }
    if (check.id === "phase60-multi-writer-runtime-support-presence-assertion") {
      if (!phase59.runtimeReleaseEnablementApprovalGatePassed) {
        steps.add("Complete Phase 59 multi-writer runtime release-enable approval before recording runtime support presence assertion evidence.");
      }
      if (!phase60.runtimeSupportImplementationPresentConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT with the Phase 60 runtime support implementation presence evidence.");
      }
      if (!phase60.runtimeSupportExplicitSupportStatementConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT with the explicit runtime support statement evidence.");
      }
      if (!phase60.runtimeSupportCompatibilityMatrixConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX with the runtime support compatibility matrix evidence.");
      }
      if (!phase60.runtimeSupportCutoverEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE with the runtime support cutover evidence.");
      }
      if (!phase60.runtimeSupportReleaseAutomationApprovalConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL with release automation approval evidence.");
      }
      if (!phase60.runtimeSupportOwnerAcceptanceConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE with runtime support owner acceptance evidence.");
      }
      if (phase60.runtimeSupportPresenceAssertionGatePassed) {
        steps.add("Keep multi-writer runtime support and release disabled; Phase 60 records runtime support presence assertion evidence only.");
      }
    }
    if (check.id === "phase61-multi-writer-runtime-activation-controls") {
      if (!phase60.runtimeSupportPresenceAssertionGatePassed) {
        steps.add("Complete Phase 60 multi-writer runtime support presence assertion before recording runtime activation controls.");
      }
      if (!phase61.runtimeActivationDecisionConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION with the Phase 61 activation decision evidence.");
      }
      if (!phase61.runtimeActivationOwnerConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER with the runtime activation owner.");
      }
      if (!phase61.runtimeActivationWindowConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW with the approved activation window.");
      }
      if (!phase61.runtimeActivationFlagConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG with the explicit activation flag evidence.");
      }
      if (!phase61.runtimeActivationReleaseAutomationAssertionConfigured) {
        steps.add("Configure TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION with release automation assertion evidence.");
      }
      if (phase61.activationGatePassed) {
        steps.add("Keep multi-writer runtime support and release disabled; Phase 61 records activation controls only.");
      }
    }
    if (check.id === "phase62-managed-postgres-horizontal-writer-hardening") {
      if (!phase62.managedPostgresStartupSupported) {
        steps.add("Configure the Phase 50 Postgres adapter and managed database URL so Phase 52 managed Postgres startup support is available.");
      }
      if (!phase62.phase61ActivationReady) {
        steps.add("Complete Phase 61 activation controls before claiming Phase 62 horizontal app-writer hardening.");
      }
      if (!phase62.horizontalWriterHardeningImplementationConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION with the Phase 62 hardening implementation evidence.");
      }
      if (!phase62.horizontalWriterConcurrencyTestEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE with concurrent managed Postgres writer test evidence.");
      }
      if (!phase62.horizontalWriterTransactionRetryEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE with transaction retry or compare-and-swap evidence.");
      }
    }
    if (check.id === "phase63-distributed-dependency-enforcement") {
      if (!phase63.phase62HorizontalWriterRuntimeSupported) {
        steps.add("Complete Phase 62 horizontal app-writer hardening before enabling Phase 63 distributed dependencies.");
      }
      if (!phase63.distributedRateLimitReady) {
        steps.add("Configure TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL and keep TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN unset for fail-closed shared rate limiting.");
      }
      if (!phase63.schedulerCoordinationReady) {
        steps.add("Configure TASKLOOM_SCHEDULER_LEADER_MODE=http and TASKLOOM_SCHEDULER_LEADER_HTTP_URL, with TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN unset.");
      }
      if (!phase63.durableJobExecutionPostureReady) {
        steps.add("Keep durable job execution on the managed Postgres horizontal app-writer posture; local JSON/SQLite job coordination cannot activate horizontally.");
      }
      if (!phase63.accessLogShippingConfigured) {
        steps.add("Configure TASKLOOM_ACCESS_LOG_MODE=stdout for supervisor shipping, or file mode with TASKLOOM_ACCESS_LOG_PATH and TASKLOOM_ACCESS_LOG_SHIPPING_ASSERTION.");
      }
      if (!phase63.alertDeliveryReady) {
        steps.add("Configure TASKLOOM_ALERT_EVALUATE_CRON and TASKLOOM_ALERT_WEBHOOK_URL so subsystem health and job alerts are delivered.");
      }
      if (!phase63.healthMonitoringConfigured) {
        steps.add("Configure TASKLOOM_HEALTH_MONITORING_ASSERTION with the external monitor or readiness-probe evidence for the activated deployment.");
      }
    }
    if (check.id === "phase64-managed-postgres-recovery-validation") {
      if (!phase64.phase63DistributedDependencyEnforcementReady) {
        steps.add("Complete Phase 63 distributed dependency enforcement before recording Phase 64 recovery validation.");
      }
      if (!phase64.backupRestoreEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE with backup restore test evidence.");
      }
      if (!phase64.pitrRehearsalEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE with managed Postgres PITR rehearsal evidence.");
      }
      if (!phase64.failoverRehearsalEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE with provider-owned HA/failover rehearsal evidence.");
      }
      if (!phase64.dataIntegrityValidationEvidenceConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE with post-recovery data-integrity validation evidence.");
      }
      if (!phase64.recoveryTimeExpectationConfigured) {
        steps.add("Configure TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION with the expected RTO/RPO or provider recovery-time target.");
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
  const hasHorizontalWriterIntent = horizontalWriterTopologyRequested(databaseTopology);
  const phase52 = phase52ManagedPostgresStartupSupport(phase50, phase51, hasMultiWriterIntent);
  const phase53 = phase53MultiWriterTopologyGate(env, hasMultiWriterIntent);
  const phase54 = phase54MultiWriterTopologyDesignPackageGate(env, hasMultiWriterIntent);
  const phase55 = phase55MultiWriterImplementationAuthorizationGate(
    env,
    hasMultiWriterIntent,
    phase54.designPackageGatePassed,
  );
  const phase56 = phase56MultiWriterImplementationReadinessGate(
    env,
    hasMultiWriterIntent,
    phase55.implementationAuthorizationGatePassed,
  );
  const phase57 = phase57MultiWriterImplementationScopeGate(
    env,
    hasMultiWriterIntent,
    phase56.implementationReadinessGatePassed,
  );
  const phase58 = phase58MultiWriterRuntimeImplementationValidationGate(
    env,
    hasMultiWriterIntent,
    phase57.implementationScopeGatePassed,
  );
  const phase59 = phase59MultiWriterRuntimeReleaseEnablementApprovalGate(
    env,
    hasMultiWriterIntent,
    phase58.runtimeImplementationValidationGatePassed,
  );
  const phase60 = phase60MultiWriterRuntimeSupportPresenceAssertionGate(
    env,
    hasMultiWriterIntent,
    phase59.runtimeReleaseEnablementApprovalGatePassed,
  );
  const phase61 = phase61MultiWriterRuntimeActivationControlsGate(
    env,
    hasMultiWriterIntent,
    phase60.runtimeSupportPresenceAssertionGatePassed,
  );
  const hasManagedPostgresStartupSupport = phase52.managedPostgresStartupSupported;
  const phase62 = phase62ManagedPostgresHorizontalWriterHardeningGate(
    env,
    hasHorizontalWriterIntent,
    hasManagedPostgresStartupSupport,
    phase61,
  );
  const phase63 = phase63DistributedDependencyEnforcementGate(env, hasHorizontalWriterIntent, phase62);
  const phase64 = phase64ManagedPostgresRecoveryValidationGate(env, hasHorizontalWriterIntent, phase63);
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

  pushCheck(
    checks,
    "phase55-multi-writer-implementation-authorization",
    phase55.strictBlocker ? "fail" : "pass",
    phase55.summary,
  );

  pushCheck(
    checks,
    "phase56-multi-writer-implementation-readiness",
    phase56.strictBlocker ? "fail" : "pass",
    phase56.summary,
  );

  pushCheck(
    checks,
    "phase57-multi-writer-implementation-scope",
    phase57.strictBlocker ? "fail" : "pass",
    phase57.summary,
  );

  pushCheck(
    checks,
    "phase58-multi-writer-runtime-implementation-validation",
    phase58.strictBlocker ? "fail" : "pass",
    phase58.summary,
  );

  pushCheck(
    checks,
    "phase59-multi-writer-runtime-release-enable-approval",
    phase59.strictBlocker ? "fail" : "pass",
    phase59.summary,
  );

  pushCheck(
    checks,
    "phase60-multi-writer-runtime-support-presence-assertion",
    phase60.strictBlocker ? "fail" : "pass",
    phase60.summary,
  );

  pushCheck(
    checks,
    "phase61-multi-writer-runtime-activation-controls",
    phase61.strictBlocker ? "fail" : "pass",
    phase61.summary,
  );

  pushCheck(
    checks,
    "phase62-managed-postgres-horizontal-writer-hardening",
    phase62.strictBlocker ? "fail" : "pass",
    phase62.summary,
  );

  pushCheck(
    checks,
    "phase63-distributed-dependency-enforcement",
    phase63.strictBlocker ? "fail" : "pass",
    phase63.summary,
  );

  pushCheck(
    checks,
    "phase64-managed-postgres-recovery-validation",
    phase64.strictBlocker ? "fail" : "pass",
    phase64.summary,
  );

  if (databaseTopology && !isLocalTopology && !hasManagedIntent && !hasMultiWriterIntent && !hasHorizontalWriterIntent) {
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
    warnings.push(phase55.summary);
    warnings.push(phase56.summary);
    warnings.push(phase57.summary);
    warnings.push(phase58.summary);
    warnings.push(phase59.summary);
    warnings.push(phase60.summary);
    warnings.push(phase61.summary);
  }
  if (hasHorizontalWriterIntent) {
    warnings.push(phase62.summary);
    warnings.push(phase63.summary);
    warnings.push(phase64.summary);
  }
  if (bypassEnabled) {
    warnings.push(`${BYPASS_ENV_KEY}=true bypassed the managed database runtime guard for emergency or development-only use.`);
  }

  const blockers = checks.filter((check) => check.status === "fail").map((check) => check.summary);
  const managedDatabaseRuntimeBlocked =
    (hasManagedIntent && !hasManagedPostgresStartupSupport) ||
    hasMultiWriterIntent ||
    phase62.strictBlocker ||
    phase63.strictBlocker ||
    phase64.strictBlocker;
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
      : hasHorizontalWriterIntent && phase64.recoveryValidationReady
        ? "Phase 64 managed database runtime guard allows hardened managed Postgres horizontal app-writer posture with validated provider-owned HA/PITR recovery evidence."
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
    nextSteps: buildNextSteps(
      checks,
      bypassEnabled,
      phase51,
      phase52,
      phase53,
      phase54,
      phase55,
      phase56,
      phase57,
      phase58,
      phase59,
      phase60,
      phase61,
      phase62,
      phase63,
      phase64,
    ),
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
    phase55,
    phase56,
    phase57,
    phase58,
    phase59,
    phase60,
    phase61,
    phase62,
    phase63,
    phase64,
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
