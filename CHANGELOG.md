# Changelog

All notable changes to Taskloom are tracked here.

This project follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning once releases are tagged.

## [Unreleased]

### 2026-05-17 — Builder-first refactor, admin consolidation, LLM wire-up

This entry covers the work that landed since the prior changelog snapshot: the workbench was reshaped around a full-bleed Builder, the operator surfaces collapsed under a single Admin tab, the Builder draft + iteration paths got their first real LLM wire-up (Anthropic), and the Fork B (self-host first) positioning was made explicit in the docs.

#### Builder UX

- `/builder` lifted out of the workbench Shell into its own full-bleed route with a dedicated `BuilderLayout`. Topbar no longer leaks into the builder.
- Builder empty state redesigned: Direction A composer + four starter chips, matching the twin.so / Lovable shape.
- Chat thread + per-turn streaming prose, with click-to-edit default-on and per-message revert back to the prior checkpoint.
- App-preview view replaced the workbench Topbar with a minimal header.
- Sentence case copy across the workbench; the uppercase kicker / eyebrow pattern is gone. Raw IDs hidden behind a Details disclosure. Softened CI / CD vocabulary where it leaked into user-facing copy.

#### Admin consolidation + sidebar

- New `/admin/:tab` page consolidates sixteen previously top-level operator surfaces: Roles, SSO, Secrets, Rate limits, Webhooks, Releases, Storage, Backups, Notifications, Operations, Integrations, Activation, Sandbox, Workflows, Billing, Alerts.
- All sixteen views had their page-level chrome stripped so they render correctly inside the tabbed Admin container.
- Back-compat redirects from the sixteen individual admin paths to `/admin/:tab` so existing bookmarks and links keep working.
- Sidebar collapsed from a long secondary nav to four items: Build, Projects, Runs, Admin.

#### LLM wire-up (Anthropic, Fork B)

- `generateAppDraftViaLLM` now calls `AnthropicProvider` for the initial app draft. Falls back to deterministic template-only generation when no key is set — documented explicitly, not silent.
- `applyAppIterationViaLLM` calls `AnthropicProvider` for scoped iteration and emits a real LLM prose stream over SSE, not a synthetic placeholder.
- Multi-provider routing for the builder draft + iteration paths is *not* yet wired through `ProviderRouter` — only Anthropic is supported today at the builder. Agent runs continue to route through the full provider router (Anthropic / OpenAI / MiniMax / Ollama).

#### Generated apps

- sql.js persistence in generated apps with realistic seed data, typed form controls, and the Taskloom eyebrow removed. **Known issue**: sql.js loads from a jsdelivr CDN, so generated apps phone home on first load. Per-app server-side SQLite is scoped under Phase 3 Track C.

#### Fork B positioning + docs

- Added `CLOUD.md`: a deferred-features inventory of hosted-only capabilities (free public subdomains, hosted browser-agent farm, App Store submission, hosted OAuth proxy, cross-tenant memory, shareable conversation URLs, vendor-managed credit meter) and what a hypothetical Taskloom Cloud product would need to ship them.
- Reworked `docs/SELF_HOST.md` as the canonical setup guide: prerequisites, 5-minute quick start, BYO-LLM-key configuration, deploy-your-generated-app section, troubleshooting.
- Added `docs/PHASE3_SCOPE.md` v2 scoping the next chunk: multi-provider BYOK, file-tree codegen, real per-app runtime, six new agent tools, sandbox + farm work, and cross-cutting security hardening. 29–39 focused days, 6–9 calendar weeks for a solo engineer at ~60% focused time.
- README reframed to lead with the Fork B story: self-host first, multi-provider BYOK as the aim, honest about today's Anthropic-only builder and the sql.js CDN.
- Fixed five Fork B blockers caught in peer review (positioning + doc drift); Phase 1 UX debt cleanup (back chevron, kicker leftover, dead code, name dedup); leftover stash conflict marker fix.

### Earlier work (carried forward to this release)

#### Added

- Builder-first generated app runtime: prompt-to-app writes a real React/Vite source workspace to `data/generated-apps/<workspace>/<app>/workspace`.
- Generated app preview route at `/api/app/generated-apps/:appId/preview`, including nested source and asset serving from the generated workspace.
- Generated source manifest with file hashes, byte counts, workspace path, app slug, checkpoint ID, and source file summaries.
- Source-diff iteration flow that compares previous and candidate generated files before applying scoped app changes.
- Rollback support that restores checkpoint source artifacts instead of regenerating unrelated source metadata.
- Local publish handoff that materializes generated bundles, runtime config, artifact manifests, and Taskloom-served preview URLs.
- Builder UI support for generated source file summaries, workspace metadata, publish handoff copy, and clearer preview status.
- OSS launch basics: MIT license, security policy, `.env.example`, Dockerfile, and Docker Compose starter.
- Production startup hardening for security-sensitive settings and clearer local/development defaults.

#### Changed

- Builder copy now distinguishes saved local previews from public deployments.
- Generated runtime output and publish exports are ignored by git to keep local build artifacts out of commits.

#### Fixed

- Provider/tool readiness now fails loudly for missing required setup instead of implying a real run happened.
- Agent dry-run paths are labelled explicitly.
- Publish validation now blocks missing generated bundle/workspace artifacts.
- Generated preview routes resolve actual app IDs, slugs, checkpoints, and nested files instead of relying on placeholder preview paths.

## [0.1.0] - In development

Initial public development line for the Taskloom self-hosted app and agent workbench.

### Included

- Prompt-to-agent and prompt-to-app builder flows.
- App drafts, checkpoints, scoped iteration, local preview, smoke checks, and publish handoff.
- Agent templates, runs, transcripts, tool-call timeline, jobs, schedules, webhooks, secrets, audit, RBAC, and sandbox surfaces.
- JSON store for contributor flow, SQLite for single-node installs, and managed Postgres support behind explicit startup gates.
- React workbench, Hono API, and Node 22 runtime.
