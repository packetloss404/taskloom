import type {
  ActivationMilestoneRecord,
  ActivationSignalSnapshot,
  ActivationStatusDto,
  ActivationSubjectRef,
} from "./domain";

export interface ActivationSignalRepository {
  loadSnapshot(subject: ActivationSubjectRef): Promise<ActivationSignalSnapshot>;
}

export interface ActivationMilestoneRepository {
  listForSubject(subject: ActivationSubjectRef): Promise<ActivationMilestoneRecord[]>;
}

export interface ActivationStatusReadModelRepository {
  save(status: ActivationStatusDto): Promise<void>;
  load(subject: ActivationSubjectRef): Promise<ActivationStatusDto | null>;
}

export interface GetActivationStatusDeps {
  signals: ActivationSignalRepository;
  milestones: ActivationMilestoneRepository;
  derive: (
    subject: ActivationSubjectRef,
    snapshot: ActivationSignalSnapshot,
    priorMilestones: ReadonlyArray<ActivationMilestoneRecord>,
  ) => ActivationStatusDto;
}

export interface GetActivationStatusInput {
  subject: ActivationSubjectRef;
}

export async function getActivationStatus(
  deps: GetActivationStatusDeps,
  input: GetActivationStatusInput,
): Promise<ActivationStatusDto> {
  const [snapshot, priorMilestones] = await Promise.all([
    deps.signals.loadSnapshot(input.subject),
    deps.milestones.listForSubject(input.subject),
  ]);

  return deps.derive(input.subject, snapshot, priorMilestones);
}

export const PR1B_EXCLUDES = [
  "database clients or vendor-specific repositories",
  "HTTP route handlers or transport-layer DTO wrappers",
  "cached activation persistence or backfill jobs",
  "UI copy, wizard steps, or host-surface components",
  "authn/authz policy enforcement beyond passing a subject reference",
] as const;

export interface ReadActivationStatusApiInput {
  subject: ActivationSubjectRef;
}

export interface ReadActivationStatusApiResult {
  ok: true;
  status: ActivationStatusDto;
}
