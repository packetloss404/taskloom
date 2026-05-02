import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { loadStore as defaultLoadStore, loadStoreAsync as defaultLoadStoreAsync } from "./taskloom-store.js";
import { getSchedulerHeartbeat as defaultSchedulerHeartbeat, type SchedulerHeartbeat } from "./jobs/scheduler-heartbeat.js";
import { redactedErrorMessage } from "./security/redaction.js";
import { buildStorageTopologyReport as defaultBuildStorageTopologyReport } from "./deployment/storage-topology.js";
import { buildManagedDatabaseTopologyReport as defaultBuildManagedDatabaseTopologyReport } from "./deployment/managed-database-topology.js";
import { buildManagedDatabaseRuntimeGuardReport as defaultBuildManagedDatabaseRuntimeGuardReport } from "./deployment/managed-database-runtime-guard.js";
import { buildReleaseReadinessReport as defaultBuildReleaseReadinessReport } from "./deployment/release-readiness.js";
import { buildReleaseEvidenceBundle as defaultBuildReleaseEvidenceBundle } from "./deployment/release-evidence.js";

export type SubsystemStatus = "ok" | "degraded" | "down" | "disabled";

export interface SubsystemHealth {
  name: string;
  status: SubsystemStatus;
  detail: string;
  checkedAt: string;
  observedAt?: string;
}

export interface OperationsHealthReport {
  generatedAt: string;
  overall: SubsystemStatus;
  subsystems: SubsystemHealth[];
}

export interface OperationsHealthDeps {
  loadStore?: () => unknown;
  schedulerHeartbeat?: () => SchedulerHeartbeat;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  fileExists?: (path: string) => boolean;
  schedulerStaleAfterMs?: number;
  buildStorageTopologyReport?: (env: NodeJS.ProcessEnv) => unknown;
  buildManagedDatabaseTopologyReport?: (env: NodeJS.ProcessEnv) => unknown;
  buildManagedDatabaseRuntimeGuardReport?: (env: NodeJS.ProcessEnv) => unknown;
  buildReleaseReadinessReport?: (env: NodeJS.ProcessEnv, deps?: OperationsHealthReleaseDeps) => unknown;
  buildReleaseEvidenceBundle?: (env: NodeJS.ProcessEnv, deps?: OperationsHealthEvidenceDeps) => unknown;
}

export interface OperationsHealthAsyncDeps extends Omit<OperationsHealthDeps, "loadStore"> {
  loadStore?: () => unknown | Promise<unknown>;
}

const DEFAULT_SCHEDULER_STALE_AFTER_MS = 60_000;

interface OperationsHealthReleaseDeps {
  storageTopology: unknown;
  managedDatabaseTopology: unknown;
  managedDatabaseRuntimeGuard: unknown;
}

interface OperationsHealthEvidenceDeps extends OperationsHealthReleaseDeps {
  releaseReadiness: unknown;
}

interface DeploymentReportSources {
  managedDatabaseRuntimeGuard: unknown;
  managedDatabaseTopology: unknown;
  releaseReadiness: unknown;
  releaseEvidence: unknown;
}

const MANAGED_POSTGRES_URL_HINT_KEYS = [
  "TASKLOOM_MANAGED_DATABASE_URL",
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
] as const;
const MULTI_WRITER_TOPOLOGY_HINTS = new Set([
  "active-active",
  "distributed",
  "multi-region",
  "multi-writer",
]);
const MANAGED_POSTGRES_TOPOLOGY_HINTS = new Set([
  "managed",
  "managed-db",
  "managed-database",
  "managed-postgres-horizontal-app-writers",
  "postgres",
  "postgresql",
  "single-writer",
]);
const MULTI_WRITER_TOPOLOGY_DESIGN_PACKAGE_EVIDENCE = [
  { key: "topologyOwner", label: "topology owner", envKey: "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER" },
  { key: "consistencyModel", label: "consistency model", envKey: "TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL" },
  { key: "failoverPitr", label: "failover/PITR evidence", envKey: "TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE" },
  { key: "migrationBackfill", label: "migration/backfill evidence", envKey: "TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE" },
  { key: "observability", label: "observability evidence", envKey: "TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE" },
  { key: "rollback", label: "rollback evidence", envKey: "TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE" },
] as const;
const MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_AUTHORIZATION_EVIDENCE = [
  { key: "designPackageReview", label: "design-package review", envKey: "TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW" },
  {
    key: "implementationAuthorization",
    label: "implementation authorization",
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION",
  },
] as const;
const MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_READINESS_EVIDENCE = [
  {
    key: "implementationReadiness",
    label: "implementation readiness evidence",
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE",
  },
  {
    key: "rolloutSafety",
    label: "rollout-safety evidence",
    envKey: "TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE",
  },
] as const;
const MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_SCOPE_EVIDENCE = [
  {
    key: "implementationScopeLock",
    label: "implementation-scope lock",
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK",
  },
  {
    key: "runtimeFeatureFlag",
    label: "runtime feature flag",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG",
  },
  {
    key: "validationEvidence",
    label: "validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE",
  },
  {
    key: "migrationCutoverLock",
    label: "migration cutover lock",
    envKey: "TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK",
  },
  {
    key: "releaseOwnerSignoff",
    label: "release owner signoff",
    envKey: "TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF",
  },
] as const;
const MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE = [
  {
    key: "runtimeImplementationEvidence",
    label: "runtime implementation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE",
  },
  {
    key: "consistencyValidationEvidence",
    label: "consistency validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE",
  },
  {
    key: "failoverValidationEvidence",
    label: "failover validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE",
  },
  {
    key: "dataIntegrityValidationEvidence",
    label: "data integrity validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE",
  },
  {
    key: "operationsRunbook",
    label: "operations runbook",
    envKey: "TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK",
  },
  {
    key: "runtimeReleaseSignoff",
    label: "runtime release signoff",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF",
  },
] as const;
const MULTI_WRITER_RUNTIME_RELEASE_ENABLEMENT_APPROVAL_EVIDENCE = [
  {
    key: "enablementDecision",
    label: "runtime enablement decision",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION",
  },
  {
    key: "approver",
    label: "runtime enablement approver",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER",
  },
  {
    key: "rolloutWindow",
    label: "runtime enablement rollout window",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW",
  },
  {
    key: "monitoringSignoff",
    label: "runtime enablement monitoring signoff",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF",
  },
  {
    key: "abortPlan",
    label: "runtime enablement abort plan",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN",
  },
  {
    key: "releaseTicket",
    label: "runtime enablement release ticket",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET",
  },
] as const;
const MULTI_WRITER_RUNTIME_SUPPORT_PRESENCE_ASSERTION_EVIDENCE = [
  {
    key: "implementationPresent",
    label: "runtime support implementation presence",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT",
  },
  {
    key: "explicitSupportStatement",
    label: "explicit runtime support statement",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT",
  },
  {
    key: "compatibilityMatrix",
    label: "runtime support compatibility matrix",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX",
  },
  {
    key: "cutoverEvidence",
    label: "runtime support cutover evidence",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE",
  },
  {
    key: "releaseAutomationApproval",
    label: "runtime support release automation approval",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL",
  },
  {
    key: "ownerAcceptance",
    label: "runtime support owner acceptance",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE",
  },
] as const;
const MULTI_WRITER_RUNTIME_ACTIVATION_CONTROLS_EVIDENCE = [
  {
    key: "activationDecision",
    label: "runtime activation decision",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION",
    reportKeys: ["activationDecision", "runtimeActivationDecision", "decision", "activationControlDecision"],
  },
  {
    key: "activationOwner",
    label: "runtime activation owner",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER",
    reportKeys: ["activationOwner", "runtimeActivationOwner", "owner", "activationControlOwner"],
  },
  {
    key: "activationWindow",
    label: "runtime activation window",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW",
    reportKeys: ["activationWindow", "runtimeActivationWindow", "window", "activationControlWindow"],
  },
  {
    key: "activationFlag",
    label: "runtime activation flag",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG",
    reportKeys: ["activationFlag", "runtimeActivationFlag", "featureFlag", "flag", "activationControlFlag"],
  },
  {
    key: "releaseAutomationAssertion",
    label: "runtime activation release automation assertion",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_RELEASE_AUTOMATION_ASSERTION",
    reportKeys: [
      "releaseAutomationAssertion",
      "runtimeActivationReleaseAutomationAssertion",
      "activationReleaseAutomationAssertion",
      "automationAssertion",
    ],
  },
] as const;
const MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_EVIDENCE = [
  {
    key: "writePathAudit",
    label: "managed Postgres write-path concurrency audit",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_AUDIT",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_AUDIT",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION",
    ],
    reportKeys: ["writePathAudit", "horizontalWriterAudit", "concurrencyAudit", "staleWriteAudit", "audit"],
  },
  {
    key: "concurrentWriterTests",
    label: "managed Postgres concurrent-writer tests",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TESTS",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TESTS",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE",
    ],
    reportKeys: ["concurrentWriterTests", "horizontalWriterTests", "concurrencyTests", "runtimeTests", "tests"],
  },
  {
    key: "concurrencyControl",
    label: "managed Postgres concurrency-control implementation",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_CONTROL",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_CONTROL",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION",
    ],
    reportKeys: ["concurrencyControl", "compareAndSwap", "rowVersion", "advisoryLock", "optimisticConcurrency"],
  },
  {
    key: "transactionRetry",
    label: "managed Postgres transaction retry/idempotency proof",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE",
    ],
    reportKeys: ["transactionRetry", "retryBehavior", "transactionBoundaries", "idempotencyProof", "idempotency"],
  },
  {
    key: "releaseAssertion",
    label: "managed Postgres horizontal-writer release assertion",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_RELEASE_ASSERTION",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_RELEASE_ASSERTION",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION",
    ],
    reportKeys: [
      "releaseAssertion",
      "horizontalWriterReleaseAssertion",
      "hardeningReleaseAssertion",
      "releaseAutomationAssertion",
      "assertion",
    ],
  },
] as const;
const DISTRIBUTED_DEPENDENCY_DEFINITIONS = [
  {
    key: "distributedRateLimiting",
    label: "distributed rate limiting",
    reportKeys: ["distributedRateLimiting", "rateLimiting", "rateLimit"],
  },
  {
    key: "schedulerCoordination",
    label: "scheduler coordination",
    reportKeys: ["schedulerCoordination", "schedulerLeader", "leaderElection"],
  },
  {
    key: "durableJobExecution",
    label: "durable job execution",
    reportKeys: ["durableJobExecution", "durableJobs", "jobExecution"],
  },
  {
    key: "accessLogShipping",
    label: "access-log shipping",
    reportKeys: ["accessLogShipping", "accessLogs", "logShipping"],
  },
  {
    key: "alertDelivery",
    label: "alert delivery",
    reportKeys: ["alertDelivery", "alerts", "alerting"],
  },
  {
    key: "healthMonitoring",
    label: "health monitoring",
    reportKeys: ["healthMonitoring", "monitoring", "healthChecks"],
  },
] as const;
const DURABLE_JOB_EXECUTION_POSTURES = new Set([
  "managed-postgres-transactional-queue",
  "managed-postgres-durable-jobs",
  "shared-managed-postgres",
  "external-durable-queue",
]);
const MANAGED_POSTGRES_RECOVERY_VALIDATION_EVIDENCE = [
  {
    key: "backupRestore",
    label: "backup restore evidence",
    envKey: "TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE",
      "TASKLOOM_RECOVERY_BACKUP_RESTORE_EVIDENCE",
    ],
    reportKeys: ["backupRestore", "backupRestoreEvidence", "restoreValidation", "restoreEvidence"],
  },
  {
    key: "pitrRehearsal",
    label: "PITR rehearsal evidence",
    envKey: "TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE",
      "TASKLOOM_RECOVERY_PITR_REHEARSAL_EVIDENCE",
    ],
    reportKeys: ["pitrRehearsal", "pitrRehearsalEvidence", "pointInTimeRecovery", "pitrEvidence"],
  },
  {
    key: "failoverRehearsal",
    label: "failover rehearsal evidence",
    envKey: "TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE",
      "TASKLOOM_RECOVERY_FAILOVER_REHEARSAL_EVIDENCE",
    ],
    reportKeys: ["failoverRehearsal", "failoverRehearsalEvidence", "failoverValidation", "failoverEvidence"],
  },
  {
    key: "dataIntegrityValidation",
    label: "data-integrity validation",
    envKey: "TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE",
      "TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION",
      "TASKLOOM_RECOVERY_DATA_INTEGRITY_VALIDATION",
      "TASKLOOM_RECOVERY_DATA_INTEGRITY_EVIDENCE",
    ],
    reportKeys: ["dataIntegrityValidation", "dataIntegrityEvidence", "integrityValidation", "integrityEvidence"],
  },
  {
    key: "recoveryTimeExpectations",
    label: "recovery-time expectations",
    envKey: "TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION",
      "TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATIONS",
      "TASKLOOM_RECOVERY_TIME_EXPECTATIONS",
      "TASKLOOM_RECOVERY_RTO_RPO_EXPECTATIONS",
    ],
    reportKeys: ["recoveryTimeExpectations", "recoveryTimeEvidence", "rtoRpoExpectations", "rtoRpoEvidence"],
  },
] as const;
const MANAGED_POSTGRES_CUTOVER_AUTOMATION_EVIDENCE = [
  {
    key: "cutoverPreflight",
    label: "cutover preflight evidence",
    envKey: "TASKLOOM_CUTOVER_PREFLIGHT_EVIDENCE",
    envKeys: ["TASKLOOM_CUTOVER_PREFLIGHT_EVIDENCE", "TASKLOOM_MANAGED_POSTGRES_CUTOVER_PREFLIGHT_EVIDENCE"],
    statusEnvKeys: ["TASKLOOM_CUTOVER_PREFLIGHT_STATUS", "TASKLOOM_MANAGED_POSTGRES_CUTOVER_PREFLIGHT_STATUS"],
    reportKeys: ["cutoverPreflight", "cutoverPreflightEvidence", "preflightEvidence"],
    statusReportKeys: ["cutoverPreflightStatus", "preflightStatus"],
  },
  {
    key: "activationDryRun",
    label: "activation dry-run evidence",
    envKey: "TASKLOOM_ACTIVATION_DRY_RUN_EVIDENCE",
    envKeys: ["TASKLOOM_ACTIVATION_DRY_RUN_EVIDENCE", "TASKLOOM_MANAGED_POSTGRES_ACTIVATION_DRY_RUN_EVIDENCE"],
    statusEnvKeys: ["TASKLOOM_ACTIVATION_DRY_RUN_STATUS", "TASKLOOM_MANAGED_POSTGRES_ACTIVATION_DRY_RUN_STATUS"],
    reportKeys: ["activationDryRun", "activationDryRunEvidence", "dryRunEvidence"],
    statusReportKeys: ["activationDryRunStatus", "dryRunStatus"],
  },
  {
    key: "postActivationSmoke",
    label: "post-activation smoke-check evidence",
    envKey: "TASKLOOM_POST_ACTIVATION_SMOKE_EVIDENCE",
    envKeys: [
      "TASKLOOM_POST_ACTIVATION_SMOKE_EVIDENCE",
      "TASKLOOM_POST_ACTIVATION_SMOKE_CHECK_EVIDENCE",
      "TASKLOOM_MANAGED_POSTGRES_POST_ACTIVATION_SMOKE_EVIDENCE",
    ],
    statusEnvKeys: ["TASKLOOM_POST_ACTIVATION_SMOKE_STATUS", "TASKLOOM_MANAGED_POSTGRES_POST_ACTIVATION_SMOKE_STATUS"],
    reportKeys: ["postActivationSmoke", "postActivationSmokeEvidence", "smokeEvidence", "smokeChecks"],
    statusReportKeys: ["postActivationSmokeStatus", "smokeStatus", "smokeCheckStatus"],
  },
  {
    key: "rollbackCommandGuidance",
    label: "rollback command guidance",
    envKey: "TASKLOOM_ROLLBACK_COMMAND_GUIDANCE",
    envKeys: ["TASKLOOM_ROLLBACK_COMMAND_GUIDANCE", "TASKLOOM_MANAGED_POSTGRES_ROLLBACK_COMMAND_GUIDANCE"],
    statusEnvKeys: [],
    reportKeys: ["rollbackCommandGuidance", "rollbackGuidance", "rollbackCommands"],
    statusReportKeys: [],
  },
  {
    key: "monitoringThresholds",
    label: "monitoring thresholds",
    envKey: "TASKLOOM_MONITORING_THRESHOLDS",
    envKeys: [
      "TASKLOOM_MONITORING_THRESHOLDS",
      "TASKLOOM_MONITORING_THRESHOLD_EVIDENCE",
      "TASKLOOM_MANAGED_POSTGRES_MONITORING_THRESHOLDS",
    ],
    statusEnvKeys: [],
    reportKeys: ["monitoringThresholds", "observabilityThresholds", "activationMonitoringThresholds"],
    statusReportKeys: [],
  },
] as const;
const FINAL_RELEASE_CLOSURE_EVIDENCE = [
  {
    key: "supportedProductionTopology",
    label: "supported production topology statement",
    envKeys: ["TASKLOOM_PHASE66_SUPPORTED_PRODUCTION_TOPOLOGY", "TASKLOOM_SUPPORTED_PRODUCTION_TOPOLOGY"],
    statusEnvKeys: [
      "TASKLOOM_PHASE66_SUPPORTED_PRODUCTION_TOPOLOGY_STATUS",
      "TASKLOOM_SUPPORTED_PRODUCTION_TOPOLOGY_STATUS",
    ],
    reportKeys: ["supportedProductionTopology", "supportedTopology", "productionTopology"],
    statusReportKeys: ["supportedProductionTopologyStatus", "supportedTopologyStatus", "productionTopologyStatus"],
  },
  {
    key: "unsupportedTopologyBoundaries",
    label: "unsupported topology boundaries",
    envKeys: ["TASKLOOM_PHASE66_UNSUPPORTED_TOPOLOGY_BOUNDARIES", "TASKLOOM_UNSUPPORTED_TOPOLOGY_BOUNDARIES"],
    statusEnvKeys: [
      "TASKLOOM_PHASE66_UNSUPPORTED_TOPOLOGY_BOUNDARIES_STATUS",
      "TASKLOOM_UNSUPPORTED_TOPOLOGY_BOUNDARIES_STATUS",
    ],
    reportKeys: ["unsupportedTopologyBoundaries", "unsupportedTopologies", "topologyBoundaries"],
    statusReportKeys: ["unsupportedTopologyBoundariesStatus", "unsupportedTopologiesStatus", "topologyBoundariesStatus"],
  },
  {
    key: "finalReleaseChecklist",
    label: "final release checklist",
    envKeys: ["TASKLOOM_PHASE66_FINAL_RELEASE_CHECKLIST", "TASKLOOM_FINAL_RELEASE_CHECKLIST"],
    statusEnvKeys: ["TASKLOOM_PHASE66_FINAL_RELEASE_CHECKLIST_STATUS", "TASKLOOM_FINAL_RELEASE_CHECKLIST_STATUS"],
    reportKeys: ["finalReleaseChecklist", "releaseChecklist", "checklist"],
    statusReportKeys: ["finalReleaseChecklistStatus", "releaseChecklistStatus", "checklistStatus"],
  },
  {
    key: "validationRun",
    label: "full validation run",
    envKeys: [
      "TASKLOOM_PHASE66_VALIDATION_RUN",
      "TASKLOOM_FINAL_VERIFICATION_EVIDENCE",
      "TASKLOOM_FINAL_RELEASE_VALIDATION_RUN",
      "TASKLOOM_FINAL_RELEASE_VALIDATION_EVIDENCE",
    ],
    statusEnvKeys: ["TASKLOOM_PHASE66_VALIDATION_STATUS", "TASKLOOM_FINAL_RELEASE_VALIDATION_STATUS"],
    reportKeys: ["validationRun", "validationEvidence", "fullValidationRun", "typecheckTestsBuild"],
    statusReportKeys: ["validationStatus", "validationRunStatus", "fullValidationStatus"],
  },
  {
    key: "deploymentCliChecks",
    label: "deployment CLI checks",
    envKeys: ["TASKLOOM_PHASE66_DEPLOYMENT_CLI_CHECKS", "TASKLOOM_DEPLOYMENT_CLI_CHECKS"],
    statusEnvKeys: ["TASKLOOM_PHASE66_DEPLOYMENT_CLI_STATUS", "TASKLOOM_DEPLOYMENT_CLI_CHECKS_STATUS"],
    reportKeys: ["deploymentCliChecks", "deploymentCliEvidence", "deploymentChecks"],
    statusReportKeys: ["deploymentCliStatus", "deploymentCliChecksStatus", "deploymentChecksStatus"],
  },
  {
    key: "docsConsistencyChecks",
    label: "docs consistency checks",
    envKeys: ["TASKLOOM_PHASE66_DOCS_CONSISTENCY_CHECKS", "TASKLOOM_DOCS_CONSISTENCY_CHECKS"],
    statusEnvKeys: ["TASKLOOM_PHASE66_DOCS_CONSISTENCY_STATUS", "TASKLOOM_DOCS_CONSISTENCY_CHECKS_STATUS"],
    reportKeys: ["docsConsistencyChecks", "docsConsistencyEvidence", "documentationConsistencyChecks"],
    statusReportKeys: ["docsConsistencyStatus", "docsConsistencyChecksStatus", "documentationConsistencyStatus"],
  },
  {
    key: "documentationFreeze",
    label: "documentation freeze",
    envKeys: [
      "TASKLOOM_PHASE66_DOCUMENTATION_FREEZE",
      "TASKLOOM_DOCUMENTATION_FREEZE_ASSERTION",
      "TASKLOOM_DOCUMENTATION_FREEZE_EVIDENCE",
      "TASKLOOM_DOCUMENTATION_FREEZE",
    ],
    statusEnvKeys: ["TASKLOOM_PHASE66_DOCUMENTATION_FREEZE_STATUS", "TASKLOOM_DOCUMENTATION_FREEZE_STATUS"],
    reportKeys: ["documentationFreeze", "documentationFreezeEvidence", "docsFreeze"],
    statusReportKeys: ["documentationFreezeStatus", "docsFreezeStatus"],
  },
  {
    key: "noHiddenPhaseAssertion",
    label: "no-hidden-phase assertion",
    envKeys: ["TASKLOOM_NO_HIDDEN_PHASE_ASSERTION", "TASKLOOM_PHASE66_NO_HIDDEN_PHASE_ASSERTION"],
    statusEnvKeys: ["TASKLOOM_NO_HIDDEN_PHASE_ASSERTION_STATUS", "TASKLOOM_PHASE66_NO_HIDDEN_PHASE_ASSERTION_STATUS"],
    reportKeys: ["noHiddenPhaseAssertion", "noHiddenPhaseAssertionEvidence", "noHiddenFollowUpPhase"],
    statusReportKeys: ["noHiddenPhaseAssertionStatus", "noHiddenFollowUpPhaseStatus"],
  },
  {
    key: "releaseApproval",
    label: "final release approval",
    envKeys: ["TASKLOOM_PHASE66_RELEASE_APPROVAL", "TASKLOOM_RELEASE_APPROVAL", "TASKLOOM_FINAL_RELEASE_APPROVAL"],
    statusEnvKeys: ["TASKLOOM_PHASE66_RELEASE_APPROVAL_STATUS", "TASKLOOM_FINAL_RELEASE_APPROVAL_STATUS"],
    reportKeys: ["releaseApproval", "finalReleaseApproval", "approval"],
    statusReportKeys: ["releaseApprovalStatus", "finalReleaseApprovalStatus", "approvalStatus"],
  },
] as const;

function cleanEnvValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function findNestedRecord(record: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> | null {
  let current: unknown = record;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

function valueFromRecord(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = cleanEnvValue(record[key]);
    if (value) return value;
  }
  return "";
}

function valueFromEnvKeys(env: NodeJS.ProcessEnv, keys: readonly string[]): string {
  for (const key of keys) {
    const value = cleanEnvValue(env[key]);
    if (value) return value;
  }
  return "";
}

function phase62ReportHardeningComplete(records: readonly Record<string, unknown>[]): boolean {
  return records.some((record) => {
    const required =
      record.required === true ||
      record.horizontalWriterTopologyRequested === true ||
      record.horizontalAppWriterIntentDetected === true ||
      record.phase62HorizontalWriterTopologyRequested === true;
    return required &&
      (record.managedPostgresHorizontalWriterHardeningComplete === true ||
        record.horizontalWriterHardeningReady === true ||
        record.horizontalWriterRuntimeSupported === true ||
        record.phase62HorizontalWriterHardeningReady === true ||
        record.phase62HorizontalWriterRuntimeSupported === true);
  });
}

function booleanFromRecord(record: Record<string, unknown>, key: string): boolean | undefined {
  return typeof record[key] === "boolean" ? record[key] : undefined;
}

function runtimeSupportPresenceAssertionRecord(report: unknown): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase60"]) ??
    findNestedRecord(report, ["multiWriterRuntimeSupportPresenceAssertion"]) ??
    findNestedRecord(report, ["multiWriterRuntimeSupportPresenceAssertionGate"]) ??
    findNestedRecord(report, ["multiWriterRuntimeSupportPresence"]) ??
    findNestedRecord(report, ["multiWriterRuntimeSupport"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase60"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterRuntimeSupportPresenceAssertion"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase60"]) ??
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "multiWriterRuntimeSupportPresenceAssertion"],
    );
}

function runtimeActivationControlsRecord(report: unknown): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase61"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivationControls"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivationControlsGate"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivation"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivationControlGate"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase61"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterRuntimeActivationControls"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase61"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "multiWriterRuntimeActivationControls"]);
}

function horizontalWriterConcurrencyRecord(report: unknown): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase62"]) ??
    findNestedRecord(report, ["managedPostgresHorizontalWriterConcurrency"]) ??
    findNestedRecord(report, ["managedPostgresHorizontalWriterConcurrencyHardening"]) ??
    findNestedRecord(report, ["horizontalWriterConcurrency"]) ??
    findNestedRecord(report, ["horizontalWriterConcurrencyHardening"]) ??
    findNestedRecord(report, ["managedDatabase", "phase62"]) ??
    findNestedRecord(report, ["managedPostgres", "phase62"]) ??
    findNestedRecord(report, ["managedPostgres", "horizontalWriterConcurrency"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase62"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase62ManagedPostgresHorizontalWriterHardeningGate"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "managedPostgresHorizontalWriterConcurrency"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase62"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase62ManagedPostgresHorizontalWriterHardeningGate"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "managedPostgresHorizontalWriterConcurrency"]);
}

function distributedDependencyEnforcementRecord(report: unknown): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase63"]) ??
    findNestedRecord(report, ["distributedDependencyEnforcement"]) ??
    findNestedRecord(report, ["distributedDependencyEnforcementGate"]) ??
    findNestedRecord(report, ["distributedDependencies"]) ??
    findNestedRecord(report, ["productionDependencies"]) ??
    findNestedRecord(report, ["runtimeGuard", "phase63"]) ??
    findNestedRecord(report, ["runtimeGuard", "distributedDependencyEnforcement"]) ??
    findNestedRecord(report, ["releaseReadiness", "phase63"]) ??
    findNestedRecord(report, ["releaseReadiness", "distributedDependencyEnforcement"]) ??
    findNestedRecord(report, ["releaseReadiness", "distributedDependencies"]);
}

function recoveryValidationRecord(report: unknown): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase64"]) ??
    findNestedRecord(report, ["managedPostgresRecoveryValidation"]) ??
    findNestedRecord(report, ["managedPostgresRecoveryValidationGate"]) ??
    findNestedRecord(report, ["recoveryValidation"]) ??
    findNestedRecord(report, ["failoverPitrRecoveryValidation"]) ??
    findNestedRecord(report, ["managedDatabase", "phase64"]) ??
    findNestedRecord(report, ["managedPostgres", "phase64"]) ??
    findNestedRecord(report, ["managedPostgres", "recoveryValidation"]) ??
    findNestedRecord(report, ["runtimeGuard", "phase64"]) ??
    findNestedRecord(report, ["releaseReadiness", "phase64"]) ??
    findNestedRecord(report, ["releaseReadiness", "managedPostgresRecoveryValidation"]) ??
    findNestedRecord(report, ["releaseReadiness", "recoveryValidation"]);
}

function cutoverAutomationRecord(report: unknown): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase65"]) ??
    findNestedRecord(report, ["managedPostgresCutoverAutomation"]) ??
    findNestedRecord(report, ["managedPostgresCutoverAutomationGate"]) ??
    findNestedRecord(report, ["cutoverAutomation"]) ??
    findNestedRecord(report, ["cutoverRollbackObservabilityAutomation"]) ??
    findNestedRecord(report, ["managedDatabase", "phase65"]) ??
    findNestedRecord(report, ["managedPostgres", "phase65"]) ??
    findNestedRecord(report, ["managedPostgres", "cutoverAutomation"]) ??
    findNestedRecord(report, ["runtimeGuard", "phase65"]) ??
    findNestedRecord(report, ["releaseReadiness", "phase65"]) ??
    findNestedRecord(report, ["releaseReadiness", "managedPostgresCutoverAutomation"]) ??
    findNestedRecord(report, ["releaseReadiness", "cutoverAutomation"]);
}

function finalReleaseClosureRecord(report: unknown): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase66"]) ??
    findNestedRecord(report, ["finalReleaseClosure"]) ??
    findNestedRecord(report, ["finalReleaseClosureGate"]) ??
    findNestedRecord(report, ["releaseClosure"]) ??
    findNestedRecord(report, ["documentationFreeze"]) ??
    findNestedRecord(report, ["managedDatabase", "phase66"]) ??
    findNestedRecord(report, ["managedPostgres", "phase66"]) ??
    findNestedRecord(report, ["runtimeGuard", "phase66"]) ??
    findNestedRecord(report, ["releaseReadiness", "phase66"]) ??
    findNestedRecord(report, ["releaseReadiness", "finalReleaseClosure"]) ??
    findNestedRecord(report, ["releaseReadiness", "documentationFreeze"]);
}

function distributedDependencyRecord(
  phase63: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const direct = phase63[key];
    if (isRecord(direct)) return direct;
  }
  for (const containerKey of ["dependencies", "dependencyStates", "checks"] as const) {
    const container = phase63[containerKey];
    if (isRecord(container)) {
      for (const key of keys) {
        const nested = container[key];
        if (isRecord(nested)) return nested;
      }
    }
    if (Array.isArray(container)) {
      for (const entry of container) {
        if (!isRecord(entry)) continue;
        const id = cleanEnvValue(entry.key) || cleanEnvValue(entry.id) || cleanEnvValue(entry.name);
        if (keys.includes(id)) return entry;
      }
    }
  }
  return null;
}

function checkStore(loadStore: () => unknown, checkedAt: string): SubsystemHealth {
  try {
    const result = loadStore();
    if (result && typeof result === "object") {
      return { name: "store", status: "ok", detail: "loaded successfully", checkedAt };
    }
    return { name: "store", status: "down", detail: "store returned an unexpected shape", checkedAt };
  } catch (error) {
    return {
      name: "store",
      status: "down",
      detail: `store load failed: ${redactedErrorMessage(error)}`,
      checkedAt,
    };
  }
}

async function checkStoreAsync(loadStore: () => unknown | Promise<unknown>, checkedAt: string): Promise<SubsystemHealth> {
  try {
    const result = await loadStore();
    if (result && typeof result === "object") {
      return { name: "store", status: "ok", detail: "loaded successfully", checkedAt };
    }
    return { name: "store", status: "down", detail: "store returned an unexpected shape", checkedAt };
  } catch (error) {
    return {
      name: "store",
      status: "down",
      detail: `store load failed: ${redactedErrorMessage(error)}`,
      checkedAt,
    };
  }
}

function checkScheduler(
  heartbeat: SchedulerHeartbeat,
  now: Date,
  staleAfterMs: number,
  checkedAt: string,
): SubsystemHealth {
  if (heartbeat.schedulerStartedAt === null) {
    return {
      name: "scheduler",
      status: "down",
      detail: "scheduler has not been started in this process",
      checkedAt,
    };
  }
  if (heartbeat.lastTickEndedAt === null) {
    return {
      name: "scheduler",
      status: "degraded",
      detail: "scheduler has started but no tick has completed yet",
      checkedAt,
    };
  }
  const tickEndedMs = Date.parse(heartbeat.lastTickEndedAt);
  const tickAge = now.getTime() - tickEndedMs;
  if (tickAge > staleAfterMs) {
    const seconds = Math.round(tickAge / 1000);
    return {
      name: "scheduler",
      status: "degraded",
      detail: `last tick was ${seconds}s ago`,
      checkedAt,
      observedAt: heartbeat.lastTickEndedAt,
    };
  }
  return {
    name: "scheduler",
    status: "ok",
    detail: `last tick ${tickAge}ms ago, ticksSinceStart=${heartbeat.ticksSinceStart}`,
    checkedAt,
    observedAt: heartbeat.lastTickEndedAt,
  };
}

function checkAccessLog(
  env: NodeJS.ProcessEnv,
  fileExists: (path: string) => boolean,
  checkedAt: string,
): SubsystemHealth {
  const mode = (env.TASKLOOM_ACCESS_LOG_MODE ?? "").trim().toLowerCase() || "off";
  if (mode === "off") {
    return { name: "accessLog", status: "disabled", detail: "access log is off", checkedAt };
  }
  if (mode === "stdout") {
    return { name: "accessLog", status: "ok", detail: "writing to stdout", checkedAt };
  }
  if (mode === "file") {
    const rawPath = env.TASKLOOM_ACCESS_LOG_PATH;
    if (typeof rawPath !== "string" || rawPath.length === 0) {
      return {
        name: "accessLog",
        status: "down",
        detail: "file mode requires TASKLOOM_ACCESS_LOG_PATH",
        checkedAt,
      };
    }
    const resolved = resolvePath(process.cwd(), rawPath);
    const parent = dirname(resolved);
    if (!fileExists(parent)) {
      return {
        name: "accessLog",
        status: "down",
        detail: `access log directory does not exist: ${parent}`,
        checkedAt,
      };
    }
    if (!fileExists(resolved)) {
      return {
        name: "accessLog",
        status: "degraded",
        detail: `access log file does not exist yet: ${resolved}`,
        checkedAt,
      };
    }
    return { name: "accessLog", status: "ok", detail: `file present at ${resolved}`, checkedAt };
  }
  return { name: "accessLog", status: "disabled", detail: "access log is off", checkedAt };
}

function checkManagedPostgresTopologyGate(env: NodeJS.ProcessEnv, checkedAt: string): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const adapter = cleanEnvValue(env.TASKLOOM_MANAGED_DATABASE_ADAPTER).toLowerCase();
  const hasManagedUrl = MANAGED_POSTGRES_URL_HINT_KEYS.some((key) => cleanEnvValue(env[key]).length > 0);
  const hasManagedIntent =
    hasManagedUrl ||
    adapter === "postgres" ||
    adapter === "postgresql" ||
    MANAGED_POSTGRES_TOPOLOGY_HINTS.has(topology);
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);

  if (hasMultiWriterIntent) {
    return {
      name: "managedPostgresTopologyGate",
      status: "degraded",
      detail: `Phase 53 blocks ${topology} intent; multi-writer, distributed, and active-active requirements are design intent only, not implementation support; multiWriterSupported=false`,
      checkedAt,
    };
  }
  if (hasManagedIntent) {
    return {
      name: "managedPostgresTopologyGate",
      status: "ok",
      detail: "Phase 53 allows supported single-writer managed Postgres; multi-writer, distributed, and active-active runtime support remains unavailable",
      checkedAt,
    };
  }
  return {
    name: "managedPostgresTopologyGate",
    status: "disabled",
    detail: "Phase 53 has no managed Postgres topology intent to evaluate",
    checkedAt,
  };
}

function checkMultiWriterTopologyDesignPackageGate(env: NodeJS.ProcessEnv, checkedAt: string): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterTopologyDesignPackageGate",
      status: "disabled",
      detail: "Phase 54 design-package gate is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase53RequirementsAttached = cleanEnvValue(env.TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE).length > 0;
  const phase53DesignAttached = cleanEnvValue(env.TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE).length > 0;
  const missingEvidence: string[] = MULTI_WRITER_TOPOLOGY_DESIGN_PACKAGE_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);
  if (!phase53RequirementsAttached) missingEvidence.unshift("Phase 53 requirements evidence");
  if (!phase53DesignAttached) missingEvidence.unshift("Phase 53 design evidence");
  const designPackageComplete = missingEvidence.length === 0;

  return {
    name: "multiWriterTopologyDesignPackageGate",
    status: "degraded",
    detail: designPackageComplete
      ? `Phase 54 design package is complete for ${topology} intent, including topology owner, consistency model, failover/PITR, migration/backfill, observability, and rollback evidence; multi-writer runtime remains unsupported; runtimeSupported=false`
      : `Phase 54 design package is incomplete for ${topology} intent; missing ${missingEvidence.join(", ")}; multi-writer runtime remains unsupported; runtimeSupported=false`,
    checkedAt,
  };
}

function checkMultiWriterTopologyImplementationAuthorizationGate(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterTopologyImplementationAuthorizationGate",
      status: "disabled",
      detail: "Phase 55 implementation-authorization gate is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase53RequirementsAttached = cleanEnvValue(env.TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE).length > 0;
  const phase53DesignAttached = cleanEnvValue(env.TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE).length > 0;
  const phase54MissingEvidence: string[] = MULTI_WRITER_TOPOLOGY_DESIGN_PACKAGE_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);
  if (!phase53RequirementsAttached) phase54MissingEvidence.unshift("Phase 53 requirements evidence");
  if (!phase53DesignAttached) phase54MissingEvidence.unshift("Phase 53 design evidence");
  const designPackageComplete = phase54MissingEvidence.length === 0;
  const missingAuthorizationEvidence = MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_AUTHORIZATION_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);

  let detail: string;
  if (!designPackageComplete) {
    detail = `Phase 55 implementation authorization is blocked for ${topology} intent until the Phase 54 design package is complete and review/authorization evidence is recorded; runtimeSupported=false`;
  } else if (missingAuthorizationEvidence.length > 0) {
    detail = `Phase 55 implementation authorization is blocked for ${topology} intent; missing ${missingAuthorizationEvidence.join(", ")}; runtimeSupported=false`;
  } else {
    detail = `Phase 55 design-package review and implementation authorization are recorded for ${topology} intent; runtime implementation remains blocked until a future runtime phase; runtimeSupported=false`;
  }

  return {
    name: "multiWriterTopologyImplementationAuthorizationGate",
    status: "degraded",
    detail,
    checkedAt,
  };
}

function checkMultiWriterTopologyImplementationReadinessGate(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterTopologyImplementationReadinessGate",
      status: "disabled",
      detail: "Phase 56 implementation readiness and rollout-safety gate is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase53RequirementsAttached = cleanEnvValue(env.TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE).length > 0;
  const phase53DesignAttached = cleanEnvValue(env.TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE).length > 0;
  const phase54MissingEvidence: string[] = MULTI_WRITER_TOPOLOGY_DESIGN_PACKAGE_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);
  if (!phase53RequirementsAttached) phase54MissingEvidence.unshift("Phase 53 requirements evidence");
  if (!phase53DesignAttached) phase54MissingEvidence.unshift("Phase 53 design evidence");
  const designPackageComplete = phase54MissingEvidence.length === 0;
  const missingAuthorizationEvidence = MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_AUTHORIZATION_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);
  const implementationAuthorized = designPackageComplete && missingAuthorizationEvidence.length === 0;
  const missingReadinessEvidence = MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_READINESS_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);

  let detail: string;
  if (!implementationAuthorized) {
    detail = `Phase 56 implementation readiness and rollout-safety gate is blocked for ${topology} intent until Phase 55 implementation authorization is recorded; runtimeSupported=false`;
  } else if (missingReadinessEvidence.length > 0) {
    detail = `Phase 56 implementation readiness and rollout-safety gate is blocked for ${topology} intent; missing ${missingReadinessEvidence.join(", ")}; runtimeSupported=false`;
  } else {
    detail = `Phase 56 implementation readiness and rollout-safety evidence is complete for ${topology} intent; runtime implementation remains blocked until a future runtime phase; runtimeSupported=false`;
  }

  return {
    name: "multiWriterTopologyImplementationReadinessGate",
    status: "degraded",
    detail,
    checkedAt,
  };
}

function phase56EvidenceComplete(env: NodeJS.ProcessEnv): boolean {
  const coarseReadiness =
    cleanEnvValue(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE).length > 0;
  const coarseRollout = cleanEnvValue(env.TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE).length > 0;
  const detailedReadiness =
    cleanEnvValue(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN).length > 0 &&
    cleanEnvValue(env.TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN).length > 0 &&
    cleanEnvValue(env.TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN).length > 0;
  const detailedRollout =
    cleanEnvValue(env.TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN).length > 0 &&
    cleanEnvValue(env.TASKLOOM_MULTI_WRITER_CUTOVER_PLAN).length > 0 &&
    cleanEnvValue(env.TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE).length > 0;
  return (coarseReadiness || detailedReadiness) && (coarseRollout || detailedRollout);
}

function phase57ImplementationScopeComplete(env: NodeJS.ProcessEnv): boolean {
  return phase56EvidenceComplete(env) &&
    MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_SCOPE_EVIDENCE.every(
      (entry) => cleanEnvValue(env[entry.envKey]).length > 0,
    );
}

function phase58RuntimeValidationComplete(env: NodeJS.ProcessEnv): boolean {
  return phase57ImplementationScopeComplete(env) &&
    MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE.every(
      (entry) => cleanEnvValue(env[entry.envKey]).length > 0,
    );
}

function phase59ReleaseEnablementApprovalComplete(env: NodeJS.ProcessEnv): boolean {
  return phase58RuntimeValidationComplete(env) &&
    MULTI_WRITER_RUNTIME_RELEASE_ENABLEMENT_APPROVAL_EVIDENCE.every(
      (entry) => cleanEnvValue(env[entry.envKey]).length > 0,
    );
}

function phase60RuntimeSupportPresenceAssertionComplete(
  env: NodeJS.ProcessEnv,
  deploymentReports: DeploymentReportSources,
): boolean {
  const envComplete = phase59ReleaseEnablementApprovalComplete(env) &&
    MULTI_WRITER_RUNTIME_SUPPORT_PRESENCE_ASSERTION_EVIDENCE.every(
      (entry) => cleanEnvValue(env[entry.envKey]).length > 0,
    );
  if (envComplete) return true;

  for (const report of Object.values(deploymentReports)) {
    const record = runtimeSupportPresenceAssertionRecord(report);
    if (!record) continue;
    const complete = booleanFromRecord(record, "runtimeSupportPresenceAssertionComplete") ??
      booleanFromRecord(record, "supportPresenceAssertionComplete") ??
      booleanFromRecord(record, "assertionComplete");
    const status = cleanEnvValue(record.status).toLowerCase();
    const assertionStatus = cleanEnvValue(record.assertionStatus).toLowerCase();
    if (complete === true || status === "assertion-complete" || assertionStatus === "complete") return true;
  }
  return false;
}

function multiWriterIntentDetectedFromReports(deploymentReports: DeploymentReportSources): boolean {
  for (const report of Object.values(deploymentReports)) {
    const phase61 = runtimeActivationControlsRecord(report);
    const phase60 = runtimeSupportPresenceAssertionRecord(report);
    for (const record of [phase61, phase60]) {
      if (!record) continue;
      const explicit = booleanFromRecord(record, "multiWriterIntentDetected");
      if (explicit === true) return true;
      const topology = cleanEnvValue(record.topologyIntent).toLowerCase();
      if (MULTI_WRITER_TOPOLOGY_HINTS.has(topology)) return true;
    }
  }
  return false;
}

function topologyIntentFromReports(deploymentReports: DeploymentReportSources): string {
  for (const report of Object.values(deploymentReports)) {
    const phase61 = runtimeActivationControlsRecord(report);
    const phase60 = runtimeSupportPresenceAssertionRecord(report);
    for (const record of [phase61, phase60]) {
      if (!record) continue;
      const topology = cleanEnvValue(record.topologyIntent);
      if (topology) return topology.toLowerCase();
    }
  }
  return "";
}

function horizontalAppWriterIntentFromEnv(env: NodeJS.ProcessEnv): boolean {
  const topology = cleanEnvValue(env.TASKLOOM_APP_WRITER_TOPOLOGY).toLowerCase();
  const databaseTopology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const horizontalWriterMode = cleanEnvValue(env.TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_MODE).toLowerCase();
  const horizontalWriterFlag = cleanEnvValue(env.TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_APP_WRITERS).toLowerCase();
  return [
    "horizontal",
    "horizontal-writer",
    "horizontal-writers",
    "horizontal-app-writer",
    "horizontal-app-writers",
    "multi-process",
    "multi-process-writers",
    "managed-postgres-horizontal-app-writers",
  ].includes(topology) ||
    databaseTopology === "managed-postgres-horizontal-app-writers" ||
    ["enabled", "required", "supported", "hardened"].includes(horizontalWriterMode) ||
    ["1", "true", "yes", "enabled", "required"].includes(horizontalWriterFlag);
}

function horizontalAppWriterIntentFromReports(deploymentReports: DeploymentReportSources): boolean {
  for (const report of Object.values(deploymentReports)) {
    const record = horizontalWriterConcurrencyRecord(report);
    if (!record) continue;
    if (booleanFromRecord(record, "horizontalAppWriterIntentDetected") === true) return true;
    if (booleanFromRecord(record, "horizontalWriterIntentDetected") === true) return true;
    if (booleanFromRecord(record, "managedPostgresHorizontalWriterIntentDetected") === true) return true;
    if (booleanFromRecord(record, "horizontalWriterTopologyRequested") === true) return true;
  }
  return false;
}

function managedPostgresIntentDetected(env: NodeJS.ProcessEnv, deploymentReports: DeploymentReportSources): boolean {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const adapter = cleanEnvValue(env.TASKLOOM_MANAGED_DATABASE_ADAPTER).toLowerCase();
  const hasManagedUrl = MANAGED_POSTGRES_URL_HINT_KEYS.some((key) => cleanEnvValue(env[key]).length > 0);
  const envIntent =
    hasManagedUrl ||
    adapter === "postgres" ||
    adapter === "postgresql" ||
    MANAGED_POSTGRES_TOPOLOGY_HINTS.has(topology);
  if (envIntent) return true;

  for (const report of Object.values(deploymentReports)) {
    const record = horizontalWriterConcurrencyRecord(report);
    if (!record) continue;
    if (booleanFromRecord(record, "managedPostgresIntentDetected") === true) return true;
  }
  return false;
}

function managedPostgresStartupSupported(env: NodeJS.ProcessEnv, deploymentReports: DeploymentReportSources): boolean {
  const adapter = cleanEnvValue(env.TASKLOOM_MANAGED_DATABASE_ADAPTER).toLowerCase();
  const hasManagedUrl = MANAGED_POSTGRES_URL_HINT_KEYS.some((key) => cleanEnvValue(env[key]).length > 0);
  if ((adapter === "postgres" || adapter === "postgresql") && hasManagedUrl) return true;

  for (const report of Object.values(deploymentReports)) {
    if (isRecord(report)) {
      const phase52 = findNestedRecord(report, ["phase52"]) ??
        findNestedRecord(report, ["managedDatabase", "phase52"]);
      if (phase52 && booleanFromRecord(phase52, "managedPostgresStartupSupported") === true) return true;
    }
    const record = horizontalWriterConcurrencyRecord(report);
    if (!record) continue;
    if (booleanFromRecord(record, "managedPostgresStartupSupported") === true) return true;
  }
  return false;
}

function supportedManagedPostgresTopology(env: NodeJS.ProcessEnv, deploymentReports: DeploymentReportSources): boolean {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  if (MULTI_WRITER_TOPOLOGY_HINTS.has(topology)) return false;
  if (topology === "" || MANAGED_POSTGRES_TOPOLOGY_HINTS.has(topology)) return true;

  for (const report of Object.values(deploymentReports)) {
    const record = horizontalWriterConcurrencyRecord(report);
    if (!record) continue;
    if (booleanFromRecord(record, "supportedManagedPostgresTopology") === true) return true;
  }
  return false;
}

function trueEnvValue(value: unknown): boolean {
  return ["1", "true", "yes", "enabled"].includes(cleanEnvValue(value).toLowerCase());
}

function reportDependencyReady(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  const explicit =
    booleanFromRecord(record, "productionSafe") ??
    booleanFromRecord(record, "ready") ??
    booleanFromRecord(record, "configured") ??
    booleanFromRecord(record, "ok") ??
    booleanFromRecord(record, "pass");
  if (explicit !== undefined) return explicit;
  const status = cleanEnvValue(record.status).toLowerCase();
  if (["ready", "ok", "pass", "passed", "production-safe", "shared", "distributed"].includes(status)) return true;
  if (["blocked", "fail", "failed", "missing", "local-only", "disabled"].includes(status)) return false;
  return null;
}

function reportPhase63Required(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  return booleanFromRecord(record, "required") ??
    booleanFromRecord(record, "phase63Required") ??
    booleanFromRecord(record, "distributedDependencyEnforcementRequired") ??
    booleanFromRecord(record, "strictActivationRequired") ??
    null;
}

function reportPhase64Required(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  return booleanFromRecord(record, "required") ??
    booleanFromRecord(record, "phase64Required") ??
    booleanFromRecord(record, "recoveryValidationRequired") ??
    booleanFromRecord(record, "managedPostgresRecoveryValidationRequired") ??
    null;
}

function reportPhase65Required(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  return booleanFromRecord(record, "required") ??
    booleanFromRecord(record, "phase65Required") ??
    booleanFromRecord(record, "cutoverAutomationRequired") ??
    booleanFromRecord(record, "managedPostgresCutoverAutomationRequired") ??
    null;
}

function reportPhase66Required(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  return booleanFromRecord(record, "required") ??
    booleanFromRecord(record, "phase66Required") ??
    booleanFromRecord(record, "finalReleaseClosureRequired") ??
    booleanFromRecord(record, "documentationFreezeRequired") ??
    null;
}

function phase64ReportValidationComplete(records: readonly Record<string, unknown>[]): boolean {
  return records.some((record) => {
    const required =
      record.required === true ||
      record.phase64Required === true ||
      record.recoveryValidationRequired === true ||
      record.horizontalAppWriterIntentDetected === true;
    return required &&
      (record.recoveryValidationComplete === true ||
        record.managedPostgresRecoveryValidated === true ||
        record.phase64RecoveryValidationComplete === true ||
        record.failoverPitrRecoveryValidated === true);
  });
}

function phase65ReportAutomationReady(records: readonly Record<string, unknown>[]): boolean {
  return records.some((record) => {
    const required =
      record.required === true ||
      record.phase65Required === true ||
      record.cutoverAutomationRequired === true ||
      record.managedPostgresCutoverAutomationRequired === true;
    return required &&
      (record.cutoverAutomationReady === true ||
        record.managedPostgresCutoverAutomationReady === true ||
        record.activationAutomationReady === true ||
        record.phase65CutoverAutomationReady === true);
  });
}

function phase66ReportClosureReady(records: readonly Record<string, unknown>[]): boolean {
  return records.some((record) => {
    const required =
      record.required === true ||
      record.phase66Required === true ||
      record.finalReleaseClosureRequired === true ||
      record.documentationFreezeRequired === true;
    return required &&
      (record.finalReleaseReady === true ||
        record.finalReleaseClosureReady === true ||
        record.phase66FinalReleaseReady === true ||
        record.documentationFrozen === true ||
        record.releaseAllowed === true);
  });
}

function automationResultValue(value: string): "pass" | "fail" | "unknown" {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (
    ["fail", "failed", "failure", "error", "errored", "red", "blocked", "rollback-required"].includes(normalized) ||
    normalized.startsWith("fail:")
  ) {
    return "fail";
  }
  if (
    [
      "pass",
      "passed",
      "success",
      "succeeded",
      "ok",
      "ready",
      "green",
      "complete",
      "completed",
    ].includes(normalized) ||
    normalized.startsWith("pass:")
  ) {
    return "pass";
  }
  return "unknown";
}

function cutoverAutomationResultFromRecord(
  record: Record<string, unknown>,
  statusKeys: readonly string[],
): "pass" | "fail" | "unknown" {
  for (const key of statusKeys) {
    const value = record[key];
    if (typeof value === "boolean") return value ? "pass" : "fail";
    const result = automationResultValue(cleanEnvValue(value));
    if (result !== "unknown") return result;
  }
  return "unknown";
}

function finalReleaseResultValue(value: string): "pass" | "fail" | "unknown" {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (
    ["fail", "failed", "failure", "error", "errored", "red"].includes(normalized) ||
    normalized.startsWith("fail:")
  ) {
    return "fail";
  }
  if (
    ["pass", "passed", "success", "succeeded", "ok", "ready", "green", "complete", "completed"].includes(normalized) ||
    normalized.startsWith("pass:")
  ) {
    return "pass";
  }
  return "unknown";
}

function finalReleaseResultFromRecord(
  record: Record<string, unknown>,
  statusKeys: readonly string[],
): "pass" | "fail" | "unknown" {
  for (const key of statusKeys) {
    const value = record[key];
    if (typeof value === "boolean") return value ? "pass" : "fail";
    const result = finalReleaseResultValue(cleanEnvValue(value));
    if (result !== "unknown") return result;
  }
  return "unknown";
}

function phase62HardeningComplete(env: NodeJS.ProcessEnv, deploymentReports: DeploymentReportSources): boolean {
  const phase62Records = Object.values(deploymentReports)
    .map((report) => horizontalWriterConcurrencyRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  if (phase62ReportHardeningComplete(phase62Records)) return true;
  return managedPostgresIntentDetected(env, deploymentReports) &&
    managedPostgresStartupSupported(env, deploymentReports) &&
    supportedManagedPostgresTopology(env, deploymentReports) &&
    MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_EVIDENCE.every(
      (entry) => valueFromEnvKeys(env, entry.envKeys ?? [entry.envKey]).length > 0,
    );
}

function missingDistributedDependencies(
  env: NodeJS.ProcessEnv,
  deploymentReports: DeploymentReportSources,
): string[] {
  const phase63Records = Object.values(deploymentReports)
    .map((report) => distributedDependencyEnforcementRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const schedulerMode = cleanEnvValue(env.TASKLOOM_SCHEDULER_LEADER_MODE).toLowerCase() || "off";
  const accessLogMode = cleanEnvValue(env.TASKLOOM_ACCESS_LOG_MODE).toLowerCase() || "off";
  const accessLogShipping = valueFromEnvKeys(env, [
    "TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE",
    "TASKLOOM_ACCESS_LOG_SHIPPING_MODE",
    "TASKLOOM_ACCESS_LOG_SHIPPING_ASSERTION",
    "TASKLOOM_ACCESS_LOG_SHIPPING",
    "TASKLOOM_ACCESS_LOG_SHIPPER",
  ]);
  const healthMonitoring = valueFromEnvKeys(env, [
    "TASKLOOM_HEALTH_MONITORING_EVIDENCE",
    "TASKLOOM_HEALTH_MONITORING_ASSERTION",
    "TASKLOOM_HEALTH_MONITORING_URL",
    "TASKLOOM_HEALTHCHECK_MONITORING_ASSERTION",
  ]);
  const durableJobExecutionPosture = cleanEnvValue(env.TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE).toLowerCase();
  const durableJobExecutionEvidence = cleanEnvValue(env.TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE);
  const alertDeliveryEvidence = cleanEnvValue(env.TASKLOOM_ALERT_DELIVERY_EVIDENCE);
  const envReady: Record<string, boolean> = {
    distributedRateLimiting:
      cleanEnvValue(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL).length > 0 &&
      !trueEnvValue(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN),
    schedulerCoordination:
      schedulerMode === "http" &&
      cleanEnvValue(env.TASKLOOM_SCHEDULER_LEADER_HTTP_URL).length > 0 &&
      !trueEnvValue(env.TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN),
    durableJobExecution:
      phase62HardeningComplete(env, deploymentReports) &&
      DURABLE_JOB_EXECUTION_POSTURES.has(durableJobExecutionPosture) &&
      durableJobExecutionEvidence.length > 0,
    accessLogShipping:
      (accessLogMode === "stdout" && accessLogShipping.length > 0) ||
      (accessLogMode === "file" &&
        cleanEnvValue(env.TASKLOOM_ACCESS_LOG_PATH).length > 0 &&
        accessLogShipping.length > 0),
    alertDelivery:
      cleanEnvValue(env.TASKLOOM_ALERT_EVALUATE_CRON).length > 0 &&
      cleanEnvValue(env.TASKLOOM_ALERT_WEBHOOK_URL).length > 0 &&
      alertDeliveryEvidence.length > 0,
    healthMonitoring: healthMonitoring.length > 0,
  };

  return DISTRIBUTED_DEPENDENCY_DEFINITIONS.filter((definition) => {
    for (const phase63 of phase63Records) {
      const record = distributedDependencyRecord(phase63, definition.reportKeys);
      const ready = reportDependencyReady(record);
      if (ready !== null) return !ready;
    }
    return !envReady[definition.key];
  }).map((definition) => definition.label);
}

function phase63Required(env: NodeJS.ProcessEnv, deploymentReports: DeploymentReportSources): boolean {
  const phase63Records = Object.values(deploymentReports)
    .map((report) => distributedDependencyEnforcementRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const reportRequired = phase63Records.reduce<boolean | null>((result, record) => {
    if (result !== null) return result;
    return reportPhase63Required(record);
  }, null);
  const hasHorizontalIntent =
    horizontalAppWriterIntentFromEnv(env) || horizontalAppWriterIntentFromReports(deploymentReports);
  return reportRequired === true || hasHorizontalIntent;
}

function checkDistributedDependencyEnforcement(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
  deploymentReports: DeploymentReportSources,
): SubsystemHealth {
  const required = phase63Required(env, deploymentReports);
  if (!required) {
    return {
      name: "distributedDependencyEnforcement",
      status: "disabled",
      detail: "Phase 63 distributed dependency enforcement is not required without horizontal app-writer activation intent",
      checkedAt,
    };
  }

  const missing = missingDistributedDependencies(env, deploymentReports);

  if (missing.length > 0) {
    return {
      name: "distributedDependencyEnforcement",
      status: "degraded",
      detail: `Phase 63 distributed dependency enforcement blocks strict activation; missing production-safe ${missing.join(", ")}; activationAllowed=false; releaseAllowed=false; strictActivationBlocked=true`,
      checkedAt,
    };
  }

  return {
    name: "distributedDependencyEnforcement",
    status: "ok",
    detail: "Phase 63 distributed dependency enforcement is ready for strict activation; local-only coordination paths are blocked for horizontal app writers; activationAllowed=true; releaseAllowed=false; strictActivationAllowed=true",
    checkedAt,
  };
}

function checkManagedPostgresRecoveryValidation(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
  deploymentReports: DeploymentReportSources,
): SubsystemHealth {
  const phase64Records = Object.values(deploymentReports)
    .map((report) => recoveryValidationRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const reportRequired = phase64Records.reduce<boolean | null>((result, record) => {
    if (result !== null) return result;
    return reportPhase64Required(record);
  }, null);
  const required = reportRequired === true || phase63Required(env, deploymentReports);
  if (!required) {
    return {
      name: "managedPostgresRecoveryValidation",
      status: "disabled",
      detail: "Phase 64 managed Postgres recovery validation is not required without horizontal app-writer activation intent",
      checkedAt,
    };
  }

  const missingDependencies = missingDistributedDependencies(env, deploymentReports);
  if (missingDependencies.length > 0) {
    return {
      name: "managedPostgresRecoveryValidation",
      status: "degraded",
      detail: `Phase 64 managed Postgres recovery validation is blocked until Phase 63 dependencies are production-safe; missing ${missingDependencies.join(", ")}; activationAllowed=false; active-active and regional runtime remain unsupported`,
      checkedAt,
    };
  }

  const reportValidationComplete = phase64ReportValidationComplete(phase64Records);
  const missingEvidence = MANAGED_POSTGRES_RECOVERY_VALIDATION_EVIDENCE
    .filter((entry) => {
      if (reportValidationComplete) return false;
      if (valueFromEnvKeys(env, entry.envKeys).length > 0) return false;
      return !phase64Records.some((record) => {
        const direct = valueFromRecord(record, entry.reportKeys);
        const nested = isRecord(record.evidence) ? valueFromRecord(record.evidence, entry.reportKeys) : "";
        return Boolean(direct || nested);
      });
    })
    .map((entry) => entry.label);

  if (missingEvidence.length > 0) {
    return {
      name: "managedPostgresRecoveryValidation",
      status: "degraded",
      detail: `Phase 64 managed Postgres recovery validation blocks activation; missing ${missingEvidence.join(", ")}; active-active, regional runtime, and SQLite-distributed support remain unsupported; activationAllowed=false`,
      checkedAt,
    };
  }

  return {
    name: "managedPostgresRecoveryValidation",
    status: "ok",
    detail: "Phase 64 managed Postgres recovery validation is complete for backup restore, PITR rehearsal, failover rehearsal, data-integrity validation, and recovery-time expectations; provider-owned HA/PITR is validated while active-active, regional runtime, and SQLite-distributed support remain unsupported; activationAllowed=true; releaseAllowed=false",
    checkedAt,
  };
}

function phase64RecoveryValidationComplete(
  env: NodeJS.ProcessEnv,
  deploymentReports: DeploymentReportSources,
): boolean {
  const phase64Records = Object.values(deploymentReports)
    .map((report) => recoveryValidationRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  if (phase64ReportValidationComplete(phase64Records)) return true;
  if (missingDistributedDependencies(env, deploymentReports).length > 0) return false;
  return MANAGED_POSTGRES_RECOVERY_VALIDATION_EVIDENCE.every(
    (entry) => valueFromEnvKeys(env, entry.envKeys).length > 0 ||
      phase64Records.some((record) => {
        const direct = valueFromRecord(record, entry.reportKeys);
        const nested = isRecord(record.evidence) ? valueFromRecord(record.evidence, entry.reportKeys) : "";
        return Boolean(direct || nested);
      }),
  );
}

function phase65CutoverAutomationReady(
  env: NodeJS.ProcessEnv,
  deploymentReports: DeploymentReportSources,
): boolean {
  const phase65Records = Object.values(deploymentReports)
    .map((report) => cutoverAutomationRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  if (!phase64RecoveryValidationComplete(env, deploymentReports)) return false;
  if (phase65ReportAutomationReady(phase65Records)) return true;

  const failed = MANAGED_POSTGRES_CUTOVER_AUTOMATION_EVIDENCE.some((entry) => {
    let result = automationResultValue(valueFromEnvKeys(env, entry.statusEnvKeys));
    if (result === "unknown") {
      for (const record of phase65Records) {
        result = cutoverAutomationResultFromRecord(record, entry.statusReportKeys);
        if (result !== "unknown") break;
        if (isRecord(record.evidence)) {
          result = cutoverAutomationResultFromRecord(record.evidence, entry.statusReportKeys);
          if (result !== "unknown") break;
        }
      }
    }
    return result === "fail";
  });
  if (failed) return false;

  return MANAGED_POSTGRES_CUTOVER_AUTOMATION_EVIDENCE.every((entry) => {
    if (valueFromEnvKeys(env, entry.envKeys).length > 0) return true;
    return phase65Records.some((record) => {
      const direct = valueFromRecord(record, entry.reportKeys);
      const nested = isRecord(record.evidence) ? valueFromRecord(record.evidence, entry.reportKeys) : "";
      return Boolean(direct || nested);
    });
  });
}

function checkManagedPostgresCutoverAutomation(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
  deploymentReports: DeploymentReportSources,
): SubsystemHealth {
  const phase65Records = Object.values(deploymentReports)
    .map((report) => cutoverAutomationRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const reportRequired = phase65Records.reduce<boolean | null>((result, record) => {
    if (result !== null) return result;
    return reportPhase65Required(record);
  }, null);
  const required = reportRequired === true || phase63Required(env, deploymentReports);
  if (!required) {
    return {
      name: "managedPostgresCutoverAutomation",
      status: "disabled",
      detail: "Phase 65 managed Postgres cutover automation is not required without horizontal app-writer activation intent",
      checkedAt,
    };
  }

  if (!phase64RecoveryValidationComplete(env, deploymentReports)) {
    return {
      name: "managedPostgresCutoverAutomation",
      status: "degraded",
      detail: "Phase 65 managed Postgres cutover automation is blocked until Phase 64 recovery validation is complete; activationAllowed=false",
      checkedAt,
    };
  }

  const reportAutomationReady = phase65ReportAutomationReady(phase65Records);
  const failedChecks = MANAGED_POSTGRES_CUTOVER_AUTOMATION_EVIDENCE
    .filter((entry) => {
      let result = automationResultValue(valueFromEnvKeys(env, entry.statusEnvKeys));
      if (result === "unknown") {
        for (const record of phase65Records) {
          result = cutoverAutomationResultFromRecord(record, entry.statusReportKeys);
          if (result !== "unknown") break;
          if (isRecord(record.evidence)) {
            result = cutoverAutomationResultFromRecord(record.evidence, entry.statusReportKeys);
            if (result !== "unknown") break;
          }
        }
      }
      return result === "fail";
    })
    .map((entry) => entry.label);
  if (failedChecks.length > 0) {
    const smokeFailed = failedChecks.includes("post-activation smoke-check evidence");
    return {
      name: "managedPostgresCutoverAutomation",
      status: "degraded",
      detail: smokeFailed
        ? "Phase 65 post-activation smoke checks failed; rollback command guidance is required to return to the prior safe posture; activationAllowed=false; rollbackRequired=true"
        : `Phase 65 managed Postgres cutover automation blocks activation because ${failedChecks.join(", ")} failed; activationAllowed=false`,
      checkedAt,
    };
  }

  const missingEvidence = MANAGED_POSTGRES_CUTOVER_AUTOMATION_EVIDENCE
    .filter((entry) => {
      if (reportAutomationReady) return false;
      if (valueFromEnvKeys(env, entry.envKeys).length > 0) return false;
      return !phase65Records.some((record) => {
        const direct = valueFromRecord(record, entry.reportKeys);
        const nested = isRecord(record.evidence) ? valueFromRecord(record.evidence, entry.reportKeys) : "";
        return Boolean(direct || nested);
      });
    })
    .map((entry) => entry.label);
  if (missingEvidence.length > 0) {
    return {
      name: "managedPostgresCutoverAutomation",
      status: "degraded",
      detail: `Phase 65 managed Postgres cutover automation blocks activation; missing ${missingEvidence.join(", ")}; activationAllowed=false`,
      checkedAt,
    };
  }

  return {
    name: "managedPostgresCutoverAutomation",
    status: "ok",
    detail: "Phase 65 managed Postgres cutover automation is ready with cutover preflight, activation dry-run, post-activation smoke checks, rollback command guidance, and monitoring thresholds; activationAllowed=true; releaseAllowed=false",
    checkedAt,
  };
}

function checkFinalReleaseClosure(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
  deploymentReports: DeploymentReportSources,
): SubsystemHealth {
  const phase66Records = Object.values(deploymentReports)
    .map((report) => finalReleaseClosureRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const reportRequired = phase66Records.reduce<boolean | null>((result, record) => {
    if (result !== null) return result;
    return reportPhase66Required(record);
  }, null);
  const required = reportRequired === true || phase63Required(env, deploymentReports);
  if (!required) {
    return {
      name: "finalReleaseClosure",
      status: "disabled",
      detail: "Phase 66 final release closure and documentation freeze are not required without supported production posture activation intent",
      checkedAt,
    };
  }

  if (!phase65CutoverAutomationReady(env, deploymentReports)) {
    return {
      name: "finalReleaseClosure",
      status: "degraded",
      detail: "Phase 66 final release closure is blocked until Phase 65 cutover automation is ready; releaseAllowed=false",
      checkedAt,
    };
  }

  let globalResult = finalReleaseResultValue(valueFromEnvKeys(env, [
    "TASKLOOM_PHASE66_FINAL_RELEASE_STATUS",
    "TASKLOOM_FINAL_RELEASE_STATUS",
  ]));
  if (globalResult === "unknown") {
    for (const record of phase66Records) {
      globalResult = finalReleaseResultFromRecord(record, [
        "status",
        "closureStatus",
        "phase66Status",
        "finalReleaseStatus",
      ]);
      if (globalResult !== "unknown") break;
    }
  }
  if (globalResult === "fail") {
    return {
      name: "finalReleaseClosure",
      status: "degraded",
      detail: "Phase 66 final release closure reported failure; documentation freeze and final release remain blocked; releaseAllowed=false",
      checkedAt,
    };
  }

  const reportClosureReady = phase66ReportClosureReady(phase66Records);
  const failedChecks = FINAL_RELEASE_CLOSURE_EVIDENCE
    .filter((entry) => {
      let result = finalReleaseResultValue(valueFromEnvKeys(env, entry.statusEnvKeys));
      if (result === "unknown") {
        for (const record of phase66Records) {
          result = finalReleaseResultFromRecord(record, entry.statusReportKeys);
          if (result !== "unknown") break;
          if (isRecord(record.evidence)) {
            result = finalReleaseResultFromRecord(record.evidence, entry.statusReportKeys);
            if (result !== "unknown") break;
          }
        }
      }
      return result === "fail";
    })
    .map((entry) => entry.label);
  if (failedChecks.length > 0) {
    return {
      name: "finalReleaseClosure",
      status: "degraded",
      detail: `Phase 66 final release closure reported failed checks: ${failedChecks.join(", ")}; documentation freeze and release remain blocked; releaseAllowed=false`,
      checkedAt,
    };
  }

  const missingEvidence = FINAL_RELEASE_CLOSURE_EVIDENCE
    .filter((entry) => {
      if (reportClosureReady) return false;
      if (valueFromEnvKeys(env, entry.envKeys).length > 0) return false;
      return !phase66Records.some((record) => {
        const direct = valueFromRecord(record, entry.reportKeys);
        const nested = isRecord(record.evidence) ? valueFromRecord(record.evidence, entry.reportKeys) : "";
        return Boolean(direct || nested);
      });
    })
    .map((entry) => entry.label);
  if (missingEvidence.length > 0) {
    return {
      name: "finalReleaseClosure",
      status: "degraded",
      detail: `Phase 66 final release closure blocks release; missing ${missingEvidence.join(", ")}; releaseAllowed=false`,
      checkedAt,
    };
  }

  return {
    name: "finalReleaseClosure",
    status: "ok",
    detail: "Phase 66 final release closure is ready with supported topology, unsupported boundaries, final checklist, validation run, deployment CLI checks, docs consistency checks, documentation freeze, no-hidden-phase assertion, and release approval; releaseAllowed=true",
    checkedAt,
  };
}

function checkMultiWriterTopologyImplementationScope(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterTopologyImplementationScope",
      status: "disabled",
      detail: "Phase 57 implementation-scope status is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase56Complete = phase56EvidenceComplete(env);
  const missingScopeEvidence = MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_SCOPE_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);

  let detail: string;
  if (!phase56Complete) {
    detail = `Phase 57 implementation-scope status is blocked for ${topology} intent until Phase 56 implementation readiness and rollout-safety evidence is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else if (missingScopeEvidence.length > 0) {
    detail = `Phase 57 implementation-scope status is blocked for ${topology} intent; missing ${missingScopeEvidence.join(", ")}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else {
    detail = `Phase 57 implementation-scope evidence is complete for ${topology} intent; multi-writer runtime implementation remains blocked and unsupported; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  }

  return {
    name: "multiWriterTopologyImplementationScope",
    status: "degraded",
    detail,
    checkedAt,
  };
}

function checkMultiWriterRuntimeImplementationValidation(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterRuntimeImplementationValidation",
      status: "disabled",
      detail: "Phase 58 runtime implementation validation is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase57Complete = phase57ImplementationScopeComplete(env);
  const missingValidationEvidence = MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);

  let detail: string;
  if (!phase57Complete) {
    detail = `Phase 58 runtime implementation validation is blocked for ${topology} intent until Phase 57 implementation scope is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else if (missingValidationEvidence.length > 0) {
    detail = `Phase 58 runtime implementation validation is blocked for ${topology} intent; missing ${missingValidationEvidence.join(", ")}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else {
    detail = `Phase 58 runtime implementation validation evidence is complete for ${topology} intent; multi-writer runtime implementation remains blocked and unsupported; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  }

  return {
    name: "multiWriterRuntimeImplementationValidation",
    status: "degraded",
    detail,
    checkedAt,
  };
}

function checkMultiWriterRuntimeReleaseEnablementApproval(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterRuntimeReleaseEnablementApproval",
      status: "disabled",
      detail: "Phase 59 runtime release-enable approval is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase58Complete = phase58RuntimeValidationComplete(env);
  const missingApprovalEvidence = MULTI_WRITER_RUNTIME_RELEASE_ENABLEMENT_APPROVAL_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);

  let detail: string;
  if (!phase58Complete) {
    detail = `Phase 59 runtime release-enable approval is blocked for ${topology} intent until Phase 58 runtime implementation validation is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else if (missingApprovalEvidence.length > 0) {
    detail = `Phase 59 runtime release-enable approval is blocked for ${topology} intent; missing ${missingApprovalEvidence.join(", ")}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else {
    detail = `Phase 59 runtime release-enable approval evidence is complete for ${topology} intent and visible for approval audit; multi-writer runtime support and release remain blocked until actual runtime exists; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  }

  return {
    name: "multiWriterRuntimeReleaseEnablementApproval",
    status: "degraded",
    detail,
    checkedAt,
  };
}

function checkMultiWriterRuntimeSupportPresenceAssertion(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
): SubsystemHealth {
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const hasMultiWriterIntent = MULTI_WRITER_TOPOLOGY_HINTS.has(topology);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterRuntimeSupportPresenceAssertion",
      status: "disabled",
      detail: "Phase 60 runtime support presence assertion is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase59Complete = phase59ReleaseEnablementApprovalComplete(env);
  const missingAssertionEvidence = MULTI_WRITER_RUNTIME_SUPPORT_PRESENCE_ASSERTION_EVIDENCE
    .filter((entry) => cleanEnvValue(env[entry.envKey]).length === 0)
    .map((entry) => entry.label);

  let detail: string;
  if (!phase59Complete) {
    detail = `Phase 60 runtime support presence assertion is blocked for ${topology} intent until Phase 59 release-enable approval is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else if (missingAssertionEvidence.length > 0) {
    detail = `Phase 60 runtime support presence assertion is blocked for ${topology} intent; missing ${missingAssertionEvidence.join(", ")}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else {
    detail = `Phase 60 runtime support presence assertion evidence is complete for ${topology} intent and visible for support audit; multi-writer runtime support and release remain blocked in this repo; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  }

  return {
    name: "multiWriterRuntimeSupportPresenceAssertion",
    status: "degraded",
    detail,
    checkedAt,
  };
}

function checkMultiWriterRuntimeActivationControls(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
  deploymentReports: DeploymentReportSources,
): SubsystemHealth {
  const reportTopology = topologyIntentFromReports(deploymentReports);
  const topology = cleanEnvValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase() || reportTopology;
  const hasMultiWriterIntent =
    MULTI_WRITER_TOPOLOGY_HINTS.has(topology) || multiWriterIntentDetectedFromReports(deploymentReports);
  if (!hasMultiWriterIntent) {
    return {
      name: "multiWriterRuntimeActivationControls",
      status: "disabled",
      detail: "Phase 61 runtime activation controls are not required without multi-writer, distributed, or active-active intent; runtimeSupported=false",
      checkedAt,
    };
  }

  const phase61Records = Object.values(deploymentReports)
    .map((report) => runtimeActivationControlsRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const missingActivationControls = MULTI_WRITER_RUNTIME_ACTIVATION_CONTROLS_EVIDENCE
    .filter((entry) => {
      if (cleanEnvValue(env[entry.envKey]).length > 0) return false;
      return !phase61Records.some((record) => {
        const direct = valueFromRecord(record, entry.reportKeys);
        const nested = isRecord(record.evidence) ? valueFromRecord(record.evidence, entry.reportKeys) : "";
        return Boolean(direct || nested);
      });
    })
    .map((entry) => entry.label);
  const phase60Complete = phase60RuntimeSupportPresenceAssertionComplete(env, deploymentReports);

  let detail: string;
  if (!phase60Complete) {
    detail = `Phase 61 runtime activation controls are blocked for ${topology} intent until Phase 60 runtime support presence assertion is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else if (missingActivationControls.length > 0) {
    detail = `Phase 61 runtime activation controls are blocked for ${topology} intent; missing ${missingActivationControls.join(", ")}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  } else {
    detail = `Phase 61 runtime activation controls are complete for ${topology} intent and visible for activation audit; distributed, active-active, regional/PITR, and SQLite-distributed runtime support remain unsupported; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false`;
  }

  return {
    name: "multiWriterRuntimeActivationControls",
    status: "degraded",
    detail,
    checkedAt,
  };
}

function checkManagedPostgresHorizontalWriterConcurrency(
  env: NodeJS.ProcessEnv,
  checkedAt: string,
  deploymentReports: DeploymentReportSources,
): SubsystemHealth {
  const hasHorizontalIntent =
    horizontalAppWriterIntentFromEnv(env) || horizontalAppWriterIntentFromReports(deploymentReports);
  if (!hasHorizontalIntent) {
    return {
      name: "managedPostgresHorizontalWriterConcurrency",
      status: "disabled",
      detail: "Phase 62 managed Postgres horizontal app-writer concurrency hardening is not configured; active-active, regional/PITR runtime, and multi-writer database support remain separate blocked capabilities",
      checkedAt,
    };
  }

  const hasManagedPostgresIntent = managedPostgresIntentDetected(env, deploymentReports);
  const startupSupported = managedPostgresStartupSupported(env, deploymentReports);
  const supportedTopology = supportedManagedPostgresTopology(env, deploymentReports);
  const phase62Records = Object.values(deploymentReports)
    .map((report) => horizontalWriterConcurrencyRecord(report))
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const reportHardeningComplete = phase62ReportHardeningComplete(phase62Records);
  const missingEvidence = MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_EVIDENCE
    .filter((entry) => {
      if (reportHardeningComplete) return false;
      if (valueFromEnvKeys(env, entry.envKeys ?? [entry.envKey]).length > 0) return false;
      return !phase62Records.some((record) => {
        const direct = valueFromRecord(record, entry.reportKeys);
        const nested = isRecord(record.evidence) ? valueFromRecord(record.evidence, entry.reportKeys) : "";
        return Boolean(direct || nested);
      });
    })
    .map((entry) => entry.label);

  let detail: string;
  let status: SubsystemStatus = "degraded";
  if (!hasManagedPostgresIntent || !startupSupported) {
    detail = "Phase 62 managed Postgres horizontal app-writer concurrency hardening is blocked until managed Postgres startup support is configured; horizontalAppWritersSupported=false; activeActiveDatabaseSupported=false; regionalDatabaseSupported=false; pitrRuntimeSupported=false";
  } else if (!supportedTopology) {
    detail = "Phase 62 managed Postgres horizontal app-writer concurrency hardening is blocked because the requested topology is outside the supported single-primary managed Postgres posture; active-active, regional/PITR runtime, and multi-writer database support remain blocked";
  } else if (missingEvidence.length > 0) {
    detail = `Phase 62 managed Postgres horizontal app-writer concurrency hardening is blocked; missing ${missingEvidence.join(", ")}; active-active, regional/PITR runtime, SQLite-distributed, and multi-writer database support remain unsupported; releaseAllowed=false`;
  } else {
    status = "ok";
    detail = "Phase 62 managed Postgres horizontal app-writer concurrency hardening is complete for multiple Taskloom app processes writing to one managed Postgres primary; active-active, regional/PITR runtime, SQLite-distributed, and multi-writer database support remain unsupported; releaseAllowed=false";
  }

  return {
    name: "managedPostgresHorizontalWriterConcurrency",
    status,
    detail,
    checkedAt,
  };
}

function reduceOverall(subsystems: SubsystemHealth[]): SubsystemStatus {
  let result: SubsystemStatus = "ok";
  for (const subsystem of subsystems) {
    if (subsystem.status === "down") return "down";
    if (subsystem.status === "degraded") result = "degraded";
  }
  return result;
}

function buildDeploymentReportSources(env: NodeJS.ProcessEnv, deps: OperationsHealthDeps): DeploymentReportSources {
  const buildStorageTopologyReport = deps.buildStorageTopologyReport ?? defaultBuildStorageTopologyReport;
  const buildManagedDatabaseTopologyReport =
    deps.buildManagedDatabaseTopologyReport ?? defaultBuildManagedDatabaseTopologyReport;
  const buildManagedDatabaseRuntimeGuardReport =
    deps.buildManagedDatabaseRuntimeGuardReport ?? defaultBuildManagedDatabaseRuntimeGuardReport;
  const buildReleaseReadinessReport = deps.buildReleaseReadinessReport ?? defaultBuildReleaseReadinessReport;
  const buildReleaseEvidenceBundle = deps.buildReleaseEvidenceBundle ?? defaultBuildReleaseEvidenceBundle;

  const storageTopology = buildStorageTopologyReport(env);
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env);
  const releaseReadiness = buildReleaseReadinessReport(env, {
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  } as never);
  const releaseEvidence = buildReleaseEvidenceBundle(env, {
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    releaseReadiness,
  } as never);

  return {
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
  };
}

export function getOperationsHealth(deps: OperationsHealthDeps = {}): OperationsHealthReport {
  const loadStore = deps.loadStore ?? defaultLoadStore;
  const schedulerHeartbeat = deps.schedulerHeartbeat ?? defaultSchedulerHeartbeat;
  const env = deps.env ?? process.env;
  const now = (deps.now ?? (() => new Date()))();
  const fileExists = deps.fileExists ?? existsSync;
  const staleAfterMs = deps.schedulerStaleAfterMs ?? DEFAULT_SCHEDULER_STALE_AFTER_MS;
  const checkedAt = now.toISOString();
  const deploymentReports = buildDeploymentReportSources(env, deps);

  const subsystems: SubsystemHealth[] = [
    checkStore(loadStore, checkedAt),
    checkScheduler(schedulerHeartbeat(), now, staleAfterMs, checkedAt),
    checkAccessLog(env, fileExists, checkedAt),
    checkManagedPostgresTopologyGate(env, checkedAt),
    checkMultiWriterTopologyDesignPackageGate(env, checkedAt),
    checkMultiWriterTopologyImplementationAuthorizationGate(env, checkedAt),
    checkMultiWriterTopologyImplementationReadinessGate(env, checkedAt),
    checkMultiWriterTopologyImplementationScope(env, checkedAt),
    checkMultiWriterRuntimeImplementationValidation(env, checkedAt),
    checkMultiWriterRuntimeReleaseEnablementApproval(env, checkedAt),
    checkMultiWriterRuntimeSupportPresenceAssertion(env, checkedAt),
    checkMultiWriterRuntimeActivationControls(env, checkedAt, deploymentReports),
    checkManagedPostgresHorizontalWriterConcurrency(env, checkedAt, deploymentReports),
    checkDistributedDependencyEnforcement(env, checkedAt, deploymentReports),
    checkManagedPostgresRecoveryValidation(env, checkedAt, deploymentReports),
    checkManagedPostgresCutoverAutomation(env, checkedAt, deploymentReports),
    checkFinalReleaseClosure(env, checkedAt, deploymentReports),
  ];

  return {
    generatedAt: checkedAt,
    overall: reduceOverall(subsystems),
    subsystems,
  };
}

export async function getOperationsHealthAsync(deps: OperationsHealthAsyncDeps = {}): Promise<OperationsHealthReport> {
  const loadStore = deps.loadStore ?? defaultLoadStoreAsync;
  const schedulerHeartbeat = deps.schedulerHeartbeat ?? defaultSchedulerHeartbeat;
  const env = deps.env ?? process.env;
  const now = (deps.now ?? (() => new Date()))();
  const fileExists = deps.fileExists ?? existsSync;
  const staleAfterMs = deps.schedulerStaleAfterMs ?? DEFAULT_SCHEDULER_STALE_AFTER_MS;
  const checkedAt = now.toISOString();
  const deploymentReports = buildDeploymentReportSources(env, deps);

  const subsystems: SubsystemHealth[] = [
    await checkStoreAsync(loadStore, checkedAt),
    checkScheduler(schedulerHeartbeat(), now, staleAfterMs, checkedAt),
    checkAccessLog(env, fileExists, checkedAt),
    checkManagedPostgresTopologyGate(env, checkedAt),
    checkMultiWriterTopologyDesignPackageGate(env, checkedAt),
    checkMultiWriterTopologyImplementationAuthorizationGate(env, checkedAt),
    checkMultiWriterTopologyImplementationReadinessGate(env, checkedAt),
    checkMultiWriterTopologyImplementationScope(env, checkedAt),
    checkMultiWriterRuntimeImplementationValidation(env, checkedAt),
    checkMultiWriterRuntimeReleaseEnablementApproval(env, checkedAt),
    checkMultiWriterRuntimeSupportPresenceAssertion(env, checkedAt),
    checkMultiWriterRuntimeActivationControls(env, checkedAt, deploymentReports),
    checkManagedPostgresHorizontalWriterConcurrency(env, checkedAt, deploymentReports),
    checkDistributedDependencyEnforcement(env, checkedAt, deploymentReports),
    checkManagedPostgresRecoveryValidation(env, checkedAt, deploymentReports),
    checkManagedPostgresCutoverAutomation(env, checkedAt, deploymentReports),
    checkFinalReleaseClosure(env, checkedAt, deploymentReports),
  ];

  return {
    generatedAt: checkedAt,
    overall: reduceOverall(subsystems),
    subsystems,
  };
}
