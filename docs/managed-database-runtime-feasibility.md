# Managed Database Runtime Feasibility

Phase 48 should not add a managed Postgres runtime dependency. Phase 49 lands the async store boundary foundation after that fail-closed boundary. Phase 50 adds the managed Postgres document-store adapter/backfill foundation. Phase 51 tracks the runtime call-site migration needed to use that foundation from the app startup path and now reports no remaining tracked sync call-site groups. Phase 52 asserts and validates managed Postgres startup support after that migration. Phase 53 adds the multi-writer topology requirements/design gate after Phase 52, Phase 54 requires an owned topology design package before any multi-writer runtime implementation, Phase 55 requires design-package review plus implementation-authorization evidence before runtime implementation can start, Phase 56 requires implementation-readiness plus rollout-safety evidence before runtime support can be claimed, and Phase 57 requires implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed. Managed/Postgres hints can be accepted only when a recognized Postgres adapter value is paired with a managed database URL and the startup support assertion is present; horizontal writers, regional failover, PITR, and active-active writes remain blocked until the owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, rollback strategy, reviewer signoff, implementation authorization, implementation readiness, staged rollout controls, rollback/recovery proof, observability proof, release-claim boundaries, implementation scope, runtime gate, migration/cutover lock, and release-owner signoff are documented.

## Current Package State

- `package.json` now includes `pg` plus `@types/pg` for the Phase 50 adapter foundation.
- `package-lock.json` changes are intentional for that dependency addition.
- `package.json` exposes `db:backfill-managed-postgres` and `db:verify-managed-postgres`.
- The source adds `TASKLOOM_MANAGED_DATABASE_ADAPTER` as an advisory/guard hint for recognized Postgres adapter values (`postgres`, `postgresql`, `managed-postgres`, `managed-postgresql`).

## Original Blocking Constraint

The app-wide store surface is synchronous:

- `loadStore(): TaskloomData`
- `mutateStore<T>(mutator: (data: TaskloomData) => T): T`

The SQLite implementation fits that contract because it uses Node's synchronous `node:sqlite` APIs, including `DatabaseSync`, synchronous query execution, and synchronous `BEGIN IMMEDIATE` mutation handling. That lets callers read or mutate store data without returning `Promise`s.

Managed Postgres does not fit this surface with the common Node driver ecosystem. Drivers such as `pg` and `postgres` use asynchronous network I/O and return promises or callback-driven results. A managed database connection also needs async connection setup, query execution, transaction handling, error handling, and pool lifecycle management. Wrapping those calls in the current synchronous `loadStore` / `mutateStore` API would either block the event loop through unsupported bridging or hide async failure modes outside the caller's control.

Phase 49 addresses the boundary direction by landing async store foundation work: `loadStoreAsync()` and `mutateStoreAsync()` provide Promise-capable store entry points, JSON/default and SQLite are adapted behind that surface. Phase 50 follows with the managed Postgres document-store adapter behind the async boundary and a repeatable backfill/verify foundation. Phase 51 tracks the runtime call-site migration to that async path and now reports no remaining tracked sync call-site groups. Phase 52 is the startup assertion/validation milestone that lets the runtime guard accept only the recognized Postgres adapter + managed database URL posture. Phase 53 keeps multi-writer/distributed database needs as topology requirements, not runtime feasibility already solved by the managed Postgres adapter. Phase 54 requires the owned design package before those needs can move into implementation planning. Phase 55 requires reviewed-package and implementation-authorization evidence before implementation can start. Phase 56 requires implementation-readiness and rollout-safety evidence before runtime support can be claimed. Phase 57 requires the implementation scope to be locked with runtime exposure gated, validation evidence attached, migration/cutover locked, and release-owner signoff recorded before implementation claims can proceed.

## Decision

Do not add a Postgres dependency in Phase 48 or Phase 49. Phase 50 intentionally adds `pg` with the first managed Postgres document-store backend and backfill/verify commands. Phase 51 makes runtime integration visible in deployment reports and now reports no remaining tracked sync call-site groups. Phase 52 asserts/validates startup support; the app can treat managed/Postgres hints as supported startup configuration only for recognized Postgres adapter + managed database URL configurations. Phase 53 does not add another runtime dependency or implementation path; it blocks multi-writer/distributed requirements until topology ownership and design are explicit. Phase 54 also does not add runtime support; it requires the owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, and rollback strategy before implementation planning. Phase 55 also does not add runtime support; it requires review outcome, reviewer/approver identity, authorization scope, approval timing, and release-evidence attachment before implementation starts. Phase 56 also does not add runtime support; it requires implementation readiness, staged rollout controls, rollback/recovery proof, observability proof, and release-claim boundaries before support can be claimed. Phase 57 also does not add runtime support; it requires the implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff before implementation claims can proceed.

## Smallest Safe Path

1. Treat Phase 49 as the completed async store boundary foundation, while keeping JSON/default and SQLite paths intact.
2. Treat Phase 50 as the managed Postgres adapter/backfill foundation.
3. Use Phase 51 evidence to confirm tracked runtime call sites have moved to the async/managed database path.
4. Treat Phase 52 as the startup assertion/validation step for the guarded managed Postgres path.
5. Treat Phase 53 as the multi-writer topology requirements/design gate after Phase 52.
6. Treat Phase 54 as the owned design-package gate before implementation planning.
7. Treat Phase 55 as the design-package review and implementation-authorization evidence gate before implementation starts.
8. Treat Phase 56 as the implementation-readiness and rollout-safety evidence gate before runtime support can be claimed.
9. Treat Phase 57 as the implementation-scope gate before implementation claims can proceed.
10. Keep unsupported managed database hints, missing adapter/URL pairs, multi-writer/distributed topology, regional failover, PITR, and active-active writes blocked until a real topology package documents the owner, consistency model, failover/PITR plan, migration/backfill plan, observability requirements, rollback strategy, review outcome, approvers, authorization scope, approval timing, implementation readiness, staged rollout controls, rollback/recovery proof, observability proof, release-claim boundaries, implementation scope lock, runtime feature flag/deployment gate, validation evidence, migration/cutover lock, and release-owner signoff.

Managed Postgres startup support is now documented as a narrow asserted posture, not a blanket managed database topology claim.
