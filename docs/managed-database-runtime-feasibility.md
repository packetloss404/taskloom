# Managed Database Runtime Feasibility

Phase 48 should not add a managed Postgres runtime dependency yet. The current runtime can support local JSON/default storage and opt-in single-node SQLite, but actual managed Postgres support is blocked by the synchronous store contract.

## Current Package State

- `package.json` has no Postgres client dependency.
- `package-lock.json` is present and should only change if a dependency is intentionally added.
- No dependency was added for this feasibility slice because a driver alone would not be usable behind the current store API.

## Blocking Constraint

The app-wide store surface is synchronous:

- `loadStore(): TaskloomData`
- `mutateStore<T>(mutator: (data: TaskloomData) => T): T`

The SQLite implementation fits that contract because it uses Node's synchronous `node:sqlite` APIs, including `DatabaseSync`, synchronous query execution, and synchronous `BEGIN IMMEDIATE` mutation handling. That lets callers read or mutate store data without returning `Promise`s.

Managed Postgres does not fit this surface with the common Node driver ecosystem. Drivers such as `pg` and `postgres` use asynchronous network I/O and return promises or callback-driven results. A managed database connection also needs async connection setup, query execution, transaction handling, error handling, and pool lifecycle management. Wrapping those calls in the current synchronous `loadStore` / `mutateStore` API would either block the event loop through unsupported bridging or hide async failure modes outside the caller's control.

## Decision

Do not add a Postgres dependency in Phase 48. Adding `pg`, `postgres`, or a higher-level ORM now would increase package surface without enabling a correct managed runtime. The implementation gap is not dependency availability; it is the synchronous store boundary.

## Smallest Safe Path

1. Introduce async-capable store/repository boundaries next to the existing sync API, for example `loadStoreAsync` / `mutateStoreAsync` or narrower async repositories for the production hot paths.
2. Migrate call sites incrementally, prioritizing server routes, jobs, scheduler operations, rate limiting, auth/session flows, and dedicated relational repositories that already isolate storage behavior.
3. Keep JSON/default and SQLite sync paths intact during the transition, with adapters that can satisfy the async boundary by returning resolved values.
4. Add the minimal Postgres client only when the first async-managed repository or store backend lands.
5. Implement managed Postgres migrations, transaction semantics, pooling, configuration, guard updates, backfill/verify commands, and parity tests before allowing managed database runtime hints in release/startup checks.

Until that migration starts, managed database support should remain documented as unsupported and blocked by the existing runtime guard.
