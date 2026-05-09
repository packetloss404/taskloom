# MVP Testing Guide

End-to-end manual test plan for the builder-first Taskloom MVP. The golden path is:

```text
sign in -> /builder -> create app/agent -> preview/test -> iterate -> publish/run
```

Use this checklist before beta handoff, after meaningful UI changes, and as a smoke pass for new self-hosted deployments. Advanced operations, admin, and deployment tools are still part of the product, but they are no longer the first-run path; verify them from the Advanced area after the builder loop works.

Estimated time: **25-35 minutes** for a full pass; **~10 minutes** for the golden-path subset marked with a star.

---

## 0. Prerequisites

- Node `>=22.5.0` and npm installed.
- Optional but recommended: Docker daemon running so sandbox smoke checks can use the `docker` driver.
- Clean working tree on the repo.

```bash
npm install
npm run db:migrate          # if testing against SQLite
npm run db:seed              # creates seed accounts
```

Seed accounts, all with password `demo12345`:

- `alpha@taskloom.local` owner
- `beta@taskloom.local`
- `gamma@taskloom.local`

To wipe state between full passes:

```bash
npm run store:reset    # JSON store
npm run db:reset       # SQLite store
```

---

## 1. Boot The App Star

```bash
npm run dev
```

Open `http://localhost:7341/` in development, or `http://localhost:8484/` after `npm run build:web && npm start`.

Acceptance:

- [ ] Page loads with the workbench visual design, not unstyled HTML.
- [ ] Signed-out users see a clear sign-in/get-started entry point.
- [ ] Sign-in routes to `/sign-in`.
- [ ] No console errors or failed asset requests appear on first load.

---

## 2. Sign In To Builder Star

1. Click **Sign in**.
2. Enter `alpha@taskloom.local` / `demo12345` and submit.
3. Land on `/builder`, or navigate there immediately if a transitional route sends you elsewhere.

Acceptance:

- [ ] The signed-in MVP entry is the builder workspace at `/builder`.
- [ ] Sidebar/top navigation makes **Builder** or **New build** the primary creation action.
- [ ] Workspace name, user display name, and role are visible somewhere in the workbench shell.
- [ ] The user can start creating without visiting reporting, operations, or admin pages first.

Sign-up smoke, in a private window:

- [ ] `/sign-up` creates a workspace user.
- [ ] Onboarding completion moves the user into the builder-first workbench path.
- [ ] Sign-out returns to the unauthenticated entry point.

---

## 3. Builder App Loop Star

Visit `/builder`.

### Create A Draft

1. Type a prompt such as `Build a lightweight CRM for renewal tracking`.
2. Click the primary generate action.

Acceptance:

- [ ] Calls `POST /api/app/builder/app-draft`.
- [ ] The draft is shown before mutation with app name, summary, plan steps, page map, data model, acceptance checks, warnings, and open questions when needed.
- [ ] Preview/test/build status is visible in the builder flow, even when checks are `not_run`, `blocked`, or `failed`.
- [ ] Missing provider, tool, env, auth, or smoke prerequisites are shown as setup guidance without exposing secrets.

### Apply And Preview

1. Approve/apply the reviewed draft.
2. Open the preview area.

Acceptance:

- [ ] Calls `POST /api/app/builder/app-draft/apply`.
- [ ] A generated app record/checkpoint is created.
- [ ] The preview path is visible, preferably under `/builder/preview/:workspaceId/:appId/...`.
- [ ] Build/smoke results are visible with check names, statuses, timestamps, and redacted logs.
- [ ] At least one generated CRUD smoke case covers create, read, update, and delete or archive when removal is part of the app.

### Iterate

1. Submit a refinement such as `Add an inline notes field to Account`.
2. Review the proposed change or diff before applying it.

Acceptance:

- [ ] Iteration creates a dry-run change set before mutation.
- [ ] The preview explains affected artifacts, route/privacy changes, acceptance checks, build/smoke plan, warnings, and rollback target.
- [ ] Applying the change creates a new checkpoint, refreshes preview/test status, and keeps the previous working preview available until the new result is usable.
- [ ] Runtime or build errors can be sent back into the builder as a fix prompt with redacted context.

### Rollback

1. Open the checkpoint/history area.
2. Restore a previous non-current checkpoint.

Acceptance:

- [ ] Calls the builder checkpoint rollback endpoint.
- [ ] Current pointer, preview state, and build/smoke metadata update.
- [ ] The rollback event is visible in the builder timeline/history.

---

## 4. Builder Agent Loop Star

From `/builder`, switch to agent creation or choose an agent template/starter.

1. Type a prompt such as `Create a support triage agent that summarizes new tickets and drafts a reply`.
2. Generate a draft.
3. Approve/save the agent.
4. Run it with the generated sample input.

Acceptance:

- [ ] Calls `POST /api/app/builder/agent-draft` for dry-run planning.
- [ ] Draft preview includes name, description, instructions, input schema, trigger, schedule or webhook recommendation, tools, provider/model recommendation, starter playbook, sample input, acceptance checks, and readiness warnings.
- [ ] Approval calls `POST /api/app/builder/agent-draft/approve` or the documented compatibility route.
- [ ] The saved agent can be edited before the first run.
- [ ] The first run result appears in the builder flow with transcript, tool calls, model/cost, output, logs, and status when available.
- [ ] Webhook tokens, API keys, provider secrets, and bearer values are never rendered in full.

---

## 5. Publish Or Run Star

### Generated App Publish

From the builder publish area:

- [ ] Publish readiness shows env readiness, production build, health checks, smoke checks, Docker Compose export, URL handoff, publish history, rollback target, and redacted logs.
- [ ] Missing provider keys, webhook secrets, email credentials, payment secrets, database settings, and base URLs are named by env key or feature without exposing values.
- [ ] Publish validates a private/operator URL first.
- [ ] A public URL is shared only after required checks pass and the user explicitly approves public visibility.
- [ ] Failed required checks keep publish private and preserve the previous known-good publish.
- [ ] Publish history records each attempt and rollback can restore the previous known-good publish.

### Agent Run

For an approved agent:

- [ ] Run action starts from the builder or saved agent link.
- [ ] `/runs` or the builder run panel shows the resulting status.
- [ ] Run detail includes transcript, tool calls, output, logs, cost/model, and retry/diagnose controls where allowed.

---

## 6. Preview, Sandbox, And Smoke

Sandbox is an Advanced-capable system, but the builder may surface it when smoke checks use sandbox execution.

Visit `/sandbox` only after the builder path works, or open the builder Sandbox tab after an app is approved.

Acceptance:

- [ ] Status panel shows the active driver: `docker` as ready when available, or `native` clearly marked insecure.
- [ ] Running `echo hello sandbox` succeeds with stdout visible and exit code `0`.
- [ ] Canceling a long-running command updates status to `canceled`.
- [ ] Builder-scoped sandbox executions are tied to the current app/checkpoint when smoke checks run.

Opt-in smoke integration:

1. Stop the dev server.
2. Set `TASKLOOM_SANDBOX_SMOKE_ENABLED=1`.
3. Restart, sign in, and apply an app draft with smoke enabled.

Acceptance:

- [ ] Smoke messages identify sandbox verification and driver when sandbox execution is available.
- [ ] If sandbox is unavailable, fallback smoke status is explicit and actionable.

---

## 7. Advanced Surfaces

These areas are hidden behind Advanced navigation in the MVP posture. They are not deleted, and they should still render for users with the right role.

Operations and deployment:

- [ ] `/operations` renders subsystem health, alerts, and job metrics.
- [ ] `/storage` renders store status and database details.
- [ ] `/backups` renders storage topology and release evidence panels.
- [ ] `/releases` renders release history and preflight status.

Workspace admin:

- [ ] `/settings` renders Members, Invitations, Share tokens, API keys, Workspace, and Audit tabs.
- [ ] `/roles` renders role membership counts.
- [ ] `/sso`, `/secrets`, `/webhooks`, `/rate-limits`, `/notifications`, and `/billing` render without forcing the first-run builder path through admin setup.

Acceptance:

- [ ] Advanced pages are reachable through Advanced navigation or direct URL for authorized users.
- [ ] Advanced pages do not replace `/builder` as the MVP starting point.
- [ ] Role-aware disabled states or redirects appear for users who lack permission.

---

## 8. Command Palette

Press **Cmd+K** or **Ctrl+K**, or click the sidebar search affordance.

Acceptance:

- [ ] Modal opens with navigation/actions.
- [ ] Typing filters entries.
- [ ] Keyboard navigation works with up/down, enter, and escape.
- [ ] Builder/new-build entries are prominent.
- [ ] Advanced operations/admin entries are present but visually secondary or grouped under Advanced.

---

## 9. Public Share And 404

Public share:

- [ ] A valid `/share/<token>` renders without auth.
- [ ] It does not show the signed-in workbench sidebar.
- [ ] A sign-in link is visible.

404:

- [ ] Unknown routes render a styled 404.
- [ ] Primary recovery action returns signed-in users to `/builder` or the builder-first workbench entry, and signed-out users to `/`.

---

## 10. Build And Tests

Run the relevant layer for the change being handed off:

```bash
npm run typecheck
npm run test:api
npm run test:web
npm run build
```

Acceptance:

- [ ] Commands selected for the change exit `0`.
- [ ] No new TypeScript errors.
- [ ] Production bundle is generated under `web/dist/` when `npm run build:web` or `npm run build` is selected; do not commit it.

---

## Golden-Path Subset Star

If you only have time for one pass, do this:

1. Sign in as `alpha@taskloom.local`.
2. Go directly to `/builder`.
3. Create an app draft from a prompt.
4. Apply it, preview it, and check build/smoke status.
5. Iterate once, apply the change, and verify checkpoint history.
6. Publish the app or verify publish readiness blocks with actionable guidance.
7. Create or save an agent from `/builder`, run it once, and verify transcript/tool-call output.
8. Confirm Advanced surfaces are still reachable but are not the first-run path.

If an acceptance line fails, capture the network request/response and browser console output before filing the issue. Reference the section number in the bug title, for example `MVP 3 builder iteration: rollback returns 404`.
