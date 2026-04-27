import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DurableActivationProductRecord, WorkspaceActivationFacts } from "./activation/adapters";
import type { ActivationMilestoneRecord, ActivationStatusDto } from "./activation/domain";
import { buildSignalSnapshotFromFacts, buildSignalSnapshotFromProductRecords } from "./activation/adapters";
import { generateId, hashPassword, normalizeEmail, now, slugify } from "./auth-utils";
import {
  findAgentRunForWorkspaceViaRepository,
  listAgentRunsForAgentViaRepository,
  listAgentRunsForWorkspaceViaRepository,
} from "./agent-runs-read.js";
import { listActivitiesForWorkspaceViaRepository } from "./activities-read.js";
import { createActivitiesRepository } from "./repositories/activities-repo.js";
import { createAgentRunsRepository } from "./repositories/agent-runs-repo.js";
import { createInvitationEmailDeliveriesRepository } from "./repositories/invitation-email-deliveries-repo.js";
import { findJobViaRepository, listJobsForWorkspaceViaRepository } from "./jobs-read.js";
import { listInvitationEmailDeliveriesViaRepository } from "./invitation-email-deliveries-read.js";

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

export interface RateLimitRecord {
  id: string;
  count: number;
  resetAt: string;
  updatedAt: string;
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

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceMemberRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invitedByUserId: string;
  acceptedByUserId?: string;
  acceptedAt?: string;
  revokedAt?: string;
  expiresAt: string;
  createdAt: string;
}

export type InvitationEmailDeliveryStatus = "pending" | "sent" | "skipped" | "failed";
export type InvitationEmailDeliveryMode = "dev" | "skip" | "webhook";

export interface InvitationEmailDeliveryRecord {
  id: string;
  workspaceId: string;
  invitationId: string;
  recipientEmail: string;
  subject: string;
  status: InvitationEmailDeliveryStatus;
  provider: string;
  mode: InvitationEmailDeliveryMode;
  createdAt: string;
  sentAt?: string;
  error?: string;
  providerStatus?: string;
  providerDeliveryId?: string;
  providerStatusAt?: string;
  providerError?: string;
}

export interface JobMetricSnapshotRecord {
  id: string;
  capturedAt: string;
  type: string;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  canceledRuns: number;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastDurationMs: number | null;
  averageDurationMs: number | null;
  p95DurationMs: number | null;
}

export interface AlertEventRecord {
  id: string;
  ruleId: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  observedAt: string;
  context: Record<string, unknown>;
  delivered: boolean;
  deliveryError?: string;
  deliveryAttempts?: number;
  lastDeliveryAttemptAt?: string;
  deadLettered?: boolean;
}

export interface WorkspaceBriefRecord {
  workspaceId: string;
  summary: string;
  goals?: string[];
  audience?: string;
  constraints?: string;
  problemStatement?: string;
  targetCustomers?: string[];
  desiredOutcome?: string;
  successMetrics?: string[];
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceBriefVersionRecord {
  id: string;
  workspaceId: string;
  versionNumber: number;
  summary: string;
  goals: string[];
  audience: string;
  constraints: string;
  problemStatement: string;
  targetCustomers: string[];
  desiredOutcome: string;
  successMetrics: string[];
  source: "manual" | "template" | "restore";
  sourceLabel?: string;
  createdByUserId?: string;
  createdByDisplayName?: string;
  createdAt: string;
}

export type RequirementPriority = "must" | "should" | "could";
export type RequirementStatus = "draft" | "approved" | "changed" | "done" | "proposed" | "accepted" | "deferred";

export interface RequirementRecord {
  id: string;
  workspaceId: string;
  title: string;
  detail?: string;
  description?: string;
  priority: RequirementPriority;
  status: RequirementStatus;
  acceptanceCriteria?: string[];
  source?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ImplementationPlanItemStatus = "todo" | "in_progress" | "blocked" | "done";

export interface ImplementationPlanItemRecord {
  id: string;
  workspaceId: string;
  requirementIds: string[];
  title: string;
  description: string;
  status: ImplementationPlanItemStatus;
  ownerUserId?: string;
  order: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowConcernKind = "blocker" | "open_question";
export type WorkflowConcernStatus = "open" | "resolved" | "deferred";
export type WorkflowConcernSeverity = "low" | "medium" | "high" | "critical";

export interface WorkflowConcernRecord {
  id: string;
  workspaceId: string;
  kind: WorkflowConcernKind;
  title: string;
  description: string;
  status: WorkflowConcernStatus;
  severity: WorkflowConcernSeverity;
  relatedPlanItemId?: string;
  relatedRequirementId?: string;
  ownerUserId?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type ValidationEvidenceType = "automated_test" | "manual_check" | "demo" | "metric" | "customer_review";
export type ValidationEvidenceOutcome = "pending" | "passed" | "failed";

export interface ValidationEvidenceRecord {
  id: string;
  workspaceId: string;
  planItemId?: string;
  requirementIds?: string[];
  type?: string;
  title: string;
  detail?: string;
  description?: string;
  status?: ValidationEvidenceOutcome;
  outcome?: string;
  source?: string;
  evidenceUrl?: string;
  capturedByUserId?: string;
  capturedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReleaseConfirmationStatus = "pending" | "confirmed" | "rolled_back";

export interface ReleaseConfirmationRecord {
  workspaceId: string;
  confirmed?: boolean;
  summary?: string;
  confirmedBy?: string;
  id?: string;
  versionLabel?: string;
  status?: ReleaseConfirmationStatus;
  confirmedByUserId?: string;
  confirmedAt?: string;
  releaseNotes?: string;
  validationEvidenceIds?: string[];
  createdAt?: string;
  updatedAt: string;
}

export type WorkspaceBriefCollection = WorkspaceBriefRecord[] | Record<string, WorkspaceBriefRecord>;
export type ReleaseConfirmationCollection = ReleaseConfirmationRecord[] | Record<string, ReleaseConfirmationRecord>;

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

export type ActivationSignalKind = "retry" | "scope_change";
export type ActivationSignalSource = "activity" | "agent_run" | "workflow" | "seed" | "user_fact" | "system_fact";
export type ActivationSignalOrigin = "user_entered" | "system_observed";

export interface ActivationSignalRecord {
  id: string;
  workspaceId: string;
  kind: ActivationSignalKind;
  source: ActivationSignalSource;
  origin?: ActivationSignalOrigin;
  sourceId?: string;
  stableKey?: string;
  createdAt: string;
  updatedAt: string;
  data?: Record<string, string | number | boolean | null | undefined>;
}

export type AgentStatus = "active" | "paused" | "archived";
export type AgentTriggerKind = "manual" | "schedule" | "webhook" | "email";

export interface AgentPlaybookStep {
  id: string;
  title: string;
  instruction: string;
}

export type AgentInputFieldType = "string" | "number" | "boolean" | "url" | "enum";

export interface AgentInputField {
  key: string;
  label: string;
  type: AgentInputFieldType;
  required: boolean;
  description?: string;
  options?: string[];
  defaultValue?: string;
}

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  instructions: string;
  providerId?: string;
  model?: string;
  tools: string[];
  enabledTools?: string[];
  routeKey?: string;
  webhookToken?: string;
  schedule?: string;
  triggerKind?: AgentTriggerKind;
  playbook?: AgentPlaybookStep[];
  status: AgentStatus;
  createdByUserId: string;
  templateId?: string;
  inputSchema: AgentInputField[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type ProviderKind = "openai" | "anthropic" | "azure_openai" | "ollama" | "custom";
export type ProviderStatus = "connected" | "missing_key" | "disabled";

export interface ProviderRecord {
  id: string;
  workspaceId: string;
  name: string;
  kind: ProviderKind;
  defaultModel: string;
  baseUrl?: string;
  apiKeyConfigured: boolean;
  status: ProviderStatus;
  createdAt: string;
  updatedAt: string;
}

export type AgentRunStatus = "queued" | "running" | "success" | "failed" | "canceled";
export type AgentRunStepStatus = "success" | "failed" | "skipped";

export interface AgentRunStep {
  id: string;
  title: string;
  status: AgentRunStepStatus;
  output: string;
  durationMs: number;
  startedAt: string;
}

export type AgentRunLogLevel = "info" | "warn" | "error";

export interface AgentRunLogEntry {
  at: string;
  level: AgentRunLogLevel;
  message: string;
}

export interface AgentRunToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  artifacts?: { path: string; bytes: number; kind: string }[];
  durationMs: number;
  startedAt: string;
  completedAt: string;
  status: "ok" | "error" | "timeout";
}

export interface AgentRunRecord {
  id: string;
  workspaceId: string;
  agentId?: string;
  title: string;
  status: AgentRunStatus;
  triggerKind?: AgentTriggerKind;
  transcript?: AgentRunStep[];
  startedAt?: string;
  completedAt?: string;
  inputs?: Record<string, string | number | boolean>;
  output?: string;
  error?: string;
  logs: AgentRunLogEntry[];
  toolCalls?: AgentRunToolCall[];
  modelUsed?: string;
  costUsd?: number;
  createdAt: string;
  updatedAt: string;
}

export type OnboardingStepKey =
  | "create_workspace_profile"
  | "define_requirements"
  | "define_plan"
  | "start_implementation"
  | "validate"
  | "confirm_release";

export type WorkspaceEnvVarScope = "all" | "build" | "runtime";

export interface WorkspaceEnvVarRecord {
  id: string;
  workspaceId: string;
  key: string;
  value: string;
  scope: WorkspaceEnvVarScope;
  secret: boolean;
  description?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApiKeyProvider = "anthropic" | "openai" | "minimax" | "ollama";

export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  provider: ApiKeyProvider;
  label: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCallRecord {
  id: string;
  workspaceId: string;
  routeKey: string;
  provider: "anthropic" | "openai" | "minimax" | "ollama" | "stub";
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
  status: "success" | "error" | "canceled";
  errorMessage?: string;
  startedAt: string;
  completedAt: string;
}

export type ShareTokenScope = "brief" | "plan" | "overview";

export interface ShareTokenRecord {
  id: string;
  workspaceId: string;
  token: string;
  scope: ShareTokenScope;
  createdByUserId: string;
  expiresAt?: string;
  revokedAt?: string;
  lastReadAt?: string;
  readCount: number;
  createdAt: string;
}

export type JobStatus = "queued" | "running" | "success" | "failed" | "canceled";

export interface JobRecord {
  id: string;
  workspaceId: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  cron?: string;
  result?: unknown;
  error?: string;
  cancelRequested?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskloomData {
  users: UserRecord[];
  sessions: SessionRecord[];
  rateLimits?: RateLimitRecord[];
  workspaces: WorkspaceRecord[];
  memberships: WorkspaceMemberRecord[];
  workspaceInvitations: WorkspaceInvitationRecord[];
  invitationEmailDeliveries: InvitationEmailDeliveryRecord[];
  workspaceBriefs: WorkspaceBriefCollection;
  workspaceBriefVersions: WorkspaceBriefVersionRecord[];
  requirements: RequirementRecord[];
  implementationPlanItems: ImplementationPlanItemRecord[];
  workflowConcerns: WorkflowConcernRecord[];
  validationEvidence: ValidationEvidenceRecord[];
  releaseConfirmations: ReleaseConfirmationCollection;
  onboardingStates: OnboardingStateRecord[];
  activities: ActivityRecord[];
  activationSignals: ActivationSignalRecord[];
  agents: AgentRecord[];
  providers: ProviderRecord[];
  agentRuns: AgentRunRecord[];
  workspaceEnvVars: WorkspaceEnvVarRecord[];
  apiKeys: ApiKeyRecord[];
  providerCalls: ProviderCallRecord[];
  jobs: JobRecord[];
  jobMetricSnapshots: JobMetricSnapshotRecord[];
  alertEvents: AlertEventRecord[];
  shareTokens: ShareTokenRecord[];
  activationFacts: Record<string, WorkspaceActivationFacts>;
  activationMilestones: Record<string, ActivationMilestoneRecord[]>;
  activationReadModels: Record<string, ActivationStatusDto>;
}

const DATA_FILE = resolve(process.cwd(), "data", "taskloom.json");
const DEFAULT_DB_FILE = resolve(process.cwd(), "data", "taskloom.sqlite");
const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "db", "migrations");

let cache: TaskloomData | null = null;
let cacheBackendKey: string | null = null;

export function loadStore(): TaskloomData {
  const backend = currentStoreBackend();
  if (cache && cacheBackendKey === backend.key) return cache;

  cacheBackendKey = backend.key;
  cache = backend.load();
  return cache;
}

export function mutateStore<T>(mutator: (data: TaskloomData) => T): T {
  if (process.env.TASKLOOM_STORE === "sqlite") {
    return mutateSqliteStore(resolve(process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE), mutator);
  }

  const data = loadStore();
  const result = mutator(data);
  persistStore(data);
  return result;
}

let activeMutateSqliteDepth = 0;
const pendingActivityDualWrites: ActivityRecord[] = [];
const pendingAgentRunDualWrites: AgentRunRecord[] = [];
const pendingInvitationEmailDeliveryDualWrites: InvitationEmailDeliveryRecord[] = [];

function mutateSqliteStore<T>(dbPath: string, mutator: (data: TaskloomData) => T): T {
  const db = openStoreDatabase(dbPath);
  const backendKey = `sqlite:${dbPath}`;
  activeMutateSqliteDepth += 1;
  try {
    db.exec("begin immediate");
    try {
      const data = loadSqliteStore(db) ?? seedStore();
      const result = mutator(data);
      persistSqliteStoreRows(db, data);
      db.exec("commit");
      cache = data;
      cacheBackendKey = backendKey;
      return result;
    } catch (error) {
      db.exec("rollback");
      pendingActivityDualWrites.length = 0;
      pendingAgentRunDualWrites.length = 0;
      pendingInvitationEmailDeliveryDualWrites.length = 0;
      throw error;
    }
  } finally {
    db.close();
    activeMutateSqliteDepth -= 1;
    if (activeMutateSqliteDepth === 0) {
      flushPendingActivityDualWrites();
      flushPendingAgentRunDualWrites();
      flushPendingInvitationEmailDeliveryDualWrites();
    }
  }
}

function flushPendingActivityDualWrites(): void {
  if (pendingActivityDualWrites.length === 0) return;
  const drained = pendingActivityDualWrites.splice(0, pendingActivityDualWrites.length);
  if (process.env.TASKLOOM_STORE !== "sqlite") return;
  const repo = createActivitiesRepository({});
  for (const record of drained) {
    repo.upsert(record);
  }
}

function flushPendingAgentRunDualWrites(): void {
  if (pendingAgentRunDualWrites.length === 0) return;
  const drained = pendingAgentRunDualWrites.splice(0, pendingAgentRunDualWrites.length);
  if (process.env.TASKLOOM_STORE !== "sqlite") return;
  const repo = createAgentRunsRepository({});
  for (const record of drained) {
    repo.upsert(record);
  }
}

function flushPendingInvitationEmailDeliveryDualWrites(): void {
  if (pendingInvitationEmailDeliveryDualWrites.length === 0) return;
  const drained = pendingInvitationEmailDeliveryDualWrites.splice(0, pendingInvitationEmailDeliveryDualWrites.length);
  if (process.env.TASKLOOM_STORE !== "sqlite") return;
  const repo = createInvitationEmailDeliveriesRepository({});
  for (const record of drained) {
    repo.upsert(record);
  }
}

function enqueueActivityDualWrite(record: ActivityRecord): void {
  if (process.env.TASKLOOM_STORE !== "sqlite") return;
  const snapshot = cloneActivityRecord(record);
  if (activeMutateSqliteDepth > 0) {
    pendingActivityDualWrites.push(snapshot);
  } else {
    const repo = createActivitiesRepository({});
    repo.upsert(snapshot);
  }
}

function enqueueInvitationEmailDeliveryDualWrite(record: InvitationEmailDeliveryRecord): void {
  if (process.env.TASKLOOM_STORE !== "sqlite") return;
  if (activeMutateSqliteDepth > 0) {
    pendingInvitationEmailDeliveryDualWrites.push({ ...record });
  } else {
    const repo = createInvitationEmailDeliveriesRepository({});
    repo.upsert(record);
  }
}

export interface RecordActivityOptions {
  position?: "start" | "end";
  dedupe?: boolean;
}

export function recordActivity(
  data: TaskloomData,
  activity: ActivityRecord,
  options: RecordActivityOptions = {},
): ActivityRecord {
  if (options.dedupe) {
    const existing = data.activities.find((entry) => entry.id === activity.id);
    if (existing) return existing;
  }

  if (options.position === "end") {
    data.activities.push(activity);
  } else {
    data.activities.unshift(activity);
  }
  enqueueActivityDualWrite(activity);
  return activity;
}

function cloneActivityRecord(record: ActivityRecord): ActivityRecord {
  return {
    ...record,
    actor: { ...record.actor },
    data: { ...record.data },
  };
}

export function persistStore(data: TaskloomData): void {
  currentStoreBackend().persist(data);
}

function persistJsonStore(data: TaskloomData): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function currentStoreBackend(): StoreBackend {
  if (process.env.TASKLOOM_STORE === "sqlite") return sqliteStoreBackend(resolve(process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE));
  return jsonStoreBackend();
}

interface StoreBackend {
  key: string;
  load(): TaskloomData;
  persist(data: TaskloomData): void;
  reset(): TaskloomData;
}

function jsonStoreBackend(): StoreBackend {
  return {
    key: `json:${DATA_FILE}`,
    load() {
      try {
        return normalizeStore(JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<TaskloomData>);
      } catch {
        const seeded = seedStore();
        persistJsonStore(seeded);
        return seeded;
      }
    },
    persist: persistJsonStore,
    reset() {
      const seeded = seedStore();
      persistJsonStore(seeded);
      return seeded;
    },
  };
}

function sqliteStoreBackend(dbPath: string): StoreBackend {
  return {
    key: `sqlite:${dbPath}`,
    load() {
      const db = openStoreDatabase(dbPath);
      try {
        const data = loadSqliteStore(db);
        if (data) return data;
        const seeded = seedStore();
        persistSqliteStore(db, seeded);
        return seeded;
      } finally {
        db.close();
      }
    },
    persist(data) {
      const db = openStoreDatabase(dbPath);
      try {
        persistSqliteStore(db, data);
      } finally {
        db.close();
      }
    },
    reset() {
      const db = openStoreDatabase(dbPath);
      try {
        const seeded = seedStore();
        persistSqliteStore(db, seeded);
        return seeded;
      } finally {
        db.close();
      }
    },
  };
}

export function loadSqliteAppData(dbPath: string): TaskloomData | null {
  const db = openStoreDatabase(dbPath);
  try {
    return loadSqliteStore(db);
  } finally {
    db.close();
  }
}

export function persistSqliteAppData(dbPath: string, data: TaskloomData): void {
  const db = openStoreDatabase(dbPath);
  try {
    persistSqliteStore(db, normalizeStore(data));
  } finally {
    db.close();
  }
}

function openStoreDatabase(dbPath: string): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("pragma busy_timeout = 5000");
  db.exec("pragma journal_mode = wal");
  db.exec("pragma synchronous = normal");
  db.exec("pragma foreign_keys = on");
  applyStoreMigrations(db);
  return db;
}

function applyStoreMigrations(db: DatabaseSync): void {
  db.exec("create table if not exists schema_migrations (name text primary key, applied_at text not null default (datetime('now')))");
  const appliedRows = db.prepare("select name from schema_migrations order by name").all() as Array<{ name: string }>;
  const alreadyApplied = new Set(appliedRows.map((row) => row.name));
  const migrations = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();

  for (const name of migrations) {
    if (alreadyApplied.has(name)) continue;
    const sql = readFileSync(resolve(MIGRATIONS_DIR, name), "utf8");
    db.exec("begin");
    try {
      db.exec(sql);
      db.prepare("insert into schema_migrations (name) values (?)").run(name);
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }
}

type StoreCollectionKey = keyof TaskloomData;

export interface WorkspaceRecordCollectionMap {
  invitationEmailDeliveries: InvitationEmailDeliveryRecord;
  activities: ActivityRecord;
  jobs: JobRecord;
  agents: AgentRecord;
  agentRuns: AgentRunRecord;
  providerCalls: ProviderCallRecord;
  requirements: RequirementRecord;
  implementationPlanItems: ImplementationPlanItemRecord;
  workflowConcerns: WorkflowConcernRecord;
  validationEvidence: ValidationEvidenceRecord;
  workspaceBriefVersions: WorkspaceBriefVersionRecord;
  providers: ProviderRecord;
  activationSignals: ActivationSignalRecord;
  workspaceEnvVars: WorkspaceEnvVarRecord;
}

export type WorkspaceRecordCollectionKey = keyof WorkspaceRecordCollectionMap;

export type WorkspaceRecordOrder =
  | "id"
  | "createdAtAsc"
  | "createdAtDesc"
  | "updatedAtDesc"
  | "occurredAtDesc"
  | "scheduledAtAsc"
  | "completedAtDesc"
  | "orderAsc"
  | "versionNumberDesc"
  | "nameAsc"
  | "keyAsc";

export interface ListWorkspaceRecordsOptions<TRecord> {
  orderBy?: WorkspaceRecordOrder;
  limit?: number;
  filter?: (record: TRecord) => boolean;
}

const RECORD_COLLECTIONS = [
  "users",
  "sessions",
  "workspaces",
  "memberships",
  "workspaceInvitations",
  "workspaceBriefs",
  "workspaceBriefVersions",
  "requirements",
  "implementationPlanItems",
  "workflowConcerns",
  "validationEvidence",
  "releaseConfirmations",
  "onboardingStates",
  "activationSignals",
  "agents",
  "providers",
  "workspaceEnvVars",
  "apiKeys",
  "providerCalls",
  "shareTokens",
] as const satisfies readonly StoreCollectionKey[];

const MAP_COLLECTIONS = ["activationFacts", "activationMilestones", "activationReadModels"] as const satisfies readonly StoreCollectionKey[];

interface SqliteStoreRow {
  collection: StoreCollectionKey;
  payload: string;
}

interface SqliteRateLimitRow {
  id: string;
  count: number;
  reset_at: string;
  updated_at: string;
}

function loadSqliteStore(db: DatabaseSync): TaskloomData | null {
  const rows = db.prepare("select collection, payload from app_records order by collection, id").all() as unknown as SqliteStoreRow[];
  const rateLimits = loadSqliteRateLimitBuckets(db);
  const dedicatedCollections = loadDedicatedRelationalCollections(db);
  const hasDedicatedRows = Object.values(dedicatedCollections).some((records) => records.length > 0);
  if (rows.length === 0 && rateLimits.length === 0 && !hasDedicatedRows) return null;

  const partial: Partial<TaskloomData> = { rateLimits };
  for (const row of rows) {
    const payload = JSON.parse(row.payload) as unknown;
    if (MAP_COLLECTIONS.includes(row.collection as (typeof MAP_COLLECTIONS)[number])) {
      const existing = partial[row.collection] as Record<string, unknown> | undefined;
      partial[row.collection] = { ...existing, ...(payload as Record<string, unknown>) } as never;
      continue;
    }
    const existing = partial[row.collection] as unknown[] | undefined;
    partial[row.collection] = [...(existing ?? []), payload] as never;
  }
  mergeDedicatedRelationalCollections(partial, dedicatedCollections);

  return normalizeStore(partial);
}

function persistSqliteStore(db: DatabaseSync, data: TaskloomData): void {
  db.exec("begin immediate");
  try {
    persistSqliteStoreRows(db, data);
    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

function persistSqliteStoreRows(db: DatabaseSync, data: TaskloomData): void {
  db.exec("delete from app_record_search");
  db.exec("delete from app_records");
  persistSqliteRateLimitBuckets(db, data.rateLimits ?? []);
  const insert = db.prepare(`
    insert into app_records (collection, id, workspace_id, payload, updated_at)
    values (?, ?, ?, json(?), ?)
  `);
  const insertSearch = db.prepare(`
    insert into app_record_search (collection, id, workspace_id, user_id, email, token)
    values (?, ?, ?, ?, ?, ?)
  `);

  for (const collection of RECORD_COLLECTIONS) {
    for (const payload of recordsForCollection(data, collection)) {
      const id = recordId(collection, payload);
      insert.run(collection, id, workspaceIdForRecord(payload), JSON.stringify(payload), updatedAtForRecord(payload));
      const searchValues = searchValuesForRecord(collection, payload);
      if (searchValues) {
        insertSearch.run(collection, id, searchValues.workspaceId, searchValues.userId, searchValues.email, searchValues.token);
      }
    }
  }
  persistDedicatedRelationalRows(db, data);

  for (const collection of MAP_COLLECTIONS) {
    const map = data[collection] as Record<string, unknown>;
    for (const [workspaceId, payload] of Object.entries(map)) {
      insert.run(collection, workspaceId, workspaceId, JSON.stringify({ [workspaceId]: payload }), null);
    }
  }
}

type DedicatedRelationalCollectionKey =
  | "jobMetricSnapshots"
  | "alertEvents"
  | "agentRuns"
  | "jobs"
  | "invitationEmailDeliveries"
  | "activities";

type DedicatedRelationalCollections = Pick<TaskloomData, DedicatedRelationalCollectionKey>;

function loadDedicatedRelationalCollections(db: DatabaseSync): DedicatedRelationalCollections {
  return {
    jobMetricSnapshots: loadDedicatedJobMetricSnapshots(db),
    alertEvents: loadDedicatedAlertEvents(db),
    agentRuns: loadDedicatedAgentRuns(db),
    jobs: loadDedicatedJobs(db),
    invitationEmailDeliveries: loadDedicatedInvitationEmailDeliveries(db),
    activities: loadDedicatedActivities(db),
  };
}

function mergeDedicatedRelationalCollections(
  partial: Partial<TaskloomData>,
  dedicatedCollections: DedicatedRelationalCollections,
): void {
  for (const collection of Object.keys(dedicatedCollections) as DedicatedRelationalCollectionKey[]) {
    const records = dedicatedCollections[collection];
    if (records.length > 0 || partial[collection] === undefined) {
      partial[collection] = records as never;
    }
  }
}

function loadDedicatedJobMetricSnapshots(db: DatabaseSync): JobMetricSnapshotRecord[] {
  const rows = db.prepare(`
    select id, captured_at, type, total_runs, succeeded_runs, failed_runs, canceled_runs,
      last_run_started_at, last_run_finished_at, last_duration_ms, average_duration_ms, p95_duration_ms
    from job_metric_snapshots
    order by captured_at asc, id asc
  `).all() as Array<{
    id: string;
    captured_at: string;
    type: string;
    total_runs: number;
    succeeded_runs: number;
    failed_runs: number;
    canceled_runs: number;
    last_run_started_at: string | null;
    last_run_finished_at: string | null;
    last_duration_ms: number | null;
    average_duration_ms: number | null;
    p95_duration_ms: number | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    capturedAt: row.captured_at,
    type: row.type,
    totalRuns: row.total_runs,
    succeededRuns: row.succeeded_runs,
    failedRuns: row.failed_runs,
    canceledRuns: row.canceled_runs,
    lastRunStartedAt: row.last_run_started_at,
    lastRunFinishedAt: row.last_run_finished_at,
    lastDurationMs: row.last_duration_ms,
    averageDurationMs: row.average_duration_ms,
    p95DurationMs: row.p95_duration_ms,
  }));
}

function loadDedicatedAlertEvents(db: DatabaseSync): AlertEventRecord[] {
  const rows = db.prepare(`
    select id, rule_id, severity, title, detail, observed_at, context,
      delivered, delivery_error, delivery_attempts, last_delivery_attempt_at, dead_lettered
    from alert_events
    order by observed_at desc, id asc
  `).all() as Array<{
    id: string;
    rule_id: string;
    severity: AlertEventRecord["severity"];
    title: string;
    detail: string;
    observed_at: string;
    context: string;
    delivered: number;
    delivery_error: string | null;
    delivery_attempts: number | null;
    last_delivery_attempt_at: string | null;
    dead_lettered: number | null;
  }>;
  return rows.map((row) => {
    const record: AlertEventRecord = {
      id: row.id,
      ruleId: row.rule_id,
      severity: row.severity,
      title: row.title,
      detail: row.detail,
      observedAt: row.observed_at,
      context: parseJsonRecord(row.context),
      delivered: row.delivered === 1,
    };
    if (row.delivery_error !== null) record.deliveryError = row.delivery_error;
    if (row.delivery_attempts !== null) record.deliveryAttempts = row.delivery_attempts;
    if (row.last_delivery_attempt_at !== null) record.lastDeliveryAttemptAt = row.last_delivery_attempt_at;
    if (row.dead_lettered !== null) record.deadLettered = row.dead_lettered === 1;
    return record;
  });
}

function loadDedicatedAgentRuns(db: DatabaseSync): AgentRunRecord[] {
  const rows = db.prepare(`
    select id, workspace_id, agent_id, title, status, trigger_kind,
      started_at, completed_at, inputs, output, error,
      logs, tool_calls, transcript, model_used, cost_usd,
      created_at, updated_at
    from agent_runs
    order by created_at desc, id asc
  `).all() as Array<{
    id: string;
    workspace_id: string;
    agent_id: string | null;
    title: string;
    status: AgentRunStatus;
    trigger_kind: AgentTriggerKind | null;
    started_at: string | null;
    completed_at: string | null;
    inputs: string | null;
    output: string | null;
    error: string | null;
    logs: string;
    tool_calls: string | null;
    transcript: string | null;
    model_used: string | null;
    cost_usd: number | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((row) => {
    const record: AgentRunRecord = {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      status: row.status,
      logs: parseJsonArrayValue<AgentRunLogEntry>(row.logs),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (row.agent_id !== null) record.agentId = row.agent_id;
    if (row.trigger_kind !== null) record.triggerKind = row.trigger_kind;
    if (row.transcript !== null) record.transcript = parseJsonArrayValue<AgentRunStep>(row.transcript);
    if (row.started_at !== null) record.startedAt = row.started_at;
    if (row.completed_at !== null) record.completedAt = row.completed_at;
    if (row.inputs !== null) record.inputs = parseJsonRecord(row.inputs) as Record<string, string | number | boolean>;
    if (row.output !== null) record.output = row.output;
    if (row.error !== null) record.error = row.error;
    if (row.tool_calls !== null) record.toolCalls = parseJsonArrayValue<AgentRunToolCall>(row.tool_calls);
    if (row.model_used !== null) record.modelUsed = row.model_used;
    if (row.cost_usd !== null) record.costUsd = row.cost_usd;
    return record;
  });
}

function loadDedicatedJobs(db: DatabaseSync): JobRecord[] {
  const rows = db.prepare(`
    select id, workspace_id, type, payload, status, attempts, max_attempts,
      scheduled_at, started_at, completed_at, cron, result, error,
      cancel_requested, created_at, updated_at
    from jobs
    order by created_at desc, id asc
  `).all() as Array<{
    id: string;
    workspace_id: string;
    type: string;
    payload: string;
    status: JobStatus;
    attempts: number;
    max_attempts: number;
    scheduled_at: string;
    started_at: string | null;
    completed_at: string | null;
    cron: string | null;
    result: string | null;
    error: string | null;
    cancel_requested: number | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((row) => {
    const record: JobRecord = {
      id: row.id,
      workspaceId: row.workspace_id,
      type: row.type,
      payload: parseJsonRecord(row.payload),
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      scheduledAt: row.scheduled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (row.started_at !== null) record.startedAt = row.started_at;
    if (row.completed_at !== null) record.completedAt = row.completed_at;
    if (row.cron !== null) record.cron = row.cron;
    if (row.result !== null) record.result = parseJsonUnknown(row.result);
    if (row.error !== null) record.error = row.error;
    if (row.cancel_requested !== null) record.cancelRequested = row.cancel_requested === 1;
    return record;
  });
}

function loadDedicatedInvitationEmailDeliveries(db: DatabaseSync): InvitationEmailDeliveryRecord[] {
  const rows = db.prepare(`
    select id, workspace_id, invitation_id, recipient_email, subject,
      status, provider, mode, created_at, sent_at, error,
      provider_status, provider_delivery_id, provider_status_at, provider_error
    from invitation_email_deliveries
    order by created_at desc, id asc
  `).all() as Array<{
    id: string;
    workspace_id: string;
    invitation_id: string;
    recipient_email: string;
    subject: string;
    status: InvitationEmailDeliveryStatus;
    provider: string;
    mode: InvitationEmailDeliveryMode;
    created_at: string;
    sent_at: string | null;
    error: string | null;
    provider_status: string | null;
    provider_delivery_id: string | null;
    provider_status_at: string | null;
    provider_error: string | null;
  }>;
  return rows.map((row) => {
    const record: InvitationEmailDeliveryRecord = {
      id: row.id,
      workspaceId: row.workspace_id,
      invitationId: row.invitation_id,
      recipientEmail: row.recipient_email,
      subject: row.subject,
      status: row.status,
      provider: row.provider,
      mode: row.mode,
      createdAt: row.created_at,
    };
    if (row.sent_at !== null) record.sentAt = row.sent_at;
    if (row.error !== null) record.error = row.error;
    if (row.provider_status !== null) record.providerStatus = row.provider_status;
    if (row.provider_delivery_id !== null) record.providerDeliveryId = row.provider_delivery_id;
    if (row.provider_status_at !== null) record.providerStatusAt = row.provider_status_at;
    if (row.provider_error !== null) record.providerError = row.provider_error;
    return record;
  });
}

function loadDedicatedActivities(db: DatabaseSync): ActivityRecord[] {
  const rows = db.prepare(`
    select payload
    from activities
    order by occurred_at desc, id desc
  `).all() as Array<{ payload: string }>;
  return rows.map((row) => JSON.parse(row.payload) as ActivityRecord);
}

function persistDedicatedRelationalRows(db: DatabaseSync, data: TaskloomData): void {
  persistDedicatedJobMetricSnapshots(db, data.jobMetricSnapshots ?? []);
  persistDedicatedAlertEvents(db, data.alertEvents ?? []);
  persistDedicatedAgentRuns(db, data.agentRuns ?? []);
  persistDedicatedJobs(db, data.jobs ?? []);
  persistDedicatedInvitationEmailDeliveries(db, data.invitationEmailDeliveries ?? []);
  persistDedicatedActivities(db, data.activities ?? []);
}

function persistDedicatedJobMetricSnapshots(db: DatabaseSync, records: JobMetricSnapshotRecord[]): void {
  db.exec("delete from job_metric_snapshots");
  const stmt = db.prepare(`
    insert or replace into job_metric_snapshots (
      id, captured_at, type, total_runs, succeeded_runs, failed_runs, canceled_runs,
      last_run_started_at, last_run_finished_at, last_duration_ms, average_duration_ms, p95_duration_ms
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of records) {
    stmt.run(
      record.id,
      record.capturedAt,
      record.type,
      record.totalRuns,
      record.succeededRuns,
      record.failedRuns,
      record.canceledRuns,
      record.lastRunStartedAt,
      record.lastRunFinishedAt,
      record.lastDurationMs,
      record.averageDurationMs,
      record.p95DurationMs,
    );
  }
}

function persistDedicatedAlertEvents(db: DatabaseSync, records: AlertEventRecord[]): void {
  db.exec("delete from alert_events");
  const stmt = db.prepare(`
    insert or replace into alert_events (
      id, rule_id, severity, title, detail, observed_at, context,
      delivered, delivery_error, delivery_attempts, last_delivery_attempt_at, dead_lettered
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of records) {
    stmt.run(
      record.id,
      record.ruleId,
      record.severity,
      record.title,
      record.detail,
      record.observedAt,
      JSON.stringify(record.context ?? {}),
      record.delivered ? 1 : 0,
      record.deliveryError ?? null,
      record.deliveryAttempts ?? null,
      record.lastDeliveryAttemptAt ?? null,
      record.deadLettered === undefined ? null : record.deadLettered ? 1 : 0,
    );
  }
}

function persistDedicatedAgentRuns(db: DatabaseSync, records: AgentRunRecord[]): void {
  db.exec("delete from agent_runs");
  const stmt = db.prepare(`
    insert or replace into agent_runs (
      id, workspace_id, agent_id, title, status, trigger_kind,
      started_at, completed_at, inputs, output, error,
      logs, tool_calls, transcript, model_used, cost_usd,
      created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of records) {
    stmt.run(
      record.id,
      record.workspaceId,
      record.agentId ?? null,
      record.title,
      record.status,
      record.triggerKind ?? null,
      record.startedAt ?? null,
      record.completedAt ?? null,
      record.inputs === undefined ? null : JSON.stringify(record.inputs),
      record.output ?? null,
      record.error ?? null,
      JSON.stringify(record.logs ?? []),
      record.toolCalls === undefined ? null : JSON.stringify(record.toolCalls),
      record.transcript === undefined ? null : JSON.stringify(record.transcript),
      record.modelUsed ?? null,
      record.costUsd ?? null,
      record.createdAt,
      record.updatedAt,
    );
  }
}

function persistDedicatedJobs(db: DatabaseSync, records: JobRecord[]): void {
  db.exec("delete from jobs");
  const stmt = db.prepare(`
    insert or replace into jobs (
      id, workspace_id, type, payload, status, attempts, max_attempts,
      scheduled_at, started_at, completed_at, cron, result, error,
      cancel_requested, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of records) {
    stmt.run(
      record.id,
      record.workspaceId,
      record.type,
      JSON.stringify(record.payload ?? {}),
      record.status,
      record.attempts,
      record.maxAttempts,
      record.scheduledAt,
      record.startedAt ?? null,
      record.completedAt ?? null,
      record.cron ?? null,
      record.result === undefined ? null : JSON.stringify(record.result),
      record.error ?? null,
      record.cancelRequested === undefined ? null : record.cancelRequested ? 1 : 0,
      record.createdAt,
      record.updatedAt,
    );
  }
}

function persistDedicatedInvitationEmailDeliveries(
  db: DatabaseSync,
  records: InvitationEmailDeliveryRecord[],
): void {
  db.exec("delete from invitation_email_deliveries");
  const stmt = db.prepare(`
    insert or replace into invitation_email_deliveries (
      id, workspace_id, invitation_id, recipient_email, subject,
      status, provider, mode, created_at, sent_at, error,
      provider_status, provider_delivery_id, provider_status_at, provider_error
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of records) {
    stmt.run(
      record.id,
      record.workspaceId,
      record.invitationId,
      record.recipientEmail,
      record.subject,
      record.status,
      record.provider,
      record.mode,
      record.createdAt,
      record.sentAt ?? null,
      record.error ?? null,
      record.providerStatus ?? null,
      record.providerDeliveryId ?? null,
      record.providerStatusAt ?? null,
      record.providerError ?? null,
    );
  }
}

function persistDedicatedActivities(db: DatabaseSync, records: ActivityRecord[]): void {
  db.exec("delete from activities");
  const stmt = db.prepare(`
    insert or replace into activities (
      id, workspace_id, occurred_at, type, payload, user_id, related_subject
    ) values (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of records) {
    stmt.run(
      record.id,
      record.workspaceId,
      record.occurredAt,
      record.event,
      JSON.stringify(record),
      record.actor.type === "user" ? record.actor.id : null,
      null,
    );
  }
}

function parseJsonRecord(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function parseJsonArrayValue<T>(raw: string | null | undefined): T[] {
  if (raw === null || raw === undefined) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonUnknown(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

interface AppRecordSearchValues {
  workspaceId: SQLInputValue;
  userId: SQLInputValue;
  email: SQLInputValue;
  token: SQLInputValue;
}

function searchValuesForRecord(collection: StoreCollectionKey, payload: unknown): AppRecordSearchValues | null {
  const record = payload as Record<string, unknown>;
  if (![
    "users",
    "sessions",
    "workspaces",
    "memberships",
    "workspaceInvitations",
    "shareTokens",
    "activationSignals",
    "workspaceBriefs",
    "workspaceBriefVersions",
    "requirements",
    "implementationPlanItems",
    "workflowConcerns",
    "validationEvidence",
    "releaseConfirmations",
    "agents",
    "providers",
    "workspaceEnvVars",
    "providerCalls",
  ].includes(collection)) return null;
  const workspaceId = typeof record.workspaceId === "string" ? record.workspaceId : null;
  const userId = typeof record.userId === "string" ? record.userId : null;
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : null;
  const token = typeof record.token === "string" ? record.token : null;
  return { workspaceId, userId, email, token };
}

type IndexedCollection =
  | "users"
  | "sessions"
  | "workspaces"
  | "memberships"
  | "workspaceInvitations"
  | "workspaceBriefs"
  | "workspaceBriefVersions"
  | "requirements"
  | "implementationPlanItems"
  | "workflowConcerns"
  | "validationEvidence"
  | "releaseConfirmations"
  | "agents"
  | "providers"
  | "providerCalls"
  | "shareTokens";

function sqliteIndexedRecord<T>(collection: IndexedCollection, whereSql: string, values: SQLInputValue[]): T | null {
  if (process.env.TASKLOOM_STORE !== "sqlite") return null;
  const dbPath = resolve(process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE);
  const db = openStoreDatabase(dbPath);
  try {
    const row = db.prepare(`
      select app_records.payload as payload
      from app_record_search
      join app_records
        on app_records.collection = app_record_search.collection
       and app_records.id = app_record_search.id
      where app_record_search.collection = ? and ${whereSql}
      limit 1
    `).get(collection, ...values) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) as T : null;
  } finally {
    db.close();
  }
}

function sqliteIndexedRecords<T>(collection: IndexedCollection, whereSql: string, values: SQLInputValue[], orderSql = "app_records.id"): T[] | null {
  if (process.env.TASKLOOM_STORE !== "sqlite") return null;
  const dbPath = resolve(process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE);
  const db = openStoreDatabase(dbPath);
  try {
    const rows = db.prepare(`
      select app_records.payload as payload
      from app_record_search
      join app_records
        on app_records.collection = app_record_search.collection
       and app_records.id = app_record_search.id
      where app_record_search.collection = ? and ${whereSql}
      order by ${orderSql}
    `).all(collection, ...values) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as T);
  } finally {
    db.close();
  }
}

const WORKSPACE_RECORD_ORDER_SQL = {
  id: "app_records.id",
  createdAtAsc: "json_extract(app_records.payload, '$.createdAt') asc, app_records.id asc",
  createdAtDesc: "json_extract(app_records.payload, '$.createdAt') desc, app_records.id desc",
  updatedAtDesc: "coalesce(app_records.updated_at, json_extract(app_records.payload, '$.updatedAt'), json_extract(app_records.payload, '$.createdAt')) desc, app_records.id desc",
  occurredAtDesc: "json_extract(app_records.payload, '$.occurredAt') desc, app_records.id desc",
  scheduledAtAsc: "json_extract(app_records.payload, '$.scheduledAt') asc, app_records.id asc",
  completedAtDesc: "json_extract(app_records.payload, '$.completedAt') desc, app_records.id desc",
  orderAsc: "json_extract(app_records.payload, '$.order') asc, app_records.id asc",
  versionNumberDesc: "json_extract(app_records.payload, '$.versionNumber') desc, app_records.id desc",
  nameAsc: "json_extract(app_records.payload, '$.name') collate nocase asc, app_records.id asc",
  keyAsc: "json_extract(app_records.payload, '$.key') collate nocase asc, app_records.id asc",
} as const satisfies Record<WorkspaceRecordOrder, string>;

export function listWorkspaceRecordsIndexed<K extends WorkspaceRecordCollectionKey>(
  collection: K,
  workspaceId: string,
  options: ListWorkspaceRecordsOptions<WorkspaceRecordCollectionMap[K]> = {},
): WorkspaceRecordCollectionMap[K][] {
  const queryLimit = options.filter ? undefined : options.limit;
  const sqliteRecords = sqliteWorkspaceRecords(collection, workspaceId, options.orderBy ?? "id", queryLimit);
  const records = sqliteRecords ?? listWorkspaceRecordsFromStore(collection, workspaceId, options.orderBy ?? "id", queryLimit);
  const filtered = options.filter ? records.filter(options.filter) : records;
  return options.filter && options.limit && options.limit > 0 ? filtered.slice(0, options.limit) : filtered;
}

function sqliteWorkspaceRecords<K extends WorkspaceRecordCollectionKey>(
  collection: K,
  workspaceId: string,
  orderBy: WorkspaceRecordOrder,
  limit: number | undefined,
): WorkspaceRecordCollectionMap[K][] | null {
  if (process.env.TASKLOOM_STORE !== "sqlite") return null;
  const dbPath = resolve(process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE);
  const db = openStoreDatabase(dbPath);
  try {
    const values: SQLInputValue[] = [collection, workspaceId];
    const hasLimit = typeof limit === "number" && limit > 0;
    const limitSql = hasLimit ? "limit ?" : "";
    if (hasLimit) values.push(limit);
    const rows = db.prepare(`
      select payload
      from app_records
      where collection = ? and workspace_id = ?
      order by ${WORKSPACE_RECORD_ORDER_SQL[orderBy]}
      ${limitSql}
    `).all(...values) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as WorkspaceRecordCollectionMap[K]);
  } finally {
    db.close();
  }
}

function listWorkspaceRecordsFromStore<K extends WorkspaceRecordCollectionKey>(
  collection: K,
  workspaceId: string,
  orderBy: WorkspaceRecordOrder,
  limit: number | undefined,
): WorkspaceRecordCollectionMap[K][] {
  const records = (loadStore()[collection] as WorkspaceRecordCollectionMap[K][])
    .filter((entry) => entry.workspaceId === workspaceId);
  const sorted = sortWorkspaceRecords(records, orderBy);
  return limit && limit > 0 ? sorted.slice(0, limit) : sorted;
}

function sortWorkspaceRecords<TRecord>(records: TRecord[], orderBy: WorkspaceRecordOrder): TRecord[] {
  const sorted = records.slice();
  sorted.sort((left, right) => compareWorkspaceRecords(left, right, orderBy));
  return sorted;
}

function compareWorkspaceRecords<TRecord>(left: TRecord, right: TRecord, orderBy: WorkspaceRecordOrder): number {
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  if (orderBy === "createdAtAsc") return compareStrings(field(leftRecord, "createdAt"), field(rightRecord, "createdAt")) || compareStrings(field(leftRecord, "id"), field(rightRecord, "id"));
  if (orderBy === "createdAtDesc") return compareStrings(field(rightRecord, "createdAt"), field(leftRecord, "createdAt")) || compareStrings(field(rightRecord, "id"), field(leftRecord, "id"));
  if (orderBy === "updatedAtDesc") return compareStrings(field(rightRecord, "updatedAt") || field(rightRecord, "createdAt"), field(leftRecord, "updatedAt") || field(leftRecord, "createdAt")) || compareStrings(field(rightRecord, "id"), field(leftRecord, "id"));
  if (orderBy === "occurredAtDesc") return compareStrings(field(rightRecord, "occurredAt"), field(leftRecord, "occurredAt")) || compareStrings(field(rightRecord, "id"), field(leftRecord, "id"));
  if (orderBy === "scheduledAtAsc") return compareStrings(field(leftRecord, "scheduledAt"), field(rightRecord, "scheduledAt")) || compareStrings(field(leftRecord, "id"), field(rightRecord, "id"));
  if (orderBy === "completedAtDesc") return compareStrings(field(rightRecord, "completedAt"), field(leftRecord, "completedAt")) || compareStrings(field(rightRecord, "id"), field(leftRecord, "id"));
  if (orderBy === "orderAsc") return compareNumbers(numberField(leftRecord, "order"), numberField(rightRecord, "order")) || compareStrings(field(leftRecord, "id"), field(rightRecord, "id"));
  if (orderBy === "versionNumberDesc") return compareNumbers(numberField(rightRecord, "versionNumber"), numberField(leftRecord, "versionNumber")) || compareStrings(field(rightRecord, "id"), field(leftRecord, "id"));
  if (orderBy === "nameAsc") return field(leftRecord, "name").localeCompare(field(rightRecord, "name"), undefined, { sensitivity: "base" }) || compareStrings(field(leftRecord, "id"), field(rightRecord, "id"));
  if (orderBy === "keyAsc") return field(leftRecord, "key").localeCompare(field(rightRecord, "key"), undefined, { sensitivity: "base" }) || compareStrings(field(leftRecord, "id"), field(rightRecord, "id"));
  return compareStrings(field(leftRecord, "id"), field(rightRecord, "id"));
}

function field(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" ? value : 0;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function listActivitiesForWorkspaceIndexed(workspaceId: string, limit?: number): ActivityRecord[] {
  return listActivitiesForWorkspaceViaRepository(workspaceId, limit);
}

export function listJobsForWorkspaceIndexed(workspaceId: string, opts: { status?: JobStatus; limit?: number } = {}): JobRecord[] {
  return listJobsForWorkspaceViaRepository(workspaceId, opts);
}

export function listAgentsForWorkspaceIndexed(workspaceId: string, includeArchived = false): AgentRecord[] {
  return listWorkspaceRecordsIndexed("agents", workspaceId, {
    orderBy: "updatedAtDesc",
    filter: includeArchived ? undefined : (entry) => entry.status !== "archived",
  });
}

export function listProvidersForWorkspaceIndexed(workspaceId: string): ProviderRecord[] {
  return listWorkspaceRecordsIndexed("providers", workspaceId, { orderBy: "nameAsc" });
}

export function listAgentRunsForWorkspaceIndexed(workspaceId: string, limit?: number): AgentRunRecord[] {
  return listAgentRunsForWorkspaceViaRepository(workspaceId, limit);
}

export function listProviderCallsForWorkspaceIndexed(workspaceId: string, opts: { since?: string; limit?: number } = {}): ProviderCallRecord[] {
  if (process.env.TASKLOOM_STORE !== "sqlite") {
    let entries = loadStore().providerCalls.filter((entry) => entry.workspaceId === workspaceId);
    if (opts.since) {
      const cutoff = Date.parse(opts.since);
      entries = entries.filter((entry) => Date.parse(entry.completedAt) >= cutoff);
    }
    entries = entries.slice().reverse();
    return opts.limit ? entries.slice(0, opts.limit) : entries;
  }
  return listWorkspaceRecordsIndexed("providerCalls", workspaceId, {
    orderBy: "completedAtDesc",
    limit: opts.limit,
    filter: opts.since ? (entry) => Date.parse(entry.completedAt) >= Date.parse(opts.since as string) : undefined,
  });
}

export function listAgentRunsForAgentIndexed(workspaceId: string, agentId: string, limit?: number): AgentRunRecord[] {
  return listAgentRunsForAgentViaRepository(workspaceId, agentId, limit);
}

export function findUserByIdIndexed(userId: string): UserRecord | null {
  return sqliteIndexedRecord<UserRecord>("users", "app_record_search.id = ?", [userId])
    ?? loadStore().users.find((entry) => entry.id === userId) ?? null;
}

export function findUserByEmailIndexed(email: string): UserRecord | null {
  const normalized = normalizeEmail(email);
  return sqliteIndexedRecord<UserRecord>("users", "app_record_search.email = ?", [normalized])
    ?? loadStore().users.find((entry) => normalizeEmail(entry.email) === normalized) ?? null;
}

export function findSessionByIdIndexed(sessionId: string): SessionRecord | null {
  return sqliteIndexedRecord<SessionRecord>("sessions", "app_record_search.id = ?", [sessionId])
    ?? loadStore().sessions.find((entry) => entry.id === sessionId) ?? null;
}

export function findWorkspaceByIdIndexed(workspaceId: string): WorkspaceRecord | null {
  return sqliteIndexedRecord<WorkspaceRecord>("workspaces", "app_record_search.id = ?", [workspaceId])
    ?? loadStore().workspaces.find((entry) => entry.id === workspaceId) ?? null;
}

export function listSessionsForUserIndexed(userId: string): SessionRecord[] {
  return sqliteIndexedRecords<SessionRecord>("sessions", "app_record_search.user_id = ?", [userId])
    ?? loadStore().sessions.filter((entry) => entry.userId === userId);
}

export function findWorkspaceMembershipIndexed(workspaceId: string, userId: string): WorkspaceMemberRecord | null {
  return sqliteIndexedRecord<WorkspaceMemberRecord>("memberships", "app_record_search.workspace_id = ? and app_record_search.user_id = ?", [workspaceId, userId])
    ?? loadStore().memberships.find((entry) => entry.workspaceId === workspaceId && entry.userId === userId) ?? null;
}

export function listWorkspaceMembershipsIndexed(workspaceId: string): WorkspaceMemberRecord[] {
  return sqliteIndexedRecords<WorkspaceMemberRecord>("memberships", "app_record_search.workspace_id = ?", [workspaceId])
    ?? loadStore().memberships.filter((entry) => entry.workspaceId === workspaceId);
}

export function findWorkspaceInvitationByTokenIndexed(token: string): WorkspaceInvitationRecord | null {
  return sqliteIndexedRecord<WorkspaceInvitationRecord>("workspaceInvitations", "app_record_search.token = ?", [token])
    ?? loadStore().workspaceInvitations.find((entry) => entry.token === token) ?? null;
}

export function listWorkspaceInvitationsIndexed(workspaceId: string): WorkspaceInvitationRecord[] {
  return sqliteIndexedRecords<WorkspaceInvitationRecord>("workspaceInvitations", "app_record_search.workspace_id = ?", [workspaceId], "json_extract(app_records.payload, '$.createdAt') desc")
    ?? loadStore().workspaceInvitations
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listInvitationEmailDeliveriesIndexed(workspaceId: string, invitationId?: string): InvitationEmailDeliveryRecord[] {
  return listInvitationEmailDeliveriesViaRepository(workspaceId, invitationId);
}

export function findShareTokenByTokenIndexed(token: string): ShareTokenRecord | null {
  return sqliteIndexedRecord<ShareTokenRecord>("shareTokens", "app_record_search.token = ?", [token])
    ?? loadStore().shareTokens.find((entry) => entry.token === token) ?? null;
}

export function listShareTokensForWorkspaceIndexed(workspaceId: string): ShareTokenRecord[] {
  return sqliteIndexedRecords<ShareTokenRecord>("shareTokens", "app_record_search.workspace_id = ?", [workspaceId], "json_extract(app_records.payload, '$.createdAt') desc")
    ?? loadStore().shareTokens
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function findWorkspaceBriefIndexed(workspaceId: string): WorkspaceBriefRecord | null {
  return sqliteIndexedRecord<WorkspaceBriefRecord>("workspaceBriefs", "app_record_search.workspace_id = ?", [workspaceId])
    ?? workspaceBriefEntries(loadStore().workspaceBriefs).find((entry) => entry.workspaceId === workspaceId) ?? null;
}

export function listWorkspaceBriefVersionsIndexed(workspaceId: string): WorkspaceBriefVersionRecord[] {
  return sqliteIndexedRecords<WorkspaceBriefVersionRecord>("workspaceBriefVersions", "app_record_search.workspace_id = ?", [workspaceId], "json_extract(app_records.payload, '$.versionNumber') desc")
    ?? loadStore().workspaceBriefVersions
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((left, right) => right.versionNumber - left.versionNumber);
}

export function findWorkspaceBriefVersionIndexed(workspaceId: string, versionId: string): WorkspaceBriefVersionRecord | null {
  return sqliteIndexedRecord<WorkspaceBriefVersionRecord>("workspaceBriefVersions", "app_record_search.workspace_id = ? and app_record_search.id = ?", [workspaceId, versionId])
    ?? loadStore().workspaceBriefVersions.find((entry) => entry.workspaceId === workspaceId && entry.id === versionId) ?? null;
}

export function listRequirementsForWorkspaceIndexed(workspaceId: string): RequirementRecord[] {
  return sqliteIndexedRecords<RequirementRecord>("requirements", "app_record_search.workspace_id = ?", [workspaceId])
    ?? loadStore().requirements.filter((entry) => entry.workspaceId === workspaceId);
}

export function findRequirementForWorkspaceIndexed(workspaceId: string, requirementId: string): RequirementRecord | null {
  return sqliteIndexedRecord<RequirementRecord>("requirements", "app_record_search.workspace_id = ? and app_record_search.id = ?", [workspaceId, requirementId])
    ?? loadStore().requirements.find((entry) => entry.workspaceId === workspaceId && entry.id === requirementId) ?? null;
}

export function listImplementationPlanItemsForWorkspaceIndexed(workspaceId: string): ImplementationPlanItemRecord[] {
  return sqliteIndexedRecords<ImplementationPlanItemRecord>("implementationPlanItems", "app_record_search.workspace_id = ?", [workspaceId], "json_extract(app_records.payload, '$.order'), app_records.id")
    ?? loadStore().implementationPlanItems
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((left, right) => left.order - right.order);
}

export function findImplementationPlanItemForWorkspaceIndexed(workspaceId: string, planItemId: string): ImplementationPlanItemRecord | null {
  return sqliteIndexedRecord<ImplementationPlanItemRecord>("implementationPlanItems", "app_record_search.workspace_id = ? and app_record_search.id = ?", [workspaceId, planItemId])
    ?? loadStore().implementationPlanItems.find((entry) => entry.workspaceId === workspaceId && entry.id === planItemId) ?? null;
}

export function listWorkflowConcernsForWorkspaceIndexed(workspaceId: string, kind?: WorkflowConcernKind): WorkflowConcernRecord[] {
  return sqliteIndexedRecords<WorkflowConcernRecord>(
    "workflowConcerns",
    `app_record_search.workspace_id = ?${kind ? " and json_extract(app_records.payload, '$.kind') = ?" : ""}`,
    kind ? [workspaceId, kind] : [workspaceId],
  ) ?? loadStore().workflowConcerns.filter((entry) => entry.workspaceId === workspaceId && (!kind || entry.kind === kind));
}

export function findWorkflowConcernForWorkspaceIndexed(workspaceId: string, concernId: string, kind?: WorkflowConcernKind): WorkflowConcernRecord | null {
  return sqliteIndexedRecord<WorkflowConcernRecord>(
    "workflowConcerns",
    `app_record_search.workspace_id = ? and app_record_search.id = ?${kind ? " and json_extract(app_records.payload, '$.kind') = ?" : ""}`,
    kind ? [workspaceId, concernId, kind] : [workspaceId, concernId],
  ) ?? loadStore().workflowConcerns.find((entry) => entry.workspaceId === workspaceId && entry.id === concernId && (!kind || entry.kind === kind)) ?? null;
}

export function listValidationEvidenceForWorkspaceIndexed(workspaceId: string): ValidationEvidenceRecord[] {
  return sqliteIndexedRecords<ValidationEvidenceRecord>("validationEvidence", "app_record_search.workspace_id = ?", [workspaceId])
    ?? loadStore().validationEvidence.filter((entry) => entry.workspaceId === workspaceId);
}

export function findValidationEvidenceForWorkspaceIndexed(workspaceId: string, evidenceId: string): ValidationEvidenceRecord | null {
  return sqliteIndexedRecord<ValidationEvidenceRecord>("validationEvidence", "app_record_search.workspace_id = ? and app_record_search.id = ?", [workspaceId, evidenceId])
    ?? loadStore().validationEvidence.find((entry) => entry.workspaceId === workspaceId && entry.id === evidenceId) ?? null;
}

export function listReleaseConfirmationsForWorkspaceIndexed(workspaceId: string): ReleaseConfirmationRecord[] {
  return sqliteIndexedRecords<ReleaseConfirmationRecord>("releaseConfirmations", "app_record_search.workspace_id = ?", [workspaceId])
    ?? releaseConfirmationEntries(loadStore().releaseConfirmations).filter((entry) => entry.workspaceId === workspaceId);
}

export function findReleaseConfirmationForWorkspaceIndexed(workspaceId: string, releaseId: string): ReleaseConfirmationRecord | null {
  return sqliteIndexedRecord<ReleaseConfirmationRecord>("releaseConfirmations", "app_record_search.workspace_id = ? and (json_extract(app_records.payload, '$.id') = ? or app_record_search.workspace_id = ?)", [workspaceId, releaseId, releaseId])
    ?? releaseConfirmationEntries(loadStore().releaseConfirmations).find((entry) => entry.workspaceId === workspaceId && (entry.id === releaseId || entry.workspaceId === releaseId)) ?? null;
}

export function findAgentForWorkspaceIndexed(workspaceId: string, agentId: string): AgentRecord | null {
  return sqliteIndexedRecord<AgentRecord>("agents", "app_record_search.workspace_id = ? and app_record_search.id = ?", [workspaceId, agentId])
    ?? loadStore().agents.find((entry) => entry.workspaceId === workspaceId && entry.id === agentId) ?? null;
}

export function findAgentRunForWorkspaceIndexed(workspaceId: string, runId: string): AgentRunRecord | null {
  return findAgentRunForWorkspaceViaRepository(workspaceId, runId);
}

export function findJobIndexed(jobId: string): JobRecord | null {
  return findJobViaRepository(jobId);
}

function recordsForCollection(data: TaskloomData, collection: (typeof RECORD_COLLECTIONS)[number]): unknown[] {
  if (collection === "workspaceBriefs") return workspaceBriefEntries(data.workspaceBriefs);
  if (collection === "releaseConfirmations") return releaseConfirmationEntries(data.releaseConfirmations);
  return data[collection] as unknown[];
}

function loadSqliteRateLimitBuckets(db: DatabaseSync): RateLimitRecord[] {
  const rows = db.prepare("select id, count, reset_at, updated_at from rate_limit_buckets order by id").all() as unknown as SqliteRateLimitRow[];
  return rows.map((row) => ({
    id: row.id,
    count: row.count,
    resetAt: row.reset_at,
    updatedAt: row.updated_at,
  }));
}

function persistSqliteRateLimitBuckets(db: DatabaseSync, rateLimits: RateLimitRecord[]): void {
  db.exec("delete from rate_limit_buckets");
  const insert = db.prepare(`
    insert into rate_limit_buckets (id, count, reset_at, updated_at)
    values (?, ?, ?, ?)
  `);
  for (const bucket of rateLimits) {
    insert.run(bucket.id, bucket.count, bucket.resetAt, bucket.updatedAt);
  }
}

function recordId(collection: StoreCollectionKey, payload: unknown): string {
  const record = payload as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  if (collection === "memberships") return `${record.workspaceId}:${record.userId}`;
  if (collection === "workspaceBriefs" || collection === "onboardingStates" || collection === "releaseConfirmations") {
    return String(record.workspaceId);
  }
  return JSON.stringify(record);
}

function workspaceIdForRecord(payload: unknown): SQLInputValue {
  const workspaceId = (payload as Record<string, unknown>).workspaceId;
  return typeof workspaceId === "string" ? workspaceId : null;
}

function updatedAtForRecord(payload: unknown): SQLInputValue {
  const record = payload as Record<string, unknown>;
  return typeof record.updatedAt === "string" ? record.updatedAt : typeof record.createdAt === "string" ? record.createdAt : null;
}

export function normalizeStore(data: Partial<TaskloomData>): TaskloomData {
  return {
    users: data.users ?? [],
    sessions: data.sessions ?? [],
    rateLimits: data.rateLimits ?? [],
    workspaces: data.workspaces ?? [],
    memberships: data.memberships ?? [],
    workspaceInvitations: data.workspaceInvitations ?? [],
    invitationEmailDeliveries: data.invitationEmailDeliveries ?? [],
    workspaceBriefs: normalizeWorkspaceBriefCollection(data.workspaceBriefs),
    workspaceBriefVersions: data.workspaceBriefVersions ?? [],
    requirements: data.requirements ?? [],
    implementationPlanItems: data.implementationPlanItems ?? [],
    workflowConcerns: data.workflowConcerns ?? [],
    validationEvidence: data.validationEvidence ?? [],
    releaseConfirmations: normalizeReleaseConfirmationCollection(data.releaseConfirmations),
    onboardingStates: data.onboardingStates ?? [],
    activities: data.activities ?? [],
    activationSignals: (data.activationSignals ?? []).map(normalizeActivationSignalRecord),
    agents: (data.agents ?? []).map((entry) => ({
      ...entry,
      inputSchema: Array.isArray(entry.inputSchema) ? entry.inputSchema : [],
    })),
    providers: data.providers ?? [],
    agentRuns: (data.agentRuns ?? []).map((entry) => ({
      ...entry,
      logs: Array.isArray(entry.logs) ? entry.logs : [],
    })),
    workspaceEnvVars: data.workspaceEnvVars ?? [],
    apiKeys: data.apiKeys ?? [],
    providerCalls: data.providerCalls ?? [],
    jobs: data.jobs ?? [],
    jobMetricSnapshots: data.jobMetricSnapshots ?? [],
    alertEvents: data.alertEvents ?? [],
    shareTokens: data.shareTokens ?? [],
    activationFacts: data.activationFacts ?? {},
    activationMilestones: data.activationMilestones ?? {},
    activationReadModels: data.activationReadModels ?? {},
  };
}

function normalizeWorkspaceBriefCollection(collection: Partial<TaskloomData>["workspaceBriefs"]): WorkspaceBriefCollection {
  if (!collection) return {};
  if (!Array.isArray(collection)) return collection;
  return Object.fromEntries(collection.map((entry) => [entry.workspaceId, entry]));
}

function normalizeReleaseConfirmationCollection(
  collection: Partial<TaskloomData>["releaseConfirmations"],
): ReleaseConfirmationCollection {
  if (!collection) return {};
  if (!Array.isArray(collection)) return collection;
  return Object.fromEntries(collection.map((entry) => [entry.workspaceId, entry]));
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

  const workspaceBriefs: WorkspaceBriefCollection = {
    alpha: {
      workspaceId: "alpha",
      summary: "Capture a concise onboarding brief and move the workspace into validation.",
      goals: ["Capture validation evidence", "Track remaining launch question"],
      audience: "Implementation lead and customer success manager",
      constraints: "First release should avoid optional reporting scope until it is confirmed.",
      problemStatement: "The implementation scope is understood, but release readiness still needs durable validation evidence.",
      targetCustomers: ["Implementation lead", "Customer success manager"],
      desiredOutcome: "A ready-to-review workspace with one remaining question tracked.",
      successMetrics: ["Validation checklist has passing evidence", "Open questions have owners"],
      updatedByUserId: "user_alpha",
      createdAt: isoDaysAgo(9),
      updatedAt: isoDaysAgo(2),
    },
    beta: {
      workspaceId: "beta",
      summary: "Recover a blocked implementation by clarifying dependencies and ownership.",
      goals: ["Resolve dependency ownership", "Clarify retry scope"],
      audience: "Operations owner and technical lead",
      constraints: "Implementation restart is blocked until the dependency owner is confirmed.",
      problemStatement: "Dependency gaps and unanswered scope questions are preventing forward progress.",
      targetCustomers: ["Operations owner", "Technical lead"],
      desiredOutcome: "Critical blockers are visible and the implementation plan can restart.",
      successMetrics: ["Dependency blocker is resolved", "Critical issue has an owner", "Retry plan is documented"],
      updatedByUserId: "user_beta",
      createdAt: isoDaysAgo(14),
      updatedAt: isoDaysAgo(4),
    },
    gamma: {
      workspaceId: "gamma",
      summary: "Maintain a complete release workflow from requirements through confirmation.",
      goals: ["Preserve release evidence", "Keep confirmation auditable"],
      audience: "Product manager and release owner",
      constraints: "Release records must stay linked to validation evidence.",
      problemStatement: "The workflow is complete and needs a durable audit trail for release confidence.",
      targetCustomers: ["Product manager", "Release owner"],
      desiredOutcome: "Release confirmation remains tied to validation evidence and requirements.",
      successMetrics: ["Release confirmation is recorded", "Validation evidence is linked to the plan"],
      updatedByUserId: "user_gamma",
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(7),
    },
  };

  const requirements: RequirementRecord[] = [
    {
      id: "req_alpha_validation",
      workspaceId: "alpha",
      title: "Capture validation evidence before release",
      detail: "Record proof that the implemented workflow meets the activation checklist.",
      priority: "must",
      status: "approved",
      acceptanceCriteria: ["Evidence includes outcome, owner, and linked plan item", "Failed checks create follow-up work"],
      source: "brief",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(8),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "req_alpha_questions",
      workspaceId: "alpha",
      title: "Track remaining launch questions",
      detail: "Keep unanswered launch questions visible until they are resolved or deferred.",
      priority: "should",
      status: "approved",
      acceptanceCriteria: ["Each question has status and owner", "Resolved questions keep their resolution note"],
      source: "team",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(7),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: "req_beta_dependencies",
      workspaceId: "beta",
      title: "Unblock dependency decisions",
      detail: "Identify dependency blockers and critical scope decisions before restarting implementation.",
      priority: "must",
      status: "changed",
      acceptanceCriteria: ["Critical blockers are marked high or critical", "Dependency owner is assigned"],
      source: "customer",
      createdByUserId: "user_beta",
      createdAt: isoDaysAgo(12),
      updatedAt: isoDaysAgo(5),
    },
    {
      id: "req_gamma_release_audit",
      workspaceId: "gamma",
      title: "Preserve release audit trail",
      detail: "Tie release confirmation to validation evidence and notes for later review.",
      priority: "must",
      status: "done",
      acceptanceCriteria: ["Release version is recorded", "Confirmation references validation evidence"],
      source: "brief",
      createdByUserId: "user_gamma",
      createdAt: isoDaysAgo(28),
      updatedAt: isoDaysAgo(7),
    },
  ];

  const implementationPlanItems: ImplementationPlanItemRecord[] = [
    {
      id: "plan_alpha_validation",
      workspaceId: "alpha",
      requirementIds: ["req_alpha_validation"],
      title: "Collect validation proof",
      description: "Attach the passing test run and manual review notes to the workspace.",
      status: "in_progress",
      ownerUserId: "user_alpha",
      order: 1,
      startedAt: isoDaysAgo(4),
      createdAt: isoDaysAgo(7),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "plan_alpha_questions",
      workspaceId: "alpha",
      requirementIds: ["req_alpha_questions"],
      title: "Resolve launch question",
      description: "Confirm whether the first release needs the optional reporting view.",
      status: "todo",
      ownerUserId: "user_alpha",
      order: 2,
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: "plan_beta_restart",
      workspaceId: "beta",
      requirementIds: ["req_beta_dependencies"],
      title: "Restart implementation after dependency review",
      description: "Document dependency ownership, then move the implementation back to active work.",
      status: "blocked",
      ownerUserId: "user_beta",
      order: 1,
      startedAt: isoDaysAgo(6),
      createdAt: isoDaysAgo(10),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "plan_gamma_release",
      workspaceId: "gamma",
      requirementIds: ["req_gamma_release_audit"],
      title: "Confirm release package",
      description: "Verify evidence links and record release confirmation.",
      status: "done",
      ownerUserId: "user_gamma",
      order: 1,
      startedAt: isoDaysAgo(24),
      completedAt: isoDaysAgo(7),
      createdAt: isoDaysAgo(28),
      updatedAt: isoDaysAgo(7),
    },
  ];

  const workflowConcerns: WorkflowConcernRecord[] = [
    {
      id: "question_alpha_reporting",
      workspaceId: "alpha",
      kind: "open_question",
      title: "Is reporting required for the first release?",
      description: "Confirm whether reporting should ship now or remain a post-release follow-up.",
      status: "open",
      severity: "medium",
      relatedRequirementId: "req_alpha_questions",
      relatedPlanItemId: "plan_alpha_questions",
      ownerUserId: "user_alpha",
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "blocker_beta_dependency",
      workspaceId: "beta",
      kind: "blocker",
      title: "Customer dependency owner is unconfirmed",
      description: "Implementation cannot restart until the external dependency owner is named.",
      status: "open",
      severity: "critical",
      relatedRequirementId: "req_beta_dependencies",
      relatedPlanItemId: "plan_beta_restart",
      ownerUserId: "user_beta",
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "question_beta_scope",
      workspaceId: "beta",
      kind: "open_question",
      title: "Should the retry include the expanded scope?",
      description: "Decide whether the scope change is included in the next implementation retry.",
      status: "open",
      severity: "high",
      relatedRequirementId: "req_beta_dependencies",
      ownerUserId: "user_beta",
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "blocker_gamma_none",
      workspaceId: "gamma",
      kind: "blocker",
      title: "Release audit review completed",
      description: "Historical blocker closed after release evidence was attached.",
      status: "resolved",
      severity: "low",
      relatedRequirementId: "req_gamma_release_audit",
      relatedPlanItemId: "plan_gamma_release",
      ownerUserId: "user_gamma",
      resolvedAt: isoDaysAgo(10),
      resolutionNote: "Evidence and release notes were linked before confirmation.",
      createdAt: isoDaysAgo(18),
      updatedAt: isoDaysAgo(10),
    },
  ];

  const validationEvidence: ValidationEvidenceRecord[] = [
    {
      id: "evidence_alpha_tests",
      workspaceId: "alpha",
      planItemId: "plan_alpha_validation",
      requirementIds: ["req_alpha_validation"],
      type: "automated_test",
      title: "Activation validation checks passed",
      detail: "Latest validation run passed with no critical issues.",
      status: "passed",
      source: "local validation run",
      capturedByUserId: "user_alpha",
      capturedAt: isoDaysAgo(1),
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "evidence_beta_failed_retry",
      workspaceId: "beta",
      planItemId: "plan_beta_restart",
      requirementIds: ["req_beta_dependencies"],
      type: "manual_check",
      title: "Dependency review failed",
      detail: "Manual review found that the dependency owner is still missing.",
      status: "failed",
      source: "dependency review",
      capturedByUserId: "user_beta",
      capturedAt: isoDaysAgo(3),
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(3),
    },
    {
      id: "evidence_gamma_release_demo",
      workspaceId: "gamma",
      planItemId: "plan_gamma_release",
      requirementIds: ["req_gamma_release_audit"],
      type: "demo",
      title: "Release workflow demo accepted",
      detail: "Release owner accepted the final workflow demo.",
      status: "passed",
      source: "release demo",
      capturedByUserId: "user_gamma",
      capturedAt: isoDaysAgo(10),
      createdAt: isoDaysAgo(10),
      updatedAt: isoDaysAgo(10),
    },
  ];

  const providers: ProviderRecord[] = [
    createProvider("provider_alpha_openai", "alpha", "OpenAI", "openai", "gpt-4.1-mini", true, createdAt),
    createProvider("provider_beta_anthropic", "beta", "Anthropic", "anthropic", "claude-3-5-sonnet-latest", false, createdAt),
    createProvider("provider_gamma_ollama", "gamma", "Local Ollama", "ollama", "llama3.1", true, createdAt, "http://localhost:11434"),
  ];

  const agents: AgentRecord[] = [
    createAgent({
      id: "agent_alpha_support",
      workspaceId: "alpha",
      createdByUserId: "user_alpha",
      name: "Support inbox triage",
      description: "Classifies new support emails, drafts replies, and flags urgent requests.",
      instructions: "Watch the support inbox. Classify urgency, draft a concise reply, and alert the owner when severity is high.",
      providerId: "provider_alpha_openai",
      model: "gpt-4.1-mini",
      tools: ["gmail", "email_drafts", "notifications"],
      schedule: "*/15 * * * *",
      triggerKind: "schedule",
      status: "active",
      templateId: "support_triage",
      inputSchema: [
        { key: "mailbox", label: "Mailbox label", type: "string", required: true, description: "Inbox or label to scan." },
        { key: "urgency_threshold", label: "Urgency threshold", type: "enum", required: true, options: ["low", "medium", "high"], defaultValue: "medium" },
      ],
      timestamp: createdAt,
      playbook: [
        { id: "step_alpha_support_1", title: "Read new inbox messages", instruction: "Pull unread support emails from the inbox tool." },
        { id: "step_alpha_support_2", title: "Classify urgency", instruction: "Score each message as low / medium / high based on subject + body keywords." },
        { id: "step_alpha_support_3", title: "Draft reply", instruction: "Compose a concise reply for each non-urgent message." },
        { id: "step_alpha_support_4", title: "Escalate critical", instruction: "If severity is high, post to #ops and assign the on-call owner." },
      ],
    }),
    createAgent({
      id: "agent_alpha_daily_brief",
      workspaceId: "alpha",
      createdByUserId: "user_alpha",
      name: "Daily workspace brief",
      description: "Summarizes open work, recent runs, blockers, and questions every weekday morning.",
      instructions: "Generate a compact morning brief from recent activity, open questions, blockers, and validation state.",
      providerId: "provider_alpha_openai",
      model: "gpt-4.1-mini",
      tools: ["activity", "workflow", "email"],
      schedule: "0 8 * * 1-5",
      triggerKind: "schedule",
      status: "active",
      templateId: "daily_brief",
      inputSchema: [
        { key: "lookback_hours", label: "Lookback (hours)", type: "number", required: true, defaultValue: "24" },
        { key: "include_runs", label: "Include agent runs", type: "boolean", required: false, defaultValue: "true" },
      ],
      timestamp: createdAt,
      playbook: [
        { id: "step_alpha_brief_1", title: "Pull yesterday's activity", instruction: "Fetch activity events from the last 24 hours." },
        { id: "step_alpha_brief_2", title: "Summarize open work", instruction: "Group blockers, open questions, and in-progress plan items." },
        { id: "step_alpha_brief_3", title: "Send brief", instruction: "Email the morning brief to the workspace owners list." },
      ],
    }),
    createAgent({
      id: "agent_beta_dependency_watch",
      workspaceId: "beta",
      createdByUserId: "user_beta",
      name: "Dependency watcher",
      description: "Monitors unresolved implementation dependencies and prepares escalation notes.",
      instructions: "Track critical blockers and summarize what is needed to restart implementation.",
      providerId: "provider_beta_anthropic",
      model: "claude-3-5-sonnet-latest",
      tools: ["workflow", "activity"],
      schedule: "0 9 * * 1-5",
      triggerKind: "schedule",
      status: "paused",
      inputSchema: [],
      timestamp: createdAt,
      playbook: [
        { id: "step_beta_dep_1", title: "List critical blockers", instruction: "Enumerate blockers with severity high or critical." },
        { id: "step_beta_dep_2", title: "Draft escalation notes", instruction: "Write a brief note per blocker with owner and required action." },
      ],
    }),
    createAgent({
      id: "agent_gamma_release_audit",
      workspaceId: "gamma",
      createdByUserId: "user_gamma",
      name: "Release audit",
      description: "Checks release evidence and prepares a confirmation summary.",
      instructions: "Review validation evidence, release confirmation, and open questions before release.",
      providerId: "provider_gamma_ollama",
      model: "llama3.1",
      tools: ["validation", "release_notes"],
      schedule: "On demand",
      triggerKind: "manual",
      status: "active",
      templateId: "release_audit",
      inputSchema: [
        { key: "release_label", label: "Release label", type: "string", required: true, description: "Version label being audited." },
        { key: "evidence_url", label: "Evidence URL", type: "url", required: false },
      ],
      timestamp: createdAt,
      playbook: [
        { id: "step_gamma_audit_1", title: "Verify validation evidence", instruction: "Confirm every passed evidence has a source and capturer." },
        { id: "step_gamma_audit_2", title: "Check open questions", instruction: "Confirm no open question is tagged release-blocking." },
        { id: "step_gamma_audit_3", title: "Compose release summary", instruction: "Produce a concise audit summary for the release confirmation." },
      ],
    }),
  ];

  const workspaceEnvVars: WorkspaceEnvVarRecord[] = [
    {
      id: "env_alpha_api_base",
      workspaceId: "alpha",
      key: "ALPHA_API_BASE",
      value: "https://api.alpha.example.com",
      scope: "all",
      secret: false,
      description: "Base URL for the Alpha workspace integration.",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(8),
      updatedAt: isoDaysAgo(8),
    },
    {
      id: "env_alpha_signing_secret",
      workspaceId: "alpha",
      key: "ALPHA_SIGNING_SECRET",
      value: "alpha_demo_signing_secret",
      scope: "runtime",
      secret: true,
      description: "Webhook signing secret used by runtime handlers.",
      createdByUserId: "user_alpha",
      createdAt: isoDaysAgo(6),
      updatedAt: isoDaysAgo(6),
    },
    {
      id: "env_beta_feature_flag",
      workspaceId: "beta",
      key: "BETA_FEATURE_RETRY",
      value: "false",
      scope: "build",
      secret: false,
      description: "Toggle to enable retry experiments during builds.",
      createdByUserId: "user_beta",
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(2),
    },
  ];

  const agentRuns: AgentRunRecord[] = [
    createAgentRun({
      id: "run_alpha_support_latest",
      workspaceId: "alpha",
      agentId: "agent_alpha_support",
      title: "Support inbox scanned",
      status: "success",
      timestamp: isoDaysAgo(0),
      triggerKind: "schedule",
      inputs: { mailbox: "support@alpha.example.com", urgency_threshold: "medium" },
      output: "Scanned 18 messages. Drafted 4 replies. Flagged 1 high-severity request.",
      transcript: [
        { id: "rs_alpha_support_1", title: "Read new inbox messages", status: "success", output: "Pulled 4 unread messages.", durationMs: 380, startedAt: isoDaysAgo(0) },
        { id: "rs_alpha_support_2", title: "Classify urgency", status: "success", output: "3 low, 1 high.", durationMs: 720, startedAt: isoDaysAgo(0) },
        { id: "rs_alpha_support_3", title: "Draft reply", status: "success", output: "Drafted 3 replies for review.", durationMs: 980, startedAt: isoDaysAgo(0) },
        { id: "rs_alpha_support_4", title: "Escalate critical", status: "success", output: "Escalated 1 high-severity message to on-call.", durationMs: 410, startedAt: isoDaysAgo(0) },
      ],
      logs: [
        { at: isoDaysAgo(0), level: "info", message: "Connected to support inbox." },
        { at: isoDaysAgo(0), level: "info", message: "Classified 18 new threads." },
        { at: isoDaysAgo(0), level: "info", message: "Drafted 4 replies." },
      ],
    }),
    createAgentRun({
      id: "run_alpha_brief_latest",
      workspaceId: "alpha",
      agentId: "agent_alpha_daily_brief",
      title: "Daily workspace brief generated",
      status: "success",
      timestamp: isoDaysAgo(1),
      triggerKind: "schedule",
      inputs: { lookback_hours: 24, include_runs: true },
      output: "Brief delivered. 3 open items, 1 question, no failed validations.",
      transcript: [
        { id: "rs_alpha_brief_1", title: "Pull yesterday's activity", status: "success", output: "Fetched 12 events.", durationMs: 230, startedAt: isoDaysAgo(1) },
        { id: "rs_alpha_brief_2", title: "Summarize open work", status: "success", output: "1 blocker, 2 questions, 4 in-progress items.", durationMs: 540, startedAt: isoDaysAgo(1) },
        { id: "rs_alpha_brief_3", title: "Send brief", status: "success", output: "Brief delivered to 3 recipients.", durationMs: 310, startedAt: isoDaysAgo(1) },
      ],
      logs: [
        { at: isoDaysAgo(1), level: "info", message: "Pulled 24h of activity." },
        { at: isoDaysAgo(1), level: "info", message: "Composed morning brief." },
      ],
    }),
    createAgentRun({
      id: "run_beta_dependency_latest",
      workspaceId: "beta",
      agentId: "agent_beta_dependency_watch",
      title: "Dependency escalation skipped while provider key is missing",
      status: "failed",
      timestamp: isoDaysAgo(2),
      triggerKind: "schedule",
      error: "Provider API key is not configured.",
      transcript: [
        { id: "rs_beta_dep_1", title: "List critical blockers", status: "failed", output: "Provider API key is not configured.", durationMs: 60, startedAt: isoDaysAgo(2) },
        { id: "rs_beta_dep_2", title: "Draft escalation notes", status: "skipped", output: "Skipped because the previous step failed.", durationMs: 0, startedAt: isoDaysAgo(2) },
      ],
      logs: [
        { at: isoDaysAgo(2), level: "warn", message: "Provider connection check failed." },
        { at: isoDaysAgo(2), level: "error", message: "Provider API key is not configured." },
      ],
    }),
    createAgentRun({
      id: "run_gamma_release_latest",
      workspaceId: "gamma",
      agentId: "agent_gamma_release_audit",
      title: "Release audit completed",
      status: "success",
      timestamp: isoDaysAgo(7),
      triggerKind: "manual",
      inputs: { release_label: "gamma-1.0" },
      output: "Audit passed. Validation evidence linked, confirmation recorded.",
      transcript: [
        { id: "rs_gamma_audit_1", title: "Verify validation evidence", status: "success", output: "All passed evidence has source + capturer.", durationMs: 450, startedAt: isoDaysAgo(7) },
        { id: "rs_gamma_audit_2", title: "Check open questions", status: "success", output: "0 release-blocking questions open.", durationMs: 220, startedAt: isoDaysAgo(7) },
        { id: "rs_gamma_audit_3", title: "Compose release summary", status: "success", output: "Summary written to release confirmation.", durationMs: 690, startedAt: isoDaysAgo(7) },
      ],
      logs: [
        { at: isoDaysAgo(7), level: "info", message: "Loaded release confirmation." },
        { at: isoDaysAgo(7), level: "info", message: "Validation evidence verified." },
      ],
    }),
  ];

  const jobs: JobRecord[] = [
    {
      id: "job_alpha_support_schedule",
      workspaceId: "alpha",
      type: "agent.run",
      payload: {
        agentId: "agent_alpha_support",
        triggerKind: "schedule",
        inputs: { mailbox: "support@alpha.example.com", urgency_threshold: "medium" },
      },
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: isoDaysAgo(-1),
      cron: "*/15 * * * *",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "job_alpha_daily_brief_schedule",
      workspaceId: "alpha",
      type: "agent.run",
      payload: {
        agentId: "agent_alpha_daily_brief",
        triggerKind: "schedule",
        inputs: { lookback_hours: 24, include_runs: true },
      },
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: isoDaysAgo(-1),
      cron: "0 8 * * 1-5",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const releaseConfirmations: ReleaseConfirmationCollection = {
    alpha: {
      id: "release_alpha_pending",
      workspaceId: "alpha",
      confirmed: false,
      summary: "Waiting for the remaining launch question before confirmation.",
      confirmedBy: "",
      versionLabel: "alpha-validation",
      status: "pending",
      releaseNotes: "Waiting for the remaining launch question before confirmation.",
      validationEvidenceIds: ["evidence_alpha_tests"],
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
    },
    beta: {
      id: "release_beta_blocked",
      workspaceId: "beta",
      confirmed: false,
      summary: "Release remains pending until dependency ownership is resolved.",
      confirmedBy: "",
      versionLabel: "beta-retry",
      status: "pending",
      releaseNotes: "Release remains pending until dependency ownership is resolved.",
      validationEvidenceIds: ["evidence_beta_failed_retry"],
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(2),
    },
    gamma: {
      id: "release_gamma_confirmed",
      workspaceId: "gamma",
      confirmed: true,
      summary: "Initial release confirmed with linked validation evidence.",
      confirmedBy: "Gamma Owner",
      versionLabel: "gamma-1.0",
      status: "confirmed",
      confirmedByUserId: "user_gamma",
      confirmedAt: isoDaysAgo(7),
      releaseNotes: "Initial release confirmed with linked validation evidence.",
      validationEvidenceIds: ["evidence_gamma_release_demo"],
      createdAt: isoDaysAgo(8),
      updatedAt: isoDaysAgo(7),
    },
  };

  const activationSignals: ActivationSignalRecord[] = [
    createActivationSignal("activation_signal_alpha_retry_1", "alpha", "retry", isoDaysAgo(1), "run_alpha_support_latest"),
    createActivationSignal("activation_signal_alpha_scope_1", "alpha", "scope_change", isoDaysAgo(3), "question_alpha_reporting"),
    createActivationSignal("activation_signal_beta_retry_1", "beta", "retry", isoDaysAgo(2), "run_beta_dependency_latest"),
    createActivationSignal("activation_signal_beta_retry_2", "beta", "retry", isoDaysAgo(1)),
    createActivationSignal("activation_signal_beta_scope_1", "beta", "scope_change", isoDaysAgo(3), "question_beta_scope"),
    createActivationSignal("activation_signal_beta_scope_2", "beta", "scope_change", isoDaysAgo(2)),
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
    rateLimits: [],
    workspaces,
    memberships,
    workspaceInvitations: [],
    invitationEmailDeliveries: [],
    workspaceBriefs,
    workspaceBriefVersions: [],
    requirements,
    implementationPlanItems,
    workflowConcerns,
    validationEvidence,
    releaseConfirmations,
    onboardingStates: [
      createOnboardingState("alpha", ["create_workspace_profile", "define_requirements", "define_plan", "start_implementation"], "validate", createdAt),
      createOnboardingState("beta", ["create_workspace_profile", "define_requirements", "define_plan"], "start_implementation", createdAt),
      createOnboardingState("gamma", ["create_workspace_profile", "define_requirements", "define_plan", "start_implementation", "validate", "confirm_release"], "confirm_release", createdAt, true),
    ],
    activities: [
      createActivity("alpha", "account", "account.created", { type: "system", id: "seed" }, { title: "Workspace initialized" }, createdAt),
      createActivity("beta", "account", "account.created", { type: "system", id: "seed" }, { title: "Workspace initialized" }, createdAt),
      createActivity("gamma", "account", "account.created", { type: "system", id: "seed" }, { title: "Workspace initialized" }, createdAt),
    ],
    activationSignals,
    agents,
    providers,
    agentRuns,
    workspaceEnvVars,
    apiKeys: [],
    providerCalls: [],
    jobs,
    jobMetricSnapshots: [],
    alertEvents: [],
    shareTokens: [],
    activationFacts,
    activationMilestones: {},
    activationReadModels: {},
  };
}

export function createSeedStore(): TaskloomData {
  return seedStore();
}

export function resetLocalStore(): TaskloomData {
  const backend = currentStoreBackend();
  cache = backend.reset();
  cacheBackendKey = backend.key;
  return cache;
}

export function resetStoreForTests(): TaskloomData {
  return resetLocalStore();
}

export function clearStoreCacheForTests(): void {
  clearStoreCache();
}

export interface RateLimitUpsertInput {
  bucketId: string;
  maxAttempts: number;
  windowMs: number;
  timestamp: number;
  maxBuckets: number;
}

export function upsertRateLimit(data: TaskloomData, input: RateLimitUpsertInput): number | null {
  const updatedAt = new Date(input.timestamp).toISOString();
  const resetAtTimestamp = input.timestamp + input.windowMs;
  data.rateLimits = (data.rateLimits ?? []).filter((entry) => new Date(entry.resetAt).getTime() > input.timestamp);

  const bucket = data.rateLimits.find((entry) => entry.id === input.bucketId);
  if (!bucket) {
    data.rateLimits.push({
      id: input.bucketId,
      count: 1,
      resetAt: new Date(resetAtTimestamp).toISOString(),
      updatedAt,
    });
    pruneRateLimitBuckets(data, input.maxBuckets);
    return null;
  }

  bucket.count += 1;
  bucket.updatedAt = updatedAt;
  pruneRateLimitBuckets(data, input.maxBuckets);
  return bucket.count > input.maxAttempts ? new Date(bucket.resetAt).getTime() : null;
}

export interface RateLimitRepository {
  upsert(input: RateLimitUpsertInput): number | null;
}

export function rateLimitRepository(): RateLimitRepository {
  if (process.env.TASKLOOM_STORE === "sqlite") return sqliteRateLimitRepository(resolve(process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE));
  return jsonRateLimitRepository();
}

function jsonRateLimitRepository(): RateLimitRepository {
  return {
    upsert(input) {
      return mutateStore((data) => upsertRateLimit(data, input));
    },
  };
}

function sqliteRateLimitRepository(dbPath: string): RateLimitRepository {
  return {
    upsert(input) {
      const db = openStoreDatabase(dbPath);
      const updatedAt = new Date(input.timestamp).toISOString();
      const resetAt = new Date(input.timestamp + input.windowMs).toISOString();
      try {
        db.exec("begin immediate");
        try {
          const appRecords = db.prepare("select count(*) as count from app_records").get() as { count: number };
          if (appRecords.count === 0) persistSqliteStoreRows(db, seedStore());
          db.prepare("delete from rate_limit_buckets where reset_at <= ?").run(updatedAt);
          const bucket = db.prepare("select count, reset_at from rate_limit_buckets where id = ?").get(input.bucketId) as { count: number; reset_at: string } | undefined;
          const count = bucket ? bucket.count + 1 : 1;
          db.prepare(`
            insert into rate_limit_buckets (id, count, reset_at, updated_at)
            values (?, ?, ?, ?)
            on conflict(id) do update set
              count = excluded.count,
              reset_at = excluded.reset_at,
              updated_at = excluded.updated_at
          `).run(input.bucketId, count, bucket?.reset_at ?? resetAt, updatedAt);
          db.prepare(`
            delete from rate_limit_buckets
            where id not in (
              select id from rate_limit_buckets order by updated_at desc limit ?
            )
          `).run(Math.max(1, Math.floor(input.maxBuckets)));
          db.exec("commit");
          clearStoreCache();
          return count > input.maxAttempts ? new Date(bucket?.reset_at ?? resetAt).getTime() : null;
        } catch (error) {
          db.exec("rollback");
          throw error;
        }
      } finally {
        db.close();
      }
    },
  };
}

function pruneRateLimitBuckets(data: TaskloomData, maxBuckets: number) {
  const limit = Math.max(1, Math.floor(maxBuckets));
  if (!data.rateLimits || data.rateLimits.length <= limit) return;
  data.rateLimits = [...data.rateLimits]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, limit);
}

function clearStoreCache(): void {
  cache = null;
  cacheBackendKey = null;
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

function createProvider(
  id: string,
  workspaceId: string,
  name: string,
  kind: ProviderKind,
  defaultModel: string,
  apiKeyConfigured: boolean,
  timestamp: string,
  baseUrl?: string,
): ProviderRecord {
  return {
    id,
    workspaceId,
    name,
    kind,
    defaultModel,
    baseUrl,
    apiKeyConfigured,
    status: apiKeyConfigured ? "connected" : "missing_key",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createAgent(input: {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  description: string;
  instructions: string;
  providerId?: string;
  model?: string;
  tools: string[];
  schedule?: string;
  triggerKind?: AgentTriggerKind;
  playbook?: AgentPlaybookStep[];
  status: AgentStatus;
  templateId?: string;
  inputSchema?: AgentInputField[];
  timestamp: string;
}): AgentRecord {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    providerId: input.providerId,
    model: input.model,
    tools: input.tools,
    schedule: input.schedule,
    triggerKind: input.triggerKind,
    playbook: input.playbook,
    status: input.status,
    templateId: input.templateId,
    inputSchema: input.inputSchema ?? [],
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
}

function createAgentRun(input: {
  id: string;
  workspaceId: string;
  agentId: string;
  title: string;
  status: AgentRunStatus;
  timestamp: string;
  triggerKind?: AgentTriggerKind;
  transcript?: AgentRunStep[];
  inputs?: Record<string, string | number | boolean>;
  output?: string;
  error?: string;
  logs?: AgentRunLogEntry[];
}): AgentRunRecord {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    title: input.title,
    status: input.status,
    triggerKind: input.triggerKind,
    transcript: input.transcript,
    startedAt: input.timestamp,
    completedAt: input.status === "queued" || input.status === "running" ? undefined : input.timestamp,
    inputs: input.inputs,
    output: input.output,
    error: input.error,
    logs: input.logs ?? [],
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function defaultWorkspaceIdForUser(data: TaskloomData, userId: string): string | null {
  return data.memberships.find((entry) => entry.userId === userId)?.workspaceId ?? null;
}

export function findWorkspaceMembership(data: TaskloomData, workspaceId: string, userId: string): WorkspaceMemberRecord | null {
  return data.memberships.find((entry) => entry.workspaceId === workspaceId && entry.userId === userId) ?? null;
}

export function upsertWorkspaceMembership(data: TaskloomData, input: WorkspaceMemberRecord): WorkspaceMemberRecord {
  const existing = findWorkspaceMembership(data, input.workspaceId, input.userId);
  if (existing) {
    existing.role = input.role;
    existing.joinedAt = input.joinedAt;
    return existing;
  }

  data.memberships.push(input);
  return input;
}

function createActivationSignal(
  id: string,
  workspaceId: string,
  kind: ActivationSignalRecord["kind"],
  timestamp: string,
  sourceId?: string,
): ActivationSignalRecord {
  return {
    id,
    workspaceId,
    kind,
    source: "seed",
    origin: "system_observed",
    sourceId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function listWorkspaceInvitations(data: TaskloomData, workspaceId: string): WorkspaceInvitationRecord[] {
  return data.workspaceInvitations
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function findWorkspaceInvitationByToken(data: TaskloomData, token: string): WorkspaceInvitationRecord | null {
  return data.workspaceInvitations.find((entry) => entry.token === token) ?? null;
}

export function upsertWorkspaceInvitation(
  data: TaskloomData,
  input: WorkspaceInvitationRecord,
): WorkspaceInvitationRecord {
  const existing = data.workspaceInvitations.find((entry) => entry.id === input.id);
  if (existing) {
    Object.assign(existing, input);
    return existing;
  }

  data.workspaceInvitations.push(input);
  return input;
}

export type CreateInvitationEmailDeliveryInput = Omit<InvitationEmailDeliveryRecord, "id" | "createdAt" | "status"> & {
  id?: string;
  createdAt?: string;
  status?: InvitationEmailDeliveryStatus;
};

export function createInvitationEmailDelivery(
  data: TaskloomData,
  input: CreateInvitationEmailDeliveryInput,
  timestamp = now(),
): InvitationEmailDeliveryRecord {
  const delivery: InvitationEmailDeliveryRecord = {
    id: input.id ?? generateId(),
    workspaceId: input.workspaceId,
    invitationId: input.invitationId,
    recipientEmail: normalizeEmail(input.recipientEmail),
    subject: input.subject,
    status: input.status ?? "pending",
    provider: input.provider,
    mode: input.mode,
    createdAt: input.createdAt ?? timestamp,
    sentAt: input.sentAt,
    error: input.error,
  };

  data.invitationEmailDeliveries.push(delivery);
  enqueueInvitationEmailDeliveryDualWrite(delivery);
  return delivery;
}

export function listInvitationEmailDeliveries(data: TaskloomData, workspaceId: string, invitationId?: string): InvitationEmailDeliveryRecord[] {
  return data.invitationEmailDeliveries
    .filter((entry) => entry.workspaceId === workspaceId && (!invitationId || entry.invitationId === invitationId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
}

export function findInvitationEmailDelivery(data: TaskloomData, deliveryId: string): InvitationEmailDeliveryRecord | null {
  return data.invitationEmailDeliveries.find((entry) => entry.id === deliveryId) ?? null;
}

export function markInvitationEmailDeliverySent(data: TaskloomData, deliveryId: string, timestamp = now()): InvitationEmailDeliveryRecord | null {
  const delivery = findInvitationEmailDelivery(data, deliveryId);
  if (!delivery) return null;
  delivery.status = "sent";
  delivery.sentAt = timestamp;
  delete delivery.error;
  enqueueInvitationEmailDeliveryDualWrite(delivery);
  return delivery;
}

export function markInvitationEmailDeliverySkipped(data: TaskloomData, deliveryId: string, reason?: string): InvitationEmailDeliveryRecord | null {
  const delivery = findInvitationEmailDelivery(data, deliveryId);
  if (!delivery) return null;
  delivery.status = "skipped";
  delete delivery.sentAt;
  delivery.error = reason;
  enqueueInvitationEmailDeliveryDualWrite(delivery);
  return delivery;
}

export function markInvitationEmailDeliveryFailed(data: TaskloomData, deliveryId: string, error: string): InvitationEmailDeliveryRecord | null {
  const delivery = findInvitationEmailDelivery(data, deliveryId);
  if (!delivery) return null;
  delivery.status = "failed";
  delete delivery.sentAt;
  delivery.error = error;
  enqueueInvitationEmailDeliveryDualWrite(delivery);
  return delivery;
}

export interface RecordInvitationEmailProviderStatusInput {
  deliveryId: string;
  providerStatus: string;
  providerDeliveryId?: string;
  providerError?: string;
  occurredAt: string;
}

export function recordInvitationEmailProviderStatus(
  data: TaskloomData,
  input: RecordInvitationEmailProviderStatusInput,
): InvitationEmailDeliveryRecord | null {
  const delivery = findInvitationEmailDelivery(data, input.deliveryId);
  if (!delivery) return null;
  delivery.providerStatus = input.providerStatus;
  delivery.providerStatusAt = input.occurredAt;
  if (input.providerDeliveryId !== undefined) {
    delivery.providerDeliveryId = input.providerDeliveryId;
  } else {
    delete delivery.providerDeliveryId;
  }
  if (input.providerError !== undefined) {
    delivery.providerError = input.providerError;
  } else {
    delete delivery.providerError;
  }
  enqueueInvitationEmailDeliveryDualWrite(delivery);
  return delivery;
}

export type WorkspaceBriefUpsertInput = Omit<WorkspaceBriefRecord, "createdAt" | "updatedAt"> &
  Partial<Pick<WorkspaceBriefRecord, "createdAt" | "updatedAt">>;

export function findWorkspaceBrief(data: TaskloomData, workspaceId: string): WorkspaceBriefRecord | null {
  return workspaceBriefEntries(data.workspaceBriefs).find((entry) => entry.workspaceId === workspaceId) ?? null;
}

export function listWorkspaceBriefVersions(data: TaskloomData, workspaceId: string): WorkspaceBriefVersionRecord[] {
  return data.workspaceBriefVersions
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => right.versionNumber - left.versionNumber);
}

export function findWorkspaceBriefVersion(
  data: TaskloomData,
  workspaceId: string,
  versionId: string,
): WorkspaceBriefVersionRecord | null {
  return data.workspaceBriefVersions.find((entry) => entry.workspaceId === workspaceId && entry.id === versionId) ?? null;
}

export function appendWorkspaceBriefVersion(
  data: TaskloomData,
  input: Omit<WorkspaceBriefVersionRecord, "id" | "versionNumber" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
  timestamp = now(),
): WorkspaceBriefVersionRecord {
  const versionNumber = listWorkspaceBriefVersions(data, input.workspaceId)[0]?.versionNumber ?? 0;
  const next: WorkspaceBriefVersionRecord = {
    id: input.id ?? generateId(),
    versionNumber: versionNumber + 1,
    workspaceId: input.workspaceId,
    summary: input.summary,
    goals: input.goals,
    audience: input.audience,
    constraints: input.constraints,
    problemStatement: input.problemStatement,
    targetCustomers: input.targetCustomers,
    desiredOutcome: input.desiredOutcome,
    successMetrics: input.successMetrics,
    source: input.source,
    sourceLabel: input.sourceLabel,
    createdByUserId: input.createdByUserId,
    createdByDisplayName: input.createdByDisplayName,
    createdAt: input.createdAt ?? timestamp,
  };
  data.workspaceBriefVersions.push(next);
  return next;
}

export function upsertWorkspaceBrief(
  data: TaskloomData,
  input: WorkspaceBriefUpsertInput,
  timestamp = now(),
): WorkspaceBriefRecord {
  const existing = findWorkspaceBrief(data, input.workspaceId);
  if (existing) {
    Object.assign(existing, input, { updatedAt: input.updatedAt ?? timestamp });
    return existing;
  }

  const next: WorkspaceBriefRecord = {
    ...input,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
  if (Array.isArray(data.workspaceBriefs)) {
    data.workspaceBriefs.push(next);
  } else {
    data.workspaceBriefs[next.workspaceId] = next;
  }
  return next;
}

export type RequirementUpsertInput = Omit<RequirementRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<RequirementRecord, "id" | "createdAt" | "updatedAt">>;

export function listRequirementsForWorkspace(data: TaskloomData, workspaceId: string): RequirementRecord[] {
  return data.requirements.filter((entry) => entry.workspaceId === workspaceId);
}

export function findRequirement(data: TaskloomData, requirementId: string): RequirementRecord | null {
  return data.requirements.find((entry) => entry.id === requirementId) ?? null;
}

export function upsertRequirement(data: TaskloomData, input: RequirementUpsertInput, timestamp = now()): RequirementRecord {
  return upsertRecord(data.requirements, input, timestamp);
}

export type ImplementationPlanItemUpsertInput = Omit<ImplementationPlanItemRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ImplementationPlanItemRecord, "id" | "createdAt" | "updatedAt">>;

export function listImplementationPlanItemsForWorkspace(data: TaskloomData, workspaceId: string): ImplementationPlanItemRecord[] {
  return data.implementationPlanItems
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => left.order - right.order);
}

export function findImplementationPlanItem(data: TaskloomData, planItemId: string): ImplementationPlanItemRecord | null {
  return data.implementationPlanItems.find((entry) => entry.id === planItemId) ?? null;
}

export function upsertImplementationPlanItem(
  data: TaskloomData,
  input: ImplementationPlanItemUpsertInput,
  timestamp = now(),
): ImplementationPlanItemRecord {
  return upsertRecord(data.implementationPlanItems, input, timestamp);
}

export type WorkflowConcernUpsertInput = Omit<WorkflowConcernRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<WorkflowConcernRecord, "id" | "createdAt" | "updatedAt">>;

export function listWorkflowConcernsForWorkspace(
  data: TaskloomData,
  workspaceId: string,
  kind?: WorkflowConcernKind,
): WorkflowConcernRecord[] {
  return data.workflowConcerns.filter((entry) => entry.workspaceId === workspaceId && (!kind || entry.kind === kind));
}

export function findWorkflowConcern(data: TaskloomData, concernId: string): WorkflowConcernRecord | null {
  return data.workflowConcerns.find((entry) => entry.id === concernId) ?? null;
}

export function upsertWorkflowConcern(
  data: TaskloomData,
  input: WorkflowConcernUpsertInput,
  timestamp = now(),
): WorkflowConcernRecord {
  return upsertRecord(data.workflowConcerns, input, timestamp);
}

export type ValidationEvidenceUpsertInput = Omit<ValidationEvidenceRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ValidationEvidenceRecord, "id" | "createdAt" | "updatedAt">>;

export function listValidationEvidenceForWorkspace(data: TaskloomData, workspaceId: string): ValidationEvidenceRecord[] {
  return data.validationEvidence.filter((entry) => entry.workspaceId === workspaceId);
}

export function findValidationEvidence(data: TaskloomData, evidenceId: string): ValidationEvidenceRecord | null {
  return data.validationEvidence.find((entry) => entry.id === evidenceId) ?? null;
}

export function upsertValidationEvidence(
  data: TaskloomData,
  input: ValidationEvidenceUpsertInput,
  timestamp = now(),
): ValidationEvidenceRecord {
  return upsertRecord(data.validationEvidence, input, timestamp);
}

export type ReleaseConfirmationUpsertInput = Omit<ReleaseConfirmationRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ReleaseConfirmationRecord, "id" | "createdAt" | "updatedAt">>;

export function listReleaseConfirmationsForWorkspace(data: TaskloomData, workspaceId: string): ReleaseConfirmationRecord[] {
  return releaseConfirmationEntries(data.releaseConfirmations).filter((entry) => entry.workspaceId === workspaceId);
}

export function findReleaseConfirmation(data: TaskloomData, releaseConfirmationId: string): ReleaseConfirmationRecord | null {
  return releaseConfirmationEntries(data.releaseConfirmations).find((entry) => {
    return entry.id === releaseConfirmationId || entry.workspaceId === releaseConfirmationId;
  }) ?? null;
}

export function upsertReleaseConfirmation(
  data: TaskloomData,
  input: ReleaseConfirmationUpsertInput,
  timestamp = now(),
): ReleaseConfirmationRecord {
  const existing = releaseConfirmationEntries(data.releaseConfirmations).find((entry) => {
    return (input.id && entry.id === input.id) || entry.workspaceId === input.workspaceId;
  });
  if (existing) {
    Object.assign(existing, input, { updatedAt: input.updatedAt ?? timestamp });
    return existing;
  }

  const next: ReleaseConfirmationRecord = {
    ...input,
    id: input.id ?? generateId(),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
  if (Array.isArray(data.releaseConfirmations)) {
    data.releaseConfirmations.push(next);
  } else {
    data.releaseConfirmations[next.workspaceId] = next;
  }
  return next;
}

export type AgentUpsertInput = Omit<AgentRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<AgentRecord, "id" | "createdAt" | "updatedAt">>;

export function listAgentsForWorkspace(data: TaskloomData, workspaceId: string, includeArchived = false): AgentRecord[] {
  return data.agents
    .filter((entry) => entry.workspaceId === workspaceId && (includeArchived || entry.status !== "archived"))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function findAgent(data: TaskloomData, agentId: string): AgentRecord | null {
  return data.agents.find((entry) => entry.id === agentId) ?? null;
}

export function upsertAgent(data: TaskloomData, input: AgentUpsertInput, timestamp = now()): AgentRecord {
  return upsertRecord(data.agents, input, timestamp);
}

export function listProvidersForWorkspace(data: TaskloomData, workspaceId: string): ProviderRecord[] {
  return data.providers
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function findProvider(data: TaskloomData, providerId: string): ProviderRecord | null {
  return data.providers.find((entry) => entry.id === providerId) ?? null;
}

export type ProviderUpsertInput = Omit<ProviderRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ProviderRecord, "id" | "createdAt" | "updatedAt">>;

export function upsertProvider(data: TaskloomData, input: ProviderUpsertInput, timestamp = now()): ProviderRecord {
  return upsertRecord(data.providers, input, timestamp);
}

export type AgentRunUpsertInput = Omit<AgentRunRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<AgentRunRecord, "id" | "createdAt" | "updatedAt">>;

export function listAgentRunsForWorkspace(data: TaskloomData, workspaceId: string): AgentRunRecord[] {
  return data.agentRuns
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listAgentRunsForAgent(data: TaskloomData, workspaceId: string, agentId: string): AgentRunRecord[] {
  return listAgentRunsForWorkspace(data, workspaceId).filter((entry) => entry.agentId === agentId);
}

export function upsertAgentRun(data: TaskloomData, input: AgentRunUpsertInput, timestamp = now()): AgentRunRecord {
  const record = upsertRecord(data.agentRuns, input, timestamp);
  if (process.env.TASKLOOM_STORE === "sqlite") {
    if (activeMutateSqliteDepth > 0) {
      pendingAgentRunDualWrites.push({ ...record });
    } else {
      const repo = createAgentRunsRepository({});
      repo.upsert(record);
    }
  }
  return record;
}

export type ActivationSignalUpsertInput = Omit<ActivationSignalRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<ActivationSignalRecord, "id" | "createdAt" | "updatedAt">>;

export interface ActivationSignalRepository {
  listForWorkspace(workspaceId: string): ActivationSignalRecord[];
  upsert(input: ActivationSignalUpsertInput, timestamp?: string): ActivationSignalRecord;
}

export function activationSignalRepository(): ActivationSignalRepository {
  if (process.env.TASKLOOM_STORE === "sqlite") return sqliteActivationSignalRepository(resolve(process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE));
  return jsonActivationSignalRepository();
}

function jsonActivationSignalRepository(): ActivationSignalRepository {
  return {
    listForWorkspace(workspaceId) {
      return listActivationSignalsForWorkspace(loadStore(), workspaceId);
    },
    upsert(input, timestamp = now()) {
      return mutateStore((data) => upsertActivationSignal(data, input, timestamp));
    },
  };
}

function sqliteActivationSignalRepository(dbPath: string): ActivationSignalRepository {
  return {
    listForWorkspace(workspaceId) {
      const db = openStoreDatabase(dbPath);
      try {
        const rows = db.prepare(`
          select payload
          from app_records
          where collection = 'activationSignals' and workspace_id = ?
          order by json_extract(payload, '$.createdAt'), id
        `).all(workspaceId) as Array<{ payload: string }>;
        return rows.map((row) => normalizeActivationSignalRecord(JSON.parse(row.payload) as ActivationSignalRecord));
      } finally {
        db.close();
      }
    },
    upsert(input, timestamp = now()) {
      const db = openStoreDatabase(dbPath);
      try {
        db.exec("begin immediate");
        try {
          const existing = findSqliteActivationSignalForUpsert(db, input);
          const id = existing?.id ?? input.id ?? generateId();
          const record: ActivationSignalRecord = {
            ...existing,
            ...input,
            id,
            origin: input.origin ?? inferActivationSignalOrigin(input.source) ?? existing?.origin,
            createdAt: input.createdAt ?? existing?.createdAt ?? timestamp,
            updatedAt: input.updatedAt ?? timestamp,
          };
          db.prepare(`
            insert into app_records (collection, id, workspace_id, payload, updated_at)
            values ('activationSignals', ?, ?, json(?), ?)
            on conflict(collection, id) do update set
              workspace_id = excluded.workspace_id,
              payload = excluded.payload,
              updated_at = excluded.updated_at
          `).run(record.id, record.workspaceId, JSON.stringify(record), record.updatedAt);
          db.prepare(`
            insert into app_record_search (collection, id, workspace_id, user_id, email, token)
            values ('activationSignals', ?, ?, null, null, null)
            on conflict(collection, id) do update set workspace_id = excluded.workspace_id
          `).run(record.id, record.workspaceId);
          db.exec("commit");
          clearStoreCache();
          return record;
        } catch (error) {
          db.exec("rollback");
          throw error;
        }
      } finally {
        db.close();
      }
    },
  };
}

function findSqliteActivationSignalForUpsert(db: DatabaseSync, input: ActivationSignalUpsertInput): ActivationSignalRecord | null {
  const stableKeyRow = input.stableKey
    ? db.prepare(`
      select payload
      from app_records
      where collection = 'activationSignals'
        and workspace_id = ?
        and json_extract(payload, '$.stableKey') = ?
      limit 1
    `).get(input.workspaceId, input.stableKey) as { payload: string } | undefined
    : undefined;
  if (stableKeyRow) return normalizeActivationSignalRecord(JSON.parse(stableKeyRow.payload) as ActivationSignalRecord);

  if (!input.id) return null;
  const idRow = db.prepare(`
    select payload
    from app_records
    where collection = 'activationSignals' and id = ?
    limit 1
  `).get(input.id) as { payload: string } | undefined;
  return idRow ? normalizeActivationSignalRecord(JSON.parse(idRow.payload) as ActivationSignalRecord) : null;
}

export function listActivationSignalsForWorkspace(data: TaskloomData, workspaceId: string): ActivationSignalRecord[] {
  return data.activationSignals
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

export function upsertActivationSignal(data: TaskloomData, input: ActivationSignalUpsertInput, timestamp = now()): ActivationSignalRecord {
  const existing = input.stableKey
    ? data.activationSignals.find((entry) => entry.workspaceId === input.workspaceId && entry.stableKey === input.stableKey)
    : null;
  const normalizedInput = {
    ...input,
    origin: input.origin ?? inferActivationSignalOrigin(input.source) ?? existing?.origin,
  };
  if (existing) {
    Object.assign(existing, normalizedInput, { id: existing.id, createdAt: input.createdAt ?? existing.createdAt, updatedAt: input.updatedAt ?? timestamp });
    return existing;
  }
  return upsertRecord(data.activationSignals, normalizedInput, timestamp);
}

function inferActivationSignalOrigin(source: ActivationSignalSource): ActivationSignalOrigin | undefined {
  if (source === "seed" || source === "system_fact" || source === "activity") return "system_observed";
  if (source === "user_fact" || source === "workflow" || source === "agent_run") return "user_entered";
  return undefined;
}

function normalizeActivationSignalRecord(record: ActivationSignalRecord): ActivationSignalRecord {
  return {
    ...record,
    origin: record.origin ?? inferActivationSignalOrigin(record.source),
  };
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
  const timestamp = now();
  const facts = data.activationFacts[workspaceId];
  const productRecords = activationProductRecordsForWorkspace(data, workspaceId, timestamp);

  if (productRecords.hasDurableRecords) {
    return buildSignalSnapshotFromProductRecords(productRecords.records);
  }

  return buildSignalSnapshotFromFacts({
    ...facts,
    now: timestamp,
  });
}

function activationProductRecordsForWorkspace(data: TaskloomData, workspaceId: string, timestamp: string) {
  const workspace = data.workspaces.find((entry) => entry.id === workspaceId);
  const facts = data.activationFacts[workspaceId];
  const brief = findWorkspaceBrief(data, workspaceId);
  const requirements = listRequirementsForWorkspace(data, workspaceId);
  const planItems = listImplementationPlanItemsForWorkspace(data, workspaceId);
  const concerns = listWorkflowConcernsForWorkspace(data, workspaceId);
  const validationEvidence = listValidationEvidenceForWorkspace(data, workspaceId);
  const activationSignals = listActivationSignalsForWorkspace(data, workspaceId);
  const retryActivities = activationSignalActivities(data.activities, workspaceId, "retry");
  const scopeChangeActivities = activationSignalActivities(data.activities, workspaceId, "scope_change");
  const releaseConfirmation = listReleaseConfirmationsForWorkspace(data, workspaceId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  const records = {
    now: timestamp,
    createdAt: workspace?.createdAt ?? facts?.createdAt,
    startedAt: facts?.startedAt,
    completedAt: facts?.completedAt,
    releasedAt: facts?.releasedAt,
    brief: brief
      ? { id: brief.workspaceId, capturedAt: brief.createdAt, updatedAt: brief.updatedAt }
      : factRecord(facts?.briefCapturedAt),
    requirements: requirements.length > 0
      ? requirements.map((entry) => ({
        id: entry.id,
        status: entry.status,
        definedAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }))
      : factRecord(facts?.requirementsDefinedAt),
    plan: planItems.length > 0 ? planRecordFromPlanItems(planItems) : factRecord(facts?.planDefinedAt),
    implementation: planItems.length > 0
      ? implementationRecordFromPlanItems(planItems)
      : factRecord(facts?.implementationStartedAt ?? facts?.completedAt),
    blockers: concerns.some((entry) => entry.kind === "blocker")
      ? concerns.filter((entry) => entry.kind === "blocker").map(concernRecord)
      : countRecords("legacy_blocker", facts?.blockerCount, { severity: facts?.criticalIssueCount ? "critical" : undefined }),
    questions: concerns.some((entry) => entry.kind === "open_question")
      ? concerns.filter((entry) => entry.kind === "open_question").map(concernRecord)
      : countRecords("legacy_question", facts?.openQuestionCount),
    validationEvidence: validationEvidence.length > 0
      ? validationEvidence.map(validationEvidenceRecord)
      : [
        ...countRecords("legacy_failed_validation", facts?.failedValidationCount, { status: "failed" }),
        ...factRecords("legacy_validation", facts?.validationPassedAt, { status: "passed", passedAt: facts?.validationPassedAt }),
      ],
    testEvidence: validationEvidence.length > 0
      ? validationEvidence.filter((entry) => entry.type === "automated_test").map(validationEvidenceRecord)
      : factRecords("legacy_test", facts?.testsPassedAt, { status: "passed", evidenceType: "test", passedAt: facts?.testsPassedAt }),
    releaseConfirmation: releaseConfirmation
      ? {
        id: releaseConfirmation.id ?? releaseConfirmation.workspaceId,
        status: releaseConfirmation.status,
        confirmedAt: releaseConfirmation.confirmedAt,
        createdAt: releaseConfirmation.createdAt,
        updatedAt: releaseConfirmation.updatedAt,
      }
      : factRecord(facts?.releaseConfirmedAt),
    retries: durableSignalRecords(activationSignals, "retry", retryActivities, "activity_retry")
      ?? countRecords("legacy_retry", facts?.retryCount),
    scopeChanges: durableSignalRecords(activationSignals, "scope_change", scopeChangeActivities, "activity_scope_change")
      ?? countRecords("legacy_scope_change", facts?.scopeChangeCount),
  };

  return {
    records,
    hasDurableRecords: Boolean(
      brief || requirements.length > 0 || planItems.length > 0 || concerns.length > 0 ||
      validationEvidence.length > 0 || releaseConfirmation || activationSignals.length > 0 || retryActivities.length > 0 || scopeChangeActivities.length > 0,
    ),
  };
}

function activationSignalActivities(activities: ActivityRecord[], workspaceId: string, kind: ActivationSignalRecord["kind"]): ActivityRecord[] {
  return activities.filter((entry) => {
    if (entry.workspaceId !== workspaceId) return false;
    if (entry.data.activationSignalKind === kind) return true;
    return kind === "retry" ? entry.event === "agent.run.retry" : entry.event === "workflow.scope_changed";
  });
}

function durableSignalRecords(
  signals: ActivationSignalRecord[],
  kind: ActivationSignalRecord["kind"],
  activities: ActivityRecord[],
  activityPrefix: string,
): DurableActivationProductRecord[] | null {
  const records = signals
    .filter((entry) => entry.kind === kind)
    .map((entry) => ({ id: entry.id, kind: entry.kind, createdAt: entry.createdAt }));
  const seenSignalIds = new Set(signals.filter((entry) => entry.kind === kind).map((entry) => entry.id));
  const seenSourceIds = new Set(signals.filter((entry) => entry.kind === kind && entry.sourceId).map((entry) => entry.sourceId));

  for (const activity of activities) {
    if (typeof activity.data.activationSignalId === "string" && seenSignalIds.has(activity.data.activationSignalId)) continue;
    if (typeof activity.data.sourceId === "string" && seenSourceIds.has(activity.data.sourceId)) continue;
    if (typeof activity.data.previousRunId === "string" && seenSourceIds.has(activity.data.previousRunId)) continue;
    if (seenSourceIds.has(activity.id)) continue;
    records.push({ id: `${activityPrefix}_${activity.id}`, kind, createdAt: activity.occurredAt });
  }

  return records.length > 0 ? records : null;
}

function factRecord(timestamp: string | undefined): DurableActivationProductRecord | null {
  return timestamp ? { id: `legacy_${timestamp}`, createdAt: timestamp } : null;
}

function factRecords(
  prefix: string,
  timestamp: string | undefined,
  overrides: DurableActivationProductRecord = {},
): DurableActivationProductRecord[] {
  return timestamp ? [{ id: `${prefix}_${timestamp}`, createdAt: timestamp, ...overrides }] : [];
}

function countRecords(
  prefix: string,
  count = 0,
  overrides: DurableActivationProductRecord = {},
): DurableActivationProductRecord[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}_${index}`, ...overrides }));
}

function planRecordFromPlanItems(planItems: ImplementationPlanItemRecord[]): DurableActivationProductRecord {
  const first = planItems[0];
  return {
    id: first.id,
    status: planItems.some((entry) => entry.status === "in_progress" || entry.status === "blocked")
      ? "in_progress"
      : planItems.every((entry) => entry.status === "done") ? "completed" : "todo",
    plannedAt: first.createdAt,
    startedAt: firstTimestamp(planItems, "startedAt") ?? firstTimestamp(planItems, "updatedAt", isStartedPlanItem),
    updatedAt: latestTimestamp(planItems.map((entry) => entry.updatedAt)),
    createdAt: first.createdAt,
  };
}

function implementationRecordFromPlanItems(planItems: ImplementationPlanItemRecord[]): DurableActivationProductRecord {
  const started = planItems.filter(isStartedPlanItem);
  const completed = planItems.filter((entry) => entry.status === "done");
  return {
    id: started[0]?.id ?? planItems[0].id,
    status: planItems.length > 0 && completed.length === planItems.length ? "completed" : started.length > 0 ? "in_progress" : "todo",
    startedAt: firstTimestamp(planItems, "startedAt") ?? firstTimestamp(started, "updatedAt"),
    completedAt: completed.length === planItems.length ? latestTimestamp(completed.map((entry) => entry.completedAt ?? entry.updatedAt)) : undefined,
    createdAt: started[0]?.createdAt,
    updatedAt: latestTimestamp(planItems.map((entry) => entry.updatedAt)),
  };
}

function concernRecord(entry: WorkflowConcernRecord): DurableActivationProductRecord {
  return {
    id: entry.id,
    kind: entry.kind,
    status: entry.status,
    severity: entry.severity,
    dependency: Boolean(entry.relatedPlanItemId || entry.relatedRequirementId),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    resolvedAt: entry.resolvedAt,
  };
}

function validationEvidenceRecord(entry: ValidationEvidenceRecord): DurableActivationProductRecord {
  const outcome = entry.outcome ?? entry.status;
  return {
    id: entry.id,
    kind: entry.type,
    evidenceType: entry.type,
    status: outcome,
    capturedAt: entry.capturedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    passedAt: outcome === "passed" ? entry.capturedAt ?? entry.updatedAt : undefined,
    failedAt: outcome === "failed" ? entry.capturedAt ?? entry.updatedAt : undefined,
  };
}

function isStartedPlanItem(entry: ImplementationPlanItemRecord): boolean {
  return entry.status === "in_progress" || entry.status === "blocked" || entry.status === "done";
}

function firstTimestamp(
  records: ImplementationPlanItemRecord[],
  field: "startedAt" | "updatedAt",
  predicate: (entry: ImplementationPlanItemRecord) => boolean = () => true,
): string | undefined {
  return records.filter(predicate).map((entry) => entry[field]).filter(Boolean).sort()[0];
}

function latestTimestamp(timestamps: Array<string | undefined>): string | undefined {
  return timestamps.filter(Boolean).sort().at(-1);
}

function upsertRecord<TRecord extends { id: string; createdAt: string; updatedAt: string }>(
  records: TRecord[],
  input: Omit<TRecord, "id" | "createdAt" | "updatedAt"> & Partial<Pick<TRecord, "id" | "createdAt" | "updatedAt">>,
  timestamp: string,
): TRecord {
  const id = input.id ?? generateId();
  const existing = records.find((entry) => entry.id === id);
  if (existing) {
    Object.assign(existing, input, { id, updatedAt: input.updatedAt ?? timestamp });
    return existing;
  }

  const next = {
    ...input,
    id,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  } as TRecord;
  records.push(next);
  return next;
}

export function listWorkspaceEnvVars(data: TaskloomData, workspaceId: string): WorkspaceEnvVarRecord[] {
  return data.workspaceEnvVars
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function findWorkspaceEnvVar(data: TaskloomData, envVarId: string): WorkspaceEnvVarRecord | null {
  return data.workspaceEnvVars.find((entry) => entry.id === envVarId) ?? null;
}

export type WorkspaceEnvVarUpsertInput = Omit<WorkspaceEnvVarRecord, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<WorkspaceEnvVarRecord, "id" | "createdAt" | "updatedAt">>;

export function upsertWorkspaceEnvVar(
  data: TaskloomData,
  input: WorkspaceEnvVarUpsertInput,
  timestamp = now(),
): WorkspaceEnvVarRecord {
  return upsertRecord(data.workspaceEnvVars, input, timestamp);
}

export function deleteWorkspaceEnvVar(data: TaskloomData, envVarId: string): boolean {
  const before = data.workspaceEnvVars.length;
  data.workspaceEnvVars = data.workspaceEnvVars.filter((entry) => entry.id !== envVarId);
  return data.workspaceEnvVars.length < before;
}

function workspaceBriefEntries(collection: WorkspaceBriefCollection): WorkspaceBriefRecord[] {
  return Array.isArray(collection) ? collection : Object.values(collection);
}

function releaseConfirmationEntries(collection: ReleaseConfirmationCollection): ReleaseConfirmationRecord[] {
  return Array.isArray(collection) ? collection : Object.values(collection);
}
