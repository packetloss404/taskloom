# Managed Database Runtime Feasibility

Phase 48 should not add a managed Postgres runtime dependency. Phase 49 lands the async store boundary foundation after that fail-closed boundary. Phase 50 adds the managed Postgres document-store adapter/backfill foundation, but the current main app startup path still runs the managed database runtime guard and supports local JSON/default storage plus opt-in single-node SQLite only. Phase 51+ must migrate runtime call sites before managed/Postgres hints become normal app startup configuration.

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

Phase 49 addresses the boundary direction by landing async store foundation work: `loadStoreAsync()` and `mutateStoreAsync()` provide Promise-capable store entry points, JSON/default and SQLite are adapted behind that surface. Phase 50 follows with the managed Postgres document-store adapter behind the async boundary and a repeatable backfill/verify foundation. The main app server still calls the runtime guard during startup, so this remains a staged rollout rather than supported managed/Postgres startup.

## Decision

Do not add a Postgres dependency in Phase 48 or Phase 49. Phase 50 intentionally adds `pg` with the first managed Postgres document-store backend and backfill/verify commands. After Phase 50, the remaining implementation gap is runtime integration: guarded synchronous startup call sites still need to move to the async/managed database path before the app can treat managed/Postgres hints as supported startup configuration.

## Smallest Safe Path

1. Treat Phase 49 as the completed async store boundary foundation, while keeping JSON/default and SQLite paths intact.
2. Treat Phase 50 as the managed Postgres adapter/backfill foundation.
3. In Phase 51+, migrate runtime call sites to the async/managed database path before loosening the startup guard.
4. Update runtime guard, topology advisory, release-readiness, and release-evidence checks only when managed database runtime support is executable.
5. Keep managed database hints blocked or advisory until the guarded startup path has enough coverage to make them honest startup configuration.

Until Phase 51+ makes the managed Postgres runtime executable through the app startup path, managed database support should remain documented as blocked by the existing runtime guard.
