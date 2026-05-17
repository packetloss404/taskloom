import { createHash } from "node:crypto";
import type { AnthropicClientFactory } from "./providers/anthropic.js";
import type { LLMProvider, ProviderStreamChunk } from "./providers/types.js";
import { getDefaultRouter } from "./providers/router.js";
import { registerDefaultProviders } from "./providers/bootstrap.js";
import {
  resolvePresetToProviderModel,
  type ModelPreset,
} from "./providers/preset-resolver.js";
import {
  APP_BUILDER_SYSTEM_PROMPT,
  APP_BUILDER_TOOL_DESCRIPTION,
  APP_BUILDER_TOOL_INPUT_SCHEMA,
  APP_BUILDER_TOOL_NAME,
} from "./app-builder-llm-prompts.js";
import type { ModelRoutingPresetId } from "./model-routing-presets.js";
import { authorAppViaLLM, type GeneratedFile } from "./codegen/llm-author.js";
import { validateFileTree } from "./codegen/validate.js";
import { deriveDraftFromFiles } from "./codegen/derived-draft.js";

export type AppDraftTemplateId =
  | "crm"
  | "booking"
  | "internal_dashboard"
  | "task_tracker"
  | "customer_portal";

export type RouteAccess = "public" | "private" | "admin";

export type AppDraft = {
  prompt: string;
  templateId: AppDraftTemplateId;
  appName: string;
  summary: string;
  integrationMetadata: Phase71IntegrationMetadata;
  pageMap: PageDraft[];
  components: ComponentDraft[];
  apiRouteStubs: ApiRouteStub[];
  dataSchema: DataSchemaDraft;
  seedData: Record<string, SeedRecord[]>;
  crudFlows: CrudFlowDraft[];
  auth: AuthDraft;
  acceptanceChecks: string[];
};

export type Phase71IntegrationId =
  | "openai"
  | "anthropic"
  | "ollama"
  | "custom_api"
  | "slack_webhook"
  | "email"
  | "github"
  | "browser"
  | "stripe"
  | "database";

export type Phase71IntegrationDraft = {
  id: Phase71IntegrationId;
  label: string;
  envVars: string[];
  flows: string[];
  setupGuidance: string[];
};

export type Phase71IntegrationMetadata = {
  requested: Phase71IntegrationDraft[];
  setupGuidance: string[];
};

export type PageDraft = {
  path: string;
  name: string;
  access: RouteAccess;
  purpose: string;
  primaryEntity?: string;
  actions: string[];
};

export type ComponentDraft = {
  name: string;
  type: "layout" | "list" | "form" | "detail" | "chart" | "navigation";
  usedOn: string[];
  responsibilities: string[];
};

export type ApiRouteStub = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  access: RouteAccess;
  purpose: string;
  requestBody?: string;
  responseShape: string;
};

export type DataSchemaDraft = {
  database: "postgres";
  entities: EntitySchemaDraft[];
  notes: string[];
};

export type EntitySchemaDraft = {
  name: string;
  primaryKey: string;
  fields: FieldSchemaDraft[];
  indexes: string[];
  relations: string[];
};

export type FieldSchemaDraft = {
  name: string;
  type: "uuid" | "string" | "text" | "number" | "boolean" | "date" | "datetime" | "enum";
  required: boolean;
  enumValues?: string[];
  references?: string;
};

export type SeedRecord = Record<string, string | number | boolean | null>;

export type CrudFlowDraft = {
  entity: string;
  create: string[];
  read: string[];
  update: string[];
  delete: string[];
};

export type AuthDraft = {
  defaultPolicy: "authenticated-by-default";
  publicRoutes: string[];
  privateRoutes: string[];
  roleRoutes: Array<{ role: "admin"; routes: string[]; reason: string }>;
  decisions: string[];
};

export type GeneratedAppSourceFileKind =
  | "manifest"
  | "config"
  | "source"
  | "route-data"
  | "api"
  | "seed-data"
  | "documentation";

export type GeneratedAppSourceFile = {
  path: string;
  kind: GeneratedAppSourceFileKind;
  contents: string;
  sizeBytes: number;
  checksum: string;
};

export type GeneratedAppSourceArtifactBundle = {
  appName: string;
  appSlug: string;
  templateId: AppDraftTemplateId;
  entrypoint: string;
  files: GeneratedAppSourceFile[];
};

type TemplateDefinition = {
  id: AppDraftTemplateId;
  nameSuffix: string;
  summaryNoun: string;
  keywords: string[];
  pages: PageDraft[];
  components: ComponentDraft[];
  entities: EntitySchemaDraft[];
  seeds: Record<string, SeedRecord[]>;
  acceptanceChecks: string[];
};

type Phase71IntegrationDefinition = Phase71IntegrationDraft & {
  signals: RegExp[];
};

const STOP_WORDS = new Set([
  "a", "an", "and", "app", "application", "build", "for", "from", "in", "internal",
  "create", "help", "make", "manage", "of", "on", "our", "please", "ship", "that",
  "the", "to", "tool", "track", "with", "team", "teams",
]);

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: "crm",
    nameSuffix: "CRM",
    summaryNoun: "customer relationship workspace",
    keywords: [
      "crm", "lead", "leads", "deal", "deals", "pipeline", "account", "accounts",
      "contact", "contacts", "sales", "opportunity", "opportunities",
    ],
    pages: [
      page("/login", "Sign in", "public", "Authenticate workspace users.", undefined, ["sign in"]),
      page("/crm", "Pipeline", "private", "Review active sales pipeline health.", "deal", ["filter deals", "move stages"]),
      page("/crm/accounts", "Accounts", "private", "Manage companies, contacts, and ownership.", "account", ["create account", "assign owner"]),
      page("/crm/leads", "Leads", "private", "Capture and qualify inbound leads.", "lead", ["create lead", "convert lead"]),
      page("/crm/deals/:dealId", "Deal detail", "private", "Inspect deal activity and next steps.", "deal", ["edit deal", "log activity"]),
    ],
    components: [
      component("PipelineBoard", "list", ["/crm"], ["group deals by stage", "support drag-style stage changes"]),
      component("AccountTable", "list", ["/crm/accounts"], ["sort accounts", "show owner and status"]),
      component("LeadCaptureForm", "form", ["/crm/leads"], ["validate lead source", "create qualified leads"]),
      component("ActivityTimeline", "detail", ["/crm/deals/:dealId"], ["show notes", "show stage changes"]),
      component("RevenueSummary", "chart", ["/crm"], ["summarize open value", "highlight stale deals"]),
    ],
    entities: [
      entity("account", [
        field("id", "uuid", true),
        field("name", "string", true),
        field("industry", "string", false),
        field("ownerId", "uuid", true),
        field("status", "enum", true, ["prospect", "active", "churn_risk"]),
        field("createdAt", "datetime", true),
      ], ["ownerId", "status"], ["account has many contacts", "account has many deals"]),
      entity("lead", [
        field("id", "uuid", true),
        field("name", "string", true),
        field("email", "string", true),
        field("source", "string", true),
        field("score", "number", true),
        field("status", "enum", true, ["new", "qualified", "converted", "archived"]),
      ], ["status", "score"], ["lead may convert into account and deal"]),
      entity("deal", [
        field("id", "uuid", true),
        field("accountId", "uuid", true, undefined, "account.id"),
        field("title", "string", true),
        field("stage", "enum", true, ["discovery", "proposal", "negotiation", "won", "lost"]),
        field("value", "number", true),
        field("closeDate", "date", false),
      ], ["accountId", "stage", "closeDate"], ["deal belongs to account"]),
    ],
    seeds: {
      account: [
        { id: "acc_001", name: "Northwind Industries", industry: "Manufacturing", ownerId: "user_admin", status: "active", createdAt: "2026-01-05T09:00:00Z" },
        { id: "acc_002", name: "Bluebird Health", industry: "Healthcare", ownerId: "user_admin", status: "prospect", createdAt: "2026-01-11T10:30:00Z" },
        { id: "acc_003", name: "Acme Robotics", industry: "Manufacturing", ownerId: "user_admin", status: "active", createdAt: "2026-02-02T08:15:00Z" },
        { id: "acc_004", name: "Cascade Logistics", industry: "Logistics", ownerId: "user_admin", status: "churn_risk", createdAt: "2025-11-19T16:42:00Z" },
        { id: "acc_005", name: "Helix Biosciences", industry: "Biotech", ownerId: "user_admin", status: "prospect", createdAt: "2026-02-28T11:05:00Z" },
        { id: "acc_006", name: "Summit Financial Group", industry: "Financial Services", ownerId: "user_admin", status: "active", createdAt: "2026-03-14T14:30:00Z" },
      ],
      lead: [
        { id: "lead_001", name: "Morgan Lee", email: "morgan.lee@northwind.example", source: "Inbound", score: 82, status: "qualified" },
        { id: "lead_002", name: "Ari Patel", email: "ari.patel@helix.example", source: "Referral", score: 64, status: "new" },
        { id: "lead_003", name: "Sasha Kim", email: "sasha.kim@summit.example", source: "Event", score: 71, status: "qualified" },
        { id: "lead_004", name: "Devon Rivers", email: "devon@cascadelogistics.example", source: "Outbound", score: 48, status: "new" },
        { id: "lead_005", name: "Priya Shah", email: "priya@acmerobotics.example", source: "Partner", score: 91, status: "converted" },
      ],
      deal: [
        { id: "deal_001", accountId: "acc_001", title: "Northwind annual renewal", stage: "negotiation", value: 84000, closeDate: "2026-06-15" },
        { id: "deal_002", accountId: "acc_002", title: "Bluebird pilot rollout", stage: "discovery", value: 12000, closeDate: "2026-07-01" },
        { id: "deal_003", accountId: "acc_003", title: "Acme robotics expansion", stage: "proposal", value: 42500, closeDate: "2026-06-28" },
        { id: "deal_004", accountId: "acc_004", title: "Cascade contract renewal", stage: "negotiation", value: 31000, closeDate: "2026-05-30" },
        { id: "deal_005", accountId: "acc_006", title: "Summit advisory engagement", stage: "won", value: 56000, closeDate: "2026-04-22" },
      ],
    },
    acceptanceChecks: [
      "Users can create, edit, and archive leads without leaving the CRM area.",
      "Pipeline totals update when a deal stage or value changes.",
      "Deal detail shows account context and recent activity.",
    ],
  },
  {
    id: "booking",
    nameSuffix: "Booking Desk",
    summaryNoun: "booking and appointment workspace",
    keywords: [
      "appointment", "appointments", "booking", "bookings", "calendar", "reservation",
      "reservations", "schedule", "scheduling", "slot", "slots", "provider", "providers",
    ],
    pages: [
      page("/", "Booking home", "public", "Introduce services and route visitors to booking.", undefined, ["start booking"]),
      page("/book", "Book appointment", "public", "Collect customer details and reserve a slot.", "appointment", ["select service", "select slot", "confirm"]),
      page("/appointments", "Appointments", "private", "Manage upcoming and past appointments.", "appointment", ["reschedule", "cancel"]),
      page("/appointments/:appointmentId", "Appointment detail", "private", "Review customer, service, and notes.", "appointment", ["edit appointment", "add note"]),
      page("/settings/services", "Services", "admin", "Maintain services, providers, and availability.", "service", ["create service", "edit availability"]),
    ],
    components: [
      component("ServicePicker", "form", ["/book"], ["show active services", "store selected service"]),
      component("SlotPicker", "form", ["/book"], ["show available slots", "prevent double booking"]),
      component("AppointmentCalendar", "list", ["/appointments"], ["group appointments by day", "show status"]),
      component("ProviderRoster", "list", ["/settings/services"], ["manage provider availability", "show assigned services"]),
      component("ConfirmationPanel", "detail", ["/book", "/appointments/:appointmentId"], ["summarize booking", "show confirmation status"]),
    ],
    entities: [
      entity("service", [
        field("id", "uuid", true),
        field("name", "string", true),
        field("durationMinutes", "number", true),
        field("price", "number", false),
        field("active", "boolean", true),
      ], ["active"], ["service has many appointments"]),
      entity("provider", [
        field("id", "uuid", true),
        field("name", "string", true),
        field("email", "string", true),
        field("timezone", "string", true),
        field("active", "boolean", true),
      ], ["active"], ["provider has many appointments"]),
      entity("appointment", [
        field("id", "uuid", true),
        field("serviceId", "uuid", true, undefined, "service.id"),
        field("providerId", "uuid", true, undefined, "provider.id"),
        field("customerName", "string", true),
        field("customerEmail", "string", true),
        field("startsAt", "datetime", true),
        field("status", "enum", true, ["pending", "confirmed", "cancelled", "completed"]),
      ], ["startsAt", "providerId", "status"], ["appointment belongs to service", "appointment belongs to provider"]),
    ],
    seeds: {
      service: [
        { id: "svc_001", name: "Discovery call", durationMinutes: 30, price: 0, active: true },
        { id: "svc_002", name: "Implementation consult", durationMinutes: 60, price: 150, active: true },
        { id: "svc_003", name: "Quarterly business review", durationMinutes: 45, price: 0, active: true },
        { id: "svc_004", name: "Onboarding workshop", durationMinutes: 90, price: 400, active: true },
        { id: "svc_005", name: "Technical deep dive", durationMinutes: 60, price: 250, active: true },
      ],
      provider: [
        { id: "pro_001", name: "Jamie Rivera", email: "jamie.rivera@booking.example", timezone: "America/Chicago", active: true },
        { id: "pro_002", name: "Sam Chen", email: "sam.chen@booking.example", timezone: "America/Los_Angeles", active: true },
        { id: "pro_003", name: "Avery Johnson", email: "avery.johnson@booking.example", timezone: "America/New_York", active: true },
        { id: "pro_004", name: "Reese Okonkwo", email: "reese.okonkwo@booking.example", timezone: "Europe/London", active: false },
      ],
      appointment: [
        { id: "apt_001", serviceId: "svc_001", providerId: "pro_001", customerName: "Taylor Quinn", customerEmail: "taylor.quinn@northwind.example", startsAt: "2026-05-19T15:00:00Z", status: "confirmed" },
        { id: "apt_002", serviceId: "svc_004", providerId: "pro_002", customerName: "Hannah Brooks", customerEmail: "hannah.brooks@helix.example", startsAt: "2026-05-20T17:30:00Z", status: "pending" },
        { id: "apt_003", serviceId: "svc_002", providerId: "pro_003", customerName: "Liam Carter", customerEmail: "liam.carter@summit.example", startsAt: "2026-05-21T13:00:00Z", status: "confirmed" },
        { id: "apt_004", serviceId: "svc_005", providerId: "pro_001", customerName: "Nina Alvarez", customerEmail: "nina.alvarez@cascade.example", startsAt: "2026-05-22T19:00:00Z", status: "confirmed" },
        { id: "apt_005", serviceId: "svc_003", providerId: "pro_002", customerName: "Owen Park", customerEmail: "owen.park@acmerobotics.example", startsAt: "2026-05-15T16:00:00Z", status: "completed" },
      ],
    },
    acceptanceChecks: [
      "Visitors can book a public appointment without accessing private management pages.",
      "The system prevents two confirmed appointments for the same provider and start time.",
      "Admins can add or deactivate services used by the booking flow.",
    ],
  },
  {
    id: "internal_dashboard",
    nameSuffix: "Operations Dashboard",
    summaryNoun: "internal reporting workspace",
    keywords: [
      "dashboard", "dashboards", "analytics", "metric", "metrics", "kpi", "kpis",
      "report", "reports", "monitor", "monitoring", "operations", "ops", "alert", "alerts",
    ],
    pages: [
      page("/login", "Sign in", "public", "Authenticate internal users.", undefined, ["sign in"]),
      page("/dashboard", "Dashboard", "private", "Scan KPIs, trends, and operational status.", "metricSnapshot", ["filter metrics", "inspect trends"]),
      page("/reports", "Reports", "private", "Create and share saved operating reports.", "report", ["create report", "export report"]),
      page("/alerts", "Alerts", "private", "Triage threshold breaches and incidents.", "alert", ["acknowledge alert", "resolve alert"]),
      page("/settings", "Dashboard settings", "admin", "Configure metrics, thresholds, and access.", undefined, ["edit thresholds"]),
    ],
    components: [
      component("KpiGrid", "chart", ["/dashboard"], ["show current values", "compare against targets"]),
      component("TrendChart", "chart", ["/dashboard", "/reports"], ["plot metric history", "highlight anomalies"]),
      component("AlertTable", "list", ["/alerts"], ["sort alerts by severity", "acknowledge alerts"]),
      component("ReportBuilder", "form", ["/reports"], ["choose metrics", "save report definitions"]),
      component("DashboardFilters", "navigation", ["/dashboard"], ["filter by team", "filter by date range"]),
    ],
    entities: [
      entity("metricSnapshot", [
        field("id", "uuid", true),
        field("metricKey", "string", true),
        field("label", "string", true),
        field("value", "number", true),
        field("target", "number", false),
        field("capturedAt", "datetime", true),
      ], ["metricKey", "capturedAt"], ["metric snapshots power reports and alerts"]),
      entity("alert", [
        field("id", "uuid", true),
        field("metricKey", "string", true),
        field("severity", "enum", true, ["info", "warning", "critical"]),
        field("status", "enum", true, ["open", "acknowledged", "resolved"]),
        field("message", "text", true),
        field("createdAt", "datetime", true),
      ], ["status", "severity", "createdAt"], ["alert references metric key"]),
      entity("report", [
        field("id", "uuid", true),
        field("name", "string", true),
        field("description", "text", false),
        field("metricKeys", "string", true),
        field("ownerId", "uuid", true),
        field("updatedAt", "datetime", true),
      ], ["ownerId", "updatedAt"], ["report contains metric keys"]),
    ],
    seeds: {
      metricSnapshot: [
        { id: "met_001", metricKey: "activation_rate", label: "Activation rate", value: 72, target: 80, capturedAt: "2026-05-15T12:00:00Z" },
        { id: "met_002", metricKey: "sla_risk", label: "SLA risk index", value: 6, target: 3, capturedAt: "2026-05-15T12:00:00Z" },
        { id: "met_003", metricKey: "support_csat", label: "Support CSAT", value: 4.6, target: 4.5, capturedAt: "2026-05-15T12:00:00Z" },
        { id: "met_004", metricKey: "mrr", label: "Monthly recurring revenue", value: 184500, target: 200000, capturedAt: "2026-05-15T12:00:00Z" },
        { id: "met_005", metricKey: "p95_latency_ms", label: "API p95 latency", value: 312, target: 250, capturedAt: "2026-05-15T12:00:00Z" },
        { id: "met_006", metricKey: "uptime_pct", label: "Uptime", value: 99.94, target: 99.9, capturedAt: "2026-05-15T12:00:00Z" },
      ],
      alert: [
        { id: "alrt_001", metricKey: "sla_risk", severity: "warning", status: "open", message: "SLA risk index above target for 3 consecutive days.", createdAt: "2026-05-13T08:05:00Z" },
        { id: "alrt_002", metricKey: "p95_latency_ms", severity: "critical", status: "acknowledged", message: "API p95 latency exceeded 300ms during peak window.", createdAt: "2026-05-14T19:42:00Z" },
        { id: "alrt_003", metricKey: "mrr", severity: "info", status: "open", message: "MRR pacing 8% below quarterly plan.", createdAt: "2026-05-15T06:00:00Z" },
        { id: "alrt_004", metricKey: "uptime_pct", severity: "info", status: "resolved", message: "Brief uptime regression cleared after deploy rollback.", createdAt: "2026-05-12T22:11:00Z" },
      ],
      report: [
        { id: "rep_001", name: "Weekly operations review", description: "Core operating metrics shared with leadership every Monday.", metricKeys: "activation_rate,sla_risk,support_csat", ownerId: "user_admin", updatedAt: "2026-05-15T13:00:00Z" },
        { id: "rep_002", name: "Customer experience scorecard", description: "Support CSAT and SLA performance for the customer success team.", metricKeys: "support_csat,sla_risk", ownerId: "user_admin", updatedAt: "2026-05-10T16:30:00Z" },
        { id: "rep_003", name: "Revenue pacing snapshot", description: "MRR trajectory against quarterly plan.", metricKeys: "mrr", ownerId: "user_admin", updatedAt: "2026-05-14T10:15:00Z" },
        { id: "rep_004", name: "Reliability summary", description: "Uptime and latency posture for the platform team.", metricKeys: "uptime_pct,p95_latency_ms", ownerId: "user_admin", updatedAt: "2026-05-15T09:45:00Z" },
      ],
    },
    acceptanceChecks: [
      "Private users can filter dashboard metrics without exposing admin settings.",
      "Alerts can move from open to acknowledged to resolved.",
      "Saved reports preserve selected metric keys and owner metadata.",
    ],
  },
  {
    id: "task_tracker",
    nameSuffix: "Task Tracker",
    summaryNoun: "task and project tracking workspace",
    keywords: [
      "task", "tasks", "todo", "todos", "kanban", "project", "projects", "issue",
      "issues", "ticket", "tickets", "sprint", "backlog", "assignment", "assignments",
    ],
    pages: [
      page("/login", "Sign in", "public", "Authenticate project members.", undefined, ["sign in"]),
      page("/tasks", "Tasks", "private", "Search, filter, and update work items.", "task", ["create task", "bulk update"]),
      page("/boards/:boardId", "Board", "private", "Move tasks through status columns.", "task", ["move status", "assign owner"]),
      page("/projects", "Projects", "private", "Manage project scope and progress.", "project", ["create project", "archive project"]),
      page("/tasks/:taskId", "Task detail", "private", "Review comments, metadata, and history.", "task", ["edit task", "add comment"]),
    ],
    components: [
      component("TaskTable", "list", ["/tasks"], ["filter tasks", "show priority and status"]),
      component("KanbanBoard", "list", ["/boards/:boardId"], ["group tasks by status", "move tasks"]),
      component("TaskEditor", "form", ["/tasks", "/tasks/:taskId"], ["validate required fields", "save task updates"]),
      component("ProjectProgress", "chart", ["/projects"], ["show completion count", "highlight blocked work"]),
      component("CommentThread", "detail", ["/tasks/:taskId"], ["show comments", "add updates"]),
    ],
    entities: [
      entity("project", [
        field("id", "uuid", true),
        field("name", "string", true),
        field("status", "enum", true, ["active", "paused", "archived"]),
        field("ownerId", "uuid", true),
        field("createdAt", "datetime", true),
      ], ["status", "ownerId"], ["project has many tasks"]),
      entity("task", [
        field("id", "uuid", true),
        field("projectId", "uuid", true, undefined, "project.id"),
        field("title", "string", true),
        field("description", "text", false),
        field("status", "enum", true, ["todo", "doing", "blocked", "done"]),
        field("priority", "enum", true, ["low", "medium", "high"]),
        field("assigneeId", "uuid", false),
      ], ["projectId", "status", "priority", "assigneeId"], ["task belongs to project", "task has many comments"]),
      entity("comment", [
        field("id", "uuid", true),
        field("taskId", "uuid", true, undefined, "task.id"),
        field("authorId", "uuid", true),
        field("body", "text", true),
        field("createdAt", "datetime", true),
      ], ["taskId", "createdAt"], ["comment belongs to task"]),
    ],
    seeds: {
      project: [
        { id: "prj_001", name: "Q2 product launch", status: "active", ownerId: "user_admin", createdAt: "2026-04-20T09:00:00Z" },
        { id: "prj_002", name: "Mobile app refresh", status: "active", ownerId: "user_pm", createdAt: "2026-03-10T11:00:00Z" },
        { id: "prj_003", name: "Customer onboarding redesign", status: "paused", ownerId: "user_design", createdAt: "2026-02-04T15:00:00Z" },
        { id: "prj_004", name: "Platform reliability hardening", status: "active", ownerId: "user_platform", createdAt: "2026-01-22T08:30:00Z" },
      ],
      task: [
        { id: "tsk_001", projectId: "prj_001", title: "Lock launch scope with marketing", description: "Confirm the feature list, messaging, and rollout date with the marketing leads.", status: "doing", priority: "high", assigneeId: "user_admin" },
        { id: "tsk_002", projectId: "prj_001", title: "Draft customer onboarding emails", description: "Write the welcome sequence and review with lifecycle.", status: "todo", priority: "medium", assigneeId: "user_pm" },
        { id: "tsk_003", projectId: "prj_002", title: "Audit accessibility on the new flows", description: "Run axe and keyboard checks on the redesigned screens.", status: "doing", priority: "high", assigneeId: "user_design" },
        { id: "tsk_004", projectId: "prj_002", title: "Wire up offline sync", description: "Resolve queued mutations when the device comes back online.", status: "blocked", priority: "high", assigneeId: "user_mobile" },
        { id: "tsk_005", projectId: "prj_004", title: "Migrate metrics to Prometheus", description: "Move the legacy StatsD pipeline to Prometheus with backfilled history.", status: "todo", priority: "medium", assigneeId: "user_platform" },
        { id: "tsk_006", projectId: "prj_004", title: "Document incident runbooks", description: "Refresh on-call runbooks for the top five paging alerts.", status: "done", priority: "low", assigneeId: "user_platform" },
      ],
      comment: [
        { id: "cmt_001", taskId: "tsk_001", authorId: "user_admin", body: "Scope locked at three core features; marketing is drafting the press hits.", createdAt: "2026-04-22T14:00:00Z" },
        { id: "cmt_002", taskId: "tsk_003", authorId: "user_design", body: "Found two focus-trap regressions on the modal stack; opening sub-tasks.", createdAt: "2026-05-08T16:20:00Z" },
        { id: "cmt_003", taskId: "tsk_004", authorId: "user_mobile", body: "Blocked on the conflict-resolution spec landing this week.", createdAt: "2026-05-11T10:45:00Z" },
        { id: "cmt_004", taskId: "tsk_006", authorId: "user_platform", body: "Runbooks merged; archived the obsolete pager wiki.", createdAt: "2026-05-14T18:05:00Z" },
      ],
    },
    acceptanceChecks: [
      "Users can create a task, assign an owner, and move it across board statuses.",
      "Project detail reflects task counts by status.",
      "Task comments persist in chronological order.",
    ],
  },
  {
    id: "customer_portal",
    nameSuffix: "Customer Portal",
    summaryNoun: "self-service customer workspace",
    keywords: [
      "portal", "self-service", "self service", "customer portal", "client portal",
      "request", "requests", "document", "documents", "invoice", "invoices", "customer login",
    ],
    pages: [
      page("/", "Portal welcome", "public", "Describe portal value and direct customers to sign in.", undefined, ["sign in"]),
      page("/portal", "Portal home", "private", "Show customer account status, requests, and documents.", "customer", ["review summary"]),
      page("/portal/requests", "Requests", "private", "Submit and track customer service requests.", "request", ["create request", "comment on request"]),
      page("/portal/documents", "Documents", "private", "Browse shared files and invoices.", "document", ["download document"]),
      page("/admin/customers", "Customer admin", "admin", "Manage customers and portal access.", "customer", ["invite customer", "disable access"]),
    ],
    components: [
      component("PortalShell", "layout", ["/portal", "/portal/requests", "/portal/documents"], ["render customer navigation", "show account context"]),
      component("RequestForm", "form", ["/portal/requests"], ["validate request category", "create service request"]),
      component("RequestList", "list", ["/portal", "/portal/requests"], ["show request status", "filter open requests"]),
      component("DocumentVault", "list", ["/portal/documents"], ["list shared documents", "separate invoices"]),
      component("AdminCustomerTable", "list", ["/admin/customers"], ["manage customer access", "show account status"]),
    ],
    entities: [
      entity("customer", [
        field("id", "uuid", true),
        field("name", "string", true),
        field("primaryEmail", "string", true),
        field("status", "enum", true, ["active", "invited", "disabled"]),
        field("createdAt", "datetime", true),
      ], ["status", "primaryEmail"], ["customer has many requests", "customer has many documents"]),
      entity("request", [
        field("id", "uuid", true),
        field("customerId", "uuid", true, undefined, "customer.id"),
        field("category", "string", true),
        field("subject", "string", true),
        field("status", "enum", true, ["open", "waiting", "resolved"]),
        field("createdAt", "datetime", true),
      ], ["customerId", "status", "createdAt"], ["request belongs to customer"]),
      entity("document", [
        field("id", "uuid", true),
        field("customerId", "uuid", true, undefined, "customer.id"),
        field("title", "string", true),
        field("kind", "enum", true, ["file", "invoice", "contract"]),
        field("url", "string", true),
        field("visibleToCustomer", "boolean", true),
      ], ["customerId", "kind"], ["document belongs to customer"]),
    ],
    seeds: {
      customer: [
        { id: "cus_001", name: "Acme Robotics", primaryEmail: "ops@acmerobotics.example", status: "active", createdAt: "2026-03-18T09:00:00Z" },
        { id: "cus_002", name: "Bluebird Health", primaryEmail: "portal@bluebirdhealth.example", status: "active", createdAt: "2026-02-22T11:15:00Z" },
        { id: "cus_003", name: "Cascade Logistics", primaryEmail: "billing@cascadelogistics.example", status: "invited", createdAt: "2026-05-02T08:00:00Z" },
        { id: "cus_004", name: "Summit Financial Group", primaryEmail: "ap@summit-fg.example", status: "active", createdAt: "2026-01-30T14:42:00Z" },
        { id: "cus_005", name: "Helix Biosciences", primaryEmail: "accounts@helixbio.example", status: "disabled", createdAt: "2025-12-04T10:00:00Z" },
      ],
      request: [
        { id: "req_001", customerId: "cus_001", category: "Billing", subject: "Update billing contact and PO number", status: "open", createdAt: "2026-05-12T10:00:00Z" },
        { id: "req_002", customerId: "cus_002", category: "Technical Support", subject: "SSO redirect loop after IdP rotation", status: "waiting", createdAt: "2026-05-13T14:30:00Z" },
        { id: "req_003", customerId: "cus_004", category: "Feature Request", subject: "Export quarterly summary as PDF", status: "open", createdAt: "2026-05-14T09:15:00Z" },
        { id: "req_004", customerId: "cus_001", category: "Account Change", subject: "Add three seats for the integrations team", status: "resolved", createdAt: "2026-05-08T16:05:00Z" },
        { id: "req_005", customerId: "cus_003", category: "Onboarding", subject: "Schedule kickoff and grant portal access", status: "open", createdAt: "2026-05-15T11:00:00Z" },
      ],
      document: [
        { id: "doc_001", customerId: "cus_001", title: "April 2026 invoice", kind: "invoice", url: "/files/acme-april-2026-invoice.pdf", visibleToCustomer: true },
        { id: "doc_002", customerId: "cus_002", title: "Master services agreement", kind: "contract", url: "/files/bluebird-msa-2026.pdf", visibleToCustomer: true },
        { id: "doc_003", customerId: "cus_004", title: "Q1 2026 usage report", kind: "file", url: "/files/summit-q1-2026-usage.pdf", visibleToCustomer: true },
        { id: "doc_004", customerId: "cus_001", title: "March 2026 invoice", kind: "invoice", url: "/files/acme-march-2026-invoice.pdf", visibleToCustomer: true },
        { id: "doc_005", customerId: "cus_003", title: "Onboarding playbook", kind: "file", url: "/files/cascade-onboarding-playbook.pdf", visibleToCustomer: false },
      ],
    },
    acceptanceChecks: [
      "Customers can only see requests and documents for their own account.",
      "Admins can invite or disable portal customers from the admin page.",
      "Private portal pages redirect unauthenticated visitors to sign in.",
    ],
  },
];

const PHASE_71_INTEGRATIONS: Phase71IntegrationDefinition[] = [
  {
    id: "openai",
    label: "OpenAI provider",
    envVars: ["OPENAI_API_KEY"],
    signals: [/\bopenai\b/i, /\bgpt\b/i, /\bmodel provider\b/i],
    flows: [
      "Route model-backed generation, summarization, or classification through the OpenAI provider adapter.",
      "Show provider setup status before live model calls while keeping draft screens usable.",
    ],
    setupGuidance: ["Set OPENAI_API_KEY or connect the OpenAI provider before enabling live model calls."],
  },
  {
    id: "anthropic",
    label: "Anthropic provider",
    envVars: ["ANTHROPIC_API_KEY"],
    signals: [/\banthropic\b/i, /\bclaude\b/i],
    flows: [
      "Route model-backed generation, summarization, or classification through the Anthropic provider adapter.",
      "Show provider setup status before live model calls while keeping draft screens usable.",
    ],
    setupGuidance: ["Set ANTHROPIC_API_KEY or connect the Anthropic provider before enabling live model calls."],
  },
  {
    id: "ollama",
    label: "Ollama local provider",
    envVars: ["OLLAMA_BASE_URL"],
    signals: [/\bollama\b/i, /\blocal model\b/i],
    flows: [
      "Route local model calls through the Ollama provider adapter.",
      "Expose the local base URL in setup guidance before live runs.",
    ],
    setupGuidance: ["Set OLLAMA_BASE_URL before enabling local model-backed flows."],
  },
  {
    id: "custom_api",
    label: "Custom API provider",
    envVars: ["CUSTOM_API_BASE_URL", "CUSTOM_API_KEY", "TASKLOOM_CUSTOM_API_BASE_URL", "TASKLOOM_CUSTOM_API_KEY"],
    signals: [/\bcustom api\b/i, /\bexternal api\b/i, /\bthird[- ]party api\b/i, /\brest api\b/i, /\bhttp api\b/i, /\bapi key\b/i],
    flows: [
      "Route custom REST or OpenAI-compatible API calls through server-side generated integration boundaries.",
      "Expose base URL and credential setup state before live custom API calls while keeping unrelated draft features usable.",
    ],
    setupGuidance: ["Set CUSTOM_API_BASE_URL plus CUSTOM_API_KEY, or the TASKLOOM_CUSTOM_API_* equivalents, before live custom API calls."],
  },
  {
    id: "slack_webhook",
    label: "Slack or webhook delivery",
    envVars: ["SLACK_WEBHOOK_URL", "WEBHOOK_SIGNING_SECRET"],
    signals: [/\bslack\b/i, /\bwebhook(s)?\b/i, /\binbound event(s)?\b/i],
    flows: [
      "Add an inbound webhook receiver for external events and signed payload validation.",
      "Send Slack or webhook notifications from workflow status changes.",
    ],
    setupGuidance: ["Set SLACK_WEBHOOK_URL for outbound Slack messages and WEBHOOK_SIGNING_SECRET for signed inbound events."],
  },
  {
    id: "email",
    label: "Email delivery",
    envVars: ["RESEND_API_KEY", "SENDGRID_API_KEY", "POSTMARK_TOKEN", "SMTP_URL"],
    signals: [/\bemail(s)?\b/i, /\bsmtp\b/i, /\bresend\b/i, /\bsendgrid\b/i, /\bpostmark\b/i],
    flows: [
      "Add queued email delivery for confirmations, receipts, invitations, or digests.",
      "Record delivery status and surface retry guidance when provider setup is missing.",
    ],
    setupGuidance: ["Configure RESEND_API_KEY, SENDGRID_API_KEY, POSTMARK_TOKEN, or SMTP_URL before sending live email."],
  },
  {
    id: "github",
    label: "GitHub connector",
    envVars: ["GITHUB_TOKEN", "GH_TOKEN"],
    signals: [/\bgithub\b/i, /\bgh\b/i, /\bpull request(s)?\b/i, /\bpr(s)?\b/i, /\brepo(sitory)?\b/i, /\bissue(s)?\b/i],
    flows: [
      "Add repository issue, pull request, commit, or sync actions behind a GitHub connector boundary.",
      "Scope repository operations to configured credentials and requested repos.",
    ],
    setupGuidance: ["Connect the GitHub connector or set GITHUB_TOKEN/GH_TOKEN before live repository actions."],
  },
  {
    id: "browser",
    label: "Browser automation",
    envVars: ["BROWSER_USE_API_KEY", "PLAYWRIGHT_BROWSERS_PATH"],
    signals: [/\bbrowser\b/i, /\bplaywright\b/i, /\bpuppeteer\b/i, /\bscrap(e|ing|er)\b/i, /\bcrawl(er|ing)?\b/i, /\bscreenshot\b/i],
    flows: [
      "Add server-side browser extraction or screenshot steps for approved target URLs.",
      "Capture target URL, rate-limit, and terms-of-use setup before live scraping.",
    ],
    setupGuidance: ["Enable browser-use or Playwright runtime settings before live browser extraction."],
  },
  {
    id: "stripe",
    label: "Stripe payments",
    envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"],
    signals: [/\bstripe\b/i, /\bpayment(s)?\b/i, /\bcheckout\b/i, /\bsubscription(s)?\b/i, /\binvoice(s)?\b/i, /\bbilling\b/i],
    flows: [
      "Add checkout, subscription, invoice, or customer portal flows through the Stripe connector.",
      "Add signed Stripe webhook handling for payment status updates.",
    ],
    setupGuidance: ["Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and any required STRIPE_PRICE_ID values before live payments."],
  },
  {
    id: "database",
    label: "Database runtime",
    envVars: ["DATABASE_URL", "TASKLOOM_DATABASE_URL", "TASKLOOM_MANAGED_DATABASE_URL"],
    signals: [/\bdatabase\b/i, /\bpostgres\b/i, /\bsql\b/i, /\bcrud\b/i, /\bpersist(s|ed|ence)?\b/i],
    flows: [
      "Persist generated records through the configured database runtime.",
      "Include migration, seed, and CRUD setup notes for deployment.",
    ],
    setupGuidance: ["Set DATABASE_URL, TASKLOOM_DATABASE_URL, or TASKLOOM_MANAGED_DATABASE_URL for persistent database-backed features."],
  },
];

export function generateAppDraftFromPrompt(prompt: string): AppDraft {
  const trimmed = (prompt ?? "").trim();
  if (trimmed.length < 8) {
    throw new Error("prompt must be at least 8 characters");
  }

  const template = chooseTemplate(trimmed);
  const appName = buildAppName(trimmed, template);
  const pageMap = clonePages(template.pages);
  const components = cloneComponents(template.components);
  const entities = cloneEntities(template.entities);
  const integrationMetadata = buildPhase71IntegrationMetadata(trimmed);
  const apiRouteStubs = buildApiRoutes(entities, pageMap, appSlug(appName));
  const auth = buildAuth(pageMap);

  return {
    prompt: trimmed,
    templateId: template.id,
    appName,
    summary: buildSummary(appName, trimmed, template),
    integrationMetadata,
    pageMap,
    components: applyIntegrationComponents(components, pageMap, integrationMetadata.requested),
    apiRouteStubs: applyIntegrationApiRoutes(apiRouteStubs, appSlug(appName), integrationMetadata.requested),
    dataSchema: {
      database: "postgres",
      entities,
      notes: [
        "Use uuid primary keys for generated records.",
        "Keep createdAt and updatedAt server-owned where present.",
        "Scope tenant/customer-owned rows before returning private data.",
        ...integrationMetadata.setupGuidance,
      ],
    },
    seedData: cloneSeedData(template.seeds),
    crudFlows: buildCrudFlows(entities),
    auth,
    acceptanceChecks: [
      `${appName} uses the ${template.summaryNoun} heuristic selected from the prompt.`,
      ...template.acceptanceChecks,
      ...integrationMetadata.requested.map((integration) => `${integration.label} setup guidance references ${integration.envVars.join(", ")} without blocking unrelated app features.`),
      "Generated API routes return validation errors for missing required fields.",
      "Generated seed data can render every primary page without empty states.",
    ],
  };
}

export function listAppDraftTemplateIds(): AppDraftTemplateId[] {
  return TEMPLATE_DEFINITIONS.map((entry) => entry.id);
}

// ---------------------------------------------------------------------------
// LLM-backed draft generation (Fork B: self-host, bring-your-own Anthropic key)
// ---------------------------------------------------------------------------
//
// generateAppDraftWithLLM is the orchestrator the streaming HTTP route calls.
// It tries the Anthropic-backed path first, then falls back to the synchronous
// template generator (generateAppDraftFromPrompt) so keyless installs still
// work. `emit` receives prose narration tokens while the model is thinking,
// which is what the chat UI streams into the bubble.
//
// generateAppDraftFromPrompt remains untouched in signature and behavior so
// the deterministic template path and its tests keep working.

export type AppDraftLLMPreset = ModelRoutingPresetId;

export interface AppDraftLLMOptions {
  preset?: AppDraftLLMPreset;
  /** Explicit model override (e.g. "claude-opus-4-7" for top-tier work). */
  model?: string;
  workspaceId?: string;
  signal?: AbortSignal;
  /**
   * Inject a pre-built provider (used by tests to mock the SDK). When set, the
   * router resolver is bypassed and this provider is used directly.
   */
  provider?: LLMProvider;
  /**
   * Backwards-compat shim for the test fixtures that injected an Anthropic SDK
   * factory directly. When set together with `apiKey`, a one-off
   * AnthropicProvider is instantiated locally (test-only path).
   */
  clientFactory?: AnthropicClientFactory;
  /** Force the API key (test-only when paired with `clientFactory`). */
  apiKey?: string;
}

export type AppDraftEmit = (text: string) => void | Promise<void>;

/**
 * Resolves a preset to a default Anthropic model name. Kept for backwards
 * compatibility (older callers may want a deterministic Anthropic model
 * string). The runtime path now goes through the preset resolver instead.
 */
export function modelForPreset(preset?: AppDraftLLMPreset, override?: string): string {
  if (override && override.trim().length > 0) return override.trim();
  switch (preset) {
    case "cheap":
      return "claude-haiku-4-5-20251001";
    case "smart":
    case "fast":
      return "claude-sonnet-4-6";
    case "local":
      // Local preset has no Anthropic equivalent; keep generation usable by
      // routing to the smallest hosted model.
      return "claude-haiku-4-5-20251001";
    default:
      return "claude-sonnet-4-6";
  }
}

/**
 * Internal: backwards-compat test path. Constructs a one-off AnthropicProvider
 * when the legacy `apiKey + clientFactory` test options are supplied. The
 * dynamic import keeps the `new AnthropicProvider` callsite out of the file's
 * main code path so the router-only design stays clean.
 */
async function legacyAnthropicProviderForTests(
  apiKey: string,
  clientFactory: AnthropicClientFactory,
): Promise<LLMProvider> {
  const mod = await import("./providers/anthropic.js");
  return new mod.AnthropicProvider({
    apiKeyResolver: async () => apiKey,
    clientFactory,
  }) as unknown as LLMProvider;
}

/**
 * Generates an AppDraft by streaming a structured `submit_app_draft` tool call
 * through whichever provider the preset resolver picks (Anthropic by default,
 * any of the 5 supported BYOK providers once keys are configured). Returns
 * `null` on any error (no key, network, malformed tool input) so the caller
 * can fall back to the template generator.
 */
export async function generateAppDraftViaLLM(
  prompt: string,
  options: AppDraftLLMOptions = {},
  emit?: AppDraftEmit,
): Promise<AppDraft | null> {
  const trimmed = (prompt ?? "").trim();
  if (trimmed.length < 8) return null;

  let provider: LLMProvider;
  let model: string;

  if (options.provider) {
    // Explicit provider injection (tests + future advanced callers).
    provider = options.provider;
    model = options.model ?? modelForPreset(options.preset);
  } else if (options.apiKey && options.clientFactory) {
    // Legacy test path: caller supplied an Anthropic SDK factory + key.
    provider = await legacyAnthropicProviderForTests(options.apiKey, options.clientFactory);
    model = options.model ?? modelForPreset(options.preset);
  } else {
    // Default runtime path: resolve preset → (provider, model) via the router.
    registerDefaultProviders();
    const resolved = resolvePresetToProviderModel(options.preset as ModelPreset | undefined, {
      ...(options.model ? { modelOverride: options.model } : {}),
    });
    if (!resolved) return null;
    const router = getDefaultRouter();
    const candidate = router.get(resolved.provider);
    if (!candidate) return null;
    provider = candidate;
    model = resolved.model;
  }

  let stream: AsyncIterable<ProviderStreamChunk>;
  try {
    stream = provider.stream({
      model,
      workspaceId: options.workspaceId ?? "app-builder",
      routeKey: "workflow.draft",
      maxTokens: 4096,
      temperature: 0.2,
      ...(options.signal ? { signal: options.signal } : {}),
      messages: [
        // System message is large + reused; provider adapters that support
        // prompt-caching will attach cache_control automatically.
        { role: "system", content: APP_BUILDER_SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
      tools: [
        {
          name: APP_BUILDER_TOOL_NAME,
          description: APP_BUILDER_TOOL_DESCRIPTION,
          inputSchema: APP_BUILDER_TOOL_INPUT_SCHEMA,
        },
      ],
    });
  } catch (error) {
    console.warn(`[app-builder-llm] stream init failed: ${(error as Error).message}`);
    return null;
  }

  let toolInput: Record<string, unknown> | null = null;
  let proseLength = 0;
  try {
    for await (const chunk of stream) {
      if (chunk.error) {
        console.warn(`[app-builder-llm] stream error: ${chunk.error}`);
        return null;
      }
      if (chunk.delta && emit) {
        try { await emit(chunk.delta); } catch { /* emit must not break generation */ }
        proseLength += chunk.delta.length;
      }
      if (chunk.toolCall && chunk.toolCall.name === APP_BUILDER_TOOL_NAME) {
        toolInput = chunk.toolCall.input ?? {};
      }
    }
  } catch (error) {
    console.warn(`[app-builder-llm] stream consume failed: ${(error as Error).message}`);
    return null;
  }

  if (!toolInput) {
    console.warn(`[app-builder-llm] model did not call ${APP_BUILDER_TOOL_NAME} (prose=${proseLength}b)`);
    return null;
  }

  try {
    return coerceLLMResultToAppDraft(trimmed, toolInput);
  } catch (error) {
    console.warn(`[app-builder-llm] coercion failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Result of the high-level draft generation entry point. The `source` field is
 * the discriminator:
 *   - `"template"` — fell back to the deterministic template generator.
 *   - `"llm"` — the structured tool-call path returned a draft.
 *   - `"llm-filetree"` — the opt-in Track B file-tree path returned a tree;
 *     the `files` array is the canonical source and `draft` is a derived view.
 *
 * Callers that only care about the AppDraft can keep ignoring `files`. The
 * Files / Smoke / publish surfaces that *do* care can switch on `source` to
 * decide whether to render the file tree directly.
 */
export type GenerateAppDraftResult = {
  draft: AppDraft;
  source: "llm" | "template" | "llm-filetree";
  files?: GeneratedFile[];
  /**
   * Populated when the opt-in Track B path ran and the build validator found
   * errors. Undefined otherwise. UI surfaces can render these inline so the
   * user can decide whether to ship or regenerate.
   */
  validationErrors?: string[];
};

/**
 * High-level entry point used by the streaming route: prefer the LLM path,
 * but always return a valid AppDraft by falling back to the deterministic
 * template generator when no key is configured or the LLM call fails.
 *
 * Track B file-tree codegen is now the **default** path: when a BYOK key is
 * present we try the file-tree orchestrator first. When it returns null
 * (BYOK provider not configured, model declined the task, etc.) we fall
 * through to the existing structured-tool path so keyless installs keep
 * working exactly as before.
 *
 * Env vars:
 *  - `TASKLOOM_LEGACY_TEMPLATES=1` is the opt-out / kill switch. When set,
 *    the file-tree path is skipped entirely and behaviour is identical to
 *    the pre-Track-B version (structured-tool → template).
 *  - `TASKLOOM_FILETREE_CODEGEN=1` is preserved as a documented **no-op**
 *    for backward compatibility with installs that still set it. It used
 *    to be the opt-in flag for the file-tree path; since that path is now
 *    on by default, the flag is harmless.
 */
export async function generateAppDraftWithLLM(
  prompt: string,
  options: AppDraftLLMOptions = {},
  emit?: AppDraftEmit,
): Promise<GenerateAppDraftResult> {
  // Default-on: try the file-tree path first unless the legacy escape
  // hatch is explicitly set. `TASKLOOM_FILETREE_CODEGEN` is preserved as a
  // no-op for backward compatibility with installs that set it; we only
  // gate on the new `TASKLOOM_LEGACY_TEMPLATES` opt-out.
  if (process.env.TASKLOOM_LEGACY_TEMPLATES !== "1") {
    const filetree = await tryFileTreeCodegen(prompt, options, emit);
    if (filetree) return filetree;
    // Orchestrator returned null (no BYOK key, model declined, etc.) —
    // fall through to the structured-tool path as before.
  }
  const llm = await generateAppDraftViaLLM(prompt, options, emit);
  if (llm) return { draft: llm, source: "llm" };
  return { draft: generateAppDraftFromPrompt(prompt), source: "template" };
}

/**
 * Track B file-tree path (now the default in `generateAppDraftWithLLM`):
 * ask the file-tree orchestrator to author a generated app as a list of
 * files, run the build validator, then project the file tree into an
 * AppDraft so all downstream consumers keep working.
 *
 * Returns null when the orchestrator declined (no BYOK key, model gave up,
 * etc.) so the caller can fall through to the existing structured-tool /
 * template paths. The legacy `TASKLOOM_FILETREE_CODEGEN=1` opt-in flag is
 * preserved as a no-op; the opt-out is `TASKLOOM_LEGACY_TEMPLATES=1`, which
 * is handled in `generateAppDraftWithLLM` before this function is called.
 *
 * Note: this code path's runtime behaviour depends on the real B1 / B2 / B3
 * modules under `src/codegen/`. With no BYOK key configured, the
 * orchestrator returns null and the caller falls through transparently.
 */
async function tryFileTreeCodegen(
  prompt: string,
  options: AppDraftLLMOptions,
  emit?: AppDraftEmit,
): Promise<GenerateAppDraftResult | null> {
  try {
    const workspaceId = options.workspaceId ?? "";
    const authorOptions: { preset?: ModelRoutingPresetId; workspaceId: string; signal?: AbortSignal } = { workspaceId };
    if (options.preset) authorOptions.preset = options.preset;
    if (options.signal) authorOptions.signal = options.signal;
    const noopEmit = (_: string) => {};
    const result = await authorAppViaLLM(prompt, authorOptions, emit ?? noopEmit);
    if (!result) return null;

    const validateOptions: { signal?: AbortSignal } = {};
    if (options.signal) validateOptions.signal = options.signal;
    const validation = await validateFileTree(result.files, validateOptions);

    // 1-retry policy: surface errors and let the caller decide. There is no
    // auto-fix loop in this skeleton — the LLM may have produced a tree that
    // does not compile, and we want the UI to show that rather than silently
    // ship something broken.
    if (!validation.ok && validation.source === "real") {
      console.warn(
        `[codegen] file-tree validation failed: ${validation.errors.length} error(s) in ${validation.durationMs}ms`,
      );
    }

    const draft = deriveDraftFromFiles(result.files, prompt, result.summary);
    const out: GenerateAppDraftResult = {
      draft,
      source: "llm-filetree",
      files: result.files,
    };
    if (!validation.ok && validation.source === "real" && validation.errors.length > 0) {
      out.validationErrors = validation.errors.map((e) => `${e.file}${e.line ? `:${e.line}` : ""}: ${e.message}`);
    }
    return out;
  } catch (error) {
    console.warn(`[codegen] file-tree path failed: ${(error as Error).message}`);
    return null;
  }
}

// --- Coercion of the streamed tool input into a strict AppDraft -------------

function coerceLLMResultToAppDraft(prompt: string, raw: Record<string, unknown>): AppDraft {
  const templateId = coerceTemplateId(raw.templateId);
  const pageMap = coercePageMap(raw.pageMap);
  const components = coerceComponents(raw.components);
  const apiRouteStubs = coerceApiRouteStubs(raw.apiRouteStubs);
  const dataSchema = coerceDataSchema(raw.dataSchema);
  const seedData = coerceSeedData(raw.seedData);
  const crudFlows = coerceCrudFlows(raw.crudFlows);
  const auth = coerceAuth(raw.auth, pageMap);
  const acceptanceChecks = coerceStringArray(raw.acceptanceChecks);
  const integrationMetadata = coerceIntegrationMetadata(raw.integrationMetadata);
  const appName = asString(raw.appName) || `${titleCase(prompt.split(/\s+/).slice(0, 2).join(" ") || "Workspace")} App`;
  const summary = asString(raw.summary) || `${appName} draft for: ${prompt}`;

  return {
    prompt,
    templateId,
    appName,
    summary,
    integrationMetadata,
    pageMap,
    components,
    apiRouteStubs,
    dataSchema,
    seedData,
    crudFlows,
    auth,
    acceptanceChecks,
  };
}

const TEMPLATE_IDS: AppDraftTemplateId[] = ["crm", "booking", "internal_dashboard", "task_tracker", "customer_portal"];

function coerceTemplateId(value: unknown): AppDraftTemplateId {
  return TEMPLATE_IDS.includes(value as AppDraftTemplateId) ? (value as AppDraftTemplateId) : "task_tracker";
}

function coerceAccess(value: unknown): RouteAccess {
  return value === "public" || value === "admin" ? value : "private";
}

function coercePageMap(value: unknown): PageDraft[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("pageMap must be a non-empty array");
  return value.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const draft: PageDraft = {
      path: asString(obj.path) || "/",
      name: asString(obj.name) || "Page",
      access: coerceAccess(obj.access),
      purpose: asString(obj.purpose) || "Page purpose.",
      actions: coerceStringArray(obj.actions),
    };
    const primary = asString(obj.primaryEntity);
    if (primary) draft.primaryEntity = primary;
    return draft;
  });
}

function coerceComponents(value: unknown): ComponentDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const typeValue = asString(obj.type);
    const type: ComponentDraft["type"] = (
      typeValue === "layout" || typeValue === "list" || typeValue === "form" || typeValue === "detail" || typeValue === "chart" || typeValue === "navigation"
        ? typeValue
        : "list"
    );
    return {
      name: asString(obj.name) || "Component",
      type,
      usedOn: coerceStringArray(obj.usedOn),
      responsibilities: coerceStringArray(obj.responsibilities),
    };
  });
}

function coerceApiRouteStubs(value: unknown): ApiRouteStub[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const methodValue = asString(obj.method).toUpperCase();
    const method: ApiRouteStub["method"] = (
      methodValue === "GET" || methodValue === "POST" || methodValue === "PATCH" || methodValue === "DELETE"
        ? methodValue
        : "GET"
    );
    const stub: ApiRouteStub = {
      method,
      path: asString(obj.path) || "/api/app/generated/unknown",
      access: coerceAccess(obj.access),
      purpose: asString(obj.purpose) || "API route purpose.",
      responseShape: asString(obj.responseShape) || "{ ok: true }",
    };
    const body = asString(obj.requestBody);
    if (body) stub.requestBody = body;
    return stub;
  });
}

function coerceDataSchema(value: unknown): DataSchemaDraft {
  const obj = (value ?? {}) as Record<string, unknown>;
  const entities = Array.isArray(obj.entities) ? obj.entities : [];
  return {
    database: "postgres",
    entities: entities.map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      return {
        name: asString(e.name) || "entity",
        primaryKey: asString(e.primaryKey) || "id",
        fields: coerceFields(e.fields),
        indexes: coerceStringArray(e.indexes),
        relations: coerceStringArray(e.relations),
      };
    }),
    notes: coerceStringArray(obj.notes),
  };
}

function coerceFields(value: unknown): FieldSchemaDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const typeValue = asString(obj.type);
    const type: FieldSchemaDraft["type"] = (
      typeValue === "uuid" || typeValue === "string" || typeValue === "text" || typeValue === "number"
        || typeValue === "boolean" || typeValue === "date" || typeValue === "datetime" || typeValue === "enum"
        ? typeValue
        : "string"
    );
    const field: FieldSchemaDraft = {
      name: asString(obj.name) || "field",
      type,
      required: obj.required === true,
    };
    if (Array.isArray(obj.enumValues)) {
      field.enumValues = (obj.enumValues as unknown[]).map((entryValue) => asString(entryValue)).filter((v) => v.length > 0);
    }
    const ref = asString(obj.references);
    if (ref) field.references = ref;
    return field;
  });
}

function coerceSeedData(value: unknown): Record<string, SeedRecord[]> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, SeedRecord[]> = {};
  for (const [key, rows] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue;
    out[key] = rows.map((row) => {
      const record: SeedRecord = {};
      if (row && typeof row === "object") {
        for (const [field, raw] of Object.entries(row as Record<string, unknown>)) {
          if (raw === null) { record[field] = null; continue; }
          if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
            record[field] = raw;
          } else {
            record[field] = JSON.stringify(raw);
          }
        }
      }
      return record;
    });
  }
  return out;
}

function coerceCrudFlows(value: unknown): CrudFlowDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      entity: asString(obj.entity) || "entity",
      create: coerceStringArray(obj.create),
      read: coerceStringArray(obj.read),
      update: coerceStringArray(obj.update),
      delete: coerceStringArray(obj.delete),
    };
  });
}

function coerceAuth(value: unknown, pages: PageDraft[]): AuthDraft {
  const obj = (value ?? {}) as Record<string, unknown>;
  const publicRoutes = coerceStringArray(obj.publicRoutes);
  const privateRoutes = coerceStringArray(obj.privateRoutes);
  const roleRoutesRaw = Array.isArray(obj.roleRoutes) ? obj.roleRoutes : [];
  const decisions = coerceStringArray(obj.decisions);

  const roleRoutes = roleRoutesRaw
    .map((entry) => {
      const r = (entry ?? {}) as Record<string, unknown>;
      return {
        role: "admin" as const,
        routes: coerceStringArray(r.routes),
        reason: asString(r.reason) || "Administrative pages require an admin role.",
      };
    })
    .filter((entry) => entry.routes.length > 0);

  // If the model omitted auth bucketing entirely, derive from pageMap so the
  // downstream generator does not see an empty auth surface.
  const hasAny = publicRoutes.length + privateRoutes.length + roleRoutes.length > 0;
  if (!hasAny) {
    return buildAuth(pages);
  }
  return {
    defaultPolicy: "authenticated-by-default",
    publicRoutes,
    privateRoutes,
    roleRoutes,
    decisions: decisions.length > 0 ? decisions : [
      "Only explicitly public pages can be viewed without a session.",
      "Private API routes require an authenticated workspace user.",
      "Admin routes require an admin role in addition to authentication.",
    ],
  };
}

function coerceIntegrationMetadata(value: unknown): Phase71IntegrationMetadata {
  const obj = (value ?? {}) as Record<string, unknown>;
  const requestedRaw = Array.isArray(obj.requested) ? obj.requested : [];
  const validIds: Phase71IntegrationId[] = ["openai", "anthropic", "ollama", "custom_api", "slack_webhook", "email", "github", "browser", "stripe", "database"];
  const requested = requestedRaw
    .map((entry) => {
      const r = (entry ?? {}) as Record<string, unknown>;
      const id = asString(r.id) as Phase71IntegrationId;
      if (!validIds.includes(id)) return null;
      return {
        id,
        label: asString(r.label) || id,
        envVars: coerceStringArray(r.envVars),
        flows: coerceStringArray(r.flows),
        setupGuidance: coerceStringArray(r.setupGuidance),
      } satisfies Phase71IntegrationDraft;
    })
    .filter((entry): entry is Phase71IntegrationDraft => entry !== null);
  const setupGuidance = coerceStringArray(obj.setupGuidance);
  return {
    requested,
    setupGuidance: setupGuidance.length > 0 ? setupGuidance : requested.flatMap((entry) => entry.setupGuidance),
  };
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter((entry) => entry.length > 0);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function generateAppSourceArtifactBundle(draft: AppDraft): GeneratedAppSourceArtifactBundle {
  const slug = appSlug(draft.appName);
  const pages = buildGeneratedPageData(draft);
  const apiRoutes = draft.apiRouteStubs.map((route) => ({
    method: route.method,
    path: route.path,
    access: route.access,
    authRequired: route.access !== "public",
    requiredRole: route.access === "admin" ? ("admin" as const) : undefined,
    purpose: route.purpose,
    requestBody: route.requestBody,
    responseShape: route.responseShape,
  }));
  const dataContracts = {
    database: draft.dataSchema.database,
    entities: draft.dataSchema.entities.map((entityDraft) => ({
      name: entityDraft.name,
      primaryKey: entityDraft.primaryKey,
      requiredFields: requiredFieldNames(entityDraft),
      editableFields: editableFieldNames(entityDraft),
      fields: entityDraft.fields,
      indexes: entityDraft.indexes,
      relations: entityDraft.relations,
    })),
    notes: draft.dataSchema.notes,
  };
  const routeSummary = {
    publicRoutes: draft.auth.publicRoutes,
    privateRoutes: draft.auth.privateRoutes,
    adminRoutes: draft.auth.roleRoutes.flatMap((entry) => entry.routes),
    decisions: draft.auth.decisions.map(generatedArtifactCopy),
  };

  const files = [
    sourceFile("package.json", "manifest", renderGeneratedPackageJson(slug)),
    sourceFile("index.html", "config", renderGeneratedIndexHtml(draft.appName)),
    sourceFile("tsconfig.json", "config", renderGeneratedTsConfig()),
    sourceFile("vite.config.ts", "config", renderGeneratedViteConfig()),
    sourceFile("src/main.tsx", "source", renderGeneratedMainTsx()),
    sourceFile("src/App.tsx", "source", renderGeneratedAppTsx(draft, pages, slug)),
    sourceFile("src/styles.css", "source", renderGeneratedStylesCss()),
    sourceFile("src/routes/page-data.ts", "route-data", renderGeneratedPageDataTs(pages, routeSummary)),
    sourceFile("src/api/generated-api.ts", "api", renderGeneratedApiTs(apiRoutes, dataContracts)),
    sourceFile("src/data/seed-data.json", "seed-data", JSON.stringify(draft.seedData, null, 2)),
    sourceFile("README.md", "documentation", renderGeneratedReadme(draft, pages, apiRoutes)),
  ];

  return {
    appName: draft.appName,
    appSlug: slug,
    templateId: draft.templateId,
    entrypoint: "src/App.tsx",
    files,
  };
}

export function detectPhase71Integrations(prompt: string): Phase71IntegrationDraft[] {
  const source = String(prompt ?? "");
  return PHASE_71_INTEGRATIONS
    .filter((integration) => integration.signals.some((signal) => signal.test(source)))
    .map(({ signals, ...integration }) => ({
      ...integration,
      envVars: [...integration.envVars],
      flows: [...integration.flows],
      setupGuidance: [...integration.setupGuidance],
    }));
}

function buildPhase71IntegrationMetadata(prompt: string): Phase71IntegrationMetadata {
  const requested = detectPhase71Integrations(prompt);
  return {
    requested,
    setupGuidance: requested.flatMap((integration) => integration.setupGuidance),
  };
}

function applyIntegrationComponents(
  components: ComponentDraft[],
  pages: PageDraft[],
  integrations: Phase71IntegrationDraft[],
): ComponentDraft[] {
  if (integrations.length === 0) return components;
  const targetPage = pages.find((entry) => entry.access !== "public")?.path ?? pages[0]?.path ?? "/";
  return [
    ...components,
    component(
      "IntegrationSetupPanel",
      "detail",
      [targetPage],
      integrations.map((integration) => `show ${integration.label} setup state for ${integration.envVars.join(", ")}`),
    ),
  ];
}

function applyIntegrationApiRoutes(
  routes: ApiRouteStub[],
  slug: string,
  integrations: Phase71IntegrationDraft[],
): ApiRouteStub[] {
  if (integrations.length === 0) return routes;
  const integrationRoutes = integrations.flatMap((integration): ApiRouteStub[] => [
    {
      method: "GET",
      path: `/api/app/generated/${slug}/integrations/${integration.id}/setup`,
      access: "private",
      purpose: `Check ${integration.label} setup state and required env vars: ${integration.envVars.join(", ")}.`,
      responseShape: "{ ready, missingEnvVars, setupGuidance }",
    },
    {
      method: "POST",
      path: `/api/app/generated/${slug}/integrations/${integration.id}/actions`,
      access: "private",
      purpose: `Run draft-safe ${integration.label} flow: ${integration.flows[0]}`,
      requestBody: "action, payload",
      responseShape: "{ queued, setupRequired, message }",
    },
  ]);
  return [...routes, ...integrationRoutes];
}

function chooseTemplate(prompt: string): TemplateDefinition {
  const lower = prompt.toLowerCase();
  let best = TEMPLATE_DEFINITIONS.find((entry) => entry.id === "task_tracker") ?? TEMPLATE_DEFINITIONS[0];
  let bestScore = 0;

  for (const template of TEMPLATE_DEFINITIONS) {
    const score = template.keywords.reduce((total, keyword) => {
      const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "gi");
      return total + Array.from(lower.matchAll(pattern)).length;
    }, 0);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }

  return best;
}

function buildAppName(prompt: string, template: TemplateDefinition): string {
  const suffixTokens = new Set(template.nameSuffix.toLowerCase().split(/\s+/).filter(Boolean));
  const domainWords = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => !template.keywords.includes(word))
    .filter((word) => !suffixTokens.has(word))
    .slice(0, 2);

  const prefix = domainWords.length > 0
    ? titleCase(domainWords.join(" "))
    : "Workspace";
  return `${prefix} ${template.nameSuffix}`;
}

function buildSummary(appName: string, prompt: string, template: TemplateDefinition): string {
  const source = prompt.replace(/\s+/g, " ");
  const clipped = source.length > 140 ? `${source.slice(0, 137).trim()}...` : source;
  return `${appName} is a deterministic ${template.summaryNoun} draft for: ${clipped}`;
}

function buildApiRoutes(entities: EntitySchemaDraft[], pages: PageDraft[], slug: string): ApiRouteStub[] {
  const adminEntities = new Set(pages.filter((entry) => entry.access === "admin" && entry.primaryEntity).map((entry) => entry.primaryEntity));
  const routes: ApiRouteStub[] = [];

  for (const entityDraft of entities) {
    const access: RouteAccess = adminEntities.has(entityDraft.name) ? "admin" : "private";
    const collectionPath = `/api/app/generated/${slug}/${kebabPlural(entityDraft.name)}`;
    routes.push({
      method: "GET",
      path: collectionPath,
      access,
      purpose: `List ${humanPlural(entityDraft.name)} with filters and pagination.`,
      responseShape: `${entityDraft.name}[]`,
    });
    routes.push({
      method: "POST",
      path: collectionPath,
      access,
      purpose: `Create a ${humanName(entityDraft.name)} after validating required fields.`,
      requestBody: requiredFieldNames(entityDraft).join(", "),
      responseShape: entityDraft.name,
    });
    routes.push({
      method: "GET",
      path: `${collectionPath}/:id`,
      access,
      purpose: `Fetch one ${humanName(entityDraft.name)} by id.`,
      responseShape: entityDraft.name,
    });
    routes.push({
      method: "PATCH",
      path: `${collectionPath}/:id`,
      access,
      purpose: `Update editable ${humanName(entityDraft.name)} fields.`,
      requestBody: editableFieldNames(entityDraft).join(", "),
      responseShape: entityDraft.name,
    });
    routes.push({
      method: "DELETE",
      path: `${collectionPath}/:id`,
      access,
      purpose: `Archive or delete a ${humanName(entityDraft.name)}.`,
      responseShape: "{ ok: true }",
    });
  }

  routes.unshift({
    method: "POST",
    path: `/api/public/generated/${slug}/auth/session`,
    access: "public",
    purpose: "Create an authenticated session for private app areas.",
    requestBody: "email, password",
    responseShape: "{ user, workspace, token }",
  });

  return routes;
}

function buildCrudFlows(entities: EntitySchemaDraft[]): CrudFlowDraft[] {
  return entities.map((entityDraft) => {
    const label = humanName(entityDraft.name);
    return {
      entity: entityDraft.name,
      create: [
        `Open the ${label} form from the relevant page action.`,
        `Validate required fields: ${requiredFieldNames(entityDraft).join(", ")}.`,
        `POST the payload and insert the returned ${label} into the current list.`,
      ],
      read: [
        `GET the ${label} collection for list views.`,
        `GET one ${label} by id for detail or edit views.`,
      ],
      update: [
        `PATCH changed editable fields: ${editableFieldNames(entityDraft).join(", ")}.`,
        "Refresh dependent list, detail, and summary components.",
      ],
      delete: [
        `Confirm destructive intent for the selected ${label}.`,
        `DELETE the ${label} by id, then remove it from visible lists.`,
      ],
    };
  });
}

function buildAuth(pages: PageDraft[]): AuthDraft {
  const publicRoutes = pages.filter((entry) => entry.access === "public").map((entry) => entry.path);
  const privateRoutes = pages.filter((entry) => entry.access === "private").map((entry) => entry.path);
  const adminRoutes = pages.filter((entry) => entry.access === "admin").map((entry) => entry.path);

  return {
    defaultPolicy: "authenticated-by-default",
    publicRoutes,
    privateRoutes,
    roleRoutes: adminRoutes.length > 0
      ? [{ role: "admin", routes: adminRoutes, reason: "Administration pages mutate shared configuration or customer access." }]
      : [],
    decisions: [
      "Only explicitly public pages can be viewed without a session.",
      "Private API routes require an authenticated workspace user.",
      "Admin routes require an admin role in addition to authentication.",
    ],
  };
}

function buildGeneratedPageData(draft: AppDraft) {
  return draft.pageMap.map((pageDraft) => ({
    route: pageDraft.path,
    name: pageDraft.name,
    access: pageDraft.access,
    purpose: pageDraft.purpose,
    primaryEntity: pageDraft.primaryEntity,
    actions: pageDraft.actions,
    components: draft.components
      .filter((componentDraft) => componentDraft.usedOn.includes(pageDraft.path))
      .map((componentDraft) => componentDraft.name),
  }));
}

function sourceFile(path: string, kind: GeneratedAppSourceFileKind, contents: string): GeneratedAppSourceFile {
  const normalized = normalizeGeneratedFileContents(contents);
  return {
    path,
    kind,
    contents: normalized,
    sizeBytes: Buffer.byteLength(normalized, "utf8"),
    checksum: createHash("sha256").update(normalized).digest("hex"),
  };
}

function normalizeGeneratedFileContents(contents: string): string {
  return `${contents.replace(/\r\n/g, "\n").replace(/\s+$/g, "")}\n`;
}

function renderGeneratedPackageJson(slug: string): string {
  return JSON.stringify({
    name: slug,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {
      "@vitejs/plugin-react": "^5.0.2",
      vite: "^7.1.3",
      typescript: "^5.9.2",
      react: "^19.1.1",
      "react-dom": "^19.1.1",
    },
    devDependencies: {},
  }, null, 2);
}

function renderGeneratedIndexHtml(appName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appName)}</title>
    <script src="https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

function renderGeneratedTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["DOM", "DOM.Iterable", "ES2022"],
      allowJs: false,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      forceConsistentCasingInFileNames: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
    },
    include: ["src"],
    references: [],
  }, null, 2);
}

function renderGeneratedViteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`;
}

function renderGeneratedMainTsx(): string {
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);`;
}

function renderGeneratedAppTsx(
  draft: AppDraft,
  pages: ReturnType<typeof buildGeneratedPageData>,
  slug: string,
): string {
  const primaryEntity = draft.dataSchema.entities[0]?.name ?? "record";
  const appName = JSON.stringify(draft.appName);
  const summary = JSON.stringify(draft.summary);
  const primaryEntityLiteral = JSON.stringify(primaryEntity);
  const appIdLiteral = JSON.stringify(slug);
  const pageCount = pages.length;

  return `import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRoutes, dataContracts } from "./api/generated-api";
import seedData from "./data/seed-data.json";
import { pages, routeAccess } from "./routes/page-data";
import "./styles.css";

type FieldType = "uuid" | "string" | "text" | "number" | "boolean" | "date" | "datetime" | "enum";
type FieldDef = {
  name: string;
  type: FieldType;
  required: boolean;
  enumValues?: string[];
  references?: string;
};
type EntityContract = {
  name: string;
  primaryKey: string;
  requiredFields: string[];
  editableFields: string[];
  fields: FieldDef[];
};
type Record = { [key: string]: string | number | boolean | null };
type SeedData = { [entity: string]: Record[] };
type SqlValue = string | number | null;
type SqlStatement = {
  bind: (values: SqlValue[]) => void;
  step: () => boolean;
  getAsObject: () => { [column: string]: SqlValue };
  free: () => void;
  run: (values?: SqlValue[]) => void;
};
type SqlDatabase = {
  run: (sql: string, params?: SqlValue[]) => void;
  exec: (sql: string) => Array<{ columns: string[]; values: SqlValue[][] }>;
  prepare: (sql: string) => SqlStatement;
  export: () => Uint8Array;
  close: () => void;
};
type SqlJsStatic = {
  Database: new (data?: Uint8Array) => SqlDatabase;
};
type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
declare global {
  interface Window {
    initSqlJs?: InitSqlJs;
  }
}

const appName = ${appName};
const summary = ${summary};
const primaryEntity = ${primaryEntityLiteral};
const appId = ${appIdLiteral};
const entities = dataContracts.entities as EntityContract[];
const typedSeedData = seedData as SeedData;

// Include a fingerprint of the schema in the storage key so that when the
// user iterates and changes entity fields, the next load doesn't silently
// reuse an old SQLite file whose tables are missing the new columns.
// (CREATE TABLE IF NOT EXISTS would otherwise be a no-op and inserts would
// fail or lose data.) Bumping the schema starts a clean DB; that's the
// right tradeoff for an unbundled preview where migrations aren't worth
// emitting from the LLM.
const schemaFingerprint = (() => {
  const stable = entities.map((e) => ({
    name: e.name,
    fields: (e.fields ?? []).map((f) => ({ name: f.name, type: f.type, enum: f.enumValues ?? null })),
  }));
  const text = JSON.stringify(stable);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).slice(0, 8);
})();
const storageKey = \`taskloom_app_\${appId}_db_\${schemaFingerprint}\`;

function sqlTypeForField(field: FieldDef): string {
  if (field.type === "number") return "REAL";
  if (field.type === "boolean") return "INTEGER";
  if (field.type === "enum" && field.enumValues && field.enumValues.length > 0) {
    const allowed = field.enumValues.map((value) => \`'\${value.replace(/'/g, "''")}'\`).join(", ");
    return \`TEXT CHECK(\${quoteIdent(field.name)} IN (\${allowed}))\`;
  }
  return "TEXT";
}

function quoteIdent(name: string): string {
  return \`"\${name.replace(/"/g, '""')}"\`;
}

function buildCreateTableSql(entity: EntityContract): string {
  const columnDefs = entity.fields.map((field) => {
    const parts: string[] = [quoteIdent(field.name), sqlTypeForField(field)];
    if (field.name === entity.primaryKey) parts.push("PRIMARY KEY");
    if (field.required && field.name !== entity.primaryKey) parts.push("NOT NULL");
    return parts.join(" ");
  });
  return \`CREATE TABLE IF NOT EXISTS \${quoteIdent(entity.name)} (\${columnDefs.join(", ")});\`;
}

function toSqlValue(field: FieldDef, raw: Record[keyof Record]): SqlValue {
  if (raw === null || raw === undefined) return null;
  if (field.type === "boolean") return raw ? 1 : 0;
  if (field.type === "number") {
    const numeric = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (typeof raw === "number") return raw;
  return String(raw);
}

function fromSqlValue(field: FieldDef, raw: SqlValue): Record[keyof Record] {
  if (raw === null || raw === undefined) return null;
  if (field.type === "boolean") return raw === 1 || raw === "1" || raw === "true";
  if (field.type === "number") {
    const numeric = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return typeof raw === "number" ? raw : String(raw);
}

function insertRow(db: SqlDatabase, entity: EntityContract, row: Record): void {
  const columns = entity.fields.map((field) => quoteIdent(field.name)).join(", ");
  const placeholders = entity.fields.map(() => "?").join(", ");
  const values = entity.fields.map((field) => toSqlValue(field, row[field.name] ?? null));
  db.run(\`INSERT OR REPLACE INTO \${quoteIdent(entity.name)} (\${columns}) VALUES (\${placeholders});\`, values);
}

function selectAll(db: SqlDatabase, entity: EntityContract): Record[] {
  const stmt = db.prepare(\`SELECT * FROM \${quoteIdent(entity.name)};\`);
  const rows: Record[] = [];
  try {
    while (stmt.step()) {
      const raw = stmt.getAsObject();
      const row: Record = {};
      entity.fields.forEach((field) => {
        row[field.name] = fromSqlValue(field, raw[field.name] ?? null);
      });
      rows.push(row);
    }
  } finally {
    stmt.free();
  }
  return rows;
}

function deleteRow(db: SqlDatabase, entity: EntityContract, id: SqlValue): void {
  db.run(\`DELETE FROM \${quoteIdent(entity.name)} WHERE \${quoteIdent(entity.primaryKey)} = ?;\`, [id]);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function base64ToUint8(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function persistDb(db: SqlDatabase): void {
  try {
    const data = db.export();
    window.localStorage.setItem(storageKey, uint8ToBase64(data));
  } catch (error) {
    console.warn("Failed to persist generated app database:", error);
  }
}

function seedDatabase(db: SqlDatabase): void {
  entities.forEach((entity) => {
    db.run(buildCreateTableSql(entity));
  });
  entities.forEach((entity) => {
    const rows = typedSeedData[entity.name] ?? [];
    rows.forEach((row) => insertRow(db, entity, row as Record));
  });
}

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (typeof window === "undefined" || !window.initSqlJs) {
    throw new Error("sql.js loader is not available on window.initSqlJs");
  }
  return window.initSqlJs({
    locateFile: (file: string) => \`https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/\${file}\`,
  });
}

type DbStatus = "loading" | "ready" | "error";

type UseLocalDbResult = {
  status: DbStatus;
  error: string | null;
  data: SeedData;
  insert: (entityName: string, row: Record) => void;
  remove: (entityName: string, id: string | number) => void;
  reset: () => void;
};

function useLocalDb(): UseLocalDbResult {
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [status, setStatus] = useState<DbStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SeedData>(() => {
    const initial: SeedData = {};
    entities.forEach((entity) => {
      initial[entity.name] = (typedSeedData[entity.name] ?? []).map((row) => ({ ...row }));
    });
    return initial;
  });

  const refresh = useCallback((instance: SqlDatabase) => {
    const next: SeedData = {};
    entities.forEach((entity) => {
      next[entity.name] = selectAll(instance, entity);
    });
    setData(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let instance: SqlDatabase | null = null;
    (async () => {
      try {
        const SQL = await loadSqlJs();
        let opened: SqlDatabase | null = null;
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          try {
            opened = new SQL.Database(base64ToUint8(stored));
            entities.forEach((entity) => opened?.run(buildCreateTableSql(entity)));
          } catch (loadError) {
            console.warn("Stored generated app database was corrupted; reseeding.", loadError);
            opened = null;
          }
        }
        if (!opened) {
          opened = new SQL.Database();
          seedDatabase(opened);
          persistDb(opened);
        }
        if (cancelled) {
          opened.close();
          return;
        }
        instance = opened;
        setDb(opened);
        refresh(opened);
        setStatus("ready");
      } catch (loadError) {
        if (cancelled) return;
        console.error("Failed to initialize local SQLite database:", loadError);
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      if (instance) instance.close();
    };
  }, [refresh]);

  const insert = useCallback((entityName: string, row: Record) => {
    if (!db) return;
    const entity = entities.find((entry) => entry.name === entityName);
    if (!entity) return;
    insertRow(db, entity, row);
    persistDb(db);
    refresh(db);
  }, [db, refresh]);

  const remove = useCallback((entityName: string, id: string | number) => {
    if (!db) return;
    const entity = entities.find((entry) => entry.name === entityName);
    if (!entity) return;
    deleteRow(db, entity, id);
    persistDb(db);
    refresh(db);
  }, [db, refresh]);

  const reset = useCallback(() => {
    if (!db) return;
    entities.forEach((entity) => {
      db.run(\`DELETE FROM \${quoteIdent(entity.name)};\`);
    });
    seedDatabase(db);
    persistDb(db);
    refresh(db);
  }, [db, refresh]);

  return { status, error, data, insert, remove, reset };
}

function generateRecordId(entityName: string): string {
  const prefix = entityName.slice(0, 3).toLowerCase() || "row";
  const random = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return \`\${prefix}_\${stamp}\${random}\`;
}

function emptyRowForEntity(entity: EntityContract): { [key: string]: string } {
  const initial: { [key: string]: string } = {};
  entity.fields.forEach((field) => {
    if (field.name === entity.primaryKey) return;
    if (field.type === "enum" && field.enumValues && field.enumValues.length > 0) {
      initial[field.name] = field.enumValues[0] ?? "";
    } else if (field.type === "boolean") {
      initial[field.name] = "false";
    } else {
      initial[field.name] = "";
    }
  });
  return initial;
}

function coerceFormValue(field: FieldDef, value: string): Record[keyof Record] {
  if (value === "" && !field.required) return null;
  if (field.type === "number") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (field.type === "boolean") return value === "true";
  return value;
}

function formatCellValue(value: Record[keyof Record]): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function EntityWorkbench({
  entity,
  rows,
  onCreate,
  onRemove,
}: {
  entity: EntityContract;
  rows: Record[];
  onCreate: (row: Record) => void;
  onRemove: (id: string | number) => void;
}) {
  const editableFields = useMemo(
    () => entity.fields.filter((field) => entity.editableFields.includes(field.name)),
    [entity],
  );
  const [draft, setDraft] = useState<{ [key: string]: string }>(() => emptyRowForEntity(entity));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (fieldName: string, value: string) => {
    setDraft((current) => ({ ...current, [fieldName]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const missing = entity.requiredFields.filter((name) => {
      if (name === entity.primaryKey) return false;
      const value = draft[name];
      return value === undefined || value === "";
    });
    if (missing.length > 0) {
      setErrorMessage(\`Missing required fields: \${missing.join(", ")}\`);
      return;
    }
    const row: Record = { [entity.primaryKey]: generateRecordId(entity.name) };
    entity.fields.forEach((field) => {
      if (field.name === entity.primaryKey) return;
      if (Object.prototype.hasOwnProperty.call(draft, field.name)) {
        row[field.name] = coerceFormValue(field, draft[field.name] ?? "");
      }
    });
    onCreate(row);
    setDraft(emptyRowForEntity(entity));
  };

  return (
    <article className="entity-workbench">
      <header>
        <h3>{entity.name}</h3>
        <span className="row-count">{rows.length} {rows.length === 1 ? "record" : "records"}</span>
      </header>

      <form onSubmit={handleSubmit} className="entity-form" aria-label={\`Create \${entity.name}\`}>
        <div className="entity-form-grid">
          {editableFields.map((field) => {
            const inputId = \`field-\${entity.name}-\${field.name}\`;
            const value = draft[field.name] ?? "";
            if (field.type === "enum" && field.enumValues && field.enumValues.length > 0) {
              return (
                <label key={field.name} htmlFor={inputId}>
                  <span>{field.name}{field.required ? " *" : ""}</span>
                  <select
                    id={inputId}
                    value={value}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                    required={field.required}
                  >
                    {field.enumValues.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              );
            }
            if (field.type === "boolean") {
              return (
                <label key={field.name} htmlFor={inputId}>
                  <span>{field.name}{field.required ? " *" : ""}</span>
                  <select
                    id={inputId}
                    value={value}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
              );
            }
            if (field.type === "text") {
              return (
                <label key={field.name} htmlFor={inputId} className="entity-form-wide">
                  <span>{field.name}{field.required ? " *" : ""}</span>
                  <textarea
                    id={inputId}
                    value={value}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                    rows={3}
                    required={field.required}
                  />
                </label>
              );
            }
            if (field.type === "date") {
              return (
                <label key={field.name} htmlFor={inputId}>
                  <span>{field.name}{field.required ? " *" : ""}</span>
                  <input
                    id={inputId}
                    type="date"
                    value={value}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                    required={field.required}
                  />
                </label>
              );
            }
            if (field.type === "datetime") {
              return (
                <label key={field.name} htmlFor={inputId}>
                  <span>{field.name}{field.required ? " *" : ""}</span>
                  <input
                    id={inputId}
                    type="datetime-local"
                    value={value}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                    required={field.required}
                  />
                </label>
              );
            }
            if (field.type === "number") {
              return (
                <label key={field.name} htmlFor={inputId}>
                  <span>{field.name}{field.required ? " *" : ""}</span>
                  <input
                    id={inputId}
                    type="number"
                    value={value}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                    required={field.required}
                  />
                </label>
              );
            }
            return (
              <label key={field.name} htmlFor={inputId}>
                <span>{field.name}{field.required ? " *" : ""}</span>
                <input
                  id={inputId}
                  type="text"
                  value={value}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  required={field.required}
                />
              </label>
            );
          })}
        </div>
        {errorMessage ? <p className="entity-form-error" role="alert">{errorMessage}</p> : null}
        <div className="entity-form-actions">
          <button type="submit">Save {entity.name}</button>
        </div>
      </form>

      <div className="entity-table-wrap">
        <table className="entity-table">
          <thead>
            <tr>
              {entity.fields.map((field) => (
                <th key={field.name}>{field.name}</th>
              ))}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={entity.fields.length + 1} className="entity-table-empty">No records yet.</td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const idValue = row[entity.primaryKey];
                const rowKey = idValue !== null && idValue !== undefined ? String(idValue) : \`row-\${index}\`;
                return (
                  <tr key={rowKey}>
                    {entity.fields.map((field) => (
                      <td key={field.name}>{formatCellValue(row[field.name] ?? null)}</td>
                    ))}
                    <td>
                      {idValue !== null && idValue !== undefined ? (
                        <button
                          type="button"
                          className="entity-row-remove"
                          onClick={() => onRemove(idValue as string | number)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function App() {
  const { status, error, data, insert, remove, reset } = useLocalDb();
  const totalRecords = useMemo(
    () => entities.reduce((sum, entity) => sum + (data[entity.name]?.length ?? 0), 0),
    [data],
  );

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <h1>{appName}</h1>
          <p>{summary}</p>
        </div>
        <dl className="hero-stats" aria-label="App summary">
          <div>
            <dt>Pages</dt>
            <dd>${pageCount}</dd>
          </div>
          <div>
            <dt>API routes</dt>
            <dd>{apiRoutes.length}</dd>
          </div>
          <div>
            <dt>Primary data</dt>
            <dd>{primaryEntity}</dd>
          </div>
        </dl>
      </header>

      <section className="layout-grid" aria-label="Generated app workspace">
        <nav className="panel route-nav" aria-label="Routes">
          <h2>Pages</h2>
          {pages.map((page) => (
            <a key={page.route} href={page.route}>
              <span>{page.name}</span>
              <small>{page.route}</small>
            </a>
          ))}
        </nav>

        <section className="panel page-list">
          <h2>Route Plan</h2>
          <div className="cards">
            {pages.map((page) => (
              <article key={page.route} className="page-card">
                <div>
                  <p className="access">{page.access}</p>
                  <h3>{page.name}</h3>
                </div>
                <p>{page.purpose}</p>
                <ul>
                  {page.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel data-panel">
          <h2>Data Contracts</h2>
          {entities.map((entity) => (
            <article key={entity.name}>
              <h3>{entity.name}</h3>
              <p>{entity.fields.length} fields, required: {entity.requiredFields.join(", ") || "none"}</p>
            </article>
          ))}

          <h2>Local Database</h2>
          <p className="db-status" data-status={status}>
            {status === "loading" ? "Loading local SQLite database…"
              : status === "ready" ? \`Persisted to localStorage. \${totalRecords} \${totalRecords === 1 ? "record" : "records"} on hand.\`
              : \`Database error: \${error ?? "unknown"}\`}
          </p>
          {status === "ready" ? (
            <button type="button" className="db-reset" onClick={reset}>
              Reset to seed data
            </button>
          ) : null}
        </aside>
      </section>

      <section className="panel workbench-panel" aria-label="Entity workbench">
        <h2>Workbench</h2>
        <p className="workbench-hint">
          Records persist to your browser via sql.js + localStorage. Refresh the page — your changes stay.
        </p>
        <div className="workbench-grid">
          {entities.map((entity) => (
            <EntityWorkbench
              key={entity.name}
              entity={entity}
              rows={data[entity.name] ?? []}
              onCreate={(row) => insert(entity.name, row)}
              onRemove={(id) => remove(entity.name, id)}
            />
          ))}
        </div>
      </section>

      <section className="panel api-panel">
        <h2>API Surface</h2>
        <div className="api-grid">
          {apiRoutes.map((route) => (
            <article key={\`\${route.method} \${route.path}\`}>
              <strong>{route.method}</strong>
              <code>{route.path}</code>
              <span>{route.authRequired ? route.requiredRole ?? "private" : "public"}</span>
            </article>
          ))}
        </div>
      </section>

      <footer>
        Route access policy: {routeAccess.decisions.join(" ")}
      </footer>
    </main>
  );
}`;
}

function renderGeneratedStylesCss(): string {
  return `:root {
  color: #172033;
  background: #f4f7f9;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}

.hero {
  align-items: end;
  background: #ffffff;
  border: 1px solid #d8e0e7;
  border-radius: 8px;
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 28px;
}

.eyebrow,
.access {
  color: #406176;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 8px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  font-size: 34px;
  line-height: 1.1;
  margin-bottom: 12px;
}

.hero-stats {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(88px, 1fr));
  margin: 0;
}

.hero-stats div,
.panel {
  background: #ffffff;
  border: 1px solid #d8e0e7;
  border-radius: 8px;
}

.hero-stats div {
  padding: 14px;
}

dt {
  color: #5f7180;
  font-size: 12px;
}

dd {
  font-size: 20px;
  font-weight: 800;
  margin: 4px 0 0;
}

.layout-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: 220px minmax(0, 1fr) 320px;
  margin-top: 20px;
}

.panel {
  padding: 20px;
}

.route-nav {
  align-content: start;
  display: grid;
  gap: 8px;
}

.route-nav a {
  border: 1px solid #e2e8ee;
  border-radius: 6px;
  display: grid;
  gap: 4px;
  padding: 10px;
}

small,
code {
  color: #607487;
}

.cards,
.api-grid {
  display: grid;
  gap: 12px;
}

.page-card {
  border: 1px solid #e2e8ee;
  border-radius: 6px;
  padding: 14px;
}

.page-card ul {
  margin-bottom: 0;
  padding-left: 20px;
}

.data-panel article {
  border-top: 1px solid #e2e8ee;
  padding-top: 12px;
}

.api-panel {
  margin-top: 20px;
}

.api-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.api-grid article {
  align-items: center;
  border: 1px solid #e2e8ee;
  border-radius: 6px;
  display: grid;
  gap: 8px;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  padding: 12px;
}

footer {
  color: #607487;
  margin-top: 20px;
}

.workbench-panel {
  margin-top: 20px;
}

.workbench-hint {
  color: #5f7180;
  margin-bottom: 16px;
}

.workbench-grid {
  display: grid;
  gap: 16px;
}

.entity-workbench {
  border: 1px solid #e2e8ee;
  border-radius: 8px;
  padding: 16px;
}

.entity-workbench header {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.entity-workbench header h3 {
  margin: 0;
  text-transform: capitalize;
}

.row-count {
  color: #5f7180;
  font-size: 12px;
}

.entity-form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.entity-form-grid label {
  display: grid;
  font-size: 12px;
  gap: 4px;
}

.entity-form-grid label.entity-form-wide {
  grid-column: 1 / -1;
}

.entity-form-grid input,
.entity-form-grid select,
.entity-form-grid textarea {
  background: #f7fafc;
  border: 1px solid #d8e0e7;
  border-radius: 6px;
  font: inherit;
  padding: 8px 10px;
}

.entity-form-grid textarea {
  min-height: 64px;
  resize: vertical;
}

.entity-form-actions {
  margin-top: 12px;
}

.entity-form-actions button {
  background: #1f3a5f;
  border: 0;
  border-radius: 6px;
  color: #ffffff;
  cursor: pointer;
  font-weight: 600;
  padding: 8px 14px;
}

.entity-form-actions button:hover {
  background: #294a78;
}

.entity-form-error {
  color: #b3261e;
  font-size: 12px;
  margin: 8px 0 0;
}

.entity-table-wrap {
  margin-top: 14px;
  max-height: 320px;
  overflow: auto;
}

.entity-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}

.entity-table th,
.entity-table td {
  border-bottom: 1px solid #eef2f5;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.entity-table th {
  background: #f7fafc;
  font-size: 11px;
  letter-spacing: 0.04em;
  position: sticky;
  text-transform: uppercase;
  top: 0;
}

.entity-table-empty {
  color: #5f7180;
  font-style: italic;
  text-align: center;
}

.entity-row-remove {
  background: transparent;
  border: 1px solid #d8e0e7;
  border-radius: 6px;
  color: #b3261e;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
}

.entity-row-remove:hover {
  background: #fdecea;
}

.db-status {
  font-size: 13px;
  margin-bottom: 12px;
}

.db-status[data-status="error"] {
  color: #b3261e;
}

.db-reset {
  background: #ffffff;
  border: 1px solid #d8e0e7;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  padding: 6px 10px;
}

@media (max-width: 980px) {
  .app-shell {
    padding: 18px;
  }

  .hero,
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }
}`;
}

function renderGeneratedPageDataTs(
  pages: ReturnType<typeof buildGeneratedPageData>,
  routeSummary: {
    publicRoutes: string[];
    privateRoutes: string[];
    adminRoutes: string[];
    decisions: string[];
  },
): string {
  return `export type GeneratedPageAccess = "public" | "private" | "admin";

export type GeneratedPage = {
  route: string;
  name: string;
  access: GeneratedPageAccess;
  purpose: string;
  primaryEntity?: string;
  actions: string[];
  components: string[];
};

export const pages: GeneratedPage[] = ${JSON.stringify(pages, null, 2)};

export const routeAccess = ${JSON.stringify(routeSummary, null, 2)};`;
}

function renderGeneratedApiTs(
  apiRoutes: Array<{
    method: ApiRouteStub["method"];
    path: string;
    access: RouteAccess;
    authRequired: boolean;
    requiredRole?: "admin";
    purpose: string;
    requestBody?: string;
    responseShape: string;
  }>,
  dataContracts: {
    database: DataSchemaDraft["database"];
    entities: Array<{
      name: string;
      primaryKey: string;
      requiredFields: string[];
      editableFields: string[];
      fields: FieldSchemaDraft[];
      indexes: string[];
      relations: string[];
    }>;
    notes: string[];
  },
): string {
  return `import seedData from "../data/seed-data.json";

export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type RouteAccess = "public" | "private" | "admin";

export type GeneratedApiRoute = {
  method: ApiMethod;
  path: string;
  access: RouteAccess;
  authRequired: boolean;
  requiredRole?: "admin";
  purpose: string;
  requestBody?: string;
  responseShape: string;
};

export const apiRoutes: GeneratedApiRoute[] = ${JSON.stringify(apiRoutes, null, 2)};

export const dataContracts = ${JSON.stringify(dataContracts, null, 2)};

type SeedData = Record<string, Array<Record<string, string | number | boolean | null>>>;
type ApiRequest = {
  method: ApiMethod;
  path: string;
  body?: Record<string, unknown>;
};

const records = seedData as SeedData;

export async function handleGeneratedApiRequest(request: ApiRequest) {
  const route = apiRoutes.find((candidate) => (
    candidate.method === request.method && routeMatches(candidate.path, request.path)
  ));

  if (!route) {
    return { status: 404, body: { error: "No generated API route matches this request." } };
  }

  const entityName = entityFromRoute(route.path);
  const entityRecords = entityName ? records[entityName] ?? [] : [];

  if (request.method === "GET") {
    return { status: 200, body: route.path.includes("/:id") ? entityRecords[0] ?? null : entityRecords };
  }

  const contract = dataContracts.entities.find((entity) => entity.name === entityName);
  const missingFields = contract
    ? contract.requiredFields.filter((field) => request.body?.[field] === undefined || request.body?.[field] === "")
    : [];

  if (missingFields.length > 0) {
    return { status: 400, body: { error: "Missing required fields.", missingFields } };
  }

  if (contract) {
    const enumErrors: Array<{ field: string; allowed: string[] }> = [];
    for (const field of contract.fields) {
      if (field.type !== "enum" || !field.enumValues || field.enumValues.length === 0) continue;
      const provided = request.body?.[field.name];
      if (provided === undefined || provided === null || provided === "") continue;
      if (!field.enumValues.includes(String(provided))) {
        enumErrors.push({ field: field.name, allowed: field.enumValues });
      }
    }
    if (enumErrors.length > 0) {
      return { status: 400, body: { error: "Invalid enum values.", enumErrors } };
    }
  }

  return {
    status: request.method === "POST" ? 201 : 200,
    body: {
      ok: true,
      route: route.path,
      entity: entityName,
      received: request.body ?? {},
    },
  };
}

function routeMatches(routePattern: string, requestPath: string) {
  const expression = new RegExp(\`^\${routePattern.replace(/:[^/]+/g, "[^/]+")}$\`);
  return expression.test(requestPath);
}

function entityFromRoute(path: string) {
  const segment = path.split("/").filter(Boolean).at(-1) === ":id"
    ? path.split("/").filter(Boolean).at(-2)
    : path.split("/").filter(Boolean).at(-1);
  if (!segment || segment === "session" || segment === "setup" || segment === "actions") return undefined;
  const normalized = segment.replace(/-/g, "").replace(/s$/, "");
  return dataContracts.entities.find((entity) => entity.name.toLowerCase() === normalized.toLowerCase())?.name;
}`;
}

function renderGeneratedReadme(
  draft: AppDraft,
  pages: ReturnType<typeof buildGeneratedPageData>,
  apiRoutes: Array<{ method: ApiRouteStub["method"]; path: string; access: RouteAccess; responseShape: string }>,
): string {
  const pageLines = pages.map((pageDraft) => `- ${pageDraft.name} (${pageDraft.route}) - ${pageDraft.access}: ${pageDraft.purpose}`);
  const apiLines = apiRoutes.map((route) => `- ${route.method} ${route.path} - ${route.access}, returns ${route.responseShape}`);
  const dataLines = draft.dataSchema.entities.map((entityDraft) => `- ${entityDraft.name}: ${entityDraft.fields.map((fieldDraft) => fieldDraft.name).join(", ")}`);

  return `# ${draft.appName}

${draft.summary}

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

## Pages

${pageLines.join("\n")}

## API

${apiLines.join("\n")}

## Data

${dataLines.join("\n")}

Seed records live in \`src/data/seed-data.json\` and are loaded by the UI and API handler.

## Acceptance Checks

${draft.acceptanceChecks.map((check) => `- ${generatedArtifactCopy(check)}`).join("\n")}`;
}

function page(
  path: string,
  name: string,
  access: RouteAccess,
  purpose: string,
  primaryEntity: string | undefined,
  actions: string[],
): PageDraft {
  return { path, name, access, purpose, primaryEntity, actions };
}

function component(
  name: string,
  type: ComponentDraft["type"],
  usedOn: string[],
  responsibilities: string[],
): ComponentDraft {
  return { name, type, usedOn, responsibilities };
}

function entity(
  name: string,
  fields: FieldSchemaDraft[],
  indexes: string[],
  relations: string[],
): EntitySchemaDraft {
  return { name, primaryKey: "id", fields, indexes, relations };
}

function field(
  name: string,
  type: FieldSchemaDraft["type"],
  required: boolean,
  enumValues?: string[],
  references?: string,
): FieldSchemaDraft {
  return { name, type, required, enumValues, references };
}

function clonePages(pages: PageDraft[]): PageDraft[] {
  return pages.map((entry) => ({ ...entry, actions: [...entry.actions] }));
}

function cloneComponents(components: ComponentDraft[]): ComponentDraft[] {
  return components.map((entry) => ({
    ...entry,
    usedOn: [...entry.usedOn],
    responsibilities: [...entry.responsibilities],
  }));
}

function cloneEntities(entities: EntitySchemaDraft[]): EntitySchemaDraft[] {
  return entities.map((entry) => ({
    ...entry,
    fields: entry.fields.map((fieldDraft) => ({
      ...fieldDraft,
      enumValues: fieldDraft.enumValues ? [...fieldDraft.enumValues] : undefined,
    })),
    indexes: [...entry.indexes],
    relations: [...entry.relations],
  }));
}

function cloneSeedData(seedData: Record<string, SeedRecord[]>): Record<string, SeedRecord[]> {
  return Object.fromEntries(
    Object.entries(seedData).map(([key, records]) => [
      key,
      records.map((record) => ({ ...record })),
    ]),
  );
}

function requiredFieldNames(entityDraft: EntitySchemaDraft): string[] {
  return entityDraft.fields.filter((entry) => entry.required && entry.name !== "id").map((entry) => entry.name);
}

function editableFieldNames(entityDraft: EntitySchemaDraft): string[] {
  return entityDraft.fields.filter((entry) => entry.name !== "id" && !entry.name.endsWith("At")).map((entry) => entry.name);
}

function kebabPlural(value: string): string {
  return `${value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).toLowerCase()}s`;
}

function appSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "generated-app";
}

function humanName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).toLowerCase();
}

function humanPlural(value: string): string {
  return `${humanName(value)}s`;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generatedArtifactCopy(value: string): string {
  return value
    .replace(/\bAPI route stubs\b/gi, "API routes")
    .replace(/\broute stubs\b/gi, "routes")
    .replace(/\bstubs\b/gi, "routes")
    .replace(/\bstub\b/gi, "route");
}
