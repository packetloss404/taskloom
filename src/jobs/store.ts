import { randomUUID } from "node:crypto";
import { findJobIndexed, listJobsForWorkspaceIndexed, mutateStore, type AgentRecord, type JobRecord, type JobStatus, type TaskloomData } from "../taskloom-store.js";
import { nextAfter } from "./cron.js";

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

function isScheduledAgentRunJob(job: JobRecord, agentId: string): boolean {
  return job.type === "agent.run" && job.payload?.agentId === agentId && job.payload?.triggerKind === "schedule";
}

function activeSchedule(agent: AgentRecord): string | null {
  const schedule = agent.schedule?.trim();
  if (agent.status !== "active" || agent.triggerKind !== "schedule" || !schedule) return null;
  nextAfter(schedule, new Date());
  return schedule;
}

function cancelQueued(job: JobRecord, timestamp: string): void {
  job.status = "canceled";
  job.cancelRequested = true;
  job.completedAt = timestamp;
  job.updatedAt = timestamp;
}

function scheduledAgentPayload(agentId: string, payload?: Record<string, unknown>): Record<string, unknown> {
  return { ...(payload ?? {}), agentId, triggerKind: "schedule" };
}

function ensureScheduledAgentJob(
  data: TaskloomData,
  agent: AgentRecord,
  timestamp: string,
  scheduledAt?: string,
  payload?: Record<string, unknown>,
): JobRecord | null {
  let schedule: string | null = null;
  try { schedule = activeSchedule(agent); }
  catch { schedule = null; }

  const queued = data.jobs
    .filter((job) => job.status === "queued" && isScheduledAgentRunJob(job, agent.id))
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));

  if (!schedule) {
    for (const job of queued) cancelQueued(job, timestamp);
    return null;
  }

  const current = queued.filter((job) => job.cron === schedule);
  const stale = queued.filter((job) => job.cron !== schedule);
  for (const job of stale) cancelQueued(job, timestamp);
  for (const job of current.slice(1)) cancelQueued(job, timestamp);
  if (current[0]) return current[0];

  const record: JobRecord = {
    id: randomUUID(),
    workspaceId: agent.workspaceId,
    type: "agent.run",
    payload: scheduledAgentPayload(agent.id, payload),
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    cron: schedule,
    scheduledAt: scheduledAt ?? nextAfter(schedule, new Date()).toISOString(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.jobs.push(record);
  return record;
}

export function maintainScheduledAgentJobs(agentId?: string): JobRecord[] {
  const timestamp = nowIso();
  return mutateStore((data) => {
    const agents = agentId ? data.agents.filter((agent) => agent.id === agentId) : data.agents;
    const maintained: JobRecord[] = [];
    for (const agent of agents) {
      const job = ensureScheduledAgentJob(data, agent, timestamp);
      if (job) maintained.push(job);
    }
    return maintained;
  });
}

export function enqueueRecurringJob(job: JobRecord, scheduledAt: string): JobRecord | null {
  if (job.type === "agent.run" && job.payload?.triggerKind === "schedule" && typeof job.payload.agentId === "string") {
    return mutateStore((data) => {
      const agent = data.agents.find((entry) => entry.id === job.payload.agentId);
      if (!agent) return null;
      return ensureScheduledAgentJob(data, agent, nowIso(), scheduledAt, job.payload);
    });
  }

  return enqueueJob({
    workspaceId: job.workspaceId,
    type: job.type,
    payload: job.payload,
    cron: job.cron,
    scheduledAt,
    maxAttempts: job.maxAttempts,
  });
}

export function listJobs(
  workspaceId: string,
  opts: { status?: JobStatus; limit?: number } = {},
): JobRecord[] {
  return listJobsForWorkspaceIndexed(workspaceId, opts);
}

export function findJob(id: string): JobRecord | null {
  return findJobIndexed(id);
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
