import type {
  ActivationMilestoneRecord,
  ActivationSignalSnapshot,
  ActivationStatusDto,
  ActivationSubjectRef,
} from "./domain";
import type {
  ActivationMilestoneRepository,
  ActivationSignalRepository,
  ActivationStatusReadModelRepository,
} from "./contracts";

function keyFor(subject: ActivationSubjectRef): string {
  return `${subject.workspaceId}:${subject.subjectType}:${subject.subjectId}`;
}

export class InMemoryActivationSignalRepository implements ActivationSignalRepository {
  private readonly snapshots = new Map<string, ActivationSignalSnapshot>();

  async loadSnapshot(subject: ActivationSubjectRef): Promise<ActivationSignalSnapshot> {
    const snapshot = this.snapshots.get(keyFor(subject));
    if (!snapshot) {
      throw new Error(`No activation snapshot found for ${keyFor(subject)}.`);
    }
    return snapshot;
  }

  setSnapshot(subject: ActivationSubjectRef, snapshot: ActivationSignalSnapshot): void {
    this.snapshots.set(keyFor(subject), snapshot);
  }
}

export class InMemoryActivationMilestoneRepository implements ActivationMilestoneRepository {
  private readonly milestones = new Map<string, ActivationMilestoneRecord[]>();

  async listForSubject(subject: ActivationSubjectRef): Promise<ActivationMilestoneRecord[]> {
    return this.milestones.get(keyFor(subject)) ?? [];
  }

  setForSubject(subject: ActivationSubjectRef, entries: ActivationMilestoneRecord[]): void {
    this.milestones.set(keyFor(subject), entries);
  }
}

export class InMemoryActivationStatusReadModelRepository implements ActivationStatusReadModelRepository {
  private readonly records = new Map<string, ActivationStatusDto>();

  async save(status: ActivationStatusDto): Promise<void> {
    this.records.set(keyFor(status.subject), status);
  }

  async load(subject: ActivationSubjectRef): Promise<ActivationStatusDto | null> {
    return this.records.get(keyFor(subject)) ?? null;
  }
}
