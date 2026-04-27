import { evaluateAlerts, type AlertEvent } from "./alert-engine.js";
import {
  deliverAlertWebhook,
  resolveAlertWebhookConfig,
  type AlertWebhookConfig,
} from "./alert-webhook.js";
import { recordAlerts } from "./alert-store.js";
import { getOperationsHealth, type OperationsHealthReport } from "../operations-health.js";
import { getJobTypeMetrics, type JobTypeMetrics } from "../jobs/scheduler-metrics.js";
import { enqueueJob, type EnqueueJobInput } from "../jobs/store.js";
import { nextAfter } from "../jobs/cron.js";
import { loadStore as defaultLoadStore, type JobRecord, type TaskloomData } from "../taskloom-store.js";

export const ALERTS_EVALUATE_JOB_TYPE = "alerts.evaluate" as const;

export const ALERT_JOB_FAILURE_RATE_THRESHOLD_ENV = "TASKLOOM_ALERT_JOB_FAILURE_RATE_THRESHOLD";
export const ALERT_JOB_FAILURE_MIN_SAMPLES_ENV = "TASKLOOM_ALERT_JOB_FAILURE_MIN_SAMPLES";
export const ALERT_EVALUATE_CRON_ENV = "TASKLOOM_ALERT_EVALUATE_CRON";
export const ALERT_RETENTION_DAYS_ENV = "TASKLOOM_ALERT_RETENTION_DAYS";
export const ALERT_WORKSPACE_ID_ENV = "TASKLOOM_ALERT_WORKSPACE_ID";
export const ALERT_DELIVER_MAX_ATTEMPTS_ENV = "TASKLOOM_ALERT_DELIVER_MAX_ATTEMPTS";
export const ALERTS_DELIVER_JOB_TYPE = "alerts.deliver" as const;

const DEFAULT_JOB_FAILURE_RATE_THRESHOLD = 0.5;
const DEFAULT_JOB_FAILURE_MIN_SAMPLES = 5;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_WORKSPACE_ID = "__system__";
const DEFAULT_DELIVER_MAX_ATTEMPTS = 3;
const ACTIVE_RECURRING_STATUSES = new Set(["queued", "running", "success"]);

export interface AlertsEvaluateJobPayload {
  retentionDays?: number;
  jobFailureRateThreshold?: number;
  jobFailureMinSamples?: number;
}

export interface AlertsEvaluateJobResult {
  evaluatedAt: string;
  eventCount: number;
  delivered: boolean;
  deliveryError?: string;
  storedCount: number;
  pruned: number;
  enqueuedDeliverJobs: number;
}

export interface AlertsEvaluateHandlerDeps {
  evaluate?: typeof evaluateAlerts;
  health?: () => OperationsHealthReport;
  metrics?: () => JobTypeMetrics[];
  webhookConfig?: () => AlertWebhookConfig | null;
  deliver?: typeof deliverAlertWebhook;
  record?: typeof recordAlerts;
  enqueueDeliverJob?: (input: EnqueueJobInput) => JobRecord;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
}

export interface EnsureAlertsCronJobDeps {
  env?: NodeJS.ProcessEnv;
  loadStore?: () => TaskloomData;
  enqueue?: (input: EnqueueJobInput) => JobRecord;
}

export interface EnsureAlertsCronJobResult {
  action: "skipped" | "exists" | "enqueued";
  jobId?: string;
}

function readNumberFromEnv(env: NodeJS.ProcessEnv, key: string): number | undefined {
  const raw = env[key];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseRetentionFromEnv(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_RETENTION_DAYS;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return DEFAULT_RETENTION_DAYS;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_RETENTION_DAYS;
  return parsed;
}

function parseDeliverMaxAttemptsFromEnv(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_DELIVER_MAX_ATTEMPTS;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return DEFAULT_DELIVER_MAX_ATTEMPTS;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_DELIVER_MAX_ATTEMPTS;
  return parsed;
}

export async function handleAlertsEvaluateJob(
  payload: AlertsEvaluateJobPayload,
  deps: AlertsEvaluateHandlerDeps = {},
): Promise<AlertsEvaluateJobResult> {
  const evaluate = deps.evaluate ?? evaluateAlerts;
  const healthFn = deps.health ?? getOperationsHealth;
  const metricsFn = deps.metrics ?? getJobTypeMetrics;
  const webhookConfigFn = deps.webhookConfig ?? (() => resolveAlertWebhookConfig());
  const deliverFn = deps.deliver ?? deliverAlertWebhook;
  const recordFn = deps.record ?? recordAlerts;
  const enqueueDeliverFn = deps.enqueueDeliverJob ?? enqueueJob;
  const env = deps.env ?? process.env;
  const nowFn = deps.now ?? (() => new Date());

  const evaluatedAt = nowFn().toISOString();

  const jobFailureRateThreshold =
    payload.jobFailureRateThreshold ??
    readNumberFromEnv(env, ALERT_JOB_FAILURE_RATE_THRESHOLD_ENV) ??
    DEFAULT_JOB_FAILURE_RATE_THRESHOLD;
  const jobFailureMinSamples =
    payload.jobFailureMinSamples ??
    readNumberFromEnv(env, ALERT_JOB_FAILURE_MIN_SAMPLES_ENV) ??
    DEFAULT_JOB_FAILURE_MIN_SAMPLES;
  const retentionDays = payload.retentionDays ?? parseRetentionFromEnv(env[ALERT_RETENTION_DAYS_ENV]);

  const events: AlertEvent[] = evaluate({
    health: healthFn(),
    metrics: metricsFn(),
    jobFailureRateThreshold,
    jobFailureMinSamples,
  });

  let delivered = true;
  let deliveryError: string | undefined;

  if (events.length > 0) {
    const config = webhookConfigFn();
    if (config === null) {
      delivered = true;
      deliveryError = "webhook not configured";
    } else {
      const result = await deliverFn(config, events);
      delivered = result.ok;
      deliveryError = result.error;
    }
  }

  const recordResult = recordFn(events, delivered, deliveryError, { retentionDays });

  let enqueuedDeliverJobs = 0;
  if (delivered === false && events.length > 0) {
    const configuredMax = parseDeliverMaxAttemptsFromEnv(env[ALERT_DELIVER_MAX_ATTEMPTS_ENV]);
    const retryMaxAttempts = Math.max(1, configuredMax - 1);
    const workspaceId = env[ALERT_WORKSPACE_ID_ENV]?.trim() || DEFAULT_WORKSPACE_ID;
    const scheduledAt = nowFn().toISOString();
    for (const event of events) {
      enqueueDeliverFn({
        workspaceId,
        type: ALERTS_DELIVER_JOB_TYPE,
        payload: { alertId: event.id },
        maxAttempts: retryMaxAttempts,
        scheduledAt,
      });
      enqueuedDeliverJobs += 1;
    }
  }

  const result: AlertsEvaluateJobResult = {
    evaluatedAt,
    eventCount: events.length,
    delivered,
    storedCount: recordResult.stored,
    pruned: recordResult.pruned,
    enqueuedDeliverJobs,
  };
  if (deliveryError !== undefined) {
    result.deliveryError = deliveryError;
  }
  return result;
}

export function ensureAlertsCronJob(
  deps: EnsureAlertsCronJobDeps = {},
): EnsureAlertsCronJobResult {
  const env = deps.env ?? process.env;
  const loadStore = deps.loadStore ?? defaultLoadStore;
  const enqueue = deps.enqueue ?? enqueueJob;

  const cron = env[ALERT_EVALUATE_CRON_ENV]?.trim();
  if (!cron) return { action: "skipped" };

  let firstRun: Date;
  try {
    firstRun = nextAfter(cron, new Date());
  } catch (error) {
    console.warn(
      `alerts.evaluate: invalid ${ALERT_EVALUATE_CRON_ENV} expression ${JSON.stringify(cron)}; skipping bootstrap (${(error as Error).message})`,
    );
    return { action: "skipped" };
  }

  const data = loadStore();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const existing = jobs.find(
    (job) =>
      job.type === ALERTS_EVALUATE_JOB_TYPE &&
      job.cron === cron &&
      ACTIVE_RECURRING_STATUSES.has(job.status),
  );
  if (existing) return { action: "exists", jobId: existing.id };

  const workspaceId = env[ALERT_WORKSPACE_ID_ENV]?.trim() || DEFAULT_WORKSPACE_ID;
  const retentionDays = parseRetentionFromEnv(env[ALERT_RETENTION_DAYS_ENV]);

  const created = enqueue({
    workspaceId,
    type: ALERTS_EVALUATE_JOB_TYPE,
    payload: { retentionDays },
    cron,
    scheduledAt: firstRun.toISOString(),
  });

  return { action: "enqueued", jobId: created.id };
}
