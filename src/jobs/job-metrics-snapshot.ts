import { randomUUID } from "node:crypto";
import type { JobMetricSnapshotRecord, TaskloomData } from "../taskloom-store.js";
import { loadStore as defaultLoadStore, mutateStore as defaultMutateStore } from "../taskloom-store.js";
import { getJobTypeMetrics, type JobTypeMetrics } from "./scheduler-metrics.js";

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

export interface SnapshotJobMetricsResult {
  command: "snapshot-job-metrics";
  capturedAt: string;
  snapshots: JobMetricSnapshotRecord[];
  removed: number;
}

export interface SnapshotJobMetricsOptions {
  retentionDays?: number;
}

export interface SnapshotJobMetricsDeps {
  loadStore?: () => TaskloomData;
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
  jobTypeMetrics?: () => JobTypeMetrics[];
  now?: () => Date;
  generateId?: () => string;
}

export interface ListJobMetricSnapshotsOptions {
  type?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export interface ListJobMetricSnapshotsDeps {
  loadStore?: () => TaskloomData;
}

export interface PruneJobMetricSnapshotsOptions {
  retentionDays: number;
}

export interface PruneJobMetricSnapshotsResult {
  removed: number;
}

export interface PruneJobMetricSnapshotsDeps {
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
  now?: () => Date;
}

function ensureSnapshotCollection(data: TaskloomData): JobMetricSnapshotRecord[] {
  if (!Array.isArray(data.jobMetricSnapshots)) {
    data.jobMetricSnapshots = [];
  }
  return data.jobMetricSnapshots;
}

function buildSnapshot(metric: JobTypeMetrics, capturedAt: string, id: string): JobMetricSnapshotRecord {
  return {
    id,
    capturedAt,
    type: metric.type,
    totalRuns: metric.totalRuns,
    succeededRuns: metric.succeededRuns,
    failedRuns: metric.failedRuns,
    canceledRuns: metric.canceledRuns,
    lastRunStartedAt: metric.lastRunStartedAt,
    lastRunFinishedAt: metric.lastRunFinishedAt,
    lastDurationMs: metric.lastDurationMs,
    averageDurationMs: metric.averageDurationMs,
    p95DurationMs: metric.p95DurationMs,
  };
}

export function snapshotJobMetrics(
  options: SnapshotJobMetricsOptions = {},
  deps: SnapshotJobMetricsDeps = {},
): SnapshotJobMetricsResult {
  const mutate = deps.mutateStore ?? defaultMutateStore;
  const metricsSource = deps.jobTypeMetrics ?? getJobTypeMetrics;
  const nowFn = deps.now ?? (() => new Date());
  const generateId = deps.generateId ?? (() => randomUUID());
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;

  const now = nowFn();
  const capturedAt = now.toISOString();
  const metrics = metricsSource();

  return mutate((data) => {
    const collection = ensureSnapshotCollection(data);
    const snapshots: JobMetricSnapshotRecord[] = metrics.map((metric) => buildSnapshot(metric, capturedAt, generateId()));
    for (const snapshot of snapshots) {
      collection.push(snapshot);
    }

    let removed = 0;
    if (retentionDays > 0) {
      const cutoff = now.getTime() - retentionDays * DAY_MS;
      const retained = collection.filter((entry) => Date.parse(entry.capturedAt) >= cutoff);
      removed = collection.length - retained.length;
      if (removed > 0) {
        data.jobMetricSnapshots = retained;
      }
    }

    return {
      command: "snapshot-job-metrics" as const,
      capturedAt,
      snapshots,
      removed,
    };
  });
}

export function listJobMetricSnapshots(
  options: ListJobMetricSnapshotsOptions = {},
  deps: ListJobMetricSnapshotsDeps = {},
): JobMetricSnapshotRecord[] {
  const load = deps.loadStore ?? defaultLoadStore;
  const data = load();
  const collection = Array.isArray(data.jobMetricSnapshots) ? data.jobMetricSnapshots : [];

  const sinceMs = options.since ? Date.parse(options.since) : null;
  const untilMs = options.until ? Date.parse(options.until) : null;

  const filtered = collection.filter((entry) => {
    if (options.type !== undefined && entry.type !== options.type) return false;
    const capturedMs = Date.parse(entry.capturedAt);
    if (sinceMs !== null && !Number.isNaN(sinceMs) && capturedMs < sinceMs) return false;
    if (untilMs !== null && !Number.isNaN(untilMs) && capturedMs > untilMs) return false;
    return true;
  });

  filtered.sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));

  const requestedLimit = options.limit ?? DEFAULT_LIST_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 0), MAX_LIST_LIMIT);
  return filtered.slice(0, limit);
}

export function pruneJobMetricSnapshots(
  options: PruneJobMetricSnapshotsOptions,
  deps: PruneJobMetricSnapshotsDeps = {},
): PruneJobMetricSnapshotsResult {
  if (options.retentionDays === 0) {
    return { removed: 0 };
  }

  const mutate = deps.mutateStore ?? defaultMutateStore;
  const nowFn = deps.now ?? (() => new Date());
  const cutoff = nowFn().getTime() - options.retentionDays * DAY_MS;

  return mutate((data) => {
    const collection = ensureSnapshotCollection(data);
    const retained = collection.filter((entry) => Date.parse(entry.capturedAt) >= cutoff);
    const removed = collection.length - retained.length;
    if (removed > 0) {
      data.jobMetricSnapshots = retained;
    }
    return { removed };
  });
}
