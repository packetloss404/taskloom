# Taskloom handoff

You are inheriting the codebase at `main` (commit `bf671ac` or later). Start
here — this doc captures what's on disk, what's open, how to work in this
repo, and gotchas the prior session learned the hard way.

## Current state in one paragraph

`/builder` is full-bleed (outside the workbench Shell). Sidebar is four
items: Build / Projects / Runs / Admin. The Admin entry routes to
`/admin/:tab` which consolidates 16 settings views. BYOK works across six
providers (Anthropic, OpenAI, Minimax, OpenRouter, Gemini, Ollama / any
OpenAI-compatible local endpoint) via `src/providers/router.ts` +
`src/providers/preset-resolver.ts`. The app-codegen pipeline now defaults
to **LLM-authored file trees** (`src/codegen/llm-author.ts`) with
plan-then-write chunking, tsc + vite-build validation via the existing
sandbox, and a Windows-aware path validator. The legacy 5-template path
is preserved behind `TASKLOOM_LEGACY_TEMPLATES=1`. A one-step launcher
(`./scripts/run.sh` / `run.ps1`) probes the configured provider key
before starting the dev server.

## Open items, ranked

P0 / P1 are the wife-can-finish gaps. P2+ are bigger lifts from
`docs/PHASE3_SCOPE.md` v2 that didn't ship this round.

| # | Item | Lift | Where |
|---|---|---|---|
| P0 | Multi-round auto-fix on broken tsc output (currently capped at 1 retry; surfaces "Fix these errors" button instead). The cap was intentional per Reviewer E to avoid a multi-week sinkhole, but the UX cliff for non-technical users is real. | 2–4d | `src/codegen/llm-author.ts` + `src/codegen/validate.ts` |
| P1 | Per-app server-side SQLite + runtime (Track C from PHASE3_SCOPE.md). Generated apps still use sql.js-in-browser loaded from jsdelivr CDN — kills the "from my own farm" promise. | 5–7d | new `src/generated-app-runtime/server.ts` + `src/generated-app-runtime/sqlite.ts` |
| P1 | Agent tool catalog (Track D). Slack, GitHub, email, generic SQL tools. The scheduler / webhook intake / tool registry already exist (`src/jobs/cron.ts`, `src/webhook-routes.ts`, `src/tools/registry.ts`). | 5–7d | new `src/tools/*.ts` (one per tool) |
| P2 | Anthropic prompt caching breakpoint. The SYSTEM_PROMPT is ~750 tokens, just under the AnthropicProvider's auto-cache threshold (~1k). Lower the threshold or pass explicit `cache_control` blocks. | 0.5d | `src/providers/anthropic.ts` + `src/codegen/prompts.ts` |
| P2 | First-run tour pointer alignment. Reviewer B noted step 1's callout sits below the composer rather than over it. | 0.5d | `web/src/workbench/views/builder-tour.tsx` |
| P3 | Iteration UX on legacy-template drafts still uses the regex pipeline (`src/app-iteration-service.ts`). The file-tree path handles llm-filetree drafts. Migrating legacy drafts is deferred. | 3–4d | `src/app-iteration-service.ts` |

For deeper context on any of these, see `docs/PHASE3_SCOPE.md` v2.

## Conventions (follow these — hard-won)

- **Worktree isolation for parallel agents.** If you spawn multiple subagents
  in parallel, give each one `isolation: "worktree"` AND include this
  preamble in the prompt:
  > 1. Run `pwd` first. Must contain `.claude/worktrees/agent-`. Else STOP.
  > 2. Use paths RELATIVE to cwd only. NEVER use absolute paths to the main repo.
  > 3. Verify `git branch --show-current` shows `worktree-agent-...`. Else STOP.
  > 4. Commit IN the worktree only.
  > 5. Do NOT include `Co-Authored-By: Claude Opus 4.7` in commits.
  Without this preamble, agents will leak edits into the main repo and
  cause merge-time chaos. The "stub files at merge" pattern works for
  agents that need to reference outputs of other parallel agents.

- **Commit messages**: plain, sentence-case subject, multi-paragraph body
  explaining *why*. No emoji. No `Co-Authored-By` footer.

- **Copy in the UI**: sentence case everywhere (Phase 1 swept ALL CAPS
  kickers and CI/CD jargon — don't reintroduce). No emoji.

- **Tests**: prefer `node --import tsx --test` for backend. Web tests use
  the same runner with `*.test.tsx`. Skip Windows-incompatible sandbox
  tests via `t.skip("reason")` conditionally on `process.platform === "win32"`,
  not by deleting them.

- **Don't add tracking files to `tmp/`** — it's gitignored after a prior
  pollution incident.

- **When in doubt about scope**, lean into Fork B: self-host, BYOK,
  honest about what we don't ship (CLOUD.md captures the deferred
  hosted-only features).

## Known gotchas

1. **Preview iframe needs the importmap.** The HTML transformer in
   `src/app-routes.ts` (`transformPreviewFile`) injects an importmap so
   `react`, `react-dom`, and `react/jsx-runtime` resolve from `esm.sh`.
   If you change the JSX runtime, update the importmap too.

2. **Preview token separator is `.` not `_`.** The HMAC is
   base64url-encoded which contains `_`, so the token format is
   `tk_<appId>.<expirySec>.<hmac>`. Don't switch back to underscore.

3. **OpenRouter's `/v1/models` is public.** It returns 200 for any
   auth string. The preflight script uses `/api/v1/key` for actual
   key validation. Same trap exists if you add another key-validity
   probe.

4. **Worktree branches conflict in predictable ways.** Parallel agents
   editing the same file in worktrees usually merge clean for additions
   to disjoint sections. Stub files (when one agent references another's
   output) ALWAYS conflict at merge — resolve by dropping the stub.

5. **Tests can have leftover stash markers.** When agents work in
   worktrees and you do stash dances during merge, scan for `<<<<<<<`
   and `Updated upstream` markers across the diff before committing.

6. **Sandbox is opt-in.** `TASKLOOM_SANDBOX_SMOKE_ENABLED=1` enables
   real `tsc` + `vite build` in the sandbox. Without it the file-tree
   validator returns `{ ok: true, source: "skipped" }`. The Windows test
   environment can't reliably spawn `cmd.exe` from `node:test`, hence
   the conditional skip.

7. **The "wife test" is the bar.** When evaluating a change, ask "could
   a non-technical user finish without asking the owner?" The current
   answer is "getting closer, not yet." The P0 + P1 open items are
   the gap to "yes."

## Where to look for what

| Topic | File |
|---|---|
| Full Phase 3 plan with budgets | `docs/PHASE3_SCOPE.md` |
| What's done vs pending | `BACKLOG.md` |
| Recent commits explained | `CHANGELOG.md` |
| Self-host setup (BYO key, providers, local LLM) | `docs/SELF_HOST.md` |
| One-step launcher quickstart | `docs/QUICKSTART.md` |
| Codegen architecture (file-tree path) | `docs/CODEGEN_FILETREE.md` |
| Hosted-only features deferred to Taskloom Cloud | `CLOUD.md` |
| Builder UI | `web/src/workbench/views/builder.tsx` |
| Admin tabs | `web/src/workbench/views/admin.tsx` |
| LLM file-tree author | `src/codegen/llm-author.ts` |
| BYOK provider router | `src/providers/router.ts` + `src/providers/preset-resolver.ts` |

## Verify before you ship

```
npm run typecheck
npm test
npm run build:web
```

Expected baseline: 1499 pass / 0 fail / 1 skipped (backend), 17 pass
(web), build clean. Anything beyond those skips/fails is a regression
your change introduced.

## Don't do these without asking

- Re-architect the structured-draft → file-tree dualism (it's a real
  cleanup but invasive — see Reviewer A's note in the prior session).
- Delete the legacy template path entirely (it's the fallback for
  keyless users; `TASKLOOM_LEGACY_TEMPLATES=1` is the explicit opt-in).
- Add `node:vm` as a sandbox option (was explicitly dropped — not a
  security boundary).
- Auto-deploy to a public URL (CLOUD.md territory; needs hosted edge).

Good luck.
