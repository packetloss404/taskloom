import { createAlertEventsRepository, type AlertEventsRepository } from "../repositories/alert-events-repo.js";
import type { AlertEventRecord, TaskloomData } from "../taskloom-store.js";

export interface ListAlertsOptions {
  severity?: "info" | "warning" | "critical";
  since?: string;
  until?: string;
  limit?: number;
}

export interface ListAlertsDeps {
  loadStore?: () => TaskloomData;
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
  repository?: AlertEventsRepository;
}

export function listAlertsViaRepository(
  options: ListAlertsOptions = {},
  deps: ListAlertsDeps = {},
): AlertEventRecord[] {
  const repo = deps.repository ?? createAlertEventsRepository({
    loadStore: deps.loadStore,
    mutateStore: deps.mutateStore,
  });
  return repo.list(options);
}
