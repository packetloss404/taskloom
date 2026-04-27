import type { JobRecord } from "../taskloom-store.js";
import { claimNextJob, enqueueRecurringJob, findJob, maintainScheduledAgentJobs, sweepStaleRunningJobs, updateJob } from "./store.js";
import { nextAfter } from "./cron.js";
import { redactedErrorMessage } from "../security/redaction.js";
import type { SchedulerLeaderLock } from "./scheduler-lock.js";
import { noopLeaderLock } from "./scheduler-lock.js";
import { recordJobRun, type JobMetricStatus } from "./scheduler-metrics.js";
import { recordSchedulerStart, recordSchedulerStop, recordTickEnd, recordTickStart } from "./scheduler-heartbeat.js";
import { __setSchedulerLeaderProbe } from "../operations-status.js";

export interface JobHandlerContext {
  signal: AbortSignal;
}

export interface JobHandler {
  type: string;
  handle(job: JobRecord, ctx: JobHandlerContext): Promise<unknown>;
}

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CAP_MS = 60 * 60 * 1000;

function backoffMs(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt - 1), BACKOFF_CAP_MS);
}

export class JobScheduler {
  private handlers = new Map<string, JobHandler>();
  private polling = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = new Map<string, AbortController>();
  private pollIntervalMs: number;
  private cancelWatchMs: number;
  private leaderLock: SchedulerLeaderLock;

  constructor(opts: { pollIntervalMs?: number; cancelWatchMs?: number; leaderLock?: SchedulerLeaderLock } = {}) {
    this.pollIntervalMs = opts.pollIntervalMs ?? 1000;
    this.cancelWatchMs = opts.cancelWatchMs ?? 500;
    this.leaderLock = opts.leaderLock ?? noopLeaderLock();
  }

  register(handler: JobHandler): void {
    this.handlers.set(handler.type, handler);
  }

  start(): void {
    if (this.polling) return;
    this.polling = true;
    maintainScheduledAgentJobs();
    sweepStaleRunningJobs();
    __setSchedulerLeaderProbe(() => this.leaderLock.isHeld());
    recordSchedulerStart();
    this.scheduleNext(0);
  }

  async stop(): Promise<void> {
    this.polling = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    for (const ctrl of this.inFlight.values()) ctrl.abort();
    if (this.leaderLock.isHeld()) {
      try { await this.leaderLock.release(); } catch { /* ignore */ }
    }
    const cutoff = Date.now() + 30_000;
    while (this.inFlight.size > 0 && Date.now() < cutoff) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    __setSchedulerLeaderProbe(null);
    recordSchedulerStop();
  }

  private scheduleNext(ms: number): void {
    if (!this.polling) return;
    this.timer = setTimeout(() => { void this.tick(); }, ms);
  }

  private async tick(): Promise<void> {
    if (!this.polling) return;
    recordTickStart();
    try {
      try {
        const isLeader = await this.leaderLock.acquire();
        if (!isLeader) {
          this.scheduleNext(this.pollIntervalMs);
          return;
        }
        const job = await claimNextJob(new Date());
        if (job) {
          void this.runJob(job);
          this.scheduleNext(0);
          return;
        }
      } catch { /* ignore */ }
      this.scheduleNext(this.pollIntervalMs);
    } finally {
      recordTickEnd();
    }
  }

  private async runJob(job: JobRecord): Promise<void> {
    const handler = this.handlers.get(job.type);
    const ctrl = new AbortController();
    this.inFlight.set(job.id, ctrl);
    const cancelWatcher = setInterval(() => {
      const fresh = findJob(job.id);
      if (fresh?.cancelRequested) ctrl.abort();
    }, this.cancelWatchMs);
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const recordTerminal = (status: JobMetricStatus): void => {
      recordJobRun({
        type: job.type,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status,
      });
    };
    try {
      if (!handler) {
        recordTerminal("failed");
        updateJob(job.id, { status: "failed", error: `no handler registered for type "${job.type}"`, completedAt: new Date().toISOString() });
        return;
      }
      const result = await handler.handle(job, { signal: ctrl.signal });
      if (ctrl.signal.aborted) {
        recordTerminal("canceled");
        updateJob(job.id, { status: "canceled", completedAt: new Date().toISOString() });
        return;
      }
      recordTerminal("success");
      updateJob(job.id, { status: "success", result, completedAt: new Date().toISOString() });
      if (job.cron) {
        try {
          const next = nextAfter(job.cron, new Date());
          enqueueRecurringJob(job, next.toISOString());
        } catch { /* invalid cron => stop recurring */ }
      }
    } catch (error) {
      const fresh = findJob(job.id);
      if (fresh?.cancelRequested || ctrl.signal.aborted) {
        recordTerminal("canceled");
        updateJob(job.id, { status: "canceled", error: redactedErrorMessage(error), completedAt: new Date().toISOString() });
        return;
      }
      if (job.attempts < job.maxAttempts) {
        // retry path: do not record metrics; only terminal outcomes are tracked.
        const next = new Date(Date.now() + backoffMs(job.attempts));
        updateJob(job.id, { status: "queued", error: redactedErrorMessage(error), scheduledAt: next.toISOString(), startedAt: undefined });
      } else {
        recordTerminal("failed");
        updateJob(job.id, { status: "failed", error: redactedErrorMessage(error), completedAt: new Date().toISOString() });
      }
    } finally {
      clearInterval(cancelWatcher);
      this.inFlight.delete(job.id);
    }
  }
}
