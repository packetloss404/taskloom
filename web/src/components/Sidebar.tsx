import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Activity, Bot, ChevronDown, Home, KeyRound, LogOut, Plus, Search, Settings, Workflow } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCommandPalette } from "@/context/CommandPaletteContext";
import { brand } from "@/config/brand";
import { api } from "@/lib/api";
import type { AgentRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/workflows", label: "Workflows", icon: Workflow },
  { to: "/runs", label: "Runs / Activity", icon: Activity },
  { to: "/integrations", label: "Providers", icon: KeyRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { session, signOut } = useAuth();
  const { open: openCommandPalette } = useCommandPalette();
  const location = useLocation();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

  useEffect(() => {
    let mounted = true;
    setLoadingAgents(true);
    api.listAgents()
      .then((nextAgents) => {
        if (mounted) setAgents(nextAgents);
      })
      .catch(() => {
        if (mounted) setAgents([]);
      })
      .finally(() => {
        if (mounted) setLoadingAgents(false);
      });
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const initials = useMemo(() => {
    const source = session?.user.displayName || session?.user.email || "User";
    return source
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [session]);

  return (
    <>
      <header className="sidebar-glow sticky top-0 z-30 border-b border-ink-800/80 bg-ink-900/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Brand />
          <Link to="/agents/new" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-950" aria-label="New Agent">
            <Plus className="h-4 w-4" />
          </Link>
        </div>
        <NavItems mode="mobile" />
      </header>

      <aside className="sidebar-glow sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-800/80 bg-ink-900/40 px-4 py-5 sm:flex lg:w-72">
        <div className="px-2">
          <Brand />
        </div>

        <Link
          to="/agents/new"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-white"
        >
          <Plus className="h-4 w-4" /> New Agent
        </Link>

        <button
          type="button"
          onClick={openCommandPalette}
          className="mt-3 inline-flex w-full items-center gap-2 rounded-xl border border-ink-700 bg-ink-950/40 px-3 py-2 text-sm text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-100"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] font-medium text-ink-400">{isMac ? "⌘" : "Ctrl"}K</kbd>
        </button>

        <NavItems mode="desktop" />

        <section className="mt-6 min-h-0 flex-1 overflow-hidden">
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Agents</h2>
            <Link to="/agents" className="text-xs text-ink-400 hover:text-ink-100">View all</Link>
          </div>
          <div className="space-y-1 overflow-y-auto pr-1">
            {loadingAgents ? (
              <AgentSkeleton />
            ) : agents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-700 px-3 py-4 text-xs leading-5 text-ink-500">
                No agents yet. Create one to start running workflows.
              </div>
            ) : (
              agents.slice(0, 8).map((agent) => <AgentLink key={agent.id} agent={agent} />)
            )}
          </div>
        </section>

        <div className="relative mt-5 border-t border-ink-800 pt-4">
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-850"
            aria-expanded={accountOpen}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-700 bg-ink-850 text-sm font-semibold text-ink-100">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-100">{session?.user.displayName}</span>
              <span className="block truncate text-xs text-ink-500">{session?.user.email}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-500 transition-transform", accountOpen && "rotate-180")} />
          </button>

          {accountOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-card">
              <Link to="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-850 hover:text-ink-100">
                <Settings className="h-4 w-4" /> Account settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-300 hover:bg-ink-850 hover:text-ink-100"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}

          <div className="mt-2 px-2 text-[11px] text-ink-500">Self-hosted workspace</div>
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
      <img src={brand.logoPath} alt={brand.name} className="h-8 w-auto" />
    </Link>
  );
}

function NavItems({ mode }: { mode: "desktop" | "mobile" }) {
  return (
    <nav
      className={cn(
        mode === "desktop" && "mt-6 flex flex-col gap-1",
        mode === "mobile" && "-mx-1 mt-3 flex gap-1 overflow-x-auto pb-1",
      )}
      aria-label="Primary"
    >
      {nav.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg transition-colors",
              mode === "desktop" && "px-3 py-2 text-sm",
              mode === "mobile" && "shrink-0 px-3 py-2 text-xs",
              isActive
                ? "bg-ink-800/90 text-ink-100"
                : "text-ink-300 hover:bg-ink-850/70 hover:text-ink-100",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="whitespace-nowrap">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function AgentLink({ agent }: { agent: AgentRecord }) {
  return (
    <NavLink
      to={`/agents/${agent.id}`}
      className={({ isActive }) =>
        cn(
          "block rounded-xl border px-3 py-2 transition-colors",
          isActive
            ? "border-ink-600 bg-ink-850 text-ink-100"
            : "border-transparent text-ink-300 hover:border-ink-800 hover:bg-ink-850/60 hover:text-ink-100",
        )
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{agent.name}</span>
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", agent.status === "active" ? "bg-emerald-400" : "bg-ink-500")} />
      </div>
      <div className="mt-1 truncate text-xs text-ink-500">
        {agent.provider?.name ?? "No provider"} {agent.model ? `· ${agent.model}` : ""}
      </div>
    </NavLink>
  );
}

function AgentSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-ink-850/70" />
      ))}
    </div>
  );
}
