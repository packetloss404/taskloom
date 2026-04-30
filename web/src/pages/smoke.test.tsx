import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ActivationPage from "./Activation";
import DashboardPage from "./Dashboard";
import OperationsPage from "./Operations";
import PublicSharePage from "./PublicShare";
import { AuthContext } from "../context/AuthContext";
import type { Session, WorkspaceRole } from "../lib/types";

const pageSource = (fileName: string) => readFileSync(fileURLToPath(new URL(fileName, import.meta.url)), "utf8");
const appSource = () => readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");

function buildSession(role: WorkspaceRole): Session {
  return {
    authenticated: true,
    user: { id: "user-1", email: "user@example.com", displayName: "Test User", timezone: "UTC" },
    workspace: { id: "workspace-1", slug: "ws", name: "Workspace", website: "", automationGoal: "", role },
    onboarding: { status: "completed", currentStep: "done", completed: true, completedSteps: [], completedAt: null },
  };
}

function renderOperationsWithRole(role: WorkspaceRole | null) {
  const session = role ? buildSession(role) : null;
  const value = {
    session,
    loading: false,
    refreshSession: async () => session,
    signIn: async () => undefined,
    signUp: async () => undefined,
    signOut: async () => undefined,
    setSession: () => undefined,
  };
  return renderToString(
    <MemoryRouter initialEntries={["/operations"]}>
      <AuthContext.Provider value={value}>
        <OperationsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

test("Dashboard surface server-renders its initial loading shell", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardPage />
    </MemoryRouter>,
  );

  assert.match(html, /page-frame/);
  assert.match(html, /animate-pulse/);
});

test("Activation surface server-renders its initial loading shell", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/activation"]}>
      <ActivationPage />
    </MemoryRouter>,
  );

  assert.match(html, /Loading activation detail/);
});

test("Public share surface server-renders its loading shell", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/share/test-token"]}>
      <PublicSharePage />
    </MemoryRouter>,
  );

  assert.match(html, /PUBLIC SHARE/);
  assert.match(html, /LOADING SHARE/);
});

test("Auth routes are wired to public sign-in and sign-up surfaces", () => {
  const source = appSource();

  assert.match(source, /path="\/sign-in"/);
  assert.match(source, /path="\/login"/);
  assert.match(source, /path="\/sign-up"/);
  assert.match(source, /<PublicOnly>/);
  assert.match(source, /<AuthPage mode="sign-in" \/>/);
  assert.match(source, /<AuthPage mode="sign-up" \/>/);
});

test("Auth page exposes the expected credential and workspace forms", () => {
  const source = pageSource("AuthPage.tsx");

  assert.match(source, /mode: "sign-in" \| "sign-up"/);
  assert.match(source, /await signIn\(\{ email: email\.trim\(\), password \}\)/);
  assert.match(source, /await signUp\(\{ displayName: displayName\.trim\(\), email: email\.trim\(\), password \}\)/);
  assert.match(source, /next && next\.startsWith\("\/"\)/);
  assert.match(source, /DISPLAY NAME/);
  assert.match(source, /EMAIL/);
  assert.match(source, /PASSWORD/);
  assert.match(source, /Create account/);
  assert.match(source, /Sign in/);
});

test("Onboarding route and page keep setup behind session-aware completion", () => {
  const routeSource = appSource();
  const page = pageSource("Onboarding.tsx");

  assert.match(routeSource, /path="\/onboarding"/);
  assert.match(routeSource, /<RequireOnboarding>/);
  assert.match(routeSource, /<OnboardingPage \/>/);
  assert.match(page, /api\.getBootstrap\(\)/);
  assert.match(page, /api\.completeOnboardingStep\(stepKey\)/);
  assert.match(page, /await refreshSession\(\)/);
  assert.match(page, /nextBootstrap\.onboarding\.status === "completed"/);
  assert.match(page, /Complete the remaining Taskloom setup steps/);
  assert.match(page, /Current step/);
});

test("Role-aware workspace controls are surfaced and gated for viewers", () => {
  const settings = pageSource("Settings.tsx");
  const workflow = pageSource("Workflow.tsx");
  const operations = pageSource("Operations.tsx");
  const types = readFileSync(fileURLToPath(new URL("../lib/types.ts", import.meta.url)), "utf8");

  assert.match(types, /role\?: "owner" \| "admin" \| "member" \| "viewer"/);
  assert.match(settings, /WORKSPACE ROLE/);
  assert.match(settings, /canManageWorkspaceRole\(workspaceRole\)/);
  assert.match(settings, /disabled=\{workspaceControlsDisabled\}/);
  assert.match(workflow, /ROLE · \{session\.workspace\.role\.toUpperCase\(\)\}/);
  assert.match(workflow, /!isViewer && templates\.length > 0/);
  assert.match(workflow, /disabled=\{isViewer\}/);
  assert.match(operations, /Workspace role · \{session\.workspace\.role\}/);
  assert.match(operations, /isViewer \? <ReadOnlyRoleNotice \/> : <form/);
  assert.match(operations, /\{canManageOperations && <ProductionStatusPanel \/>\}/);
  assert.match(operations, /<h2 className="display text-2xl">Production Status<\/h2>/);
  assert.match(operations, /fetchProductionStatus/);
});

test("Operations surface renders the Production Status tile for admin sessions", () => {
  const html = renderOperationsWithRole("admin");
  assert.match(html, /Production Status/);
  assert.match(html, /PRODUCTION STATUS/);
  assert.match(html, /Job metrics/);
  assert.match(html, /Subsystem health/);
  assert.match(html, /SUBSYSTEM HEALTH/);

  const operations = pageSource("Operations.tsx");
  assert.match(operations, /fetchJobMetricsHistory/);
  assert.match(operations, /\/api\/app\/operations\/job-metrics\/history/);
  assert.match(operations, />Trend</);
  assert.match(operations, /<Sparkline values=\{trendValues\} \/>/);
  assert.match(operations, /npm run jobs:snapshot-metrics/);
  assert.match(operations, /jobMetricsSnapshots\.lastCapturedAt/);
  assert.match(operations, /fetchRecentAlerts/);
  assert.match(operations, /Recent alerts/);
  assert.match(operations, /deadLettered/);
  assert.match(operations, /RETRYING \(attempt /);
  assert.match(operations, /storageTopology/);
  assert.match(operations, /Storage topology/);
  assert.match(operations, /managedDatabaseTopology/);
  assert.match(operations, /Managed database topology/);
  assert.match(operations, /MANAGED DATABASE TOPOLOGY/);
  assert.match(operations, /managedDatabaseRuntimeGuard/);
  assert.match(operations, /Runtime guard/);
  assert.match(operations, /RUNTIME GUARD/);
  assert.match(operations, /managedDatabaseRuntimeBoundary/);
  assert.match(operations, /Managed DB runtime boundary/);
  assert.match(operations, /MANAGED DB RUNTIME BOUNDARY/);
  assert.match(operations, /asyncStoreBoundary/);
  assert.match(operations, /Async store boundary/);
  assert.match(operations, /ASYNC STORE BOUNDARY/);
  assert.match(operations, /Foundation present/);
  assert.match(operations, /Managed DB runtime/);
  assert.match(operations, /managedPostgresCapability/);
  assert.match(operations, /Managed Postgres capability/);
  assert.match(operations, /MANAGED POSTGRES CAPABILITY/);
  assert.match(operations, /Adapter configured/);
  assert.match(operations, /Sync runtime/);
  assert.match(operations, /releaseReadiness/);
  assert.match(operations, /Release readiness/);
  assert.match(operations, /releaseEvidence/);
  assert.match(operations, /Release evidence/);
  assert.match(operations, /Included evidence/);
  assert.match(operations, /Readiness report/);
  assert.match(operations, /embeddedReportStatus/);
});

test("Operations surface hides the Production Status tile for viewer sessions", () => {
  const html = renderOperationsWithRole("viewer");
  assert.doesNotMatch(html, /Production Status/);
  assert.doesNotMatch(html, /PRODUCTION STATUS/);
  assert.doesNotMatch(html, /Subsystem health/);
});

test("Previously unwired controls are connected to backend-facing APIs", () => {
  const workflow = pageSource("Workflow.tsx");
  const agentEditor = pageSource("AgentEditor.tsx");
  const agents = pageSource("Agents.tsx");
  const integrations = pageSource("Integrations.tsx");
  const runs = pageSource("Runs.tsx");

  assert.match(workflow, /api\.requestPlanMode\(\)/);
  assert.match(workflow, /api\.applyPlanMode\(planMode\.planItems\)/);
  assert.match(agentEditor, /field\.options/);
  assert.match(agentEditor, /canManageWorkspaceRole\(session\?\.workspace\.role\)/);
  assert.match(agents, /canManageWorkspaceRole\(session\?\.workspace\.role\)/);
  assert.match(integrations, /canManageWorkspaceRole\(session\?\.workspace\.role\)/);
  assert.match(runs, /api\.diagnoseAgentRun\(run\.id\)/);
});

test("Share tokens are wired through API, settings, and public routes", () => {
  const app = appSource();
  const api = readFileSync(fileURLToPath(new URL("../lib/api.ts", import.meta.url)), "utf8");
  const types = readFileSync(fileURLToPath(new URL("../lib/types.ts", import.meta.url)), "utf8");
  const settings = pageSource("Settings.tsx");
  const publicShare = pageSource("PublicShare.tsx");

  assert.match(types, /export type ShareTokenScope = "brief" \| "plan" \| "overview"/);
  assert.match(api, /listShareTokens: \(\) => j<\{ tokens: ShareTokenRecord\[\] \}>\("\/api\/app\/share"\)/);
  assert.match(api, /createShareToken: \(body: CreateShareTokenInput\)/);
  assert.match(api, /deleteShareToken: \(id: string\) => j<\{ ok: boolean \}>\(`\/api\/app\/share\/\$\{id\}`/);
  assert.match(api, /getPublicShare: \(token: string\) => j<\{ shared: PublicSharePayload \}>\(`\/api\/public\/share\/\$\{encodeURIComponent\(token\)\}`/);
  assert.match(app, /path="\/share\/:token"/);
  assert.match(settings, /api\.listShareTokens\(\)/);
  assert.match(settings, /api\.createShareToken/);
  assert.match(settings, /api\.deleteShareToken/);
  assert.match(settings, /canManageWorkspaceRole\(workspaceRole\)/);
  assert.match(publicShare, /api\.getPublicShare\(token\)/);
  assert.match(publicShare, /shared\.scope === "brief" \|\| shared\.scope === "overview"/);
  assert.match(publicShare, /shared\.scope === "plan" \|\| shared\.scope === "overview"/);
});

test("Phase 31 dashboard filters persist to URL search params with active-filter chips", () => {
  const dashboard = pageSource("Dashboard.tsx");

  assert.match(dashboard, /useSearchParams/);
  assert.match(dashboard, /searchParams\.get\(["']stage["']\)/);
  assert.match(dashboard, /searchParams\.get\(["']risk["']\)/);
  assert.match(dashboard, /searchParams\.get\(["']status["']\)/);
  assert.match(dashboard, /searchParams\.get\(["']recency["']\)/);
});

test("Phase 31 activity detail surfaces workflow context inline", () => {
  const activityDetail = pageSource("ActivityDetail.tsx");

  assert.match(activityDetail, /Active blockers|active blockers/i);
  assert.match(activityDetail, /Open questions|open questions/i);
  assert.match(activityDetail, /No active blockers/i);
  assert.match(activityDetail, /No open questions/i);
  assert.match(activityDetail, /View workflow/i);
  assert.match(activityDetail, /["']\/workflows?["']/);
});

test("Phase 31 workflow page shows empty-state CTAs and brief-versions count badge", () => {
  const workflow = pageSource("Workflow.tsx");

  assert.match(workflow, /Add first (requirement|requirements)/i);
  assert.match(workflow, /Add first (plan item|plan-item|task)/i);
  assert.match(
    workflow,
    /Add first (blocker|blockers)|No blockers reported|NO BLOCKERS RECORDED/i,
  );
  assert.match(workflow, /(briefVersions|state\.versions|versions)\.length/);
});

test("Member management is wired through typed API methods and settings UI", () => {
  const api = readFileSync(fileURLToPath(new URL("../lib/api.ts", import.meta.url)), "utf8");
  const types = readFileSync(fileURLToPath(new URL("../lib/types.ts", import.meta.url)), "utf8");
  const settings = pageSource("Settings.tsx");

  assert.match(types, /export interface WorkspaceMemberRecord/);
  assert.match(types, /export interface WorkspaceInvitationRecord/);
  assert.match(types, /export interface WorkspaceMembersPayload/);
  assert.match(api, /listWorkspaceMembers: \(\) => j<WorkspaceMembersPayload>\("\/api\/app\/members"\)/);
  assert.match(api, /createWorkspaceInvitation: \(body: CreateWorkspaceInvitationInput\)/);
  assert.match(api, /resendWorkspaceInvitation: \(invitationId: string\)/);
  assert.match(api, /revokeWorkspaceInvitation: \(invitationId: string\)/);
  assert.match(api, /updateWorkspaceMemberRole: \(userId: string, role: WorkspaceRole\)/);
  assert.match(api, /removeWorkspaceMember: \(userId: string\) => j<\{ ok: boolean \}>\(`\/api\/app\/members\/\$\{userId\}`/);
  assert.match(settings, /api\.listWorkspaceMembers\(\)/);
  assert.match(settings, /api\.createWorkspaceInvitation/);
  assert.match(settings, /api\.resendWorkspaceInvitation/);
  assert.match(settings, /api\.revokeWorkspaceInvitation/);
  assert.match(settings, /api\.updateWorkspaceMemberRole/);
  assert.match(settings, /api\.removeWorkspaceMember/);
  assert.match(settings, /MEMBERS · ACCESS CONTROL/);
  assert.match(settings, /workspaceRole === "owner" \? workspaceRoles : workspaceRoles\.filter/);
  assert.match(settings, /member\.role === "owner" && ownerCount <= 1/);
});
