# Invitation Email Operations

This guidance covers production invitation email delivery when `TASKLOOM_INVITATION_EMAIL_MODE=webhook` is used.

## Delivery Failure Semantics

Taskloom posts invitation delivery requests to `TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL`. The request body includes `workspaceId`, optional `workspaceName`, `invitationId`, recipient `email`, invitation `token`, `subject`, and delivery `action` (`create` or `resend`).

Taskloom records one `invitationEmailDeliveries` row for each create/resend attempt. Webhook configuration errors, request timeouts from `TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS`, rejected fetches, and non-2xx provider responses are recorded as `failed` deliveries. These failures do not roll back invitation creation or token rotation.

Taskloom does not currently retry failed webhook deliveries and does not own a dead-letter queue for invitation email. The local `dev` and `skip` modes are local recording adapters only; they are not production delivery systems.

## Provider Retries And Dead Letters

Production retry and dead-letter behavior must live in the configured provider or webhook worker outside Taskloom's current local adapter. Operators should configure that provider layer to:

- Treat the webhook request as the durable handoff boundary from Taskloom.
- Retry transient provider errors using provider-specific retry controls.
- Dead-letter exhausted delivery attempts with enough metadata to reconcile the Taskloom delivery row, especially `workspaceId`, `invitationId`, recipient `email`, and `action`.
- Avoid replaying stale invitation tokens after a resend. A resend rotates the invitation token, so provider retries should prefer the newest successful handoff for the invitation when the provider supports de-duplication or replacement.
- Keep provider error messages free of invitation tokens before returning them to Taskloom, because Taskloom records webhook failure messages in delivery activity and delivery rows.

Taskloom's current delivery row is an audit record, not a retry queue. Use provider dashboards, webhook-worker queues, or provider dead-letter tooling for actual reprocessing.

## Token Redaction

Invitation tokens are bearer secrets. Redact them from logs, traces, analytics events, support bundles, and admin exports unless the surface is one of the existing admin/owner invitation-management API responses that intentionally exposes the active token.

Allowed existing token surfaces:

- `POST /api/app/invitations` response for users with workspace management permission.
- `POST /api/app/invitations/:invitationId/resend` response for users with workspace management permission.
- `GET /api/app/members` invitation list for `admin` and `owner`; lower roles receive invitation rows without `token`.
- `POST /api/app/invitations/:token/accept`, where the token is the route credential supplied by the invited user.

Required redaction areas:

- HTTP access logs and reverse-proxy logs for `POST /api/app/invitations/:token/accept`; redact the token path segment.
- Webhook request logging at the configured provider or webhook worker; redact the JSON `token` field.
- Provider error strings returned to Taskloom; do not include request bodies or token-bearing URLs in non-2xx status text or thrown errors.
- Local store exports, database exports, backups shared outside the trusted operator boundary, and future admin exports; redact `workspaceInvitations.token` and any indexed token metadata unless the export is explicitly a privileged recovery artifact.
- Browser/client telemetry from Settings or invitation flows; do not capture invitation tokens rendered for admins/owners.

Current production records for invitation delivery and activity store invitation id, email, status, provider/mode, subject, action, delivery id, and error details, but not the invitation token. Test-only delivery records may include tokens to assert webhook payload behavior and should not be treated as production telemetry.

See `README.md` for the webhook environment variables and `docs/roadmap.md` for remaining production hardening context.
