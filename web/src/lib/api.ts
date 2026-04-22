import type {
  ActivityDetailPayload,
  ActivityRecord,
  ActivationDetailPayload,
  BootstrapPayload,
  PublicDashboardPayload,
  Session,
} from "@/lib/types";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof payload?.error === "string" ? payload.error : `${response.status} ${response.statusText}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export const api = {
  getSession: async (): Promise<Session | null> => {
    const payload = await j<Session | { authenticated: false; user: null; workspace: null; onboarding: null }>("/api/auth/session");
    return payload.authenticated ? (payload as Session) : null;
  },
  signIn: (body: { email: string; password: string }) => j<Session>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  signUp: (body: { displayName: string; email: string; password: string }) => j<Session>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  signOut: () => j<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  getPublicDashboard: () => j<PublicDashboardPayload>("/api/activation"),
  getBootstrap: () => j<BootstrapPayload>("/api/app/bootstrap"),
  getActivationDetail: () => j<ActivationDetailPayload>("/api/app/activation"),
  getOnboarding: () => j<{ onboarding: BootstrapPayload["onboarding"] }>("/api/app/onboarding").then((payload) => payload.onboarding),
  completeOnboardingStep: (stepKey: string) => j<{ onboarding: BootstrapPayload["onboarding"] }>(`/api/app/onboarding/steps/${stepKey}/complete`, { method: "POST" }),
  updateProfile: (body: { displayName: string; timezone: string }) => j<{ profile: Session["user"] }>("/api/app/profile", { method: "PATCH", body: JSON.stringify(body) }).then((payload) => payload.profile),
  updateWorkspace: (body: { name: string; website: string; automationGoal: string }) => j<{ workspace: Session["workspace"] }>("/api/app/workspace", { method: "PATCH", body: JSON.stringify(body) }).then((payload) => payload.workspace),
  listActivity: () => j<{ activities: ActivityRecord[] }>("/api/app/activity").then((payload) => payload.activities),
  getActivityDetail: (id: string) => j<ActivityDetailPayload>(`/api/app/activity/${id}`),
};
