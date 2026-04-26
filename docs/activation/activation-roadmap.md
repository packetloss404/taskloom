# Activation Roadmap

Activation has moved beyond the initial scaffold. The current implementation includes pure derivation, repository boundaries, signal adapters, local JSON-backed app data, read-only activation APIs, workflow-fed activation facts, maintenance jobs, and a UI-neutral summary view model.

## Current Capabilities

- `src/activation/domain.ts` defines activation signals, milestones, status, stages, and risk types.
- `src/activation/service.ts` derives activation status without storage or UI dependencies.
- `src/activation/adapters.ts` maps workspace facts or durable product records into normalized activation signals.
- `src/activation/api.ts` provides the read-only activation service wrapper.
- `src/activation/view-model.ts` builds UI-neutral summary card data.
- `data/taskloom.json` persists local activation facts, milestones, and read models.
- Workflow records for briefs, requirements, plans, blockers, questions, validation evidence, and release confirmation update activation facts.
- `npm run jobs:recompute-activation` refreshes activation read models and milestone records.

## Local Operations

- Start development with `npm run dev` and open `http://localhost:7341`.
- Reset local activation state by removing `data/taskloom.json`; the next store load recreates seed data.
- Recompute activation after manual data edits with `npm run jobs:recompute-activation`.
- Recompute selected workspaces with `node --import tsx src/jobs.ts recompute-activation --workspace-ids=alpha,beta`.
- Run the release gate with `npm run build`.

## Next Activation Work

1. Replace JSON persistence with database-backed activation repositories behind the existing contracts.
2. Map durable workflow, onboarding, activity, validation, and release records through `buildSignalSnapshotFromProductRecords(...)` instead of relying on manually maintained activation facts.
3. Add database backfills and stale read-model repair checks.
4. Enforce workspace access on private activation and workflow routes through route-level RBAC.
5. Broaden API and frontend smoke coverage for activation-critical flows.
