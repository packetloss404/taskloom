# Taskloom Export And Access-Log Redaction

Phase 20 layers two operator-facing redaction surfaces on top of the existing app-level DTO redaction shipped in Phase 19. App-level DTO redaction protects API responses, persisted error records, and frontend display paths, but it does not cover request URLs captured by access logs or workspace exports produced for audit, support, or data-subject handoffs. Phase 20 adds an opt-in Hono access-log middleware with built-in path redaction, a workspace export pipeline that masks token-bearing fields, and reverse-proxy access-log rewriting templates plus a validator for the requests Taskloom never sees in-process.

Operators need both an in-app middleware and a proxy-level rewriting pass because the two layers cover different traffic. The middleware logs requests after they reach the Node app, with workspace and user context attached. The proxy logs requests Taskloom may never see, including TLS-terminated failures, 404s served before the app, health probes, and traffic that never reaches the upstream. Aligning both layers with the same redaction posture keeps invitation tokens, share tokens, agent webhook tokens, and bearer values out of disk-resident logs.

## App-Level Access Log Middleware

When enabled, Taskloom registers a Hono middleware at `app.use("*", accessLogMiddleware())` that writes one JSON line per request:

```json
{
  "ts": "2026-04-26T00:00:00.000Z",
  "method": "POST",
  "status": 200,
  "path": "/api/app/invitations/wkin_***/accept",
  "durationMs": 14,
  "userId": "user_abc",
  "workspaceId": "alpha",
  "requestId": "req_..."
}
```

Redaction guarantees:

- The `path` field is passed through `redactSensitiveString` before being written. Known token-bearing route segments (invitation accept tokens, share tokens, agent webhook tokens) are replaced with masked previews, bearer-style values embedded in the URL are rewritten, and sensitive query/assignment patterns such as `?token=`, `?secret=`, and `?api_key=` are masked.
- The middleware reuses the same redaction helper that protects DTO surfaces, so the proxy access-log validator and the app access log share one definition of "sensitive."
- `userId`, `workspaceId`, and `requestId` are session-derived identifiers, not bearer secrets, and are safe to include for correlation.

Configuration:

- `TASKLOOM_ACCESS_LOG_MODE`: `stdout`, `file`, or `off`; defaults to `off`. Set to `stdout` to emit JSON lines on the standard output stream of the Node process. Set to `file` to append to the path supplied by `TASKLOOM_ACCESS_LOG_PATH`.
- `TASKLOOM_ACCESS_LOG_PATH`: required when mode is `file`. Use a deployment-managed log directory on persistent storage with rotation/retention controls.

What the middleware intentionally does not capture:

- Request bodies. Body fields already pass through DTO-level redaction; re-logging them at the request boundary would risk re-leaking the same fields the route layer just masked.
- Response bodies. The response payload has already been redacted by the route serializers; re-emitting it would duplicate the serialized output without adding operational signal.
- Response headers. Auth/session cookies and `Authorization` echoes do not need to be re-emitted into the access log.

If a deployment needs body or header logging for debugging, capture it through scoped tracing tools that do not write to the same access log file, and apply the same redaction posture before persisting.

## Workspace Export Pipeline

The `jobs:export-workspace` CLI produces a per-workspace JSON snapshot with token-bearing fields masked. Run it with:

```bash
npm run jobs:export-workspace -- --workspace-id=alpha > export.json
```

Output shape:

```json
{
  "command": "export-workspace",
  "workspaceId": "alpha",
  "exportedAt": "2026-04-26T00:00:00.000Z",
  "data": { "...": "..." }
}
```

Scope:

- One workspace per run, identified by `--workspace-id`.
- Includes the workspace record and its workflow records (brief, requirements, plan items, blockers, questions, validation evidence, release confirmation), agents, agent runs, activities, jobs, providers, environment variables, invitations, share tokens, and memberships.
- Sessions are intentionally excluded. Session cookies are not part of the workspace audit boundary and would expand the bearer surface of an export without operational benefit.

Redaction guarantees:

- Invitation tokens, share tokens, and agent webhook tokens are replaced with `*Preview` masked values built through `maskSecret`.
- Environment variable values are masked; only the variable name and provenance metadata remain readable.
- Provider credentials are masked using the same helper, so API keys and provider secrets never leave the export in plaintext.
- Remaining nested job, run, and activity payloads are passed through `redactSensitiveValue`, so bearer values, token-bearing URLs, and sensitive assignments embedded in JSON payloads are masked even when they did not originate from a known field name.

Suggested operational uses:

- Audit handoff to security or compliance reviewers who need workspace state without raw credentials.
- Support escalation bundles that capture workspace shape for reproduction without exposing tokens.
- GDPR-style data-subject exports. The masked output is a reasonable starting point for a DSAR response, but operators should still scrub freeform user content (brief copy, comments, activity notes) for personal data of third parties before handing the file to the requesting subject.

The export pipeline is read-only against the active local store; it does not mutate workspace records or rotate tokens. Run it from an operator workstation or a maintenance worker with read access to the production data path, and treat the resulting file as sensitive even though tokens are masked.

## Reverse-Proxy Access-Log Rewriting

Reverse-proxy access logs capture requests Taskloom never sees in-process: TLS handshake failures, requests to paths that 404 before reaching the upstream, health probes from load balancers, and traffic shed by edge filters. The app middleware cannot redact those entries because they never enter the app. Operators should configure the front-line proxy to redact known sensitive path segments and query parameters before its access log is written to disk.

Example configurations live under `docs/deployment/proxy-access-log-redaction/`:

- `nginx.conf.example`: nginx `log_format` plus `map` directives that rewrite token-bearing paths and query parameters before they reach the access log.
- `Caddyfile.example`: Caddy logging directives that filter known token-bearing path segments and sensitive query parameters.
- `apache.conf.example`: Apache `CustomLog` plus `SetEnvIf`/rewrite directives that mask token-bearing routes before the request line is logged.

Recommended approach:

- Route Taskloom traffic through a proxy whose access log strips known sensitive path segments (`/api/app/invitations/:token/accept`, `/api/public/share/:token`, `/api/public/webhooks/agents/:token`) and sensitive query parameters (`token`, `secret`, `api_key`, `bearer`) before writing.
- Pair this with the app middleware so requests that reach the upstream are also logged with redacted paths in the app access log; the two layers share the same redaction definition.
- Avoid logging `Authorization` headers, `Set-Cookie` headers, request bodies, and response bodies at the proxy unless the deployment has a separate redaction pipeline upstream of disk persistence.

The proxy templates are starting points; tune them to match the proxy version, log shipper, and downstream SIEM in use. Keep template comments aligned with the validator's pattern set so that changes stay auditable.

## Validating A Proxy Access Log

Taskloom ships a validator at `src/security/proxy-access-log-validator.ts` that scans a proxy access log file for sensitive patterns:

```bash
node --import tsx src/security/proxy-access-log-validator.ts /var/log/proxy/access.log
```

Behavior:

- Exit code `0`: no raw bearer tokens, `whk_` prefixes, share/invitation/webhook token segments, or sensitive query parameter values were found in the file.
- Non-zero exit code: at least one sensitive pattern matched. The validator prints the matching line numbers and the pattern that triggered the match so operators can update the proxy redaction rules.

Recommended cadence:

- Run after every proxy configuration change, before promoting the change to production.
- Run periodically against rotated logs as part of the regular audit cycle, especially after any new route family is added that may introduce a new token-bearing path segment.
- Run against a sample of recent log lines after enabling a new log shipper or SIEM forwarder, since intermediate buffering can change line shape.

The validator only reads the file. It does not modify the log, ship results anywhere, or contact external services.

## Validation Checklist

After deploying Phase 20 controls, walk through:

- `TASKLOOM_ACCESS_LOG_MODE` is set to the intended value (`off`, `stdout`, or `file`), and `TASKLOOM_ACCESS_LOG_PATH` points at a managed log directory when mode is `file`.
- A sample run of `npm run jobs:export-workspace -- --workspace-id=<id>` produces JSON containing no raw `whk_`, `Bearer `, `?token=`, `?secret=`, or `?api_key=` substrings.
- A sample of the live proxy access log passes `node --import tsx src/security/proxy-access-log-validator.ts <log-path>` with exit code `0`.
- Token previews emitted by both the export pipeline and the access log end with the last four characters of the underlying secret, matching the `maskSecret` convention used elsewhere in the app.
- Cross-link the rest of the production posture: `docs/deployment-auth-hardening.md` for auth/invitation rate limits and CSRF behavior, `docs/deployment-sqlite-topology.md` for storage topology, and `docs/invitation-email-operations.md` for invitation webhook delivery and dead-letter expectations.
