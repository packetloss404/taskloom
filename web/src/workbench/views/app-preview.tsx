import { Link, useParams } from "react-router-dom";
import { I, type IconKey } from "../icons";
import { Topbar } from "../Shell";

interface PreviewCheck { icon: IconKey; label: string; value: string }

const CHECKS: PreviewCheck[] = [
  { icon: "branch", label: "Routes", value: "Page and API route contracts captured" },
  { icon: "database", label: "Data", value: "Schema and CRUD loops recorded" },
  { icon: "shield", label: "Auth", value: "Public/private/admin access preserved" },
  { icon: "check", label: "Smoke", value: "Build and smoke status attached to apply response" },
];

export function AppPreviewView() {
  const { workspaceId = "workspace", appId = "generated-app" } = useParams();
  const appName = titleFromSlug(appId);

  return (
    <>
      <Topbar
        crumbs={["__WS__", "Builder", appName, "Preview"]}
        actions={<Link to="/builder" className="top-btn"><I.code size={13}/> Back to builder</Link>}
      />
      <div style={{ padding: "26px 28px 60px", maxWidth: 1180 }}>
        <div className="kicker">APP PREVIEW</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.85fr", gap: 28, marginTop: 18 }}>
          <div>
            <p className="kicker" style={{ color: "var(--silver-500)" }}>{workspaceId}</p>
            <h1 className="h1" style={{ fontSize: 32, marginTop: 6 }}>{appName}</h1>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.65, maxWidth: 560, marginTop: 10 }}>
              This generated app checkpoint is saved and routable. The builder records the draft, route map,
              data model, auth decisions, and smoke metadata so later iterations can replace this preview shell
              with rendered generated files.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <Link to="/builder" className="btn btn-sm" style={{ textDecoration: "none" }}><I.layout size={12}/> Builder</Link>
              <span className="pill good"><span className="dot"></span>Preview route live</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
            {CHECKS.map((c) => {
              const Ico = I[c.icon];
              return (
                <div key={c.label} className="card" style={{ padding: 14, display: "flex", gap: 10 }}>
                  <Ico size={16} style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }}/>
                  <div>
                    <p className="kicker" style={{ marginBottom: 4 }}>{c.label}</p>
                    <p style={{ fontSize: 13, color: "var(--silver-200)" }}>{c.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function titleFromSlug(slug: string) {
  return slug.split("-").filter(Boolean).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ") || "Generated App";
}
