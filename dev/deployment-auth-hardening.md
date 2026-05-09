# Deployment Auth Hardening

Taskloom has application-level auth and invitation rate limits, an optional HTTP distributed rate-limit adapter, same-origin mutation checks, and proxy-aware CSRF origin handling. Local store-backed buckets remain enabled as an in-app backstop; production deployments with more than one app process, container, node, or region should also enable a shared limiter or enforce equivalent limits at the edge.

## Current App Controls

- Auth register/login routes and invitation create/accept/resend routes have store-backed rate limits.
- JSON mode stores rate-limit buckets in the default app store.
- SQLite mode stores rate-limit buckets in dedicated `rate_limit_buckets` storage.
- Bucket IDs are salted SHA-256 hashes using `TASKLOOM_RATE_LIMIT_KEY_SALT`.
- Limited responses return `429` with `Retry-After`.
- When `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` is set, auth and invitation routes first call the configured HTTP limiter with the hashed bucket id, route scope, max attempts, window, and timestamp.
- Distributed limiter responses can block a request before local buckets are updated; if the distributed limiter allows the request, local JSON/SQLite buckets are still updated as a backstop.
- Private mutating app routes reject browser requests whose `Origin` host does not match the request host.
- Same-origin browser mutations must echo the readable `taskloom_csrf` cookie in `X-CSRF-Token`.
- `X-Forwarded-Host` is trusted for origin validation only when `TASKLOOM_TRUST_PROXY=true`.

Local buckets remain process/store scoped. The HTTP adapter is the built-in integration point for shared counters; the actual shared counter service, CDN/WAF rule, gateway plugin, or rate-limit worker remains deployment-owned.

## Optional Distributed Limiter

Configure `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` to make Taskloom call a shared HTTP limiter before it updates local buckets.

Taskloom sends `POST` requests with JSON like:

```json
{
  "bucketId": "auth:login:sha256:...",
  "scope": "auth:login",
  "maxAttempts": 20,
  "windowMs": 60000,
  "timestamp": "2026-04-26T00:00:00.000Z"
}
```

Protocol expectations:

- `bucketId` is already salted and hashed; Taskloom does not send raw client IPs to the limiter.
- If `TASKLOOM_DISTRIBUTED_RATE_LIMIT_SECRET` is set, Taskloom sends `Authorization: Bearer <secret>`.
- A `2xx` response with no body or `{ "allowed": true }` allows the request to continue to the local bucket backstop.
- A `429` response, `{ "limited": true }`, or `{ "allowed": false }` makes Taskloom return `429` with `Retry-After`.
- The limiter can provide the retry window with the `Retry-After` header, `retryAfterSeconds`, or `resetAt` as an ISO timestamp, epoch milliseconds, or epoch seconds.
- Non-2xx responses, timeouts, and network failures fail closed with `503 rate limit service unavailable` unless `TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN=true` is set.
- In fail-open mode, Taskloom ignores distributed limiter failures and continues to the local JSON/SQLite backstop.

Supported scopes are `auth:register`, `auth:login`, `invitation:create`, `invitation:accept`, and `invitation:resend`.

## Recommended Production Pairing

Put rate limits as close to the client as practical, then keep the app-level limits enabled as a backstop.

- Configure an edge proxy, load balancer, API gateway, CDN, or WAF to limit requests before they reach Node.
- Use `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL` or an equivalent shared edge limiter for deployments with more than one app process, container, node, or region.
- Prefer independent limits for auth login/register and invitation create/accept/resend instead of one global API limit.
- Key edge limits by trusted client IP, normalized user/account identifiers where available, and route family.
- Keep conservative burst limits at the edge and use app env knobs for a second layer of defense.
- Forward only sanitized `X-Forwarded-For`, `X-Real-IP`, and `X-Forwarded-Host` headers from trusted infrastructure.
- Do not set `TASKLOOM_TRUST_PROXY=true` unless the app is behind infrastructure that strips untrusted forwarded headers.

The local app buckets cannot coordinate counters across separate JSON stores, separate SQLite files, separate containers with local disks, or separate regions. For those topologies, use the HTTP distributed limiter integration, edge-distributed counters, or a shared production datastore designed for concurrent rate-limit updates.

## Supported App Env Knobs

These deployment variables are already supported by the app:

- `TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS`: max auth register/login attempts per window.
- `TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS`: auth rate-limit window in milliseconds.
- `TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS`: max invitation create/accept/resend attempts per window.
- `TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS`: invitation rate-limit window in milliseconds.
- `TASKLOOM_RATE_LIMIT_KEY_SALT`: salt for hashed rate-limit bucket IDs. Set a deployment-specific secret value.
- `TASKLOOM_RATE_LIMIT_MAX_BUCKETS`: max retained app-level buckets before pruning, defaulting to 5000.
- `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL`: optional HTTP limiter endpoint for shared auth/invitation counters.
- `TASKLOOM_DISTRIBUTED_RATE_LIMIT_SECRET`: optional bearer secret sent to the distributed limiter.
- `TASKLOOM_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS`: HTTP limiter timeout in milliseconds, defaulting to 750.
- `TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN`: set to `true`, `1`, or `yes` to continue with local buckets when the distributed limiter is unavailable; otherwise limiter failures fail closed with `503`.
- `TASKLOOM_TRUST_PROXY`: enables trusted forwarded IP/host behavior when set to `true`, `1`, or `yes`.
- `TASKLOOM_STORE`: set to `sqlite` to use the opt-in SQLite app runtime; otherwise JSON remains the default.
- `TASKLOOM_DB_PATH`: SQLite database path when `TASKLOOM_STORE=sqlite`.

Invitation email delivery operations are separate from this rate-limit guidance; see `docs/invitation-email-operations.md`.

## Topology Caveats

- Single local process with JSON or SQLite: app buckets work as local guardrails, and the optional HTTP limiter can add continuity across restarts or edge paths if configured.
- Multiple Node processes sharing one JSON file: unsupported for production coordination and unsafe for distributed throttling.
- Multiple Node processes sharing one SQLite file: local buckets use SQLite and are hardened for local concurrency, but SQLite should not be the distributed abuse-control strategy; use the HTTP limiter or edge/shared counters.
- Multiple containers with local JSON or SQLite disks: each instance has independent local counters, so attackers can spread attempts across instances unless the HTTP limiter or edge/shared limits exist.
- Multi-region deployments: each region will have independent local counters unless the HTTP limiter, edge limiter, or shared datastore is global or explicitly replicated.
- Blue/green or rolling deployments: app-level counters may reset or split during rollout; edge/shared limits should provide continuity.

## Validation Checklist

- Confirm HTTPS terminates before the Node server and production cookies are `Secure` through `NODE_ENV=production`.
- Confirm `TASKLOOM_RATE_LIMIT_KEY_SALT` is set to a secret deployment-specific value.
- Confirm auth and invitation app limits are set with `TASKLOOM_AUTH_RATE_LIMIT_*` and `TASKLOOM_INVITATION_RATE_LIMIT_*` values appropriate for the environment.
- Confirm edge or distributed limits exist for `/api/auth/register`, `/api/auth/login`, `/api/app/invitations`, `/api/app/invitations/:token/accept`, and `/api/app/invitations/:invitationId/resend`.
- If using `TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL`, confirm the limiter receives hashed `bucketId` values, never raw IPs, and shares counters across every process, container, and region that can serve the same route.
- Confirm distributed limiter blocked responses return `429` with `Retry-After`, and confirm limiter outage behavior matches the chosen fail-closed or fail-open posture.
- Confirm forwarded IP and host headers are stripped and re-added by trusted infrastructure before enabling `TASKLOOM_TRUST_PROXY=true`.
- Confirm cross-origin browser mutations are rejected and same-origin mutations include `X-CSRF-Token`.
- Confirm repeated auth or invitation attempts return `429` with `Retry-After` at the edge/distributed limiter and still return `429` from the app when the local backstop threshold is exceeded.
- Confirm expired sessions are cleaned with `npm run jobs:cleanup-sessions` or equivalent scheduler.
- Confirm logs, retry jobs, dead-letter records, list/detail surfaces, telemetry, and exports do not expose invitation tokens beyond the one-time create/resend response surfaces.
