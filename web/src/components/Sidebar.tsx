import { NavLink } from "react-router-dom";
import { Activity, LayoutGrid, LogOut, Settings, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { session, signOut } = useAuth();

  return (
    <aside className="sidebar-glow sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-ink-800/80 bg-ink-900/40 px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 shadow-lg shadow-accent-600/20">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.25} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-ink-100">taskloom</span>
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-ink-800/80 text-ink-100"
                  : "text-ink-300 hover:bg-ink-850/60 hover:text-ink-100",
              )
            }
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-4 px-2 text-xs text-ink-400">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Workspace</div>
          <div className="mt-1 text-sm font-medium text-ink-100">{session?.workspace.name}</div>
          <div className="mt-1 text-xs text-ink-400">{session?.user.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Activation engine online
        </div>
        <button
          onClick={() => {
            void signOut();
          }}
          className="inline-flex items-center gap-2 text-ink-300 transition-colors hover:text-ink-100"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sign out
        </button>
        <div className="text-ink-500">v0.1.0 · local</div>
      </div>
    </aside>
  );
}
