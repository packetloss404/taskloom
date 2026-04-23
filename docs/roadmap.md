# Taskloom Roadmap

Taskloom currently has a local activation domain, file-backed app services, auth/onboarding/activity/workflow flows, command-driven maintenance jobs, and a React/Vite interface. The next phase is about turning that scaffold into a durable workspace product without losing the clean activation boundaries already in place.

## Current Baseline

- Activation engine, checklist derivation, stage logic, risk calculation, and summary view model are implemented.
- Local file-backed storage lives in `data/taskloom.json`.
- App services connect auth, workspaces, onboarding, activation, activity, and workflow records.
- Workspace records now include membership rows, workflow briefs, requirements, implementation plan items, blockers/open questions, validation evidence, and release confirmations.
- Public activation endpoints and private app endpoints are available for activation, onboarding, workspace settings, and activity.
- The workflow route module defines the expected private `/api/app/workflow` endpoint shape.
- RBAC helpers define owner, admin, member, and viewer roles with view, edit workflow, and manage workspace permissions.
- Jobs scripts can recompute activation read models and clean up expired sessions against the local store.
- React pages cover sign-in/sign-up, onboarding, dashboard, settings, activation, and activity.
- The frontend API layer has typed workflow calls for brief, requirements, plan items, blockers, questions, validation evidence, and release confirmation.
- Build, typecheck, and test scripts are available through `npm run build`.

## Landed In This Branch

### Workflow Records And Services

The JSON store now carries the product workflow records that feed activation:

- `workspaceBriefs`
- `requirements`
- `implementationPlanItems`
- `workflowConcerns`
- `validationEvidence`
- `releaseConfirmations`

Workflow service operations update these records, emit workflow activity events, and set activation facts such as brief captured, requirements defined, plan defined, implementation started, blockers, open questions, validation status, and release confirmation.

### Workflow API Shape

The workflow route module exposes private endpoints under `/api/app/workflow`:

- `GET /`
- `GET|PUT /brief`
- `GET|PUT /requirements`
- `GET|PUT|POST /plan-items`
- `PATCH /plan-items/:itemId`
- `GET|PUT /blockers-questions`
- `GET|POST /blockers`
- `PATCH /blockers/:blockerId`
- `GET|POST /questions`
- `PATCH /questions/:questionId`
- `GET|PUT|POST /validation-evidence`
- `PATCH /validation-evidence/:evidenceId`
- `GET|PUT|POST /release-confirmation`

These routes require an authenticated session and operate on the current workspace context.

### RBAC Helpers

RBAC currently lives as reusable helpers rather than a full route policy layer:

- `viewer`: can view workspace data.
- `member`: can view workspace data and edit workflow records.
- `admin`: can view, edit workflow records, and manage workspace settings.
- `owner`: has the same permissions as admin and remains the seeded default membership role.

### Jobs

Two maintenance commands are available:

- `npm run jobs:recompute-activation`
- `npm run jobs:cleanup-sessions`

The recompute job refreshes activation read models and milestone records for every workspace by default, with `--workspace-ids=alpha,beta` for targeted runs. The cleanup job removes expired or invalid sessions.

## Roadmap

### 1. Persistence Foundation

Replace the JSON store with a real database-backed persistence layer while keeping activation logic storage-agnostic.

- Add migration tooling around the existing activation schema.
- Extend the existing JSON-backed model into migrations for users, sessions, memberships, workspaces, workflow records, onboarding state, activities, activation facts, milestones, and activation read models.
- Introduce database-backed repository implementations behind the existing services.
- Add seed and reset commands for local development.
- Preserve deterministic activation recalculation.

### 2. Auth And RBAC

Expand local auth from a single-owner workspace flow into a workspace membership model.

- Apply the existing owner/admin/member/viewer helper layer to private app routes.
- Enforce workspace membership on private API routes.
- Add invitation and member management flows.
- Add session cleanup for expired sessions.
- Review production cookie and password handling before external deployment.

### 3. Real Activation Signals

Move activation snapshots from onboarding-derived facts toward product-observed signals.

- Implement a real `ActivationSignalRepository`.
- Map workspace, onboarding, activity, blocker, question, validation, and release records into normalized activation snapshots.
- Distinguish user-entered facts from system-observed facts.
- Track blockers, dependency blockers, open questions, validation failures, retries, and scope changes.
- Keep signal mapping outside the pure activation engine.

### 4. Jobs And Backfills

Make activation updates reliable outside request-time reads.

- Decide whether command-driven jobs are enough for local deployment or whether a background scheduler is needed.
- Add a database backfill command for existing workspaces after persistence moves out of JSON.
- Ensure activity emission is idempotent.
- Add stale read-model detection and repair checks.

### 5. Product Workflow Expansion

Build the day-to-day workflow surfaces that make activation useful.

- Complete or verify frontend pages for the workflow API surfaces: brief editor, requirements checklist, implementation plan tracker, blockers/open questions, validation evidence capture, and release confirmation.
- Dashboard filters for stage, risk, status, and recency.
- Richer activity detail views.

### 6. Dev And Release Hygiene

Strengthen the project rails before larger product work accumulates.

- Keep roadmap, README, and activation docs current as milestones land.
- Broaden API route coverage beyond smoke tests.
- Add frontend smoke tests for auth, onboarding, dashboard, and activation.
- Document local development, reset, seed, build, and release flows.
- Decide whether built `web/dist` assets should remain committed.

## Recommended Order

1. Verify workflow route mounting and frontend workflow pages.
2. Apply RBAC helpers to private route policies.
3. Persistence foundation.
4. Real activation signal mapping.
5. Jobs scheduling, backfills, and stale read-model repair.
6. Broader test and release hardening.

## Near-Term Definition Of Done

The next phase is complete when Taskloom can run from database-backed storage, derive activation status from durable workflow records, enforce workspace access through route-level RBAC, expose complete workflow pages, and recompute activation read models without relying on request-time JSON store updates.
