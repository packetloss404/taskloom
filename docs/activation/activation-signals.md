# Activation Signals

Activation derivation consumes a normalized `ActivationSignalSnapshot`. The pure engine does not know whether signals came from local seed facts, workflow records, activity records, jobs, or a future database repository.

Current local sources:

- Built-in seed data creates `activationFacts` for `alpha`, `beta`, and `gamma` in `data/taskloom.json`.
- Workflow writes update activation facts for brief, requirements, plan, blockers, questions, validation, and release confirmation.
- `snapshotForWorkspace(...)` refreshes `now` and maps facts with `buildSignalSnapshotFromFacts(...)`.
- `buildSignalSnapshotFromProductRecords(...)` is available for future durable record mapping.

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

Product-specific events and records should map into this snapshot, for example:

- profile completion
- first real customer interaction
- implementation start
- validation success/failure
- release confirmation
- active blockers and dependency blockers

Keep that mapping outside the pure engine.

## Operations

- Run `npm run jobs:recompute-activation` after manual changes to local activation facts or workflow records.
- Use `node --import tsx src/jobs.ts recompute-activation --workspace-ids=alpha,beta` for targeted recomputes.
- Delete `data/taskloom.json` to reset to built-in seed signals on the next store load.
