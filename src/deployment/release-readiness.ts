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
  classification: AsyncStoreBoundaryClassification;
  summary: string;
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
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
    nextSteps.add("Keep multi-writer or managed database topology out of strict release until the runtime boundary supports it.");
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
    summary = "Phase 48 managed database runtime boundary blocks multi-writer or managed topology until runtime support exists.";
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
    nextSteps.add("Keep multi-writer database topology blocked until managed runtime coordination exists.");
  }

  const releaseAllowed =
    managedDatabaseRuntimeBoundary.allowed &&
    !unsupportedStore &&
    !multiWriterIntent &&
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
    summary = "Phase 49 async-store boundary exists as foundation, but multi-writer database topology remains unsupported until managed runtime coordination lands.";
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
