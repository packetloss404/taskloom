import { now } from "./auth-utils";
import { createInvitationEmailDelivery, type InvitationEmailDeliveryMode, type InvitationEmailDeliveryRecord, type TaskloomData, type WorkspaceInvitationRecord } from "./taskloom-store";

// Optional delivery switch. Supported values: "dev" (default) records local sent deliveries, "skip" records skipped deliveries,
// and "webhook" posts production delivery requests to a configured HTTP endpoint.
export const TASKLOOM_INVITATION_EMAIL_MODE_ENV = "TASKLOOM_INVITATION_EMAIL_MODE";
export const LOCAL_INVITATION_EMAIL_PROVIDER = "local";
export const WEBHOOK_INVITATION_EMAIL_PROVIDER = "webhook";
export const TASKLOOM_INVITATION_EMAIL_PROVIDER_ENV = "TASKLOOM_INVITATION_EMAIL_PROVIDER";
export const TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV = "TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL";
export const TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET_ENV = "TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET";
export const TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET_HEADER_ENV = "TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET_HEADER";
export const TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS_ENV = "TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS";
export const TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS_ENV = "TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS";
export const DEFAULT_INVITATION_EMAIL_WEBHOOK_SECRET_HEADER = "x-taskloom-webhook-secret";
export const DEFAULT_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS = 10_000;
export const DEFAULT_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS = 3;

export interface RecordInvitationEmailDeliveryInput {
  invitation: WorkspaceInvitationRecord;
  subject?: string;
  workspaceName?: string;
  deliveryId?: string;
  timestamp?: string;
}

export function invitationEmailSubject(workspaceName?: string): string {
  const trimmedName = workspaceName?.trim();
  return trimmedName ? `You're invited to ${trimmedName} on Taskloom` : "You're invited to Taskloom";
}

export function resolveInvitationEmailMode(value = process.env[TASKLOOM_INVITATION_EMAIL_MODE_ENV]): InvitationEmailDeliveryMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "skip" || normalized === "skipped" || normalized === "disabled") return "skip";
  if (normalized === "webhook") return "webhook";
  return "dev";
}

export interface InvitationEmailWebhookConfig {
  provider: string;
  url?: string;
  secret?: string;
  secretHeader: string;
  timeoutMs: number;
}

export function resolveInvitationEmailWebhookConfig(env = process.env): InvitationEmailWebhookConfig {
  return {
    provider: env[TASKLOOM_INVITATION_EMAIL_PROVIDER_ENV]?.trim() || WEBHOOK_INVITATION_EMAIL_PROVIDER,
    url: env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_URL_ENV]?.trim() || undefined,
    secret: env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET_ENV]?.trim() || undefined,
    secretHeader: env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_SECRET_HEADER_ENV]?.trim() || DEFAULT_INVITATION_EMAIL_WEBHOOK_SECRET_HEADER,
    timeoutMs: resolveInvitationEmailWebhookTimeoutMs(env[TASKLOOM_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS_ENV]),
  };
}

export function resolveInvitationEmailRetryMaxAttempts(env = process.env): number {
  const maxAttempts = Number.parseInt(env[TASKLOOM_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS_ENV] ?? "", 10);
  return Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : DEFAULT_INVITATION_EMAIL_RETRY_MAX_ATTEMPTS;
}

function resolveInvitationEmailWebhookTimeoutMs(value?: string): number {
  const timeoutMs = Number(value?.trim());
  return Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_INVITATION_EMAIL_WEBHOOK_TIMEOUT_MS;
}

export const TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_ENV =
  "TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET";
export const TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER_ENV =
  "TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER";
export const DEFAULT_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER =
  "x-taskloom-reconciliation-secret";

export interface InvitationEmailReconciliationConfig {
  secret?: string;
  secretHeader: string;
}

export function resolveInvitationEmailReconciliationConfig(
  env: NodeJS.ProcessEnv = process.env,
): InvitationEmailReconciliationConfig {
  return {
    secret: env[TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_ENV]?.trim() || undefined,
    secretHeader:
      env[TASKLOOM_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER_ENV]?.trim() ||
      DEFAULT_INVITATION_EMAIL_RECONCILIATION_SECRET_HEADER,
  };
}

export function recordLocalInvitationEmailDelivery(
  data: TaskloomData,
  input: RecordInvitationEmailDeliveryInput,
): InvitationEmailDeliveryRecord {
  const timestamp = input.timestamp ?? now();
  const mode = resolveInvitationEmailMode();
  const skipped = mode === "skip";

  return createInvitationEmailDelivery(data, {
    id: input.deliveryId,
    workspaceId: input.invitation.workspaceId,
    invitationId: input.invitation.id,
    recipientEmail: input.invitation.email,
    subject: input.subject ?? invitationEmailSubject(input.workspaceName),
    status: skipped ? "skipped" : "sent",
    provider: LOCAL_INVITATION_EMAIL_PROVIDER,
    mode,
    sentAt: skipped ? undefined : timestamp,
    error: skipped ? `${TASKLOOM_INVITATION_EMAIL_MODE_ENV}=skip` : undefined,
  }, timestamp);
}
