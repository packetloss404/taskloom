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
}

export interface ReleaseReadinessDeps {
  probes?: StorageTopologyProbeDeps;
  storageTopology?: StorageTopologyReport;
  managedDatabaseTopology?: ManagedDatabaseTopologyReport;
  managedDatabaseRuntimeGuard?: ManagedDatabaseRuntimeGuardReport;
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

function buildNextSteps(
  checks: ReleaseReadinessCheck[],
  storageTopology: StorageTopologyReport,
  managedDatabaseTopology: ManagedDatabaseTopologyReport,
  managedDatabaseRuntimeGuard: ManagedDatabaseRuntimeGuardReport,
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
    managedTopologyCheckStatus(managedDatabaseTopology, isGated),
    managedDatabaseTopology.ready
      ? `Managed database topology is release-ready: ${managedDatabaseTopology.summary}`
      : `Managed database topology is not release-ready: ${managedDatabaseTopology.summary}`,
  );

  pushCheck(
    checks,
    "managed-database-runtime-guard",
    runtimeGuardCheckStatus(managedDatabaseRuntimeGuard, isGated),
    managedDatabaseRuntimeGuard.allowed
      ? `Managed database runtime guard allows startup: ${managedDatabaseRuntimeGuard.summary}`
      : `Managed database runtime guard blocks startup: ${managedDatabaseRuntimeGuard.summary}`,
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
  const warnings = [
    ...checks.filter((check) => check.status === "warn").map((check) => check.summary),
    ...storageTopology.warnings,
    ...managedDatabaseTopology.warnings,
    ...managedDatabaseRuntimeGuard.warnings,
  ];
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
    ),
    storageTopology,
    managedDatabaseTopology,
    managedDatabaseRuntimeGuard,
  };
}

export function buildReleaseReadinessReport(
  env: ReleaseReadinessEnv = {},
  deps: ReleaseReadinessDeps = {},
): ReleaseReadinessReport {
  return assessReleaseReadiness({ env, ...deps });
}
