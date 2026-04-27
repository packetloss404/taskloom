import { createJobMetricSnapshotsRepository, type JobMetricSnapshotsRepository } from "../repositories/job-metric-snapshots-repo.js";
import type { JobMetricSnapshotRecord, TaskloomData } from "../taskloom-store.js";

export interface ListJobMetricSnapshotsOptions {
  type?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export interface ListJobMetricSnapshotsDeps {
  loadStore?: () => TaskloomData;
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
  repository?: JobMetricSnapshotsRepository;
}

export function listJobMetricSnapshotsViaRepository(
  options: ListJobMetricSnapshotsOptions = {},
  deps: ListJobMetricSnapshotsDeps = {},
): JobMetricSnapshotRecord[] {
  const repo = deps.repository ?? createJobMetricSnapshotsRepository({
    loadStore: deps.loadStore,
    mutateStore: deps.mutateStore,
  });
  return repo.list(options);
}
