import assert from "node:assert/strict";
import test from "node:test";
import {
  generateAppDraftFromPrompt,
  listAppDraftTemplateIds,
} from "./app-builder-service";

test("generateAppDraftFromPrompt rejects short prompts", () => {
  assert.throws(() => generateAppDraftFromPrompt("tiny"), /at least 8 characters/);
});

test("generateAppDraftFromPrompt returns deterministic CRM draft", () => {
  const prompt = "Build a CRM for boutique sales teams to track leads, accounts, deals, and pipeline follow-up.";

  const first = generateAppDraftFromPrompt(prompt);
  const second = generateAppDraftFromPrompt(prompt);

  assert.deepEqual(first, second);
  assert.equal(first.templateId, "crm");
  assert.ok(first.appName.includes("CRM"));
  assert.ok(first.pageMap.some((page) => page.path === "/crm/deals/:dealId"));
  assert.ok(first.components.some((component) => component.name === "PipelineBoard"));
  assert.ok(first.dataSchema.entities.some((entity) => entity.name === "deal"));
  assert.ok(first.seedData.deal.length > 0);
  assert.ok(first.crudFlows.some((flow) => flow.entity === "lead"));
  assert.ok(first.apiRouteStubs.some((route) => route.method === "POST" && route.path.includes("/api/app/generated/") && route.path.endsWith("/deals")));
});

test("booking heuristic exposes public booking and admin service management", () => {
  const draft = generateAppDraftFromPrompt(
    "Create a booking app for clinics with providers, appointment slots, calendar scheduling, and reservations.",
  );

  assert.equal(draft.templateId, "booking");
  assert.ok(draft.auth.publicRoutes.includes("/book"));
  assert.ok(draft.auth.roleRoutes[0].routes.includes("/settings/services"));
  assert.ok(draft.dataSchema.entities.some((entity) => entity.name === "appointment"));
  assert.ok(draft.apiRouteStubs.some((route) => route.path.includes("/api/app/generated/") && route.path.endsWith("/appointments/:id")));
  assert.ok(draft.acceptanceChecks.some((check) => check.includes("prevents two confirmed appointments")));
});

test("internal dashboard heuristic includes metrics, reports, alerts, and private dashboard", () => {
  const draft = generateAppDraftFromPrompt(
    "Ship an internal dashboard for operations KPIs, reports, monitoring alerts, and weekly analytics.",
  );

  assert.equal(draft.templateId, "internal_dashboard");
  assert.ok(draft.auth.privateRoutes.includes("/dashboard"));
  assert.ok(!draft.auth.publicRoutes.includes("/dashboard"));
  assert.ok(draft.components.some((component) => component.name === "KpiGrid"));
  assert.deepEqual(
    draft.dataSchema.entities.map((entity) => entity.name),
    ["metricSnapshot", "alert", "report"],
  );
});

test("task tracker is the fallback and includes project task comment CRUD", () => {
  const draft = generateAppDraftFromPrompt(
    "Help our product team coordinate weekly launch work, owners, blockers, and release follow-ups.",
  );

  assert.equal(draft.templateId, "task_tracker");
  assert.ok(draft.pageMap.some((page) => page.path === "/boards/:boardId"));
  assert.deepEqual(
    draft.crudFlows.map((flow) => flow.entity),
    ["project", "task", "comment"],
  );
  assert.ok(draft.seedData.task.length >= 2);
});

test("customer portal heuristic keeps portal pages private and admin customer controls role-gated", () => {
  const draft = generateAppDraftFromPrompt(
    "Create a customer portal with self-service requests, documents, invoices, and customer login.",
  );

  assert.equal(draft.templateId, "customer_portal");
  assert.ok(draft.auth.publicRoutes.includes("/"));
  assert.ok(draft.auth.privateRoutes.includes("/portal/documents"));
  assert.ok(draft.auth.roleRoutes.some((entry) => entry.routes.includes("/admin/customers")));
  assert.ok(draft.dataSchema.entities.some((entity) => entity.name === "document"));
  assert.ok(draft.acceptanceChecks.some((check) => check.includes("own account")));
});

test("phase 71 integration prompts add setup metadata without changing core app generation", () => {
  const draft = generateAppDraftFromPrompt(
    "Build a customer portal with Stripe checkout, GitHub issue sync, Slack webhook alerts, email receipts, and Postgres persistence.",
  );

  assert.equal(draft.templateId, "customer_portal");
  assert.ok(draft.pageMap.some((page) => page.path === "/portal/requests"));
  assert.deepEqual(
    draft.integrationMetadata.requested.map((integration) => integration.id),
    ["slack_webhook", "email", "github", "stripe", "database"],
  );
  assert.ok(draft.integrationMetadata.setupGuidance.some((entry) => entry.includes("STRIPE_SECRET_KEY")));
  assert.ok(draft.components.some((component) => component.name === "IntegrationSetupPanel"));
  assert.ok(draft.apiRouteStubs.some((route) => route.path.endsWith("/integrations/github/setup") && route.purpose.includes("GITHUB_TOKEN")));
  assert.ok(draft.apiRouteStubs.some((route) => route.path.endsWith("/integrations/stripe/actions") && route.purpose.includes("Stripe")));
  assert.ok(draft.dataSchema.notes.some((note) => note.includes("TASKLOOM_DATABASE_URL")));
  assert.ok(draft.acceptanceChecks.some((check) => check.includes("without blocking unrelated app features")));
});

test("phase 71 custom API prompts add generated setup routes and env guidance", () => {
  const draft = generateAppDraftFromPrompt(
    "Build an internal dashboard that calls a custom external REST API with an API key and stores returned records.",
  );

  assert.ok(draft.integrationMetadata.requested.some((integration) => integration.id === "custom_api"));
  assert.ok(draft.integrationMetadata.setupGuidance.some((entry) => entry.includes("CUSTOM_API_BASE_URL")));
  assert.ok(draft.apiRouteStubs.some((route) => route.path.endsWith("/integrations/custom_api/setup") && route.purpose.includes("CUSTOM_API_KEY")));
  assert.ok(draft.acceptanceChecks.some((check) => check.includes("Custom API provider setup guidance")));
});

test("listAppDraftTemplateIds exposes the supported heuristics", () => {
  assert.deepEqual(listAppDraftTemplateIds(), [
    "crm",
    "booking",
    "internal_dashboard",
    "task_tracker",
    "customer_portal",
  ]);
});
