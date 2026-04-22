import {
  ACTIVATION_CHECKLIST_ORDER,
  type ActivationChecklistItem,
  type ActivationChecklistItemKey,
  type ActivationSignalSnapshot,
} from "./domain";

export function deriveChecklist(
  input: ActivationSignalSnapshot,
  now: string = input.now,
): ActivationChecklistItem[] {
  return ACTIVATION_CHECKLIST_ORDER.map((key) => deriveSingleChecklistItem(key, input, now));
}

function deriveSingleChecklistItem(
  key: ActivationChecklistItemKey,
  input: ActivationSignalSnapshot,
  now: string,
): ActivationChecklistItem {
  switch (key) {
    case "brief_captured":
      return item(key, input.hasBrief, now, "Brief has been captured.");
    case "requirements_defined":
      return item(
        key,
        input.hasRequirements && input.hasPlan,
        now,
        "Requirements and implementation plan exist.",
      );
    case "implementation_started":
      return item(
        key,
        Boolean(input.startedAt) || input.hasImplementation,
        now,
        "Implementation has started.",
      );
    case "validation_completed":
      return item(
        key,
        input.hasValidationEvidence && input.hasTests,
        now,
        "Validation evidence and tests exist.",
      );
    case "release_confirmed":
      return item(
        key,
        Boolean(input.releasedAt) || input.hasReleaseEvidence,
        now,
        "Release has been confirmed.",
      );
  }
}

function item(
  key: ActivationChecklistItemKey,
  completed: boolean,
  now: string,
  reason: string,
): ActivationChecklistItem {
  return {
    key,
    completed,
    completedAt: completed ? now : undefined,
    reason,
  };
}
