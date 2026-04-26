import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function NotFoundPage() {
  const location = useLocation();
  const { session } = useAuth();
  const home = session ? "/dashboard" : "/";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-6 py-12 text-ink-200">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-850 text-ink-200">
          <Compass className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <p className="mt-5 text-xs uppercase tracking-[0.22em] text-ink-500">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-100">We couldn{"’"}t find that page</h1>
        <p className="mt-3 break-all text-sm leading-6 text-ink-400">
          <code className="rounded bg-ink-900 px-1.5 py-0.5 text-xs text-ink-300">{location.pathname}</code> doesn{"’"}t match any route in this workspace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to={home} className="btn-primary bg-ink-100 text-ink-950 hover:bg-white">
            <ArrowLeft className="h-4 w-4" /> Back to {session ? "dashboard" : "home"}
          </Link>
          {session && (
            <Link to="/agents" className="btn-ghost">
              Browse agents
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
