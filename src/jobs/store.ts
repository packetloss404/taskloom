import { randomUUID } from "node:crypto";
import { mutateStore, type JobRecord, type JobStatus } from "../taskloom-store.js";

const STALE_RUNNING_MS = 5 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

export interface EnqueueJobInput {
  workspaceId: string;
  type: string;
  payload?: Record<string, unknown>;
  scheduledAt?: string;
  cron?: string;
  maxAttempts?: number;
}

export function enqueueJob(input: EnqueueJobInput): JobRecord {
  const ts = nowIso();
  const record: JobRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    type: input.type,
    payload: input.payload ?? {},
    status: "queued",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    scheduledAt: input.scheduledAt ?? ts,
    ...(input.cron ? { cron: input.cron } : {}),
    createdAt: ts,
    updatedAt: ts,
  };
  return mutateStore((data) => {
    data.jobs.push(record);
    return record;
  });
}

export function listJobs(
  workspaceId: string,
  opts: { status?: JobStatus; limit?: number } = {},
): JobRecord[] {
  return mutateStore((data) => {
    let entries = data.jobs.filter((j) => j.workspaceId === workspaceId);
    if (opts.status) entries = entries.filter((j) => j.status === opts.status);
    entries = entries.slice().reverse();
    if (opts.limit) entries = entries.slice(0, opts.limit);
    return entries;
  });
}

export function findJob(id: string): JobRecord | null {
  return mutateStore((data) => data.jobs.find((j) => j.id === id) ?? null);
}

export function updateJob(id: string, patch: Partial<JobRecord>): JobRecord | null {
  return mutateStore((data) => {
    const job = data.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, patch, { updatedAt: nowIso() });
    return job;
  });
}

export function cancelJob(id: string): JobRecord | null {
  return mutateStore((data) => {
    const job = data.jobs.find((j) => j.id === id);
    if (!job) return null;
    job.cancelRequested = true;
    job.updatedAt = nowIso();
    if (job.status === "queued") {
      job.status = "canceled";
      job.completedAt = job.updatedAt;
    }
    return job;
  });
}

let claimMutex: Promise<unknown> = Promise.resolve();

export async function claimNextJob(now: Date): Promise<JobRecord | null> {
  const previous = claimMutex;
  let release!: () => void;
  claimMutex = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return mutateStore((data) => {
      const candidate = data.jobs
        .filter((j) => j.status === "queued" && Date.parse(j.scheduledAt) <= now.getTime())
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
      if (!candidate) return null;
      candidate.status = "running";
      candidate.attempts += 1;
      candidate.startedAt = nowIso();
      candidate.updatedAt = candidate.startedAt;
      return candidate;
    });
  } finally {
    release();
  }
}

export function sweepStaleRunningJobs(): number {
  return mutateStore((data) => {
    const cutoff = Date.now() - STALE_RUNNING_MS;
    let count = 0;
    for (const job of data.jobs) {
      if (job.status === "running" && job.startedAt && Date.parse(job.startedAt) < cutoff) {
        job.status = "queued";
        job.updatedAt = nowIso();
        delete job.startedAt;
        count++;
      }
    }
    return count;
  });
}
