import type { TaskloomData } from "./taskloom-store.js";
import { createRequire } from "node:module";
import { loadStore as defaultLoadStore, loadStoreAsync as defaultLoadStoreAsync } from "./taskloom-store.js";
import { getJobTypeMetrics, type JobTypeMetrics } from "./jobs/scheduler-metrics.js";
import { buildStorageTopologyReport as defaultBuildStorageTopologyReport } from "./deployment/storage-topology.js";
import { buildManagedDatabaseTopologyReport as defaultBuildManagedDatabaseTopologyReport } from "./deployment/managed-database-topology.js";
import { buildManagedDatabaseRuntimeGuardReport as defaultBuildManagedDatabaseRuntimeGuardReport } from "./deployment/managed-database-runtime-guard.js";
import { buildReleaseReadinessReport as defaultBuildReleaseReadinessReport } from "./deployment/release-readiness.js";
import { buildReleaseEvidenceBundle as defaultBuildReleaseEvidenceBundle } from "./deployment/release-evidence.js";

export type { JobTypeMetrics } from "./jobs/scheduler-metrics.js";

export type StorageTopologyReport = ReturnType<typeof defaultBuildStorageTopologyReport>;
export type ManagedDatabaseTopologyReport = ReturnType<typeof defaultBuildManagedDatabaseTopologyReport>;
export type ManagedDatabaseRuntimeGuardReport = ReturnType<typeof defaultBuildManagedDatabaseRuntimeGuardReport>;
export type ReleaseReadinessReport = ReturnType<typeof defaultBuildReleaseReadinessReport>;
export type ReleaseEvidenceBundle = ReturnType<typeof defaultBuildReleaseEvidenceBundle>;

export interface JobQueueStatusSummary {
  type: string;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  canceled: number;
}

export interface ManagedDatabaseRuntimeBoundaryStatus {
  source: "managedDatabaseRuntimeGuard" | "releaseReadiness" | "releaseEvidence";
  status?: string;
  classification?: string;
  summary?: string;
  detail?: string;
  label?: string;
  allowed?: boolean;
  enforced?: boolean;
  [key: string]: unknown;
}

export interface AsyncStoreBoundaryStatus {
  source: "managedDatabaseRuntimeGuard" | "releaseReadiness" | "releaseEvidence" | "derived";
  phase?: string;
  status?: string;
  classification?: string;
  summary?: string;
  detail?: string;
  label?: string;
  foundationPresent?: boolean;
  foundationAvailable?: boolean;
  releaseAllowed?: boolean;
  localRuntimeSupported?: boolean;
  managedDatabaseRuntimeAllowed?: boolean;
  managedDatabaseRuntimeBlocked?: boolean;
  managedPostgresSupported?: boolean;
  managedDatabaseAdapterImplemented?: boolean;
  managedDatabaseRepositoriesImplemented?: boolean;
  storeMode?: string;
  topology?: string | null;
  [key: string]: unknown;
}

export interface ManagedPostgresCapabilityStatus {
  phase: "50";
  status: "available" | "not-configured" | "missing-adapter";
  summary: string;
  adapterConfigured: boolean;
  adapterAvailable: boolean;
  backfillAvailable: boolean;
  syncRuntimeGuarded: boolean;
  runtimeAllowed: boolean;
  managedIntentDetected: boolean;
  configuredHintKeys: string[];
  adapter: string | null;
  provider: "postgres";
  backfillCommands: string[];
}

export interface ManagedPostgresStartupSupportStatus {
  phase: "52";
  status: "supported" | "blocked" | "not-configured" | "multi-writer-unsupported";
  summary: string;
  startupSupported: boolean;
  managedIntentDetected: boolean;
  adapterAvailable: boolean;
  runtimeCallSitesMigrated: boolean;
  multiWriterSupported: false;
  multiWriterIntentDetected: boolean;
  source: "managedDatabaseRuntimeGuard" | "derived";
}

export interface ManagedPostgresTopologyGateStatus {
  phase: "53";
  status: "supported" | "blocked" | "not-configured";
  summary: string;
  managedIntentDetected: boolean;
  singleWriterManagedPostgresSupported: boolean;
  multiWriterIntentDetected: boolean;
  multiWriterSupported: false;
  topologyIntent: string | null;
  requirementsOnly: boolean;
  implementationScope: "single-writer-managed-postgres" | "none";
  source: "managedDatabaseRuntimeGuard" | "derived";
}

export type MultiWriterTopologyDesignPackageEvidenceKey =
  | "topologyOwner"
  | "consistencyModel"
  | "failoverPitr"
  | "migrationBackfill"
  | "observability"
  | "rollback";

export interface MultiWriterTopologyDesignPackageEvidenceStatus {
  key: MultiWriterTopologyDesignPackageEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterTopologyDesignPackageGateStatus {
  phase: "54";
  status: "blocked" | "not-required";
  designPackageStatus: "complete" | "incomplete" | "not-required";
  summary: string;
  required: boolean;
  releaseAllowed: false;
  runtimeSupported: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  phase53RequirementsEvidenceAttached: boolean;
  phase53DesignEvidenceAttached: boolean;
  topologyOwner: MultiWriterTopologyDesignPackageEvidenceStatus;
  consistencyModel: MultiWriterTopologyDesignPackageEvidenceStatus;
  failoverPitr: MultiWriterTopologyDesignPackageEvidenceStatus;
  migrationBackfill: MultiWriterTopologyDesignPackageEvidenceStatus;
  observability: MultiWriterTopologyDesignPackageEvidenceStatus;
  rollback: MultiWriterTopologyDesignPackageEvidenceStatus;
  missingEvidence: MultiWriterTopologyDesignPackageEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type MultiWriterTopologyImplementationAuthorizationEvidenceKey =
  | "designPackageReview"
  | "implementationAuthorization";

export interface MultiWriterTopologyImplementationAuthorizationEvidenceStatus {
  key: MultiWriterTopologyImplementationAuthorizationEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterTopologyImplementationAuthorizationGateStatus {
  phase: "55";
  status: "authorized" | "blocked" | "not-required";
  reviewStatus: "approved" | "missing" | "not-required";
  implementationAuthorizationStatus: "authorized" | "missing" | "not-required";
  summary: string;
  required: boolean;
  implementationAuthorized: boolean;
  runtimeImplementationBlocked: true;
  runtimeSupported: false;
  releaseAllowed: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  designPackageStatus: MultiWriterTopologyDesignPackageGateStatus["designPackageStatus"];
  designPackageComplete: boolean;
  designPackageReview: MultiWriterTopologyImplementationAuthorizationEvidenceStatus;
  implementationAuthorization: MultiWriterTopologyImplementationAuthorizationEvidenceStatus;
  missingEvidence: MultiWriterTopologyImplementationAuthorizationEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type MultiWriterTopologyImplementationReadinessEvidenceKey =
  | "implementationReadiness"
  | "rolloutSafety";

export interface MultiWriterTopologyImplementationReadinessEvidenceStatus {
  key: MultiWriterTopologyImplementationReadinessEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterTopologyImplementationReadinessGateStatus {
  phase: "56";
  status: "evidence-complete" | "blocked" | "not-required";
  implementationReadinessStatus: "complete" | "missing" | "not-required";
  rolloutSafetyStatus: "complete" | "missing" | "not-required";
  summary: string;
  required: boolean;
  implementationAuthorized: boolean;
  implementationReadinessComplete: boolean;
  rolloutSafetyComplete: boolean;
  runtimeImplementationBlocked: true;
  runtimeSupported: false;
  releaseAllowed: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  implementationAuthorizationStatus: MultiWriterTopologyImplementationAuthorizationGateStatus["status"];
  implementationReadiness: MultiWriterTopologyImplementationReadinessEvidenceStatus;
  rolloutSafety: MultiWriterTopologyImplementationReadinessEvidenceStatus;
  missingEvidence: MultiWriterTopologyImplementationReadinessEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type MultiWriterTopologyImplementationScopeEvidenceKey =
  | "implementationScopeLock"
  | "runtimeFeatureFlag"
  | "validationEvidence"
  | "migrationCutoverLock"
  | "releaseOwnerSignoff";

export interface MultiWriterTopologyImplementationScopeEvidenceStatus {
  key: MultiWriterTopologyImplementationScopeEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterTopologyImplementationScopeStatus {
  phase: "57";
  status: "scope-complete" | "blocked" | "not-required";
  implementationScopeStatus: "complete" | "blocked" | "missing" | "not-required";
  summary: string;
  required: boolean;
  phase56EvidenceComplete: boolean;
  implementationScopeComplete: boolean;
  runtimeImplementationBlocked: true;
  runtimeSupported: false;
  releaseAllowed: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  implementationReadinessStatus: MultiWriterTopologyImplementationReadinessGateStatus["status"];
  evidence: Record<
    MultiWriterTopologyImplementationScopeEvidenceKey,
    MultiWriterTopologyImplementationScopeEvidenceStatus
  >;
  implementationScope: MultiWriterTopologyImplementationScopeEvidenceStatus;
  implementationScopeLock: MultiWriterTopologyImplementationScopeEvidenceStatus;
  runtimeFeatureFlag: MultiWriterTopologyImplementationScopeEvidenceStatus;
  validationEvidence: MultiWriterTopologyImplementationScopeEvidenceStatus;
  migrationCutoverLock: MultiWriterTopologyImplementationScopeEvidenceStatus;
  releaseOwnerSignoff: MultiWriterTopologyImplementationScopeEvidenceStatus;
  missingEvidence: MultiWriterTopologyImplementationScopeEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type MultiWriterRuntimeImplementationValidationEvidenceKey =
  | "runtimeImplementationEvidence"
  | "consistencyValidationEvidence"
  | "failoverValidationEvidence"
  | "dataIntegrityValidationEvidence"
  | "operationsRunbook"
  | "runtimeReleaseSignoff";

export interface MultiWriterRuntimeImplementationValidationEvidenceStatus {
  key: MultiWriterRuntimeImplementationValidationEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterRuntimeImplementationValidationStatus {
  phase: "58";
  status: "validation-complete" | "blocked" | "not-required";
  validationStatus: "complete" | "blocked" | "missing" | "not-required";
  summary: string;
  required: boolean;
  phase57ImplementationScopeComplete: boolean;
  runtimeImplementationValidationComplete: boolean;
  runtimeImplementationBlocked: true;
  runtimeSupported: false;
  releaseAllowed: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  implementationScopeStatus: MultiWriterTopologyImplementationScopeStatus["status"];
  evidence: Record<
    MultiWriterRuntimeImplementationValidationEvidenceKey,
    MultiWriterRuntimeImplementationValidationEvidenceStatus
  >;
  runtimeImplementationEvidence: MultiWriterRuntimeImplementationValidationEvidenceStatus;
  consistencyValidationEvidence: MultiWriterRuntimeImplementationValidationEvidenceStatus;
  failoverValidationEvidence: MultiWriterRuntimeImplementationValidationEvidenceStatus;
  dataIntegrityValidationEvidence: MultiWriterRuntimeImplementationValidationEvidenceStatus;
  operationsRunbook: MultiWriterRuntimeImplementationValidationEvidenceStatus;
  runtimeReleaseSignoff: MultiWriterRuntimeImplementationValidationEvidenceStatus;
  missingEvidence: MultiWriterRuntimeImplementationValidationEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type MultiWriterRuntimeReleaseEnablementApprovalEvidenceKey =
  | "enablementDecision"
  | "approver"
  | "rolloutWindow"
  | "monitoringSignoff"
  | "abortPlan"
  | "releaseTicket";

export interface MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus {
  key: MultiWriterRuntimeReleaseEnablementApprovalEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterRuntimeReleaseEnablementApprovalStatus {
  phase: "59";
  status: "approval-complete" | "blocked" | "not-required";
  approvalStatus: "complete" | "blocked" | "missing" | "not-required";
  summary: string;
  required: boolean;
  phase58RuntimeValidationComplete: boolean;
  releaseEnablementApprovalComplete: boolean;
  runtimeImplementationBlocked: true;
  runtimeSupported: false;
  releaseAllowed: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  runtimeImplementationValidationStatus: MultiWriterRuntimeImplementationValidationStatus["status"];
  evidence: Record<
    MultiWriterRuntimeReleaseEnablementApprovalEvidenceKey,
    MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus
  >;
  enablementDecision: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus;
  approver: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus;
  rolloutWindow: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus;
  monitoringSignoff: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus;
  abortPlan: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus;
  releaseTicket: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus;
  missingEvidence: MultiWriterRuntimeReleaseEnablementApprovalEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type MultiWriterRuntimeSupportPresenceAssertionEvidenceKey =
  | "implementationPresent"
  | "explicitSupportStatement"
  | "compatibilityMatrix"
  | "cutoverEvidence"
  | "releaseAutomationApproval"
  | "ownerAcceptance";

export interface MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus {
  key: MultiWriterRuntimeSupportPresenceAssertionEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterRuntimeSupportPresenceAssertionStatus {
  phase: "60";
  status: "assertion-complete" | "blocked" | "not-required";
  assertionStatus: "complete" | "blocked" | "missing" | "not-required";
  summary: string;
  required: boolean;
  phase59ReleaseEnablementApprovalComplete: boolean;
  runtimeSupportPresenceAssertionComplete: boolean;
  runtimeImplementationBlocked: true;
  runtimeSupported: false;
  releaseAllowed: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  releaseEnablementApprovalStatus: MultiWriterRuntimeReleaseEnablementApprovalStatus["status"];
  evidence: Record<
    MultiWriterRuntimeSupportPresenceAssertionEvidenceKey,
    MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus
  >;
  implementationPresent: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus;
  explicitSupportStatement: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus;
  compatibilityMatrix: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus;
  cutoverEvidence: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus;
  releaseAutomationApproval: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus;
  ownerAcceptance: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus;
  missingEvidence: MultiWriterRuntimeSupportPresenceAssertionEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type MultiWriterRuntimeActivationControlsEvidenceKey =
  | "activationDecision"
  | "activationOwner"
  | "activationWindow"
  | "activationFlag"
  | "releaseAutomationAssertion";

export interface MultiWriterRuntimeActivationControlsEvidenceStatus {
  key: MultiWriterRuntimeActivationControlsEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface MultiWriterRuntimeActivationControlsStatus {
  phase: "61";
  status: "activation-controls-complete" | "blocked" | "not-required";
  activationControlStatus: "complete" | "blocked" | "missing" | "not-required";
  summary: string;
  required: boolean;
  phase60RuntimeSupportPresenceAssertionComplete: boolean;
  runtimeActivationControlsComplete: boolean;
  runtimeImplementationBlocked: true;
  runtimeSupported: false;
  releaseAllowed: false;
  multiWriterIntentDetected: boolean;
  topologyIntent: string | null;
  runtimeSupportPresenceAssertionStatus: MultiWriterRuntimeSupportPresenceAssertionStatus["status"];
  evidence: Record<
    MultiWriterRuntimeActivationControlsEvidenceKey,
    MultiWriterRuntimeActivationControlsEvidenceStatus
  >;
  activationDecision: MultiWriterRuntimeActivationControlsEvidenceStatus;
  activationOwner: MultiWriterRuntimeActivationControlsEvidenceStatus;
  activationWindow: MultiWriterRuntimeActivationControlsEvidenceStatus;
  activationFlag: MultiWriterRuntimeActivationControlsEvidenceStatus;
  releaseAutomationAssertion: MultiWriterRuntimeActivationControlsEvidenceStatus;
  missingEvidence: MultiWriterRuntimeActivationControlsEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type ManagedPostgresHorizontalWriterConcurrencyEvidenceKey =
  | "writePathAudit"
  | "concurrentWriterTests"
  | "concurrencyControl"
  | "transactionRetry"
  | "releaseAssertion";

export interface ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus {
  key: ManagedPostgresHorizontalWriterConcurrencyEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface ManagedPostgresHorizontalWriterConcurrencyStatus {
  phase: "62";
  status: "hardening-complete" | "blocked" | "not-configured";
  hardeningStatus: "complete" | "blocked" | "missing" | "not-configured";
  summary: string;
  required: boolean;
  horizontalAppWriterIntentDetected: boolean;
  managedPostgresIntentDetected: boolean;
  managedPostgresStartupSupported: boolean;
  supportedManagedPostgresTopology: boolean;
  managedPostgresHorizontalWriterHardeningComplete: boolean;
  horizontalAppWritersSupported: boolean;
  multiWriterDatabaseSupported: false;
  activeActiveDatabaseSupported: false;
  regionalDatabaseSupported: false;
  pitrRuntimeSupported: false;
  sqliteDistributedSupported: false;
  releaseAllowed: false;
  managedPostgresStartupSupportStatus: ManagedPostgresStartupSupportStatus["status"];
  managedPostgresTopologyGateStatus: ManagedPostgresTopologyGateStatus["status"];
  evidence: Record<
    ManagedPostgresHorizontalWriterConcurrencyEvidenceKey,
    ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus
  >;
  writePathAudit: ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus;
  concurrentWriterTests: ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus;
  concurrencyControl: ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus;
  transactionRetry: ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus;
  releaseAssertion: ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus;
  missingEvidence: ManagedPostgresHorizontalWriterConcurrencyEvidenceKey[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type DistributedDependencyEnforcementKey =
  | "distributedRateLimiting"
  | "schedulerCoordination"
  | "durableJobExecution"
  | "accessLogShipping"
  | "alertDelivery"
  | "healthMonitoring";

export interface DistributedDependencyStatus {
  key: DistributedDependencyEnforcementKey;
  label: string;
  status: "ready" | "blocked" | "not-required";
  required: boolean;
  productionSafe: boolean;
  mode: string;
  summary: string;
  blockers: string[];
  source: "env" | "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export interface DistributedDependencyEnforcementStatus {
  phase: "63";
  status: "dependencies-ready" | "blocked" | "not-required";
  enforcementStatus: "ready" | "blocked" | "not-required";
  summary: string;
  required: boolean;
  horizontalAppWriterIntentDetected: boolean;
  multiWriterIntentDetected: boolean;
  strictActivationBlocked: boolean;
  strictActivationAllowed: boolean;
  activationAllowed: boolean;
  releaseAllowed: false;
  missingDependencies: DistributedDependencyEnforcementKey[];
  localOnlyDependencies: DistributedDependencyEnforcementKey[];
  blockers: string[];
  dependencies: Record<DistributedDependencyEnforcementKey, DistributedDependencyStatus>;
  distributedRateLimiting: DistributedDependencyStatus;
  schedulerCoordination: DistributedDependencyStatus;
  durableJobExecution: DistributedDependencyStatus;
  accessLogShipping: DistributedDependencyStatus;
  alertDelivery: DistributedDependencyStatus;
  healthMonitoring: DistributedDependencyStatus;
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type ManagedPostgresRecoveryValidationEvidenceKey =
  | "backupRestore"
  | "pitrRehearsal"
  | "failoverRehearsal"
  | "dataIntegrityValidation"
  | "recoveryTimeExpectations";

export interface ManagedPostgresRecoveryValidationEvidenceStatus {
  key: ManagedPostgresRecoveryValidationEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  source: "env" | "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export interface ManagedPostgresRecoveryValidationStatus {
  phase: "64";
  status: "recovery-validated" | "blocked" | "not-required";
  validationStatus: "complete" | "blocked" | "missing" | "not-required";
  summary: string;
  required: boolean;
  phase63DistributedDependenciesReady: boolean;
  recoveryValidationComplete: boolean;
  horizontalAppWriterIntentDetected: boolean;
  managedPostgresRecoveryValidated: boolean;
  strictActivationBlocked: boolean;
  strictActivationAllowed: boolean;
  activationAllowed: boolean;
  releaseAllowed: false;
  providerOwnedHaPitrValidated: boolean;
  activeActiveDatabaseSupported: false;
  regionalRuntimeSupported: false;
  pitrRuntimeSupported: false;
  sqliteDistributedSupported: false;
  evidence: Record<ManagedPostgresRecoveryValidationEvidenceKey, ManagedPostgresRecoveryValidationEvidenceStatus>;
  backupRestore: ManagedPostgresRecoveryValidationEvidenceStatus;
  pitrRehearsal: ManagedPostgresRecoveryValidationEvidenceStatus;
  failoverRehearsal: ManagedPostgresRecoveryValidationEvidenceStatus;
  dataIntegrityValidation: ManagedPostgresRecoveryValidationEvidenceStatus;
  recoveryTimeExpectations: ManagedPostgresRecoveryValidationEvidenceStatus;
  missingEvidence: ManagedPostgresRecoveryValidationEvidenceKey[];
  blockers: string[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export type ManagedPostgresCutoverAutomationEvidenceKey =
  | "cutoverPreflight"
  | "activationDryRun"
  | "postActivationSmoke"
  | "rollbackCommandGuidance"
  | "monitoringThresholds";

export interface ManagedPostgresCutoverAutomationEvidenceStatus {
  key: ManagedPostgresCutoverAutomationEvidenceKey;
  label: string;
  envKey: string;
  status: "provided" | "missing" | "failed" | "not-required";
  required: boolean;
  configured: boolean;
  value: string | null;
  result: "pass" | "fail" | "unknown";
  source:
    | "env"
    | "managedDatabaseRuntimeGuard"
    | "managedDatabaseTopology"
    | "releaseReadiness"
    | "releaseEvidence"
    | "derived";
}

export interface ManagedPostgresCutoverAutomationStatus {
  phase: "65";
  status: "ready" | "blocked" | "rollback-required" | "not-required";
  automationStatus: "ready" | "blocked" | "preflight-failed" | "smoke-failed" | "not-required";
  summary: string;
  required: boolean;
  phase64RecoveryValidated: boolean;
  cutoverAutomationReady: boolean;
  cutoverPreflightPassed: boolean;
  activationDryRunPassed: boolean;
  postActivationSmokePassed: boolean;
  cutoverPreflightFailed: boolean;
  activationDryRunFailed: boolean;
  postActivationSmokeFailed: boolean;
  activationBlocked: boolean;
  activationAllowed: boolean;
  rollbackRequired: boolean;
  priorSafePostureRequired: boolean;
  releaseAllowed: false;
  evidence: Record<ManagedPostgresCutoverAutomationEvidenceKey, ManagedPostgresCutoverAutomationEvidenceStatus>;
  cutoverPreflight: ManagedPostgresCutoverAutomationEvidenceStatus;
  activationDryRun: ManagedPostgresCutoverAutomationEvidenceStatus;
  postActivationSmoke: ManagedPostgresCutoverAutomationEvidenceStatus;
  rollbackCommandGuidance: ManagedPostgresCutoverAutomationEvidenceStatus;
  monitoringThresholds: ManagedPostgresCutoverAutomationEvidenceStatus;
  missingEvidence: ManagedPostgresCutoverAutomationEvidenceKey[];
  failedChecks: ManagedPostgresCutoverAutomationEvidenceKey[];
  blockers: string[];
  source: "managedDatabaseRuntimeGuard" | "managedDatabaseTopology" | "releaseReadiness" | "releaseEvidence" | "derived";
}

export interface OperationsStatus {
  generatedAt: string;
  store: { mode: "json" | "sqlite" };
  scheduler: {
    leaderMode: "off" | "file" | "http";
    leaderTtlMs: number;
    leaderHeldLocally: boolean;
    lockSummary: string;
  };
  jobs: JobQueueStatusSummary[];
  jobMetrics: JobTypeMetrics[];
  jobMetricsSnapshots: {
    total: number;
    lastCapturedAt: string | null;
  };
  accessLog: { mode: "off" | "stdout" | "file"; path: string | null; maxBytes: number; maxFiles: number };
  storageTopology: StorageTopologyReport;
  managedDatabaseTopology: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport;
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryStatus | null;
  asyncStoreBoundary: AsyncStoreBoundaryStatus | null;
  managedPostgresCapability: ManagedPostgresCapabilityStatus;
  managedPostgresStartupSupport: ManagedPostgresStartupSupportStatus;
  managedPostgresTopologyGate: ManagedPostgresTopologyGateStatus;
  multiWriterTopologyDesignPackageGate: MultiWriterTopologyDesignPackageGateStatus;
  multiWriterTopologyImplementationAuthorizationGate: MultiWriterTopologyImplementationAuthorizationGateStatus;
  multiWriterTopologyImplementationReadinessGate: MultiWriterTopologyImplementationReadinessGateStatus;
  multiWriterTopologyImplementationScope: MultiWriterTopologyImplementationScopeStatus;
  multiWriterRuntimeImplementationValidation: MultiWriterRuntimeImplementationValidationStatus;
  multiWriterRuntimeReleaseEnablementApproval: MultiWriterRuntimeReleaseEnablementApprovalStatus;
  multiWriterRuntimeSupportPresenceAssertion: MultiWriterRuntimeSupportPresenceAssertionStatus;
  multiWriterRuntimeActivationControls: MultiWriterRuntimeActivationControlsStatus;
  managedPostgresHorizontalWriterConcurrency: ManagedPostgresHorizontalWriterConcurrencyStatus;
  distributedDependencyEnforcement: DistributedDependencyEnforcementStatus;
  managedPostgresRecoveryValidation: ManagedPostgresRecoveryValidationStatus;
  managedPostgresCutoverAutomation: ManagedPostgresCutoverAutomationStatus;
  releaseReadiness: ReleaseReadinessReport;
  releaseEvidence: ReleaseEvidenceBundle;
  runtime: { nodeVersion: string };
}

export interface OperationsStatusDeps {
  loadStore?: () => TaskloomData;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  jobTypeMetrics?: () => JobTypeMetrics[];
  buildStorageTopologyReport?: (env: NodeJS.ProcessEnv) => StorageTopologyReport;
  buildManagedDatabaseTopologyReport?: (env: NodeJS.ProcessEnv) => ManagedDatabaseTopologyReport;
  buildManagedDatabaseRuntimeGuardReport?: (env: NodeJS.ProcessEnv) => ManagedDatabaseRuntimeGuardReport;
  buildReleaseReadinessReport?: (
    env: NodeJS.ProcessEnv,
    deps?: IntegratedReleaseReadinessDeps,
  ) => ReleaseReadinessReport;
  buildReleaseEvidenceBundle?: (
    env: NodeJS.ProcessEnv,
    deps?: IntegratedReleaseEvidenceDeps,
  ) => ReleaseEvidenceBundle;
}

export interface OperationsStatusAsyncDeps extends Omit<OperationsStatusDeps, "loadStore"> {
  loadStore?: () => TaskloomData | Promise<TaskloomData>;
}

type LeaderMode = OperationsStatus["scheduler"]["leaderMode"];
type AccessLogMode = OperationsStatus["accessLog"]["mode"];
type StoreMode = OperationsStatus["store"]["mode"];

interface IntegratedReleaseReadinessDeps {
  storageTopology: StorageTopologyReport;
  managedDatabaseTopology: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport;
}

interface IntegratedReleaseEvidenceDeps extends IntegratedReleaseReadinessDeps {
  releaseReadiness: ReleaseReadinessReport;
}

const VALID_LEADER_MODES: ReadonlySet<LeaderMode> = new Set(["off", "file", "http"]);
const VALID_ACCESS_LOG_MODES: ReadonlySet<AccessLogMode> = new Set(["off", "stdout", "file"]);
const DEFAULT_LEADER_TTL_MS = 30000;
const DEFAULT_FILE_LOCK_PATH = "data/scheduler-leader.json";
const DEFAULT_ACCESS_LOG_MAX_FILES = 5;
const require = createRequire(import.meta.url);
const MANAGED_POSTGRES_URL_HINT_KEYS = [
  "TASKLOOM_MANAGED_DATABASE_URL",
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
] as const;
const MANAGED_POSTGRES_ADAPTER_HINT_KEY = "TASKLOOM_MANAGED_DATABASE_ADAPTER";
const MANAGED_POSTGRES_TOPOLOGY_HINTS = new Set([
  "managed",
  "managed-db",
  "managed-database",
  "managed-postgres-horizontal-app-writers",
  "postgres",
  "postgresql",
]);
const MANAGED_POSTGRES_ADAPTERS = new Set(["postgres", "postgresql"]);
const MULTI_WRITER_TOPOLOGY_HINTS = new Set([
  "active-active",
  "distributed",
  "multi-region",
  "multi-writer",
]);
const SINGLE_WRITER_TOPOLOGY_HINTS = new Set([
  "managed",
  "managed-db",
  "managed-database",
  "postgres",
  "postgresql",
  "single-writer",
]);
const MANAGED_POSTGRES_BACKFILL_COMMANDS = [
  "npm run db:backfill",
  "npm run db:backfill-agent-runs",
  "npm run db:backfill-jobs",
  "npm run db:backfill-invitation-email-deliveries",
  "npm run db:backfill-activities",
  "npm run db:backfill-provider-calls",
  "npm run db:backfill-activation-signals",
] as const;
const MULTI_WRITER_TOPOLOGY_DESIGN_PACKAGE_EVIDENCE = [
  {
    key: "topologyOwner",
    label: "Topology owner",
    envKey: "TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER",
    reportKeys: ["topologyOwner", "owner"],
  },
  {
    key: "consistencyModel",
    label: "Consistency model",
    envKey: "TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL",
    reportKeys: ["consistencyModel"],
  },
  {
    key: "failoverPitr",
    label: "Failover/PITR evidence",
    envKey: "TASKLOOM_MULTI_WRITER_FAILOVER_PITR_EVIDENCE",
    reportKeys: ["failoverPitrEvidence", "failoverPITREvidence", "failoverAndPitrEvidence", "pitrEvidence"],
  },
  {
    key: "migrationBackfill",
    label: "Migration/backfill evidence",
    envKey: "TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_EVIDENCE",
    reportKeys: ["migrationBackfillEvidence", "migrationAndBackfillEvidence", "backfillEvidence"],
  },
  {
    key: "observability",
    label: "Observability evidence",
    envKey: "TASKLOOM_MULTI_WRITER_OBSERVABILITY_EVIDENCE",
    reportKeys: ["observabilityEvidence"],
  },
  {
    key: "rollback",
    label: "Rollback evidence",
    envKey: "TASKLOOM_MULTI_WRITER_ROLLBACK_EVIDENCE",
    reportKeys: ["rollbackEvidence"],
  },
] as const satisfies ReadonlyArray<{
  key: MultiWriterTopologyDesignPackageEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_AUTHORIZATION_EVIDENCE = [
  {
    key: "designPackageReview",
    label: "Design-package review",
    envKey: "TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW",
    reportKeys: ["designPackageReview", "reviewEvidence", "reviewSignoff", "reviewApproval"],
  },
  {
    key: "implementationAuthorization",
    label: "Implementation authorization",
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION",
    reportKeys: [
      "implementationAuthorization",
      "implementationAuthorizationEvidence",
      "implementationApproval",
      "authorization",
    ],
  },
] as const satisfies ReadonlyArray<{
  key: MultiWriterTopologyImplementationAuthorizationEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_READINESS_EVIDENCE = [
  {
    key: "implementationReadiness",
    label: "Implementation readiness evidence",
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE",
    reportKeys: [
      "implementationReadiness",
      "implementationReadinessEvidence",
      "runtimeImplementationReadiness",
      "runtimeImplementationReadinessEvidence",
      "readinessEvidence",
    ],
  },
  {
    key: "rolloutSafety",
    label: "Rollout-safety evidence",
    envKey: "TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE",
    reportKeys: [
      "rolloutSafety",
      "rolloutSafetyEvidence",
      "rolloutPlan",
      "rolloutSafetyPlan",
      "safetyEvidence",
    ],
  },
] as const satisfies ReadonlyArray<{
  key: MultiWriterTopologyImplementationReadinessEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_SCOPE_EVIDENCE = [
  {
    key: "implementationScopeLock",
    label: "implementation-scope lock",
    envKey: "TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK",
    reportKeys: [
      "implementationScopeLock",
      "implementationScopeLockEvidence",
      "approvedImplementationScope",
      "approvedImplementationScopeEvidence",
      "scopeLock",
      "scopeLockEvidence",
    ],
  },
  {
    key: "runtimeFeatureFlag",
    label: "runtime feature flag",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG",
    reportKeys: [
      "runtimeFeatureFlag",
      "runtimeFeatureFlagEvidence",
      "featureFlag",
      "deploymentGate",
    ],
  },
  {
    key: "validationEvidence",
    label: "validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE",
    reportKeys: [
      "validationEvidence",
      "validation",
      "testValidationEvidence",
    ],
  },
  {
    key: "migrationCutoverLock",
    label: "migration cutover lock",
    envKey: "TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK",
    reportKeys: [
      "migrationCutoverLock",
      "migrationCutoverLockEvidence",
      "cutoverLock",
      "migrationLock",
    ],
  },
  {
    key: "releaseOwnerSignoff",
    label: "release owner signoff",
    envKey: "TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF",
    reportKeys: [
      "releaseOwnerSignoff",
      "releaseOwnerSignoffEvidence",
      "ownerSignoff",
    ],
  },
] as const satisfies ReadonlyArray<{
  key: MultiWriterTopologyImplementationScopeEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE = [
  {
    key: "runtimeImplementationEvidence",
    label: "runtime implementation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE",
    reportKeys: [
      "runtimeImplementationEvidence",
      "runtimeImplementation",
      "implementationEvidence",
    ],
  },
  {
    key: "consistencyValidationEvidence",
    label: "consistency validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE",
    reportKeys: [
      "consistencyValidationEvidence",
      "consistencyValidation",
      "consistencyEvidence",
    ],
  },
  {
    key: "failoverValidationEvidence",
    label: "failover validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE",
    reportKeys: [
      "failoverValidationEvidence",
      "failoverValidation",
      "failoverEvidence",
    ],
  },
  {
    key: "dataIntegrityValidationEvidence",
    label: "data integrity validation evidence",
    envKey: "TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE",
    reportKeys: [
      "dataIntegrityValidationEvidence",
      "dataIntegrityValidation",
      "dataIntegrityEvidence",
    ],
  },
  {
    key: "operationsRunbook",
    label: "operations runbook",
    envKey: "TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK",
    reportKeys: [
      "operationsRunbook",
      "runbook",
      "operationsRunbookEvidence",
    ],
  },
  {
    key: "runtimeReleaseSignoff",
    label: "runtime release signoff",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF",
    reportKeys: [
      "runtimeReleaseSignoff",
      "releaseSignoff",
      "runtimeReleaseApproval",
    ],
  },
] as const satisfies ReadonlyArray<{
  key: MultiWriterRuntimeImplementationValidationEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MULTI_WRITER_RUNTIME_RELEASE_ENABLEMENT_APPROVAL_EVIDENCE = [
  {
    key: "enablementDecision",
    label: "runtime enablement decision",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION",
    reportKeys: [
      "enablementDecision",
      "runtimeEnablementDecision",
      "releaseEnablementDecision",
      "decision",
    ],
  },
  {
    key: "approver",
    label: "runtime enablement approver",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER",
    reportKeys: [
      "approver",
      "runtimeEnablementApprover",
      "releaseApprover",
      "approvalOwner",
    ],
  },
  {
    key: "rolloutWindow",
    label: "runtime enablement rollout window",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW",
    reportKeys: [
      "rolloutWindow",
      "runtimeEnablementRolloutWindow",
      "releaseWindow",
      "window",
    ],
  },
  {
    key: "monitoringSignoff",
    label: "runtime enablement monitoring signoff",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF",
    reportKeys: [
      "monitoringSignoff",
      "runtimeEnablementMonitoringSignoff",
      "monitoringApproval",
      "observabilitySignoff",
    ],
  },
  {
    key: "abortPlan",
    label: "runtime enablement abort plan",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN",
    reportKeys: [
      "abortPlan",
      "runtimeEnablementAbortPlan",
      "rollbackPlan",
      "releaseAbortPlan",
    ],
  },
  {
    key: "releaseTicket",
    label: "runtime enablement release ticket",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET",
    reportKeys: [
      "releaseTicket",
      "runtimeEnablementReleaseTicket",
      "releaseIssue",
      "ticket",
    ],
  },
] as const satisfies ReadonlyArray<{
  key: MultiWriterRuntimeReleaseEnablementApprovalEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MULTI_WRITER_RUNTIME_SUPPORT_PRESENCE_ASSERTION_EVIDENCE = [
  {
    key: "implementationPresent",
    label: "runtime support implementation presence",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT",
    reportKeys: [
      "implementationPresent",
      "runtimeSupportImplementationPresent",
      "supportImplementationPresent",
      "implementationPresence",
    ],
  },
  {
    key: "explicitSupportStatement",
    label: "explicit runtime support statement",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT",
    reportKeys: [
      "explicitSupportStatement",
      "runtimeSupportStatement",
      "supportStatement",
      "explicitRuntimeSupportStatement",
    ],
  },
  {
    key: "compatibilityMatrix",
    label: "runtime support compatibility matrix",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX",
    reportKeys: [
      "compatibilityMatrix",
      "runtimeSupportCompatibilityMatrix",
      "supportCompatibilityMatrix",
    ],
  },
  {
    key: "cutoverEvidence",
    label: "runtime support cutover evidence",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE",
    reportKeys: [
      "cutoverEvidence",
      "runtimeSupportCutoverEvidence",
      "supportCutoverEvidence",
    ],
  },
  {
    key: "releaseAutomationApproval",
    label: "runtime support release automation approval",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL",
    reportKeys: [
      "releaseAutomationApproval",
      "runtimeSupportReleaseAutomationApproval",
      "automationApproval",
    ],
  },
  {
    key: "ownerAcceptance",
    label: "runtime support owner acceptance",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE",
    reportKeys: [
      "ownerAcceptance",
      "runtimeSupportOwnerAcceptance",
      "supportOwnerAcceptance",
      "acceptance",
    ],
  },
] as const satisfies ReadonlyArray<{
  key: MultiWriterRuntimeSupportPresenceAssertionEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MULTI_WRITER_RUNTIME_ACTIVATION_CONTROLS_EVIDENCE = [
  {
    key: "activationDecision",
    label: "runtime activation decision",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_DECISION",
    reportKeys: [
      "activationDecision",
      "runtimeActivationDecision",
      "decision",
      "activationControlDecision",
    ],
  },
  {
    key: "activationOwner",
    label: "runtime activation owner",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_OWNER",
    reportKeys: [
      "activationOwner",
      "runtimeActivationOwner",
      "owner",
      "activationControlOwner",
    ],
  },
  {
    key: "activationWindow",
    label: "runtime activation window",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_WINDOW",
    reportKeys: [
      "activationWindow",
      "runtimeActivationWindow",
      "window",
      "activationControlWindow",
    ],
  },
  {
    key: "activationFlag",
    label: "runtime activation flag",
    envKey: "TASKLOOM_MULTI_WRITER_RUNTIME_ACTIVATION_FLAG",
    reportKeys: [
      "activationFlag",
      "runtimeActivationFlag",
      "featureFlag",
      "flag",
      "activationControlFlag",
    ],
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
] as const satisfies ReadonlyArray<{
  key: MultiWriterRuntimeActivationControlsEvidenceKey;
  label: string;
  envKey: string;
  reportKeys: readonly string[];
}>;
const MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_EVIDENCE = [
  {
    key: "writePathAudit",
    label: "managed Postgres write-path concurrency audit",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_AUDIT",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_AUDIT",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION",
    ],
    reportKeys: [
      "writePathAudit",
      "horizontalWriterAudit",
      "concurrencyAudit",
      "staleWriteAudit",
      "audit",
    ],
  },
  {
    key: "concurrentWriterTests",
    label: "managed Postgres concurrent-writer tests",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TESTS",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TESTS",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE",
    ],
    reportKeys: [
      "concurrentWriterTests",
      "horizontalWriterTests",
      "concurrencyTests",
      "runtimeTests",
      "tests",
    ],
  },
  {
    key: "concurrencyControl",
    label: "managed Postgres concurrency-control implementation",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_CONTROL",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_CONTROL",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION",
    ],
    reportKeys: [
      "concurrencyControl",
      "compareAndSwap",
      "rowVersion",
      "advisoryLock",
      "optimisticConcurrency",
    ],
  },
  {
    key: "transactionRetry",
    label: "managed Postgres transaction retry/idempotency proof",
    envKey: "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY",
    envKeys: [
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY",
      "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE",
    ],
    reportKeys: [
      "transactionRetry",
      "retryBehavior",
      "transactionBoundaries",
      "idempotencyProof",
      "idempotency",
    ],
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
] as const satisfies ReadonlyArray<{
  key: ManagedPostgresHorizontalWriterConcurrencyEvidenceKey;
  label: string;
  envKey: string;
  envKeys?: readonly string[];
  reportKeys: readonly string[];
}>;
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
] as const satisfies ReadonlyArray<{
  key: DistributedDependencyEnforcementKey;
  label: string;
  reportKeys: readonly string[];
}>;
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
] as const satisfies ReadonlyArray<{
  key: ManagedPostgresRecoveryValidationEvidenceKey;
  label: string;
  envKey: string;
  envKeys: readonly string[];
  reportKeys: readonly string[];
}>;
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
] as const satisfies ReadonlyArray<{
  key: ManagedPostgresCutoverAutomationEvidenceKey;
  label: string;
  envKey: string;
  envKeys: readonly string[];
  statusEnvKeys: readonly string[];
  reportKeys: readonly string[];
  statusReportKeys: readonly string[];
}>;
const PHASE_55_APPROVED_REVIEW_STATUSES = new Set([
  "approved",
  "authorized",
  "implementation-approved",
  "implementation-authorized",
]);

let schedulerLeaderProbe: (() => boolean) | null = null;

export function __setSchedulerLeaderProbe(probe: (() => boolean) | null): void {
  schedulerLeaderProbe = probe;
}

function resolveStoreMode(env: NodeJS.ProcessEnv): StoreMode {
  return env.TASKLOOM_STORE === "sqlite" ? "sqlite" : "json";
}

function resolveLeaderMode(env: NodeJS.ProcessEnv): LeaderMode {
  const raw = (env.TASKLOOM_SCHEDULER_LEADER_MODE ?? "").trim().toLowerCase();
  if (VALID_LEADER_MODES.has(raw as LeaderMode)) return raw as LeaderMode;
  return "off";
}

function resolveLeaderTtlMs(env: NodeJS.ProcessEnv): number {
  const raw = env.TASKLOOM_SCHEDULER_LEADER_TTL_MS;
  if (raw === undefined || raw === "") return DEFAULT_LEADER_TTL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LEADER_TTL_MS;
  return Math.floor(parsed);
}

function resolveLockSummary(mode: LeaderMode, env: NodeJS.ProcessEnv): string {
  if (mode === "file") {
    return env.TASKLOOM_SCHEDULER_LEADER_FILE_PATH || DEFAULT_FILE_LOCK_PATH;
  }
  if (mode === "http") {
    const url = env.TASKLOOM_SCHEDULER_LEADER_HTTP_URL ?? "";
    const queryIndex = url.indexOf("?");
    return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  }
  return "local";
}

// Phase 25 wires the scheduler to set this probe in start() and clear it in stop(),
// so leaderHeldLocally now reflects the live SchedulerLeaderLock state when the scheduler is running.
function resolveLeaderHeldLocally(mode: LeaderMode): boolean {
  if (schedulerLeaderProbe) {
    try {
      return Boolean(schedulerLeaderProbe());
    } catch {
      return false;
    }
  }
  return mode === "off";
}

function resolveAccessLogMode(env: NodeJS.ProcessEnv): AccessLogMode {
  const raw = (env.TASKLOOM_ACCESS_LOG_MODE ?? "").trim().toLowerCase();
  if (VALID_ACCESS_LOG_MODES.has(raw as AccessLogMode)) return raw as AccessLogMode;
  return "off";
}

function resolveAccessLogPath(env: NodeJS.ProcessEnv): string | null {
  const raw = env.TASKLOOM_ACCESS_LOG_PATH;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function resolveAccessLogMaxBytes(env: NodeJS.ProcessEnv): number {
  const raw = env.TASKLOOM_ACCESS_LOG_MAX_BYTES;
  if (raw === undefined || raw === "") return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function resolveAccessLogMaxFiles(env: NodeJS.ProcessEnv): number {
  const raw = env.TASKLOOM_ACCESS_LOG_MAX_FILES;
  if (raw === undefined || raw === "") return DEFAULT_ACCESS_LOG_MAX_FILES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_ACCESS_LOG_MAX_FILES;
  return Math.max(1, Math.floor(parsed));
}

function summarizeJobs(data: TaskloomData): JobQueueStatusSummary[] {
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const byType = new Map<string, JobQueueStatusSummary>();
  for (const job of jobs) {
    const type = typeof job?.type === "string" ? job.type : "unknown";
    let summary = byType.get(type);
    if (!summary) {
      summary = { type, queued: 0, running: 0, succeeded: 0, failed: 0, canceled: 0 };
      byType.set(type, summary);
    }
    switch (job.status) {
      case "queued":
        summary.queued += 1;
        break;
      case "running":
        summary.running += 1;
        break;
      case "success":
        summary.succeeded += 1;
        break;
      case "failed":
        summary.failed += 1;
        break;
      case "canceled":
        summary.canceled += 1;
        break;
      default:
        break;
    }
  }
  return Array.from(byType.values()).sort((a, b) => a.type.localeCompare(b.type));
}

const MANAGED_DATABASE_RUNTIME_BOUNDARY_KEYS = [
  "managedDatabaseRuntimeBoundary",
  "runtimeBoundary",
  "runtimeBoundaryStatus",
  "managedDatabaseBoundary",
  "managedDatabaseBoundaryStatus",
  "boundaryStatus",
] as const;

const ASYNC_STORE_BOUNDARY_KEYS = [
  "asyncStoreBoundary",
  "asyncStoreBoundaryStatus",
  "asyncStorageBoundary",
  "asyncStorageBoundaryStatus",
  "storeAsyncBoundary",
  "storeAsyncBoundaryStatus",
  "storageAsyncBoundary",
  "storageAsyncBoundaryStatus",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeManagedDatabaseRuntimeBoundary(
  value: unknown,
  source: ManagedDatabaseRuntimeBoundaryStatus["source"],
): ManagedDatabaseRuntimeBoundaryStatus | null {
  if (typeof value === "string") {
    const status = value.trim();
    return status ? { source, status } : null;
  }
  if (typeof value === "boolean") {
    return { source, enforced: value, status: value ? "enforced" : "not-enforced" };
  }
  if (!isRecord(value)) return null;
  return { source, ...value };
}

function findManagedDatabaseRuntimeBoundary(
  reports: Array<{ source: ManagedDatabaseRuntimeBoundaryStatus["source"]; report: unknown }>,
): ManagedDatabaseRuntimeBoundaryStatus | null {
  for (const { source, report } of reports) {
    if (!isRecord(report)) continue;
    for (const key of MANAGED_DATABASE_RUNTIME_BOUNDARY_KEYS) {
      const boundary = normalizeManagedDatabaseRuntimeBoundary(report[key], source);
      if (boundary) return boundary;
    }
    for (const nestedKey of ["observed", "config"] as const) {
      const nested = report[nestedKey];
      if (!isRecord(nested)) continue;
      for (const key of MANAGED_DATABASE_RUNTIME_BOUNDARY_KEYS) {
        const boundary = normalizeManagedDatabaseRuntimeBoundary(nested[key], source);
        if (boundary) return boundary;
      }
    }
  }
  return null;
}

function normalizeAsyncStoreBoundary(
  value: unknown,
  source: AsyncStoreBoundaryStatus["source"],
): AsyncStoreBoundaryStatus | null {
  if (typeof value === "string") {
    const status = value.trim();
    return status ? enrichAsyncStoreBoundary({ source, status }) : null;
  }
  if (typeof value === "boolean") {
    return enrichAsyncStoreBoundary({
      source,
      foundationPresent: value,
      status: value ? "present" : "missing",
    });
  }
  if (!isRecord(value)) return null;
  return enrichAsyncStoreBoundary({ source, ...value });
}

function enrichAsyncStoreBoundary(boundary: AsyncStoreBoundaryStatus): AsyncStoreBoundaryStatus {
  const foundationAvailable = typeof boundary.foundationAvailable === "boolean"
    ? boundary.foundationAvailable
    : undefined;
  const foundationPresent = typeof boundary.foundationPresent === "boolean"
    ? boundary.foundationPresent
    : foundationAvailable;
  const managedPostgresSupported = typeof boundary.managedPostgresSupported === "boolean"
    ? boundary.managedPostgresSupported
    : undefined;
  const adapterImplemented = typeof boundary.managedDatabaseAdapterImplemented === "boolean"
    ? boundary.managedDatabaseAdapterImplemented
    : undefined;
  const repositoriesImplemented = typeof boundary.managedDatabaseRepositoriesImplemented === "boolean"
    ? boundary.managedDatabaseRepositoriesImplemented
    : undefined;
  const managedDatabaseRuntimeAllowed = typeof boundary.managedDatabaseRuntimeAllowed === "boolean"
    ? boundary.managedDatabaseRuntimeAllowed
    : managedPostgresSupported === true || (adapterImplemented === true && repositoriesImplemented === true)
      ? true
      : managedPostgresSupported === false || adapterImplemented === false || repositoriesImplemented === false
        ? false
        : undefined;
  const managedDatabaseRuntimeBlocked = typeof boundary.managedDatabaseRuntimeBlocked === "boolean"
    ? boundary.managedDatabaseRuntimeBlocked
    : managedDatabaseRuntimeAllowed === false
      ? true
      : undefined;

  return {
    ...boundary,
    foundationPresent,
    localRuntimeSupported: typeof boundary.localRuntimeSupported === "boolean"
      ? boundary.localRuntimeSupported
      : foundationPresent,
    managedDatabaseRuntimeAllowed,
    managedDatabaseRuntimeBlocked,
  };
}

function findAsyncStoreBoundary(
  reports: Array<{ source: Exclude<AsyncStoreBoundaryStatus["source"], "derived">; report: unknown }>,
): AsyncStoreBoundaryStatus | null {
  for (const { source, report } of reports) {
    if (!isRecord(report)) continue;
    for (const key of ASYNC_STORE_BOUNDARY_KEYS) {
      const boundary = normalizeAsyncStoreBoundary(report[key], source);
      if (boundary) return boundary;
    }
    for (const nestedKey of ["observed", "config", "evidence"] as const) {
      const nested = report[nestedKey];
      if (!isRecord(nested)) continue;
      for (const key of ASYNC_STORE_BOUNDARY_KEYS) {
        const boundary = normalizeAsyncStoreBoundary(nested[key], source);
        if (boundary) return boundary;
      }
    }
  }
  return null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasConfiguredEnvValue(env: NodeJS.ProcessEnv, key: string): boolean {
  return stringValue(env[key]).length > 0;
}

function managedPostgresHintKeys(env: NodeJS.ProcessEnv): string[] {
  const keys: string[] = [];
  for (const key of MANAGED_POSTGRES_URL_HINT_KEYS) {
    if (hasConfiguredEnvValue(env, key)) keys.push(key);
  }
  if (hasConfiguredEnvValue(env, MANAGED_POSTGRES_ADAPTER_HINT_KEY)) {
    keys.push(MANAGED_POSTGRES_ADAPTER_HINT_KEY);
  }

  const store = stringValue(env.TASKLOOM_STORE).toLowerCase();
  if (MANAGED_POSTGRES_TOPOLOGY_HINTS.has(store)) keys.push("TASKLOOM_STORE");

  const topology = stringValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  if (MANAGED_POSTGRES_TOPOLOGY_HINTS.has(topology)) keys.push("TASKLOOM_DATABASE_TOPOLOGY");

  return Array.from(new Set(keys));
}

function packageAvailable(name: string): boolean {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
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
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return "";
}

function phase55DetailedReviewEvidenceFromEnv(env: NodeJS.ProcessEnv): string {
  const reviewer = stringValue(env.TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER);
  const status = stringValue(env.TASKLOOM_MULTI_WRITER_REVIEW_STATUS);
  if (!reviewer || !PHASE_55_APPROVED_REVIEW_STATUSES.has(status.toLowerCase())) return "";
  return `${reviewer}; status=${status}`;
}

function phase55DetailedAuthorizationEvidenceFromEnv(env: NodeJS.ProcessEnv): string {
  const approver = stringValue(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER);
  const scope = stringValue(env.TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE);
  const safety = stringValue(env.TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF);
  if (!approver || !scope || !safety) return "";
  return `${approver}; scope=${scope}; safety=${safety}`;
}

function phase55DetailedReviewEvidenceFromRecord(record: Record<string, unknown>): string {
  const reviewerConfigured = booleanValue(record.designReviewerConfigured);
  const reviewStatusApproved = booleanValue(record.reviewStatusApproved);
  const reviewStatus = stringValue(record.reviewStatus);
  if (reviewerConfigured !== true || reviewStatusApproved !== true) return "";
  return reviewStatus ? `review-approved; status=${reviewStatus}` : "review-approved";
}

function phase55DetailedAuthorizationEvidenceFromRecord(record: Record<string, unknown>): string {
  const approverConfigured = booleanValue(record.implementationApproverConfigured);
  const scopeConfigured = booleanValue(record.approvedImplementationScopeConfigured);
  const safetyConfigured = booleanValue(record.safetySignoffConfigured);
  if (approverConfigured !== true || scopeConfigured !== true || safetyConfigured !== true) return "";
  return "implementation-authorized";
}

function phase56DetailedImplementationReadinessEvidenceFromEnv(env: NodeJS.ProcessEnv): string {
  const implementation = stringValue(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN);
  const validation = stringValue(env.TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN);
  const dataSafety = stringValue(env.TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN);
  if (!implementation || !validation || !dataSafety) return "";
  return `${implementation}; validation=${validation}; dataSafety=${dataSafety}`;
}

function phase56DetailedRolloutSafetyEvidenceFromEnv(env: NodeJS.ProcessEnv): string {
  const rollout = stringValue(env.TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN);
  const cutover = stringValue(env.TASKLOOM_MULTI_WRITER_CUTOVER_PLAN);
  const rollbackDrill = stringValue(env.TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE);
  if (!rollout || !cutover || !rollbackDrill) return "";
  return `${rollout}; cutover=${cutover}; rollbackDrill=${rollbackDrill}`;
}

function phase56DetailedImplementationReadinessEvidenceFromRecord(record: Record<string, unknown>): string {
  const implementation = booleanValue(record.implementationPlanConfigured);
  const validation = booleanValue(record.testValidationPlanConfigured);
  const dataSafety = booleanValue(record.dataSafetyPlanConfigured);
  if (implementation !== true || validation !== true || dataSafety !== true) return "";
  return "detailed-implementation-readiness";
}

function phase56DetailedRolloutSafetyEvidenceFromRecord(record: Record<string, unknown>): string {
  const rollout = booleanValue(record.rolloutPlanConfigured);
  const cutover = booleanValue(record.cutoverPlanConfigured);
  const rollbackDrill = booleanValue(record.rollbackDrillEvidenceConfigured);
  if (rollout !== true || cutover !== true || rollbackDrill !== true) return "";
  return "detailed-rollout-safety";
}

function phase53EvidenceAttached(
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  evidenceKey: "requirementsEvidenceConfigured" | "designEvidenceConfigured",
): boolean {
  const runtimePhase53: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.phase53)
    ? managedDatabaseRuntimeGuard.phase53
    : {};
  const topologyManagedDatabase: Record<string, unknown> = isRecord(managedDatabaseTopology.managedDatabase)
    ? managedDatabaseTopology.managedDatabase
    : {};
  const topologyPhase53: Record<string, unknown> = isRecord(topologyManagedDatabase.phase53)
    ? topologyManagedDatabase.phase53
    : {};

  return booleanValue(runtimePhase53[evidenceKey]) ??
    booleanValue(topologyPhase53[evidenceKey]) ??
    false;
}

function topologyDesignPackageRecord(
  report: unknown,
): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase54"]) ??
    findNestedRecord(report, ["multiWriterTopologyDesignPackageGate"]) ??
    findNestedRecord(report, ["multiWriterTopologyDesignPackage"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase54"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterTopologyDesignPackageGate"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase54"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "multiWriterTopologyDesignPackageGate"]);
}

function topologyImplementationAuthorizationRecord(
  report: unknown,
): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase55"]) ??
    findNestedRecord(report, ["multiWriterTopologyImplementationAuthorizationGate"]) ??
    findNestedRecord(report, ["multiWriterTopologyReviewAuthorizationGate"]) ??
    findNestedRecord(report, ["multiWriterTopologyImplementationAuthorization"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase55"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterTopologyImplementationAuthorizationGate"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase55"]) ??
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "multiWriterTopologyImplementationAuthorizationGate"],
    );
}

function topologyImplementationReadinessRecord(
  report: unknown,
): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase56"]) ??
    findNestedRecord(report, ["multiWriterTopologyImplementationReadinessGate"]) ??
    findNestedRecord(report, ["multiWriterRuntimeImplementationReadinessGate"]) ??
    findNestedRecord(report, ["multiWriterTopologyRolloutSafetyGate"]) ??
    findNestedRecord(report, ["multiWriterTopologyImplementationReadiness"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase56"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterTopologyImplementationReadinessGate"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase56"]) ??
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "multiWriterTopologyImplementationReadinessGate"],
    );
}

function topologyImplementationScopeRecord(
  report: unknown,
): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase57"]) ??
    findNestedRecord(report, ["multiWriterTopologyImplementationScope"]) ??
    findNestedRecord(report, ["multiWriterTopologyImplementationScopeGate"]) ??
    findNestedRecord(report, ["multiWriterRuntimeImplementationScope"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase57"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterTopologyImplementationScope"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase57"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "multiWriterTopologyImplementationScope"]);
}

function runtimeImplementationValidationRecord(
  report: unknown,
): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase58"]) ??
    findNestedRecord(report, ["multiWriterRuntimeImplementationValidation"]) ??
    findNestedRecord(report, ["multiWriterRuntimeImplementationValidationGate"]) ??
    findNestedRecord(report, ["multiWriterTopologyRuntimeImplementationValidation"]) ??
    findNestedRecord(report, ["multiWriterOperationsValidationGate"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase58"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterRuntimeImplementationValidation"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase58"]) ??
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "multiWriterRuntimeImplementationValidation"],
    );
}

function runtimeReleaseEnablementApprovalRecord(
  report: unknown,
): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase59"]) ??
    findNestedRecord(report, ["multiWriterRuntimeReleaseEnablementApproval"]) ??
    findNestedRecord(report, ["multiWriterRuntimeReleaseEnablementApprovalGate"]) ??
    findNestedRecord(report, ["multiWriterRuntimeReleaseEnablement"]) ??
    findNestedRecord(report, ["multiWriterRuntimeReleaseApprovalGate"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase59"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterRuntimeReleaseEnablementApproval"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase59"]) ??
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "multiWriterRuntimeReleaseEnablementApproval"],
    );
}

function runtimeSupportPresenceAssertionRecord(
  report: unknown,
): Record<string, unknown> | null {
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

function runtimeActivationControlsRecord(
  report: unknown,
): Record<string, unknown> | null {
  if (!isRecord(report)) return null;
  return findNestedRecord(report, ["phase61"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivationControls"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivationControlsGate"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivation"]) ??
    findNestedRecord(report, ["multiWriterRuntimeActivationControlGate"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "phase61"]) ??
    findNestedRecord(report, ["asyncStoreBoundary", "multiWriterRuntimeActivationControls"]) ??
    findNestedRecord(report, ["releaseReadiness", "asyncStoreBoundary", "phase61"]) ??
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "multiWriterRuntimeActivationControls"],
    );
}

function horizontalWriterConcurrencyRecord(
  report: unknown,
): Record<string, unknown> | null {
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
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ) ??
    findNestedRecord(
      report,
      ["releaseReadiness", "asyncStoreBoundary", "managedPostgresHorizontalWriterConcurrency"],
    );
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
        const id = stringValue(entry.key) || stringValue(entry.id) || stringValue(entry.name);
        if (keys.includes(id)) return entry;
      }
    }
  }
  return null;
}

function deriveManagedPostgresCapability(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
): ManagedPostgresCapabilityStatus {
  const configuredHintKeys = managedPostgresHintKeys(env);
  const phase50: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.phase50)
    ? managedDatabaseRuntimeGuard.phase50
    : {};
  const observed: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.observed)
    ? managedDatabaseRuntimeGuard.observed
    : {};
  const adapter = stringValue(phase50.adapter) ||
    stringValue(observed.managedDatabaseAdapter) ||
    stringValue(env.TASKLOOM_MANAGED_DATABASE_ADAPTER).toLowerCase() ||
    null;
  const hasManagedDatabaseUrl = MANAGED_POSTGRES_URL_HINT_KEYS.some((key) => hasConfiguredEnvValue(env, key));
  const adapterConfigured = booleanValue(phase50.asyncAdapterConfigured) ??
    Boolean(adapter);
  const adapterAvailable = booleanValue(phase50.asyncAdapterAvailable) ??
    Boolean(adapter && MANAGED_POSTGRES_ADAPTERS.has(adapter) && hasManagedDatabaseUrl && packageAvailable("pg"));
  const backfillAvailable = booleanValue(phase50.backfillAvailable) ?? adapterAvailable;
  const runtimeAllowed = Boolean(managedDatabaseRuntimeGuard.allowed);
  const syncRuntimeGuarded = Boolean(managedDatabaseRuntimeGuard.managedDatabaseRuntimeBlocked) && !runtimeAllowed;
  const status: ManagedPostgresCapabilityStatus["status"] = adapterAvailable
    ? adapterConfigured
      ? "available"
      : "not-configured"
    : adapterConfigured
      ? "missing-adapter"
      : "not-configured";
  const summary = adapterConfigured
    ? adapterAvailable
      ? syncRuntimeGuarded
        ? "Phase 50 managed Postgres adapter/backfill capability is configured and available from env hints; the synchronous app runtime remains guarded."
        : "Phase 50 managed Postgres adapter/backfill capability is configured and available from env hints."
      : "Phase 50 managed Postgres env hints are configured, but the pg adapter package is not available."
    : adapterAvailable
      ? "Phase 50 managed Postgres adapter/backfill capability is available, but no managed Postgres env hints are configured."
      : "Phase 50 managed Postgres adapter/backfill capability is not configured.";

  return {
    phase: "50",
    status,
    summary,
    adapterConfigured,
    adapterAvailable,
    backfillAvailable,
    syncRuntimeGuarded,
    runtimeAllowed,
    managedIntentDetected: configuredHintKeys.length > 0,
    configuredHintKeys,
    adapter,
    provider: "postgres",
    backfillCommands: Array.from(MANAGED_POSTGRES_BACKFILL_COMMANDS),
  };
}

function deriveManagedPostgresStartupSupport(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedPostgresCapability: ManagedPostgresCapabilityStatus,
): ManagedPostgresStartupSupportStatus {
  const phase51: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.phase51)
    ? managedDatabaseRuntimeGuard.phase51
    : {};
  const phase52: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.phase52)
    ? managedDatabaseRuntimeGuard.phase52
    : {};
  const observed: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.observed)
    ? managedDatabaseRuntimeGuard.observed
    : {};
  const topology = (
    stringValue(observed.databaseTopology) ||
    stringValue(env.TASKLOOM_DATABASE_TOPOLOGY)
  ).toLowerCase();
  const multiWriterIntentDetected =
    MULTI_WRITER_TOPOLOGY_HINTS.has(topology) ||
    managedDatabaseRuntimeGuard.classification === "multi-writer-blocked";
  const runtimeCallSitesMigrated = booleanValue(phase51.runtimeCallSitesMigrated) ??
    (Array.isArray(phase51.remainingSyncCallSiteGroups) && phase51.remainingSyncCallSiteGroups.length === 0);
  const startupSupported = booleanValue(phase52.managedPostgresStartupSupported) ??
    (managedPostgresCapability.adapterAvailable && runtimeCallSitesMigrated === true && !multiWriterIntentDetected);
  const managedIntentDetected = managedPostgresCapability.managedIntentDetected ||
    managedDatabaseRuntimeGuard.classification === "managed-postgres" ||
    managedDatabaseRuntimeGuard.classification === "managed-database-blocked";
  const status: ManagedPostgresStartupSupportStatus["status"] = multiWriterIntentDetected
    ? "multi-writer-unsupported"
    : startupSupported
      ? "supported"
      : managedIntentDetected || managedPostgresCapability.adapterConfigured
        ? "blocked"
        : "not-configured";
  const summary = stringValue(phase52.summary) || (
    multiWriterIntentDetected
      ? "Phase 52 managed Postgres startup support is not asserted for multi-writer, distributed, or active-active topology."
      : startupSupported
        ? "Phase 52 managed Postgres startup support is asserted for single-writer managed Postgres startup."
        : managedPostgresCapability.adapterAvailable
          ? "Phase 52 managed Postgres startup support is blocked until runtime call-site migration evidence is complete."
          : "Phase 52 managed Postgres startup support is not configured; Phase 50 adapter/backfill evidence remains separate from startup support."
  );

  return {
    phase: "52",
    status,
    summary,
    startupSupported,
    managedIntentDetected,
    adapterAvailable: managedPostgresCapability.adapterAvailable,
    runtimeCallSitesMigrated: runtimeCallSitesMigrated === true,
    multiWriterSupported: false,
    multiWriterIntentDetected,
    source: isRecord(managedDatabaseRuntimeGuard.phase52) ? "managedDatabaseRuntimeGuard" : "derived",
  };
}

function deriveManagedPostgresTopologyGate(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedPostgresCapability: ManagedPostgresCapabilityStatus,
  managedPostgresStartupSupport: ManagedPostgresStartupSupportStatus,
): ManagedPostgresTopologyGateStatus {
  const runtimeGuardRecord: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard)
    ? managedDatabaseRuntimeGuard as unknown as Record<string, unknown>
    : {};
  const phase53: Record<string, unknown> = isRecord(runtimeGuardRecord.phase53)
    ? runtimeGuardRecord.phase53
    : {};
  const guardObserved: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.observed)
    ? managedDatabaseRuntimeGuard.observed
    : {};
  const topologyObserved: Record<string, unknown> = isRecord(managedDatabaseTopology.observed)
    ? managedDatabaseTopology.observed
    : {};
  const topologyIntent = (
    stringValue(phase53.topologyIntent) ||
    stringValue(phase53.topology) ||
    stringValue(guardObserved.databaseTopology) ||
    stringValue(topologyObserved.databaseTopology) ||
    stringValue(env.TASKLOOM_DATABASE_TOPOLOGY) ||
    null
  );
  const normalizedTopology = topologyIntent?.toLowerCase() ?? "";
  const classification = stringValue(managedDatabaseRuntimeGuard.classification) ||
    stringValue(managedDatabaseTopology.classification);
  const multiWriterIntentDetected = booleanValue(phase53.multiWriterIntentDetected) ??
    (
      managedPostgresStartupSupport.multiWriterIntentDetected ||
      MULTI_WRITER_TOPOLOGY_HINTS.has(normalizedTopology) ||
      classification === "multi-writer-blocked"
    );
  const managedIntentDetected = booleanValue(phase53.managedIntentDetected) ??
    (
      managedPostgresStartupSupport.managedIntentDetected ||
      managedPostgresCapability.managedIntentDetected ||
      SINGLE_WRITER_TOPOLOGY_HINTS.has(normalizedTopology)
    );
  const singleWriterManagedPostgresSupported = booleanValue(phase53.singleWriterManagedPostgresSupported) ??
    (managedIntentDetected && managedPostgresStartupSupport.startupSupported && !multiWriterIntentDetected);
  const status: ManagedPostgresTopologyGateStatus["status"] = multiWriterIntentDetected
    ? "blocked"
    : singleWriterManagedPostgresSupported
      ? "supported"
      : managedIntentDetected
        ? "blocked"
        : "not-configured";
  const requirementsOnly = multiWriterIntentDetected;
  const phase53Summary = stringValue(phase53.summary);
  const summary = multiWriterIntentDetected
    ? phase53Summary && /implementation support/i.test(phase53Summary)
      ? phase53Summary
      : `${phase53Summary ? `${phase53Summary} ` : ""}Multi-writer, distributed, and active-active requirements are design intent only, not implementation support; multiWriterSupported=false.`
    : phase53Summary || (
      singleWriterManagedPostgresSupported
        ? "Phase 53 topology gate allows supported single-writer managed Postgres; multi-writer, distributed, and active-active runtime support remains unavailable."
        : managedIntentDetected
          ? "Phase 53 topology gate sees managed Postgres intent, but single-writer startup support is not complete."
          : "Phase 53 topology gate has no managed Postgres topology intent to evaluate."
    );

  return {
    phase: "53",
    status,
    summary,
    managedIntentDetected,
    singleWriterManagedPostgresSupported,
    multiWriterIntentDetected,
    multiWriterSupported: false,
    topologyIntent,
    requirementsOnly,
    implementationScope: singleWriterManagedPostgresSupported ? "single-writer-managed-postgres" : "none",
    source: isRecord(runtimeGuardRecord.phase53) ? "managedDatabaseRuntimeGuard" : "derived",
  };
}

function deriveMultiWriterTopologyDesignPackageGate(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  managedPostgresTopologyGate: ManagedPostgresTopologyGateStatus,
): MultiWriterTopologyDesignPackageGateStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterTopologyDesignPackageGateStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = topologyDesignPackageRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase54 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase54?.record.multiWriterIntentDetected) ??
    booleanValue(phase54?.record.multiWriterTopologyRequested) ??
    managedPostgresTopologyGate.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase54?.record.topologyIntent) ||
    managedPostgresTopologyGate.topologyIntent ||
    null;
  const phase53RequirementsEvidenceAttached = booleanValue(phase54?.record.phase53RequirementsEvidenceAttached) ??
    phase53EvidenceAttached(
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      "requirementsEvidenceConfigured",
    );
  const phase53DesignEvidenceAttached = booleanValue(phase54?.record.phase53DesignEvidenceAttached) ??
    phase53EvidenceAttached(
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      "designEvidenceConfigured",
    );
  const required = multiWriterIntentDetected;

  const evidenceEntries = MULTI_WRITER_TOPOLOGY_DESIGN_PACKAGE_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterTopologyDesignPackageEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }
    const configured = value.length > 0;
    const status: MultiWriterTopologyDesignPackageEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";

    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<MultiWriterTopologyDesignPackageEvidenceKey, MultiWriterTopologyDesignPackageEvidenceStatus>;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const designPackageStatus: MultiWriterTopologyDesignPackageGateStatus["designPackageStatus"] = required
    ? missingEvidence.length === 0 && phase53RequirementsEvidenceAttached && phase53DesignEvidenceAttached
      ? "complete"
      : "incomplete"
    : "not-required";
  const summary = required
    ? designPackageStatus === "complete"
      ? "Phase 54 multi-writer topology design package evidence is complete, but multi-writer runtime support remains unavailable; runtimeSupported=false."
      : "Phase 54 multi-writer topology design package evidence is incomplete and multi-writer runtime support remains unavailable; runtimeSupported=false."
    : "Phase 54 multi-writer topology design package gate is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "54",
    status: required ? "blocked" : "not-required",
    designPackageStatus,
    summary,
    required,
    releaseAllowed: false,
    runtimeSupported: false,
    multiWriterIntentDetected,
    topologyIntent,
    phase53RequirementsEvidenceAttached,
    phase53DesignEvidenceAttached,
    topologyOwner: evidenceByKey.topologyOwner,
    consistencyModel: evidenceByKey.consistencyModel,
    failoverPitr: evidenceByKey.failoverPitr,
    migrationBackfill: evidenceByKey.migrationBackfill,
    observability: evidenceByKey.observability,
    rollback: evidenceByKey.rollback,
    missingEvidence,
    source: phase54?.source ?? "derived",
  };
}

function deriveMultiWriterTopologyImplementationAuthorizationGate(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterTopologyDesignPackageGate: MultiWriterTopologyDesignPackageGateStatus,
): MultiWriterTopologyImplementationAuthorizationGateStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterTopologyImplementationAuthorizationGateStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = topologyImplementationAuthorizationRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase55 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase55?.record.multiWriterIntentDetected) ??
    multiWriterTopologyDesignPackageGate.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase55?.record.topologyIntent) ||
    multiWriterTopologyDesignPackageGate.topologyIntent ||
    null;
  const designPackageStatus = multiWriterTopologyDesignPackageGate.designPackageStatus;
  const designPackageComplete = booleanValue(phase55?.record.designPackageComplete) ??
    designPackageStatus === "complete";
  const required = multiWriterIntentDetected;

  const evidenceEntries = MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_AUTHORIZATION_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterTopologyImplementationAuthorizationEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value && definition.key === "designPackageReview") {
      value = phase55DetailedReviewEvidenceFromEnv(env);
      if (value) source = "env";
    }
    if (!value && definition.key === "implementationAuthorization") {
      value = phase55DetailedAuthorizationEvidenceFromEnv(env);
      if (value) source = "env";
    }
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys) ||
          (definition.key === "designPackageReview"
            ? phase55DetailedReviewEvidenceFromRecord(candidate.record)
            : phase55DetailedAuthorizationEvidenceFromRecord(candidate.record));
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }
    const configured = value.length > 0;
    const status: MultiWriterTopologyImplementationAuthorizationEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";

    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    MultiWriterTopologyImplementationAuthorizationEvidenceKey,
    MultiWriterTopologyImplementationAuthorizationEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const reviewStatus: MultiWriterTopologyImplementationAuthorizationGateStatus["reviewStatus"] = required
    ? evidenceByKey.designPackageReview.configured ? "approved" : "missing"
    : "not-required";
  const implementationAuthorizationStatus:
    MultiWriterTopologyImplementationAuthorizationGateStatus["implementationAuthorizationStatus"] = required
      ? evidenceByKey.implementationAuthorization.configured ? "authorized" : "missing"
      : "not-required";
  const implementationAuthorized = required &&
    designPackageComplete &&
    reviewStatus === "approved" &&
    implementationAuthorizationStatus === "authorized";
  const status: MultiWriterTopologyImplementationAuthorizationGateStatus["status"] = required
    ? implementationAuthorized ? "authorized" : "blocked"
    : "not-required";
  const summary = required
    ? implementationAuthorized
      ? "Phase 55 multi-writer topology design-package review and implementation authorization are recorded; runtime implementation remains blocked until a future runtime phase; runtimeSupported=false."
      : designPackageComplete
        ? `Phase 55 multi-writer topology implementation authorization is blocked pending ${missingEvidence.join(", ") || "review/authorization evidence"}; runtimeSupported=false.`
        : "Phase 55 multi-writer topology implementation authorization is blocked until the Phase 54 design package is complete and review/authorization evidence is recorded; runtimeSupported=false."
    : "Phase 55 multi-writer topology implementation-authorization gate is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "55",
    status,
    reviewStatus,
    implementationAuthorizationStatus,
    summary,
    required,
    implementationAuthorized,
    runtimeImplementationBlocked: true,
    runtimeSupported: false,
    releaseAllowed: false,
    multiWriterIntentDetected,
    topologyIntent,
    designPackageStatus,
    designPackageComplete,
    designPackageReview: evidenceByKey.designPackageReview,
    implementationAuthorization: evidenceByKey.implementationAuthorization,
    missingEvidence,
    source: phase55?.source ?? "derived",
  };
}

function deriveMultiWriterTopologyImplementationReadinessGate(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterTopologyImplementationAuthorizationGate: MultiWriterTopologyImplementationAuthorizationGateStatus,
): MultiWriterTopologyImplementationReadinessGateStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterTopologyImplementationReadinessGateStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = topologyImplementationReadinessRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase56 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase56?.record.multiWriterIntentDetected) ??
    multiWriterTopologyImplementationAuthorizationGate.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase56?.record.topologyIntent) ||
    multiWriterTopologyImplementationAuthorizationGate.topologyIntent ||
    null;
  const implementationAuthorized = booleanValue(phase56?.record.implementationAuthorized) ??
    multiWriterTopologyImplementationAuthorizationGate.implementationAuthorized;
  const required = multiWriterIntentDetected;

  const evidenceEntries = MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_READINESS_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterTopologyImplementationReadinessEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value && definition.key === "implementationReadiness") {
      value = phase56DetailedImplementationReadinessEvidenceFromEnv(env);
      if (value) source = "env";
    }
    if (!value && definition.key === "rolloutSafety") {
      value = phase56DetailedRolloutSafetyEvidenceFromEnv(env);
      if (value) source = "env";
    }
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        let detailed = "";
        if (definition.key === "implementationReadiness") {
          detailed = phase56DetailedImplementationReadinessEvidenceFromRecord(candidate.record);
        }
        if (definition.key === "rolloutSafety") {
          detailed = phase56DetailedRolloutSafetyEvidenceFromRecord(candidate.record);
        }
        value = direct || nested || detailed;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }
    const configured = value.length > 0;
    const status: MultiWriterTopologyImplementationReadinessEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";

    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    MultiWriterTopologyImplementationReadinessEvidenceKey,
    MultiWriterTopologyImplementationReadinessEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const implementationReadinessComplete = required && evidenceByKey.implementationReadiness.configured;
  const rolloutSafetyComplete = required && evidenceByKey.rolloutSafety.configured;
  const implementationReadinessStatus:
    MultiWriterTopologyImplementationReadinessGateStatus["implementationReadinessStatus"] = required
      ? implementationReadinessComplete ? "complete" : "missing"
      : "not-required";
  const rolloutSafetyStatus: MultiWriterTopologyImplementationReadinessGateStatus["rolloutSafetyStatus"] = required
    ? rolloutSafetyComplete ? "complete" : "missing"
    : "not-required";
  const readinessEvidenceComplete = implementationAuthorized &&
    implementationReadinessComplete &&
    rolloutSafetyComplete;
  const status: MultiWriterTopologyImplementationReadinessGateStatus["status"] = required
    ? readinessEvidenceComplete ? "evidence-complete" : "blocked"
    : "not-required";
  const summary = required
    ? !implementationAuthorized
      ? "Phase 56 multi-writer implementation readiness and rollout-safety gate is blocked until Phase 55 implementation authorization is recorded; runtimeSupported=false."
      : readinessEvidenceComplete
        ? "Phase 56 multi-writer implementation readiness and rollout-safety evidence is complete; runtime implementation remains blocked until a future runtime phase; runtimeSupported=false."
        : `Phase 56 multi-writer implementation readiness and rollout-safety gate is blocked pending ${missingEvidence.join(", ") || "readiness/rollout safety evidence"}; runtimeSupported=false.`
    : "Phase 56 multi-writer implementation readiness and rollout-safety gate is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "56",
    status,
    implementationReadinessStatus,
    rolloutSafetyStatus,
    summary,
    required,
    implementationAuthorized,
    implementationReadinessComplete,
    rolloutSafetyComplete,
    runtimeImplementationBlocked: true,
    runtimeSupported: false,
    releaseAllowed: false,
    multiWriterIntentDetected,
    topologyIntent,
    implementationAuthorizationStatus: multiWriterTopologyImplementationAuthorizationGate.status,
    implementationReadiness: evidenceByKey.implementationReadiness,
    rolloutSafety: evidenceByKey.rolloutSafety,
    missingEvidence,
    source: phase56?.source ?? "derived",
  };
}

function deriveMultiWriterTopologyImplementationScope(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterTopologyImplementationReadinessGate: MultiWriterTopologyImplementationReadinessGateStatus,
): MultiWriterTopologyImplementationScopeStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterTopologyImplementationScopeStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = topologyImplementationScopeRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase57 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase57?.record.multiWriterIntentDetected) ??
    multiWriterTopologyImplementationReadinessGate.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase57?.record.topologyIntent) ||
    multiWriterTopologyImplementationReadinessGate.topologyIntent ||
    null;
  const required = multiWriterIntentDetected;
  const phase56EvidenceComplete = multiWriterTopologyImplementationReadinessGate.status === "evidence-complete";

  const evidenceEntries = MULTI_WRITER_TOPOLOGY_IMPLEMENTATION_SCOPE_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterTopologyImplementationScopeEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }

    const configured = value.length > 0;
    const status: MultiWriterTopologyImplementationScopeEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    MultiWriterTopologyImplementationScopeEvidenceKey,
    MultiWriterTopologyImplementationScopeEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const allScopeEvidenceConfigured = evidenceEntries.every((entry) => entry.configured);
  const implementationScopeComplete = required && phase56EvidenceComplete && allScopeEvidenceConfigured;
  const implementationScopeStatus: MultiWriterTopologyImplementationScopeStatus["implementationScopeStatus"] = required
    ? implementationScopeComplete
      ? "complete"
      : allScopeEvidenceConfigured && !phase56EvidenceComplete
        ? "blocked"
        : "missing"
    : "not-required";
  const status: MultiWriterTopologyImplementationScopeStatus["status"] = required
    ? implementationScopeComplete ? "scope-complete" : "blocked"
    : "not-required";
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 57 implementation-scope evidence";
  const summary = required
    ? !phase56EvidenceComplete
      ? "Phase 57 multi-writer implementation scope is blocked until Phase 56 implementation readiness and rollout-safety evidence is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
      : implementationScopeComplete
        ? "Phase 57 multi-writer implementation scope evidence is complete; runtime implementation remains blocked and unsupported until a future runtime phase; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
        : `Phase 57 multi-writer implementation scope is blocked pending ${missingEvidenceSummary}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false.`
    : "Phase 57 multi-writer implementation scope is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "57",
    status,
    implementationScopeStatus,
    summary,
    required,
    phase56EvidenceComplete,
    implementationScopeComplete,
    runtimeImplementationBlocked: true,
    runtimeSupported: false,
    releaseAllowed: false,
    multiWriterIntentDetected,
    topologyIntent,
    implementationReadinessStatus: multiWriterTopologyImplementationReadinessGate.status,
    evidence: evidenceByKey,
    implementationScope: evidenceByKey.implementationScopeLock,
    implementationScopeLock: evidenceByKey.implementationScopeLock,
    runtimeFeatureFlag: evidenceByKey.runtimeFeatureFlag,
    validationEvidence: evidenceByKey.validationEvidence,
    migrationCutoverLock: evidenceByKey.migrationCutoverLock,
    releaseOwnerSignoff: evidenceByKey.releaseOwnerSignoff,
    missingEvidence,
    source: phase57?.source ?? "derived",
  };
}

function deriveMultiWriterRuntimeImplementationValidation(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterTopologyImplementationScope: MultiWriterTopologyImplementationScopeStatus,
): MultiWriterRuntimeImplementationValidationStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterRuntimeImplementationValidationStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = runtimeImplementationValidationRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase58 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase58?.record.multiWriterIntentDetected) ??
    multiWriterTopologyImplementationScope.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase58?.record.topologyIntent) ||
    multiWriterTopologyImplementationScope.topologyIntent ||
    null;
  const required = multiWriterIntentDetected;
  const phase57ImplementationScopeComplete =
    multiWriterTopologyImplementationScope.status === "scope-complete";

  const evidenceEntries = MULTI_WRITER_RUNTIME_IMPLEMENTATION_VALIDATION_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterRuntimeImplementationValidationEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }

    const configured = value.length > 0;
    const status: MultiWriterRuntimeImplementationValidationEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    MultiWriterRuntimeImplementationValidationEvidenceKey,
    MultiWriterRuntimeImplementationValidationEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const allValidationEvidenceConfigured = evidenceEntries.every((entry) => entry.configured);
  const runtimeImplementationValidationComplete =
    required && phase57ImplementationScopeComplete && allValidationEvidenceConfigured;
  const validationStatus: MultiWriterRuntimeImplementationValidationStatus["validationStatus"] = required
    ? runtimeImplementationValidationComplete
      ? "complete"
      : allValidationEvidenceConfigured && !phase57ImplementationScopeComplete
        ? "blocked"
        : "missing"
    : "not-required";
  const status: MultiWriterRuntimeImplementationValidationStatus["status"] = required
    ? runtimeImplementationValidationComplete ? "validation-complete" : "blocked"
    : "not-required";
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 58 runtime validation evidence";
  const summary = required
    ? !phase57ImplementationScopeComplete
      ? "Phase 58 multi-writer runtime implementation validation is blocked until Phase 57 implementation scope is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
      : runtimeImplementationValidationComplete
        ? "Phase 58 multi-writer runtime implementation validation evidence is complete; runtime implementation remains blocked and unsupported until a future runtime release phase; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
        : `Phase 58 multi-writer runtime implementation validation is blocked pending ${missingEvidenceSummary}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false.`
    : "Phase 58 multi-writer runtime implementation validation is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "58",
    status,
    validationStatus,
    summary,
    required,
    phase57ImplementationScopeComplete,
    runtimeImplementationValidationComplete,
    runtimeImplementationBlocked: true,
    runtimeSupported: false,
    releaseAllowed: false,
    multiWriterIntentDetected,
    topologyIntent,
    implementationScopeStatus: multiWriterTopologyImplementationScope.status,
    evidence: evidenceByKey,
    runtimeImplementationEvidence: evidenceByKey.runtimeImplementationEvidence,
    consistencyValidationEvidence: evidenceByKey.consistencyValidationEvidence,
    failoverValidationEvidence: evidenceByKey.failoverValidationEvidence,
    dataIntegrityValidationEvidence: evidenceByKey.dataIntegrityValidationEvidence,
    operationsRunbook: evidenceByKey.operationsRunbook,
    runtimeReleaseSignoff: evidenceByKey.runtimeReleaseSignoff,
    missingEvidence,
    source: phase58?.source ?? "derived",
  };
}

function deriveMultiWriterRuntimeReleaseEnablementApproval(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterRuntimeImplementationValidation: MultiWriterRuntimeImplementationValidationStatus,
): MultiWriterRuntimeReleaseEnablementApprovalStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterRuntimeReleaseEnablementApprovalStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = runtimeReleaseEnablementApprovalRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase59 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase59?.record.multiWriterIntentDetected) ??
    multiWriterRuntimeImplementationValidation.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase59?.record.topologyIntent) ||
    multiWriterRuntimeImplementationValidation.topologyIntent ||
    null;
  const required = multiWriterIntentDetected;
  const phase58RuntimeValidationComplete =
    multiWriterRuntimeImplementationValidation.status === "validation-complete";

  const evidenceEntries = MULTI_WRITER_RUNTIME_RELEASE_ENABLEMENT_APPROVAL_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }

    const configured = value.length > 0;
    const status: MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    MultiWriterRuntimeReleaseEnablementApprovalEvidenceKey,
    MultiWriterRuntimeReleaseEnablementApprovalEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const allApprovalEvidenceConfigured = evidenceEntries.every((entry) => entry.configured);
  const releaseEnablementApprovalComplete =
    required && phase58RuntimeValidationComplete && allApprovalEvidenceConfigured;
  const approvalStatus: MultiWriterRuntimeReleaseEnablementApprovalStatus["approvalStatus"] = required
    ? releaseEnablementApprovalComplete
      ? "complete"
      : allApprovalEvidenceConfigured && !phase58RuntimeValidationComplete
        ? "blocked"
        : "missing"
    : "not-required";
  const status: MultiWriterRuntimeReleaseEnablementApprovalStatus["status"] = required
    ? releaseEnablementApprovalComplete ? "approval-complete" : "blocked"
    : "not-required";
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 59 runtime release enablement approval evidence";
  const summary = required
    ? !phase58RuntimeValidationComplete
      ? "Phase 59 multi-writer runtime release-enable approval is blocked until Phase 58 runtime implementation validation is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
      : releaseEnablementApprovalComplete
        ? "Phase 59 multi-writer runtime release-enable approval evidence is complete and visible for approval audit, but runtime support and release remain blocked until actual multi-writer runtime exists; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
        : `Phase 59 multi-writer runtime release-enable approval is blocked pending ${missingEvidenceSummary}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false.`
    : "Phase 59 multi-writer runtime release-enable approval is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "59",
    status,
    approvalStatus,
    summary,
    required,
    phase58RuntimeValidationComplete,
    releaseEnablementApprovalComplete,
    runtimeImplementationBlocked: true,
    runtimeSupported: false,
    releaseAllowed: false,
    multiWriterIntentDetected,
    topologyIntent,
    runtimeImplementationValidationStatus: multiWriterRuntimeImplementationValidation.status,
    evidence: evidenceByKey,
    enablementDecision: evidenceByKey.enablementDecision,
    approver: evidenceByKey.approver,
    rolloutWindow: evidenceByKey.rolloutWindow,
    monitoringSignoff: evidenceByKey.monitoringSignoff,
    abortPlan: evidenceByKey.abortPlan,
    releaseTicket: evidenceByKey.releaseTicket,
    missingEvidence,
    source: phase59?.source ?? "derived",
  };
}

function deriveMultiWriterRuntimeSupportPresenceAssertion(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterRuntimeReleaseEnablementApproval: MultiWriterRuntimeReleaseEnablementApprovalStatus,
): MultiWriterRuntimeSupportPresenceAssertionStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterRuntimeSupportPresenceAssertionStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = runtimeSupportPresenceAssertionRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase60 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase60?.record.multiWriterIntentDetected) ??
    multiWriterRuntimeReleaseEnablementApproval.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase60?.record.topologyIntent) ||
    multiWriterRuntimeReleaseEnablementApproval.topologyIntent ||
    null;
  const required = multiWriterIntentDetected;
  const phase59ReleaseEnablementApprovalComplete =
    multiWriterRuntimeReleaseEnablementApproval.status === "approval-complete";

  const evidenceEntries = MULTI_WRITER_RUNTIME_SUPPORT_PRESENCE_ASSERTION_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }

    const configured = value.length > 0;
    const status: MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    MultiWriterRuntimeSupportPresenceAssertionEvidenceKey,
    MultiWriterRuntimeSupportPresenceAssertionEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const allAssertionEvidenceConfigured = evidenceEntries.every((entry) => entry.configured);
  const runtimeSupportPresenceAssertionComplete =
    required && phase59ReleaseEnablementApprovalComplete && allAssertionEvidenceConfigured;
  const assertionStatus: MultiWriterRuntimeSupportPresenceAssertionStatus["assertionStatus"] = required
    ? runtimeSupportPresenceAssertionComplete
      ? "complete"
      : allAssertionEvidenceConfigured && !phase59ReleaseEnablementApprovalComplete
        ? "blocked"
        : "missing"
    : "not-required";
  const status: MultiWriterRuntimeSupportPresenceAssertionStatus["status"] = required
    ? runtimeSupportPresenceAssertionComplete ? "assertion-complete" : "blocked"
    : "not-required";
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 60 runtime support presence assertion evidence";
  const summary = required
    ? !phase59ReleaseEnablementApprovalComplete
      ? "Phase 60 multi-writer runtime support presence assertion is blocked until Phase 59 release-enable approval is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
      : runtimeSupportPresenceAssertionComplete
        ? "Phase 60 multi-writer runtime support presence assertion evidence is complete and visible for support audit, but runtime support and release remain blocked in this repo; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
        : `Phase 60 multi-writer runtime support presence assertion is blocked pending ${missingEvidenceSummary}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false.`
    : "Phase 60 multi-writer runtime support presence assertion is not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "60",
    status,
    assertionStatus,
    summary,
    required,
    phase59ReleaseEnablementApprovalComplete,
    runtimeSupportPresenceAssertionComplete,
    runtimeImplementationBlocked: true,
    runtimeSupported: false,
    releaseAllowed: false,
    multiWriterIntentDetected,
    topologyIntent,
    releaseEnablementApprovalStatus: multiWriterRuntimeReleaseEnablementApproval.status,
    evidence: evidenceByKey,
    implementationPresent: evidenceByKey.implementationPresent,
    explicitSupportStatement: evidenceByKey.explicitSupportStatement,
    compatibilityMatrix: evidenceByKey.compatibilityMatrix,
    cutoverEvidence: evidenceByKey.cutoverEvidence,
    releaseAutomationApproval: evidenceByKey.releaseAutomationApproval,
    ownerAcceptance: evidenceByKey.ownerAcceptance,
    missingEvidence,
    source: phase60?.source ?? "derived",
  };
}

function deriveMultiWriterRuntimeActivationControls(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterRuntimeSupportPresenceAssertion: MultiWriterRuntimeSupportPresenceAssertionStatus,
): MultiWriterRuntimeActivationControlsStatus {
  const reportSources: Array<{
    source: Exclude<MultiWriterRuntimeActivationControlsStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = runtimeActivationControlsRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase61 = reportSources[0];
  const multiWriterIntentDetected = booleanValue(phase61?.record.multiWriterIntentDetected) ??
    multiWriterRuntimeSupportPresenceAssertion.multiWriterIntentDetected;
  const topologyIntent = stringValue(phase61?.record.topologyIntent) ||
    multiWriterRuntimeSupportPresenceAssertion.topologyIntent ||
    null;
  const required = multiWriterIntentDetected;
  const phase60RuntimeSupportPresenceAssertionComplete =
    multiWriterRuntimeSupportPresenceAssertion.status === "assertion-complete";

  const evidenceEntries = MULTI_WRITER_RUNTIME_ACTIVATION_CONTROLS_EVIDENCE.map((definition) => {
    let value = stringValue(env[definition.envKey]);
    let source: MultiWriterRuntimeActivationControlsEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }

    const configured = value.length > 0;
    const status: MultiWriterRuntimeActivationControlsEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    MultiWriterRuntimeActivationControlsEvidenceKey,
    MultiWriterRuntimeActivationControlsEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const allActivationControlsConfigured = evidenceEntries.every((entry) => entry.configured);
  const runtimeActivationControlsComplete =
    required && phase60RuntimeSupportPresenceAssertionComplete && allActivationControlsConfigured;
  const activationControlStatus: MultiWriterRuntimeActivationControlsStatus["activationControlStatus"] = required
    ? runtimeActivationControlsComplete
      ? "complete"
      : allActivationControlsConfigured && !phase60RuntimeSupportPresenceAssertionComplete
        ? "blocked"
        : "missing"
    : "not-required";
  const status: MultiWriterRuntimeActivationControlsStatus["status"] = required
    ? runtimeActivationControlsComplete ? "activation-controls-complete" : "blocked"
    : "not-required";
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 61 runtime activation controls";
  const summary = required
    ? !phase60RuntimeSupportPresenceAssertionComplete
      ? "Phase 61 multi-writer runtime activation controls are blocked until Phase 60 runtime support presence assertion is complete; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
      : runtimeActivationControlsComplete
        ? "Phase 61 multi-writer runtime activation controls are complete and visible for activation audit, but distributed, active-active, regional/PITR, and SQLite-distributed runtime support remain unsupported; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false."
        : `Phase 61 multi-writer runtime activation controls are blocked pending ${missingEvidenceSummary}; runtimeImplementationBlocked=true; runtimeSupported=false; releaseAllowed=false.`
    : "Phase 61 multi-writer runtime activation controls are not required without multi-writer, distributed, or active-active intent; runtimeSupported=false.";

  return {
    phase: "61",
    status,
    activationControlStatus,
    summary,
    required,
    phase60RuntimeSupportPresenceAssertionComplete,
    runtimeActivationControlsComplete,
    runtimeImplementationBlocked: true,
    runtimeSupported: false,
    releaseAllowed: false,
    multiWriterIntentDetected,
    topologyIntent,
    runtimeSupportPresenceAssertionStatus: multiWriterRuntimeSupportPresenceAssertion.status,
    evidence: evidenceByKey,
    activationDecision: evidenceByKey.activationDecision,
    activationOwner: evidenceByKey.activationOwner,
    activationWindow: evidenceByKey.activationWindow,
    activationFlag: evidenceByKey.activationFlag,
    releaseAutomationAssertion: evidenceByKey.releaseAutomationAssertion,
    missingEvidence,
    source: phase61?.source ?? "derived",
  };
}

function horizontalAppWriterIntentFromEnv(env: NodeJS.ProcessEnv): boolean {
  const topology = stringValue(env.TASKLOOM_APP_WRITER_TOPOLOGY).toLowerCase();
  const databaseTopology = stringValue(env.TASKLOOM_DATABASE_TOPOLOGY).toLowerCase();
  const horizontalWriterMode = stringValue(env.TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_MODE).toLowerCase();
  const horizontalWriterFlag = stringValue(env.TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_APP_WRITERS).toLowerCase();
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

function valueFromEnvKeys(env: NodeJS.ProcessEnv, keys: readonly string[]): string {
  for (const key of keys) {
    const value = stringValue(env[key]);
    if (value) return value;
  }
  return "";
}

function phase62ReportHardeningComplete(records: readonly Record<string, unknown>[]): boolean {
  return records.some((record) => {
    const required =
      booleanValue(record.required) === true ||
      booleanValue(record.horizontalWriterTopologyRequested) === true ||
      booleanValue(record.horizontalAppWriterIntentDetected) === true ||
      booleanValue(record.phase62HorizontalWriterTopologyRequested) === true;
    return required &&
      (booleanValue(record.managedPostgresHorizontalWriterHardeningComplete) === true ||
        booleanValue(record.horizontalWriterHardeningReady) === true ||
        booleanValue(record.horizontalWriterRuntimeSupported) === true ||
        booleanValue(record.phase62HorizontalWriterHardeningReady) === true ||
        booleanValue(record.phase62HorizontalWriterRuntimeSupported) === true);
  });
}

function deriveManagedPostgresHorizontalWriterConcurrency(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  managedPostgresCapability: ManagedPostgresCapabilityStatus,
  managedPostgresStartupSupport: ManagedPostgresStartupSupportStatus,
  managedPostgresTopologyGate: ManagedPostgresTopologyGateStatus,
): ManagedPostgresHorizontalWriterConcurrencyStatus {
  const reportSources: Array<{
    source: Exclude<ManagedPostgresHorizontalWriterConcurrencyStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = horizontalWriterConcurrencyRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase62 = reportSources[0];
  const reportIntent = reportSources.reduce<boolean | null>((result, candidate) => {
    if (result !== null) return result;
    return booleanValue(candidate.record.horizontalAppWriterIntentDetected) ??
      booleanValue(candidate.record.horizontalWriterIntentDetected) ??
      booleanValue(candidate.record.managedPostgresHorizontalWriterIntentDetected) ??
      booleanValue(candidate.record.horizontalWriterTopologyRequested) ??
      null;
  }, null);
  const horizontalAppWriterIntentDetected = horizontalAppWriterIntentFromEnv(env) || reportIntent === true;
  const required = horizontalAppWriterIntentDetected;
  const managedPostgresIntentDetected = managedPostgresCapability.managedIntentDetected ||
    reportSources.some((candidate) => booleanValue(candidate.record.managedPostgresIntentDetected) === true);
  const managedPostgresStartupSupported =
    managedPostgresStartupSupport.startupSupported ||
    reportSources.some((candidate) => booleanValue(candidate.record.managedPostgresStartupSupported) === true);
  const supportedManagedPostgresTopology =
    managedPostgresTopologyGate.status === "supported" ||
    reportSources.some((candidate) => booleanValue(candidate.record.supportedManagedPostgresTopology) === true);
  const reportHardeningComplete = phase62ReportHardeningComplete(reportSources.map((source) => source.record));

  const evidenceEntries = MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_EVIDENCE.map((definition) => {
    let value = valueFromEnvKeys(env, definition.envKeys ?? [definition.envKey]);
    let source: ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }
    if (!value && reportHardeningComplete && phase62) {
      value = "phase62 report hardening complete";
      source = phase62.source;
    }

    const configured = value.length > 0;
    const status: ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<
    ManagedPostgresHorizontalWriterConcurrencyEvidenceKey,
    ManagedPostgresHorizontalWriterConcurrencyEvidenceStatus
  >;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const allEvidenceConfigured = evidenceEntries.every((entry) => entry.configured);
  const managedPostgresHorizontalWriterHardeningComplete =
    required &&
    managedPostgresStartupSupported &&
    supportedManagedPostgresTopology &&
    (allEvidenceConfigured || reportHardeningComplete);
  const hardeningStatus: ManagedPostgresHorizontalWriterConcurrencyStatus["hardeningStatus"] = required
    ? managedPostgresHorizontalWriterHardeningComplete
      ? "complete"
      : !managedPostgresStartupSupported || !supportedManagedPostgresTopology
        ? "blocked"
        : "missing"
    : "not-configured";
  const status: ManagedPostgresHorizontalWriterConcurrencyStatus["status"] = required
    ? managedPostgresHorizontalWriterHardeningComplete ? "hardening-complete" : "blocked"
    : "not-configured";
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 62 horizontal-writer evidence";
  const summary = required
    ? !managedPostgresStartupSupported
      ? "Phase 62 managed Postgres horizontal app-writer concurrency hardening is blocked until Phase 52 managed Postgres startup support is available; horizontalAppWritersSupported=false; activeActiveDatabaseSupported=false; regionalDatabaseSupported=false; pitrRuntimeSupported=false."
      : !supportedManagedPostgresTopology
        ? "Phase 62 managed Postgres horizontal app-writer concurrency hardening is blocked because the requested topology is outside the supported single-primary managed Postgres posture; active-active, regional, PITR runtime, and multi-writer database support remain blocked."
        : managedPostgresHorizontalWriterHardeningComplete
          ? "Phase 62 managed Postgres horizontal app-writer concurrency hardening is complete for multiple Taskloom app processes writing to one managed Postgres primary; active-active, regional/PITR runtime, SQLite-distributed, and multi-writer database support remain unsupported; releaseAllowed=false."
          : `Phase 62 managed Postgres horizontal app-writer concurrency hardening is blocked pending ${missingEvidenceSummary}; active-active, regional/PITR runtime, SQLite-distributed, and multi-writer database support remain unsupported; releaseAllowed=false.`
    : "Phase 62 managed Postgres horizontal app-writer concurrency hardening is not configured; ordinary local JSON, single-node SQLite, and single-writer managed Postgres status are reported separately.";

  return {
    phase: "62",
    status,
    hardeningStatus,
    summary,
    required,
    horizontalAppWriterIntentDetected,
    managedPostgresIntentDetected,
    managedPostgresStartupSupported,
    supportedManagedPostgresTopology,
    managedPostgresHorizontalWriterHardeningComplete,
    horizontalAppWritersSupported: managedPostgresHorizontalWriterHardeningComplete,
    multiWriterDatabaseSupported: false,
    activeActiveDatabaseSupported: false,
    regionalDatabaseSupported: false,
    pitrRuntimeSupported: false,
    sqliteDistributedSupported: false,
    releaseAllowed: false,
    managedPostgresStartupSupportStatus: managedPostgresStartupSupport.status,
    managedPostgresTopologyGateStatus: managedPostgresTopologyGate.status,
    evidence: evidenceByKey,
    writePathAudit: evidenceByKey.writePathAudit,
    concurrentWriterTests: evidenceByKey.concurrentWriterTests,
    concurrencyControl: evidenceByKey.concurrencyControl,
    transactionRetry: evidenceByKey.transactionRetry,
    releaseAssertion: evidenceByKey.releaseAssertion,
    missingEvidence,
    source: phase62?.source ?? "derived",
  };
}

function trueEnvValue(value: unknown): boolean {
  return ["1", "true", "yes", "enabled"].includes(stringValue(value).toLowerCase());
}

function reportDependencyReady(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  const explicit = booleanValue(record.productionSafe) ??
    booleanValue(record.ready) ??
    booleanValue(record.configured) ??
    booleanValue(record.ok) ??
    booleanValue(record.pass);
  if (explicit !== undefined) return explicit;
  const status = stringValue(record.status).toLowerCase();
  if (["ready", "ok", "pass", "passed", "production-safe", "shared", "distributed"].includes(status)) return true;
  if (["blocked", "fail", "failed", "missing", "local-only", "disabled"].includes(status)) return false;
  return null;
}

function reportDependencyMode(record: Record<string, unknown> | null): string {
  if (!record) return "";
  return stringValue(record.mode) ||
    stringValue(record.posture) ||
    stringValue(record.classification) ||
    stringValue(record.status);
}

function reportDependencyBlockers(record: Record<string, unknown> | null): string[] {
  if (!record) return [];
  const blockers = record.blockers;
  if (Array.isArray(blockers)) {
    return blockers.map((entry) => stringValue(entry)).filter(Boolean);
  }
  const blocker = stringValue(record.blocker) || stringValue(record.detail) || stringValue(record.summary);
  return blocker ? [blocker] : [];
}

function reportPhase63Required(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  return booleanValue(record.required) ??
    booleanValue(record.phase63Required) ??
    booleanValue(record.distributedDependencyEnforcementRequired) ??
    booleanValue(record.strictActivationRequired) ??
    null;
}

function reportPhase64Required(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  return booleanValue(record.required) ??
    booleanValue(record.phase64Required) ??
    booleanValue(record.recoveryValidationRequired) ??
    booleanValue(record.managedPostgresRecoveryValidationRequired) ??
    null;
}

function phase64ReportValidationComplete(records: readonly Record<string, unknown>[]): boolean {
  return records.some((record) => {
    const required =
      booleanValue(record.required) === true ||
      booleanValue(record.phase64Required) === true ||
      booleanValue(record.recoveryValidationRequired) === true ||
      booleanValue(record.horizontalAppWriterIntentDetected) === true;
    return required &&
      (booleanValue(record.recoveryValidationComplete) === true ||
        booleanValue(record.managedPostgresRecoveryValidated) === true ||
        booleanValue(record.phase64RecoveryValidationComplete) === true ||
        booleanValue(record.failoverPitrRecoveryValidated) === true);
  });
}

function reportPhase65Required(record: Record<string, unknown> | null): boolean | null {
  if (!record) return null;
  return booleanValue(record.required) ??
    booleanValue(record.phase65Required) ??
    booleanValue(record.cutoverAutomationRequired) ??
    booleanValue(record.managedPostgresCutoverAutomationRequired) ??
    null;
}

function phase65ReportAutomationReady(records: readonly Record<string, unknown>[]): boolean {
  return records.some((record) => {
    const required =
      booleanValue(record.required) === true ||
      booleanValue(record.phase65Required) === true ||
      booleanValue(record.cutoverAutomationRequired) === true ||
      booleanValue(record.managedPostgresCutoverAutomationRequired) === true;
    return required &&
      (booleanValue(record.cutoverAutomationReady) === true ||
        booleanValue(record.managedPostgresCutoverAutomationReady) === true ||
        booleanValue(record.activationAutomationReady) === true ||
        booleanValue(record.phase65CutoverAutomationReady) === true);
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
    const result = automationResultValue(stringValue(value));
    if (result !== "unknown") return result;
  }
  return "unknown";
}

function deriveDistributedDependencyEnforcement(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  multiWriterRuntimeActivationControls: MultiWriterRuntimeActivationControlsStatus,
  managedPostgresHorizontalWriterConcurrency: ManagedPostgresHorizontalWriterConcurrencyStatus,
): DistributedDependencyEnforcementStatus {
  const reportSources: Array<{
    source: Exclude<DistributedDependencyEnforcementStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = distributedDependencyEnforcementRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase63 = reportSources[0] ?? null;
  const reportRequired = reportSources.reduce<boolean | null>((result, source) => {
    if (result !== null) return result;
    return reportPhase63Required(source.record);
  }, null);
  const multiWriterIntentDetected = multiWriterRuntimeActivationControls.multiWriterIntentDetected;
  const horizontalAppWriterIntentDetected =
    managedPostgresHorizontalWriterConcurrency.horizontalAppWriterIntentDetected;
  const required = reportRequired === true ||
    horizontalAppWriterIntentDetected ||
    multiWriterRuntimeActivationControls.runtimeActivationControlsComplete;
  const schedulerMode = resolveLeaderMode(env);
  const schedulerHttpUrl = stringValue(env.TASKLOOM_SCHEDULER_LEADER_HTTP_URL);
  const schedulerFailOpen = trueEnvValue(env.TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN);
  const limiterUrl = stringValue(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL);
  const limiterFailOpen = trueEnvValue(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN);
  const accessLogMode = resolveAccessLogMode(env);
  const accessLogPath = resolveAccessLogPath(env);
  const accessLogShipping = valueFromEnvKeys(env, [
    "TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE",
    "TASKLOOM_ACCESS_LOG_SHIPPING_MODE",
    "TASKLOOM_ACCESS_LOG_SHIPPING_ASSERTION",
    "TASKLOOM_ACCESS_LOG_SHIPPING",
    "TASKLOOM_ACCESS_LOG_SHIPPER",
  ]);
  const alertCron = stringValue(env.TASKLOOM_ALERT_EVALUATE_CRON);
  const alertWebhookUrl = stringValue(env.TASKLOOM_ALERT_WEBHOOK_URL);
  const alertDeliveryEvidence = stringValue(env.TASKLOOM_ALERT_DELIVERY_EVIDENCE);
  const healthMonitoring = valueFromEnvKeys(env, [
    "TASKLOOM_HEALTH_MONITORING_EVIDENCE",
    "TASKLOOM_HEALTH_MONITORING_ASSERTION",
    "TASKLOOM_HEALTH_MONITORING_URL",
    "TASKLOOM_HEALTHCHECK_MONITORING_ASSERTION",
  ]);
  const durableJobExecutionPosture = stringValue(env.TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE).toLowerCase();
  const durableJobExecutionEvidence = stringValue(env.TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE);
  const durableJobExecutionReady =
    managedPostgresHorizontalWriterConcurrency.managedPostgresHorizontalWriterHardeningComplete &&
    DURABLE_JOB_EXECUTION_POSTURES.has(durableJobExecutionPosture) &&
    Boolean(durableJobExecutionEvidence);
  const accessLogShippingReady =
    (accessLogMode === "stdout" && Boolean(accessLogShipping)) ||
    (accessLogMode === "file" && Boolean(accessLogPath) && Boolean(accessLogShipping));
  const alertDeliveryReady = Boolean(alertCron) && Boolean(alertWebhookUrl) && Boolean(alertDeliveryEvidence);

  const envStates: Record<DistributedDependencyEnforcementKey, {
    ready: boolean;
    mode: string;
    summary: string;
    blockers: string[];
  }> = {
    distributedRateLimiting: {
      ready: Boolean(limiterUrl) && !limiterFailOpen,
      mode: limiterUrl ? (limiterFailOpen ? "http-fail-open" : "http-fail-closed") : "local-store",
      summary: limiterUrl
        ? limiterFailOpen
          ? "distributed limiter URL is configured but fail-open would allow local-only abuse counters during outages"
          : "distributed limiter URL is configured fail-closed"
        : "distributed limiter URL is not configured; rate-limit buckets remain local to the app store",
      blockers: limiterUrl
        ? limiterFailOpen ? ["Set TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN to fail closed before strict activation."] : []
        : ["Set TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL for shared abuse-counter coordination."],
    },
    schedulerCoordination: {
      ready: schedulerMode === "http" && Boolean(schedulerHttpUrl) && !schedulerFailOpen,
      mode: schedulerMode === "http"
        ? schedulerFailOpen ? "http-fail-open" : "http-fail-closed"
        : schedulerMode,
      summary: schedulerMode === "http" && schedulerHttpUrl
        ? schedulerFailOpen
          ? "HTTP scheduler coordination is configured but fail-open can duplicate execution during coordinator outages"
          : "HTTP scheduler coordination is configured fail-closed"
        : "scheduler leader mode is local-only for horizontal app writers",
      blockers: schedulerMode === "http" && schedulerHttpUrl
        ? schedulerFailOpen ? ["Set TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN to fail closed before strict activation."] : []
        : ["Set TASKLOOM_SCHEDULER_LEADER_MODE=http with TASKLOOM_SCHEDULER_LEADER_HTTP_URL."],
    },
    durableJobExecution: {
      ready: durableJobExecutionReady,
      mode: durableJobExecutionPosture || "local-store-jobs",
      summary: durableJobExecutionReady
        ? "managed Postgres horizontal-writer hardening and durable job execution posture are configured"
        : "job execution is not confirmed for horizontally scaled managed Postgres writers",
      blockers: durableJobExecutionReady
        ? []
        : ["Set TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE to a shared durable posture and attach TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE after Phase 62 hardening is complete."],
    },
    accessLogShipping: {
      ready: accessLogShippingReady,
      mode: accessLogMode === "stdout"
        ? accessLogShipping ? `stdout:${accessLogShipping}` : "stdout-no-shipping-evidence"
        : accessLogMode === "file"
          ? accessLogShipping ? `file:${accessLogShipping}` : "file-local-buffer"
          : "off",
      summary: accessLogMode === "stdout" && accessLogShipping
        ? "access logs write to stdout with shipping evidence configured"
        : accessLogMode === "file" && accessLogPath && accessLogShipping
          ? "file access logs have shipping evidence configured"
          : "access-log shipping is not configured for strict activation",
      blockers: accessLogShippingReady
        ? []
        : ["Set TASKLOOM_ACCESS_LOG_MODE=stdout or file with TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE."],
    },
    alertDelivery: {
      ready: alertDeliveryReady,
      mode: alertDeliveryReady ? "scheduled-webhook-with-evidence" : alertCron ? "scheduled-incomplete" : "disabled",
      summary: alertDeliveryReady
        ? "scheduled alert evaluation, webhook delivery, and delivery evidence are configured"
        : "alert evaluation or webhook delivery is missing",
      blockers: alertDeliveryReady
        ? []
        : ["Set TASKLOOM_ALERT_EVALUATE_CRON, TASKLOOM_ALERT_WEBHOOK_URL, and TASKLOOM_ALERT_DELIVERY_EVIDENCE."],
    },
    healthMonitoring: {
      ready: Boolean(healthMonitoring),
      mode: healthMonitoring ? "external-monitoring-asserted" : "endpoints-only",
      summary: healthMonitoring
        ? "external health monitoring evidence is configured"
        : "health endpoints exist, but external monitoring evidence is missing",
      blockers: healthMonitoring
        ? []
        : ["Set TASKLOOM_HEALTH_MONITORING_EVIDENCE for external health monitoring coverage."],
    },
  };

  const dependencies = Object.fromEntries(DISTRIBUTED_DEPENDENCY_DEFINITIONS.map((definition) => {
    let source: DistributedDependencyStatus["source"] = "env";
    let reportRecord: Record<string, unknown> | null = null;
    for (const candidate of reportSources) {
      const record = distributedDependencyRecord(candidate.record, definition.reportKeys);
      if (record) {
        reportRecord = record;
        source = candidate.source;
        break;
      }
    }
    const reportReadyValue = reportDependencyReady(reportRecord);
    const state = envStates[definition.key];
    const productionSafe = reportReadyValue ?? state.ready;
    const status: DistributedDependencyStatus["status"] = required
      ? productionSafe ? "ready" : "blocked"
      : "not-required";
    const blockers = productionSafe ? [] : reportDependencyBlockers(reportRecord).concat(state.blockers);
    return [definition.key, {
      key: definition.key,
      label: definition.label,
      status,
      required,
      productionSafe,
      mode: reportDependencyMode(reportRecord) || state.mode,
      summary: stringValue(reportRecord?.summary) || stringValue(reportRecord?.detail) || state.summary,
      blockers,
      source,
    }];
  })) as Record<DistributedDependencyEnforcementKey, DistributedDependencyStatus>;

  const blockers = Object.values(dependencies).flatMap((dependency) =>
      dependency.status === "blocked"
      ? dependency.blockers.length > 0
        ? dependency.blockers
        : [`${dependency.label} is not production-safe for strict activation.`]
      : [],
  );
  const localOnlyDependencies = Object.values(dependencies)
    .filter((dependency) => dependency.status === "blocked")
    .map((dependency) => dependency.key);
  const dependenciesReady = required && blockers.length === 0;
  const enforcementStatus: DistributedDependencyEnforcementStatus["enforcementStatus"] = required
    ? dependenciesReady ? "ready" : "blocked"
    : "not-required";
  const status: DistributedDependencyEnforcementStatus["status"] = required
    ? dependenciesReady ? "dependencies-ready" : "blocked"
    : "not-required";
  const summary = required
    ? dependenciesReady
      ? "Phase 63 distributed dependency enforcement is ready for strict activation; shared rate limiting, scheduler coordination, durable jobs, access-log shipping, alert delivery, and health monitoring are production-safe for horizontal app writers."
      : `Phase 63 distributed dependency enforcement blocks strict activation; missing production-safe ${localOnlyDependencies.join(", ")}.`
    : "Phase 63 distributed dependency enforcement is not required without horizontal app-writer activation intent.";

  return {
    phase: "63",
    status,
    enforcementStatus,
    summary,
    required,
    horizontalAppWriterIntentDetected,
    multiWriterIntentDetected,
    strictActivationBlocked: required && !dependenciesReady,
    strictActivationAllowed: required && dependenciesReady,
    activationAllowed: required && dependenciesReady,
    releaseAllowed: false,
    missingDependencies: localOnlyDependencies,
    localOnlyDependencies,
    blockers,
    dependencies,
    distributedRateLimiting: dependencies.distributedRateLimiting,
    schedulerCoordination: dependencies.schedulerCoordination,
    durableJobExecution: dependencies.durableJobExecution,
    accessLogShipping: dependencies.accessLogShipping,
    alertDelivery: dependencies.alertDelivery,
    healthMonitoring: dependencies.healthMonitoring,
    source: phase63?.source ?? "derived",
  };
}

function deriveManagedPostgresRecoveryValidation(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  distributedDependencyEnforcement: DistributedDependencyEnforcementStatus,
): ManagedPostgresRecoveryValidationStatus {
  const reportSources: Array<{
    source: Exclude<ManagedPostgresRecoveryValidationStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = recoveryValidationRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase64 = reportSources[0] ?? null;
  const reportRequired = reportSources.reduce<boolean | null>((result, candidate) => {
    if (result !== null) return result;
    return reportPhase64Required(candidate.record);
  }, null);
  const reportValidationComplete = phase64ReportValidationComplete(reportSources.map((source) => source.record));
  const required = reportRequired === true || distributedDependencyEnforcement.required;
  const phase63DistributedDependenciesReady = distributedDependencyEnforcement.strictActivationAllowed;
  const horizontalAppWriterIntentDetected = distributedDependencyEnforcement.horizontalAppWriterIntentDetected;

  const evidenceEntries = MANAGED_POSTGRES_RECOVERY_VALIDATION_EVIDENCE.map((definition) => {
    let value = valueFromEnvKeys(env, definition.envKeys);
    let source: ManagedPostgresRecoveryValidationEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }
    if (!value && reportValidationComplete && phase64) {
      value = "phase64 report recovery validation complete";
      source = phase64.source;
    }

    const configured = value.length > 0;
    const status: ManagedPostgresRecoveryValidationEvidenceStatus["status"] = required
      ? configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<ManagedPostgresRecoveryValidationEvidenceKey, ManagedPostgresRecoveryValidationEvidenceStatus>;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const allEvidenceConfigured = evidenceEntries.every((entry) => entry.configured);
  const recoveryValidationComplete =
    required && phase63DistributedDependenciesReady && (allEvidenceConfigured || reportValidationComplete);
  const validationStatus: ManagedPostgresRecoveryValidationStatus["validationStatus"] = required
    ? recoveryValidationComplete
      ? "complete"
      : !phase63DistributedDependenciesReady
        ? "blocked"
        : "missing"
    : "not-required";
  const status: ManagedPostgresRecoveryValidationStatus["status"] = required
    ? recoveryValidationComplete ? "recovery-validated" : "blocked"
    : "not-required";
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 64 recovery validation evidence";
  const blockers = required
    ? !phase63DistributedDependenciesReady
      ? ["Complete Phase 63 distributed dependency enforcement before recovery validation can allow activation."]
      : missingEvidence.map((key) => `Provide ${evidenceByKey[key].label}.`)
    : [];
  const summary = required
    ? !phase63DistributedDependenciesReady
      ? "Phase 64 managed Postgres recovery validation is blocked until Phase 63 distributed dependencies are production-safe; activationAllowed=false; active-active and regional runtime remain unsupported."
      : recoveryValidationComplete
        ? "Phase 64 managed Postgres recovery validation is complete for backup restore, PITR rehearsal, failover rehearsal, data-integrity validation, and recovery-time expectations; provider-owned HA/PITR is validated while active-active, regional runtime, and SQLite-distributed support remain unsupported; releaseAllowed=false."
        : `Phase 64 managed Postgres recovery validation blocks activation pending ${missingEvidenceSummary}; active-active, regional runtime, and SQLite-distributed support remain unsupported; activationAllowed=false.`
    : "Phase 64 managed Postgres recovery validation is not required without horizontal app-writer activation intent.";

  return {
    phase: "64",
    status,
    validationStatus,
    summary,
    required,
    phase63DistributedDependenciesReady,
    recoveryValidationComplete,
    horizontalAppWriterIntentDetected,
    managedPostgresRecoveryValidated: recoveryValidationComplete,
    strictActivationBlocked: required && !recoveryValidationComplete,
    strictActivationAllowed: required && recoveryValidationComplete,
    activationAllowed: required && recoveryValidationComplete,
    releaseAllowed: false,
    providerOwnedHaPitrValidated: recoveryValidationComplete,
    activeActiveDatabaseSupported: false,
    regionalRuntimeSupported: false,
    pitrRuntimeSupported: false,
    sqliteDistributedSupported: false,
    evidence: evidenceByKey,
    backupRestore: evidenceByKey.backupRestore,
    pitrRehearsal: evidenceByKey.pitrRehearsal,
    failoverRehearsal: evidenceByKey.failoverRehearsal,
    dataIntegrityValidation: evidenceByKey.dataIntegrityValidation,
    recoveryTimeExpectations: evidenceByKey.recoveryTimeExpectations,
    missingEvidence,
    blockers,
    source: phase64?.source ?? "derived",
  };
}

function deriveManagedPostgresCutoverAutomation(
  env: NodeJS.ProcessEnv,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  releaseEvidence: ReleaseEvidenceBundle,
  managedPostgresRecoveryValidation: ManagedPostgresRecoveryValidationStatus,
): ManagedPostgresCutoverAutomationStatus {
  const reportSources: Array<{
    source: Exclude<ManagedPostgresCutoverAutomationStatus["source"], "derived">;
    record: Record<string, unknown>;
  }> = [];
  for (const { source, report } of [
    { source: "managedDatabaseRuntimeGuard" as const, report: managedDatabaseRuntimeGuard },
    { source: "managedDatabaseTopology" as const, report: managedDatabaseTopology },
    { source: "releaseReadiness" as const, report: releaseReadiness },
    { source: "releaseEvidence" as const, report: releaseEvidence },
  ]) {
    const record = cutoverAutomationRecord(report);
    if (record) reportSources.push({ source, record });
  }

  const phase65 = reportSources[0] ?? null;
  const reportRequired = reportSources.reduce<boolean | null>((result, candidate) => {
    if (result !== null) return result;
    return reportPhase65Required(candidate.record);
  }, null);
  const reportAutomationReady = phase65ReportAutomationReady(reportSources.map((source) => source.record));
  const required = reportRequired === true || managedPostgresRecoveryValidation.required;
  const phase64RecoveryValidated = managedPostgresRecoveryValidation.strictActivationAllowed;

  const evidenceEntries = MANAGED_POSTGRES_CUTOVER_AUTOMATION_EVIDENCE.map((definition) => {
    let value = valueFromEnvKeys(env, definition.envKeys);
    let source: ManagedPostgresCutoverAutomationEvidenceStatus["source"] = value ? "env" : "derived";
    if (!value) {
      for (const candidate of reportSources) {
        const direct = valueFromRecord(candidate.record, definition.reportKeys);
        const nested = isRecord(candidate.record.evidence)
          ? valueFromRecord(candidate.record.evidence, definition.reportKeys)
          : "";
        value = direct || nested;
        if (value) {
          source = candidate.source;
          break;
        }
      }
    }
    if (!value && reportAutomationReady && phase65) {
      value = "phase65 report cutover automation ready";
      source = phase65.source;
    }

    let result = automationResultValue(valueFromEnvKeys(env, definition.statusEnvKeys));
    if (result === "unknown") {
      for (const candidate of reportSources) {
        result = cutoverAutomationResultFromRecord(candidate.record, definition.statusReportKeys);
        if (result !== "unknown") break;
        if (isRecord(candidate.record.evidence)) {
          result = cutoverAutomationResultFromRecord(candidate.record.evidence, definition.statusReportKeys);
          if (result !== "unknown") break;
        }
      }
    }
    if (result === "unknown" && value) result = "pass";

    const configured = value.length > 0;
    const status: ManagedPostgresCutoverAutomationEvidenceStatus["status"] = required
      ? result === "fail"
        ? "failed"
        : configured ? "provided" : "missing"
      : "not-required";
    return {
      key: definition.key,
      label: definition.label,
      envKey: definition.envKey,
      status,
      required,
      configured,
      value: configured ? value : null,
      result,
      source,
    };
  });
  const evidenceByKey = Object.fromEntries(
    evidenceEntries.map((entry) => [entry.key, entry]),
  ) as Record<ManagedPostgresCutoverAutomationEvidenceKey, ManagedPostgresCutoverAutomationEvidenceStatus>;
  const missingEvidence = evidenceEntries
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.key);
  const failedChecks = evidenceEntries
    .filter((entry) => entry.status === "failed")
    .map((entry) => entry.key);
  const allEvidenceConfigured = evidenceEntries.every((entry) => entry.configured);
  const cutoverPreflightFailed = evidenceByKey.cutoverPreflight.result === "fail";
  const activationDryRunFailed = evidenceByKey.activationDryRun.result === "fail";
  const postActivationSmokeFailed = evidenceByKey.postActivationSmoke.result === "fail";
  const cutoverPreflightPassed = evidenceByKey.cutoverPreflight.result === "pass";
  const activationDryRunPassed = evidenceByKey.activationDryRun.result === "pass";
  const postActivationSmokePassed = evidenceByKey.postActivationSmoke.result === "pass";
  const cutoverAutomationReady =
    required && phase64RecoveryValidated && (allEvidenceConfigured || reportAutomationReady) && failedChecks.length === 0;
  const rollbackRequired = required && postActivationSmokeFailed;
  const activationBlocked = required && !cutoverAutomationReady;
  const automationStatus: ManagedPostgresCutoverAutomationStatus["automationStatus"] = required
    ? cutoverAutomationReady
      ? "ready"
      : cutoverPreflightFailed
        ? "preflight-failed"
        : postActivationSmokeFailed
          ? "smoke-failed"
          : "blocked"
    : "not-required";
  const status: ManagedPostgresCutoverAutomationStatus["status"] = required
    ? rollbackRequired ? "rollback-required" : cutoverAutomationReady ? "ready" : "blocked"
    : "not-required";
  const blockers = required
    ? !phase64RecoveryValidated
      ? ["Complete Phase 64 recovery validation before cutover automation can allow activation."]
      : failedChecks.map((key) => `${evidenceByKey[key].label} reported failure.`)
          .concat(missingEvidence.map((key) => `Provide ${evidenceByKey[key].label}.`))
    : [];
  const missingEvidenceSummary = missingEvidence.join(", ") || "Phase 65 cutover automation evidence";
  const failedChecksSummary = failedChecks.join(", ") || "Phase 65 cutover automation checks";
  const summary = required
    ? !phase64RecoveryValidated
      ? "Phase 65 managed Postgres cutover automation is blocked until Phase 64 recovery validation is complete; activationAllowed=false."
      : cutoverAutomationReady
        ? "Phase 65 managed Postgres cutover automation is ready: cutover preflight, activation dry-run, post-activation smoke checks, rollback command guidance, and monitoring thresholds are present; activationAllowed=true."
        : rollbackRequired
          ? "Phase 65 post-activation smoke checks failed; rollback command guidance is required to return to the prior safe posture; activationAllowed=false."
          : failedChecks.length > 0
            ? `Phase 65 managed Postgres cutover automation blocks activation because ${failedChecksSummary} failed; activationAllowed=false.`
            : `Phase 65 managed Postgres cutover automation blocks activation pending ${missingEvidenceSummary}; activationAllowed=false.`
    : "Phase 65 managed Postgres cutover automation is not required without horizontal app-writer activation intent.";

  return {
    phase: "65",
    status,
    automationStatus,
    summary,
    required,
    phase64RecoveryValidated,
    cutoverAutomationReady,
    cutoverPreflightPassed,
    activationDryRunPassed,
    postActivationSmokePassed,
    cutoverPreflightFailed,
    activationDryRunFailed,
    postActivationSmokeFailed,
    activationBlocked,
    activationAllowed: required && cutoverAutomationReady,
    rollbackRequired,
    priorSafePostureRequired: rollbackRequired,
    releaseAllowed: false,
    evidence: evidenceByKey,
    cutoverPreflight: evidenceByKey.cutoverPreflight,
    activationDryRun: evidenceByKey.activationDryRun,
    postActivationSmoke: evidenceByKey.postActivationSmoke,
    rollbackCommandGuidance: evidenceByKey.rollbackCommandGuidance,
    monitoringThresholds: evidenceByKey.monitoringThresholds,
    missingEvidence,
    failedChecks,
    blockers,
    source: phase65?.source ?? "derived",
  };
}

function deriveAsyncStoreBoundary(
  storeMode: StoreMode,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
): AsyncStoreBoundaryStatus | null {
  if (!isRecord(managedDatabaseTopology) || !isRecord(managedDatabaseRuntimeGuard)) return null;

  const guardObserved: Record<string, unknown> = isRecord(managedDatabaseRuntimeGuard.observed)
    ? managedDatabaseRuntimeGuard.observed
    : {};
  const topologyObserved: Record<string, unknown> = isRecord(managedDatabaseTopology.observed)
    ? managedDatabaseTopology.observed
    : {};
  const observedStore = stringValue(guardObserved.store) || stringValue(topologyObserved.store) || storeMode;
  const topology = stringValue(guardObserved.databaseTopology) || stringValue(topologyObserved.databaseTopology) || null;
  const classification = stringValue(managedDatabaseRuntimeGuard.classification) ||
    stringValue(managedDatabaseTopology.classification) ||
    (observedStore === "sqlite" ? "single-node-sqlite" : observedStore === "json" ? "local-json" : "unsupported-store");
  const localRuntimeSupported = observedStore === "json" || observedStore === "sqlite";
  const foundationPresent = localRuntimeSupported;
  const managedDatabaseRuntimeAllowed = false;
  const managedDatabaseRuntimeBlocked = true;
  const managedIntent =
    classification.includes("managed-database") ||
    classification.includes("multi-writer") ||
    Boolean(managedDatabaseRuntimeGuard.managedDatabaseRuntimeBlocked) ||
    Boolean(isRecord(managedDatabaseTopology.managedDatabase) && managedDatabaseTopology.managedDatabase.requested);
  const status = localRuntimeSupported && !managedIntent ? "present" : "blocked";
  const summary = localRuntimeSupported
    ? `Phase 49 async store boundary foundation is present for ${observedStore === "sqlite" ? "single-node SQLite" : "local JSON"}; managed database runtime remains blocked until an async managed adapter is implemented.`
    : "Phase 49 async store boundary cannot enable this store mode; managed database runtime remains blocked until an async managed adapter is implemented.";

  return {
    source: "derived",
    phase: "49",
    status,
    classification,
    summary,
    foundationPresent,
    localRuntimeSupported,
    managedDatabaseRuntimeAllowed,
    managedDatabaseRuntimeBlocked,
    storeMode: observedStore,
    topology,
  };
}

export function getOperationsStatus(deps: OperationsStatusDeps = {}): OperationsStatus {
  const loadStore = deps.loadStore ?? defaultLoadStore;
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => new Date());
  const buildStorageTopologyReport = deps.buildStorageTopologyReport ?? defaultBuildStorageTopologyReport;
  const buildManagedDatabaseTopologyReport = deps.buildManagedDatabaseTopologyReport ?? defaultBuildManagedDatabaseTopologyReport;
  const buildManagedDatabaseRuntimeGuardReport =
    deps.buildManagedDatabaseRuntimeGuardReport ?? defaultBuildManagedDatabaseRuntimeGuardReport;
  const buildReleaseReadinessReport = deps.buildReleaseReadinessReport ?? defaultBuildReleaseReadinessReport;
  const buildReleaseEvidenceBundle = deps.buildReleaseEvidenceBundle ?? defaultBuildReleaseEvidenceBundle;

  const data = loadStore();
  const leaderMode = resolveLeaderMode(env);
  const storageTopology = buildStorageTopologyReport(env);
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env);
  const releaseReadiness = buildReleaseReadinessReport(env, {
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  });
  const releaseEvidence = buildReleaseEvidenceBundle(env, {
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    releaseReadiness,
  });
  const managedDatabaseRuntimeBoundary = findManagedDatabaseRuntimeBoundary([
    { source: "managedDatabaseRuntimeGuard", report: managedDatabaseRuntimeGuard },
    { source: "releaseReadiness", report: releaseReadiness },
    { source: "releaseEvidence", report: releaseEvidence },
  ]);
  const storeMode = resolveStoreMode(env);
  const asyncStoreBoundary = findAsyncStoreBoundary([
    { source: "managedDatabaseRuntimeGuard", report: managedDatabaseRuntimeGuard },
    { source: "releaseReadiness", report: releaseReadiness },
    { source: "releaseEvidence", report: releaseEvidence },
  ]) ?? deriveAsyncStoreBoundary(storeMode, managedDatabaseTopology, managedDatabaseRuntimeGuard);
  const managedPostgresCapability = deriveManagedPostgresCapability(env, managedDatabaseRuntimeGuard);
  const managedPostgresStartupSupport = deriveManagedPostgresStartupSupport(
    env,
    managedDatabaseRuntimeGuard,
    managedPostgresCapability,
  );
  const managedPostgresTopologyGate = deriveManagedPostgresTopologyGate(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    managedPostgresCapability,
    managedPostgresStartupSupport,
  );
  const multiWriterTopologyDesignPackageGate = deriveMultiWriterTopologyDesignPackageGate(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    managedPostgresTopologyGate,
  );
  const multiWriterTopologyImplementationAuthorizationGate =
    deriveMultiWriterTopologyImplementationAuthorizationGate(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyDesignPackageGate,
    );
  const multiWriterTopologyImplementationReadinessGate =
    deriveMultiWriterTopologyImplementationReadinessGate(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyImplementationAuthorizationGate,
    );
  const multiWriterTopologyImplementationScope =
    deriveMultiWriterTopologyImplementationScope(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyImplementationReadinessGate,
    );
  const multiWriterRuntimeImplementationValidation =
    deriveMultiWriterRuntimeImplementationValidation(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyImplementationScope,
    );
  const multiWriterRuntimeReleaseEnablementApproval =
    deriveMultiWriterRuntimeReleaseEnablementApproval(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterRuntimeImplementationValidation,
    );
  const multiWriterRuntimeSupportPresenceAssertion =
    deriveMultiWriterRuntimeSupportPresenceAssertion(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterRuntimeReleaseEnablementApproval,
    );
  const multiWriterRuntimeActivationControls =
    deriveMultiWriterRuntimeActivationControls(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterRuntimeSupportPresenceAssertion,
    );
  const managedPostgresHorizontalWriterConcurrency =
    deriveManagedPostgresHorizontalWriterConcurrency(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      managedPostgresCapability,
      managedPostgresStartupSupport,
      managedPostgresTopologyGate,
    );
  const distributedDependencyEnforcement = deriveDistributedDependencyEnforcement(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    multiWriterRuntimeActivationControls,
    managedPostgresHorizontalWriterConcurrency,
  );
  const managedPostgresRecoveryValidation = deriveManagedPostgresRecoveryValidation(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    distributedDependencyEnforcement,
  );
  const managedPostgresCutoverAutomation = deriveManagedPostgresCutoverAutomation(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    managedPostgresRecoveryValidation,
  );

  const snapshotRows = (data.jobMetricSnapshots ?? []) as Array<{ capturedAt: string }>;
  const lastCapturedAt = snapshotRows.length === 0
    ? null
    : snapshotRows.reduce((acc, row) => {
        const t = Date.parse(row.capturedAt);
        return Number.isFinite(t) && t > acc ? t : acc;
      }, 0);
  const lastCapturedAtIso = lastCapturedAt === null || lastCapturedAt === 0 ? null : new Date(lastCapturedAt).toISOString();

  return {
    generatedAt: now().toISOString(),
    store: { mode: storeMode },
    scheduler: {
      leaderMode,
      leaderTtlMs: resolveLeaderTtlMs(env),
      leaderHeldLocally: resolveLeaderHeldLocally(leaderMode),
      lockSummary: resolveLockSummary(leaderMode, env),
    },
    jobs: summarizeJobs(data),
    jobMetrics: (deps?.jobTypeMetrics ?? getJobTypeMetrics)(),
    jobMetricsSnapshots: {
      total: snapshotRows.length,
      lastCapturedAt: lastCapturedAtIso,
    },
    accessLog: {
      mode: resolveAccessLogMode(env),
      path: resolveAccessLogPath(env),
      maxBytes: resolveAccessLogMaxBytes(env),
      maxFiles: resolveAccessLogMaxFiles(env),
    },
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
    asyncStoreBoundary,
    managedPostgresCapability,
    managedPostgresStartupSupport,
    managedPostgresTopologyGate,
    multiWriterTopologyDesignPackageGate,
    multiWriterTopologyImplementationAuthorizationGate,
    multiWriterTopologyImplementationReadinessGate,
    multiWriterTopologyImplementationScope,
    multiWriterRuntimeImplementationValidation,
    multiWriterRuntimeReleaseEnablementApproval,
    multiWriterRuntimeSupportPresenceAssertion,
    multiWriterRuntimeActivationControls,
    managedPostgresHorizontalWriterConcurrency,
    distributedDependencyEnforcement,
    managedPostgresRecoveryValidation,
    managedPostgresCutoverAutomation,
    releaseReadiness,
    releaseEvidence,
    runtime: { nodeVersion: process.versions.node },
  };
}

export async function getOperationsStatusAsync(deps: OperationsStatusAsyncDeps = {}): Promise<OperationsStatus> {
  const loadStore = deps.loadStore ?? defaultLoadStoreAsync;
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => new Date());
  const buildStorageTopologyReport = deps.buildStorageTopologyReport ?? defaultBuildStorageTopologyReport;
  const buildManagedDatabaseTopologyReport = deps.buildManagedDatabaseTopologyReport ?? defaultBuildManagedDatabaseTopologyReport;
  const buildManagedDatabaseRuntimeGuardReport =
    deps.buildManagedDatabaseRuntimeGuardReport ?? defaultBuildManagedDatabaseRuntimeGuardReport;
  const buildReleaseReadinessReport = deps.buildReleaseReadinessReport ?? defaultBuildReleaseReadinessReport;
  const buildReleaseEvidenceBundle = deps.buildReleaseEvidenceBundle ?? defaultBuildReleaseEvidenceBundle;

  const data = await loadStore();
  const leaderMode = resolveLeaderMode(env);
  const storageTopology = buildStorageTopologyReport(env);
  const managedDatabaseTopology = buildManagedDatabaseTopologyReport(env);
  const managedDatabaseRuntimeGuard = buildManagedDatabaseRuntimeGuardReport(env);
  const releaseReadiness = buildReleaseReadinessReport(env, {
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  });
  const releaseEvidence = buildReleaseEvidenceBundle(env, {
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    releaseReadiness,
  });
  const managedDatabaseRuntimeBoundary = findManagedDatabaseRuntimeBoundary([
    { source: "managedDatabaseRuntimeGuard", report: managedDatabaseRuntimeGuard },
    { source: "releaseReadiness", report: releaseReadiness },
    { source: "releaseEvidence", report: releaseEvidence },
  ]);
  const storeMode = resolveStoreMode(env);
  const asyncStoreBoundary = findAsyncStoreBoundary([
    { source: "managedDatabaseRuntimeGuard", report: managedDatabaseRuntimeGuard },
    { source: "releaseReadiness", report: releaseReadiness },
    { source: "releaseEvidence", report: releaseEvidence },
  ]) ?? deriveAsyncStoreBoundary(storeMode, managedDatabaseTopology, managedDatabaseRuntimeGuard);
  const managedPostgresCapability = deriveManagedPostgresCapability(env, managedDatabaseRuntimeGuard);
  const managedPostgresStartupSupport = deriveManagedPostgresStartupSupport(
    env,
    managedDatabaseRuntimeGuard,
    managedPostgresCapability,
  );
  const managedPostgresTopologyGate = deriveManagedPostgresTopologyGate(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    managedPostgresCapability,
    managedPostgresStartupSupport,
  );
  const multiWriterTopologyDesignPackageGate = deriveMultiWriterTopologyDesignPackageGate(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    managedPostgresTopologyGate,
  );
  const multiWriterTopologyImplementationAuthorizationGate =
    deriveMultiWriterTopologyImplementationAuthorizationGate(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyDesignPackageGate,
    );
  const multiWriterTopologyImplementationReadinessGate =
    deriveMultiWriterTopologyImplementationReadinessGate(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyImplementationAuthorizationGate,
    );
  const multiWriterTopologyImplementationScope =
    deriveMultiWriterTopologyImplementationScope(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyImplementationReadinessGate,
    );
  const multiWriterRuntimeImplementationValidation =
    deriveMultiWriterRuntimeImplementationValidation(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterTopologyImplementationScope,
    );
  const multiWriterRuntimeReleaseEnablementApproval =
    deriveMultiWriterRuntimeReleaseEnablementApproval(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterRuntimeImplementationValidation,
    );
  const multiWriterRuntimeSupportPresenceAssertion =
    deriveMultiWriterRuntimeSupportPresenceAssertion(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterRuntimeReleaseEnablementApproval,
    );
  const multiWriterRuntimeActivationControls =
    deriveMultiWriterRuntimeActivationControls(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      multiWriterRuntimeSupportPresenceAssertion,
    );
  const managedPostgresHorizontalWriterConcurrency =
    deriveManagedPostgresHorizontalWriterConcurrency(
      env,
      managedDatabaseRuntimeGuard,
      managedDatabaseTopology,
      releaseReadiness,
      releaseEvidence,
      managedPostgresCapability,
      managedPostgresStartupSupport,
      managedPostgresTopologyGate,
    );
  const distributedDependencyEnforcement = deriveDistributedDependencyEnforcement(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    multiWriterRuntimeActivationControls,
    managedPostgresHorizontalWriterConcurrency,
  );
  const managedPostgresRecoveryValidation = deriveManagedPostgresRecoveryValidation(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    distributedDependencyEnforcement,
  );
  const managedPostgresCutoverAutomation = deriveManagedPostgresCutoverAutomation(
    env,
    managedDatabaseRuntimeGuard,
    managedDatabaseTopology,
    releaseReadiness,
    releaseEvidence,
    managedPostgresRecoveryValidation,
  );

  const snapshotRows = (data.jobMetricSnapshots ?? []) as Array<{ capturedAt: string }>;
  const lastCapturedAt = snapshotRows.length === 0
    ? null
    : snapshotRows.reduce((acc, row) => {
        const t = Date.parse(row.capturedAt);
        return Number.isFinite(t) && t > acc ? t : acc;
      }, 0);
  const lastCapturedAtIso = lastCapturedAt === null || lastCapturedAt === 0 ? null : new Date(lastCapturedAt).toISOString();

  return {
    generatedAt: now().toISOString(),
    store: { mode: storeMode },
    scheduler: {
      leaderMode,
      leaderTtlMs: resolveLeaderTtlMs(env),
      leaderHeldLocally: resolveLeaderHeldLocally(leaderMode),
      lockSummary: resolveLockSummary(leaderMode, env),
    },
    jobs: summarizeJobs(data),
    jobMetrics: (deps?.jobTypeMetrics ?? getJobTypeMetrics)(),
    jobMetricsSnapshots: {
      total: snapshotRows.length,
      lastCapturedAt: lastCapturedAtIso,
    },
    accessLog: {
      mode: resolveAccessLogMode(env),
      path: resolveAccessLogPath(env),
      maxBytes: resolveAccessLogMaxBytes(env),
      maxFiles: resolveAccessLogMaxFiles(env),
    },
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
    asyncStoreBoundary,
    managedPostgresCapability,
    managedPostgresStartupSupport,
    managedPostgresTopologyGate,
    multiWriterTopologyDesignPackageGate,
    multiWriterTopologyImplementationAuthorizationGate,
    multiWriterTopologyImplementationReadinessGate,
    multiWriterTopologyImplementationScope,
    multiWriterRuntimeImplementationValidation,
    multiWriterRuntimeReleaseEnablementApproval,
    multiWriterRuntimeSupportPresenceAssertion,
    multiWriterRuntimeActivationControls,
    managedPostgresHorizontalWriterConcurrency,
    distributedDependencyEnforcement,
    managedPostgresRecoveryValidation,
    managedPostgresCutoverAutomation,
    releaseReadiness,
    releaseEvidence,
    runtime: { nodeVersion: process.versions.node },
  };
}
