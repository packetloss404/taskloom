# Activation Roadmap

Activation has moved beyond the initial scaffold. The current implementation includes pure derivation, repository boundaries, signal adapters, local JSON-backed app data, read-only activation APIs, durable workflow-fed runtime signals with legacy fact fallback, maintenance jobs, route-level RBAC at the app boundary, and a UI-neutral summary view model.

## Current Capabilities

- `src/activation/domain.ts` defines activation signals, milestones, status, stages, and risk types.
- `src/activation/service.ts` derives activation status without storage or UI dependencies.
- `src/activation/adapters.ts` maps workspace facts or durable product records into normalized activation signals.
- `src/activation/api.ts` provides the read-only activation service wrapper.
- `src/activation/view-model.ts` builds UI-neutral summary card data.
- `data/taskloom.json` persists local activation facts, milestones, and read models.
- Workflow records for briefs, requirements, plans, blockers, questions, validation evidence, and release confirmation drive runtime activation snapshots when present.
- `npm run jobs:recompute-activation` refreshes activation read models and milestone records.
- `node --import tsx src/jobs.ts repair-activation-read-models` refreshes stale read models and reports repaired workspace IDs.
- Private activation-adjacent routes enforce workspace membership and role-aware access at the route/service boundary.

## Local Operations

- Start development with `npm run dev` and open `http://localhost:7341`.
- Reset local activation state by removing `data/taskloom.json`; the next store load recreates seed data.
- Recompute activation after manual data edits with `npm run jobs:recompute-activation`.
- Repair stale activation read models with `npm run jobs:repair-activation`.
- Recompute selected workspaces with `node --import tsx src/jobs.ts recompute-activation --workspace-ids=alpha,beta`.
- Repair stale read models with `node --import tsx src/jobs.ts repair-activation-read-models --workspace-ids=alpha,beta`.
- Run the release gate with `npm run build`.

## Next Activation Work

1. Replace JSON persistence with database-backed activation repositories behind the existing contracts.
2. Extend durable runtime signals beyond workflow records into onboarding and activity-derived retry/scope-change records where needed.
3. Add database backfills after activation persistence moves behind database-backed repositories. The current recompute and repair jobs refresh JSON-backed read models and milestone records.
4. Keep private activation-adjacent route policies aligned with future storage work. RBAC is implemented today for read, workflow edit, and workspace operation boundaries.
5. Broaden API and frontend smoke coverage as activation-critical flows expand.

## Phase 7 Access Semantics

Private activation-adjacent routes now apply the existing RBAC helper roles without changing the pure activation engine:

- `viewer`: can read workspace activation and workflow data.
- `member`: can read workspace data and edit workflow records that feed activation.
- `admin` and `owner`: can manage workspace settings, jobs, agents, providers, API keys, webhook operations, and other workspace operations.

The activation domain remains storage- and auth-agnostic. Membership lookup and permission enforcement belong at the private route/service boundary before activation data is read or workflow records are mutated.
