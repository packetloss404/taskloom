# Activation Roadmap

This scaffold now includes the next recommended non-visual moves beyond PR1B:

## Added In This Step

- generic signal adapter: `src/activation/adapters.ts`
- in-memory repositories: `src/activation/repositories.ts`
- read-only activation API/service wrapper: `src/activation/api.ts`
- UI-neutral checklist summary view model: `src/activation/view-model.ts`

## What This Enables

1. map app-specific product facts into a normalized activation snapshot
2. compute activation status end-to-end using real repository boundaries
3. optionally cache/read a derived activation read model
4. render a setup checklist using existing UI components later without importing external visual patterns

## Still Out Of Scope

- framework-specific HTTP routes
- auth/RBAC
- persistence backed by a real DB
- backfill jobs
- visual dashboard components

## Recommended PR Order From Here

1. implement a real `ActivationSignalRepository`
2. implement a real `ActivationMilestoneRepository`
3. expose one read-only endpoint using `readActivationStatus(...)`
4. render the summary card using current app components and `buildActivationSummaryCard(...)`
