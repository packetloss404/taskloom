# MVP Testing Guide

End-to-end manual test plan for verifying that a Taskloom MVP deployment behaves correctly. Use this checklist before any beta handoff, after every meaningful UI change, and as a smoke pass for new self-hosted deployments.

Estimated time: **30–45 minutes** for a full pass; **~10 minutes** for the golden-path subset (marked ⭐).

---

## 0. Prerequisites

- Node `>=22.5.0` and npm installed.
- (Optional but recommended) Docker daemon running so the sandbox subsystem uses the `docker` driver instead of falling back to `native`.
- Clean working tree on the repo.

```bash
npm install
npm run db:migrate          # if testing against SQLite
npm run db:seed              # creates seed accounts
```

Seed accounts (password `demo12345`):

- `alpha@taskloom.local` (owner)
- `beta@taskloom.local`
- `gamma@taskloom.local`

To wipe state between full passes:

```bash
npm run store:reset    # JSON store
npm run db:reset       # SQLite store
```

---

## 1. Boot the app ⭐

```bash
npm run dev
```

Open `http://localhost:7341/` (dev) or `http://localhost:8484/` (built `npm start`).

**Acceptance**

- [ ] Page loads to the workbench (silver/grey/green theme — no Tailwind amber, no white-on-black "raw" look).
- [ ] Unauthenticated user sees the marketing/landing hero with "What do you want to weave today?" + "Sign in" / "Get started" buttons.
- [ ] Sign-in button routes to `/sign-in` rendered in workbench design (serif "in" with green accent).
- [ ] No console errors; no failed asset requests in the network tab.

---

## 2. Auth + onboarding ⭐

### Sign-in

1. Click **Sign in**.
2. Enter `alpha@taskloom.local` / `demo12345`. Submit.

**Acceptance**

- [ ] Redirects to `/dashboard`.
- [ ] Sidebar shows the workspace name (not "Acme Renewals"), user display name, and `OWNER` role pill.
- [ ] Topbar crumb shows the real workspace name as the first segment.

### Sign-up (in a private window)

1. Visit `/sign-up`. Enter a new display name / email / password.
2. After redirect, complete the onboarding steps at `/onboarding`.

**Acceptance**

- [ ] Each onboarding step's "Mark done" button advances the progress bar and toasts on error.
- [ ] When all steps complete, you redirect to `/dashboard` automatically.

### Sign-out

1. Click the user footer in the sidebar.

**Acceptance**

- [ ] Returns to the unauthenticated marketing page.

---

## 3. Dashboard ⭐

Visit `/dashboard`.

**Acceptance**

- [ ] Greeting uses the signed-in user's first name.
- [ ] Four KPI cards render real numbers: Active agents, Runs · 24h, Total agents, Spend · 24h.
- [ ] "Recent agents" panel lists agents from the API (or shows the empty state "No agents yet — create your first one").
- [ ] "Activation" panel shows real % from `/api/app/activation`. "Open checklist" button routes to `/activation`.
- [ ] "Recent activity" pulls from `/api/app/activity`.
- [ ] **Refresh** button forces a refetch.
- [ ] **New build** button routes to `/landing`.

---

## 4. New build (landing) → Agents

Visit `/landing`.

1. Pick a sample-prompt card to populate the textarea.
2. Switch the mode pill to **Build an agent**.
3. Click **Build**.

**Acceptance**

- [ ] Mode pill toggles between "Build an app" / "Build an agent" with active styling.
- [ ] Clicking **Build** calls `POST /api/app/builder/agent-draft` and routes to `/agents` on success.
- [ ] If the API errors, the form displays an inline `ERR · …` message in danger color.
- [ ] "Continue a recent build" lists real recent agents (or empty state).

---

## 5. Agents catalog + editor

### Catalog

Visit `/agents`.

**Acceptance**

- [ ] Tab strip: **Catalog** | **Templates**. Catalog is selected by default.
- [ ] Catalog grid renders one card per agent with: status pill, model, trigger, tool count, 7-day run stats, success rate (only when there are runs).
- [ ] **Refresh** button refetches.
- [ ] **New agent** button (top-right) routes to `/agents/new`.
- [ ] Click any agent card → routes to `/agents/:id`.

### Templates

1. Click the **Templates** tab.
2. Click **Use template** on any card.

**Acceptance**

- [ ] Templates load via `GET /api/app/agent-templates`.
- [ ] **Use template** calls `POST /api/app/agents/from-template/:id` and routes to the new agent's editor.

### Editor

Visit `/agents/:id` (any existing agent).

**Acceptance**

- [ ] Form sections: Identity, Model, Instructions, Trigger (with cron validation when `Schedule` is selected), Playbook editor, Tool picker (read/write/exec columns), Input schema editor.
- [ ] Editing the cron value shows next-run estimate or `ERR · …` when invalid.
- [ ] **Save agent** posts to `PATCH /api/app/agents/:id` and shows `OK · Agent saved.`
- [ ] **Run now** posts to `POST /api/app/agents/:id/runs`. After the run completes, "Recent runs" lists the new run with an expandable transcript + tool-call timeline.
- [ ] If trigger is `webhook`, the **Generate webhook URL** / **Rotate token** / **Remove** buttons are wired and update the displayed token.
- [ ] **Archive** sends to `DELETE /api/app/agents/:id` and routes back to `/agents`.

### New agent

Visit `/agents/new`. Fill out a minimal form. Submit.

**Acceptance**

- [ ] **Create agent** posts to `POST /api/app/agents` and redirects to `/agents/:newId`.

---

## 6. Builder iteration loop ⭐

Visit `/builder`.

### Drafting

1. Type a prompt (e.g. "Build a lightweight CRM for renewal tracking").
2. Click **Generate draft**.

**Acceptance**

- [ ] Calls `POST /api/app/builder/app-draft` and renders the draft in the left chat column: app name, summary, plan steps, acceptance checks, open questions.
- [ ] Right pane defaults to the **Preview** tab and shows app skeleton (pages, API routes, data entities).

### Approve & apply

1. Click **Approve & apply**.

**Acceptance**

- [ ] Calls `POST /api/app/builder/app-draft/apply`.
- [ ] Status pill flips from `draft` to `built`.
- [ ] **Smoke / Build** tab shows a status: `pass` / `fail` / `warn` with per-check entries.
- [ ] **Checkpoints** tab shows at least one checkpoint marked `current`.
- [ ] **Sandbox** tab appears (see §10 for what to verify there).

### Iterate

1. With an approved app, type a refinement (e.g. "Add an inline notes field to Account").
2. Choose a target pill (e.g. `Whole app`). Click the up-arrow button.

**Acceptance**

- [ ] Calls `POST /api/app/builder/app-iteration`.
- [ ] An iteration card appears with file diff list (A/M/D markers + paths).
- [ ] **Apply diff** calls `POST /api/app/builder/app-iteration/apply`, runs build + smoke, creates a new checkpoint, and refreshes the preview.

### Rollback

1. Open **Checkpoints**. Click **Restore** on a non-current entry.

**Acceptance**

- [ ] Calls `POST /api/app/builder/checkpoints/:id/rollback` and updates the current pointer.

### Publish

1. Open the **Publish** tab.

**Acceptance**

- [ ] Status panel shows publish status from `GET /api/app/builder/publish/state`.
- [ ] **Publish now** posts to `POST /api/app/builder/publish`. History table populates.
- [ ] If history has entries, status pills color-map (`published` → good, `rolled_back` → warn, others → muted).

---

## 7. Workflows

Visit `/workflows`.

**Acceptance**

- [ ] Tab strip: Brief / Requirements / Plan / Blockers · Questions / Validation / Release.
- [ ] **Brief** tab pulls from `GET /api/app/workflow/brief` (or shows the empty-state copy if not saved yet).
- [ ] **Plan** tab lists items from `GET /api/app/workflow/plan-items` with status pills (`done` / `in_progress` / `todo`).
- [ ] **Blockers · Questions** renders both columns.
- [ ] **Release** tab — the **Confirm release** button posts to `POST /api/app/workflow/release-confirmation` and refreshes the panel.

---

## 8. Runs · Activity ⭐

Visit `/runs`.

**Acceptance**

- [ ] KPI row shows real numbers (Total · 24h, Success rate, Median latency, Failed).
- [ ] Hourly sparkline renders (green = success, red = failed).
- [ ] Filter buttons (`all` / `success` / `failed` / `running` / `queued`) filter the table.
- [ ] **View** on a row routes to `/runs/:id`.

### Run detail

Visit `/runs/:id` (clicked from the list).

**Acceptance**

- [ ] Shows status pill, agent name, trigger, model, cost, duration in the header.
- [ ] Transcript, Tool calls, Output, Logs panels render real data when present.
- [ ] **Cancel** and **Retry** buttons wire to `POST /api/app/agent-runs/:id/cancel` / `…/retry` (visible only when `canCancel` / `canRetry` is true).
- [ ] **Diagnose** button calls `POST /api/app/agent-runs/:id/diagnose` and prints the summary in the diagnostic banner.

---

## 9. Providers / Tools / Env

Visit `/integrations`.

**Acceptance**

- [ ] Provider cards show real entries from `GET /api/app/providers` with status pills.
- [ ] Tool registry table populates from `GET /api/app/tools`.
- [ ] Env vars table populates from `GET /api/app/env-vars`. Secret rows show the shield icon.

---

## 10. Sandbox ⭐

### Status

Visit `/sandbox`.

**Acceptance**

- [ ] Status panel shows the active driver:
  - `docker` → green pill, runtimes (`node-20`, `python-3.11`, `ubuntu-22`) listed with ready dots.
  - `native` → warn pill labelled **INSECURE** with the host-isolation note.
- [ ] If `TASKLOOM_SANDBOX_DRIVER=docker` is set but Docker isn't running, status reports `available: false`.

### Run a command

1. In the composer: command `echo hello sandbox`, runtime `node-20` (or `ubuntu-22` for `native` fallback), working dir `/workspace`. Click **Start**.

**Acceptance**

- [ ] An exec appears in the history table with status `running` or `success`.
- [ ] Selecting it opens the live log viewer; stdout shows `hello sandbox`.
- [ ] Exit code = 0, status pill = `success`.
- [ ] Stream automatically closes when the exec completes.

### Cancel a long-running command

1. Run `sleep 60` (native) or `sleep 60` against `ubuntu-22`.
2. While it's still running, click **Cancel**.

**Acceptance**

- [ ] Status pill flips to `canceled` within a few seconds.
- [ ] No zombie processes (verify with `ps` or Docker `docker ps`).

### Builder Sandbox tab

In the Builder, after an app is approved, open the **Sandbox** tab.

**Acceptance**

- [ ] Lists execs scoped to the current `appId` (ones run during smoke / approve, if any).
- [ ] Selected exec shows the same log viewer as the Sandbox view.

### Smoke integration (opt-in)

1. Stop the dev server.
2. Set `TASKLOOM_SANDBOX_SMOKE_ENABLED=1` in your env.
3. Restart, sign in, run an `app-draft/apply` with `runSmoke: true`.

**Acceptance**

- [ ] Smoke build status `message` ends with `(verified via sandbox · driver=…)`.
- [ ] Each check `detail` ends with `sandbox: exit N · Mms`.
- [ ] If sandbox isn't available, the smoke result still computes (synthetic) and the response includes a `Sandbox driver "…" reports unavailable; smoke ran in fallback mode.` blocker.

---

## 11. Operations

Visit `/operations`.

**Acceptance**

- [ ] Subsystems grid renders `store`, `scheduler`, `jobs_queue`, `managed_pg`, `rate_limit`, `access_log`, `alerts`, `sandbox` with status pills (`ok`/`degraded`/`down`/`disabled`).
- [ ] Alerts panel pulls from `GET /api/app/operations/alerts`.
- [ ] Job metrics table pulls from `GET /api/app/operations/job-metrics/history` and color-codes p95.

---

## 12. Settings + admin surfaces

Walk through (no specific actions required — verify each surface renders without error and shows real data):

- [ ] `/settings` — Members, Invitations, Share tokens, API keys, Workspace, Audit tabs.
  - **Workspace** tab: editing name/website/automationGoal and clicking Save persists via `PATCH /api/app/workspace`.
- [ ] `/billing` — usage / spend by provider / spend by agent / spend by route. Numbers come from `GET /api/app/usage/summary`.
- [ ] `/roles` — role member counts reflect real workspace membership.
- [ ] `/sso` — surfaces SSO env vars (or empty-state when none configured).
- [ ] `/secrets` — lists secret env vars with rotate / delete buttons.
- [ ] `/webhooks` — lists webhook-triggered agents with rotate / remove buttons.
- [ ] `/rate-limits` — lists scopes derived from real API keys / agents / providers.
- [ ] `/releases` — release history pulls from `GET /api/app/release-history`. Preflight panel renders.
- [ ] `/notifications` — alerts list + channel cards from notify env vars.
- [ ] `/storage` — engine, on-disk size, page size, last-vacuum stats from `GET /api/app/operations/status`.
- [ ] `/backups` — storage topology + release evidence panels render JSON dumps from operations status.
- [ ] `/activation` — onboarding step list with **Mark done** wired to `POST /api/app/onboarding/steps/:key/complete`.

---

## 13. Command palette ⭐

Press **⌘K** (or **Ctrl+K**), or click the sidebar **Search…** bar.

**Acceptance**

- [ ] Modal opens with a search input + groups: Navigation, Actions, Agents.
- [ ] ↑ / ↓ moves the active item; ↵ runs it; ESC closes.
- [ ] Typing filters across labels and keywords.
- [ ] Selecting a Navigation entry routes there.
- [ ] Selecting an Agent entry calls `POST /api/app/agents/:id/runs` and routes to `/runs`.

---

## 14. Public share

1. From the Settings → Share tokens tab, copy a token preview value.
2. Open `/share/<token>` in a private window.

**Acceptance**

- [ ] Page renders in workbench design with the workspace name + scoped brief / plan content.
- [ ] No sidebar, no auth required.
- [ ] Sign-in link is visible in the header.

---

## 15. 404 handling

Visit `/this-route-does-not-exist`.

**Acceptance**

- [ ] Renders the workbench-styled 404 page (giant serif "404.", green-accent path, action buttons).
- [ ] **Back to dashboard** routes to `/dashboard` (signed in) or `/` (signed out).

---

## 16. Build + tests

```bash
npm run typecheck    # api + web
npm run test:api     # backend unit/integration tests
npm run test:web     # frontend smoke
npm run build        # full local release gate
```

**Acceptance**

- [ ] All three commands exit `0`.
- [ ] No new TypeScript errors.
- [ ] Production bundle generated under `web/dist/` (do not commit it).

---

## Golden-path subset ⭐ (≈ 10 minutes)

If you only have time for one pass, do these in order:

1. Sign in as `alpha@taskloom.local`.
2. Verify the **Dashboard** loads with real numbers.
3. Run the **Builder** flow: prompt → draft → approve → preview → iterate → publish.
4. Open **Runs**, drill into one run, verify transcript + diagnose.
5. Open **Sandbox**: run `echo hello`, verify exit 0; cancel a long-running command.
6. Press **⌘K**, run an agent from the palette, confirm it lands on `/runs`.
7. Sign out, verify you land on the marketing/sign-in page.

If any acceptance line above fails, capture the network request/response (DevTools → Network tab) and the console output before filing the issue. Reference the section number in the bug title (e.g. "MVP §6 builder iteration: rollback returns 404").
