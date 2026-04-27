# Taskloom Health And Operational Status Endpoints

Phase 24 adds two public health probes plus an admin-scoped operator-status endpoint that summarizes runtime configuration in a single call. The probes give container orchestrators and load balancers the standard `live`/`ready` split they expect, while the operator-status endpoint surfaces store mode, scheduler leader configuration, jobs queue depth, access-log knobs, and Node version without requiring an SSH session into the host. Pair this phase with Phase 21 scheduler coordination, Phase 23 access-log shipping, and the existing rate-limit and SQLite/topology guidance in `docs/deployment-auth-hardening.md` and `docs/deployment-sqlite-topology.md` to round out the production posture.

Before Phase 24, Taskloom exposed a single `GET /api/health` route returning `{ "ok": true }` and no operator-visibility endpoint other than the per-resource jobs/agents/runs surfaces under `/api/app`. That covered the smoke-test case but did not match the live/ready split orchestrators expect, did not give load balancers a way to detect store-level degradation, and did not give operators a single call to confirm scheduler leader mode, store mode, and access-log envelope are configured the way the deployment intends. Phase 24 closes those gaps without changing the existing endpoint, so older consumers continue to work unchanged.

The doc covers the three endpoints in turn, the suggested probe wiring for common orchestrators, the admin-only Operations page tile that consumes the operator-status payload, and a post-deploy validation checklist.

## Liveness Probe (/api/health/live)

`GET /api/health/live` is a public, fixed-200 liveness probe. It takes no parameters, performs no I/O, and always returns:

```json
{ "status": "live" }
```

Use cases:

- Container/orchestrator liveness checks that should succeed even if downstream dependencies are degraded. The probe answers exactly one question: this Node process is up and Hono is dispatching requests.
- A fast-path probe for platform health checks where any I/O on the probe path would risk false-positive restarts during transient store latency.

The probe deliberately skips any store, scheduler, or filesystem access. A degraded `loadStore()` does not fail liveness, because killing the process for a store hiccup usually makes the outage worse rather than better. Operators that want to detect store degradation should use the readiness probe below.

```bash
curl -i http://localhost:8484/api/health/live
```

The expected response is `200 OK` with `{ "status": "live" }`.

## Readiness Probe (/api/health/ready)

`GET /api/health/ready` is a public readiness probe. It calls `loadStore()` once and returns:

- `200 OK` with `{ "status": "ready" }` when the store loads cleanly.
- `503 Service Unavailable` with `{ "status": "not_ready", "error": "<redacted>" }` when the store cannot be read.

The error string is passed through the same redaction helper used for DTO surfaces, so bearer values, token-bearing URLs, and sensitive query/assignment patterns are masked before they reach the response body. The redacted error is suitable for inclusion in load-balancer logs but not as a user-facing message; it is intended for operator triage rather than end-user display.

Use cases:

- Load balancer health checks (AWS ALB target group health, GCP load balancer backend health, an Nginx upstream `health_check` block) that should pull a backend out of rotation when its store is unreachable.
- Kubernetes readiness probes that hold off sending traffic to a pod that is up but cannot serve requests yet.
- Blue/green and rolling deploys where the orchestrator should wait for the new replica to confirm `ready` before draining the old one.

```bash
curl -i http://localhost:8484/api/health/ready
```

The expected response is `200 OK` with `{ "status": "ready" }` once the store loads. Confirm the failure path by intentionally pointing `TASKLOOM_DB_PATH` at an unreadable file and watching for `503` with a redacted `error`.

## Existing /api/health

The pre-existing `GET /api/health` route is preserved unchanged and still returns:

```json
{ "ok": true }
```

It is not redundant with the new probes. Existing consumers that depend on the `{ "ok": true }` shape continue to work, while orchestrators that prefer a structured `status` field can adopt `/api/health/live` and `/api/health/ready` without breaking the older callers. New deployments should prefer the live/ready split for orchestrator wiring; the legacy endpoint remains available for compatibility.

## Operator Status (/api/app/operations/status)

`GET /api/app/operations/status` is an admin-scoped endpoint that returns a single `OperationsStatus` payload covering the runtime configuration the operator most often needs in one place. The intent is to answer "is this deployment configured the way I think it is?" with one curl rather than several. Auth follows the standard Taskloom session model with route-level RBAC:

- Unauthenticated requests return `401 Unauthorized`.
- Authenticated non-admin/non-owner requests return `403 Forbidden`.
- Authenticated admin or owner requests return `200 OK` with the payload below.

The same-origin and CSRF-token requirements that apply to other private mutating routes do not apply here because the endpoint is read-only; standard session-cookie auth is enough. Operators using `curl` from an admin workstation should pass the session cookie they captured from a logged-in browser session, or use a deployment-managed session minted for operator triage.

Sample 200 response:

```json
{
  "generatedAt": "2026-04-26T00:00:00.000Z",
  "store": { "mode": "sqlite" },
  "scheduler": {
    "leaderMode": "file",
    "leaderTtlMs": 30000,
    "leaderHeldLocally": false,
    "lockSummary": "data/scheduler-leader.json"
  },
  "jobs": [
    { "type": "agent.run", "queued": 4, "running": 1, "succeeded": 142, "failed": 2, "canceled": 0 },
    { "type": "invitation.email", "queued": 0, "running": 0, "succeeded": 87, "failed": 1, "canceled": 0 }
  ],
  "jobMetrics": [
    {
      "type": "agent.run",
      "totalRuns": 145,
      "succeededRuns": 142,
      "failedRuns": 2,
      "canceledRuns": 1,
      "lastRunStartedAt": "2026-04-26T00:00:00.000Z",
      "lastRunFinishedAt": "2026-04-26T00:00:00.812Z",
      "lastDurationMs": 812,
      "averageDurationMs": 734,
      "p95DurationMs": 1480
    },
    {
      "type": "invitation.email",
      "totalRuns": 88,
      "succeededRuns": 87,
      "failedRuns": 1,
      "canceledRuns": 0,
      "lastRunStartedAt": "2026-04-26T00:00:00.000Z",
      "lastRunFinishedAt": "2026-04-26T00:00:00.214Z",
      "lastDurationMs": 214,
      "averageDurationMs": 198,
      "p95DurationMs": 412
    }
  ],
  "accessLog": {
    "mode": "file",
    "path": "/var/log/taskloom/access.log",
    "maxBytes": 10485760,
    "maxFiles": 5
  },
  "runtime": { "nodeVersion": "v22.5.0" }
}
```

Sample 401 (no session cookie):

```json
{ "error": "unauthorized" }
```

Sample 403 (authenticated as a non-admin member):

```json
{ "error": "forbidden" }
```

Field-by-field notes:

- `generatedAt` is the ISO timestamp the response was assembled. There is no caching layer in front of the endpoint; each call recomputes the snapshot.
- `store.mode` mirrors `TASKLOOM_STORE` (`json` or `sqlite`).
- `scheduler.leaderMode` mirrors `TASKLOOM_SCHEDULER_LEADER_MODE` (`off`, `file`, or `http`).
- `scheduler.leaderTtlMs` mirrors `TASKLOOM_SCHEDULER_LEADER_TTL_MS` (default `30000`).
- `scheduler.leaderHeldLocally` reflects the live `SchedulerLeaderLock.isHeld()` state when the scheduler is running. Phase 25 wires the probe through `JobScheduler.start()`/`stop()`, so the field is `true` for `off` mode (the noop lock always reports the local process as leader), and for `file`/`http` modes it tracks whether this process currently holds the lock. The field is `false` when the scheduler is stopped or has not yet acquired the lock. Cross-link `docs/deployment-scheduler-coordination.md` for the broader leader-election context.
- `scheduler.lockSummary` reports a redacted view of the leader-lock target: `"local"` for `off` mode, the configured file path for `file` mode, and the configured URL with any query string stripped for `http` mode. The field NEVER contains the configured bearer secret, even when `TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET` is set. Operators should never see a token here; if they do, file a bug.
- `jobs[]` contains one row per `type` encountered in the queue, with `queued`, `running`, `succeeded`, `failed`, and `canceled` counts. The array is empty when there are no queued jobs at all.
- `jobMetrics[]` contains one entry per job `type` that has produced a terminal outcome (`success`, `failed`, or `canceled`) since process start. The retry-back-to-queued path does NOT record an entry, so a job that retries twice and then succeeds counts as one terminal `success` rather than three runs. `lastDurationMs` reflects the most recent run regardless of status. `averageDurationMs` and `p95DurationMs` are computed over success runs only in the rolling window so a flood of failures does not poison the latency metric, and are `null` when the window has no success runs yet. The window is in-memory and resets on process restart by design; configure size with `TASKLOOM_SCHEDULER_METRICS_WINDOW_SIZE` (default `50`, integer >= 1, read at module load). Long-tail and SLO tracking should still rely on shipped logs plus a downstream system; this field is for the on-call's "is the scheduler healthy right now" view rather than historical analysis.
- `accessLog` mirrors the Phase 20 and Phase 23 environment knobs: `mode` (`stdout`, `file`, or `off`), `path` (when mode is `file`), and the rotation envelope `maxBytes`/`maxFiles`.
- `runtime.nodeVersion` is `process.versions.node`, useful for confirming the runtime version in place after a rolling deploy.

The endpoint is intentionally read-only. It does not mutate any state, schedule any jobs, or reach out to external services.

## Suggested Probe Wiring

| Consumer | Endpoint | Notes |
| --- | --- | --- |
| Kubernetes `livenessProbe` | `GET /api/health/live` | Public, no auth, no I/O. Tolerates store degradation. |
| Kubernetes `readinessProbe` | `GET /api/health/ready` | Public, no auth. Returns `503` when `loadStore()` fails. |
| AWS ALB / GCP LB health check | `GET /api/health/ready` | Pulls a backend out of rotation when the store is unreachable. |
| Nginx/Caddy upstream health check | `GET /api/health/ready` | Same readiness semantics as the cloud load balancers. |
| Internal monitoring dashboards (Datadog/Grafana/etc.) | `GET /api/app/operations/status` | Admin-scoped; requires an authenticated session with admin or owner RBAC. |

The operator-status endpoint requires session auth and is therefore not directly suitable for unattended monitoring without an authenticated session. For now, dashboards that need a long-running unattended scrape should instead consume the per-resource jobs and operations APIs (which are also admin-scoped) or scrape access-log/queue depth out of band through the Phase 23 shipping pipeline. A dedicated service-token surface for the operator-status endpoint remains future work; until then, treat the endpoint as an operator-triage tool rather than a continuous metrics source.

## Frontend Operations Page

The Operations page now displays the operator-status payload as an admin-gated "Production Status" tile. Admins and owners see the rendered tile with store mode, scheduler leader configuration, jobs queue summary, access-log mode, and Node version; non-admin members do not see the tile, matching the route-level RBAC on the underlying endpoint. The tile is the recommended way for operators to spot store/scheduler/access-log misconfiguration without SSHing into the host. The frontend wiring lives in `web/src/pages/Operations.tsx`.

## Validation Checklist

After deploying Phase 24, walk through:

- `curl http://localhost:8484/api/health/live` returns `200` with `{ "status": "live" }`, with no auth header attached.
- `curl http://localhost:8484/api/health/ready` returns `200` with `{ "status": "ready" }` against a healthy store. Force a store failure (for example, point `TASKLOOM_DB_PATH` at an unreadable path) and confirm the response becomes `503` with `{ "status": "not_ready", "error": "<redacted>" }`.
- `curl http://localhost:8484/api/app/operations/status` without a session cookie returns `401`.
- `curl` with a non-admin member session cookie returns `403`.
- `curl` with an admin or owner session cookie returns `200` with the expected JSON shape: `generatedAt`, `store.mode`, `scheduler.{leaderMode, leaderTtlMs, leaderHeldLocally, lockSummary}`, `jobs[]`, `accessLog.{mode, path, maxBytes, maxFiles}`, and `runtime.nodeVersion`.
- The `scheduler.lockSummary` field never contains a secret. Confirm `"local"` for `off` mode, the configured file path for `file` mode, and the URL with any query string stripped for `http` mode (even when `TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET` is set).
- The Operations page renders the "Production Status" tile for admins and owners and omits it for member/viewer roles.
- After kicking off a manual job (e.g., `npm run jobs:recompute-activation`), `GET /api/app/operations/status` shows a `jobMetrics` entry for the job type with `totalRuns >= 1` and `lastDurationMs` populated.
- Cross-link the rest of the production posture: `docs/deployment-scheduler-coordination.md` for the leader-election context behind `scheduler.leaderHeldLocally` and `scheduler.lockSummary`, `docs/deployment-access-log-shipping.md` for the access-log envelope mirrored in `accessLog`, `docs/deployment-auth-hardening.md` for auth/invitation rate limits and CSRF behavior, and `docs/deployment-sqlite-topology.md` for storage topology.
