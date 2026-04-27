# Invitation Email Operations

This guidance covers production invitation email delivery when `TASKLOOM_INVITATION_EMAIL_MODE=webhook` is used.

## Delivery Failure Semantics

Taskloom posts invitation delivery requests to `TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL`. The request body includes `workspaceId`, optional `workspaceName`, `invitationId`, recipient `email`, invitation `token`, `subject`, and delivery `action` (`create` or `resend`).

Taskloom records an `invitationEmailDeliveries` row for each create/resend attempt. Webhook configuration errors, request timeouts from `TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS`, rejected fetches, and non-2xx provider responses are recorded as `failed` deliveries. These failures do not roll back invitation creation or token rotation.

When `TASKLOOM_INVITATION_EMAIL_MODE=webhook`, a failed create/resend handoff enqueues an `invitation.email` job for built-in retry. The queued job payload stores the `invitationId`, action, and requesting user id only; it does not store the invitation token or recipient email. The retry handler resolves the current invitation token at send time so stale resend tokens are not replayed.

The local `dev` and `skip` modes are local recording adapters only; they are not production delivery systems and do not enqueue webhook retry jobs.

## Provider Retries And Dead Letters

Taskloom's built-in retry behavior reuses the persisted job scheduler:

- Retry jobs use type `invitation.email` and are visible through the workspace jobs APIs and Operations UI.
- `TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS` controls queued retry attempts, defaulting to `3`.
- Scheduler retry backoff starts at 30 seconds, doubles after each failed job attempt, and caps at 1 hour.
- Each failed retry writes a new `failed` delivery row and activity entry for auditability.
- When retry attempts are exhausted, the job remains `failed`; that failed job is the Taskloom dead-letter record for the delivery retry.
- If the invitation is accepted, revoked, or expired before a retry runs, the retry is marked successful with a `skipped` delivery row instead of sending an email.

Operators should still configure the external provider or webhook worker to:

- Treat the webhook request as the durable handoff boundary from Taskloom.
- Retry transient provider errors using provider-specific retry controls.
- Dead-letter provider-side failures with enough metadata to reconcile the Taskloom delivery row or failed retry job, especially `workspaceId`, `invitationId`, recipient `email`, and `action`.
- Avoid replaying stale invitation tokens after a resend. A resend rotates the invitation token, so provider retries should prefer the newest successful handoff for the invitation when the provider supports de-duplication or replacement.
- Keep provider error messages free of invitation tokens before returning them to Taskloom, because Taskloom records webhook failure messages in delivery activity and delivery rows.

Use Taskloom failed `invitation.email` jobs to identify exhausted app-side retries. Use provider dashboards, webhook-worker queues, or provider dead-letter tooling for failures after the provider accepts a Taskloom webhook handoff.

## Token Redaction

Invitation tokens are bearer secrets. Redact them from logs, traces, analytics events, support bundles, and admin exports unless the surface is one of the explicit one-time invitation-management API responses that intentionally exposes the active token.

Allowed existing token surfaces:

- `POST /api/app/invitations` response for users with workspace management permission.
- `POST /api/app/invitations/:invitationId/resend` response for users with workspace management permission.
- `GET /api/app/members` invitation list responses include `tokenPreview` only and never include `token`.
- `POST /api/app/invitations/:token/accept`, where the token is the route credential supplied by the invited user.

Required redaction areas:

- HTTP access logs and reverse-proxy logs for `POST /api/app/invitations/:token/accept`; redact the token path segment.
- Webhook request logging at the configured provider or webhook worker; redact the JSON `token` field.
- Provider error strings returned to Taskloom; Taskloom redacts known invitation tokens, bearer values, token-bearing URLs, and sensitive assignments before storing delivery errors, but providers should still avoid returning request bodies or token-bearing URLs.
- Built-in `invitation.email` job payloads, failed-job errors, retry logs, and any future replay tooling; never add invitation tokens to retry payloads or dead-letter metadata.
- Local store exports, database exports, backups shared outside the trusted operator boundary, and future admin exports; redact `workspaceInvitations.token` and any indexed token metadata unless the export is explicitly a privileged recovery artifact.
- Browser/client telemetry from Settings or invitation flows; do not capture one-time invitation tokens rendered after create/resend.

Current production records for invitation delivery and activity store invitation id, email, status, provider/mode, subject, action, delivery id, retry job id when applicable, and redacted error details, but not the invitation token. Test-only delivery records may include tokens to assert webhook payload behavior and should not be treated as production telemetry.

See `README.md` for the webhook environment variables, `docs/deployment-auth-hardening.md` for invitation create/accept/resend abuse controls, and `docs/roadmap.md` for remaining production hardening context.
