import { Link, useParams } from "react-router-dom";
import { Check, Database, LayoutDashboard, Route, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export default function GeneratedAppPreviewPage() {
  const { workspaceId = "workspace", appId = "generated-app" } = useParams();
  const appName = titleFromSlug(appId);

  return (
    <div className="page-frame">
      <section className="spec-frame">
        <div className="spec-label spec-label--amber">APP PREVIEW</div>
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <p className="kicker">{workspaceId}</p>
            <h1 className="display mt-2 text-3xl text-ink-100">{appName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-400">
              This generated app checkpoint is saved and routable. Phase 68 records the draft, route map, data model, auth decisions, and smoke metadata so later phases can replace this preview shell with rendered generated files.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/builder" className="btn-secondary">
                <LayoutDashboard className="h-3.5 w-3.5" /> Builder
              </Link>
              <span className="pill pill--good">Preview route live</span>
            </div>
          </div>
          <div className="grid gap-3">
            <PreviewCheckpoint icon={<Route className="h-4 w-4" />} label="Routes" value="Page and API route contracts captured" />
            <PreviewCheckpoint icon={<Database className="h-4 w-4" />} label="Data" value="Schema and CRUD loops recorded" />
            <PreviewCheckpoint icon={<ShieldCheck className="h-4 w-4" />} label="Auth" value="Public/private/admin access preserved" />
            <PreviewCheckpoint icon={<Check className="h-4 w-4" />} label="Smoke" value="Build and smoke status attached to apply response" />
          </div>
        </div>
      </section>
    </div>
  );
}

function PreviewCheckpoint({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 border border-ink-800 bg-ink-950 p-4">
      <span className="mt-0.5 text-signal-amber">{icon}</span>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
        <p className="mt-1 text-sm text-ink-200">{value}</p>
      </div>
    </div>
  );
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || "Generated App";
}
