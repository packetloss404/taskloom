# Webhook Trigger Readiness

Phase 67 Lane 5 makes webhook publish readiness explicit for prompt-generated agent drafts.

## Prompt Draft Contract

Dry-run agent generation is exposed at:

```http
POST /api/app/agents/generate-from-prompt
```

Webhook-oriented prompts infer `draft.agent.triggerKind = "webhook"` and include:

```json
{
  "draft": {
    "readiness": {
      "webhook": {
        "recommended": true,
        "readyAfterSave": true,
        "tokenRequired": true,
        "tokenManagementRoute": "/api/app/webhooks/agents/:agentId/rotate",
        "publicTriggerRoute": "/api/public/webhooks/agents/:token"
      }
    }
  }
}
```

The draft plan also includes `Prepare webhook trigger readiness`, which tells the publisher to save the agent, create or rotate the token, and publish only the public trigger URL.

## Backend Routes

- `POST /api/app/webhooks/agents/:agentId/rotate` creates or rotates the saved agent's webhook token. It requires an admin role and is workspace-scoped.
- `DELETE /api/app/webhooks/agents/:agentId` removes the token and disables public webhook delivery.
- `POST /api/public/webhooks/agents/:token` accepts the external event payload and enqueues an `agent.run` job with `triggerKind = "webhook"`.

Agent detail responses never expose stored webhook tokens after refresh; they return `hasWebhookToken` plus a redacted preview. The full public URL is only recoverable immediately after rotation.

## Publish Checklist

1. Generate a draft from the prompt and confirm `draft.readiness.webhook.recommended`.
2. Save the generated agent.
3. Rotate/create its token through `POST /api/app/webhooks/agents/:agentId/rotate`.
4. Publish `POST /api/public/webhooks/agents/:token` to the external sender.
5. Send a small test payload and confirm an `agent.run` job is queued.
