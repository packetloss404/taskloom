import { now } from "./auth-utils";
import { createInvitationEmailDelivery, type InvitationEmailDeliveryMode, type InvitationEmailDeliveryRecord, type TaskloomData, type WorkspaceInvitationRecord } from "./taskloom-store";

// Optional local-only switch. Supported values: "dev" (default) records sent deliveries, "skip" records skipped deliveries.
export const TASKLOOM_INVITATION_EMAIL_MODE_ENV = "TASKLOOM_INVITATION_EMAIL_MODE";
export const LOCAL_INVITATION_EMAIL_PROVIDER = "local";

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
  return normalized === "skip" || normalized === "skipped" || normalized === "disabled" ? "skip" : "dev";
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
