import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function NotFoundPage() {
  const location = useLocation();
  const { session } = useAuth();
  const home = session ? "/dashboard" : "/";

  return (
    <div className="min-h-[100dvh] bg-ink-950 text-ink-200">
      <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col justify-center px-12 py-20 max-md:px-5">
        <div className="kicker mb-8">// HTTP 404 · ROUTE NOT FOUND</div>
        <h1 className="font-serif text-[clamp(6rem,18vw,14rem)] font-bold leading-none tracking-tighter text-ink-100">
          404.
        </h1>
        <p className="mt-10 max-w-2xl font-mono text-sm text-ink-400">
          NO RESOURCE AT <span className="text-signal-amber">{location.pathname}</span>
        </p>
        <p className="mt-2 max-w-2xl font-sans text-lg leading-7 text-ink-300">
          That path doesn{"’"}t resolve to anything in this workspace. The route was either never registered or has been removed.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to={home} className="btn-primary">← Back to {session ? "dashboard" : "portal"}</Link>
          {session && <Link to="/agents" className="btn-ghost">Agents</Link>}
          {session && <Link to="/workflows" className="btn-ghost">Workflows</Link>}
          {session && <Link to="/runs" className="btn-ghost">Runs</Link>}
        </div>
      </div>
    </div>
  );
}
