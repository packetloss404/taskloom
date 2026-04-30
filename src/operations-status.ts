import type { TaskloomData } from "./taskloom-store.js";
import { loadStore as defaultLoadStore } from "./taskloom-store.js";
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
    releaseReadiness,
    releaseEvidence,
    runtime: { nodeVersion: process.versions.node },
  };
}
