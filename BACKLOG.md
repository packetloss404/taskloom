# Backlog

This backlog keeps Taskloom aimed at one thing first: **describe an app or agent, review the plan, generate it, preview/test it, iterate, publish/run it, and keep ownership of the runtime**.

It is intentionally not a phase list. Items are grouped by product outcome so we can ship useful vertical slices.

## Done in this pass

These items are complete and shipped to `main`. They are kept here for traceability — the original "still planned" copy followed each one, and the substance now lives in code rather than this file.

- **Full-bleed Builder.** `/builder` is now its own route outside the workbench Shell, with a chat thread, streamed prose, and a split preview. The Topbar no longer leaks into the builder.
- **Admin consolidation.** Sixteen operator surfaces (Roles, SSO, Secrets, Rate limits, Webhooks, Releases, Storage, Backups, Notifications, Operations, Integrations, Activation, Sandbox, Workflows, Billing, Alerts) live under a single tabbed `/admin/:tab` page. Back-compat redirects keep the old per-page URLs working.
- **Sidebar collapsed to four items.** Build, Projects, Runs, Admin. Removes the long secondary nav that competed with the Builder.
- **LLM wire-up via `ProviderRouter`.** Both `generateAppDraftViaLLM` and `applyAppIterationViaLLM` now route through `ProviderRouter`; iteration emits a real SSE prose stream. Template-only generation is the documented fallback when no provider is configured.
- **Six-provider BYOK at the builder.** Anthropic, OpenAI, Gemini, OpenRouter, MiniMax, and a generic local-LLM provider (Ollama / vLLM / LM Studio / llama.cpp) are first-class. Anthropic remains the default; `TASKLOOM_PROVIDER_PRIORITY` re-orders the priority walk for every preset; the `local` preset is strict.
- **Remote-pointable local LLM.** `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_API_FORMAT` (`ollama` | `openai`), and `LOCAL_LLM_MODEL` let the local provider talk to a separate GPU box on the LAN. `OLLAMA_BASE_URL` is honored as a legacy synonym.
- **Preset → provider+model resolver with env override.** `src/providers/preset-resolver.ts` walks per-preset priority lists, respects `TASKLOOM_PROVIDER_PRIORITY`, and surfaces the resolved provider+model on Builder UI chips. `GET /api/app/builder/providers/status` exposes the resolution snapshot for ops verification.
- **Sentence case copy.** The uppercase kicker / eyebrow pattern is gone across the workbench. Section labels are sentence case.
- **Hide raw IDs.** IDs are now behind a Details disclosure rather than rendered in primary copy.
- **Per-message revert in chat.** Each chat message in the Builder has a revert affordance back to the prior checkpoint.
- **Click-to-edit default-on.** No mode toggle — text in the Builder is editable by default.
- **CI / CD vocabulary softened.** "Deploy" / "pipeline" jargon swapped for plain terms where it leaked.
- **Builder empty state redesigned.** Direction A composer + four starter chips, matching the twin.so / Lovable shape.
- **App-preview header replaced.** Minimal header in the preview pane instead of the workbench Topbar.
- **Fork B positioning docs.** `CLOUD.md` inventories hosted-only capabilities; `docs/SELF_HOST.md` is the canonical setup guide; README reframed as self-host first.
- **Generated app generator quality.** sql.js persistence (note: from a jsdelivr CDN — known issue, scheduled for replacement in Phase 3 Track C), realistic seed data, typed form controls, no Taskloom eyebrow.
- **OSS launch basics.** MIT license, security policy, `.env.example`, Dockerfile, Docker Compose starter, production startup hardening.
- **File-tree codegen orchestrator (Phase 3 Track B).** Plan-then-write loop drives the LLM through `write_file(path, content)` tool calls; lives in `src/codegen/llm-author.ts` with system prompts in `src/codegen/prompts.ts`.
- **File-tree codegen as the default path.** Runs by default when a BYOK provider key is configured; opt-out via `TASKLOOM_LEGACY_TEMPLATES=1`. The previous `TASKLOOM_FILETREE_CODEGEN=1` opt-in flag is preserved as a no-op.
- **Hardened path validator.** Windows-aware checks (NTFS ADS, reserved device names, UNC paths, trailing dots, case collision) in `src/codegen/path-validator.ts`. 10 rules, 25 tests.
- **`AppDraft` projection over a file tree.** `src/codegen/derived-draft.ts` reads `package.json`, `src/pages/*`, `src/api/*`, and `src/data/*` / `src/schema/*` so the Files tab, Smoke tab, and publish flow keep working unchanged.
- **File-tree iteration parity.** `src/app-iteration-service.ts` re-runs the orchestrator on an iteration-shaped prompt for file-tree drafts and diffs the new tree against the prior one. Falls back to the regex pipeline for legacy-template drafts.
- **Chunked planning for large apps.** Plans with more than 10 files are batched across multiple LLM rounds (chunks of up to 8 files each) with early-stop when a chunk returns nothing.
- **Vite-build validation alongside tsc.** `src/codegen/validate.ts` runs `tsc --noEmit` and then `vite build`; diagnostics are tagged with `phase: "typecheck" | "build"`. Both phases are gated on `TASKLOOM_SANDBOX_SMOKE_ENABLED=1`.
- **Inline error UX in the Builder chat thread.** Validation errors from the file-tree path render inline as a warn-toned card with a "Fix these errors" button that triggers an iteration using the errors as the prompt.

## Still planned

These items are not yet done. They are organized by product outcome.

### Multi-provider BYOK — remaining work (Phase 3 Track A)

The router, preset resolver, and six adapters are shipped (see "Done in this pass"). What remains:

- Per-provider policy layer: local providers default to single-file tool calls + multi-turn iteration; hosted providers default to multi-file per turn.
- XGrammar / structured-decoding support when the provider is vLLM; best-effort JSON parsing fallback elsewhere.
- One-shot retry-with-correction loop for malformed tool_use input.
- Vault-storage support for Gemini and OpenRouter keys (today they are env-only; see the `VAULT_PROVIDERS` guard in `src/providers/bootstrap.ts`).

### File-tree as source of truth (Phase 3 Track B) — remaining work

The orchestrator, default-on flip, path validator, derived-draft projection, iteration parity, chunked planning, vite-build validation, and inline error UX are shipped (see "Done in this pass"). What remains:

- Multi-round auto-fix loop on broken TypeScript. The validator currently runs once; errors surface to chat via the new "Fix these errors" button and iteration is user-driven.
- Iteration on legacy-template drafts (drafts where `source === "template"` or `source === "llm"`) still uses the regex pipeline. Only file-tree drafts get the new iteration path.
- Streaming per-file progress in the Files tab as the tree lands. Today the Files tab updates after the write phase finishes rather than file-by-file.

### Real persistence + per-app runtime (Phase 3 Track C)

- Replace metadata-only `src/generated-app-runtime.ts` with a real per-app runtime. Each app gets its own Node child process started on first request, kept warm with an LRU pool.
- Per-app `better-sqlite3` (or `node:sqlite`) file on disk, keyed by appId, with a `__schema_version` table. Drop-on-schema-change documented as constraint, not silent corruption.
- Generated app template emits `fetch('/api/...')` calls instead of sql.js + localStorage. Kills the jsdelivr CDN dependency.

### Agent path (Phase 3 Track D)

- Six new tools: `http_fetch`, `slack_post_webhook`, `github_api`, `email_send`, `sql_query`, `shell_for_agent`. Each capability-scoped via the existing `src/tools/registry.ts`.
- Agent-builder UI parity with app-builder: same chat-thread composer switches between app and agent intent based on chip-derived prompt.
- Tool-permissions inline prompt (twin.so pattern): first-call Launch / Edit / Cancel surfaces in chat.
- Agent intent → LLM system prompt produces an `AgentTemplate` shape instead of an `AppBuilderDraft`.

### Sandbox + farm (Phase 3 Track E)

- Wire `src/codegen/validate.ts` to invoke the existing sandbox service for real `tsc --noEmit` + `vite build` against the generated tree.
- Remove synthetic smoke-pass default; sandbox is the default, opt-out for environments without Docker.
- Egress allowlist enforced at the sandbox boundary, not just documented.
- Per-build CPU + memory caps so a runaway build cannot take down the farm.

### Security — cross-cutting (Phase 3)

- Drop the `node:vm` sandbox option entirely. For users without Docker, add a Deno-subprocess sandbox with `--allow-fs-read/write=<workspace>` + `--allow-net=<allowlist>`.
- `process.env` scrubbing on every spawned process (sandbox build, per-app runtime, agent tool execution).
- Network egress deny-by-default + SSRF blocklist (`169.254.169.254`, RFC1918, loopback, IPv6 link-local) + DNS pinning at allowlist-check time.
- Same-origin CSRF fix for generated app preview: serve preview on a different port (or strict CSP) so LLM-authored `fetch('/api/internal-admin')` calls do not carry the user's Taskloom session cookie.
- Typed agent capabilities per resource (`http.fetch:GET:api.github.com`, `fs.write:/workspace/agent-id/`) instead of per-tool global; runtime enforcer wraps every tool call.

### MVP reliability (continuing)

- Add a smoke-test transcript per generated app checkpoint: what ran, what passed, what failed, and how to rerun it.
- Tighten generated app empty/error/loading states so CRUD output feels deliberate, not template-ish.
- Add a focused end-to-end happy path: sign in, build app, approve, preview, iterate, publish handoff.
- Add a focused agent happy path: sign in, build agent, approve, run once with configured provider/tools, inspect result.

### Builder depth (continuing)

- Add file-level review UI for generated source files, with changed/unchanged/new/deleted grouping (most useful once Track B lands).
- Let users regenerate a single route, entity, or component instead of rerunning the whole app draft.
- Add export/download of the generated app workspace as a zip or git-ready folder.
- Add optional package-install planning for generated apps while keeping execution sandboxed.

### Agent depth (continuing)

- Improve provider readiness: show which provider, model, key, and tool permissions are required before first run.
- Add first-run evaluation: expected input, actual output, tool calls, and pass/fail notes.
- Add agent memory / input schema examples that users can edit from the Builder.
- Add agent import/export so templates and generated agents can move between installs.

### Self-host publish

- Turn publish handoff into a clearer "run this generated app" path for local Docker Compose.
- Add generated app health endpoint and static asset manifest validation.
- Add signed or checksum-based artifact manifest verification for exported bundles.
- Document reverse-proxy examples for local network / VPN deployment.
- Add a minimal "public URL configured" check that verifies the configured URL actually reaches the published app.

### Quality bar

- Search for placeholders, demo-only text, fake success language, and vague "coming soon" states before every release.
- Keep `npm run typecheck`, `npm test`, `npm run build:web`, and `npm audit --omit=dev` green.
- Add regression tests for generated workspace path traversal, preview route serving, publish artifact validation, and rollback.
- Add browser-level screenshots for Builder app mode and agent mode once a stable local browser test path exists.
- Keep generated artifacts out of git and document cleanup / reset commands.

## Later, not MVP

> Hosted-only capabilities (managed deploy with free public subdomain, hosted browser-agent farm, one-click App Store / Play submission, hosted OAuth proxy with pre-wired connectors, cross-tenant user memory, shareable / remixable conversation URLs, managed credit meter) are intentionally out of scope for self-host. See [CLOUD.md](CLOUD.md) for the inventory and what a hypothetical Taskloom Cloud product would need to ship them.

- Collaborative multiplayer editing.
- Hosted cloud deployment managed by Taskloom.
- Full browser IDE with arbitrary repo editing.
- Marketplace templates and shared plugins.
- Multi-region active-active runtime.
- Distributed SQLite or custom database replication.
- Visual click-to-edit with direct DOM edits that bypass the LLM (Replit Element Editor pattern) — possible Phase 4.
- Conversation forking / shareable build URLs — overhyped per the 2026-norms review; skipped.
