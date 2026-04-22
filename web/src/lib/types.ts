export interface Session {
  authenticated: true;
  user: {
    id: string;
    email: string;
    displayName: string;
    timezone: string;
  };
  workspace: {
    id: string;
    slug: string;
    name: string;
    website: string;
    automationGoal: string;
  };
  onboarding: {
    status: string;
    currentStep: string;
    completed: boolean;
    completedSteps: string[];
    completedAt: string | null;
  };
}

export interface ActivationSummaryItem {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  completedAt?: string;
}

export interface ActivationSummary {
  title: string;
  progressPercent: number;
  progressLabel: string;
  stageLabel: string;
  riskLabel: string;
  riskLevel: "low" | "medium" | "high";
  items: ActivationSummaryItem[];
  nextRecommendedAction: string | null;
}

export interface ActivityRecord {
  id: string;
  workspaceId: string;
  scope: "account" | "workspace" | "activation";
  event: string;
  occurredAt: string;
  actor: { type: "user" | "system"; id: string; displayName?: string };
  data: Record<string, string | number | boolean | null | undefined>;
}

export interface ActivationDetailPayload {
  workspace: Session["workspace"];
  onboarding: BootstrapPayload["onboarding"];
  activation: BootstrapPayload["activation"];
  activities: ActivityRecord[];
}

export interface ActivityDetailPayload {
  activity: ActivityRecord;
  previous: ActivityRecord | null;
  next: ActivityRecord | null;
}

export interface BootstrapPayload {
  user: Session["user"];
  workspace: Session["workspace"];
  onboarding: {
    workspaceId: string;
    status: string;
    currentStep: string;
    completedSteps: string[];
    completedAt?: string;
    updatedAt: string;
  };
  activation: {
    status: {
      stage: string;
      risk: { score: number; level: "low" | "medium" | "high"; reasons: string[] };
      milestones: Array<{ key: string; reached: boolean; reachedAt?: string; reason: string }>;
      checklist: Array<{ key: string; completed: boolean; completedAt?: string; reason: string }>;
    };
    summary: ActivationSummary;
  };
  activities: ActivityRecord[];
}

export interface PublicDashboardPayload {
  summaries: Array<{
    subject: {
      workspaceId: string;
      subjectType: string;
      subjectId: string;
    };
    status: BootstrapPayload["activation"]["status"];
    summary: ActivationSummary;
  }>;
}
