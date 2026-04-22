import type { ActivationSignalSnapshot, ActivationSubjectRef } from "../domain";

export const subject: ActivationSubjectRef = {
  workspaceId: "workspace_123",
  subjectType: "workspace",
  subjectId: "workspace_123",
};

export const emptySnapshot: ActivationSignalSnapshot = {
  now: "2026-04-21T10:00:00.000Z",
  hasBrief: false,
  hasRequirements: false,
  hasPlan: false,
  hasImplementation: false,
  hasTests: false,
  hasValidationEvidence: false,
  hasReleaseEvidence: false,
  blockerCount: 0,
  dependencyBlockerCount: 0,
  openQuestionCount: 0,
  criticalIssueCount: 0,
  scopeChangeCount: 0,
  failedValidationCount: 0,
  retryCount: 0,
};
