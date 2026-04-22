# Activation Domain

## Goal

Create the smallest safe activation domain scaffold:

- pure milestone engine
- pure checklist derivation
- stage derivation
- risk calculation
- repository/service contracts
- SQL schema for future persistence

## In Scope

- `src/activation/domain.ts`
- `src/activation/milestones.ts`
- `src/activation/checklist.ts`
- `src/activation/risk.ts`
- `src/activation/service.ts`
- `src/activation/contracts.ts`
- `src/db/schema/activation.sql`

## Out Of Scope

- HTTP routes
- jobs/backfills
- vendor-specific data clients
- auth/RBAC implementation
- UI/wizard/checklist rendering
- external branding/copy
- Supabase-specific schema or policies

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
