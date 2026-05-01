import {
  buildStorageTopologyReport as defaultBuildStorageTopologyReport,
  type StorageTopologyEnv,
  type StorageTopologyProbeDeps,
  type StorageTopologyReport,
} from "./storage-topology.js";
import {
  buildAsyncStoreBoundaryReport,
  buildManagedDatabaseRuntimeBoundaryReport,
  type AsyncStoreBoundaryReport,
  buildReleaseReadinessReport as defaultBuildReleaseReadinessReport,
  type ManagedDatabaseRuntimeBoundaryReport,
  type Phase53MultiWriterTopologyEvidenceItem,
  type Phase53MultiWriterTopologyGateReport,
  type Phase55MultiWriterImplementationAuthorizationGateReport,
  type Phase56MultiWriterRuntimeReadinessGateReport,
  type Phase57MultiWriterImplementationScopeGateReport,
  type Phase58MultiWriterRuntimeImplementationValidationGateReport,
  type Phase59MultiWriterRuntimeEnablementApprovalGateReport,
  type Phase60MultiWriterRuntimeSupportPresenceAssertionGateReport,
  type ReleaseReadinessDeps,
  type ReleaseReadinessEnv,
  type ReleaseReadinessReport,
} from "./release-readiness.js";
import {
  buildManagedDatabaseTopologyReport as defaultBuildManagedDatabaseTopologyReport,
  type ManagedDatabaseTopologyDeps,
  type ManagedDatabaseTopologyEnv,
  type ManagedDatabaseTopologyReport,
} from "./managed-database-topology.js";
import {
  buildManagedDatabaseRuntimeGuardReport as defaultBuildManagedDatabaseRuntimeGuardReport,
  type ManagedDatabaseRuntimeGuardDeps,
  type ManagedDatabaseRuntimeGuardEnv,
  type ManagedDatabaseRuntimeGuardReport,
} from "./managed-database-runtime-guard.js";

export type ReleaseEvidenceEnvValue = string | number | boolean | null | undefined;
export type ReleaseEvidenceEnv = ReleaseReadinessEnv &
  ManagedDatabaseTopologyEnv &
  ManagedDatabaseRuntimeGuardEnv &
  Record<string, ReleaseEvidenceEnvValue>;

export interface ReleaseEvidenceEntry {
  name: string;
  configured: boolean;
  value: string | null;
  redacted: boolean;
}

export interface ReleaseEvidenceAttachment {
  id: string;
  label: string;
  format: "json";
  required: boolean;
  summary: string;
  envKey?: string;
  configured?: boolean;
  value?: string | null;
  redacted?: boolean;
}

export interface ReleaseEvidenceBundle {
  phase: "44";
  generatedAt: string;
  summary: string;
  readyForRelease: boolean;
  storageTopology: StorageTopologyReport;
  releaseReadiness: ReleaseEvidenceReleaseReadinessReport;
  managedDatabaseTopology: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport;
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport;
  asyncStoreBoundary: AsyncStoreBoundaryReport;
  evidence: {
    environment: ReleaseEvidenceEntry[];
    config: {
      nodeEnv: string;
      storageMode: StorageTopologyReport["mode"];
      storageClassification: StorageTopologyReport["classification"];
      managedDatabaseTopologyStatus: ManagedDatabaseTopologyReport["status"];
      managedDatabaseTopologyClassification: ManagedDatabaseTopologyReport["classification"];
      managedDatabaseRuntimeGuardStatus: ManagedDatabaseRuntimeGuardReport["status"];
      managedDatabaseRuntimeGuardClassification: ManagedDatabaseRuntimeGuardReport["classification"];
      managedDatabaseRuntimeAllowed: boolean;
      managedDatabaseRuntimeBoundaryStatus: ManagedDatabaseRuntimeBoundaryReport["status"];
      managedDatabaseRuntimeBoundaryClassification: ManagedDatabaseRuntimeBoundaryReport["classification"];
      managedDatabaseRuntimeBoundaryAllowed: boolean;
      asyncStoreBoundaryStatus: AsyncStoreBoundaryReport["status"];
      asyncStoreBoundaryClassification: AsyncStoreBoundaryReport["classification"];
      asyncStoreBoundaryFoundationAvailable: true;
      asyncStoreBoundaryReleaseAllowed: boolean;
      managedPostgresSupported: boolean;
      phase52ManagedStartupSupported: boolean;
      managedDatabaseAdapterImplemented: boolean;
      managedDatabaseRepositoriesImplemented: false;
      managedDatabaseBackfillAvailable: boolean;
      managedDatabaseSyncStartupSupported: boolean;
      managedDatabaseRuntimeCallSiteMigrationTracked: boolean;
      managedDatabaseRuntimeCallSitesMigrated: boolean;
      managedDatabaseRemainingSyncCallSiteGroups: string[];
      phase53MultiWriterTopologyGateRequired: boolean;
      phase53MultiWriterRequirementsEvidenceRequired: boolean;
      phase53MultiWriterDesignEvidenceRequired: boolean;
      phase53MultiWriterDesignPackageEvidenceRequired: boolean;
      phase53MultiWriterRequirementsEvidenceAttached: boolean;
      phase53MultiWriterDesignEvidenceAttached: boolean;
      phase53MultiWriterDesignPackageEvidenceAttached: boolean;
      phase53MultiWriterTopologyOwnerEvidenceRequired: boolean;
      phase53MultiWriterTopologyOwnerEvidenceAttached: boolean;
      phase53MultiWriterConsistencyModelEvidenceRequired: boolean;
      phase53MultiWriterConsistencyModelEvidenceAttached: boolean;
      phase53MultiWriterFailoverPitrPlanEvidenceRequired: boolean;
      phase53MultiWriterFailoverPitrPlanEvidenceAttached: boolean;
      phase53MultiWriterMigrationBackfillPlanEvidenceRequired: boolean;
      phase53MultiWriterMigrationBackfillPlanEvidenceAttached: boolean;
      phase53MultiWriterObservabilityPlanEvidenceRequired: boolean;
      phase53MultiWriterObservabilityPlanEvidenceAttached: boolean;
      phase53MultiWriterRollbackPlanEvidenceRequired: boolean;
      phase53MultiWriterRollbackPlanEvidenceAttached: boolean;
      phase53MultiWriterTopologyReleaseAllowed: boolean;
      phase54MultiWriterTopologyDesignPackageGateRequired: boolean;
      phase54MultiWriterDesignPackageEvidenceRequired: boolean;
      phase54MultiWriterDesignPackageEvidenceAttached: boolean;
      phase54MultiWriterTopologyOwnerEvidenceRequired: boolean;
      phase54MultiWriterTopologyOwnerEvidenceAttached: boolean;
      phase54MultiWriterConsistencyModelEvidenceRequired: boolean;
      phase54MultiWriterConsistencyModelEvidenceAttached: boolean;
      phase54MultiWriterFailoverPitrPlanEvidenceRequired: boolean;
      phase54MultiWriterFailoverPitrPlanEvidenceAttached: boolean;
      phase54MultiWriterMigrationBackfillPlanEvidenceRequired: boolean;
      phase54MultiWriterMigrationBackfillPlanEvidenceAttached: boolean;
      phase54MultiWriterObservabilityPlanEvidenceRequired: boolean;
      phase54MultiWriterObservabilityPlanEvidenceAttached: boolean;
      phase54MultiWriterRollbackPlanEvidenceRequired: boolean;
      phase54MultiWriterRollbackPlanEvidenceAttached: boolean;
      phase54MultiWriterTopologyReleaseAllowed: boolean;
      phase55MultiWriterImplementationAuthorizationGateRequired: boolean;
      phase55MultiWriterDesignPackageReviewEvidenceRequired: boolean;
      phase55MultiWriterDesignPackageReviewEvidenceAttached: boolean;
      phase55MultiWriterImplementationAuthorizationEvidenceRequired: boolean;
      phase55MultiWriterImplementationAuthorizationEvidenceAttached: boolean;
      phase55MultiWriterImplementationAuthorized: boolean;
      phase55MultiWriterRuntimeSupportBlocked: boolean;
      phase55MultiWriterTopologyReleaseAllowed: boolean;
      phase56MultiWriterRuntimeReadinessGateRequired: boolean;
      phase56MultiWriterImplementationReadinessEvidenceRequired: boolean;
      phase56MultiWriterImplementationReadinessEvidenceAttached: boolean;
      phase56MultiWriterRolloutSafetyEvidenceRequired: boolean;
      phase56MultiWriterRolloutSafetyEvidenceAttached: boolean;
      phase56MultiWriterRuntimeImplementationReady: boolean;
      phase56MultiWriterRolloutSafetyReady: boolean;
      phase56MultiWriterRuntimeReadinessComplete: boolean;
      phase56MultiWriterRuntimeSupportBlocked: boolean;
      phase56MultiWriterTopologyReleaseAllowed: boolean;
      phase57MultiWriterImplementationScopeGateRequired: boolean;
      phase57MultiWriterRuntimeReadinessRequired: boolean;
      phase57MultiWriterRuntimeReadinessComplete: boolean;
      phase57MultiWriterImplementationScopeLockRequired: boolean;
      phase57MultiWriterImplementationScopeLockAttached: boolean;
      phase57MultiWriterRuntimeFeatureFlagRequired: boolean;
      phase57MultiWriterRuntimeFeatureFlagAttached: boolean;
      phase57MultiWriterValidationEvidenceRequired: boolean;
      phase57MultiWriterValidationEvidenceAttached: boolean;
      phase57MultiWriterMigrationCutoverLockRequired: boolean;
      phase57MultiWriterMigrationCutoverLockAttached: boolean;
      phase57MultiWriterReleaseOwnerSignoffRequired: boolean;
      phase57MultiWriterReleaseOwnerSignoffAttached: boolean;
      phase57MultiWriterImplementationScopeComplete: boolean;
      phase57MultiWriterRuntimeSupportBlocked: boolean;
      phase57MultiWriterTopologyReleaseAllowed: boolean;
      phase58MultiWriterRuntimeImplementationValidationGateRequired: boolean;
      phase58MultiWriterImplementationScopeRequired: boolean;
      phase58MultiWriterImplementationScopeComplete: boolean;
      phase58MultiWriterRuntimeImplementationEvidenceRequired: boolean;
      phase58MultiWriterRuntimeImplementationEvidenceAttached: boolean;
      phase58MultiWriterConsistencyValidationEvidenceRequired: boolean;
      phase58MultiWriterConsistencyValidationEvidenceAttached: boolean;
      phase58MultiWriterFailoverValidationEvidenceRequired: boolean;
      phase58MultiWriterFailoverValidationEvidenceAttached: boolean;
      phase58MultiWriterDataIntegrityValidationEvidenceRequired: boolean;
      phase58MultiWriterDataIntegrityValidationEvidenceAttached: boolean;
      phase58MultiWriterOperationsRunbookRequired: boolean;
      phase58MultiWriterOperationsRunbookAttached: boolean;
      phase58MultiWriterRuntimeReleaseSignoffRequired: boolean;
      phase58MultiWriterRuntimeReleaseSignoffAttached: boolean;
      phase58MultiWriterRuntimeImplementationValidationComplete: boolean;
      phase58MultiWriterRuntimeSupportBlocked: boolean;
      phase58MultiWriterTopologyReleaseAllowed: boolean;
      phase59MultiWriterRuntimeEnablementApprovalGateRequired: boolean;
      phase59MultiWriterRuntimeImplementationValidationRequired: boolean;
      phase59MultiWriterRuntimeImplementationValidationComplete: boolean;
      phase59MultiWriterEnablementDecisionEvidenceRequired: boolean;
      phase59MultiWriterEnablementDecisionEvidenceAttached: boolean;
      phase59MultiWriterEnablementApproverEvidenceRequired: boolean;
      phase59MultiWriterEnablementApproverEvidenceAttached: boolean;
      phase59MultiWriterRolloutWindowEvidenceRequired: boolean;
      phase59MultiWriterRolloutWindowEvidenceAttached: boolean;
      phase59MultiWriterMonitoringSignoffEvidenceRequired: boolean;
      phase59MultiWriterMonitoringSignoffEvidenceAttached: boolean;
      phase59MultiWriterAbortPlanEvidenceRequired: boolean;
      phase59MultiWriterAbortPlanEvidenceAttached: boolean;
      phase59MultiWriterReleaseTicketEvidenceRequired: boolean;
      phase59MultiWriterReleaseTicketEvidenceAttached: boolean;
      phase59MultiWriterRuntimeEnablementApprovalComplete: boolean;
      phase59MultiWriterRuntimeSupportBlocked: boolean;
      phase59MultiWriterTopologyReleaseAllowed: boolean;
      phase60MultiWriterRuntimeSupportPresenceAssertionGateRequired: boolean;
      phase60MultiWriterRuntimeEnablementApprovalRequired: boolean;
      phase60MultiWriterRuntimeEnablementApprovalComplete: boolean;
      phase60MultiWriterImplementationPresentEvidenceRequired: boolean;
      phase60MultiWriterImplementationPresentEvidenceAttached: boolean;
      phase60MultiWriterExplicitSupportStatementRequired: boolean;
      phase60MultiWriterExplicitSupportStatementAttached: boolean;
      phase60MultiWriterCompatibilityMatrixRequired: boolean;
      phase60MultiWriterCompatibilityMatrixAttached: boolean;
      phase60MultiWriterCutoverEvidenceRequired: boolean;
      phase60MultiWriterCutoverEvidenceAttached: boolean;
      phase60MultiWriterReleaseAutomationApprovalRequired: boolean;
      phase60MultiWriterReleaseAutomationApprovalAttached: boolean;
      phase60MultiWriterOwnerAcceptanceRequired: boolean;
      phase60MultiWriterOwnerAcceptanceAttached: boolean;
      phase60MultiWriterRuntimeSupportPresenceAssertionComplete: boolean;
      phase60MultiWriterRuntimeSupportBlocked: boolean;
      phase60MultiWriterTopologyReleaseAllowed: boolean;
      strictRelease: boolean;
      backupConfigured: boolean;
      restoreDrillRecorded: boolean;
      artifactPathConfigured: boolean;
      accessLogMode: string;
    };
  };
  attachments: ReleaseEvidenceAttachment[];
  nextSteps: string[];
}

export interface ReleaseEvidenceDeps {
  probes?: StorageTopologyProbeDeps;
  storageTopology?: StorageTopologyReport;
  releaseReadiness?: ReleaseReadinessReport;
  managedDatabaseTopology?: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard?: ManagedDatabaseRuntimeGuardReport;
  managedDatabaseRuntimeBoundary?: ManagedDatabaseRuntimeBoundaryReport;
  asyncStoreBoundary?: AsyncStoreBoundaryReport;
  managedDatabaseTopologyDeps?: ManagedDatabaseTopologyDeps;
  managedDatabaseRuntimeGuardDeps?: ManagedDatabaseRuntimeGuardDeps;
  buildStorageTopologyReport?: (
    env?: StorageTopologyEnv,
    probes?: StorageTopologyProbeDeps,
  ) => StorageTopologyReport;
  buildReleaseReadinessReport?: (
    env?: ReleaseReadinessEnv,
    deps?: ReleaseReadinessDeps,
  ) => ReleaseReadinessReport;
  buildManagedDatabaseTopologyReport?: (
    env?: ManagedDatabaseTopologyEnv,
    deps?: ManagedDatabaseTopologyDeps,
  ) => ManagedDatabaseTopologyReport;
  buildManagedDatabaseRuntimeGuardReport?: (
    env?: ManagedDatabaseRuntimeGuardEnv,
    deps?: ManagedDatabaseRuntimeGuardDeps,
  ) => ManagedDatabaseRuntimeGuardReport;
  strict?: boolean;
}

type ReleaseReadinessWithManagedReports = ReleaseReadinessReport & {
  managedDatabaseTopology?: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard?: ManagedDatabaseRuntimeGuardReport;
  managedDatabaseRuntimeBoundary?: ManagedDatabaseRuntimeBoundaryReport;
  asyncStoreBoundary?: AsyncStoreBoundaryReport;
};

type ReleaseEvidenceReleaseReadinessReport = ReleaseReadinessReport & {
  managedDatabaseTopology: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport;
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport;
  asyncStoreBoundary: AsyncStoreBoundaryReport;
};

export interface ReleaseEvidenceInput extends ReleaseEvidenceDeps {
  env?: ReleaseEvidenceEnv;
  generatedAt?: string | Date;
}

const DEPLOYMENT_ENV_KEYS = [
  "NODE_ENV",
  "TASKLOOM_STORE",
  "TASKLOOM_DB_PATH",
  "TASKLOOM_BACKUP_DIR",
  "TASKLOOM_ARTIFACTS_PATH",
  "TASKLOOM_ARTIFACT_DIR",
  "TASKLOOM_RESTORE_DRILL_AT",
  "TASKLOOM_LAST_RESTORE_DRILL_AT",
  "TASKLOOM_RESTORE_DRILL_MARKER",
  "TASKLOOM_TRUST_PROXY",
  "TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL",
  "TASKLOOM_SCHEDULER_LEADER_MODE",
  "TASKLOOM_ACCESS_LOG_MODE",
  "TASKLOOM_ACCESS_LOG_PATH",
  "TASKLOOM_RELEASE_STRICT",
  "TASKLOOM_STRICT_RELEASE",
  "TASKLOOM_MANAGED_DATABASE_URL",
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
  "TASKLOOM_MANAGED_DATABASE_ADAPTER",
  "TASKLOOM_DATABASE_TOPOLOGY",
  "TASKLOOM_UNSUPPORTED_MANAGED_DB_RUNTIME_BYPASS",
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
  "TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW",
  "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION",
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
] as const;

const SENSITIVE_NAME_PATTERN = /(secret|token|password|passwd|pwd|credential|private|apikey|api_key|auth|session|cookie)/i;
const SECRET_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;
const DATABASE_URL_NAME_PATTERN = /(^|_)DATABASE_URL$/i;

function stringValue(value: ReleaseEvidenceEnvValue): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function configured(value: ReleaseEvidenceEnvValue): boolean {
  return stringValue(value).length > 0;
}

function truthy(value: ReleaseEvidenceEnvValue): boolean {
  return ["1", "true", "yes", "on"].includes(stringValue(value).toLowerCase());
}

function generatedAtString(value: string | Date | undefined): string {
  if (value instanceof Date) return value.toISOString();
  return value ?? new Date().toISOString();
}

function hasUrlSecret(value: string): boolean {
  return SECRET_URL_PATTERN.test(value);
}

function shouldRedact(name: string, value: string): boolean {
  return configured(value) && (DATABASE_URL_NAME_PATTERN.test(name) || SENSITIVE_NAME_PATTERN.test(name) || hasUrlSecret(value));
}

function redactValue(name: string, value: ReleaseEvidenceEnvValue): Pick<ReleaseEvidenceEntry, "value" | "redacted"> {
  const normalized = stringValue(value);
  if (!normalized) return { value: null, redacted: false };
  if (shouldRedact(name, normalized)) return { value: "[redacted]", redacted: true };
  return { value: normalized, redacted: false };
}

function releaseEnv(env: ReleaseEvidenceEnv): ReleaseReadinessEnv {
  return env;
}

function storageEnv(env: ReleaseEvidenceEnv): StorageTopologyEnv {
  return env;
}

function managedDatabaseTopologyEnv(env: ReleaseEvidenceEnv): ManagedDatabaseTopologyEnv {
  return env;
}

function managedDatabaseRuntimeGuardEnv(env: ReleaseEvidenceEnv): ManagedDatabaseRuntimeGuardEnv {
  return env;
}

function buildEnvironmentEvidence(env: ReleaseEvidenceEnv): ReleaseEvidenceEntry[] {
  const keys = new Set<string>(DEPLOYMENT_ENV_KEYS);

  for (const key of Object.keys(env).sort()) {
    if (key.startsWith("TASKLOOM_") && (SENSITIVE_NAME_PATTERN.test(key) || hasUrlSecret(stringValue(env[key])))) {
      keys.add(key);
    }
  }

  return Array.from(keys)
    .sort()
    .map((name) => ({
      name,
      configured: configured(env[name]),
      ...redactValue(name, env[name]),
    }));
}

function restoreDrillRecorded(env: ReleaseEvidenceEnv): boolean {
  return (
    configured(env.TASKLOOM_RESTORE_DRILL_AT) ||
    configured(env.TASKLOOM_LAST_RESTORE_DRILL_AT) ||
    configured(env.TASKLOOM_RESTORE_DRILL_MARKER)
  );
}

function artifactPathConfigured(env: ReleaseEvidenceEnv): boolean {
  return configured(env.TASKLOOM_ARTIFACTS_PATH) || configured(env.TASKLOOM_ARTIFACT_DIR);
}

const PHASE53_MULTI_WRITER_DESIGN_PACKAGE_EVIDENCE = [
  {
    id: "topology-owner",
    label: "Topology owner",
    envKey: "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER",
  },
  {
    id: "consistency-model",
    label: "Consistency model",
    envKey: "TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL",
  },
  {
    id: "failover-pitr-plan",
    label: "Failover/PITR plan",
    envKey: "TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN",
  },
  {
    id: "migration-backfill-plan",
    label: "Migration/backfill plan",
    envKey: "TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN",
  },
  {
    id: "observability-plan",
    label: "Observability plan",
    envKey: "TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN",
  },
  {
    id: "rollback-plan",
    label: "Rollback plan",
    envKey: "TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN",
  },
] as const satisfies ReadonlyArray<{
  id: Phase53MultiWriterTopologyEvidenceItem["id"];
  label: string;
  envKey: keyof ReleaseReadinessEnv;
}>;

function phase53FallbackDesignPackageEvidence(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
): Phase53MultiWriterTopologyEvidenceItem[] {
  const required = asyncStoreBoundary.classification === "multi-writer-unsupported";
  return PHASE53_MULTI_WRITER_DESIGN_PACKAGE_EVIDENCE.map((item) => ({
    ...item,
    required,
    attached: false,
    summary: `${item.label} evidence is missing; set ${item.envKey} before treating multi-writer topology design as complete.`,
  }));
}

function phase53EvidenceAttached(
  phase53Gate: Phase53MultiWriterTopologyGateReport,
  id: Phase53MultiWriterTopologyEvidenceItem["id"],
): boolean {
  return phase53Gate.designPackageEvidence.some((item) => item.id === id && item.attached);
}

function phase53MultiWriterTopologyGate(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
): Phase53MultiWriterTopologyGateReport {
  const fallbackDesignPackageEvidence = phase53FallbackDesignPackageEvidence(asyncStoreBoundary);
  return asyncStoreBoundary.phase53MultiWriterTopologyGate ?? {
    phase: "53",
    required: asyncStoreBoundary.classification === "multi-writer-unsupported",
    requirementsEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    designEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    designPackageEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    requirementsEvidenceAttached: false,
    designEvidenceAttached: false,
    designPackageEvidenceAttached: false,
    topologyOwnerEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    topologyOwnerEvidenceAttached: false,
    consistencyModelEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    consistencyModelEvidenceAttached: false,
    failoverPitrPlanEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    failoverPitrPlanEvidenceAttached: false,
    migrationBackfillPlanEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    migrationBackfillPlanEvidenceAttached: false,
    observabilityPlanEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    observabilityPlanEvidenceAttached: false,
    rollbackPlanEvidenceRequired: asyncStoreBoundary.classification === "multi-writer-unsupported",
    rollbackPlanEvidenceAttached: false,
    designPackageEvidence: fallbackDesignPackageEvidence,
    releaseAllowed: asyncStoreBoundary.classification !== "multi-writer-unsupported",
    summary: asyncStoreBoundary.classification === "multi-writer-unsupported"
      ? "Phase 54 multi-writer topology design-package evidence is required before distributed, active-active, or multi-writer database release."
      : "Phase 53 multi-writer topology requirements/design gate is not required for this release posture.",
    blockers: asyncStoreBoundary.classification === "multi-writer-unsupported"
      ? [
        ...fallbackDesignPackageEvidence.map((item) => `Phase 54 multi-writer ${item.label.toLowerCase()} evidence is required before release.`),
        "Phase 54 multi-writer, distributed, or active-active runtime support remains blocked even when design-package evidence is attached.",
      ]
      : [],
    nextSteps: asyncStoreBoundary.classification === "multi-writer-unsupported"
      ? [
        ...fallbackDesignPackageEvidence.map((item) => `Attach Phase 54 multi-writer ${item.label.toLowerCase()} evidence before considering distributed, active-active, or multi-writer release.`),
        "Keep multi-writer, distributed, and active-active runtime release blocked until implementation support and a later release gate explicitly allow it.",
      ]
      : ["Keep Phase 53 requirements/design evidence ready before enabling distributed, active-active, or multi-writer database topology."],
  };
}

function phase55MultiWriterImplementationAuthorizationGate(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  phase53Gate: Phase53MultiWriterTopologyGateReport,
): Phase55MultiWriterImplementationAuthorizationGateReport {
  const fallbackRequired = asyncStoreBoundary.classification === "multi-writer-unsupported";
  return asyncStoreBoundary.phase55MultiWriterImplementationAuthorizationGate ?? {
    phase: "55",
    required: fallbackRequired,
    designPackageReviewEvidenceRequired: fallbackRequired,
    designPackageReviewEvidenceAttached: false,
    implementationAuthorizationEvidenceRequired: fallbackRequired,
    implementationAuthorizationEvidenceAttached: false,
    implementationAuthorized: false,
    runtimeSupportBlocked: fallbackRequired,
    releaseAllowed: !fallbackRequired,
    summary: fallbackRequired
      ? phase53Gate.designPackageEvidenceAttached
        ? "Phase 55 multi-writer design-package review and implementation authorization evidence is required before any multi-writer runtime implementation work."
        : "Phase 55 multi-writer implementation authorization requires the Phase 54 design package before review or authorization can unblock implementation planning."
      : "Phase 55 multi-writer design-package review and implementation authorization gate is not required for this release posture.",
    blockers: fallbackRequired
      ? [
        ...(!phase53Gate.designPackageEvidenceAttached
          ? ["Phase 55 multi-writer implementation authorization requires attached Phase 54 design-package evidence before review."]
          : []),
        "Phase 55 multi-writer design-package review evidence is required before runtime implementation work.",
        "Phase 55 multi-writer implementation authorization evidence is required before runtime implementation work.",
        "Phase 55 multi-writer runtime support remains blocked; review and authorization evidence does not permit release until a later runtime implementation gate explicitly allows it.",
      ]
      : [],
    nextSteps: fallbackRequired
      ? [
        ...(!phase53Gate.designPackageEvidenceAttached
          ? ["Complete and attach the Phase 54 multi-writer design package before requesting Phase 55 review or implementation authorization."]
          : []),
        "Attach Phase 55 multi-writer design-package review evidence before starting runtime implementation work.",
        "Attach Phase 55 multi-writer implementation authorization evidence before starting runtime implementation work.",
        "Keep multi-writer runtime release blocked after Phase 55 authorization until implementation support and a later release gate explicitly allow it.",
      ]
      : ["Keep Phase 55 review and implementation authorization evidence ready before starting multi-writer runtime implementation work."],
  };
}

function phase56MultiWriterRuntimeReadinessGate(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  phase55Gate: Phase55MultiWriterImplementationAuthorizationGateReport,
): Phase56MultiWriterRuntimeReadinessGateReport {
  const fallbackRequired = asyncStoreBoundary.classification === "multi-writer-unsupported";
  return asyncStoreBoundary.phase56MultiWriterRuntimeReadinessGate ?? {
    phase: "56",
    required: fallbackRequired,
    implementationReadinessEvidenceRequired: fallbackRequired,
    implementationReadinessEvidenceAttached: false,
    rolloutSafetyEvidenceRequired: fallbackRequired,
    rolloutSafetyEvidenceAttached: false,
    runtimeImplementationReady: false,
    rolloutSafetyReady: false,
    runtimeReadinessComplete: false,
    runtimeSupportBlocked: fallbackRequired,
    releaseAllowed: !fallbackRequired,
    summary: fallbackRequired
      ? phase55Gate.implementationAuthorized
        ? "Phase 56 multi-writer runtime implementation readiness and rollout-safety evidence is required before any multi-writer runtime support claim."
        : "Phase 56 multi-writer runtime readiness requires Phase 55 review and implementation authorization before readiness evidence can support a runtime claim."
      : "Phase 56 multi-writer runtime implementation readiness and rollout-safety gate is not required for this release posture.",
    blockers: fallbackRequired
      ? [
        ...(!phase55Gate.implementationAuthorized
          ? ["Phase 56 multi-writer runtime readiness requires attached Phase 55 review and implementation authorization evidence first."]
          : []),
        "Phase 56 multi-writer runtime implementation readiness evidence is required before any runtime support claim.",
        "Phase 56 multi-writer rollout-safety evidence is required before any runtime support claim.",
        "Phase 56 multi-writer runtime support remains blocked; readiness and rollout-safety evidence does not permit release until a later runtime implementation gate explicitly allows it.",
      ]
      : [],
    nextSteps: fallbackRequired
      ? [
        ...(!phase55Gate.implementationAuthorized
          ? ["Complete Phase 55 multi-writer review and implementation authorization before treating Phase 56 runtime readiness evidence as complete."]
          : []),
        "Attach Phase 56 multi-writer runtime implementation readiness evidence before claiming multi-writer runtime support.",
        "Attach Phase 56 multi-writer rollout-safety evidence before claiming multi-writer runtime support.",
        "Keep multi-writer runtime release blocked after Phase 56 readiness evidence until a later release gate explicitly allows it.",
      ]
      : ["Keep Phase 56 runtime readiness and rollout-safety evidence ready before claiming multi-writer runtime support."],
  };
}

function phase57MultiWriterImplementationScopeGate(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  phase56Gate: Phase56MultiWriterRuntimeReadinessGateReport,
): Phase57MultiWriterImplementationScopeGateReport {
  const fallbackRequired = asyncStoreBoundary.classification === "multi-writer-unsupported";
  return asyncStoreBoundary.phase57MultiWriterImplementationScopeGate ?? {
    phase: "57",
    required: fallbackRequired,
    runtimeReadinessRequired: fallbackRequired,
    runtimeReadinessComplete: phase56Gate.runtimeReadinessComplete,
    implementationScopeLockRequired: fallbackRequired,
    implementationScopeLockAttached: false,
    runtimeFeatureFlagRequired: fallbackRequired,
    runtimeFeatureFlagAttached: false,
    validationEvidenceRequired: fallbackRequired,
    validationEvidenceAttached: false,
    migrationCutoverLockRequired: fallbackRequired,
    migrationCutoverLockAttached: false,
    releaseOwnerSignoffRequired: fallbackRequired,
    releaseOwnerSignoffAttached: false,
    implementationScopeComplete: false,
    runtimeSupportBlocked: fallbackRequired,
    releaseAllowed: !fallbackRequired,
    summary: fallbackRequired
      ? phase56Gate.runtimeReadinessComplete
        ? "Phase 57 multi-writer implementation-scope evidence is required before any multi-writer runtime implementation scope claim."
        : "Phase 57 multi-writer implementation-scope gate requires Phase 56 runtime readiness and rollout-safety evidence first."
      : "Phase 57 multi-writer implementation-scope gate is not required for this release posture.",
    blockers: fallbackRequired
      ? [
        ...(!phase56Gate.runtimeReadinessComplete
          ? ["Phase 57 multi-writer implementation scope requires Phase 56 runtime readiness complete first."]
          : []),
        "Phase 57 multi-writer implementation scope lock evidence is required before any runtime implementation scope claim.",
        "Phase 57 multi-writer runtime feature-flag evidence is required before any runtime implementation scope claim.",
        "Phase 57 multi-writer validation evidence is required before any runtime implementation scope claim.",
        "Phase 57 multi-writer migration cutover lock evidence is required before any runtime implementation scope claim.",
        "Phase 57 multi-writer release owner signoff evidence is required before any runtime implementation scope claim.",
        "Phase 57 multi-writer runtime support remains blocked; implementation-scope evidence does not permit release until a later runtime implementation gate explicitly allows it.",
      ]
      : [],
    nextSteps: fallbackRequired
      ? [
        ...(!phase56Gate.runtimeReadinessComplete
          ? ["Complete Phase 56 multi-writer runtime readiness before treating Phase 57 implementation-scope evidence as complete."]
          : []),
        "Attach TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK before claiming multi-writer implementation scope.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG before claiming multi-writer implementation scope.",
        "Attach TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE before claiming multi-writer implementation scope.",
        "Attach TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK before claiming multi-writer implementation scope.",
        "Attach TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF before claiming multi-writer implementation scope.",
        "Keep multi-writer runtime release blocked after Phase 57 implementation-scope evidence until a later release gate explicitly allows it.",
      ]
      : ["Keep Phase 57 implementation-scope evidence ready before claiming multi-writer runtime implementation scope."],
  };
}

function phase58MultiWriterRuntimeImplementationValidationGate(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  phase57Gate: Phase57MultiWriterImplementationScopeGateReport,
): Phase58MultiWriterRuntimeImplementationValidationGateReport {
  const fallbackRequired = asyncStoreBoundary.classification === "multi-writer-unsupported";
  return asyncStoreBoundary.phase58MultiWriterRuntimeImplementationValidationGate ?? {
    phase: "58",
    required: fallbackRequired,
    implementationScopeRequired: fallbackRequired,
    implementationScopeComplete: phase57Gate.implementationScopeComplete,
    runtimeImplementationEvidenceRequired: fallbackRequired,
    runtimeImplementationEvidenceAttached: false,
    consistencyValidationEvidenceRequired: fallbackRequired,
    consistencyValidationEvidenceAttached: false,
    failoverValidationEvidenceRequired: fallbackRequired,
    failoverValidationEvidenceAttached: false,
    dataIntegrityValidationEvidenceRequired: fallbackRequired,
    dataIntegrityValidationEvidenceAttached: false,
    operationsRunbookRequired: fallbackRequired,
    operationsRunbookAttached: false,
    runtimeReleaseSignoffRequired: fallbackRequired,
    runtimeReleaseSignoffAttached: false,
    runtimeImplementationValidationComplete: false,
    runtimeSupportBlocked: fallbackRequired,
    releaseAllowed: !fallbackRequired,
    summary: fallbackRequired
      ? phase57Gate.implementationScopeComplete
        ? "Phase 58 multi-writer runtime implementation validation evidence is required before any multi-writer runtime validation claim."
        : "Phase 58 multi-writer runtime implementation validation requires Phase 57 implementation-scope completion first."
      : "Phase 58 multi-writer runtime implementation validation gate is not required for this release posture.",
    blockers: fallbackRequired
      ? [
        ...(!phase57Gate.implementationScopeComplete
          ? ["Phase 58 multi-writer runtime implementation validation requires complete Phase 57 implementation-scope evidence first."]
          : []),
        "Phase 58 multi-writer runtime implementation evidence is required before any runtime validation claim.",
        "Phase 58 multi-writer consistency validation evidence is required before any runtime validation claim.",
        "Phase 58 multi-writer failover validation evidence is required before any runtime validation claim.",
        "Phase 58 multi-writer data integrity validation evidence is required before any runtime validation claim.",
        "Phase 58 multi-writer operations runbook evidence is required before any runtime validation claim.",
        "Phase 58 multi-writer runtime release signoff evidence is required before any runtime validation claim.",
        "Phase 58 multi-writer runtime support remains blocked; runtime implementation validation evidence does not permit distributed, active-active, or multi-writer release.",
      ]
      : [],
    nextSteps: fallbackRequired
      ? [
        ...(!phase57Gate.implementationScopeComplete
          ? ["Complete Phase 57 multi-writer implementation-scope evidence before treating Phase 58 runtime implementation validation as complete."]
          : []),
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE before claiming multi-writer runtime implementation validation.",
        "Attach TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE before claiming multi-writer consistency validation.",
        "Attach TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE before claiming multi-writer failover validation.",
        "Attach TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE before claiming multi-writer data integrity validation.",
        "Attach TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK before claiming multi-writer operations readiness.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF before claiming multi-writer runtime release signoff.",
        "Keep multi-writer runtime release blocked after Phase 58 validation evidence; this phase does not enable distributed, active-active, or multi-writer runtime support.",
      ]
      : ["Keep Phase 58 runtime implementation validation evidence ready before claiming multi-writer runtime validation."],
  };
}

function phase59MultiWriterRuntimeEnablementApprovalGate(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  phase58Gate: Phase58MultiWriterRuntimeImplementationValidationGateReport,
): Phase59MultiWriterRuntimeEnablementApprovalGateReport {
  const fallbackRequired = asyncStoreBoundary.classification === "multi-writer-unsupported";
  return asyncStoreBoundary.phase59MultiWriterRuntimeEnablementApprovalGate ?? {
    phase: "59",
    required: fallbackRequired,
    runtimeImplementationValidationRequired: fallbackRequired,
    runtimeImplementationValidationComplete: phase58Gate.runtimeImplementationValidationComplete,
    enablementDecisionEvidenceRequired: fallbackRequired,
    enablementDecisionEvidenceAttached: false,
    enablementApproverEvidenceRequired: fallbackRequired,
    enablementApproverEvidenceAttached: false,
    rolloutWindowEvidenceRequired: fallbackRequired,
    rolloutWindowEvidenceAttached: false,
    monitoringSignoffEvidenceRequired: fallbackRequired,
    monitoringSignoffEvidenceAttached: false,
    abortPlanEvidenceRequired: fallbackRequired,
    abortPlanEvidenceAttached: false,
    releaseTicketEvidenceRequired: fallbackRequired,
    releaseTicketEvidenceAttached: false,
    runtimeEnablementApprovalComplete: false,
    runtimeSupportBlocked: fallbackRequired,
    releaseAllowed: !fallbackRequired,
    summary: fallbackRequired
      ? phase58Gate.runtimeImplementationValidationComplete
        ? "Phase 59 multi-writer runtime enablement approval evidence is required after Phase 58 runtime implementation validation."
        : "Phase 59 multi-writer runtime enablement approval requires Phase 58 runtime implementation validation completion first."
      : "Phase 59 multi-writer runtime enablement approval gate is not required for this release posture.",
    blockers: fallbackRequired
      ? [
        ...(!phase58Gate.runtimeImplementationValidationComplete
          ? ["Phase 59 multi-writer runtime enablement approval requires complete Phase 58 runtime implementation validation evidence first."]
          : []),
        "Phase 59 multi-writer runtime enablement decision evidence is required before recording release-enable approval.",
        "Phase 59 multi-writer runtime enablement approver evidence is required before recording release-enable approval.",
        "Phase 59 multi-writer runtime enablement rollout window evidence is required before recording release-enable approval.",
        "Phase 59 multi-writer runtime enablement monitoring signoff evidence is required before recording release-enable approval.",
        "Phase 59 multi-writer runtime enablement abort plan evidence is required before recording release-enable approval.",
        "Phase 59 multi-writer runtime enablement release ticket evidence is required before recording release-enable approval.",
        "Phase 59 multi-writer runtime support remains blocked; approval evidence does not permit distributed, active-active, or multi-writer release.",
      ]
      : [],
    nextSteps: fallbackRequired
      ? [
        ...(!phase58Gate.runtimeImplementationValidationComplete
          ? ["Complete Phase 58 multi-writer runtime implementation validation before treating Phase 59 release-enable approval evidence as complete."]
          : []),
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION before recording multi-writer release-enable approval evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER before recording multi-writer release-enable approval evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW before recording multi-writer release-enable approval evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF before recording multi-writer release-enable approval evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN before recording multi-writer release-enable approval evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET before recording multi-writer release-enable approval evidence.",
        "Keep multi-writer runtime release blocked after Phase 59 approval evidence; this phase records approval evidence only and does not enable distributed, active-active, or multi-writer runtime support.",
      ]
      : ["Keep Phase 59 runtime enablement approval evidence ready before any future multi-writer release-enable claim."],
  };
}

function phase60MultiWriterRuntimeSupportPresenceAssertionGate(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  phase59Gate: Phase59MultiWriterRuntimeEnablementApprovalGateReport,
): Phase60MultiWriterRuntimeSupportPresenceAssertionGateReport {
  const fallbackRequired = asyncStoreBoundary.classification === "multi-writer-unsupported";
  return asyncStoreBoundary.phase60MultiWriterRuntimeSupportPresenceAssertionGate ?? {
    phase: "60",
    required: fallbackRequired,
    runtimeEnablementApprovalRequired: fallbackRequired,
    runtimeEnablementApprovalComplete: phase59Gate.runtimeEnablementApprovalComplete,
    implementationPresentEvidenceRequired: fallbackRequired,
    implementationPresentEvidenceAttached: false,
    explicitSupportStatementRequired: fallbackRequired,
    explicitSupportStatementAttached: false,
    compatibilityMatrixRequired: fallbackRequired,
    compatibilityMatrixAttached: false,
    cutoverEvidenceRequired: fallbackRequired,
    cutoverEvidenceAttached: false,
    releaseAutomationApprovalRequired: fallbackRequired,
    releaseAutomationApprovalAttached: false,
    ownerAcceptanceRequired: fallbackRequired,
    ownerAcceptanceAttached: false,
    runtimeSupportPresenceAssertionComplete: false,
    runtimeSupportBlocked: fallbackRequired,
    releaseAllowed: !fallbackRequired,
    summary: fallbackRequired
      ? phase59Gate.runtimeEnablementApprovalComplete
        ? "Phase 60 multi-writer runtime support presence assertion evidence is required after Phase 59 release-enable approval evidence."
        : "Phase 60 multi-writer runtime support presence assertion requires Phase 59 release-enable approval completion first."
      : "Phase 60 multi-writer runtime support presence assertion gate is not required for this release posture.",
    blockers: fallbackRequired
      ? [
        ...(!phase59Gate.runtimeEnablementApprovalComplete
          ? ["Phase 60 multi-writer runtime support presence assertion requires complete Phase 59 release-enable approval evidence first."]
          : []),
        "Phase 60 multi-writer runtime support implementation-present evidence is required before recording support presence assertion evidence.",
        "Phase 60 multi-writer explicit runtime support statement evidence is required before recording support presence assertion evidence.",
        "Phase 60 multi-writer runtime support compatibility matrix evidence is required before recording support presence assertion evidence.",
        "Phase 60 multi-writer runtime support cutover evidence is required before recording support presence assertion evidence.",
        "Phase 60 multi-writer runtime support release automation approval evidence is required before recording support presence assertion evidence.",
        "Phase 60 multi-writer runtime support owner acceptance evidence is required before recording support presence assertion evidence.",
        "Phase 60 multi-writer runtime support remains blocked; support presence assertion evidence does not permit distributed, active-active, or multi-writer release.",
      ]
      : [],
    nextSteps: fallbackRequired
      ? [
        ...(!phase59Gate.runtimeEnablementApprovalComplete
          ? ["Complete Phase 59 multi-writer release-enable approval evidence before treating Phase 60 runtime support presence assertion evidence as complete."]
          : []),
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT before recording multi-writer runtime support presence assertion evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT before recording multi-writer runtime support presence assertion evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX before recording multi-writer runtime support presence assertion evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE before recording multi-writer runtime support presence assertion evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL before recording multi-writer runtime support presence assertion evidence.",
        "Attach TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE before recording multi-writer runtime support presence assertion evidence.",
        "Keep multi-writer runtime release blocked after Phase 60 support presence assertion evidence; this phase records assertion evidence only and does not enable distributed, active-active, or multi-writer runtime support.",
      ]
      : ["Keep Phase 60 runtime support presence assertion evidence ready before any future multi-writer support assertion claim."],
  };
}

function attachmentEvidence(
  env: ReleaseEvidenceEnv,
  envKey: keyof ReleaseReadinessEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return {
    envKey,
    configured: configured(env[envKey]),
    ...redactValue(envKey, env[envKey]),
  };
}

function phase55ReviewAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  if (configured(env.TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW)) {
    return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW");
  }

  const reviewer = stringValue(env.TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER);
  const status = stringValue(env.TASKLOOM_MULTI_WRITER_REVIEW_STATUS);
  const configuredFromDetails = reviewer.length > 0 && status.length > 0;
  return {
    envKey: "TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER,TASKLOOM_MULTI_WRITER_REVIEW_STATUS",
    configured: configuredFromDetails,
    value: configuredFromDetails ? `${reviewer}; status=${status}` : null,
    redacted: false,
  };
}

function phase55AuthorizationAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  if (configured(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION)) {
    return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION");
  }

  const approver = stringValue(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER);
  const scope = stringValue(env.TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE);
  const safety = stringValue(env.TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF);
  const configuredFromDetails = approver.length > 0 && scope.length > 0 && safety.length > 0;
  return {
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER,TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE,TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF",
    configured: configuredFromDetails,
    value: configuredFromDetails ? `${approver}; scope=${scope}; safety=${safety}` : null,
    redacted: false,
  };
}

function phase56ImplementationReadinessAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  if (configured(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE)) {
    return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE");
  }

  const implementation = stringValue(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN);
  const validation = stringValue(env.TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN);
  const dataSafety = stringValue(env.TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN);
  const configuredFromDetails = implementation.length > 0 && validation.length > 0 && dataSafety.length > 0;
  return {
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN,TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN,TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN",
    configured: configuredFromDetails,
    value: configuredFromDetails ? "detailed Phase 56 implementation readiness evidence package" : null,
    redacted: false,
  };
}

function phase56RolloutSafetyAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  if (configured(env.TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE)) {
    return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE");
  }

  const rollout = stringValue(env.TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN);
  const cutover = stringValue(env.TASKLOOM_MULTI_WRITER_CUTOVER_PLAN);
  const rollbackDrill = stringValue(env.TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE);
  const configuredFromDetails = rollout.length > 0 && cutover.length > 0 && rollbackDrill.length > 0;
  return {
    envKey: "TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN,TASKLOOM_MULTI_WRITER_CUTOVER_PLAN,TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE",
    configured: configuredFromDetails,
    value: configuredFromDetails ? "detailed Phase 56 rollout-safety evidence package" : null,
    redacted: false,
  };
}

function phase57ImplementationScopeLockAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK");
}

function phase57RuntimeFeatureFlagAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG");
}

function phase57ValidationAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE");
}

function phase57MigrationCutoverLockAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK");
}

function phase57ReleaseOwnerSignoffAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF");
}

function phase58RuntimeImplementationAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE");
}

function phase58ConsistencyValidationAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE");
}

function phase58FailoverValidationAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE");
}

function phase58DataIntegrityValidationAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE");
}

function phase58OperationsRunbookAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK");
}

function phase58RuntimeReleaseSignoffAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF");
}

function phase59EnablementDecisionAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION");
}

function phase59EnablementApproverAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER");
}

function phase59RolloutWindowAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW");
}

function phase59MonitoringSignoffAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF");
}

function phase59AbortPlanAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN");
}

function phase59ReleaseTicketAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET");
}

function phase60ImplementationPresentAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT");
}

function phase60ExplicitSupportStatementAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT");
}

function phase60CompatibilityMatrixAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX");
}

function phase60CutoverEvidenceAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE");
}

function phase60ReleaseAutomationApprovalAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL");
}

function phase60OwnerAcceptanceAttachmentEvidence(
  env: ReleaseEvidenceEnv,
): Pick<ReleaseEvidenceAttachment, "envKey" | "configured" | "value" | "redacted"> {
  return attachmentEvidence(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE");
}

function buildAttachments(
  env: ReleaseEvidenceEnv,
  storageTopology: StorageTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport,
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  bundleReady: boolean,
): ReleaseEvidenceAttachment[] {
  const phase53Gate = phase53MultiWriterTopologyGate(asyncStoreBoundary);
  const phase55Gate = phase55MultiWriterImplementationAuthorizationGate(asyncStoreBoundary, phase53Gate);
  const phase56Gate = phase56MultiWriterRuntimeReadinessGate(asyncStoreBoundary, phase55Gate);
  const phase57Gate = phase57MultiWriterImplementationScopeGate(asyncStoreBoundary, phase56Gate);
  const phase58Gate = phase58MultiWriterRuntimeImplementationValidationGate(asyncStoreBoundary, phase57Gate);
  const phase59Gate = phase59MultiWriterRuntimeEnablementApprovalGate(asyncStoreBoundary, phase58Gate);
  const phase60Gate = phase60MultiWriterRuntimeSupportPresenceAssertionGate(asyncStoreBoundary, phase59Gate);
  return [
    {
      id: "phase-42-storage-topology",
      label: "Phase 42 storage topology report",
      format: "json",
      required: true,
      summary: storageTopology.summary,
    },
    {
      id: "phase-43-release-readiness",
      label: "Phase 43 release readiness report",
      format: "json",
      required: true,
      summary: releaseReadiness.summary,
    },
    {
      id: "phase-45-managed-database-topology",
      label: "Phase 45 managed database topology report",
      format: "json",
      required: true,
      summary: managedDatabaseTopology.summary,
    },
    {
      id: "phase-46-runtime-guard",
      label: "Phase 46 managed database runtime guard report",
      format: "json",
      required: true,
      summary: managedDatabaseRuntimeGuard.summary,
    },
    {
      id: "phase-48-managed-database-runtime-boundary",
      label: "Phase 48 managed database runtime boundary report",
      format: "json",
      required: true,
      summary: managedDatabaseRuntimeBoundary.summary,
    },
    {
      id: "phase-49-async-store-boundary",
      label: "Phase 49 async store boundary foundation report",
      format: "json",
      required: true,
      summary: asyncStoreBoundary.summary,
    },
    {
      id: "phase-50-managed-database-adapter",
      label: "Phase 50 managed database adapter/backfill evidence",
      format: "json",
      required: asyncStoreBoundary.managedDatabaseAdapterImplemented,
      summary: asyncStoreBoundary.managedDatabaseAdapterImplemented
        ? "Phase 50 async managed adapter/backfill capability is available; synchronous startup support remains false."
        : "Phase 50 async managed adapter/backfill capability is not configured.",
    },
    {
      id: "phase-51-runtime-call-site-migration",
      label: "Phase 51 runtime call-site migration evidence",
      format: "json",
      required: !asyncStoreBoundary.managedDatabaseRuntimeCallSitesMigrated || !asyncStoreBoundary.phase52ManagedStartupSupported,
      summary: asyncStoreBoundary.phase52ManagedStartupSupported
        ? "Phase 51 runtime call-site migration reports no remaining sync call-site groups and contributes to Phase 52 managed startup support."
        : asyncStoreBoundary.managedDatabaseRuntimeCallSitesMigrated
        ? "Phase 51 runtime call-site migration reports no remaining sync call-site groups; startup support still requires an explicit Phase 52 runtime support claim."
        : `Phase 51 runtime call-site migration remains incomplete; ${asyncStoreBoundary.managedDatabaseRemainingSyncCallSiteGroups.length} sync call-site group(s) still block managed Postgres startup.`,
    },
    {
      id: "phase-52-managed-postgres-startup-support",
      label: "Phase 52 managed Postgres startup support evidence",
      format: "json",
      required: asyncStoreBoundary.phase52ManagedStartupSupported,
      summary: asyncStoreBoundary.phase52ManagedStartupSupported
        ? "Phase 52 managed Postgres startup support is asserted with adapter/backfill and migrated call-site evidence."
        : "Phase 52 managed Postgres startup support is not asserted.",
    },
    {
      id: "phase-53-multi-writer-topology-requirements-design",
      label: "Phase 53 multi-writer topology requirements/design evidence",
      format: "json",
      required: phase53Gate.required,
      summary: phase53Gate.required
        ? "Phase 53 multi-writer topology requirements/design evidence is required before Phase 54 design-package review."
        : phase53Gate.summary,
    },
    {
      id: "phase-54-multi-writer-topology-design-package",
      label: "Phase 54 multi-writer topology design package",
      format: "json",
      required: phase53Gate.designPackageEvidenceRequired,
      summary: phase53Gate.designPackageEvidenceAttached
        ? "Phase 54 multi-writer topology design-package evidence is attached; runtime support remains blocked until a later implementation gate explicitly allows it."
        : "Phase 54 multi-writer topology design-package evidence is required before distributed, active-active, or multi-writer database release.",
    },
    ...phase53Gate.designPackageEvidence.map((item): ReleaseEvidenceAttachment => ({
      id: `phase-54-multi-writer-topology-${item.id}`,
      label: `Phase 54 multi-writer ${item.label.toLowerCase()} evidence`,
      format: "json",
      required: item.required,
      summary: item.summary,
    })),
    {
      id: "phase-55-multi-writer-topology-design-package-review",
      label: "Phase 55 multi-writer design-package review evidence",
      format: "json",
      required: phase55Gate.designPackageReviewEvidenceRequired,
      summary: phase55Gate.designPackageReviewEvidenceAttached
        ? "Phase 55 multi-writer design-package review evidence is attached."
        : "Phase 55 multi-writer design-package review evidence is required before runtime implementation work.",
      ...phase55ReviewAttachmentEvidence(env),
    },
    {
      id: "phase-55-multi-writer-topology-implementation-authorization",
      label: "Phase 55 multi-writer implementation authorization evidence",
      format: "json",
      required: phase55Gate.implementationAuthorizationEvidenceRequired,
      summary: phase55Gate.implementationAuthorizationEvidenceAttached
        ? "Phase 55 multi-writer implementation authorization evidence is attached; runtime release remains blocked."
        : "Phase 55 multi-writer implementation authorization evidence is required before runtime implementation work.",
      ...phase55AuthorizationAttachmentEvidence(env),
    },
    {
      id: "phase-56-multi-writer-runtime-implementation-readiness",
      label: "Phase 56 multi-writer runtime implementation readiness evidence",
      format: "json",
      required: phase56Gate.implementationReadinessEvidenceRequired,
      summary: phase56Gate.implementationReadinessEvidenceAttached
        ? "Phase 56 multi-writer runtime implementation readiness evidence is attached; runtime release remains blocked."
        : "Phase 56 multi-writer runtime implementation readiness evidence is required before any runtime support claim.",
      ...phase56ImplementationReadinessAttachmentEvidence(env),
    },
    {
      id: "phase-56-multi-writer-rollout-safety",
      label: "Phase 56 multi-writer rollout-safety evidence",
      format: "json",
      required: phase56Gate.rolloutSafetyEvidenceRequired,
      summary: phase56Gate.rolloutSafetyEvidenceAttached
        ? "Phase 56 multi-writer rollout-safety evidence is attached; runtime release remains blocked."
        : "Phase 56 multi-writer rollout-safety evidence is required before any runtime support claim.",
      ...phase56RolloutSafetyAttachmentEvidence(env),
    },
    {
      id: "phase-57-multi-writer-implementation-scope-lock",
      label: "Phase 57 multi-writer implementation scope lock evidence",
      format: "json",
      required: phase57Gate.implementationScopeLockRequired,
      summary: phase57Gate.implementationScopeLockAttached
        ? "Phase 57 multi-writer implementation scope lock evidence is attached; runtime release remains blocked."
        : "Phase 57 multi-writer implementation scope lock evidence is required before any runtime implementation scope claim.",
      ...phase57ImplementationScopeLockAttachmentEvidence(env),
    },
    {
      id: "phase-57-multi-writer-runtime-feature-flag",
      label: "Phase 57 multi-writer runtime feature-flag evidence",
      format: "json",
      required: phase57Gate.runtimeFeatureFlagRequired,
      summary: phase57Gate.runtimeFeatureFlagAttached
        ? "Phase 57 multi-writer runtime feature-flag evidence is attached; runtime release remains blocked."
        : "Phase 57 multi-writer runtime feature-flag evidence is required before any runtime implementation scope claim.",
      ...phase57RuntimeFeatureFlagAttachmentEvidence(env),
    },
    {
      id: "phase-57-multi-writer-validation-evidence",
      label: "Phase 57 multi-writer validation evidence",
      format: "json",
      required: phase57Gate.validationEvidenceRequired,
      summary: phase57Gate.validationEvidenceAttached
        ? "Phase 57 multi-writer validation evidence is attached; runtime release remains blocked."
        : "Phase 57 multi-writer validation evidence is required before any runtime implementation scope claim.",
      ...phase57ValidationAttachmentEvidence(env),
    },
    {
      id: "phase-57-multi-writer-migration-cutover-lock",
      label: "Phase 57 multi-writer migration cutover lock evidence",
      format: "json",
      required: phase57Gate.migrationCutoverLockRequired,
      summary: phase57Gate.migrationCutoverLockAttached
        ? "Phase 57 multi-writer migration cutover lock evidence is attached; runtime release remains blocked."
        : "Phase 57 multi-writer migration cutover lock evidence is required before any runtime implementation scope claim.",
      ...phase57MigrationCutoverLockAttachmentEvidence(env),
    },
    {
      id: "phase-57-multi-writer-release-owner-signoff",
      label: "Phase 57 multi-writer release owner signoff evidence",
      format: "json",
      required: phase57Gate.releaseOwnerSignoffRequired,
      summary: phase57Gate.releaseOwnerSignoffAttached
        ? "Phase 57 multi-writer release owner signoff evidence is attached; runtime release remains blocked."
        : "Phase 57 multi-writer release owner signoff evidence is required before any runtime implementation scope claim.",
      ...phase57ReleaseOwnerSignoffAttachmentEvidence(env),
    },
    {
      id: "phase-58-multi-writer-runtime-implementation-evidence",
      label: "Phase 58 multi-writer runtime implementation evidence",
      format: "json",
      required: phase58Gate.runtimeImplementationEvidenceRequired,
      summary: phase58Gate.runtimeImplementationEvidenceAttached
        ? "Phase 58 multi-writer runtime implementation evidence is attached; runtime release remains blocked."
        : "Phase 58 multi-writer runtime implementation evidence is required before any runtime validation claim.",
      ...phase58RuntimeImplementationAttachmentEvidence(env),
    },
    {
      id: "phase-58-multi-writer-consistency-validation",
      label: "Phase 58 multi-writer consistency validation evidence",
      format: "json",
      required: phase58Gate.consistencyValidationEvidenceRequired,
      summary: phase58Gate.consistencyValidationEvidenceAttached
        ? "Phase 58 multi-writer consistency validation evidence is attached; runtime release remains blocked."
        : "Phase 58 multi-writer consistency validation evidence is required before any runtime validation claim.",
      ...phase58ConsistencyValidationAttachmentEvidence(env),
    },
    {
      id: "phase-58-multi-writer-failover-validation",
      label: "Phase 58 multi-writer failover validation evidence",
      format: "json",
      required: phase58Gate.failoverValidationEvidenceRequired,
      summary: phase58Gate.failoverValidationEvidenceAttached
        ? "Phase 58 multi-writer failover validation evidence is attached; runtime release remains blocked."
        : "Phase 58 multi-writer failover validation evidence is required before any runtime validation claim.",
      ...phase58FailoverValidationAttachmentEvidence(env),
    },
    {
      id: "phase-58-multi-writer-data-integrity-validation",
      label: "Phase 58 multi-writer data integrity validation evidence",
      format: "json",
      required: phase58Gate.dataIntegrityValidationEvidenceRequired,
      summary: phase58Gate.dataIntegrityValidationEvidenceAttached
        ? "Phase 58 multi-writer data integrity validation evidence is attached; runtime release remains blocked."
        : "Phase 58 multi-writer data integrity validation evidence is required before any runtime validation claim.",
      ...phase58DataIntegrityValidationAttachmentEvidence(env),
    },
    {
      id: "phase-58-multi-writer-operations-runbook",
      label: "Phase 58 multi-writer operations runbook evidence",
      format: "json",
      required: phase58Gate.operationsRunbookRequired,
      summary: phase58Gate.operationsRunbookAttached
        ? "Phase 58 multi-writer operations runbook evidence is attached; runtime release remains blocked."
        : "Phase 58 multi-writer operations runbook evidence is required before any runtime validation claim.",
      ...phase58OperationsRunbookAttachmentEvidence(env),
    },
    {
      id: "phase-58-multi-writer-runtime-release-signoff",
      label: "Phase 58 multi-writer runtime release signoff evidence",
      format: "json",
      required: phase58Gate.runtimeReleaseSignoffRequired,
      summary: phase58Gate.runtimeReleaseSignoffAttached
        ? "Phase 58 multi-writer runtime release signoff evidence is attached; runtime release remains blocked."
        : "Phase 58 multi-writer runtime release signoff evidence is required before any runtime validation claim.",
      ...phase58RuntimeReleaseSignoffAttachmentEvidence(env),
    },
    {
      id: "phase-59-multi-writer-runtime-enablement-decision",
      label: "Phase 59 multi-writer runtime enablement decision evidence",
      format: "json",
      required: phase59Gate.enablementDecisionEvidenceRequired,
      summary: phase59Gate.enablementDecisionEvidenceAttached
        ? "Phase 59 multi-writer runtime enablement decision evidence is attached; runtime release remains blocked."
        : "Phase 59 multi-writer runtime enablement decision evidence is required before recording release-enable approval.",
      ...phase59EnablementDecisionAttachmentEvidence(env),
    },
    {
      id: "phase-59-multi-writer-runtime-enablement-approver",
      label: "Phase 59 multi-writer runtime enablement approver evidence",
      format: "json",
      required: phase59Gate.enablementApproverEvidenceRequired,
      summary: phase59Gate.enablementApproverEvidenceAttached
        ? "Phase 59 multi-writer runtime enablement approver evidence is attached; runtime release remains blocked."
        : "Phase 59 multi-writer runtime enablement approver evidence is required before recording release-enable approval.",
      ...phase59EnablementApproverAttachmentEvidence(env),
    },
    {
      id: "phase-59-multi-writer-runtime-enablement-rollout-window",
      label: "Phase 59 multi-writer runtime enablement rollout window evidence",
      format: "json",
      required: phase59Gate.rolloutWindowEvidenceRequired,
      summary: phase59Gate.rolloutWindowEvidenceAttached
        ? "Phase 59 multi-writer runtime enablement rollout window evidence is attached; runtime release remains blocked."
        : "Phase 59 multi-writer runtime enablement rollout window evidence is required before recording release-enable approval.",
      ...phase59RolloutWindowAttachmentEvidence(env),
    },
    {
      id: "phase-59-multi-writer-runtime-enablement-monitoring-signoff",
      label: "Phase 59 multi-writer runtime enablement monitoring signoff evidence",
      format: "json",
      required: phase59Gate.monitoringSignoffEvidenceRequired,
      summary: phase59Gate.monitoringSignoffEvidenceAttached
        ? "Phase 59 multi-writer runtime enablement monitoring signoff evidence is attached; runtime release remains blocked."
        : "Phase 59 multi-writer runtime enablement monitoring signoff evidence is required before recording release-enable approval.",
      ...phase59MonitoringSignoffAttachmentEvidence(env),
    },
    {
      id: "phase-59-multi-writer-runtime-enablement-abort-plan",
      label: "Phase 59 multi-writer runtime enablement abort plan evidence",
      format: "json",
      required: phase59Gate.abortPlanEvidenceRequired,
      summary: phase59Gate.abortPlanEvidenceAttached
        ? "Phase 59 multi-writer runtime enablement abort plan evidence is attached; runtime release remains blocked."
        : "Phase 59 multi-writer runtime enablement abort plan evidence is required before recording release-enable approval.",
      ...phase59AbortPlanAttachmentEvidence(env),
    },
    {
      id: "phase-59-multi-writer-runtime-enablement-release-ticket",
      label: "Phase 59 multi-writer runtime enablement release ticket evidence",
      format: "json",
      required: phase59Gate.releaseTicketEvidenceRequired,
      summary: phase59Gate.releaseTicketEvidenceAttached
        ? "Phase 59 multi-writer runtime enablement release ticket evidence is attached; runtime release remains blocked."
        : "Phase 59 multi-writer runtime enablement release ticket evidence is required before recording release-enable approval.",
      ...phase59ReleaseTicketAttachmentEvidence(env),
    },
    {
      id: "phase-60-multi-writer-runtime-support-implementation-present",
      label: "Phase 60 multi-writer runtime support implementation-present evidence",
      format: "json",
      required: phase60Gate.implementationPresentEvidenceRequired,
      summary: phase60Gate.implementationPresentEvidenceAttached
        ? "Phase 60 multi-writer runtime support implementation-present evidence is attached; runtime release remains blocked."
        : "Phase 60 multi-writer runtime support implementation-present evidence is required before recording support presence assertion evidence.",
      ...phase60ImplementationPresentAttachmentEvidence(env),
    },
    {
      id: "phase-60-multi-writer-runtime-support-explicit-support-statement",
      label: "Phase 60 multi-writer explicit runtime support statement evidence",
      format: "json",
      required: phase60Gate.explicitSupportStatementRequired,
      summary: phase60Gate.explicitSupportStatementAttached
        ? "Phase 60 multi-writer explicit runtime support statement evidence is attached; runtime release remains blocked."
        : "Phase 60 multi-writer explicit runtime support statement evidence is required before recording support presence assertion evidence.",
      ...phase60ExplicitSupportStatementAttachmentEvidence(env),
    },
    {
      id: "phase-60-multi-writer-runtime-support-compatibility-matrix",
      label: "Phase 60 multi-writer runtime support compatibility matrix evidence",
      format: "json",
      required: phase60Gate.compatibilityMatrixRequired,
      summary: phase60Gate.compatibilityMatrixAttached
        ? "Phase 60 multi-writer runtime support compatibility matrix evidence is attached; runtime release remains blocked."
        : "Phase 60 multi-writer runtime support compatibility matrix evidence is required before recording support presence assertion evidence.",
      ...phase60CompatibilityMatrixAttachmentEvidence(env),
    },
    {
      id: "phase-60-multi-writer-runtime-support-cutover-evidence",
      label: "Phase 60 multi-writer runtime support cutover evidence",
      format: "json",
      required: phase60Gate.cutoverEvidenceRequired,
      summary: phase60Gate.cutoverEvidenceAttached
        ? "Phase 60 multi-writer runtime support cutover evidence is attached; runtime release remains blocked."
        : "Phase 60 multi-writer runtime support cutover evidence is required before recording support presence assertion evidence.",
      ...phase60CutoverEvidenceAttachmentEvidence(env),
    },
    {
      id: "phase-60-multi-writer-runtime-support-release-automation-approval",
      label: "Phase 60 multi-writer runtime support release automation approval evidence",
      format: "json",
      required: phase60Gate.releaseAutomationApprovalRequired,
      summary: phase60Gate.releaseAutomationApprovalAttached
        ? "Phase 60 multi-writer runtime support release automation approval evidence is attached; runtime release remains blocked."
        : "Phase 60 multi-writer runtime support release automation approval evidence is required before recording support presence assertion evidence.",
      ...phase60ReleaseAutomationApprovalAttachmentEvidence(env),
    },
    {
      id: "phase-60-multi-writer-runtime-support-owner-acceptance",
      label: "Phase 60 multi-writer runtime support owner acceptance evidence",
      format: "json",
      required: phase60Gate.ownerAcceptanceRequired,
      summary: phase60Gate.ownerAcceptanceAttached
        ? "Phase 60 multi-writer runtime support owner acceptance evidence is attached; runtime release remains blocked."
        : "Phase 60 multi-writer runtime support owner acceptance evidence is required before recording support presence assertion evidence.",
      ...phase60OwnerAcceptanceAttachmentEvidence(env),
    },
    {
      id: "phase-44-release-evidence",
      label: "Phase 44 release evidence bundle",
      format: "json",
      required: true,
      summary: bundleReady
        ? "Release evidence bundle is ready for handoff."
        : "Release evidence bundle includes unresolved release blockers.",
    },
  ];
}

function buildSummary(
  releaseReadiness: ReleaseReadinessReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport,
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  readyForRelease: boolean,
): string {
  if (readyForRelease) {
    return `Phase 44 release evidence is ready for handoff. ${releaseReadiness.summary} ${managedDatabaseTopology.summary} ${managedDatabaseRuntimeGuard.summary} ${managedDatabaseRuntimeBoundary.summary} ${asyncStoreBoundary.summary}`;
  }

  const managedBlockers = Array.from(new Set([
    ...managedDatabaseTopology.blockers,
    ...managedDatabaseRuntimeGuard.blockers,
    ...managedDatabaseRuntimeBoundary.blockers,
    ...asyncStoreBoundary.blockers,
  ]));
  const managedDetail = managedBlockers.length > 0
    ? ` Managed DB blockers: ${managedBlockers.join(" ")}`
    : "";
  return `Phase 44 release evidence is blocked. ${releaseReadiness.summary} ${managedDatabaseTopology.summary} ${managedDatabaseRuntimeGuard.summary} ${managedDatabaseRuntimeBoundary.summary} ${asyncStoreBoundary.summary}${managedDetail}`;
}

function buildNextSteps(
  releaseReadiness: ReleaseReadinessReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport,
  asyncStoreBoundary: AsyncStoreBoundaryReport,
): string[] {
  return Array.from(new Set([
    ...releaseReadiness.nextSteps,
    ...managedDatabaseTopology.nextSteps,
    ...managedDatabaseRuntimeGuard.nextSteps,
    ...managedDatabaseRuntimeBoundary.nextSteps,
    ...asyncStoreBoundary.nextSteps,
  ]));
}

export function assessReleaseEvidence(input: ReleaseEvidenceInput = {}): ReleaseEvidenceBundle {
  const env = input.env ?? {};
  const generatedAt = generatedAtString(input.generatedAt);
  const buildStorageTopologyReport =
    input.buildStorageTopologyReport ?? defaultBuildStorageTopologyReport;
  const storageTopology =
    input.storageTopology ??
    input.releaseReadiness?.storageTopology ??
    buildStorageTopologyReport(storageEnv(env), input.probes);
  const releaseReadiness =
    input.releaseReadiness ??
    (input.buildReleaseReadinessReport ?? defaultBuildReleaseReadinessReport)(releaseEnv(env), {
      probes: input.probes,
      storageTopology,
      managedDatabaseTopology: input.managedDatabaseTopology,
      managedDatabaseRuntimeGuard: input.managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary: input.managedDatabaseRuntimeBoundary,
      asyncStoreBoundary: input.asyncStoreBoundary,
      strict: input.strict,
      buildStorageTopologyReport,
      buildManagedDatabaseTopologyReport: input.buildManagedDatabaseTopologyReport,
      buildManagedDatabaseRuntimeGuardReport: input.buildManagedDatabaseRuntimeGuardReport,
    });
  const releaseReadinessWithManagedReports = releaseReadiness as ReleaseReadinessWithManagedReports;
  const managedDatabaseTopology =
    input.managedDatabaseTopology ??
    releaseReadinessWithManagedReports.managedDatabaseTopology ??
    (input.buildManagedDatabaseTopologyReport ?? defaultBuildManagedDatabaseTopologyReport)(
      managedDatabaseTopologyEnv(env),
      input.managedDatabaseTopologyDeps,
    );
  const managedDatabaseRuntimeGuard =
    input.managedDatabaseRuntimeGuard ??
    releaseReadinessWithManagedReports.managedDatabaseRuntimeGuard ??
    (input.buildManagedDatabaseRuntimeGuardReport ?? defaultBuildManagedDatabaseRuntimeGuardReport)(
      managedDatabaseRuntimeGuardEnv(env),
      input.managedDatabaseRuntimeGuardDeps,
    );
  const managedDatabaseRuntimeBoundary =
    input.managedDatabaseRuntimeBoundary ??
    releaseReadinessWithManagedReports.managedDatabaseRuntimeBoundary ??
    buildManagedDatabaseRuntimeBoundaryReport(
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
    );
  const asyncStoreBoundary =
    input.asyncStoreBoundary ??
    releaseReadinessWithManagedReports.asyncStoreBoundary ??
    buildAsyncStoreBoundaryReport(
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary,
      releaseEnv(env),
    );
  const readyForRelease =
    releaseReadiness.readyForRelease &&
    managedDatabaseRuntimeBoundary.allowed &&
    asyncStoreBoundary.releaseAllowed;
  const releaseReadinessEvidence: ReleaseEvidenceReleaseReadinessReport = {
    ...releaseReadiness,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
    asyncStoreBoundary,
  };
  const phase53Gate = phase53MultiWriterTopologyGate(asyncStoreBoundary);
  const phase55Gate = phase55MultiWriterImplementationAuthorizationGate(asyncStoreBoundary, phase53Gate);
  const phase56Gate = phase56MultiWriterRuntimeReadinessGate(asyncStoreBoundary, phase55Gate);
  const phase57Gate = phase57MultiWriterImplementationScopeGate(asyncStoreBoundary, phase56Gate);
  const phase58Gate = phase58MultiWriterRuntimeImplementationValidationGate(asyncStoreBoundary, phase57Gate);
  const phase59Gate = phase59MultiWriterRuntimeEnablementApprovalGate(asyncStoreBoundary, phase58Gate);
  const phase60Gate = phase60MultiWriterRuntimeSupportPresenceAssertionGate(asyncStoreBoundary, phase59Gate);

  return {
    phase: "44",
    generatedAt,
    summary: buildSummary(
      releaseReadiness,
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary,
      asyncStoreBoundary,
      readyForRelease,
    ),
    readyForRelease,
    storageTopology,
    releaseReadiness: releaseReadinessEvidence,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
    asyncStoreBoundary,
    evidence: {
      environment: buildEnvironmentEvidence(env),
      config: {
        nodeEnv: storageTopology.observed.nodeEnv,
        storageMode: storageTopology.mode,
        storageClassification: storageTopology.classification,
        managedDatabaseTopologyStatus: managedDatabaseTopology.status,
        managedDatabaseTopologyClassification: managedDatabaseTopology.classification,
        managedDatabaseRuntimeGuardStatus: managedDatabaseRuntimeGuard.status,
        managedDatabaseRuntimeGuardClassification: managedDatabaseRuntimeGuard.classification,
        managedDatabaseRuntimeAllowed: managedDatabaseRuntimeGuard.allowed,
        managedDatabaseRuntimeBoundaryStatus: managedDatabaseRuntimeBoundary.status,
        managedDatabaseRuntimeBoundaryClassification: managedDatabaseRuntimeBoundary.classification,
        managedDatabaseRuntimeBoundaryAllowed: managedDatabaseRuntimeBoundary.allowed,
        asyncStoreBoundaryStatus: asyncStoreBoundary.status,
        asyncStoreBoundaryClassification: asyncStoreBoundary.classification,
        asyncStoreBoundaryFoundationAvailable: asyncStoreBoundary.foundationAvailable,
        asyncStoreBoundaryReleaseAllowed: asyncStoreBoundary.releaseAllowed,
        managedPostgresSupported: asyncStoreBoundary.managedPostgresSupported,
        phase52ManagedStartupSupported: asyncStoreBoundary.phase52ManagedStartupSupported,
        managedDatabaseAdapterImplemented: asyncStoreBoundary.managedDatabaseAdapterImplemented,
        managedDatabaseRepositoriesImplemented: asyncStoreBoundary.managedDatabaseRepositoriesImplemented,
        managedDatabaseBackfillAvailable: asyncStoreBoundary.managedDatabaseBackfillAvailable,
        managedDatabaseSyncStartupSupported: asyncStoreBoundary.managedDatabaseSyncStartupSupported,
        managedDatabaseRuntimeCallSiteMigrationTracked: asyncStoreBoundary.managedDatabaseRuntimeCallSiteMigrationTracked,
        managedDatabaseRuntimeCallSitesMigrated: asyncStoreBoundary.managedDatabaseRuntimeCallSitesMigrated,
        managedDatabaseRemainingSyncCallSiteGroups: asyncStoreBoundary.managedDatabaseRemainingSyncCallSiteGroups,
        phase53MultiWriterTopologyGateRequired: phase53Gate.required,
        phase53MultiWriterRequirementsEvidenceRequired: phase53Gate.requirementsEvidenceRequired,
        phase53MultiWriterDesignEvidenceRequired: phase53Gate.designEvidenceRequired,
        phase53MultiWriterDesignPackageEvidenceRequired: phase53Gate.designPackageEvidenceRequired,
        phase53MultiWriterRequirementsEvidenceAttached: phase53Gate.requirementsEvidenceAttached,
        phase53MultiWriterDesignEvidenceAttached: phase53Gate.designEvidenceAttached,
        phase53MultiWriterDesignPackageEvidenceAttached: phase53Gate.designPackageEvidenceAttached,
        phase53MultiWriterTopologyOwnerEvidenceRequired: phase53Gate.topologyOwnerEvidenceRequired,
        phase53MultiWriterTopologyOwnerEvidenceAttached: phase53EvidenceAttached(phase53Gate, "topology-owner"),
        phase53MultiWriterConsistencyModelEvidenceRequired: phase53Gate.consistencyModelEvidenceRequired,
        phase53MultiWriterConsistencyModelEvidenceAttached: phase53EvidenceAttached(phase53Gate, "consistency-model"),
        phase53MultiWriterFailoverPitrPlanEvidenceRequired: phase53Gate.failoverPitrPlanEvidenceRequired,
        phase53MultiWriterFailoverPitrPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "failover-pitr-plan"),
        phase53MultiWriterMigrationBackfillPlanEvidenceRequired: phase53Gate.migrationBackfillPlanEvidenceRequired,
        phase53MultiWriterMigrationBackfillPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "migration-backfill-plan"),
        phase53MultiWriterObservabilityPlanEvidenceRequired: phase53Gate.observabilityPlanEvidenceRequired,
        phase53MultiWriterObservabilityPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "observability-plan"),
        phase53MultiWriterRollbackPlanEvidenceRequired: phase53Gate.rollbackPlanEvidenceRequired,
        phase53MultiWriterRollbackPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "rollback-plan"),
        phase53MultiWriterTopologyReleaseAllowed: phase53Gate.releaseAllowed,
        phase54MultiWriterTopologyDesignPackageGateRequired: phase53Gate.designPackageEvidenceRequired,
        phase54MultiWriterDesignPackageEvidenceRequired: phase53Gate.designPackageEvidenceRequired,
        phase54MultiWriterDesignPackageEvidenceAttached: phase53Gate.designPackageEvidenceAttached,
        phase54MultiWriterTopologyOwnerEvidenceRequired: phase53Gate.topologyOwnerEvidenceRequired,
        phase54MultiWriterTopologyOwnerEvidenceAttached: phase53EvidenceAttached(phase53Gate, "topology-owner"),
        phase54MultiWriterConsistencyModelEvidenceRequired: phase53Gate.consistencyModelEvidenceRequired,
        phase54MultiWriterConsistencyModelEvidenceAttached: phase53EvidenceAttached(phase53Gate, "consistency-model"),
        phase54MultiWriterFailoverPitrPlanEvidenceRequired: phase53Gate.failoverPitrPlanEvidenceRequired,
        phase54MultiWriterFailoverPitrPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "failover-pitr-plan"),
        phase54MultiWriterMigrationBackfillPlanEvidenceRequired: phase53Gate.migrationBackfillPlanEvidenceRequired,
        phase54MultiWriterMigrationBackfillPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "migration-backfill-plan"),
        phase54MultiWriterObservabilityPlanEvidenceRequired: phase53Gate.observabilityPlanEvidenceRequired,
        phase54MultiWriterObservabilityPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "observability-plan"),
        phase54MultiWriterRollbackPlanEvidenceRequired: phase53Gate.rollbackPlanEvidenceRequired,
        phase54MultiWriterRollbackPlanEvidenceAttached: phase53EvidenceAttached(phase53Gate, "rollback-plan"),
        phase54MultiWriterTopologyReleaseAllowed: phase53Gate.releaseAllowed,
        phase55MultiWriterImplementationAuthorizationGateRequired: phase55Gate.required,
        phase55MultiWriterDesignPackageReviewEvidenceRequired: phase55Gate.designPackageReviewEvidenceRequired,
        phase55MultiWriterDesignPackageReviewEvidenceAttached: phase55Gate.designPackageReviewEvidenceAttached,
        phase55MultiWriterImplementationAuthorizationEvidenceRequired: phase55Gate.implementationAuthorizationEvidenceRequired,
        phase55MultiWriterImplementationAuthorizationEvidenceAttached: phase55Gate.implementationAuthorizationEvidenceAttached,
        phase55MultiWriterImplementationAuthorized: phase55Gate.implementationAuthorized,
        phase55MultiWriterRuntimeSupportBlocked: phase55Gate.runtimeSupportBlocked,
        phase55MultiWriterTopologyReleaseAllowed: phase55Gate.releaseAllowed,
        phase56MultiWriterRuntimeReadinessGateRequired: phase56Gate.required,
        phase56MultiWriterImplementationReadinessEvidenceRequired: phase56Gate.implementationReadinessEvidenceRequired,
        phase56MultiWriterImplementationReadinessEvidenceAttached: phase56Gate.implementationReadinessEvidenceAttached,
        phase56MultiWriterRolloutSafetyEvidenceRequired: phase56Gate.rolloutSafetyEvidenceRequired,
        phase56MultiWriterRolloutSafetyEvidenceAttached: phase56Gate.rolloutSafetyEvidenceAttached,
        phase56MultiWriterRuntimeImplementationReady: phase56Gate.runtimeImplementationReady,
        phase56MultiWriterRolloutSafetyReady: phase56Gate.rolloutSafetyReady,
        phase56MultiWriterRuntimeReadinessComplete: phase56Gate.runtimeReadinessComplete,
        phase56MultiWriterRuntimeSupportBlocked: phase56Gate.runtimeSupportBlocked,
        phase56MultiWriterTopologyReleaseAllowed: phase56Gate.releaseAllowed,
        phase57MultiWriterImplementationScopeGateRequired: phase57Gate.required,
        phase57MultiWriterRuntimeReadinessRequired: phase57Gate.runtimeReadinessRequired,
        phase57MultiWriterRuntimeReadinessComplete: phase57Gate.runtimeReadinessComplete,
        phase57MultiWriterImplementationScopeLockRequired: phase57Gate.implementationScopeLockRequired,
        phase57MultiWriterImplementationScopeLockAttached: phase57Gate.implementationScopeLockAttached,
        phase57MultiWriterRuntimeFeatureFlagRequired: phase57Gate.runtimeFeatureFlagRequired,
        phase57MultiWriterRuntimeFeatureFlagAttached: phase57Gate.runtimeFeatureFlagAttached,
        phase57MultiWriterValidationEvidenceRequired: phase57Gate.validationEvidenceRequired,
        phase57MultiWriterValidationEvidenceAttached: phase57Gate.validationEvidenceAttached,
        phase57MultiWriterMigrationCutoverLockRequired: phase57Gate.migrationCutoverLockRequired,
        phase57MultiWriterMigrationCutoverLockAttached: phase57Gate.migrationCutoverLockAttached,
        phase57MultiWriterReleaseOwnerSignoffRequired: phase57Gate.releaseOwnerSignoffRequired,
        phase57MultiWriterReleaseOwnerSignoffAttached: phase57Gate.releaseOwnerSignoffAttached,
        phase57MultiWriterImplementationScopeComplete: phase57Gate.implementationScopeComplete,
        phase57MultiWriterRuntimeSupportBlocked: phase57Gate.runtimeSupportBlocked,
        phase57MultiWriterTopologyReleaseAllowed: phase57Gate.releaseAllowed,
        phase58MultiWriterRuntimeImplementationValidationGateRequired: phase58Gate.required,
        phase58MultiWriterImplementationScopeRequired: phase58Gate.implementationScopeRequired,
        phase58MultiWriterImplementationScopeComplete: phase58Gate.implementationScopeComplete,
        phase58MultiWriterRuntimeImplementationEvidenceRequired: phase58Gate.runtimeImplementationEvidenceRequired,
        phase58MultiWriterRuntimeImplementationEvidenceAttached: phase58Gate.runtimeImplementationEvidenceAttached,
        phase58MultiWriterConsistencyValidationEvidenceRequired: phase58Gate.consistencyValidationEvidenceRequired,
        phase58MultiWriterConsistencyValidationEvidenceAttached: phase58Gate.consistencyValidationEvidenceAttached,
        phase58MultiWriterFailoverValidationEvidenceRequired: phase58Gate.failoverValidationEvidenceRequired,
        phase58MultiWriterFailoverValidationEvidenceAttached: phase58Gate.failoverValidationEvidenceAttached,
        phase58MultiWriterDataIntegrityValidationEvidenceRequired: phase58Gate.dataIntegrityValidationEvidenceRequired,
        phase58MultiWriterDataIntegrityValidationEvidenceAttached: phase58Gate.dataIntegrityValidationEvidenceAttached,
        phase58MultiWriterOperationsRunbookRequired: phase58Gate.operationsRunbookRequired,
        phase58MultiWriterOperationsRunbookAttached: phase58Gate.operationsRunbookAttached,
        phase58MultiWriterRuntimeReleaseSignoffRequired: phase58Gate.runtimeReleaseSignoffRequired,
        phase58MultiWriterRuntimeReleaseSignoffAttached: phase58Gate.runtimeReleaseSignoffAttached,
        phase58MultiWriterRuntimeImplementationValidationComplete: phase58Gate.runtimeImplementationValidationComplete,
        phase58MultiWriterRuntimeSupportBlocked: phase58Gate.runtimeSupportBlocked,
        phase58MultiWriterTopologyReleaseAllowed: phase58Gate.releaseAllowed,
        phase59MultiWriterRuntimeEnablementApprovalGateRequired: phase59Gate.required,
        phase59MultiWriterRuntimeImplementationValidationRequired: phase59Gate.runtimeImplementationValidationRequired,
        phase59MultiWriterRuntimeImplementationValidationComplete: phase59Gate.runtimeImplementationValidationComplete,
        phase59MultiWriterEnablementDecisionEvidenceRequired: phase59Gate.enablementDecisionEvidenceRequired,
        phase59MultiWriterEnablementDecisionEvidenceAttached: phase59Gate.enablementDecisionEvidenceAttached,
        phase59MultiWriterEnablementApproverEvidenceRequired: phase59Gate.enablementApproverEvidenceRequired,
        phase59MultiWriterEnablementApproverEvidenceAttached: phase59Gate.enablementApproverEvidenceAttached,
        phase59MultiWriterRolloutWindowEvidenceRequired: phase59Gate.rolloutWindowEvidenceRequired,
        phase59MultiWriterRolloutWindowEvidenceAttached: phase59Gate.rolloutWindowEvidenceAttached,
        phase59MultiWriterMonitoringSignoffEvidenceRequired: phase59Gate.monitoringSignoffEvidenceRequired,
        phase59MultiWriterMonitoringSignoffEvidenceAttached: phase59Gate.monitoringSignoffEvidenceAttached,
        phase59MultiWriterAbortPlanEvidenceRequired: phase59Gate.abortPlanEvidenceRequired,
        phase59MultiWriterAbortPlanEvidenceAttached: phase59Gate.abortPlanEvidenceAttached,
        phase59MultiWriterReleaseTicketEvidenceRequired: phase59Gate.releaseTicketEvidenceRequired,
        phase59MultiWriterReleaseTicketEvidenceAttached: phase59Gate.releaseTicketEvidenceAttached,
        phase59MultiWriterRuntimeEnablementApprovalComplete: phase59Gate.runtimeEnablementApprovalComplete,
        phase59MultiWriterRuntimeSupportBlocked: phase59Gate.runtimeSupportBlocked,
        phase59MultiWriterTopologyReleaseAllowed: phase59Gate.releaseAllowed,
        phase60MultiWriterRuntimeSupportPresenceAssertionGateRequired: phase60Gate.required,
        phase60MultiWriterRuntimeEnablementApprovalRequired: phase60Gate.runtimeEnablementApprovalRequired,
        phase60MultiWriterRuntimeEnablementApprovalComplete: phase60Gate.runtimeEnablementApprovalComplete,
        phase60MultiWriterImplementationPresentEvidenceRequired: phase60Gate.implementationPresentEvidenceRequired,
        phase60MultiWriterImplementationPresentEvidenceAttached: phase60Gate.implementationPresentEvidenceAttached,
        phase60MultiWriterExplicitSupportStatementRequired: phase60Gate.explicitSupportStatementRequired,
        phase60MultiWriterExplicitSupportStatementAttached: phase60Gate.explicitSupportStatementAttached,
        phase60MultiWriterCompatibilityMatrixRequired: phase60Gate.compatibilityMatrixRequired,
        phase60MultiWriterCompatibilityMatrixAttached: phase60Gate.compatibilityMatrixAttached,
        phase60MultiWriterCutoverEvidenceRequired: phase60Gate.cutoverEvidenceRequired,
        phase60MultiWriterCutoverEvidenceAttached: phase60Gate.cutoverEvidenceAttached,
        phase60MultiWriterReleaseAutomationApprovalRequired: phase60Gate.releaseAutomationApprovalRequired,
        phase60MultiWriterReleaseAutomationApprovalAttached: phase60Gate.releaseAutomationApprovalAttached,
        phase60MultiWriterOwnerAcceptanceRequired: phase60Gate.ownerAcceptanceRequired,
        phase60MultiWriterOwnerAcceptanceAttached: phase60Gate.ownerAcceptanceAttached,
        phase60MultiWriterRuntimeSupportPresenceAssertionComplete: phase60Gate.runtimeSupportPresenceAssertionComplete,
        phase60MultiWriterRuntimeSupportBlocked: phase60Gate.runtimeSupportBlocked,
        phase60MultiWriterTopologyReleaseAllowed: phase60Gate.releaseAllowed,
        strictRelease: input.strict === true || truthy(env.TASKLOOM_RELEASE_STRICT) || truthy(env.TASKLOOM_STRICT_RELEASE),
        backupConfigured: configured(env.TASKLOOM_BACKUP_DIR),
        restoreDrillRecorded: restoreDrillRecorded(env),
        artifactPathConfigured: artifactPathConfigured(env),
        accessLogMode: storageTopology.observed.accessLogMode,
      },
    },
    attachments: buildAttachments(
      env,
      storageTopology,
      releaseReadiness,
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary,
      asyncStoreBoundary,
      readyForRelease,
    ),
    nextSteps: buildNextSteps(
      releaseReadiness,
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary,
      asyncStoreBoundary,
    ),
  };
}

export function buildReleaseEvidenceBundle(
  env: ReleaseEvidenceEnv = {},
  deps: ReleaseEvidenceDeps & { generatedAt?: string | Date } = {},
): ReleaseEvidenceBundle {
  return assessReleaseEvidence({ env, ...deps });
}
