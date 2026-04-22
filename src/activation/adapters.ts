import type { ActivationSignalSnapshot } from "./domain";

export interface WorkspaceActivationFacts {
  now: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  releasedAt?: string;
  briefCapturedAt?: string;
  requirementsDefinedAt?: string;
  planDefinedAt?: string;
  implementationStartedAt?: string;
  testsPassedAt?: string;
  validationPassedAt?: string;
  releaseConfirmedAt?: string;
  blockerCount?: number;
  dependencyBlockerCount?: number;
  openQuestionCount?: number;
  criticalIssueCount?: number;
  scopeChangeCount?: number;
  failedValidationCount?: number;
  retryCount?: number;
}

export function buildSignalSnapshotFromFacts(
  facts: WorkspaceActivationFacts,
): ActivationSignalSnapshot {
  return {
    now: facts.now,
    createdAt: facts.createdAt,
    startedAt: facts.startedAt ?? facts.implementationStartedAt,
    completedAt: facts.completedAt,
    releasedAt: facts.releasedAt ?? facts.releaseConfirmedAt,
    hasBrief: Boolean(facts.briefCapturedAt),
    hasRequirements: Boolean(facts.requirementsDefinedAt),
    hasPlan: Boolean(facts.planDefinedAt),
    hasImplementation: Boolean(facts.implementationStartedAt || facts.completedAt),
    hasTests: Boolean(facts.testsPassedAt),
    hasValidationEvidence: Boolean(facts.validationPassedAt),
    hasReleaseEvidence: Boolean(facts.releaseConfirmedAt),
    blockerCount: facts.blockerCount ?? 0,
    dependencyBlockerCount: facts.dependencyBlockerCount ?? 0,
    openQuestionCount: facts.openQuestionCount ?? 0,
    criticalIssueCount: facts.criticalIssueCount ?? 0,
    scopeChangeCount: facts.scopeChangeCount ?? 0,
    failedValidationCount: facts.failedValidationCount ?? 0,
    retryCount: facts.retryCount ?? 0,
  };
}
