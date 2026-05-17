# File-tree codegen (Track B skeleton)

This is the **skeleton** of Track B from `docs/PHASE3_SCOPE.md`: the path
that makes the LLM-authored file tree the canonical source of truth for a
generated app, instead of the deterministic template draft.

The template path has **not** been deleted. This is opt-in only. Existing
keyless installs and existing tests are unchanged.

## What the feature flag does

When `TASKLOOM_FILETREE_CODEGEN=1` is set, `generateAppDraftWithLLM` tries
a new code path *before* falling through to today's structured-tool path:

1. Call `authorAppViaLLM(prompt, ...)` — the Track B orchestrator (B1).
   It streams a plan → write pass through the configured BYOK provider
   and returns `{ files, summary, source }`. On any failure it returns
   `null` and we fall through to the existing paths.
2. Call `validateFileTree(files, ...)` — the Track B build validator (B3).
   It runs a sandboxed build / typecheck pass. With
   `TASKLOOM_SANDBOX_SMOKE_ENABLED=1` it does real work; otherwise it
   short-circuits with `{ ok: true, source: "skipped" }`.
3. Project the file tree into an `AppDraft` via
   `deriveDraftFromFiles(files, prompt, summary)` so the Files tab, Smoke
   tab, and publish flow keep working without changes. The original `files`
   array is returned alongside the derived draft for surfaces that want it.

The result shape is `GenerateAppDraftResult`:

```ts
type GenerateAppDraftResult = {
  draft: AppDraft;
  source: "llm" | "template" | "llm-filetree";
  files?: GeneratedFile[];
  validationErrors?: string[];
};
```

`source === "llm-filetree"` is the discriminator that means *the file tree
is canonical, the draft is a derived view*.

## How to enable

```bash
# Required: turn on the opt-in code path.
export TASKLOOM_FILETREE_CODEGEN=1

# Required: a BYOK provider key. Without one, the orchestrator returns
# null and the request falls through to the existing template path.
export ANTHROPIC_API_KEY=sk-ant-...
# (or any of the supported BYOK providers — see src/providers/.)

# Optional: turn on real build validation. Without this, the validator
# short-circuits with `{ ok: true, source: "skipped" }`.
export TASKLOOM_SANDBOX_SMOKE_ENABLED=1
```

Then trigger app generation the usual way (chat, `POST /app/builder/...`,
etc.). The response shape gains a `files` array and a
`source: "llm-filetree"` discriminator when the new path runs.

## Known limits

This is deliberately a thin slice. The honest list:

- **Opt-in only.** Default behaviour is unchanged. The template path is the
  source of truth for every install that does not set the flag.
- **Requires a BYOK provider.** No BYOK key configured → orchestrator
  returns null → we fall through to the structured-tool / template path.
  No keyless mode.
- **Validation is best-effort.** With `TASKLOOM_SANDBOX_SMOKE_ENABLED`
  unset, the validator reports `{ ok: true, source: "skipped" }`. With it
  set, errors are *surfaced* (via `validationErrors`) but there is no
  auto-fix loop — at most one retry by the orchestrator, then we hand the
  errors back to the caller and let them decide.
- **Iteration is still template-only.** `src/app-iteration-service.ts` has
  not been touched. The "edit the running app" path still mutates the
  structured draft, not the file tree. Round 2 of Track B is what wires
  iteration through to the file tree.
- **The derived draft is a forgiving heuristic, not a parser.** It reads
  `package.json` for the app name, walks `src/pages/*` for pages,
  `src/api/*` for API routes, and `src/data/*` / `src/schema/*` for the
  data schema. When the heuristics find nothing it returns a minimal
  valid draft rather than throwing. Quality is intentionally less
  important than not breaking downstream consumers; the *file tree* is
  the canonical artefact for those surfaces that can consume it.
- **No template-prison eviction yet.** The whole point of Track B is to
  eventually delete `coerceLLMResultToAppDraft` and the structured-tool
  prompts. That deletion is **not** part of this skeleton — it is the
  reward for landing the rest of Track B.

## Where the pieces live

- `src/codegen/llm-author.ts` — B1 orchestrator (`authorAppViaLLM`).
- `src/codegen/prompts.ts` — B2 system + per-phase user prompts.
- `src/codegen/path-validator.ts` — B2 workspace-relative path defense.
- `src/codegen/validate.ts` — B3 sandboxed build validator.
- `src/codegen/derived-draft.ts` — the `AppDraft` projection over a file
  tree. *Owned by this module; not replaced by parallel agents.*
- `src/app-builder-service.ts` — the integration site
  (`generateAppDraftWithLLM` → `tryFileTreeCodegen`).
