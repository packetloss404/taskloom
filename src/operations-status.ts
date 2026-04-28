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
    store: { mode: resolveStoreMode(env) },
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
    releaseReadiness,
    releaseEvidence,
    runtime: { nodeVersion: process.versions.node },
  };
}
