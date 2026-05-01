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
  ];

  return {
    generatedAt: checkedAt,
    overall: reduceOverall(subsystems),
    subsystems,
  };
}
