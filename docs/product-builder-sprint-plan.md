# Product Builder Sprint Plan

Taskloom's next product track targets feature parity with prompt-first builders such as Replit, Anything, Base44, Twin, and Netlify while staying self-hostable. The product goal is simple:

> Prompt -> plan -> generate -> preview -> fix -> publish.

This track deliberately scales back the previous enterprise-first posture. Keep invisible safety rails that prevent obvious data loss, but make the primary user experience fast, visual, and builder-led.

## Product Positioning

Taskloom should become a self-hosted AI app and agent builder for teams that want Replit/Base44-style speed without giving up ownership of code, runtime, data, and deployment targets.

The core promise:

- Describe an app, automation, or agent in plain English.
- Get a working draft with UI, backend routes, database schema, auth, AI, triggers, and integrations.
- Preview it immediately.
- Iterate in chat.
- Publish to a local/self-hosted URL.
- Keep the code and data portable.

## Guardrail Policy

The main product path should feel lightweight. Keep these guardrails:

- Autosave checkpoint before AI-generated changes.
- One-click rollback to the last working checkpoint.
- Preview before publish.
- Confirmation for destructive database, filesystem, or deployment actions.
- Secrets are stored through the existing API key/environment variable surfaces and never printed in logs.
- Clear dev/prod/local labels.

Defer these guardrails to advanced deployment mode:

- Multi-stage release evidence bundles.
- Strict production activation gates.
- Managed database topology certification.
- Extended operator handoff reports.
- Compliance-oriented review workflows.

## Six Sprint Lanes

Every sprint should move all six lanes forward. Each lane has a directly shippable product surface, so progress is visible even before the full builder loop is complete.

### Lane 1: Prompt Builder

Owns the natural-language intake and planning flow.

- Prompt intake for agents, apps, automations, and fixes.
- Clarifying questions when the prompt is underspecified.
- Plan preview before mutation.
- Generated feature list, data model, page map, tool list, and acceptance checks.
- Starter prompt gallery.
- Prompt history and regenerate/refine controls.

Exit signal: a user can describe what they want and receive a structured build plan that can be approved.

### Lane 2: App And Agent Generation

Owns code/config generation.

- Prompt-to-agent draft generation: name, description, instructions, tools, input schema, trigger, schedule/webhook, and test input.
- Prompt-to-app draft generation: pages, components, API routes, database schema, auth requirement, permissions, and seed data.
- Template-backed generation for common categories.
- Edit/regenerate individual generated sections without restarting.
- Diff view for generated files/config.

Exit signal: approved plans create editable Taskloom agents and generated app artifacts.

### Lane 3: Runtime And Preview

Owns making generated work visible and testable.

- Live preview panel for generated apps.
- Agent test-run panel with transcript, tool calls, model/cost, and output.
- Build/test status panel.
- App smoke checks generated from the plan.
- Runtime error capture with "fix this" handoff back to the prompt builder.
- QR/mobile preview path if the generated target supports it.

Exit signal: every generated app or agent has a preview URL and a first-run result.

### Lane 4: Integrations And Tools

Owns built-in capabilities that generated agents/apps can use.

- Provider setup for OpenAI, Anthropic, local/Ollama, and custom API-compatible providers.
- Browser scraping/search tools.
- Email/webhook triggers.
- Slack/GitHub-style webhook connector templates.
- File/document import primitives.
- Payments primitive for Stripe-style checkout/subscription flows.
- Database CRUD primitive and admin table UI.
- Model routing modes: fast, smart, cheap, local.

Exit signal: generated work can choose useful tools from a simple marketplace-like surface.

### Lane 5: Publish And Hosting

Owns deployability.

- One-click local publish using the existing Hono/Vite build path.
- Docker Compose export.
- Environment variable checklist.
- Generated health check and smoke check.
- Publish history with rollback to prior build.
- Optional adapters for Netlify/static frontend, Fly/Railway/VPS, or custom Docker hosts.
- Public share link handoff for preview builds.

Exit signal: a generated project can be published to a self-hosted URL with logs and rollback.

### Lane 6: UX, Templates, And Onboarding

Owns product feel and first-run success.

- Builder dashboard as the primary landing experience.
- Template gallery for app and agent starters.
- Empty states that suggest useful prompts.
- Guided onboarding: connect provider, create first app/agent, preview, publish.
- "What changed?" summaries after each AI action.
- Credit/cost visibility where provider calls are used.
- Polished logs/transcripts that non-developers can understand.

Exit signal: a new user can get from signup to a running generated thing without reading docs.

## Sprint Plan

The sprint sequence below maps to Phases 67 through 72. Each sprint is intended to be a bounded execution package across the six lanes.

### Sprint 1 / Phase 67: Prompt-To-Agent Builder

Goal: make Taskloom create real agent drafts from a natural-language prompt.

Lane deliverables:

- Prompt Builder: add an authenticated builder page for natural-language agent intake, clarifying questions, plan preview, regenerate/refine actions, and approval.
- App And Agent Generation: generate agent fields, input schema, enabled tools, trigger, schedule/webhook recommendation, and a starter playbook.
- Runtime And Preview: run the generated agent once with sample inputs and show transcript/tool calls.
- Integrations And Tools: surface available tools and provider readiness in the generation plan.
- Publish And Hosting: expose webhook URL readiness when webhook trigger is selected.
- UX, Templates, And Onboarding: add starter prompts for lead enrichment, support triage, research assistant, and scheduled report writer.

Lane 1 acceptance criteria:

- The builder page is available to signed-in workspace users at a primary app route such as `/builder`, with navigation from the dashboard/sidebar and role-aware disabled states when the user cannot create agents.
- The empty state shows starter prompt cards for lead enrichment, support triage, research assistant, and scheduled report writer. Selecting a starter fills the prompt input without immediately calling the model.
- Submitting a prompt creates a dry-run plan first; it does not create, update, run, schedule, or expose a webhook for an agent until the user approves the plan.
- When the prompt lacks a clear goal, trigger, required inputs, provider/model, or tool/integration intent, the builder returns up to three clarifying questions and keeps the user in a reviewable "needs clarification" state.
- The plan preview includes summary, assumptions, generated agent name/description/instructions, input schema, recommended trigger, schedule or webhook recommendation, enabled tool list, provider/model recommendation, starter playbook, sample test input, acceptance checks, and warnings.
- The plan preview shows readiness for each referenced provider and tool, including missing API key/setup states, and those readiness warnings remain visible before approval and before first run.
- Regenerate creates a new candidate plan from the same prompt and answers; refine applies a user edit to the current candidate plan. Both actions keep the previous candidate visible until the new candidate succeeds.
- Approval converts the selected candidate into the existing agent save shape. By default the saved agent is not automatically run; the user can edit fields first, then run it with the generated sample input.
- After approval, the builder links to the saved agent, shows whether webhook readiness applies, and can start the first run through the existing run surface. The resulting transcript/tool calls must be visible in the builder flow.
- Errors from model calls, validation, missing permissions, provider readiness, or run failures appear inline with a retry path and do not discard the prompt, answers, or latest successful candidate plan.

Backend contracts implemented for the builder page:

- Reuse existing authenticated surfaces for catalog and execution: `GET /api/app/agent-templates`, `GET /api/app/providers`, `GET /api/app/tools`, `POST /api/app/agents`, `PATCH /api/app/agents/:agentId`, `POST /api/app/agents/:agentId/runs`, and webhook rotation/removal endpoints when the approved trigger is `webhook`.
- Dry-run planning is available at `POST /api/app/builder/agent-draft`, requiring a workspace role that can manage builder content. Request shape: `{ prompt }`. Response shape: `{ draft }`.
- Approval is available at `POST /api/app/builder/agent-draft/approve`, requiring the same effective permission as agent creation. Request shape: `{ prompt?, draft?, runPreview?, sampleInputs?, status? }`. Response shape: `{ draft, created, agent, firstRun?, sampleInputs? }`.
- Compatibility generation is also available at `POST /api/app/agents/generate-from-prompt`. Request shape: `{ prompt, create?, approve?, providerId?, model?, status?, runPreview?, sampleInputs? }`. Response shape: `{ draft, created, agent?, firstRun?, sampleInputs? }`.
- The generated `draft.agent` is compatible with existing `SaveAgentInput`: `name`, `description`, `instructions`, `providerId?`, `model?`, `tools`, `enabledTools`, `routeKey?`, `schedule?`, `triggerKind`, `playbook`, `status`, and `inputSchema`.
- Planning metadata beside the agent draft includes `intent`, `summary`, `sampleInputs`, acceptance checks, provider readiness, tool readiness, webhook readiness, first-run blockers, and open questions.
- Phase 67 keeps prompt-builder data request scoped and avoids persisting secrets, raw API keys, webhook tokens, or unredacted model/tool logs.

Frontend contracts needed for the builder page:

- Add typed client methods for the new builder endpoints and keep existing `SaveAgentInput`, `AgentRecord`, `AgentRunRecord`, `ProviderRecord`, and `AvailableTool` types as the canonical frontend data shapes.
- The page state machine covers `empty`, `generating`, `needs_clarification`, `ready`, `approving`, `approved`, `running`, and `error` states so loading/error behavior is deterministic.
- The plan preview is sectioned by outcome, agent draft, inputs, trigger, tools/providers, playbook, acceptance checks, and readiness warnings. Editable fields map directly to `SaveAgentInput`.
- The builder never renders full webhook tokens or secret values; it uses existing token preview/readiness fields and secret-redacted errors.
- The first-run panel consumes the existing `AgentRunRecord` transcript, logs, tool calls, model, cost, and status fields so Phase 67 can share runtime UI components with the agent detail/run pages.

Definition of done:

- User enters one prompt and gets a saved agent draft.
- User can approve, edit, and run the draft.
- Missing provider/tool setup is shown before run.
- First-run result is visible in the builder.

### Sprint 2 / Phase 68: Prompt-To-App Builder

Goal: generate a small full-stack app draft from a prompt.

Lane deliverables:

- Prompt Builder: complete the app-draft planning contract for page map, data model, auth needs, workflows, route privacy, acceptance checks, and builder-visible build/smoke status.
- App And Agent Generation: generate React pages/components, API route stubs, data schema metadata, seed data, and CRUD flows.
- Runtime And Preview: build and preview generated app routes locally.
- Integrations And Tools: support AI feature blocks, database CRUD blocks, scheduled job blocks, and webhook blocks.
- Publish And Hosting: package generated app into the existing web/server runtime.
- UX, Templates, And Onboarding: add templates for CRM, booking app, internal dashboard, task tracker, and customer portal.

Lane 1 acceptance criteria:

- The builder page can switch from agent drafting to app drafting without leaving the primary `/builder` surface. App drafting uses the same signed-in workspace context and keeps role-aware disabled states when the user cannot create builder content.
- Submitting an app prompt creates a dry-run app plan first; it does not write generated files, create API routes, mutate data schemas, seed records, publish public routes, or start a build until the user applies the selected draft.
- When the prompt lacks target users, primary objects, required views, auth/private-public intent, CRUD workflow, integrations, or acceptance expectations, the builder returns up to three clarifying questions and keeps the user in a reviewable "needs clarification" state.
- The plan preview includes app summary, assumptions, page map, route privacy decisions, data model, workflows, seed data summary, generated file list, acceptance checks, build status, smoke-check status, and warnings.
- Route privacy is explicit for every generated route. Private app routes must stay under `/api/app/generated/:appSlug/...` and require authenticated workspace membership plus the generated route permission policy. Public routes must stay under `/api/public/generated/:appSlug/...`, must be listed in the plan with rationale, and must never expose workspace-private data unless the draft includes an explicit share-token or webhook-token design.
- Page privacy is explicit for every generated frontend route. Private pages live under authenticated app navigation such as `/generated/:appSlug/...`; public pages require an explicit public/share route decision and must show whether they are anonymous, share-token gated, or webhook-token backed.
- Data model output identifies each entity, field, type, required flag, relationship, unique key, generated ID policy, timestamp policy, validation rules, and which pages/routes read or mutate the entity.
- Auth needs identify the minimum workspace role for reading, creating, updating, deleting, publishing, and running smoke checks. Defaults are conservative: generated CRUD pages and private API routes require signed-in workspace members, mutating routes require member/admin/owner according to risk, and public access is opt-in per route.
- Workflow output lists the primary user journeys as ordered steps, including happy path, empty state, validation failure, permission failure, and destructive-action confirmation when deletion or irreversible state change is generated.
- Acceptance checks are generated as user-visible criteria plus machine-checkable smoke cases. At least one smoke case must cover the primary CRUD loop: create record, read it in the generated page/API, update it, and delete or archive it if the model allows removal.
- Build and smoke status are first-class plan fields. The builder should surface `not_run`, `queued`, `running`, `passed`, `failed`, or `blocked`, with timestamps, command/check names, redacted logs, and retry/apply guidance.
- Regenerate creates a new app-draft candidate from the same prompt and answers; refine applies a user edit to the current candidate. Both actions keep the previous candidate visible until the new candidate succeeds.
- Applying a draft creates an autosave checkpoint, records what generated artifacts would change, and returns a preview/build status. A failed apply must keep the dry-run plan available and must not leave partially public routes marked as published.
- Errors from model calls, validation, missing permissions, build checks, smoke checks, or route privacy conflicts appear inline with a retry path and do not discard the prompt, answers, or latest successful app-draft candidate.

Backend contracts for the app builder:

- Dry-run planning should be available at `POST /api/app/builder/app-draft`, requiring a workspace role that can manage builder content. Request shape: `{ prompt, answers?, templateId?, mode? }`. Response shape: `{ draft }`.
- Approval should be available at `POST /api/app/builder/app-draft/apply`, requiring the same effective permission as generated app creation. Request shape: `{ prompt?, draft, runBuild?, runSmoke?, targetStatus? }`. Response shape: `{ draft, applied, app, checkpoint?, build?, smoke?, previewUrl? }`.
- Phase 68 implements the canonical dry-run/apply split. Apply persists a recoverable `generatedApps` record with `slug`, `status`, `draft`, `checkpointId`, `previewUrl?`, build status, and smoke status, and records a builder activity. The compatibility alias `POST /api/app/builder/app-draft/approve` maps to the same apply handler.
- Successful smoke apply returns a routable authenticated preview path under `/builder/preview/:workspaceId/:appId/...`; this is a preview shell until later phases replace it with rendered generated files.
- Compatibility generation may also be exposed later at `POST /api/app/generated-apps/generate-from-prompt`, but Phase 68 should treat the builder routes above as canonical so dry-run and apply stay separated.
- The generated `draft.app` shape should include `slug`, `name`, `description`, `pageMap`, `dataModel`, `apiRoutes`, `frontendRoutes`, `workflows`, `seedData`, `authPolicy`, `files`, `acceptanceChecks`, `build`, `smoke`, `warnings`, and `openQuestions`.
- `pageMap` entries should include `id`, `title`, `path`, `privacy`, `purpose`, `components`, `dataDependencies`, `actions`, `emptyState`, and `acceptanceChecks`.
- `apiRoutes` entries should include `method`, `path`, `privacy`, `permission`, `handlerIntent`, `requestSchema`, `responseSchema`, `dataEntities`, and `sideEffects`.
- `authPolicy` should include `defaultPrivacy`, `roleRequirements`, `publicRoutes`, `shareTokenRoutes`, `webhookRoutes`, `sensitiveFields`, and `destructiveActions`.
- `build` should include `status`, `command`, `startedAt?`, `finishedAt?`, `logs?`, and `errors?`; `smoke` should include `status`, `checks`, `startedAt?`, `finishedAt?`, `logs?`, and `errors?`.
- Phase 68 keeps prompt-builder data request scoped and avoids persisting secrets, raw API keys, generated bearer tokens, unredacted route logs, or sample records that look like production personal data.

Frontend contracts needed for the builder page:

- Add typed client methods for the app-draft endpoints and keep the dry-run/apply split visible in the API layer.
- The page state machine covers `empty`, `generating`, `needs_clarification`, `ready`, `applying`, `applied`, `building`, `smoke_testing`, and `error` states.
- The plan preview is sectioned by outcome, page map, data model, route privacy, workflows, generated artifacts, acceptance checks, build status, smoke status, and warnings.
- The route privacy section must show every generated frontend and backend route with a private/public/share-token/webhook label before apply.
- The builder never renders full secrets, generated tokens, cookie values, authorization headers, or unredacted sample payloads. Redacted logs are acceptable when they preserve enough context to fix build and smoke failures.

Definition of done:

- User enters one prompt and gets a navigable generated app draft.
- Generated app includes at least one data-backed CRUD flow.
- Auth/private/public route decisions are explicit.
- Build/test smoke checks run from the builder.
- Phase 68 Lane 1 docs are complete when the dry-run and apply contracts above are reflected in product docs and roadmap, even if later lanes implement the underlying generated files, preview runtime, and publish mechanics.

### Sprint 3 / Phase 69: Live Preview And Iteration Chat

Goal: make iteration fast after the first generation.

Lane deliverables:

- Prompt Builder: support "change this" prompts scoped to selected file/page/agent/config.
- App And Agent Generation: implement scoped patch generation and diff approval.
- Runtime And Preview: hot preview refresh, smoke rerun, error capture, and fix handoff.
- Integrations And Tools: allow generated apps to request additional tools/connectors mid-iteration.
- Publish And Hosting: preview build snapshots tied to checkpoints.
- UX, Templates, And Onboarding: split-screen chat, preview, logs, and diff.

Lane 1 acceptance criteria:

- The builder keeps the user on `/builder` in a split-screen workspace with chat, current app/agent context, preview, logs, checkpoints, and diff review visible without losing the latest generated draft.
- A scoped change prompt can target a generated app, page, file, API route, agent, tool/config block, or captured error. Scope includes the target type, stable target id or path, selected context, current checkpoint id, prompt text, and redacted logs/error details when present.
- Submitting a change prompt creates a dry-run change set first. It does not write files, update agent/config records, rerun build/smoke checks, refresh preview, add integrations, or mark a checkpoint as working until the user applies the reviewed diff.
- The change set preview includes summary, assumptions, affected artifacts, unified diff hunks or structured config updates, route/privacy deltas, requested tool/connectors, acceptance checks, preview/build/smoke plan, warnings, and rollback target.
- Diff review shows additions, removals, generated-file changes, config changes, route/privacy changes, and destructive actions before apply. Users can reject, regenerate, refine, or apply the candidate while the previous working checkpoint remains available.
- Applying a change creates an autosave checkpoint before mutation, applies only the selected change set, records builder activity, and returns updated build/smoke status plus preview refresh guidance.
- Preview refresh is tied to the applied checkpoint. The prior preview remains the last working preview until the new build/smoke result passes or the user accepts a failed-but-reviewable preview state.
- Runtime and build errors can be promoted into fix prompts. The fix prompt carries redacted error message, route/path, command/check name, stack or component location when safe, current checkpoint id, and recent logs, then follows the same dry-run change-set and diff-apply flow.
- Rollback restores the selected checkpoint for generated app artifacts, agent/config updates, preview snapshot, and build/smoke metadata, then refreshes the builder surface and records what was restored.

Backend contracts expected for iteration:

- Scoped change planning should be available at `POST /api/app/builder/changes/draft`, requiring a workspace role that can manage builder content. Request shape: `{ target, prompt, checkpointId?, selectedContext?, errorContext?, mode? }`. Response shape: `{ changeSet }`.
- Diff apply should be available at `POST /api/app/builder/changes/apply`, requiring the same effective permission as the target mutation. Request shape: `{ changeSetId?, changeSet, checkpointId?, runBuild?, runSmoke?, refreshPreview? }`. Response shape: `{ applied, changeSet, checkpoint, app?, agent?, build?, smoke?, preview? }`.
- Preview refresh should be available at `POST /api/app/builder/preview/refresh`. Request shape: `{ appId?, agentId?, checkpointId, runBuild?, runSmoke? }`. Response shape: `{ preview, build?, smoke?, checkpoint? }`.
- Runtime/build error fix prompts should be available at `POST /api/app/builder/fix-prompt`. Request shape: `{ target, checkpointId?, errorContext, prompt? }`. Response shape: `{ prompt, changeSet? }`.
- Checkpoint list and rollback should be available through `GET /api/app/builder/checkpoints?appId=...` or `?agentId=...` and `POST /api/app/builder/checkpoints/:checkpointId/rollback`. Rollback response shape: `{ rolledBack, checkpoint, app?, agent?, preview?, build?, smoke? }`.
- Expected shared types include `BuilderChangeTarget`, `BuilderChangeSet`, `BuilderDiffFile`, `BuilderPreviewState`, `BuilderErrorContext`, `BuilderCheckpoint`, and `BuilderRollbackResult`. Change sets should reference the Phase 68 `generatedApps` record, existing agent records, or generated config records rather than inventing separate ownership.
- Phase 69 keeps change prompts scoped and avoids persisting secrets, raw API keys, generated bearer tokens, full webhook/share tokens, cookie/header values, unredacted stack traces, or production-looking sample data.

Frontend contracts needed for iteration:

- Add typed client methods for change draft/apply, preview refresh, fix prompt, checkpoint list, and rollback while keeping the Phase 68 dry-run/apply separation visible in the API layer.
- The page state machine covers `idle`, `drafting_change`, `diff_ready`, `applying_change`, `refreshing_preview`, `fix_prompt_ready`, `rolling_back`, and `error` states.
- The split-screen builder sections are chat, scoped target picker, preview, logs/errors, diff review, build/smoke status, and checkpoint history.
- The diff review must show every file/config/route touched by the change set and require confirmation for destructive data, public-route, token/webhook, or integration additions.
- The preview panel consumes `BuilderPreviewState` and shows checkpoint id, last refresh status, build/smoke status, preview URL/path, and last working checkpoint without exposing secrets or full tokens.

Definition of done:

- User can ask for a change and see a diff before applying.
- Preview updates after applying.
- Runtime/build errors can be sent back into the builder as a fix prompt.
- Checkpoints allow rollback to the previous working state.
- Phase 69 Lane 1 docs are complete when the scoped change, diff apply, preview refresh, fix prompt, and checkpoint/rollback contracts above are reflected in product docs and roadmap.

### Sprint 4 / Phase 70: One-Click Self-Hosted Publish

Goal: make publish feel like Replit/Netlify while keeping Taskloom self-hostable.

Lane deliverables:

- Prompt Builder: generate publish checklist and deployment assumptions.
- App And Agent Generation: generate runtime config and health/smoke checks.
- Runtime And Preview: run production build locally and validate the URL.
- Integrations And Tools: validate required provider keys, webhooks, email, and payment secrets.
- Publish And Hosting: one-click local publish, Docker Compose export, publish history, rollback command, and logs.
- UX, Templates, And Onboarding: "Published" state with URL, status, logs, and next suggested actions.

Lane 1 acceptance criteria:

- The builder shows a generated publish checklist before any generated app or agent bundle is promoted from preview to published. The checklist covers env readiness, production build, health checks, smoke checks, Docker Compose export, publish history, rollback target, URL handoff, and logs.
- The publish checklist is derived from the app/agent plan, generated integrations, route privacy decisions, and selected hosting target. Missing provider keys, webhook secrets, email credentials, payment secrets, database settings, or public base URLs are listed by env key and affected feature without exposing secret values.
- Deployment assumptions are explicit and reviewable. The builder states whether the publish uses the existing Hono/Vite runtime, local self-hosted URL, public URL, reverse proxy/load balancer, local filesystem publish directory, JSON/SQLite/managed Postgres store posture, background scheduler needs, and any generated webhook or scheduled-job assumptions.
- Local and self-hosted URLs are separate first-class fields. The private/operator URL is used for health and smoke checks first; the public URL is shared only after required checks pass and workspace approval changes visibility to public.
- Health and smoke expectations are generated as user-visible checks plus machine-checkable commands. Health must at least check `/api/health/ready`; smoke must at least check `/api/health/live`, `/api/health/ready`, and the generated app or agent entrypoint.
- Failed health or smoke checks show actionable failure details: check name, URL, method, response status, redacted response body/logs, likely missing env/config/integration, and retry or rollback guidance. A failed required check keeps the publish private and does not replace the last known-good publish.
- Docker Compose handoff is part of the publish package. The generated package records `docker-compose.publish.yml`, app service build context, env placeholders, health check wiring, volume/publish path, optional database service, and handoff notes for private URL, public URL, smoke command, and rollback command.
- Publish history records every attempt with publish id, source checkpoint, generated bundle path, private/public URL, status, health/smoke results, redacted logs, compose export path, current/previous marker, and rollback target.
- Rollback semantics are explicit. The previous publish remains available until the new publish passes required checks; rollback repoints hosting and URL handoff to the last known-good publish, restores health/smoke metadata, records the rollback event, and reruns readiness checks.
- Agent publishes follow the same contract as app publishes, with smoke checks focused on the generated agent test input, trigger/webhook readiness, enabled tools, provider readiness, and first production run handoff.

Backend contracts expected for one-click publish:

- Publish readiness metadata should be available on generated app/agent drafts through `buildAppPublishReadiness()` and later through a builder publish-readiness endpoint. The metadata includes `version`, `publishId`, `workspaceSlug`, `draftSlug`, `localPublishPath`, `runtimeAssumptions`, `publishChecklist`, `packaging`, `envChecklist`, `dockerComposeExport`, `healthCheck`, `smokeCheck`, `publishHistory`, `rollback`, and `urlHandoff`.
- One-click publish should eventually be exposed as `POST /api/app/builder/publish`, requiring the same effective permission as publishing generated builder content. Request shape: `{ target, checkpointId?, visibility?, runBuild?, runHealth?, runSmoke?, exportCompose? }`. Response shape: `{ publish, url, health, smoke, composeExport?, logs?, rollbackTarget? }`.
- Publish readiness should be available before mutation at `POST /api/app/builder/publish/readiness`. Request shape: `{ target, checkpointId?, visibility?, publicBaseUrl?, privateBaseUrl?, requiredEnv?, optionalEnv? }`. Response shape: `{ readiness }`.
- Publish history should be available at `GET /api/app/builder/publishes?appId=...` or `?agentId=...`, returning newest-first publish attempts with redacted logs and current/previous markers.
- Rollback should be available at `POST /api/app/builder/publishes/:publishId/rollback`. Request shape: `{ target?, runHealth?, runSmoke? }`. Response shape: `{ rolledBack, publish, previousPublish, health?, smoke?, url, logs? }`.
- Docker Compose export should be available from the publish package as `docker-compose.publish.yml` plus redacted `.env.example` style guidance. The export must not contain raw API keys, webhook tokens, bearer tokens, cookies, generated share tokens, or production-looking sample data.
- Publish commands must keep the Phase 68/69 dry-run/apply discipline: readiness can be generated without mutation; publish creates or updates history only after an explicit publish action; rollback is a separate explicit action.

Frontend contracts needed for publish:

- Add typed client methods for publish readiness, publish action, publish history, rollback, and compose export when backend routes land.
- The builder state machine covers `ready_to_publish`, `checking_publish_readiness`, `publish_blocked`, `publishing`, `published`, `publish_failed`, `rolling_back`, and `rollback_failed`.
- The publish panel is sectioned by URL handoff, checklist, env requirements, assumptions, health checks, smoke checks, Docker Compose export, logs, history, and rollback.
- Secret and token rendering follows existing redaction rules. Env values are never printed; only key names, setup status, affected feature, and link/action guidance appear.
- A published state shows the URL, visibility, status, latest health/smoke result, compose export availability, rollback target, and next suggested action.

Definition of done:

- User can publish a generated app/agent bundle and receive a URL.
- Health and smoke checks pass or show actionable failure.
- User can rollback to the previous publish.
- Docker Compose export exists for self-hosted handoff.
- Phase 70 Lane 1 docs are complete when the publish checklist, deployment assumptions, local/self-hosted URL handoff, health/smoke expectations, env checklist, Docker Compose handoff, publish history, and rollback semantics are reflected in product docs, roadmap, and `docs/app-publish-readiness.md`.

### Sprint 5 / Phase 71: Integrations Marketplace Lite

Goal: make generated work useful with external systems.

Lane deliverables:

- Prompt Builder: detect requested integrations from prompt and ask for missing setup.
- App And Agent Generation: generate integration-specific flows and env var references.
- Runtime And Preview: test connector calls in sandbox mode.
- Integrations And Tools: add marketplace cards for OpenAI, Anthropic, Ollama, Slack/webhook, email, GitHub webhook, browser scraping, Stripe/payments, and database.
- Publish And Hosting: include integration readiness in publish checklist.
- UX, Templates, And Onboarding: setup wizard for provider keys and webhook URLs.

Definition of done:

- User can connect/configure common integrations from one surface.
- Generated agents/apps can request and use configured integrations.
- Missing secrets block only the affected feature, not the whole builder.
- Connector tests show pass/fail and setup guidance.

### Sprint 6 / Phase 72: Builder Beta Polish

Goal: make the builder coherent enough for a beta user to build and ship without handholding.

Lane deliverables:

- Prompt Builder: saved prompt sessions, project memory, and better clarify/regenerate loops.
- App And Agent Generation: template expansion, generated tests, and reliability cleanup.
- Runtime And Preview: consolidated transcript/log/test timeline.
- Integrations And Tools: model routing presets: fast, smart, cheap, local.
- Publish And Hosting: publish dashboard with previews, production, rollback, and environment status.
- UX, Templates, And Onboarding: first-run checklist, template gallery polish, and nontechnical language pass.

Phase 72 Lane 1 implementation note:

- Add a deterministic builder session memory helper that normalizes saved prompt sessions, project memory facts, clarifying questions, regenerate options, and next-action guidance without wiring it into routes or frontend surfaces yet.

Definition of done:

- A beta user can create, iterate, preview, and publish at least three template categories.
- The builder reports what changed, what failed, and what to do next.
- Generated apps and agents have repeatable smoke tests.
- The README points new users to the builder flow as the primary product path.

## Feature Parity Matrix

| Feature | Replit | Anything | Base44 | Twin | Netlify | Taskloom Target |
| --- | --- | --- | --- | --- | --- | --- |
| Prompt-to-app | yes | yes | yes | partial | yes | Phase 68 |
| Prompt-to-agent/automation | yes | partial | partial | yes | partial | Phase 67 |
| Plan before build | yes | partial | partial | partial | partial | Phase 67 |
| Live preview | yes | yes | yes | partial | yes | Phase 69 |
| One-click publish | yes | yes | yes | partial | yes | Phase 70 |
| Web/mobile preview | partial | yes | partial | no | web | Phase 69+ |
| Database/auth generated | yes | yes | yes | partial | partial | Phase 68 |
| Scheduled jobs/webhooks | yes | yes | partial | yes | yes | Phase 67-71 |
| Integrations marketplace | yes | yes | yes | yes | yes | Phase 71 |
| Model routing | partial | partial | hidden | yes | gateway | Phase 72 |
| Self-hosted ownership | no | no | no | no | no | core differentiator |

## Phase Tracking

The new product-builder phases begin after Phase 66:

- Phase 67: Prompt-To-Agent Builder.
- Phase 68: Prompt-To-App Builder.
- Phase 69: Live Preview And Iteration Chat.
- Phase 70: One-Click Self-Hosted Publish.
- Phase 71: Integrations Marketplace Lite.
- Phase 72: Builder Beta Polish.

These phases supersede further enterprise-hardening work as the main product priority. The earlier deployment-hardening track remains available for advanced deployments, but it is no longer the default roadmap spine.

## Documentation Updates Required Per Sprint

Each sprint should update:

- `docs/product-builder-sprint-plan.md` with completed scope and next sprint adjustments.
- `docs/roadmap.md` with phase completion notes.
- `README.md` with user-facing changes when the primary builder flow changes.
- Any feature-specific docs for new connectors, publish targets, or generated app primitives.

## References

- Replit Agent: https://docs.replit.com/core-concepts/agent/
- Replit agents and automations: https://docs.replit.com/core-concepts/agent/agents-and-automations
- Anything builder basics: https://www.anything.com/docs/first-app
- Base44 AI app builder: https://base44.com/ai-app-builder
- Twin agent automation: https://twin.so/
- Netlify platform and AI deployment: https://docs.netlify.com/ and https://netlify.ai/
