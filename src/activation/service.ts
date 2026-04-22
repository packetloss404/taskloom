import type {
  ActivationMilestoneRecord,
  ActivationSignalSnapshot,
  ActivationStatusDto,
  ActivationSubjectRef,
} from "./domain";
import { deriveChecklist } from "./checklist";
import { deriveStage, detectMilestones } from "./milestones";
import { calculateRisk } from "./risk";

export function deriveActivationStatus(
  subject: ActivationSubjectRef,
  snapshot: ActivationSignalSnapshot,
  priorMilestones: ReadonlyArray<ActivationMilestoneRecord> = [],
): ActivationStatusDto {
  const { stage } = deriveStage(snapshot);
  const milestones = detectMilestones(snapshot, priorMilestones);
  const checklist = deriveChecklist(snapshot);
  const risk = calculateRisk(snapshot, stage);

  return {
    subject,
    stage,
    risk,
    milestones,
    checklist,
  };
}
