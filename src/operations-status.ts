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
    releaseReadiness,
    releaseEvidence,
    runtime: { nodeVersion: process.versions.node },
  };
}
