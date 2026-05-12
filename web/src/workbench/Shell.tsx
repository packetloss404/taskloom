import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { I, type IconKey } from "./icons";
import { useUser, useWorkbench, useWorkspaceName } from "./WorkbenchContext";
import { useCommandPalette } from "./CommandPalette";

export type ViewKey =
  | "dashboard" | "builder" | "agents"
  | "workflows" | "runs" | "integrations"
  | "operations" | "sandbox" | "activation" | "settings"
  | "billing" | "roles" | "sso" | "secrets"
  | "webhooks" | "rate-limits" | "releases"
  | "notifications" | "storage" | "backups";

type NavSpec = { id: ViewKey; label: string; icon: IconKey; badge?: string };

const ADVANCED_KEYS: ViewKey[] = [
  "dashboard", "workflows", "integrations",
  "operations", "sandbox", "activation",
  "billing","roles","sso","backups","secrets","webhooks","rate-limits","releases","notifications","storage",
];

function viewFromPath(pathname: string): ViewKey {
  const m = pathname.match(/^\/?([^/?#]*)/);
  const key = (m?.[1] ?? "") as string;
  if (!key) return "builder";
  return (key as ViewKey);
}

export function useActiveView(): ViewKey {
  const { pathname } = useLocation();
  return viewFromPath(pathname);
}

export function Sidebar({ agentBadge }: { agentBadge?: string }) {
  const navigate = useNavigate();
  const active = useActiveView();
  const { signOut } = useWorkbench();
  const user = useUser();
  const workspaceName = useWorkspaceName();
  const role = useWorkbench().session.workspace.role ?? "member";

  const palette = useCommandPalette();
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(ADVANCED_KEYS.includes(active));

  useEffect(() => {
    if (ADVANCED_KEYS.includes(active)) setAdvancedOpen(true);
  }, [active]);

  const setActive = (key: ViewKey) => {
    navigate(`/${key}`);
  };

  const primary: NavSpec[] = [
    { id: "builder", label: "Build", icon: "code", badge: "live" },
    { id: "agents", label: "Projects", icon: "layout", badge: agentBadge },
    { id: "runs", label: "Runs", icon: "activity" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  const advanced: NavSpec[] = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "workflows", label: "Workflows", icon: "flow" },
    { id: "integrations", label: "Providers", icon: "key" },
    { id: "operations", label: "Operations", icon: "pulse" },
    { id: "sandbox", label: "Sandbox", icon: "cpu" },
    { id: "activation", label: "Activation", icon: "rocket" },
    { id: "billing", label: "Billing & plan", icon: "card" },
    { id: "roles", label: "Roles & permissions", icon: "shield" },
    { id: "sso", label: "SSO & auth", icon: "lock" },
    { id: "secrets", label: "Secrets vault", icon: "vault" },
    { id: "webhooks", label: "Webhooks", icon: "webhook" },
    { id: "rate-limits", label: "Rate limits", icon: "gauge" },
    { id: "releases", label: "Releases", icon: "branch" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "storage", label: "Storage & DB", icon: "database" },
    { id: "backups", label: "Backups & data", icon: "archive" },
  ];

  const initial = (workspaceName.trim()[0] ?? "W").toUpperCase();
  const userInitials = user.displayName
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"></div>
        <div>
          <div className="brand-name">task<span>loom</span></div>
          <div className="brand-tag">Agent · App workbench</div>
        </div>
      </div>

      <div className="ws-switch" title="Switch workspace">
        <div className="ws-avatar">{initial}</div>
        <div className="ws-meta">
          <div className="ws-name">{workspaceName}</div>
          <div className="ws-role">{role}</div>
        </div>
        <I.chevDown size={14} className="ws-chev" />
      </div>

      <div className="nav-search" onClick={() => palette.open()} style={{ cursor: "pointer" }}>
        <I.search size={14} />
        <span>Search…</span>
        <kbd>⌘K</kbd>
      </div>

      <div className="nav-section">
        {primary.map(it => (
          <NavItem key={it.id} item={it} active={active === it.id} onClick={() => setActive(it.id)} />
        ))}
        <div
          className="nav-section-title"
          onClick={() => setAdvancedOpen(o => !o)}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}
        >
          <span>Advanced</span>
          <I.chevDown size={10} style={{ transform: advancedOpen ? "none" : "rotate(-90deg)", transition: "transform .15s", color: "var(--silver-500)" }}/>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--silver-500)", textTransform: "none", letterSpacing: 0 }}>{advanced.length}</span>
        </div>
        {advancedOpen && advanced.map(it => (
          <NavItem key={it.id} item={it} active={active === it.id} onClick={() => setActive(it.id)} />
        ))}
      </div>

      <div className="sidebar-foot" onClick={() => { void signOut(); }} title="Sign out" style={{ cursor: "pointer" }}>
        <div className="avatar">{userInitials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="user-name">{user.displayName}</div>
          <div className="user-mail">{user.email}</div>
        </div>
        <I.arrow size={14} style={{ color: "var(--silver-400)" }} />
      </div>
    </aside>
  );
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: NavSpec;
  active: boolean;
  onClick: () => void;
}) {
  const Ico = I[item.icon] || I.home;
  return (
    <div className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Ico size={15} className="ico" />
      <span>{item.label}</span>
      {item.badge && <span className="badge">{item.badge}</span>}
    </div>
  );
}

export function Topbar({
  crumbs,
  actions,
}: {
  crumbs: string[];
  actions?: ReactNode;
}) {
  const workspaceName = useWorkspaceName();
  const finalCrumbs = crumbs[0] === "__WS__" ? [workspaceName, ...crumbs.slice(1)] : crumbs;
  return (
    <div className="topbar">
      <div className="crumb">
        {finalCrumbs.map((c, i) => (
          <Fragment key={i}>
            <span className={i === finalCrumbs.length - 1 ? "here" : ""}>{c}</span>
            {i < finalCrumbs.length - 1 && <span className="sep">/</span>}
          </Fragment>
        ))}
      </div>
      <div className="topbar-actions">
        <button className="top-btn"><span className="dot"></span> All systems normal</button>
        {actions}
        <button className="top-btn"><I.bell size={13} /></button>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "good" | "danger";
}) {
  const color = tone === "good" ? "var(--green)" : tone === "danger" ? "var(--danger)" : "var(--silver-50)";
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="kicker">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color }}>{value}</div>
      </div>
      {sub !== undefined && <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function PanelHeader({
  title,
  sub,
  action,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
      <div>
        <div className="h3" style={{ fontSize: 13.5 }}>{title}</div>
        {sub && <div className="muted" style={{ fontSize: 11.5 }}>{sub}</div>}
      </div>
      <div style={{ marginLeft: "auto" }}>{action}</div>
    </div>
  );
}
