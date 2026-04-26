# Activation Domain

## Goal

Maintain a small, storage-agnostic activation domain:

- pure milestone engine
- pure checklist derivation
- stage derivation
- risk calculation
- repository/service contracts
- SQL schema for future persistence
- file-backed local repositories and read models through the app service layer

## In Scope

- `src/activation/domain.ts`
- `src/activation/milestones.ts`
- `src/activation/checklist.ts`
- `src/activation/risk.ts`
- `src/activation/service.ts`
- `src/activation/contracts.ts`
- `src/activation/adapters.ts`
- `src/activation/api.ts`
- `src/activation/repositories.ts`
- `src/activation/view-model.ts`
- `src/db/schema/activation.sql`

## Current Local Flow

- `data/taskloom.json` stores local activation facts, milestones, and read models.
- `snapshotForWorkspace(...)` maps stored workspace facts into `ActivationSignalSnapshot` through `buildSignalSnapshotFromFacts(...)`.
- Workflow writes update activation facts and emit activity events.
- `npm run jobs:recompute-activation` refreshes activation read models and milestone records for all workspaces, or a targeted set with `--workspace-ids=alpha,beta`.
- Removing `data/taskloom.json` resets local activation data to the built-in seed state on the next app start or store load.

## Out Of Scope

- HTTP routes
- jobs/backfills
- vendor-specific data clients
- auth/RBAC implementation
- UI/wizard/checklist rendering
- external branding/copy
- Supabase-specific schema or policies

The current app has HTTP routes, jobs, and React pages around this domain, but those layers should stay outside the pure activation engine.

## Milestones

- `intake_ready`
- `scope_defined`
- `build_started`
- `build_complete`
- `validated`
- `released`
- `blocked`

## Checklist Items

- `brief_captured`
- `requirements_defined`
- `implementation_started`
- `validation_completed`
- `release_confirmed`

## Stage Precedence

1. `blocked`
2. `complete`
3. `validation`
4. `implementation`
5. `definition`
6. `discovery`
7. `not_started`

## Acceptance Criteria

1. The domain is pure and storage-agnostic.
2. Milestone detection is idempotent and append-only.
3. Checklist derivation depends only on normalized input.
4. Risk calculation is deterministic.
5. No file references Supabase, external source repos, or UI components.
