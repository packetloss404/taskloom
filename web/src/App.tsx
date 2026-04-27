import { Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAuth, RequireOnboarding } from "./components/RouteGuards";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/Dashboard";
import AgentsPage from "./pages/Agents";
import AgentEditorPage from "./pages/AgentEditor";
import HomePage from "./pages/Home";
import OnboardingPage from "./pages/Onboarding";
import SettingsPage from "./pages/Settings";
import ActivityPage from "./pages/Activity";
import ActivationPage from "./pages/Activation";
import ActivityDetailPage from "./pages/ActivityDetail";
import WorkflowPage from "./pages/Workflow";
import OperationsPage from "./pages/Operations";
import IntegrationsPage from "./pages/Integrations";
import RunsPage from "./pages/Runs";
import NotFoundPage from "./pages/NotFound";
import PublicSharePage from "./pages/PublicShare";

export default function App() {
  return (
    <Routes>
      <Route
        path="/sign-in"
        element={
          <PublicOnly>
            <AuthPage mode="sign-in" />
          </PublicOnly>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <AuthPage mode="sign-in" />
          </PublicOnly>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicOnly>
            <AuthPage mode="sign-up" />
          </PublicOnly>
        }
      />
      <Route
        path="/onboarding"
        element={
          <RequireOnboarding>
            <OnboardingPage />
          </RequireOnboarding>
        }
      />
      <Route path="/" element={<HomePage />} />
      <Route path="/share/:token" element={<PublicSharePage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/new" element={<AgentEditorPage />} />
        <Route path="/agents/:id" element={<AgentEditorPage />} />
        <Route path="/activation" element={<ActivationPage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/workflows" element={<WorkflowPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/activity/:id" element={<ActivityDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
