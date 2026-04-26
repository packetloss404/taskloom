# Deployment Auth Hardening

Taskloom has application-level auth and invitation rate limits, same-origin mutation checks, and proxy-aware CSRF origin handling. These controls are intentionally local to the running app process and active store. Production deployments should pair them with edge or shared distributed controls before relying on them for abuse prevention.

## Current App Controls

- Auth register/login routes and invitation create/accept/resend routes have store-backed rate limits.
- JSON mode stores rate-limit buckets in the default app store.
- SQLite mode stores rate-limit buckets in dedicated `rate_limit_buckets` storage.
- Bucket IDs are salted SHA-256 hashes using `TASKLOOM_RATE_LIMIT_KEY_SALT`.
- Limited responses return `429` with `Retry-After`.
- Private mutating app routes reject browser requests whose `Origin` host does not match the request host.
- Same-origin browser mutations must echo the readable `taskloom_csrf` cookie in `X-CSRF-Token`.
- `X-Forwarded-Host` is trusted for origin validation only when `TASKLOOM_TRUST_PROXY=true`.

These controls remain process/store scoped. They are useful as a final in-app guardrail, not as the only production throttling layer.

## Recommended Production Pairing

Put rate limits as close to the client as practical, then keep the app-level limits enabled as a backstop.

- Configure an edge proxy, load balancer, API gateway, CDN, or WAF to limit requests before they reach Node.
- Use a shared distributed limiter for deployments with more than one app process, container, node, or region.
- Prefer independent limits for auth login/register and invitation create/accept/resend instead of one global API limit.
- Key edge limits by trusted client IP, normalized user/account identifiers where available, and route family.
- Keep conservative burst limits at the edge and use app env knobs for a second layer of defense.
- Forward only sanitized `X-Forwarded-For`, `X-Real-IP`, and `X-Forwarded-Host` headers from trusted infrastructure.
- Do not set `TASKLOOM_TRUST_PROXY=true` unless the app is behind infrastructure that strips untrusted forwarded headers.

The app cannot coordinate counters across separate JSON stores, separate SQLite files, separate containers with local disks, or separate regions. For those topologies, use edge-distributed counters or a shared production datastore designed for concurrent rate-limit updates.

## Supported App Env Knobs

These deployment variables are already supported by the app:

- `TASKLOOM_AUTH_RATE_LIMIT_MAX_ATTEMPTS`: max auth register/login attempts per window.
- `TASKLOOM_AUTH_RATE_LIMIT_WINDOW_MS`: auth rate-limit window in milliseconds.
- `TASKLOOM_INVITATION_RATE_LIMIT_MAX_ATTEMPTS`: max invitation create/accept/resend attempts per window.
- `TASKLOOM_INVITATION_RATE_LIMIT_WINDOW_MS`: invitation rate-limit window in milliseconds.
- `TASKLOOM_RATE_LIMIT_KEY_SALT`: salt for hashed rate-limit bucket IDs. Set a deployment-specific secret value.
- `TASKLOOM_RATE_LIMIT_MAX_BUCKETS`: max retained app-level buckets before pruning, defaulting to 5000.
- `TASKLOOM_TRUST_PROXY`: enables trusted forwarded IP/host behavior when set to `true`, `1`, or `yes`.
- `TASKLOOM_STORE`: set to `sqlite` to use the opt-in SQLite app runtime; otherwise JSON remains the default.
- `TASKLOOM_DB_PATH`: SQLite database path when `TASKLOOM_STORE=sqlite`.

Invitation email delivery operations are separate from this rate-limit guidance; see `docs/invitation-email-operations.md`.

## Topology Caveats

- Single local process with JSON or SQLite: app buckets work as local guardrails, but edge limits are still recommended for public deployments.
- Multiple Node processes sharing one JSON file: unsupported for production coordination and unsafe for distributed throttling.
- Multiple Node processes sharing one SQLite file: app buckets are local-store backed and SQLite is hardened for local concurrency, but this is not a distributed abuse-control strategy.
- Multiple containers with local JSON or SQLite disks: each instance has independent counters, so attackers can spread attempts across instances unless edge/shared limits exist.
- Multi-region deployments: each region will have independent app counters unless the edge/distributed limiter is global or explicitly replicated.
- Blue/green or rolling deployments: app-level counters may reset or split during rollout; edge/shared limits should provide continuity.

## Validation Checklist

- Confirm HTTPS terminates before the Node server and production cookies are `Secure` through `NODE_ENV=production`.
- Confirm `TASKLOOM_RATE_LIMIT_KEY_SALT` is set to a secret deployment-specific value.
- Confirm auth and invitation app limits are set with `TASKLOOM_AUTH_RATE_LIMIT_*` and `TASKLOOM_INVITATION_RATE_LIMIT_*` values appropriate for the environment.
- Confirm edge or distributed limits exist for `/api/auth/register`, `/api/auth/login`, `/api/app/invitations`, and `/api/app/invitations/:token/accept`.
- Confirm the edge limiter has shared counters across every process, container, and region that can serve the same route.
- Confirm forwarded IP and host headers are stripped and re-added by trusted infrastructure before enabling `TASKLOOM_TRUST_PROXY=true`.
- Confirm cross-origin browser mutations are rejected and same-origin mutations include `X-CSRF-Token`.
- Confirm repeated auth or invitation attempts return `429` with `Retry-After` at the edge and still return `429` from the app when the app-level threshold is exceeded.
- Confirm expired sessions are cleaned with `npm run jobs:cleanup-sessions` or equivalent scheduler.
- Confirm logs and admin surfaces do not expose invitation tokens beyond intended owner/admin workflows.
