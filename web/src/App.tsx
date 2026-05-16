import { Route, Routes } from "react-router-dom";
import { PublicOnly, RequireOnboarding } from "./components/RouteGuards";
import AuthPage from "./pages/AuthPage";
import OnboardingPage from "./pages/Onboarding";
import NotFoundPage from "./pages/NotFound";
import PublicSharePage from "./pages/PublicShare";
import Workbench from "./workbench/Workbench";
import { BuilderLayout } from "./workbench/BuilderLayout";
import { BuilderView } from "./workbench/views/builder";
import { AppPreviewView } from "./workbench/views/app-preview";

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
      <Route
        path="/builder/*"
        element={
          <BuilderLayout>
            <Routes>
              <Route index element={<BuilderView />} />
              <Route path="preview/:workspaceId/:appId/*" element={<AppPreviewView />} />
            </Routes>
          </BuilderLayout>
        }
      />
      <Route path="/*" element={<Workbench />} />
    </Routes>
  );
}
