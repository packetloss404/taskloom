# Managed Database Runtime Feasibility

Phase 48 should not add a managed Postgres runtime dependency. Phase 49 lands the async store boundary foundation after that fail-closed boundary, but it still does not add managed Postgres runtime support. The current runtime can support local JSON/default storage and opt-in single-node SQLite; actual managed Postgres support still needs the Phase 50 adapter, repositories, migrations/backfills, and release/runtime updates.

## Current Package State

- `package.json` has no Postgres client dependency.
- `package-lock.json` is present and should only change if a dependency is intentionally added.
- No dependency was added for this feasibility slice because a driver alone would not be enough without the actual managed Postgres adapter/repository implementation.

## Original Blocking Constraint

The app-wide store surface is synchronous:

- `loadStore(): TaskloomData`
- `mutateStore<T>(mutator: (data: TaskloomData) => T): T`

The SQLite implementation fits that contract because it uses Node's synchronous `node:sqlite` APIs, including `DatabaseSync`, synchronous query execution, and synchronous `BEGIN IMMEDIATE` mutation handling. That lets callers read or mutate store data without returning `Promise`s.

Managed Postgres does not fit this surface with the common Node driver ecosystem. Drivers such as `pg` and `postgres` use asynchronous network I/O and return promises or callback-driven results. A managed database connection also needs async connection setup, query execution, transaction handling, error handling, and pool lifecycle management. Wrapping those calls in the current synchronous `loadStore` / `mutateStore` API would either block the event loop through unsupported bridging or hide async failure modes outside the caller's control.

Phase 49 addresses the boundary direction by landing async store foundation work: `loadStoreAsync()` and `mutateStoreAsync()` provide Promise-capable store entry points, JSON/default and SQLite are adapted behind that surface, and managed/Postgres modes still reject with the managed database boundary error. It is intentionally not the adapter itself.

## Decision

Do not add a Postgres dependency in Phase 48 or Phase 49. Adding `pg`, `postgres`, or a higher-level ORM before the first real managed repository/backend would increase package surface without enabling a correct managed runtime. After Phase 49, the implementation gap is no longer whether async boundaries are plausible; it is the actual Phase 50 managed Postgres adapter, repositories, migrations/backfills, pooling/configuration, parity tests, and release support.

## Smallest Safe Path

1. Treat Phase 49 as the completed async store boundary foundation, while keeping JSON/default and SQLite paths intact.
2. In Phase 50, add the minimal Postgres client only with the first real managed Postgres adapter or managed repository.
3. Implement managed Postgres repositories, migrations, transaction semantics, pooling, configuration, backfill/verify commands, and parity tests.
4. Update runtime guard, topology advisory, release-readiness, and release-evidence checks only when managed database runtime support is executable.
5. Keep managed database hints blocked or advisory until Phase 50 has enough coverage to make them honest startup configuration.

Until Phase 50 makes the managed Postgres runtime executable, managed database support should remain documented as unsupported and blocked by the existing runtime guard.
