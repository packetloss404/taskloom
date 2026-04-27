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
- Phase 22 adds an inbound provider-status webhook so a `failed` delivery can be flipped to `delivered` when the external provider eventually delivers the message out-of-band; see the next section for the wire contract.
- The Phase 22 reconciliation CLI (`npm run jobs:reconcile-invitation-emails`) provides offline listing, mark-as-resolved, and Taskloom-side requeue actions for stuck deliveries when no inbound webhook is wired up.

Operators should still configure the external provider or webhook worker to:

- Treat the webhook request as the durable handoff boundary from Taskloom.
- Retry transient provider errors using provider-specific retry controls.
- Dead-letter provider-side failures with enough metadata to reconcile the Taskloom delivery row or failed retry job, especially `workspaceId`, `invitationId`, recipient `email`, and `action`.
- Avoid replaying stale invitation tokens after a resend. A resend rotates the invitation token, so provider retries should prefer the newest successful handoff for the invitation when the provider supports de-duplication or replacement.
- Keep provider error messages free of invitation tokens before returning them to Taskloom, because Taskloom records webhook failure messages in delivery activity and delivery rows.

Use Taskloom failed `invitation.email` jobs to identify exhausted app-side retries. Use provider dashboards, webhook-worker queues, or provider dead-letter tooling for failures after the provider accepts a Taskloom webhook handoff.

## Inbound Provider Status Webhook

Phase 22 adds an inbound HTTP route the external provider or webhook worker can call to report provider-side delivery status back to Taskloom:

```text
POST /api/public/webhooks/invitation-email
```

Configuration:

- `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET` is the shared secret callers must present. The route returns `503` when this env is unset, so the webhook is disabled by default.
- `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER` overrides the header name. The default is `x-taskloom-reconciliation-secret`.

Request body:

```json
{
  "deliveryId": "<taskloom invitationEmailDeliveries.id>",
  "providerStatus": "delivered | bounced | complained | deferred | dropped | failed",
  "providerDeliveryId": "<provider message id, optional>",
  "providerError": "<provider-side error string, optional>",
  "occurredAt": "<ISO timestamp, optional, defaults to now>"
}
```

The parser normalizes common provider aliases to a canonical status before storage:

- `delivery` is treated as `delivered`.
- `hard_bounce` and `soft_bounce` are treated as `bounced`.
- `complaint` and `spam` are treated as `complained`.
- `defer` is treated as `deferred`.
- `drop` is treated as `dropped`.
- `fail` and `error` are treated as `failed`.

Successful application returns `200` with:

```json
{
  "ok": true,
  "deliveryId": "<id>",
  "invitationId": "<id>",
  "workspaceId": "<id>",
  "providerStatus": "delivered",
  "appliedAt": "<ISO timestamp>"
}
```

Failure responses:

- `503 { "error": "reconciliation webhook is disabled; set TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET" }` when no secret env is configured.
- `401 { "error": "unauthorized" }` when the secret header is missing or wrong.
- `400 { "error": "request body must be valid JSON" }` when the body fails to parse.
- `400 { "error": "invalid request", "field": "<name>" }` when a required field is missing or malformed.
- `400 { "error": "invalid provider status", "providerStatus": "<raw>" }` when the status is not a canonical value or known alias.
- `404 { "error": "delivery not found", "deliveryId": "<id>" }` when no `invitationEmailDeliveries` row exists for the supplied id.

Operator guidance:

- Configure the external provider or webhook worker to POST status updates back to Taskloom using the `deliveryId` returned from the original outbound webhook handoff. Providers without a Taskloom-aware adapter usually wire this through a small webhook-worker translator service.
- Treat `4xx` responses as terminal: do not retry on `400`, `401`, or `404`. Treat `5xx` responses and timeouts as retryable and back off on the provider side.
- Re-applying the same status is safe. The delivery row is overwritten with the latest `occurredAt`, so providers may safely retry POSTs without producing duplicate records.

## Operator Reconciliation CLI

Phase 22 also adds a CLI for offline reconciliation against the active local store:

```bash
# read-only listing of failed deliveries grouped by recency
npm run jobs:reconcile-invitation-emails

# scope filters
npm run jobs:reconcile-invitation-emails -- --workspace-id=alpha --invitation-id=inv_123

# mark a specific delivery as provider-resolved (delivered out-of-band)
npm run jobs:reconcile-invitation-emails -- --delivery-id=del_xyz --mark-resolved

# re-enqueue Taskloom-side retry for a failed delivery
npm run jobs:reconcile-invitation-emails -- --delivery-id=del_xyz --requeue
```

Default behavior is read-only. The output lists failed deliveries with `deliveryId`, `invitationId`, `workspaceId`, recipient `email`, `status`, `lastError`, `providerStatus` if set, and `attemptedAt`, plus an `actions` array that is empty unless `--mark-resolved` or `--requeue` was supplied. `--workspace-id`, `--invitation-id`, and `--delivery-id` narrow the listing.

Action flags:

- `--mark-resolved` is equivalent to receiving a `delivered` provider status from the inbound webhook. Use it when the external provider confirms delivery via dashboard or log review but never POSTs Taskloom a status webhook. `--mark-resolved` is mutually exclusive with `--requeue`.
- `--requeue` re-enqueues a Taskloom-side `invitation.email` retry job for that delivery's invitation. The retry payload preserves the Phase 18 invariant that it contains only the `invitationId`, the action, and the requesting user id; invitation tokens and recipient emails are never written into requeue payloads.

The CLI never includes invitation tokens in its output and never accepts a token as input. Use the original invitation id or delivery id for all reconciliation actions.

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
- Inbound provider-status webhook bodies; the optional `providerError` field is passed through `redactedErrorMessage` before storage, but providers should still scrub their own error strings to avoid sending raw bearer values, token-bearing URLs, or invitation tokens to Taskloom in the first place.
- Built-in `invitation.email` job payloads, failed-job errors, retry logs, and any future replay tooling; never add invitation tokens to retry payloads or dead-letter metadata.
- Local store exports, database exports, backups shared outside the trusted operator boundary, and future admin exports; redact `workspaceInvitations.token` and any indexed token metadata unless the export is explicitly a privileged recovery artifact.
- Browser/client telemetry from Settings or invitation flows; do not capture one-time invitation tokens rendered after create/resend.

Current production records for invitation delivery and activity store invitation id, email, status, provider/mode, subject, action, delivery id, retry job id when applicable, and redacted error details, but not the invitation token. Test-only delivery records may include tokens to assert webhook payload behavior and should not be treated as production telemetry.

See `README.md` for the webhook environment variables (including `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET` and `TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER`), `docs/deployment-auth-hardening.md` for invitation create/accept/resend abuse controls, and `docs/roadmap.md` Phase 22 for the inbound provider-status webhook and reconciliation CLI rollout context.
