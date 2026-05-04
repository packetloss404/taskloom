import { Route, Routes } from "react-router-dom";
import { PublicOnly, RequireOnboarding } from "./components/RouteGuards";
import AuthPage from "./pages/AuthPage";
import OnboardingPage from "./pages/Onboarding";
import NotFoundPage from "./pages/NotFound";
import PublicSharePage from "./pages/PublicShare";
import Workbench from "./workbench/Workbench";

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
      <Route path="/share/:token" element={<PublicSharePage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/*" element={<Workbench />} />
    </Routes>
  );
}
