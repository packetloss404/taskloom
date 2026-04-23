import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import PublicPortalPage from "./PublicPortal";

export default function HomePage() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-ink-200">
        <div className="text-sm text-ink-400">Loading Taskloom...</div>
      </div>
    );
  }

  if (session) return <Navigate to="/dashboard" replace />;
  return <PublicPortalPage />;
}
