import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { WorkspaceActivationFacts } from "./activation/adapters";
import type { ActivationMilestoneRecord, ActivationStatusDto } from "./activation/domain";
import { buildSignalSnapshotFromFacts } from "./activation/adapters";
import { hashPassword, now, slugify } from "./auth-utils";

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  secretHash: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
}

export interface WorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  website: string;
  automationGoal: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberRecord {
  workspaceId: string;
  userId: string;
  role: "owner";
  joinedAt: string;
}

export interface OnboardingStateRecord {
  workspaceId: string;
  status: "not_started" | "in_progress" | "completed";
  currentStep: OnboardingStepKey;
  completedSteps: OnboardingStepKey[];
  completedAt?: string;
  updatedAt: string;
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

export type OnboardingStepKey =
  | "create_workspace_profile"
  | "define_requirements"
  | "define_plan"
  | "start_implementation"
  | "validate"
  | "confirm_release";

export interface TaskloomData {
  users: UserRecord[];
  sessions: SessionRecord[];
  workspaces: WorkspaceRecord[];
  memberships: WorkspaceMemberRecord[];
  onboardingStates: OnboardingStateRecord[];
  activities: ActivityRecord[];
  activationFacts: Record<string, WorkspaceActivationFacts>;
  activationMilestones: Record<string, ActivationMilestoneRecord[]>;
  activationReadModels: Record<string, ActivationStatusDto>;
}

const DATA_FILE = resolve(process.cwd(), "data", "taskloom.json");

let cache: TaskloomData | null = null;

export function loadStore(): TaskloomData {
  if (cache) return cache;

  try {
    cache = JSON.parse(readFileSync(DATA_FILE, "utf8")) as TaskloomData;
    return cache;
  } catch {
    cache = seedStore();
    persistStore(cache);
    return cache;
  }
}

export function mutateStore<T>(mutator: (data: TaskloomData) => T): T {
  const data = loadStore();
  const result = mutator(data);
  persistStore(data);
  return result;
}

export function persistStore(data: TaskloomData): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function seedStore(): TaskloomData {
  const createdAt = now();
  const users: UserRecord[] = [
    createSeedUser("user_alpha", "alpha@taskloom.local", "Alpha Owner", createdAt),
    createSeedUser("user_beta", "beta@taskloom.local", "Beta Owner", createdAt),
    createSeedUser("user_gamma", "gamma@taskloom.local", "Gamma Owner", createdAt),
  ];

  const workspaces: WorkspaceRecord[] = [
    createWorkspaceRecord("alpha", "Alpha Workspace", "https://alpha.example.com", "Capture the implementation brief and move into validation.", createdAt),
    createWorkspaceRecord("beta", "Beta Workspace", "https://beta.example.com", "Recover from blockers and regain forward progress.", createdAt),
    createWorkspaceRecord("gamma", "Gamma Workspace", "https://gamma.example.com", "Sustain a complete release process for the workspace.", createdAt),
  ];

  const memberships: WorkspaceMemberRecord[] = [
    { workspaceId: "alpha", userId: "user_alpha", role: "owner", joinedAt: createdAt },
    { workspaceId: "beta", userId: "user_beta", role: "owner", joinedAt: createdAt },
    { workspaceId: "gamma", userId: "user_gamma", role: "owner", joinedAt: createdAt },
  ];

  const activationFacts: Record<string, WorkspaceActivationFacts> = {
    alpha: {
      now: createdAt,
      createdAt: isoDaysAgo(9),
      briefCapturedAt: isoDaysAgo(9),
      requirementsDefinedAt: isoDaysAgo(7),
      planDefinedAt: isoDaysAgo(7),
      implementationStartedAt: isoDaysAgo(4),
      testsPassedAt: isoDaysAgo(1),
      blockerCount: 0,
      dependencyBlockerCount: 0,
      openQuestionCount: 1,
      criticalIssueCount: 0,
      scopeChangeCount: 1,
      failedValidationCount: 0,
      retryCount: 1,
    },
    beta: {
      now: createdAt,
      createdAt: isoDaysAgo(14),
      briefCapturedAt: isoDaysAgo(14),
      requirementsDefinedAt: isoDaysAgo(11),
      planDefinedAt: isoDaysAgo(10),
      implementationStartedAt: isoDaysAgo(6),
      blockerCount: 2,
      dependencyBlockerCount: 1,
      openQuestionCount: 3,
      criticalIssueCount: 1,
      scopeChangeCount: 2,
      failedValidationCount: 1,
      retryCount: 2,
    },
    gamma: {
      now: createdAt,
      createdAt: isoDaysAgo(30),
      briefCapturedAt: isoDaysAgo(30),
      requirementsDefinedAt: isoDaysAgo(28),
      planDefinedAt: isoDaysAgo(28),
      implementationStartedAt: isoDaysAgo(24),
      completedAt: isoDaysAgo(12),
      testsPassedAt: isoDaysAgo(11),
      validationPassedAt: isoDaysAgo(10),
      releaseConfirmedAt: isoDaysAgo(7),
      blockerCount: 0,
      dependencyBlockerCount: 0,
      openQuestionCount: 0,
      criticalIssueCount: 0,
      scopeChangeCount: 0,
      failedValidationCount: 0,
      retryCount: 0,
    },
  };

  return {
    users,
    sessions: [],
    workspaces,
    memberships,
    onboardingStates: [
      createOnboardingState("alpha", ["create_workspace_profile", "define_requirements", "define_plan", "start_implementation"], "validate", createdAt),
      createOnboardingState("beta", ["create_workspace_profile", "define_requirements", "define_plan"], "start_implementation", createdAt),
      createOnboardingState("gamma", ["create_workspace_profile", "define_requirements", "define_plan", "start_implementation", "validate", "confirm_release"], "confirm_release", createdAt, true),
    ],
    activities: [
      createActivity("alpha", "account", "account.created", { type: "system", id: "seed" }, { title: "Seeded account created" }, createdAt),
      createActivity("beta", "account", "account.created", { type: "system", id: "seed" }, { title: "Seeded account created" }, createdAt),
      createActivity("gamma", "account", "account.created", { type: "system", id: "seed" }, { title: "Seeded account created" }, createdAt),
    ],
    activationFacts,
    activationMilestones: {},
    activationReadModels: {},
  };
}

export function resetStoreForTests(): TaskloomData {
  cache = seedStore();
  persistStore(cache);
  return cache;
}

function createSeedUser(id: string, email: string, displayName: string, timestamp: string): UserRecord {
  return {
    id,
    email,
    displayName,
    timezone: "UTC",
    passwordHash: hashPassword("demo12345"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createWorkspaceRecord(id: string, name: string, website: string, automationGoal: string, timestamp: string): WorkspaceRecord {
  return {
    id,
    slug: slugify(name) || id,
    name,
    website,
    automationGoal,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createOnboardingState(
  workspaceId: string,
  completedSteps: OnboardingStepKey[],
  currentStep: OnboardingStepKey,
  timestamp: string,
  completed = false,
): OnboardingStateRecord {
  return {
    workspaceId,
    status: completed ? "completed" : completedSteps.length > 0 ? "in_progress" : "not_started",
    currentStep,
    completedSteps,
    completedAt: completed ? timestamp : undefined,
    updatedAt: timestamp,
  };
}

function createActivity(
  workspaceId: string,
  scope: ActivityRecord["scope"],
  event: string,
  actor: ActivityRecord["actor"],
  data: ActivityRecord["data"],
  timestamp: string,
): ActivityRecord {
  return {
    id: `${workspaceId}_${event}_${timestamp}`,
    workspaceId,
    scope,
    event,
    actor,
    data,
    occurredAt: timestamp,
  };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function defaultWorkspaceIdForUser(data: TaskloomData, userId: string): string | null {
  return data.memberships.find((entry) => entry.userId === userId)?.workspaceId ?? null;
}

export const ONBOARDING_STEPS: OnboardingStepKey[] = [
  "create_workspace_profile",
  "define_requirements",
  "define_plan",
  "start_implementation",
  "validate",
  "confirm_release",
];

export function nextIncompleteStep(completedSteps: OnboardingStepKey[]): OnboardingStepKey {
  return ONBOARDING_STEPS.find((step) => !completedSteps.includes(step)) ?? "confirm_release";
}

export function snapshotForWorkspace(data: TaskloomData, workspaceId: string) {
  return buildSignalSnapshotFromFacts({
    ...data.activationFacts[workspaceId],
    now: now(),
  });
}
