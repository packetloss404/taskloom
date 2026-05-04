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
        { id: "acc_001", name: "Northstar Labs", industry: "Software", ownerId: "user_admin", status: "active", createdAt: "2026-01-05T09:00:00Z" },
        { id: "acc_002", name: "Bluebird Health", industry: "Healthcare", ownerId: "user_admin", status: "prospect", createdAt: "2026-01-11T10:30:00Z" },
      ],
      lead: [
        { id: "lead_001", name: "Morgan Lee", email: "morgan@example.com", source: "web", score: 82, status: "qualified" },
        { id: "lead_002", name: "Ari Patel", email: "ari@example.com", source: "referral", score: 64, status: "new" },
      ],
      deal: [
        { id: "deal_001", accountId: "acc_001", title: "Team expansion", stage: "proposal", value: 24000, closeDate: "2026-06-15" },
        { id: "deal_002", accountId: "acc_002", title: "Pilot rollout", stage: "discovery", value: 9000, closeDate: "2026-07-01" },
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
      ],
      provider: [
        { id: "pro_001", name: "Jamie Rivera", email: "jamie@example.com", timezone: "America/Chicago", active: true },
        { id: "pro_002", name: "Sam Chen", email: "sam@example.com", timezone: "America/Chicago", active: true },
      ],
      appointment: [
        { id: "apt_001", serviceId: "svc_001", providerId: "pro_001", customerName: "Taylor Quinn", customerEmail: "taylor@example.com", startsAt: "2026-05-12T15:00:00Z", status: "confirmed" },
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
        { id: "met_001", metricKey: "activation_rate", label: "Activation rate", value: 72, target: 80, capturedAt: "2026-05-01T12:00:00Z" },
        { id: "met_002", metricKey: "sla_risk", label: "SLA risk", value: 6, target: 3, capturedAt: "2026-05-01T12:00:00Z" },
      ],
      alert: [
        { id: "alrt_001", metricKey: "sla_risk", severity: "warning", status: "open", message: "SLA risk above target", createdAt: "2026-05-01T12:05:00Z" },
      ],
      report: [
        { id: "rep_001", name: "Weekly operations review", description: "Core operating metrics for leadership.", metricKeys: "activation_rate,sla_risk", ownerId: "user_admin", updatedAt: "2026-05-01T13:00:00Z" },
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
        { id: "prj_001", name: "Launch checklist", status: "active", ownerId: "user_admin", createdAt: "2026-04-20T09:00:00Z" },
      ],
      task: [
        { id: "tsk_001", projectId: "prj_001", title: "Confirm beta scope", description: "Lock the first release checklist.", status: "doing", priority: "high", assigneeId: "user_admin" },
        { id: "tsk_002", projectId: "prj_001", title: "Draft onboarding notes", description: "Prepare customer-facing setup notes.", status: "todo", priority: "medium", assigneeId: "user_admin" },
      ],
      comment: [
        { id: "cmt_001", taskId: "tsk_001", authorId: "user_admin", body: "Scope review is in progress.", createdAt: "2026-04-22T14:00:00Z" },
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
        { id: "cus_001", name: "Acme Support Co", primaryEmail: "admin@acme.example", status: "active", createdAt: "2026-03-18T09:00:00Z" },
      ],
      request: [
        { id: "req_001", customerId: "cus_001", category: "Support", subject: "Update billing contact", status: "open", createdAt: "2026-05-02T10:00:00Z" },
      ],
      document: [
        { id: "doc_001", customerId: "cus_001", title: "April invoice", kind: "invoice", url: "/files/april-invoice.pdf", visibleToCustomer: true },
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
      "API route stubs return validation errors for missing required fields.",
      "Generated seed data can render every primary page without empty states.",
    ],
  };
}

export function listAppDraftTemplateIds(): AppDraftTemplateId[] {
  return TEMPLATE_DEFINITIONS.map((entry) => entry.id);
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
  const domainWords = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => !template.keywords.includes(word))
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
      "Private API stubs require an authenticated workspace user.",
      "Admin routes require an admin role in addition to authentication.",
    ],
  };
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
