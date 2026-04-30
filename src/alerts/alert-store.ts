import type { AlertEvent, AlertSeverity } from "./alert-engine.js";
import type { AlertEventRecord, TaskloomData } from "../taskloom-store.js";
import {
  loadStore as defaultLoadStore,
  loadStoreAsync as defaultLoadStoreAsync,
  mutateStore as defaultMutateStore,
  mutateStoreAsync as defaultMutateStoreAsync,
} from "../taskloom-store.js";
// Phase 33B: read path delegated to repository wrapper.
import { listAlertsViaRepository } from "./alert-store-read.js";
// Phase 33C: dedicated alert_events table dual-write.
import { createAlertEventsRepository, createAsyncAlertEventsRepository } from "../repositories/alert-events-repo.js";

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 30;

export interface RecordAlertsOptions {
  retentionDays?: number;
  now?: () => Date;
}

export interface RecordAlertsDeps {
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
}

export interface RecordAlertsAsyncDeps {
  mutateStore?: <T>(mutator: (data: TaskloomData) => T | Promise<T>) => Promise<T>;
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

export interface ListAlertsAsyncDeps {
  loadStore?: () => Promise<TaskloomData>;
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

  const outcome = mutate((data) => {
    const collection = ensureAlertCollection(data);
    const records = events.map((event) => toRecord(event, deliveryOk, deliveryError, attemptedAt));
    for (const record of records) {
      collection.push(record);
    }

    let pruned = 0;
    let retainAfterIso: string | null = null;
    if (retentionDays > 0) {
      const cutoff = nowFn().getTime() - retentionDays * DAY_MS;
      retainAfterIso = new Date(cutoff).toISOString();
      const retained = collection.filter((entry) => Date.parse(entry.observedAt) >= cutoff);
      pruned = collection.length - retained.length;
      if (pruned > 0) {
        data.alertEvents = retained;
      }
    }

    return { stored: records.length, pruned, records, retainAfterIso };
  });

  if (process.env.TASKLOOM_STORE === "sqlite") {
    const repo = createAlertEventsRepository({});
    if (outcome.records.length > 0) {
      repo.insertMany(outcome.records);
    }
    if (outcome.retainAfterIso !== null) {
      repo.prune(outcome.retainAfterIso);
    }
  }

  return { stored: outcome.stored, pruned: outcome.pruned };
}

export async function recordAlertsAsync(
  events: AlertEvent[],
  deliveryOk: boolean,
  deliveryError: string | undefined,
  options: RecordAlertsOptions = {},
  deps: RecordAlertsAsyncDeps = {},
): Promise<RecordAlertsResult> {
  const mutate = deps.mutateStore ?? defaultMutateStoreAsync;
  const nowFn = options.now ?? (() => new Date());
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const attemptedAt = nowFn().toISOString();

  const outcome = await mutate((data) => {
    const collection = ensureAlertCollection(data);
    const records = events.map((event) => toRecord(event, deliveryOk, deliveryError, attemptedAt));
    for (const record of records) {
      collection.push(record);
    }

    let pruned = 0;
    let retainAfterIso: string | null = null;
    if (retentionDays > 0) {
      const cutoff = nowFn().getTime() - retentionDays * DAY_MS;
      retainAfterIso = new Date(cutoff).toISOString();
      const retained = collection.filter((entry) => Date.parse(entry.observedAt) >= cutoff);
      pruned = collection.length - retained.length;
      if (pruned > 0) {
        data.alertEvents = retained;
      }
    }

    return { stored: records.length, pruned, records, retainAfterIso };
  });

  if (process.env.TASKLOOM_STORE === "sqlite") {
    const repo = createAlertEventsRepository({});
    if (outcome.records.length > 0) {
      repo.insertMany(outcome.records);
    }
    if (outcome.retainAfterIso !== null) {
      repo.prune(outcome.retainAfterIso);
    }
  }

  return { stored: outcome.stored, pruned: outcome.pruned };
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

export interface UpdateAlertDeliveryStatusAsyncDeps {
  mutateStore?: <T>(mutator: (data: TaskloomData) => T | Promise<T>) => Promise<T>;
}

export function updateAlertDeliveryStatus(
  input: UpdateAlertDeliveryStatusInput,
  deps: UpdateAlertDeliveryStatusDeps = {},
): AlertEventRecord | null {
  const mutate = deps.mutateStore ?? defaultMutateStore;
  const updated = mutate((data) => {
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

  if (updated && process.env.TASKLOOM_STORE === "sqlite") {
    const repo = createAlertEventsRepository({});
    const patch: {
      delivered: boolean;
      attemptedAt: string;
      deliveryError?: string;
      deadLettered?: boolean;
    } = {
      delivered: input.delivered,
      attemptedAt: input.attemptedAt,
    };
    if (input.deliveryError !== undefined) {
      patch.deliveryError = input.deliveryError;
    }
    if (input.deadLettered !== undefined) {
      patch.deadLettered = input.deadLettered;
    }
    repo.updateDeliveryStatus(input.alertId, patch);
  }

  return updated;
}

export async function updateAlertDeliveryStatusAsync(
  input: UpdateAlertDeliveryStatusInput,
  deps: UpdateAlertDeliveryStatusAsyncDeps = {},
): Promise<AlertEventRecord | null> {
  const mutate = deps.mutateStore ?? defaultMutateStoreAsync;
  const updated = await mutate((data) => {
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

  if (updated && process.env.TASKLOOM_STORE === "sqlite") {
    const repo = createAlertEventsRepository({});
    const patch: {
      delivered: boolean;
      attemptedAt: string;
      deliveryError?: string;
      deadLettered?: boolean;
    } = {
      delivered: input.delivered,
      attemptedAt: input.attemptedAt,
    };
    if (input.deliveryError !== undefined) {
      patch.deliveryError = input.deliveryError;
    }
    if (input.deadLettered !== undefined) {
      patch.deadLettered = input.deadLettered;
    }
    repo.updateDeliveryStatus(input.alertId, patch);
  }

  return updated;
}

export function listAlerts(
  options: ListAlertsOptions = {},
  deps: ListAlertsDeps = {},
): AlertEventRecord[] {
  return listAlertsViaRepository(options, { loadStore: deps.loadStore });
}

export async function listAlertsAsync(
  options: ListAlertsOptions = {},
  deps: ListAlertsAsyncDeps = {},
): Promise<AlertEventRecord[]> {
  const repository = createAsyncAlertEventsRepository({
    loadStore: deps.loadStore ?? defaultLoadStoreAsync,
    mutateStore: defaultMutateStoreAsync,
  });
  return repository.list(options);
}
