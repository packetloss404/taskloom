# Taskloom

Taskloom is a standalone local app for workspace activation tracking and onboarding progress. It includes:

- activation domain
- pure milestone engine
- checklist derivation
- stage + risk logic
- repository/service contracts
- future SQL schema
- signal adapter scaffold
- in-memory repositories
- read-only activation API wrapper
- UI-neutral activation summary view model
- file-backed auth, workspace, onboarding, and activity flows

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the app in development:

```bash
npm run dev
```

3. Open:

```text
http://localhost:5173
```

For a built local run:

```bash
npm run build:web
npm start
```

Then open:

```text
http://localhost:8484
```

Available endpoints:

- `GET /api/health`
- `GET /api/activation`
- `GET /api/activation/:workspaceId`
- `GET /api/auth/session`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/app/bootstrap`
- `GET /api/app/onboarding`
- `POST /api/app/onboarding/steps/:stepKey/complete`
- `PATCH /api/app/profile`
- `PATCH /api/app/workspace`
- `GET /api/app/activity`

## Frontend

Taskloom now uses a React/Vite GUI modeled on the Automate shell and patterns:

- guarded auth routes
- onboarding route
- dashboard shell with sidebar
- settings page
- activity page

Key docs:

- `docs/activation/activation-domain.md`
- `docs/activation/activation-signals.md`
- `docs/activation/activation-roadmap.md`
