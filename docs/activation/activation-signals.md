# Activation Signals

PR1B does not implement adapters. It expects a later repository/service layer to provide a normalized `ActivationSignalSnapshot`.

## Required Signals

- `now`
- `hasBrief`
- `hasRequirements`
- `hasPlan`
- `hasImplementation`
- `hasTests`
- `hasValidationEvidence`
- `hasReleaseEvidence`
- `blockerCount`
- `dependencyBlockerCount`
- `openQuestionCount`
- `criticalIssueCount`
- `scopeChangeCount`
- `failedValidationCount`
- `retryCount`

## Optional Timestamps

- `createdAt`
- `startedAt`
- `completedAt`
- `releasedAt`

## Adapter Guidance

Later PRs should map product-specific events and records into this snapshot, for example:

- profile completion
- first real customer interaction
- implementation start
- validation success/failure
- release confirmation
- active blockers and dependency blockers

Keep that mapping outside the pure engine.
