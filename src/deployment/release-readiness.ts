import {
  buildStorageTopologyReport as defaultBuildStorageTopologyReport,
  type StorageTopologyEnv,
  type StorageTopologyProbeDeps,
  type StorageTopologyReport,
} from "./storage-topology.js";
import {
  buildManagedDatabaseTopologyReport as defaultBuildManagedDatabaseTopologyReport,
  type ManagedDatabaseTopologyEnv,
  type ManagedDatabaseTopologyReport,
} from "./managed-database-topology.js";
import {
  buildManagedDatabaseRuntimeGuardReport as defaultBuildManagedDatabaseRuntimeGuardReport,
  type ManagedDatabaseRuntimeGuardEnv,
  type ManagedDatabaseRuntimeGuardReport,
} from "./managed-database-runtime-guard.js";

export type ReleaseReadinessStatus = "pass" | "warn" | "fail";

export interface ReleaseReadinessEnv
  extends StorageTopologyEnv,
    ManagedDatabaseTopologyEnv,
    ManagedDatabaseRuntimeGuardEnv {
  TASKLOOM_BACKUP_DIR?: string;
  TASKLOOM_ARTIFACTS_PATH?: string;
  TASKLOOM_ARTIFACT_DIR?: string;
  TASKLOOM_RESTORE_DRILL_AT?: string;
  TASKLOOM_LAST_RESTORE_DRILL_AT?: string;
  TASKLOOM_RESTORE_DRILL_MARKER?: string;
  TASKLOOM_RELEASE_STRICT?: string;
  TASKLOOM_STRICT_RELEASE?: string;
  TASKLOOM_MULTI_WRITER_TOPOLOGY_OWNER?: string;
  TASKLOOM_MULTI_WRITER_CONSISTENCY_MODEL?: string;
  TASKLOOM_MULTI_WRITER_FAILOVER_PITR_PLAN?: string;
  TASKLOOM_MULTI_WRITER_MIGRATION_BACKFILL_PLAN?: string;
  TASKLOOM_MULTI_WRITER_OBSERVABILITY_PLAN?: string;
  TASKLOOM_MULTI_WRITER_ROLLBACK_PLAN?: string;
  TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW?: string;
  TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION?: string;
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
}

export interface ReleaseReadinessCheck {
  id: string;
  status: ReleaseReadinessStatus;
  summary: string;
}

export type ManagedDatabaseRuntimeBoundaryClassification =
  | "local-json"
  | "single-node-sqlite"
  | "managed-database-supported"
  | "managed-database-blocked"
  | "multi-writer-blocked"
  | "unsupported-store"
  | "bypassed"
  | "inherited-blocker";

export interface ManagedDatabaseRuntimeBoundaryReport {
  phase: "48";
  status: ReleaseReadinessStatus;
  allowed: boolean;
  classification: ManagedDatabaseRuntimeBoundaryClassification;
  summary: string;
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
}

export type AsyncStoreBoundaryClassification =
  | "foundation-ready"
  | "managed-postgres-startup-supported"
  | "managed-postgres-adapter-available-sync-blocked"
  | "managed-postgres-unsupported"
  | "multi-writer-unsupported"
  | "unsupported-store"
  | "bypassed"
  | "inherited-blocker";

export interface AsyncStoreBoundaryReport {
  phase: "49";
  status: ReleaseReadinessStatus;
  foundationAvailable: true;
  releaseAllowed: boolean;
  managedPostgresSupported: boolean;
  phase52ManagedStartupSupported: boolean;
  managedDatabaseAdapterImplemented: boolean;
  managedDatabaseRepositoriesImplemented: false;
  managedDatabaseBackfillAvailable: boolean;
  managedDatabaseSyncStartupSupported: boolean;
  managedDatabaseRuntimeCallSiteMigrationTracked: boolean;
  managedDatabaseRuntimeCallSitesMigrated: boolean;
  managedDatabaseRemainingSyncCallSiteGroups: string[];
  phase53MultiWriterTopologyGate?: Phase53MultiWriterTopologyGateReport;
  phase55MultiWriterImplementationAuthorizationGate?: Phase55MultiWriterImplementationAuthorizationGateReport;
  phase56MultiWriterRuntimeReadinessGate?: Phase56MultiWriterRuntimeReadinessGateReport;
  phase57MultiWriterImplementationScopeGate?: Phase57MultiWriterImplementationScopeGateReport;
  phase58MultiWriterRuntimeImplementationValidationGate?: Phase58MultiWriterRuntimeImplementationValidationGateReport;
  classification: AsyncStoreBoundaryClassification;
  summary: string;
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
}

export interface Phase53MultiWriterTopologyGateReport {
  phase: "53";
  required: boolean;
  requirementsEvidenceRequired: boolean;
  designEvidenceRequired: boolean;
  designPackageEvidenceRequired: boolean;
  requirementsEvidenceAttached: boolean;
  designEvidenceAttached: boolean;
  designPackageEvidenceAttached: boolean;
  topologyOwnerEvidenceRequired: boolean;
  topologyOwnerEvidenceAttached: boolean;
  consistencyModelEvidenceRequired: boolean;
  consistencyModelEvidenceAttached: boolean;
  failoverPitrPlanEvidenceRequired: boolean;
  failoverPitrPlanEvidenceAttached: boolean;
  migrationBackfillPlanEvidenceRequired: boolean;
  migrationBackfillPlanEvidenceAttached: boolean;
  observabilityPlanEvidenceRequired: boolean;
  observabilityPlanEvidenceAttached: boolean;
  rollbackPlanEvidenceRequired: boolean;
  rollbackPlanEvidenceAttached: boolean;
  designPackageEvidence: Phase53MultiWriterTopologyEvidenceItem[];
  releaseAllowed: boolean;
  summary: string;
  blockers: string[];
  nextSteps: string[];
}

export interface Phase55MultiWriterImplementationAuthorizationGateReport {
  phase: "55";
  required: boolean;
  designPackageReviewEvidenceRequired: boolean;
  designPackageReviewEvidenceAttached: boolean;
  implementationAuthorizationEvidenceRequired: boolean;
  implementationAuthorizationEvidenceAttached: boolean;
  implementationAuthorized: boolean;
  runtimeSupportBlocked: boolean;
  releaseAllowed: boolean;
  summary: string;
  blockers: string[];
  nextSteps: string[];
}

export interface Phase56MultiWriterRuntimeReadinessGateReport {
  phase: "56";
  required: boolean;
  implementationReadinessEvidenceRequired: boolean;
  implementationReadinessEvidenceAttached: boolean;
  rolloutSafetyEvidenceRequired: boolean;
  rolloutSafetyEvidenceAttached: boolean;
  runtimeImplementationReady: boolean;
  rolloutSafetyReady: boolean;
  runtimeReadinessComplete: boolean;
  runtimeSupportBlocked: boolean;
  releaseAllowed: boolean;
  summary: string;
  blockers: string[];
  nextSteps: string[];
}

export interface Phase57MultiWriterImplementationScopeGateReport {
  phase: "57";
  required: boolean;
  runtimeReadinessRequired: boolean;
  runtimeReadinessComplete: boolean;
  implementationScopeLockRequired: boolean;
  implementationScopeLockAttached: boolean;
  runtimeFeatureFlagRequired: boolean;
  runtimeFeatureFlagAttached: boolean;
  validationEvidenceRequired: boolean;
  validationEvidenceAttached: boolean;
  migrationCutoverLockRequired: boolean;
  migrationCutoverLockAttached: boolean;
  releaseOwnerSignoffRequired: boolean;
  releaseOwnerSignoffAttached: boolean;
  implementationScopeComplete: boolean;
  runtimeSupportBlocked: boolean;
  releaseAllowed: boolean;
  summary: string;
  blockers: string[];
  nextSteps: string[];
}

export interface Phase58MultiWriterRuntimeImplementationValidationGateReport {
  phase: "58";
  required: boolean;
  implementationScopeRequired: boolean;
  implementationScopeComplete: boolean;
  runtimeImplementationEvidenceRequired: boolean;
  runtimeImplementationEvidenceAttached: boolean;
  consistencyValidationEvidenceRequired: boolean;
  consistencyValidationEvidenceAttached: boolean;
  failoverValidationEvidenceRequired: boolean;
  failoverValidationEvidenceAttached: boolean;
  dataIntegrityValidationEvidenceRequired: boolean;
  dataIntegrityValidationEvidenceAttached: boolean;
  operationsRunbookRequired: boolean;
  operationsRunbookAttached: boolean;
  runtimeReleaseSignoffRequired: boolean;
  runtimeReleaseSignoffAttached: boolean;
  runtimeImplementationValidationComplete: boolean;
  runtimeSupportBlocked: boolean;
  releaseAllowed: boolean;
  summary: string;
  blockers: string[];
  nextSteps: string[];
}

export interface Phase53MultiWriterTopologyEvidenceItem {
  id:
    | "topology-owner"
    | "consistency-model"
    | "failover-pitr-plan"
    | "migration-backfill-plan"
    | "observability-plan"
    | "rollback-plan";
  label: string;
  envKey: keyof ReleaseReadinessEnv;
  required: boolean;
  attached: boolean;
  summary: string;
}

export interface ReleaseReadinessReport {
  phase: "43";
  readyForRelease: boolean;
  summary: string;
  checks: ReleaseReadinessCheck[];
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
  storageTopology: StorageTopologyReport;
  managedDatabaseTopology: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport;
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport;
  asyncStoreBoundary: AsyncStoreBoundaryReport;
}

export interface ReleaseReadinessDeps {
  probes?: StorageTopologyProbeDeps;
  storageTopology?: StorageTopologyReport;
  managedDatabaseTopology?: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard?: ManagedDatabaseRuntimeGuardReport;
  managedDatabaseRuntimeBoundary?: ManagedDatabaseRuntimeBoundaryReport;
  asyncStoreBoundary?: AsyncStoreBoundaryReport;
  buildStorageTopologyReport?: (
    env?: StorageTopologyEnv,
    probes?: StorageTopologyProbeDeps,
  ) => StorageTopologyReport;
  buildManagedDatabaseTopologyReport?: (
    env?: ManagedDatabaseTopologyEnv,
  ) => ManagedDatabaseTopologyReport;
  buildManagedDatabaseRuntimeGuardReport?: (
    env?: ManagedDatabaseRuntimeGuardEnv,
  ) => ManagedDatabaseRuntimeGuardReport;
  strict?: boolean;
}

export interface ReleaseReadinessInput extends ReleaseReadinessDeps {
  env?: ReleaseReadinessEnv;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalize(value: string | undefined): string {
  return clean(value).toLowerCase();
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(normalize(value));
}

const PHASE_55_APPROVED_REVIEW_STATUSES = new Set([
  "approved",
  "authorized",
  "implementation-approved",
  "implementation-authorized",
]);

function parentPath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  if (slash <= 0) return null;
  return path.slice(0, slash);
}

function productionOrStrict(env: ReleaseReadinessEnv, strict: boolean | undefined): boolean {
  return (
    strict === true ||
    normalize(env.NODE_ENV) === "production" ||
    truthy(env.TASKLOOM_RELEASE_STRICT) ||
    truthy(env.TASKLOOM_STRICT_RELEASE)
  );
}

function checkDirectory(
  probes: StorageTopologyProbeDeps | undefined,
  path: string,
): boolean | undefined {
  return probes?.directoryExists?.(path);
}

function pushCheck(
  checks: ReleaseReadinessCheck[],
  id: string,
  status: ReleaseReadinessStatus,
  summary: string,
): void {
  checks.push({ id, status, summary });
}

function chooseBlockingStatus(isGated: boolean): ReleaseReadinessStatus {
  return isGated ? "fail" : "warn";
}

function restoreDrillMarker(env: ReleaseReadinessEnv): string {
  return (
    clean(env.TASKLOOM_RESTORE_DRILL_AT) ||
    clean(env.TASKLOOM_LAST_RESTORE_DRILL_AT) ||
    clean(env.TASKLOOM_RESTORE_DRILL_MARKER)
  );
}

function artifactPath(env: ReleaseReadinessEnv): string {
  return clean(env.TASKLOOM_ARTIFACTS_PATH) || clean(env.TASKLOOM_ARTIFACT_DIR);
}

function accessLogDirectory(env: ReleaseReadinessEnv, storageTopology: StorageTopologyReport): string | null {
  const accessLogPath =
    clean(env.TASKLOOM_ACCESS_LOG_PATH) || storageTopology.observed.accessLogPath || null;
  if (!accessLogPath) return null;
  return parentPath(accessLogPath);
}

function storageCheckStatus(
  storageTopology: StorageTopologyReport,
  isGated: boolean,
): ReleaseReadinessStatus {
  if (storageTopology.readyForProduction) return "pass";
  return chooseBlockingStatus(isGated);
}

function managedTopologyCheckStatus(
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  isGated: boolean,
): ReleaseReadinessStatus {
  if (managedDatabaseTopology.ready) return "pass";
  return chooseBlockingStatus(isGated);
}

function runtimeGuardCheckStatus(
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  isGated: boolean,
): ReleaseReadinessStatus {
  if (!managedDatabaseRuntimeGuard.allowed) return chooseBlockingStatus(isGated);
  return managedDatabaseRuntimeGuard.status === "warn" ? "warn" : "pass";
}

function boundaryCheckStatus(
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport,
  isGated: boolean,
): ReleaseReadinessStatus {
  if (!managedDatabaseRuntimeBoundary.allowed) return chooseBlockingStatus(isGated);
  return managedDatabaseRuntimeBoundary.status === "warn" ? "warn" : "pass";
}

function asyncBoundaryCheckStatus(
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  isGated: boolean,
): ReleaseReadinessStatus {
  if (!asyncStoreBoundary.releaseAllowed) return chooseBlockingStatus(isGated);
  return asyncStoreBoundary.status === "warn" ? "warn" : "pass";
}

function phase50ManagedDatabaseCapability(
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
): {
  adapterConfigured: boolean;
  adapterAvailable: boolean;
  backfillAvailable: boolean;
  adapter: string | null;
} {
  const topologyPhase50 = managedDatabaseTopology.managedDatabase.phase50;
  const guardPhase50 = managedDatabaseRuntimeGuard.phase50;
  return {
    adapterConfigured: topologyPhase50?.asyncAdapterConfigured === true || guardPhase50?.asyncAdapterConfigured === true,
    adapterAvailable: topologyPhase50?.asyncAdapterAvailable === true || guardPhase50?.asyncAdapterAvailable === true,
    backfillAvailable: topologyPhase50?.backfillAvailable === true || guardPhase50?.backfillAvailable === true,
    adapter: topologyPhase50?.adapter ?? guardPhase50?.adapter ?? null,
  };
}

function phase51CallSiteMigrationCapability(
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
): {
  tracked: boolean;
  runtimeCallSitesMigrated: boolean;
  remainingSyncCallSiteGroups: string[];
  managedPostgresStartupSupported: boolean;
} {
  const phase51 = managedDatabaseRuntimeGuard.phase51;
  return {
    tracked: phase51?.tracked === true,
    runtimeCallSitesMigrated: phase51?.runtimeCallSitesMigrated === true,
    remainingSyncCallSiteGroups: phase51?.remainingSyncCallSiteGroups ?? [],
    managedPostgresStartupSupported: phase51?.managedPostgresStartupSupported === true,
  };
}

function phase52ManagedStartupSupported(
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
): boolean {
  const phase50Capability = phase50ManagedDatabaseCapability(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  const phase51Capability = phase51CallSiteMigrationCapability(managedDatabaseRuntimeGuard);
  const phase52Support =
    managedDatabaseRuntimeGuard.phase52?.managedPostgresStartupSupported ??
    managedDatabaseTopology.managedDatabase.phase52?.managedPostgresStartupSupported ??
    phase51Capability.managedPostgresStartupSupported;
  return (
    phase50Capability.adapterAvailable &&
    phase51Capability.runtimeCallSitesMigrated &&
    phase52Support === true
  );
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

function buildPhase53DesignPackageEvidence(
  env: ReleaseReadinessEnv,
  required: boolean,
): Phase53MultiWriterTopologyEvidenceItem[] {
  return PHASE53_MULTI_WRITER_DESIGN_PACKAGE_EVIDENCE.map((item) => {
    const attached = clean(env[item.envKey]).length > 0;
    return {
      ...item,
      required,
      attached,
      summary: attached
        ? `${item.label} evidence is attached via ${item.envKey}.`
        : `${item.label} evidence is missing; set ${item.envKey} before treating multi-writer topology design as complete.`,
    };
  });
}

function buildPhase53MultiWriterTopologyGate(
  multiWriterIntent: boolean,
  env: ReleaseReadinessEnv,
): Phase53MultiWriterTopologyGateReport {
  const requirementsEvidenceAttached = clean(env.TASKLOOM_MULTI_WRITER_REQUIREMENTS_EVIDENCE).length > 0;
  const designEvidenceAttached = clean(env.TASKLOOM_MULTI_WRITER_DESIGN_EVIDENCE).length > 0;
  const designPackageEvidence = buildPhase53DesignPackageEvidence(env, multiWriterIntent);
  const designPackageEvidenceAttached = designPackageEvidence.every((item) => item.attached);
  const evidenceAttached = (id: Phase53MultiWriterTopologyEvidenceItem["id"]): boolean =>
    designPackageEvidence.some((item) => item.id === id && item.attached);

  if (!multiWriterIntent) {
    return {
      phase: "53",
      required: false,
      requirementsEvidenceRequired: false,
      designEvidenceRequired: false,
      designPackageEvidenceRequired: false,
      requirementsEvidenceAttached,
      designEvidenceAttached,
      designPackageEvidenceAttached,
      topologyOwnerEvidenceRequired: false,
      topologyOwnerEvidenceAttached: evidenceAttached("topology-owner"),
      consistencyModelEvidenceRequired: false,
      consistencyModelEvidenceAttached: evidenceAttached("consistency-model"),
      failoverPitrPlanEvidenceRequired: false,
      failoverPitrPlanEvidenceAttached: evidenceAttached("failover-pitr-plan"),
      migrationBackfillPlanEvidenceRequired: false,
      migrationBackfillPlanEvidenceAttached: evidenceAttached("migration-backfill-plan"),
      observabilityPlanEvidenceRequired: false,
      observabilityPlanEvidenceAttached: evidenceAttached("observability-plan"),
      rollbackPlanEvidenceRequired: false,
      rollbackPlanEvidenceAttached: evidenceAttached("rollback-plan"),
      designPackageEvidence,
      releaseAllowed: true,
      summary: "Phase 53 multi-writer topology requirements/design gate is not required for single-writer managed Postgres or local storage posture.",
      blockers: [],
      nextSteps: ["Keep Phase 53 requirements/design evidence ready before enabling distributed, active-active, or multi-writer database topology."],
    };
  }

  return {
    phase: "53",
    required: true,
    requirementsEvidenceRequired: true,
    designEvidenceRequired: true,
    designPackageEvidenceRequired: true,
    requirementsEvidenceAttached,
    designEvidenceAttached,
    designPackageEvidenceAttached,
    topologyOwnerEvidenceRequired: true,
    topologyOwnerEvidenceAttached: evidenceAttached("topology-owner"),
    consistencyModelEvidenceRequired: true,
    consistencyModelEvidenceAttached: evidenceAttached("consistency-model"),
    failoverPitrPlanEvidenceRequired: true,
    failoverPitrPlanEvidenceAttached: evidenceAttached("failover-pitr-plan"),
    migrationBackfillPlanEvidenceRequired: true,
    migrationBackfillPlanEvidenceAttached: evidenceAttached("migration-backfill-plan"),
    observabilityPlanEvidenceRequired: true,
    observabilityPlanEvidenceAttached: evidenceAttached("observability-plan"),
    rollbackPlanEvidenceRequired: true,
    rollbackPlanEvidenceAttached: evidenceAttached("rollback-plan"),
    designPackageEvidence,
    releaseAllowed: false,
    summary: requirementsEvidenceAttached && designEvidenceAttached && designPackageEvidenceAttached
      ? "Phase 54 multi-writer topology design-package evidence is attached, but distributed, active-active, or multi-writer runtime release remains blocked until a later implementation gate explicitly allows it."
      : requirementsEvidenceAttached && designEvidenceAttached
        ? "Phase 54 multi-writer topology design-package evidence is required before distributed, active-active, or multi-writer database release."
        : "Phase 53 multi-writer topology requirements/design evidence is required before Phase 54 design-package review.",
    blockers: [
      ...(!requirementsEvidenceAttached
        ? ["Phase 53 multi-writer topology requirements evidence is required before release."]
        : []),
      ...(!designEvidenceAttached
        ? ["Phase 53 multi-writer topology design evidence is required before release."]
        : []),
      ...designPackageEvidence
        .filter((item) => !item.attached)
        .map((item) => `Phase 54 multi-writer ${item.label.toLowerCase()} evidence is required before release.`),
      "Phase 54 multi-writer, distributed, or active-active runtime support remains blocked even when design-package evidence is attached.",
    ],
    nextSteps: [
      ...(!requirementsEvidenceAttached
        ? ["Attach Phase 53 multi-writer topology requirements evidence before considering distributed, active-active, or multi-writer release."]
        : []),
      ...(!designEvidenceAttached
        ? ["Attach Phase 53 multi-writer topology design evidence before considering distributed, active-active, or multi-writer release."]
        : []),
      ...designPackageEvidence
        .filter((item) => !item.attached)
        .map((item) => `Attach Phase 54 multi-writer ${item.label.toLowerCase()} evidence before considering distributed, active-active, or multi-writer release.`),
      "Keep multi-writer, distributed, and active-active runtime release blocked until implementation support and a later release gate explicitly allow it.",
    ],
  };
}

function buildPhase55MultiWriterImplementationAuthorizationGate(
  multiWriterIntent: boolean,
  phase53Gate: Phase53MultiWriterTopologyGateReport,
  env: ReleaseReadinessEnv,
): Phase55MultiWriterImplementationAuthorizationGateReport {
  const designPackageReviewReferenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW).length > 0;
  const designReviewerAttached = clean(env.TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER).length > 0;
  const reviewStatusApproved = PHASE_55_APPROVED_REVIEW_STATUSES.has(
    normalize(env.TASKLOOM_MULTI_WRITER_REVIEW_STATUS),
  );
  const implementationAuthorizationReferenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION).length > 0;
  const implementationApproverAttached =
    clean(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER).length > 0;
  const approvedImplementationScopeAttached =
    clean(env.TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE).length > 0;
  const safetySignoffAttached = clean(env.TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF).length > 0;
  const designPackageReviewEvidenceAttached =
    designPackageReviewReferenceAttached || (designReviewerAttached && reviewStatusApproved);
  const implementationAuthorizationEvidenceAttached =
    implementationAuthorizationReferenceAttached ||
    (implementationApproverAttached && approvedImplementationScopeAttached && safetySignoffAttached);
  const implementationAuthorized =
    multiWriterIntent &&
    phase53Gate.designPackageEvidenceAttached &&
    designPackageReviewEvidenceAttached &&
    implementationAuthorizationEvidenceAttached;

  if (!multiWriterIntent) {
    return {
      phase: "55",
      required: false,
      designPackageReviewEvidenceRequired: false,
      designPackageReviewEvidenceAttached,
      implementationAuthorizationEvidenceRequired: false,
      implementationAuthorizationEvidenceAttached,
      implementationAuthorized: false,
      runtimeSupportBlocked: false,
      releaseAllowed: true,
      summary: "Phase 55 multi-writer design-package review and implementation authorization gate is not required for this release posture.",
      blockers: [],
      nextSteps: ["Keep Phase 55 review and implementation authorization evidence ready before starting multi-writer runtime implementation work."],
    };
  }

  return {
    phase: "55",
    required: true,
    designPackageReviewEvidenceRequired: true,
    designPackageReviewEvidenceAttached,
    implementationAuthorizationEvidenceRequired: true,
    implementationAuthorizationEvidenceAttached,
    implementationAuthorized,
    runtimeSupportBlocked: true,
    releaseAllowed: false,
    summary: implementationAuthorized
      ? "Phase 55 multi-writer design-package review and implementation authorization evidence is attached, but multi-writer runtime support remains blocked until a later runtime release gate explicitly allows it."
      : phase53Gate.designPackageEvidenceAttached
        ? "Phase 55 multi-writer design-package review and implementation authorization evidence is required before any multi-writer runtime implementation work."
        : "Phase 55 multi-writer implementation authorization requires the Phase 54 design package before review or authorization can unblock implementation planning.",
    blockers: [
      ...(!phase53Gate.designPackageEvidenceAttached
        ? ["Phase 55 multi-writer implementation authorization requires attached Phase 54 design-package evidence before review."]
        : []),
      ...(!designPackageReviewEvidenceAttached
        ? ["Phase 55 multi-writer design-package review evidence is required before runtime implementation work; attach TASKLOOM_MULTI_WRITER_DESIGN_PACKAGE_REVIEW or provide TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER with approved TASKLOOM_MULTI_WRITER_REVIEW_STATUS."]
        : []),
      ...(!implementationAuthorizationEvidenceAttached
        ? ["Phase 55 multi-writer implementation authorization evidence is required before runtime implementation work; attach TASKLOOM_MULTI_WRITER_IMPLEMENTATION_AUTHORIZATION or provide approver, approved scope, and safety signoff evidence."]
        : []),
      "Phase 55 multi-writer runtime support remains blocked; review and authorization evidence does not permit release until a later runtime implementation gate explicitly allows it.",
    ],
    nextSteps: [
      ...(!phase53Gate.designPackageEvidenceAttached
        ? ["Complete and attach the Phase 54 multi-writer design package before requesting Phase 55 review or implementation authorization."]
        : []),
      ...(!designPackageReviewEvidenceAttached
        ? ["Attach Phase 55 multi-writer design-package review evidence, or set TASKLOOM_MULTI_WRITER_DESIGN_REVIEWER plus TASKLOOM_MULTI_WRITER_REVIEW_STATUS=approved before starting runtime implementation work."]
        : []),
      ...(!implementationAuthorizationEvidenceAttached
        ? ["Attach Phase 55 multi-writer implementation authorization evidence, or set TASKLOOM_MULTI_WRITER_IMPLEMENTATION_APPROVER, TASKLOOM_MULTI_WRITER_APPROVED_IMPLEMENTATION_SCOPE, and TASKLOOM_MULTI_WRITER_SAFETY_SIGNOFF before starting runtime implementation work."]
        : []),
      "Keep multi-writer runtime release blocked after Phase 55 authorization until implementation support and a later release gate explicitly allow it.",
    ],
  };
}

function buildPhase56MultiWriterRuntimeReadinessGate(
  multiWriterIntent: boolean,
  phase55Gate: Phase55MultiWriterImplementationAuthorizationGateReport,
  env: ReleaseReadinessEnv,
): Phase56MultiWriterRuntimeReadinessGateReport {
  const detailedImplementationReadinessEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_PLAN).length > 0 &&
    clean(env.TASKLOOM_MULTI_WRITER_TEST_VALIDATION_PLAN).length > 0 &&
    clean(env.TASKLOOM_MULTI_WRITER_DATA_SAFETY_PLAN).length > 0;
  const detailedRolloutSafetyEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_ROLLOUT_PLAN).length > 0 &&
    clean(env.TASKLOOM_MULTI_WRITER_CUTOVER_PLAN).length > 0 &&
    clean(env.TASKLOOM_MULTI_WRITER_ROLLBACK_DRILL_EVIDENCE).length > 0;
  const implementationReadinessEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE).length > 0 ||
    detailedImplementationReadinessEvidenceAttached;
  const rolloutSafetyEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE).length > 0 ||
    detailedRolloutSafetyEvidenceAttached;
  const runtimeImplementationReady =
    multiWriterIntent &&
    phase55Gate.implementationAuthorized &&
    implementationReadinessEvidenceAttached;
  const rolloutSafetyReady =
    multiWriterIntent &&
    phase55Gate.implementationAuthorized &&
    rolloutSafetyEvidenceAttached;
  const runtimeReadinessComplete = runtimeImplementationReady && rolloutSafetyReady;

  if (!multiWriterIntent) {
    return {
      phase: "56",
      required: false,
      implementationReadinessEvidenceRequired: false,
      implementationReadinessEvidenceAttached,
      rolloutSafetyEvidenceRequired: false,
      rolloutSafetyEvidenceAttached,
      runtimeImplementationReady: false,
      rolloutSafetyReady: false,
      runtimeReadinessComplete: false,
      runtimeSupportBlocked: false,
      releaseAllowed: true,
      summary: "Phase 56 multi-writer runtime implementation readiness and rollout-safety gate is not required for this release posture.",
      blockers: [],
      nextSteps: ["Keep Phase 56 runtime readiness and rollout-safety evidence ready before claiming multi-writer runtime support."],
    };
  }

  return {
    phase: "56",
    required: true,
    implementationReadinessEvidenceRequired: true,
    implementationReadinessEvidenceAttached,
    rolloutSafetyEvidenceRequired: true,
    rolloutSafetyEvidenceAttached,
    runtimeImplementationReady,
    rolloutSafetyReady,
    runtimeReadinessComplete,
    runtimeSupportBlocked: true,
    releaseAllowed: false,
    summary: runtimeReadinessComplete
      ? "Phase 56 multi-writer runtime implementation readiness and rollout-safety evidence is attached, but multi-writer runtime support remains blocked until a later release gate explicitly allows it."
      : phase55Gate.implementationAuthorized
        ? "Phase 56 multi-writer runtime implementation readiness and rollout-safety evidence is required before any multi-writer runtime support claim."
        : "Phase 56 multi-writer runtime readiness requires Phase 55 review and implementation authorization before readiness evidence can support a runtime claim.",
    blockers: [
      ...(!phase55Gate.implementationAuthorized
        ? ["Phase 56 multi-writer runtime readiness requires attached Phase 55 review and implementation authorization evidence first."]
        : []),
      ...(!implementationReadinessEvidenceAttached
        ? ["Phase 56 multi-writer runtime implementation readiness evidence is required before any runtime support claim; attach TASKLOOM_MULTI_WRITER_IMPLEMENTATION_READINESS_EVIDENCE or the detailed implementation, test/validation, and data-safety evidence."]
        : []),
      ...(!rolloutSafetyEvidenceAttached
        ? ["Phase 56 multi-writer rollout-safety evidence is required before any runtime support claim; attach TASKLOOM_MULTI_WRITER_ROLLOUT_SAFETY_EVIDENCE or the detailed rollout, cutover, and rollback-drill evidence."]
        : []),
      "Phase 56 multi-writer runtime support remains blocked; readiness and rollout-safety evidence does not permit release until a later runtime implementation gate explicitly allows it.",
    ],
    nextSteps: [
      ...(!phase55Gate.implementationAuthorized
        ? ["Complete Phase 55 multi-writer review and implementation authorization before treating Phase 56 runtime readiness evidence as complete."]
        : []),
      ...(!implementationReadinessEvidenceAttached
        ? ["Attach Phase 56 multi-writer runtime implementation readiness evidence before claiming multi-writer runtime support."]
        : []),
      ...(!rolloutSafetyEvidenceAttached
        ? ["Attach Phase 56 multi-writer rollout-safety evidence before claiming multi-writer runtime support."]
        : []),
      "Keep multi-writer runtime release blocked after Phase 56 readiness evidence until a later release gate explicitly allows it.",
    ],
  };
}

function buildPhase57MultiWriterImplementationScopeGate(
  multiWriterIntent: boolean,
  phase56Gate: Phase56MultiWriterRuntimeReadinessGateReport,
  env: ReleaseReadinessEnv,
): Phase57MultiWriterImplementationScopeGateReport {
  const implementationScopeLockAttached = clean(env.TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK).length > 0;
  const runtimeFeatureFlagAttached = clean(env.TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG).length > 0;
  const validationEvidenceAttached = clean(env.TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE).length > 0;
  const migrationCutoverLockAttached = clean(env.TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK).length > 0;
  const releaseOwnerSignoffAttached = clean(env.TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF).length > 0;
  const implementationScopeComplete =
    multiWriterIntent &&
    phase56Gate.runtimeReadinessComplete &&
    implementationScopeLockAttached &&
    runtimeFeatureFlagAttached &&
    validationEvidenceAttached &&
    migrationCutoverLockAttached &&
    releaseOwnerSignoffAttached;

  if (!multiWriterIntent) {
    return {
      phase: "57",
      required: false,
      runtimeReadinessRequired: false,
      runtimeReadinessComplete: phase56Gate.runtimeReadinessComplete,
      implementationScopeLockRequired: false,
      implementationScopeLockAttached,
      runtimeFeatureFlagRequired: false,
      runtimeFeatureFlagAttached,
      validationEvidenceRequired: false,
      validationEvidenceAttached,
      migrationCutoverLockRequired: false,
      migrationCutoverLockAttached,
      releaseOwnerSignoffRequired: false,
      releaseOwnerSignoffAttached,
      implementationScopeComplete: false,
      runtimeSupportBlocked: false,
      releaseAllowed: true,
      summary: "Phase 57 multi-writer implementation-scope gate is not required for this release posture.",
      blockers: [],
      nextSteps: ["Keep Phase 57 implementation-scope evidence ready before claiming multi-writer runtime implementation scope."],
    };
  }

  return {
    phase: "57",
    required: true,
    runtimeReadinessRequired: true,
    runtimeReadinessComplete: phase56Gate.runtimeReadinessComplete,
    implementationScopeLockRequired: true,
    implementationScopeLockAttached,
    runtimeFeatureFlagRequired: true,
    runtimeFeatureFlagAttached,
    validationEvidenceRequired: true,
    validationEvidenceAttached,
    migrationCutoverLockRequired: true,
    migrationCutoverLockAttached,
    releaseOwnerSignoffRequired: true,
    releaseOwnerSignoffAttached,
    implementationScopeComplete,
    runtimeSupportBlocked: true,
    releaseAllowed: false,
    summary: implementationScopeComplete
      ? "Phase 57 multi-writer implementation-scope evidence is attached, but multi-writer runtime support remains blocked until a later release gate explicitly allows it."
      : phase56Gate.runtimeReadinessComplete
        ? "Phase 57 multi-writer implementation-scope evidence is required before any multi-writer runtime implementation scope claim."
        : "Phase 57 multi-writer implementation-scope gate requires Phase 56 runtime readiness and rollout-safety evidence first.",
    blockers: [
      ...(!phase56Gate.runtimeReadinessComplete
        ? ["Phase 57 multi-writer implementation scope requires Phase 56 runtime readiness complete first."]
        : []),
      ...(!implementationScopeLockAttached
        ? ["Phase 57 multi-writer implementation scope lock evidence is required before any runtime implementation scope claim."]
        : []),
      ...(!runtimeFeatureFlagAttached
        ? ["Phase 57 multi-writer runtime feature-flag evidence is required before any runtime implementation scope claim."]
        : []),
      ...(!validationEvidenceAttached
        ? ["Phase 57 multi-writer validation evidence is required before any runtime implementation scope claim."]
        : []),
      ...(!migrationCutoverLockAttached
        ? ["Phase 57 multi-writer migration cutover lock evidence is required before any runtime implementation scope claim."]
        : []),
      ...(!releaseOwnerSignoffAttached
        ? ["Phase 57 multi-writer release owner signoff evidence is required before any runtime implementation scope claim."]
        : []),
      "Phase 57 multi-writer runtime support remains blocked; implementation-scope evidence does not permit release until a later runtime implementation gate explicitly allows it.",
    ],
    nextSteps: [
      ...(!phase56Gate.runtimeReadinessComplete
        ? ["Complete Phase 56 multi-writer runtime readiness before treating Phase 57 implementation-scope evidence as complete."]
        : []),
      ...(!implementationScopeLockAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_IMPLEMENTATION_SCOPE_LOCK before claiming multi-writer implementation scope."]
        : []),
      ...(!runtimeFeatureFlagAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_RUNTIME_FEATURE_FLAG before claiming multi-writer implementation scope."]
        : []),
      ...(!validationEvidenceAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_VALIDATION_EVIDENCE before claiming multi-writer implementation scope."]
        : []),
      ...(!migrationCutoverLockAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_MIGRATION_CUTOVER_LOCK before claiming multi-writer implementation scope."]
        : []),
      ...(!releaseOwnerSignoffAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_RELEASE_OWNER_SIGNOFF before claiming multi-writer implementation scope."]
        : []),
      "Keep multi-writer runtime release blocked after Phase 57 implementation-scope evidence until a later release gate explicitly allows it.",
    ],
  };
}

function buildPhase58MultiWriterRuntimeImplementationValidationGate(
  multiWriterIntent: boolean,
  phase57Gate: Phase57MultiWriterImplementationScopeGateReport,
  env: ReleaseReadinessEnv,
): Phase58MultiWriterRuntimeImplementationValidationGateReport {
  const runtimeImplementationEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE).length > 0;
  const consistencyValidationEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE).length > 0;
  const failoverValidationEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE).length > 0;
  const dataIntegrityValidationEvidenceAttached =
    clean(env.TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE).length > 0;
  const operationsRunbookAttached =
    clean(env.TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK).length > 0;
  const runtimeReleaseSignoffAttached =
    clean(env.TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF).length > 0;
  const runtimeImplementationValidationComplete =
    multiWriterIntent &&
    phase57Gate.implementationScopeComplete &&
    runtimeImplementationEvidenceAttached &&
    consistencyValidationEvidenceAttached &&
    failoverValidationEvidenceAttached &&
    dataIntegrityValidationEvidenceAttached &&
    operationsRunbookAttached &&
    runtimeReleaseSignoffAttached;

  if (!multiWriterIntent) {
    return {
      phase: "58",
      required: false,
      implementationScopeRequired: false,
      implementationScopeComplete: phase57Gate.implementationScopeComplete,
      runtimeImplementationEvidenceRequired: false,
      runtimeImplementationEvidenceAttached,
      consistencyValidationEvidenceRequired: false,
      consistencyValidationEvidenceAttached,
      failoverValidationEvidenceRequired: false,
      failoverValidationEvidenceAttached,
      dataIntegrityValidationEvidenceRequired: false,
      dataIntegrityValidationEvidenceAttached,
      operationsRunbookRequired: false,
      operationsRunbookAttached,
      runtimeReleaseSignoffRequired: false,
      runtimeReleaseSignoffAttached,
      runtimeImplementationValidationComplete: false,
      runtimeSupportBlocked: false,
      releaseAllowed: true,
      summary: "Phase 58 multi-writer runtime implementation validation gate is not required for this release posture.",
      blockers: [],
      nextSteps: ["Keep Phase 58 runtime implementation validation evidence ready before claiming multi-writer runtime validation."],
    };
  }

  return {
    phase: "58",
    required: true,
    implementationScopeRequired: true,
    implementationScopeComplete: phase57Gate.implementationScopeComplete,
    runtimeImplementationEvidenceRequired: true,
    runtimeImplementationEvidenceAttached,
    consistencyValidationEvidenceRequired: true,
    consistencyValidationEvidenceAttached,
    failoverValidationEvidenceRequired: true,
    failoverValidationEvidenceAttached,
    dataIntegrityValidationEvidenceRequired: true,
    dataIntegrityValidationEvidenceAttached,
    operationsRunbookRequired: true,
    operationsRunbookAttached,
    runtimeReleaseSignoffRequired: true,
    runtimeReleaseSignoffAttached,
    runtimeImplementationValidationComplete,
    runtimeSupportBlocked: true,
    releaseAllowed: false,
    summary: runtimeImplementationValidationComplete
      ? "Phase 58 multi-writer runtime implementation validation evidence is attached, but multi-writer runtime support remains blocked; this phase validates evidence only."
      : phase57Gate.implementationScopeComplete
        ? "Phase 58 multi-writer runtime implementation validation evidence is required before any multi-writer runtime validation claim."
        : "Phase 58 multi-writer runtime implementation validation requires Phase 57 implementation-scope completion first.",
    blockers: [
      ...(!phase57Gate.implementationScopeComplete
        ? ["Phase 58 multi-writer runtime implementation validation requires complete Phase 57 implementation-scope evidence first."]
        : []),
      ...(!runtimeImplementationEvidenceAttached
        ? ["Phase 58 multi-writer runtime implementation evidence is required before any runtime validation claim."]
        : []),
      ...(!consistencyValidationEvidenceAttached
        ? ["Phase 58 multi-writer consistency validation evidence is required before any runtime validation claim."]
        : []),
      ...(!failoverValidationEvidenceAttached
        ? ["Phase 58 multi-writer failover validation evidence is required before any runtime validation claim."]
        : []),
      ...(!dataIntegrityValidationEvidenceAttached
        ? ["Phase 58 multi-writer data integrity validation evidence is required before any runtime validation claim."]
        : []),
      ...(!operationsRunbookAttached
        ? ["Phase 58 multi-writer operations runbook evidence is required before any runtime validation claim."]
        : []),
      ...(!runtimeReleaseSignoffAttached
        ? ["Phase 58 multi-writer runtime release signoff evidence is required before any runtime validation claim."]
        : []),
      "Phase 58 multi-writer runtime support remains blocked; runtime implementation validation evidence does not permit distributed, active-active, or multi-writer release.",
    ],
    nextSteps: [
      ...(!phase57Gate.implementationScopeComplete
        ? ["Complete Phase 57 multi-writer implementation-scope evidence before treating Phase 58 runtime implementation validation as complete."]
        : []),
      ...(!runtimeImplementationEvidenceAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_RUNTIME_IMPLEMENTATION_EVIDENCE before claiming multi-writer runtime implementation validation."]
        : []),
      ...(!consistencyValidationEvidenceAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_CONSISTENCY_VALIDATION_EVIDENCE before claiming multi-writer consistency validation."]
        : []),
      ...(!failoverValidationEvidenceAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_FAILOVER_VALIDATION_EVIDENCE before claiming multi-writer failover validation."]
        : []),
      ...(!dataIntegrityValidationEvidenceAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_DATA_INTEGRITY_VALIDATION_EVIDENCE before claiming multi-writer data integrity validation."]
        : []),
      ...(!operationsRunbookAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_OPERATIONS_RUNBOOK before claiming multi-writer operations readiness."]
        : []),
      ...(!runtimeReleaseSignoffAttached
        ? ["Attach TASKLOOM_MULTI_WRITER_RUNTIME_RELEASE_SIGNOFF before claiming multi-writer runtime release signoff."]
        : []),
      "Keep multi-writer runtime release blocked after Phase 58 validation evidence; this phase does not enable distributed, active-active, or multi-writer runtime support.",
    ],
  };
}

export function buildManagedDatabaseRuntimeBoundaryReport(
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
): ManagedDatabaseRuntimeBoundaryReport {
  const phase50Capability = phase50ManagedDatabaseCapability(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  const managedStartupSupported = phase52ManagedStartupSupported(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  const managedDatabaseBlocked =
    !managedStartupSupported &&
    (managedDatabaseTopology.classification === "managed-database-requested" ||
      managedDatabaseRuntimeGuard.classification === "managed-database-blocked");
  const multiWriterBlocked =
    managedDatabaseTopology.classification === "production-blocked" ||
    managedDatabaseRuntimeGuard.classification === "multi-writer-blocked";
  const unsupportedStore =
    managedDatabaseTopology.classification === "unsupported-store" ||
    managedDatabaseRuntimeGuard.classification === "unsupported-store";
  const bypassed = managedDatabaseRuntimeGuard.classification === "bypassed";
  const blockers = Array.from(new Set([
    ...managedDatabaseTopology.blockers,
    ...managedDatabaseRuntimeGuard.blockers,
  ]));
  const warnings = Array.from(new Set([
    ...managedDatabaseTopology.warnings,
    ...managedDatabaseRuntimeGuard.warnings,
  ]));
  const nextSteps = new Set([
    ...managedDatabaseTopology.nextSteps,
    ...managedDatabaseRuntimeGuard.nextSteps,
  ]);

  let classification: ManagedDatabaseRuntimeBoundaryClassification;
  if (bypassed) {
    classification = "bypassed";
  } else if (managedStartupSupported && !multiWriterBlocked && !unsupportedStore) {
    classification = "managed-database-supported";
  } else if (multiWriterBlocked) {
    classification = "multi-writer-blocked";
  } else if (managedDatabaseBlocked) {
    classification = "managed-database-blocked";
  } else if (unsupportedStore) {
    classification = "unsupported-store";
  } else if (blockers.length > 0) {
    classification = "inherited-blocker";
  } else {
    classification = managedDatabaseRuntimeGuard.classification === "single-node-sqlite"
      ? "single-node-sqlite"
      : "local-json";
  }

  if (managedStartupSupported && !multiWriterBlocked && !unsupportedStore) {
    nextSteps.add("Attach Phase 52 managed Postgres startup support evidence to the release handoff.");
  } else if (managedDatabaseBlocked || unsupportedStore) {
    if (phase50Capability.adapterAvailable) {
      nextSteps.add("Use Phase 50 async adapter/backfill evidence for migration planning, while keeping synchronous managed startup blocked.");
    } else {
      nextSteps.add("Keep managed database rollout blocked until async adapter/backfill evidence and synchronous startup support are explicitly available.");
    }
  }
  if (multiWriterBlocked) {
    nextSteps.add("Keep multi-writer, distributed, or active-active database topology out of strict release until Phase 53 requirements/design evidence is attached and a later release gate explicitly allows it.");
  }
  if (nextSteps.size === 0) {
    nextSteps.add("Continue using local JSON for contributor workflows or SQLite for single-node persistence.");
  }

  const allowed =
    (managedDatabaseTopology.ready && managedDatabaseRuntimeGuard.allowed) ||
    (managedStartupSupported && !multiWriterBlocked && !unsupportedStore);
  const status: ReleaseReadinessStatus = allowed
    ? bypassed || warnings.length > 0
      ? "warn"
      : "pass"
    : "fail";
  let summary: string;
  if (managedStartupSupported && !multiWriterBlocked && !unsupportedStore) {
    summary = "Phase 52 managed Postgres startup support is asserted with Phase 50 adapter/backfill capability and Phase 51 migrated call-site evidence.";
  } else if (multiWriterBlocked) {
    summary = "Phase 48 managed database runtime boundary blocks multi-writer, distributed, or active-active topology and points release handoff to Phase 53 requirements/design evidence.";
  } else if (managedDatabaseBlocked || unsupportedStore) {
    summary = phase50Capability.adapterAvailable
      ? "Phase 48 managed database runtime boundary still blocks synchronous managed startup even though Phase 50 async adapter/backfill capability is available."
      : "Phase 48 managed database runtime boundary blocks managed database storage until managed startup support is explicitly available.";
  } else if (bypassed) {
    summary = "Phase 48 managed database runtime boundary is bypassed; unsupported runtime configuration remains present.";
  } else if (allowed) {
    summary = managedDatabaseRuntimeGuard.classification === "single-node-sqlite"
      ? "Phase 48 managed database runtime boundary allows supported single-node SQLite release posture."
      : "Phase 48 managed database runtime boundary allows supported local JSON release posture.";
  } else {
    summary = "Phase 48 managed database runtime boundary inherits unresolved topology or runtime blockers.";
  }

  return {
    phase: "48",
    status,
    allowed,
    classification,
    summary,
    blockers,
    warnings,
    nextSteps: Array.from(nextSteps),
  };
}

export function buildAsyncStoreBoundaryReport(
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport,
  env: ReleaseReadinessEnv = {},
): AsyncStoreBoundaryReport {
  const phase50Capability = phase50ManagedDatabaseCapability(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  const phase51Capability = phase51CallSiteMigrationCapability(managedDatabaseRuntimeGuard);
  const managedStartupSupported = phase52ManagedStartupSupported(
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  );
  const managedIntent =
    managedDatabaseTopology.managedDatabase.requested ||
    managedDatabaseTopology.managedDatabase.configured ||
    managedDatabaseTopology.classification === "managed-database-requested" ||
    managedDatabaseRuntimeGuard.classification === "managed-database-blocked" ||
    managedDatabaseRuntimeBoundary.classification === "managed-database-blocked";
  const multiWriterIntent =
    managedDatabaseTopology.classification === "production-blocked" ||
    managedDatabaseRuntimeGuard.classification === "multi-writer-blocked" ||
    managedDatabaseRuntimeBoundary.classification === "multi-writer-blocked";
  const phase53MultiWriterTopologyGate = buildPhase53MultiWriterTopologyGate(multiWriterIntent, env);
  const phase55MultiWriterImplementationAuthorizationGate =
    buildPhase55MultiWriterImplementationAuthorizationGate(
      multiWriterIntent,
      phase53MultiWriterTopologyGate,
      env,
    );
  const phase56MultiWriterRuntimeReadinessGate =
    buildPhase56MultiWriterRuntimeReadinessGate(
      multiWriterIntent,
      phase55MultiWriterImplementationAuthorizationGate,
      env,
    );
  const phase57MultiWriterImplementationScopeGate =
    buildPhase57MultiWriterImplementationScopeGate(
      multiWriterIntent,
      phase56MultiWriterRuntimeReadinessGate,
      env,
    );
  const phase58MultiWriterRuntimeImplementationValidationGate =
    buildPhase58MultiWriterRuntimeImplementationValidationGate(
      multiWriterIntent,
      phase57MultiWriterImplementationScopeGate,
      env,
    );
  const unsupportedStore =
    managedDatabaseTopology.classification === "unsupported-store" ||
    managedDatabaseRuntimeGuard.classification === "unsupported-store" ||
    managedDatabaseRuntimeBoundary.classification === "unsupported-store";
  const effectivePhase52ManagedStartupSupported =
    managedStartupSupported && !multiWriterIntent && !unsupportedStore;
  const bypassed =
    managedDatabaseRuntimeGuard.classification === "bypassed" ||
    managedDatabaseRuntimeBoundary.classification === "bypassed";
  const blockers = Array.from(new Set([
    ...managedDatabaseTopology.blockers,
    ...managedDatabaseRuntimeGuard.blockers,
    ...managedDatabaseRuntimeBoundary.blockers,
    ...phase53MultiWriterTopologyGate.blockers,
    ...phase55MultiWriterImplementationAuthorizationGate.blockers,
    ...phase56MultiWriterRuntimeReadinessGate.blockers,
    ...phase57MultiWriterImplementationScopeGate.blockers,
    ...phase58MultiWriterRuntimeImplementationValidationGate.blockers,
  ]));
  const warnings = Array.from(new Set([
    ...managedDatabaseTopology.warnings,
    ...managedDatabaseRuntimeGuard.warnings,
    ...managedDatabaseRuntimeBoundary.warnings,
  ]));
  const nextSteps = new Set([
    ...managedDatabaseTopology.nextSteps,
    ...managedDatabaseRuntimeGuard.nextSteps,
    ...managedDatabaseRuntimeBoundary.nextSteps,
    ...phase53MultiWriterTopologyGate.nextSteps,
    ...phase55MultiWriterImplementationAuthorizationGate.nextSteps,
    ...phase56MultiWriterRuntimeReadinessGate.nextSteps,
    ...phase57MultiWriterImplementationScopeGate.nextSteps,
    ...phase58MultiWriterRuntimeImplementationValidationGate.nextSteps,
  ]);

  let classification: AsyncStoreBoundaryClassification;
  if (bypassed) {
    classification = "bypassed";
  } else if (managedIntent && effectivePhase52ManagedStartupSupported) {
    classification = "managed-postgres-startup-supported";
  } else if (multiWriterIntent) {
    classification = "multi-writer-unsupported";
  } else if (managedIntent && phase50Capability.adapterAvailable) {
    classification = "managed-postgres-adapter-available-sync-blocked";
  } else if (managedIntent) {
    classification = "managed-postgres-unsupported";
  } else if (unsupportedStore) {
    classification = "unsupported-store";
  } else if (blockers.length > 0) {
    classification = "inherited-blocker";
  } else {
    classification = "foundation-ready";
  }

  nextSteps.add("Treat Phase 49 as async-store-boundary foundation, Phase 50 as adapter/backfill evidence, and Phase 51 as runtime call-site migration evidence.");
  if (managedIntent && effectivePhase52ManagedStartupSupported) {
    nextSteps.add("Attach Phase 52 managed Postgres startup support evidence to the release handoff.");
  } else if (managedIntent || unsupportedStore) {
    if (phase50Capability.adapterAvailable) {
      if (phase51Capability.runtimeCallSitesMigrated) {
        nextSteps.add("Keep managed Postgres startup blocked until the app runtime support claim is explicitly updated and covered.");
      } else {
        nextSteps.add("Keep managed Postgres startup blocked until Phase 51 call-site migration is complete and the app runtime support claim is explicitly updated.");
      }
    } else {
      nextSteps.add("Keep managed Postgres rollout blocked until adapter, repositories, migrations/backfills, and parity tests are implemented.");
    }
  }
  if (phase51Capability.remainingSyncCallSiteGroups.length > 0) {
    nextSteps.add(`Finish Phase 51 runtime call-site migration for: ${phase51Capability.remainingSyncCallSiteGroups.join(", ")}.`);
  }
  if (multiWriterIntent) {
    if (phase58MultiWriterRuntimeImplementationValidationGate.runtimeImplementationValidationComplete) {
      nextSteps.add("Keep multi-writer database topology blocked even with Phase 58 runtime implementation validation evidence attached; this phase validates evidence and does not enable runtime support.");
    } else if (phase57MultiWriterImplementationScopeGate.implementationScopeComplete) {
      nextSteps.add("Keep multi-writer database topology blocked even with Phase 57 implementation-scope evidence attached until a later release gate explicitly allows the topology.");
    } else if (phase56MultiWriterRuntimeReadinessGate.runtimeReadinessComplete) {
      nextSteps.add("Keep multi-writer database topology blocked even with Phase 56 runtime readiness and rollout-safety evidence attached until a later release gate explicitly allows the topology.");
    } else if (phase55MultiWriterImplementationAuthorizationGate.implementationAuthorized) {
      nextSteps.add("Keep multi-writer database topology blocked even with Phase 55 review and implementation authorization attached until Phase 56 readiness evidence and a later release gate explicitly allow the topology.");
    } else if (phase53MultiWriterTopologyGate.designPackageEvidenceAttached) {
      nextSteps.add("Keep multi-writer database topology blocked even with the Phase 54 design package attached until implementation support and a later release gate explicitly allow the topology.");
    } else {
      nextSteps.add("Keep multi-writer database topology blocked until Phase 54 design-package evidence is attached and a later release gate explicitly allows the topology.");
    }
  }

  const releaseAllowed =
    managedDatabaseRuntimeBoundary.allowed &&
    !unsupportedStore &&
    !multiWriterIntent &&
    phase53MultiWriterTopologyGate.releaseAllowed &&
    phase55MultiWriterImplementationAuthorizationGate.releaseAllowed &&
    phase56MultiWriterRuntimeReadinessGate.releaseAllowed &&
    phase57MultiWriterImplementationScopeGate.releaseAllowed &&
    phase58MultiWriterRuntimeImplementationValidationGate.releaseAllowed &&
    (!managedIntent || effectivePhase52ManagedStartupSupported);
  const status: ReleaseReadinessStatus = releaseAllowed
    ? warnings.length > 0 || bypassed
      ? "warn"
      : "pass"
    : "fail";
  let summary: string;
  if (managedIntent && effectivePhase52ManagedStartupSupported) {
    summary = "Phase 52 managed Postgres startup support is asserted with Phase 50 adapter/backfill capability and Phase 51 migrated call-site evidence.";
  } else if (multiWriterIntent) {
    summary = phase58MultiWriterRuntimeImplementationValidationGate.runtimeImplementationValidationComplete
      ? "Phase 49 async-store boundary exists as foundation and Phase 58 runtime implementation validation evidence is attached, but multi-writer database runtime remains blocked."
      : phase57MultiWriterImplementationScopeGate.implementationScopeComplete
      ? "Phase 49 async-store boundary exists as foundation and Phase 57 implementation-scope evidence is attached, but multi-writer database runtime remains blocked."
      : phase56MultiWriterRuntimeReadinessGate.runtimeReadinessComplete
      ? "Phase 49 async-store boundary exists as foundation and Phase 56 runtime readiness/rollout-safety evidence is attached, but multi-writer database runtime remains blocked."
      : phase55MultiWriterImplementationAuthorizationGate.implementationAuthorized
      ? "Phase 49 async-store boundary exists as foundation and Phase 55 review/authorization evidence is attached, but multi-writer database runtime remains blocked."
      : phase53MultiWriterTopologyGate.designPackageEvidenceAttached
      ? "Phase 49 async-store boundary exists as foundation and Phase 54 design-package evidence is attached, but multi-writer database runtime remains blocked."
      : "Phase 49 async-store boundary exists as foundation, but multi-writer database topology remains blocked by the Phase 54 design-package gate.";
  } else if (managedIntent && phase50Capability.adapterAvailable) {
    summary = phase51Capability.runtimeCallSitesMigrated
      ? "Phase 50 async managed adapter/backfill capability is available and Phase 51 reports migrated call sites, but managed Postgres startup support is not asserted."
      : "Phase 50 async managed adapter/backfill capability is available, but Phase 51 runtime call-site migration remains incomplete and managed Postgres is not a full runtime support claim.";
  } else if (managedIntent || unsupportedStore) {
    summary = phase51Capability.runtimeCallSitesMigrated
      ? "Phase 49 async-store boundary exists as foundation, but managed Postgres remains unsupported until Phase 50 adapter evidence and startup support are explicitly available."
      : "Phase 49 async-store boundary exists as foundation, but managed Postgres remains unsupported until Phase 50 adapter evidence and Phase 51 call-site migration are both release-ready.";
  } else if (bypassed) {
    summary = "Phase 49 async-store boundary exists as foundation, but the managed database runtime bypass means this is not production support.";
  } else if (releaseAllowed) {
    summary = "Phase 49 async-store boundary exists as foundation; supported local JSON and single-node SQLite release postures remain allowed.";
  } else {
    summary = "Phase 49 async-store boundary exists as foundation, but inherited deployment blockers remain unresolved.";
  }

  return {
    phase: "49",
    status,
    foundationAvailable: true,
    releaseAllowed,
    managedPostgresSupported: effectivePhase52ManagedStartupSupported,
    phase52ManagedStartupSupported: effectivePhase52ManagedStartupSupported,
    managedDatabaseAdapterImplemented: phase50Capability.adapterAvailable,
    managedDatabaseRepositoriesImplemented: false,
    managedDatabaseBackfillAvailable: phase50Capability.backfillAvailable,
    managedDatabaseSyncStartupSupported: effectivePhase52ManagedStartupSupported,
    managedDatabaseRuntimeCallSiteMigrationTracked: phase51Capability.tracked,
    managedDatabaseRuntimeCallSitesMigrated: phase51Capability.runtimeCallSitesMigrated,
    managedDatabaseRemainingSyncCallSiteGroups: phase51Capability.remainingSyncCallSiteGroups,
    phase53MultiWriterTopologyGate,
    phase55MultiWriterImplementationAuthorizationGate,
    phase56MultiWriterRuntimeReadinessGate,
    phase57MultiWriterImplementationScopeGate,
    phase58MultiWriterRuntimeImplementationValidationGate,
    classification,
    summary,
    blockers,
    warnings,
    nextSteps: Array.from(nextSteps),
  };
}

function buildNextSteps(
  checks: ReleaseReadinessCheck[],
  storageTopology: StorageTopologyReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport,
  asyncStoreBoundary: AsyncStoreBoundaryReport,
): string[] {
  const steps = new Set<string>();

  for (const check of checks) {
    if (check.status === "pass") continue;
    if (check.id === "storage-topology") {
      for (const step of storageTopology.nextSteps) steps.add(step);
    }
    if (check.id === "managed-database-topology") {
      for (const step of managedDatabaseTopology.nextSteps) steps.add(step);
    }
    if (check.id === "managed-database-runtime-guard") {
      for (const step of managedDatabaseRuntimeGuard.nextSteps) steps.add(step);
    }
    if (check.id === "managed-database-runtime-boundary") {
      for (const step of managedDatabaseRuntimeBoundary.nextSteps) steps.add(step);
    }
    if (check.id === "async-store-boundary") {
      for (const step of asyncStoreBoundary.nextSteps) steps.add(step);
    }
    if (check.id === "backup-dir") {
      steps.add("Set TASKLOOM_BACKUP_DIR to a backed-up directory and verify it exists before release handoff.");
    }
    if (check.id === "restore-drill") {
      steps.add("Run and record a restore drill by setting TASKLOOM_RESTORE_DRILL_AT to the validation timestamp.");
    }
    if (check.id === "database-path") {
      steps.add("Set TASKLOOM_DB_PATH to an explicit persistent SQLite path for release deployments.");
    }
    if (check.id === "artifact-path") {
      steps.add("Set TASKLOOM_ARTIFACTS_PATH or TASKLOOM_ARTIFACT_DIR when durable generated artifacts are part of the release.");
    }
    if (check.id === "access-log-path") {
      steps.add("Set TASKLOOM_ACCESS_LOG_PATH to a writable persistent path when TASKLOOM_ACCESS_LOG_MODE=file.");
    }
  }

  if (steps.size === 0) {
    steps.add("Keep backup, restore-drill, and storage topology evidence attached to the release handoff.");
  }

  return Array.from(steps);
}

export function assessReleaseReadiness(input: ReleaseReadinessInput = {}): ReleaseReadinessReport {
  const env = input.env ?? {};
  const isGated = productionOrStrict(env, input.strict);
  const storageTopology =
    input.storageTopology ??
    (input.buildStorageTopologyReport ?? defaultBuildStorageTopologyReport)(env, input.probes);
  const managedDatabaseTopology =
    input.managedDatabaseTopology ??
    (input.buildManagedDatabaseTopologyReport ?? defaultBuildManagedDatabaseTopologyReport)(env);
  const managedDatabaseRuntimeGuard =
    input.managedDatabaseRuntimeGuard ??
    (input.buildManagedDatabaseRuntimeGuardReport ?? defaultBuildManagedDatabaseRuntimeGuardReport)(env);
  const managedDatabaseRuntimeBoundary =
    input.managedDatabaseRuntimeBoundary ??
    buildManagedDatabaseRuntimeBoundaryReport(
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
    );
  const asyncStoreBoundary =
    input.asyncStoreBoundary ??
    buildAsyncStoreBoundaryReport(
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary,
      env,
    );
  const checks: ReleaseReadinessCheck[] = [];

  pushCheck(
    checks,
    "storage-topology",
    storageCheckStatus(storageTopology, isGated),
    storageTopology.readyForProduction
      ? `Storage topology is release-ready: ${storageTopology.summary}`
      : `Storage topology is not production-ready: ${storageTopology.summary}`,
  );

  pushCheck(
    checks,
    "managed-database-topology",
    asyncStoreBoundary.phase52ManagedStartupSupported
      ? "pass"
      : managedTopologyCheckStatus(managedDatabaseTopology, isGated),
    asyncStoreBoundary.phase52ManagedStartupSupported
      ? `Managed database topology is release-ready with Phase 52 managed startup support: ${asyncStoreBoundary.summary}`
      : managedDatabaseTopology.ready
      ? `Managed database topology is release-ready: ${managedDatabaseTopology.summary}`
      : `Managed database topology is not release-ready: ${managedDatabaseTopology.summary}`,
  );

  pushCheck(
    checks,
    "managed-database-runtime-guard",
    asyncStoreBoundary.phase52ManagedStartupSupported
      ? "pass"
      : runtimeGuardCheckStatus(managedDatabaseRuntimeGuard, isGated),
    asyncStoreBoundary.phase52ManagedStartupSupported
      ? `Managed database runtime guard allows startup with Phase 52 managed startup support: ${asyncStoreBoundary.summary}`
      : managedDatabaseRuntimeGuard.allowed
      ? `Managed database runtime guard allows startup: ${managedDatabaseRuntimeGuard.summary}`
      : `Managed database runtime guard blocks startup: ${managedDatabaseRuntimeGuard.summary}`,
  );

  pushCheck(
    checks,
    "managed-database-runtime-boundary",
    boundaryCheckStatus(managedDatabaseRuntimeBoundary, isGated),
    managedDatabaseRuntimeBoundary.allowed
      ? `Managed database runtime boundary allows release: ${managedDatabaseRuntimeBoundary.summary}`
      : `Managed database runtime boundary blocks release: ${managedDatabaseRuntimeBoundary.summary}`,
  );

  pushCheck(
    checks,
    "async-store-boundary",
    asyncBoundaryCheckStatus(asyncStoreBoundary, isGated),
    asyncStoreBoundary.releaseAllowed
      ? `Async store boundary foundation allows current release posture: ${asyncStoreBoundary.summary}`
      : `Async store boundary foundation does not allow managed DB release: ${asyncStoreBoundary.summary}`,
  );

  const dbPath = clean(env.TASKLOOM_DB_PATH);
  if (storageTopology.mode === "sqlite") {
    pushCheck(
      checks,
      "database-path",
      dbPath ? "pass" : chooseBlockingStatus(isGated),
      dbPath
        ? `SQLite database path is explicitly configured at ${dbPath}.`
        : "SQLite release handoff requires an explicit TASKLOOM_DB_PATH on persistent storage.",
    );
  } else {
    pushCheck(
      checks,
      "database-path",
      chooseBlockingStatus(isGated),
      "Release handoff expects SQLite with an explicit persistent TASKLOOM_DB_PATH.",
    );
  }

  const backupDir = clean(env.TASKLOOM_BACKUP_DIR);
  if (!backupDir) {
    pushCheck(
      checks,
      "backup-dir",
      chooseBlockingStatus(isGated),
      "TASKLOOM_BACKUP_DIR is not configured for release handoff.",
    );
  } else {
    const exists = checkDirectory(input.probes, backupDir);
    pushCheck(
      checks,
      "backup-dir",
      exists === false ? chooseBlockingStatus(isGated) : "pass",
      exists === false
        ? `Backup directory does not exist at ${backupDir}.`
        : `Backup directory is configured at ${backupDir}${exists === true ? " and exists" : ""}.`,
    );
  }

  const restoreMarker = restoreDrillMarker(env);
  pushCheck(
    checks,
    "restore-drill",
    restoreMarker ? "pass" : chooseBlockingStatus(isGated),
    restoreMarker
      ? `Restore drill marker is recorded as ${restoreMarker}.`
      : "No restore drill marker was found; set TASKLOOM_RESTORE_DRILL_AT after validating a backup restore.",
  );

  const artifactsPath = artifactPath(env);
  if (!artifactsPath) {
    pushCheck(
      checks,
      "artifact-path",
      "warn",
      "No TASKLOOM_ARTIFACTS_PATH or TASKLOOM_ARTIFACT_DIR is configured; confirm artifacts are not release-critical.",
    );
  } else {
    const exists = checkDirectory(input.probes, artifactsPath);
    pushCheck(
      checks,
      "artifact-path",
      exists === false ? chooseBlockingStatus(isGated) : "pass",
      exists === false
        ? `Artifact directory does not exist at ${artifactsPath}.`
        : `Artifact directory is configured at ${artifactsPath}${exists === true ? " and exists" : ""}.`,
    );
  }

  const accessLogMode = normalize(env.TASKLOOM_ACCESS_LOG_MODE) || storageTopology.observed.accessLogMode;
  if (accessLogMode === "file") {
    const logDir = accessLogDirectory(env, storageTopology);
    if (!logDir) {
      pushCheck(
        checks,
        "access-log-path",
        chooseBlockingStatus(isGated),
        "TASKLOOM_ACCESS_LOG_MODE=file requires TASKLOOM_ACCESS_LOG_PATH for release handoff.",
      );
    } else {
      const exists = checkDirectory(input.probes, logDir);
      pushCheck(
        checks,
        "access-log-path",
        exists === false ? chooseBlockingStatus(isGated) : "pass",
        exists === false
          ? `Access log directory does not exist at ${logDir}.`
          : `Access log path is configured under ${logDir}${exists === true ? " and the directory exists" : ""}.`,
      );
    }
  } else {
    pushCheck(
      checks,
      "access-log-path",
      "pass",
      accessLogMode === "stdout"
        ? "Access logs are configured for stdout collection."
        : "File access logging is not enabled for this release handoff.",
    );
  }

  const blockers = checks.filter((check) => check.status === "fail").map((check) => check.summary);
  const warnings = Array.from(new Set([
    ...checks.filter((check) => check.status === "warn").map((check) => check.summary),
    ...storageTopology.warnings,
    ...managedDatabaseTopology.warnings,
    ...managedDatabaseRuntimeGuard.warnings,
    ...managedDatabaseRuntimeBoundary.warnings,
    ...asyncStoreBoundary.warnings,
  ]));
  const readyForRelease = blockers.length === 0;
  const summary = readyForRelease
    ? isGated
      ? "Phase 43 release readiness passed strict handoff gates."
      : "Phase 43 release readiness has no blocking issues for this local handoff."
    : "Phase 43 release readiness is blocked by deployment handoff checks.";

  return {
    phase: "43",
    readyForRelease,
    summary,
    checks,
    blockers,
    warnings,
    nextSteps: buildNextSteps(
      checks,
      storageTopology,
      managedDatabaseTopology,
      managedDatabaseRuntimeGuard,
      managedDatabaseRuntimeBoundary,
      asyncStoreBoundary,
    ),
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
    managedDatabaseRuntimeBoundary,
    asyncStoreBoundary,
  };
}

export function buildReleaseReadinessReport(
  env: ReleaseReadinessEnv = {},
  deps: ReleaseReadinessDeps = {},
): ReleaseReadinessReport {
  return assessReleaseReadiness({ env, ...deps });
}
