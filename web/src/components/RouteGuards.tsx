import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-ink-200">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-500">Loading</div>
        <h1 className="mt-3 text-lg font-semibold text-ink-100">Restoring your workspace</h1>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { loading, session } = useAuth();
  const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to={`/sign-in?next=${next}`} replace />;
  if (!session.onboarding.completed) return <Navigate to={`/onboarding?next=${next}`} replace />;
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { loading, session } = useAuth();
  const search = new URLSearchParams(location.search);
  const requestedNext = search.get("next");

  if (loading) return <FullScreenLoader />;
  if (session?.onboarding.completed) {
    return <Navigate to={requestedNext && requestedNext.startsWith("/") ? requestedNext : "/"} replace />;
  }
  if (session) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function RequireOnboarding({ children }: { children: ReactNode }) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const next = search.get("next");
  const { loading, session } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!session) {
    return <Navigate to={`/sign-in?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
  }
  if (session.onboarding.completed) {
    return <Navigate to={next && next.startsWith("/") ? next : "/"} replace />;
  }
  return <>{children}</>;
}
