import type { AlertEvent, AlertSeverity } from "./alert-engine.js";
import type { AlertEventRecord, TaskloomData } from "../taskloom-store.js";
import {
  loadStore as defaultLoadStore,
  mutateStore as defaultMutateStore,
} from "../taskloom-store.js";

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

export interface RecordAlertsOptions {
  retentionDays?: number;
  now?: () => Date;
}

export interface RecordAlertsDeps {
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
}

export interface RecordAlertsResult {
  stored: number;
  pruned: number;
}

export interface ListAlertsOptions {
  severity?: AlertSeverity;
  since?: string;
  until?: string;
  limit?: number;
}

export interface ListAlertsDeps {
  loadStore?: () => TaskloomData;
}

function ensureAlertCollection(data: TaskloomData): AlertEventRecord[] {
  if (!Array.isArray(data.alertEvents)) {
    data.alertEvents = [];
  }
  return data.alertEvents;
}

function toRecord(
  event: AlertEvent,
  deliveryOk: boolean,
  deliveryError: string | undefined,
  attemptedAt: string,
): AlertEventRecord {
  const record: AlertEventRecord = {
    id: event.id,
    ruleId: event.ruleId,
    severity: event.severity,
    title: event.title,
    detail: event.detail,
    observedAt: event.observedAt,
    context: event.context,
    delivered: deliveryOk,
    deliveryAttempts: 1,
    lastDeliveryAttemptAt: attemptedAt,
    deadLettered: false,
  };
  if (deliveryError !== undefined) {
    record.deliveryError = deliveryError;
  }
  return record;
}

export function recordAlerts(
  events: AlertEvent[],
  deliveryOk: boolean,
  deliveryError: string | undefined,
  options: RecordAlertsOptions = {},
  deps: RecordAlertsDeps = {},
): RecordAlertsResult {
  const mutate = deps.mutateStore ?? defaultMutateStore;
  const nowFn = options.now ?? (() => new Date());
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const attemptedAt = nowFn().toISOString();

  return mutate((data) => {
    const collection = ensureAlertCollection(data);
    const records = events.map((event) => toRecord(event, deliveryOk, deliveryError, attemptedAt));
    for (const record of records) {
      collection.push(record);
    }

    let pruned = 0;
    if (retentionDays > 0) {
      const cutoff = nowFn().getTime() - retentionDays * DAY_MS;
      const retained = collection.filter((entry) => Date.parse(entry.observedAt) >= cutoff);
      pruned = collection.length - retained.length;
      if (pruned > 0) {
        data.alertEvents = retained;
      }
    }

    return { stored: records.length, pruned };
  });
}

export interface UpdateAlertDeliveryStatusInput {
  alertId: string;
  delivered: boolean;
  deliveryError?: string;
  deadLettered?: boolean;
  attemptedAt: string;
}

export interface UpdateAlertDeliveryStatusDeps {
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
}

export function updateAlertDeliveryStatus(
  input: UpdateAlertDeliveryStatusInput,
  deps: UpdateAlertDeliveryStatusDeps = {},
): AlertEventRecord | null {
  const mutate = deps.mutateStore ?? defaultMutateStore;
  return mutate((data) => {
    const collection = ensureAlertCollection(data);
    const target = collection.find((entry) => entry.id === input.alertId);
    if (!target) return null;

    const previousAttempts = typeof target.deliveryAttempts === "number" ? target.deliveryAttempts : 0;
    target.deliveryAttempts = previousAttempts + 1;
    target.lastDeliveryAttemptAt = input.attemptedAt;
    target.delivered = input.delivered;

    if (input.deliveryError !== undefined) {
      target.deliveryError = input.deliveryError;
    } else if (input.delivered === true) {
      target.deliveryError = undefined;
    }

    if (input.deadLettered !== undefined) {
      target.deadLettered = input.deadLettered;
    }

    return { ...target };
  });
}

export function listAlerts(
  options: ListAlertsOptions = {},
  deps: ListAlertsDeps = {},
): AlertEventRecord[] {
  const load = deps.loadStore ?? defaultLoadStore;
  const data = load();
  const collection = Array.isArray(data.alertEvents) ? data.alertEvents : [];

  const sinceMs = options.since ? Date.parse(options.since) : null;
  const untilMs = options.until ? Date.parse(options.until) : null;

  const filtered = collection.filter((entry) => {
    if (options.severity !== undefined && entry.severity !== options.severity) return false;
    const observedMs = Date.parse(entry.observedAt);
    if (sinceMs !== null && !Number.isNaN(sinceMs) && observedMs < sinceMs) return false;
    if (untilMs !== null && !Number.isNaN(untilMs) && observedMs > untilMs) return false;
    return true;
  });

  filtered.sort((left, right) => right.observedAt.localeCompare(left.observedAt));

  const requestedLimit = options.limit ?? DEFAULT_LIST_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 0), MAX_LIST_LIMIT);
  return filtered.slice(0, limit);
}
