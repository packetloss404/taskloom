import { now } from "./auth-utils";
import { createInvitationEmailDelivery, type InvitationEmailDeliveryRecord, type TaskloomData } from "./taskloom-store";
import { LOCAL_INVITATION_EMAIL_PROVIDER, resolveInvitationEmailMode, TASKLOOM_INVITATION_EMAIL_MODE_ENV } from "./invitation-email";

export type InvitationEmailDeliveryAction = "create" | "resend";

export interface InvitationEmailDeliveryRequest {
  workspaceId: string;
  workspaceName?: string;
  invitationId: string;
  email: string;
  token: string;
  subject: string;
  action: InvitationEmailDeliveryAction;
}

export interface InvitationEmailDeliveryResult {
  id: string;
  status: InvitationEmailDeliveryRecord["status"];
  action: InvitationEmailDeliveryAction;
  error: string | null;
}

export interface InvitationEmailDeliveryTestRecord extends InvitationEmailDeliveryRequest {
  id: string;
  status: InvitationEmailDeliveryRecord["status"];
  error: string | null;
  createdAt: string;
  sentAt?: string;
}

type InvitationEmailDeliveryAdapter = (request: InvitationEmailDeliveryRequest) => void | Promise<void>;

let adapter: InvitationEmailDeliveryAdapter | null = null;
let recordsForTests: InvitationEmailDeliveryTestRecord[] = [];

export async function deliverInvitationEmail(
  data: TaskloomData,
  request: InvitationEmailDeliveryRequest,
  timestamp = now(),
): Promise<InvitationEmailDeliveryResult> {
  const mode = resolveInvitationEmailMode();
  const skipped = mode === "skip";
  let status: InvitationEmailDeliveryRecord["status"] = skipped ? "skipped" : "sent";
  let error: string | undefined = skipped ? `${TASKLOOM_INVITATION_EMAIL_MODE_ENV}=skip` : undefined;

  if (!skipped) {
    try {
      await (adapter?.(request) ?? undefined);
    } catch (caught) {
      status = "failed";
      error = caught instanceof Error ? caught.message : String(caught);
    }
  }

  const delivery = createInvitationEmailDelivery(data, {
    workspaceId: request.workspaceId,
    invitationId: request.invitationId,
    recipientEmail: request.email,
    subject: request.subject,
    status,
    provider: LOCAL_INVITATION_EMAIL_PROVIDER,
    mode,
    sentAt: status === "sent" ? timestamp : undefined,
    error,
  }, timestamp);

  recordsForTests.push({
    ...request,
    id: delivery.id,
    email: delivery.recipientEmail,
    status,
    error: error ?? null,
    createdAt: delivery.createdAt,
    sentAt: delivery.sentAt,
  });

  return { id: delivery.id, status, action: request.action, error: error ?? null };
}

export function setInvitationEmailDeliveryAdapterForTests(nextAdapter: InvitationEmailDeliveryAdapter): void {
  adapter = nextAdapter;
}

export function listInvitationEmailDeliveryRecordsForTests(): InvitationEmailDeliveryTestRecord[] {
  return recordsForTests.slice();
}

export function resetInvitationEmailDeliveryForTests(): void {
  adapter = null;
  recordsForTests = [];
}
