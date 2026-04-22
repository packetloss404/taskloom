export type ActivationStage =
  | "not_started"
  | "discovery"
  | "definition"
  | "implementation"
  | "validation"
  | "complete"
  | "blocked";

export type ActivationRiskLevel = "low" | "medium" | "high";

export type ActivationMilestoneKey =
  | "intake_ready"
  | "scope_defined"
  | "build_started"
  | "build_complete"
  | "validated"
  | "released"
  | "blocked";

export type ActivationChecklistItemKey =
  | "brief_captured"
  | "requirements_defined"
  | "implementation_started"
  | "validation_completed"
  | "release_confirmed";

export interface ActivationSubjectRef {
  workspaceId: string;
  subjectType: string;
  subjectId: string;
}

export interface ActivationSignalSnapshot {
  now: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  releasedAt?: string;
  hasBrief: boolean;
  hasRequirements: boolean;
  hasPlan: boolean;
  hasImplementation: boolean;
  hasTests: boolean;
  hasValidationEvidence: boolean;
  hasReleaseEvidence: boolean;
  blockerCount: number;
  dependencyBlockerCount: number;
  openQuestionCount: number;
  criticalIssueCount: number;
  scopeChangeCount: number;
  failedValidationCount: number;
  retryCount: number;
}

export interface ActivationMilestoneRecord {
  key: ActivationMilestoneKey;
  reached: boolean;
  reachedAt?: string;
  reason: string;
}

export interface ActivationChecklistItem {
  key: ActivationChecklistItemKey;
  completed: boolean;
  completedAt?: string;
  reason: string;
}

export interface ActivationRisk {
  score: number;
  level: ActivationRiskLevel;
  reasons: string[];
}

export interface ActivationStatusDto {
  subject: ActivationSubjectRef;
  stage: ActivationStage;
  risk: ActivationRisk;
  milestones: ActivationMilestoneRecord[];
  checklist: ActivationChecklistItem[];
}

export const ACTIVATION_MILESTONE_ORDER: ActivationMilestoneKey[] = [
  "intake_ready",
  "scope_defined",
  "build_started",
  "build_complete",
  "validated",
  "released",
  "blocked",
];

export const ACTIVATION_CHECKLIST_ORDER: ActivationChecklistItemKey[] = [
  "brief_captured",
  "requirements_defined",
  "implementation_started",
  "validation_completed",
  "release_confirmed",
];
