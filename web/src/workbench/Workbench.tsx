import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Sidebar } from "./Shell";
import { WorkbenchProvider } from "./WorkbenchContext";
import { CommandPaletteProvider } from "./CommandPalette";
import { AgentEditorView } from "./views/agent-editor";
import { RunDeepView } from "./views/run-deep";
import { RunDetailView } from "./views/run-detail";
import { AppPreviewView } from "./views/app-preview";
import { useApiData } from "./useApiData";
import { LandingView } from "./views/landing";
import { DashboardView } from "./views/dashboard";
import { BuilderView } from "./views/builder";
import { AgentsView } from "./views/agents";
import { WorkflowsView } from "./views/workflows";
import { RunsView } from "./views/runs";
import { IntegrationsView } from "./views/integrations";
import { OperationsView } from "./views/operations";
import { SandboxView } from "./views/sandbox";
import { ActivationView } from "./views/activation";
import { SettingsView } from "./views/settings";
import { LoggedOutView } from "./views/logged-out";
import { BillingView } from "./views/billing";
import { RolesView } from "./views/roles";
import { SSOView } from "./views/sso";
import { SecretsView } from "./views/secrets";
import { WebhooksView } from "./views/webhooks";
import { RateLimitsView } from "./views/rate-limits";
import { ReleasesView } from "./views/releases";
import { NotificationsView } from "./views/notifications";
import { StorageView } from "./views/storage";
import { BackupsView } from "./views/backups";

export default function Workbench() {
  const { session, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate("/sign-in");
  };

  if (loading) {
    return (
      <div className="wb-root">
        <div style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--silver-300)" }}>
          Loading workbench…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="wb-root">
        <LoggedOutView onSignIn={handleSignIn} />
      </div>
    );
  }

  // touch signIn so eslint doesn't complain it's unused; reserved for future inline-auth flow
  void signIn;

  return (
    <div className="wb-root">
      <WorkbenchProvider session={session} signOut={signOut}>
        <CommandPaletteProvider>
          <WorkbenchInner />
        </CommandPaletteProvider>
      </WorkbenchProvider>
    </div>
  );
}

function WorkbenchInner() {
  // Sidebar agent badge from real agent count
  const agents = useApiData(() => api.listAgents(), []);
  const agentBadge = agents.data ? String(agents.data.length) : undefined;

  return (
    <div className="shell">
      <Sidebar agentBadge={agentBadge} />
      <main className="main">
        <div className="view">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="landing" element={<LandingView />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="builder" element={<BuilderView />} />
            <Route path="builder/preview/:workspaceId/:appId/*" element={<AppPreviewView />} />
            <Route path="agents" element={<AgentsView />} />
            <Route path="agents/new" element={<AgentEditorView />} />
            <Route path="agents/:id" element={<AgentEditorView />} />
            <Route path="workflows" element={<WorkflowsView />} />
            <Route path="runs" element={<RunsView />} />
            <Route path="runs/:id" element={<RunDeepView />} />
            <Route path="activity" element={<RunsView />} />
            <Route path="activity/:id" element={<RunDetailView />} />
            <Route path="integrations" element={<IntegrationsView />} />
            <Route path="operations" element={<OperationsView />} />
            <Route path="sandbox" element={<SandboxView />} />
            <Route path="activation" element={<ActivationView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="billing" element={<BillingView />} />
            <Route path="roles" element={<RolesView />} />
            <Route path="sso" element={<SSOView />} />
            <Route path="secrets" element={<SecretsView />} />
            <Route path="webhooks" element={<WebhooksView />} />
            <Route path="rate-limits" element={<RateLimitsView />} />
            <Route path="releases" element={<ReleasesView />} />
            <Route path="notifications" element={<NotificationsView />} />
            <Route path="storage" element={<StorageView />} />
            <Route path="backups" element={<BackupsView />} />
            <Route path="*" element={<RedirectToDashboard />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function RedirectToDashboard() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/dashboard", { replace: true }); }, [navigate]);
  return null;
}
