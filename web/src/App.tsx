import { Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAuth, RequireOnboarding } from "./components/RouteGuards";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/Dashboard";
import OnboardingPage from "./pages/Onboarding";
import SettingsPage from "./pages/Settings";
import ActivityPage from "./pages/Activity";
import ActivationPage from "./pages/Activation";
import ActivityDetailPage from "./pages/ActivityDetail";

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
      <Route path="/" element={<DashboardPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/activation" element={<ActivationPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/activity/:id" element={<ActivityDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
