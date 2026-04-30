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

function buildAttachments(
  storageTopology: StorageTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
  managedDatabaseRuntimeBoundary: ManagedDatabaseRuntimeBoundaryReport,
  asyncStoreBoundary: AsyncStoreBoundaryReport,
  bundleReady: boolean,
): ReleaseEvidenceAttachment[] {
  const phase53Gate = phase53MultiWriterTopologyGate(asyncStoreBoundary);
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
        strictRelease: input.strict === true || truthy(env.TASKLOOM_RELEASE_STRICT) || truthy(env.TASKLOOM_STRICT_RELEASE),
        backupConfigured: configured(env.TASKLOOM_BACKUP_DIR),
        restoreDrillRecorded: restoreDrillRecorded(env),
        artifactPathConfigured: artifactPathConfigured(env),
        accessLogMode: storageTopology.observed.accessLogMode,
      },
    },
    attachments: buildAttachments(
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
