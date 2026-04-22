import type { ActivationRisk, ActivationSignalSnapshot, ActivationStage } from "./domain";

export function calculateRisk(
  input: ActivationSignalSnapshot,
  stage: ActivationStage,
): ActivationRisk {
  const reasons: string[] = [];
  let score = baseScore(stage);

  score += input.criticalIssueCount * 15;
  if (input.criticalIssueCount > 0) reasons.push("Critical issues are open.");

  score += input.dependencyBlockerCount * 8;
  if (input.dependencyBlockerCount > 0) reasons.push("Dependencies are blocking progress.");

  score += input.blockerCount * 5;
  if (input.blockerCount > 0) reasons.push("Active blockers are present.");

  score += input.openQuestionCount * 3;
  if (input.openQuestionCount > 0) reasons.push("Open questions remain unresolved.");

  score += input.scopeChangeCount * 4;
  if (input.scopeChangeCount > 0) reasons.push("Scope changed during execution.");

  score += input.failedValidationCount * 6;
  if (input.failedValidationCount > 0) reasons.push("Validation has failed previously.");

  score += input.retryCount * 2;
  if (input.retryCount > 0) reasons.push("Work required retries.");

  if (input.hasTests) score -= 10;
  if (input.hasValidationEvidence) score -= 10;
  if (input.hasPlan) score -= 5;

  score = Math.min(100, Math.max(0, score));

  return {
    score,
    level: score >= 65 ? "high" : score >= 30 ? "medium" : "low",
    reasons,
  };
}

function baseScore(stage: ActivationStage): number {
  switch (stage) {
    case "not_started":
      return 5;
    case "discovery":
      return 15;
    case "definition":
      return 25;
    case "implementation":
      return 40;
    case "validation":
      return 35;
    case "complete":
      return 10;
    case "blocked":
      return 60;
  }
}
