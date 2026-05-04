import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { I, type IconKey } from "./icons";
import { api } from "@/lib/api";
import type { AgentRecord } from "@/lib/types";

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: "Navigation" | "Actions" | "Agents";
  keywords: string;
  icon: IconKey;
  perform: () => void | Promise<void>;
}

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((c) => !c), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (isModifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  const value = useMemo(() => ({ open, close, toggle, isOpen }), [open, close, toggle, isOpen]);
  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <Palette open={isOpen} onClose={close}/>
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const value = useContext(CommandPaletteContext);
  if (!value) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return value;
}

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    api.listAgents().then((next) => mounted && setAgents(next)).catch(() => mounted && setAgents([]));
    return () => { mounted = false; };
  }, [open]);

  const go = (path: string) => { onClose(); navigate(path); };

  const runAgentCommand = async (agentId: string) => {
    setRunning(agentId);
    try {
      await api.runAgent(agentId);
      onClose();
      navigate("/runs");
    } catch {
      setRunning(null);
    }
  };

  const commands = useMemo<PaletteCommand[]>(() => {
    const nav: PaletteCommand[] = [
      { id: "nav-dashboard", label: "Dashboard", group: "Navigation", keywords: "dashboard home", icon: "home", perform: () => go("/dashboard") },
      { id: "nav-landing", label: "New build", group: "Navigation", keywords: "new build prompt landing", icon: "sparkle", perform: () => go("/landing") },
      { id: "nav-builder", label: "Builder", group: "Navigation", keywords: "builder app code", icon: "code", perform: () => go("/builder") },
      { id: "nav-agents", label: "Agents", group: "Navigation", keywords: "agents bot", icon: "bot", perform: () => go("/agents") },
      { id: "nav-workflows", label: "Workflows", group: "Navigation", keywords: "workflows brief plan blockers", icon: "flow", perform: () => go("/workflows") },
      { id: "nav-runs", label: "Runs · Activity", group: "Navigation", keywords: "runs activity history", icon: "activity", perform: () => go("/runs") },
      { id: "nav-providers", label: "Providers", group: "Navigation", keywords: "providers integrations llm tools env", icon: "key", perform: () => go("/integrations") },
      { id: "nav-operations", label: "Operations", group: "Navigation", keywords: "operations health alerts jobs", icon: "pulse", perform: () => go("/operations") },
      { id: "nav-sandbox", label: "Sandbox", group: "Navigation", keywords: "sandbox docker exec terminal", icon: "cpu", perform: () => go("/sandbox") },
      { id: "nav-activation", label: "Activation", group: "Navigation", keywords: "activation onboarding", icon: "rocket", perform: () => go("/activation") },
      { id: "nav-settings", label: "Settings", group: "Navigation", keywords: "settings members keys workspace audit", icon: "settings", perform: () => go("/settings") },
      { id: "nav-billing", label: "Billing & plan", group: "Navigation", keywords: "billing usage spend", icon: "card", perform: () => go("/billing") },
      { id: "nav-roles", label: "Roles & permissions", group: "Navigation", keywords: "roles permissions access", icon: "shield", perform: () => go("/roles") },
      { id: "nav-sso", label: "SSO & auth", group: "Navigation", keywords: "sso saml auth", icon: "lock", perform: () => go("/sso") },
      { id: "nav-secrets", label: "Secrets vault", group: "Navigation", keywords: "secrets vault env", icon: "vault", perform: () => go("/secrets") },
      { id: "nav-webhooks", label: "Webhooks", group: "Navigation", keywords: "webhooks triggers", icon: "webhook", perform: () => go("/webhooks") },
      { id: "nav-rate-limits", label: "Rate limits", group: "Navigation", keywords: "rate limits quota", icon: "gauge", perform: () => go("/rate-limits") },
      { id: "nav-releases", label: "Releases", group: "Navigation", keywords: "releases deployments", icon: "branch", perform: () => go("/releases") },
      { id: "nav-notifications", label: "Notifications", group: "Navigation", keywords: "notifications channels alerts", icon: "bell", perform: () => go("/notifications") },
      { id: "nav-storage", label: "Storage & DB", group: "Navigation", keywords: "storage database tables", icon: "database", perform: () => go("/storage") },
      { id: "nav-backups", label: "Backups & data", group: "Navigation", keywords: "backups data export", icon: "archive", perform: () => go("/backups") },
    ];
    const actions: PaletteCommand[] = [
      { id: "action-new-agent", label: "New agent", hint: "Create from scratch", group: "Actions", keywords: "new agent create", icon: "plus", perform: () => go("/agents/new") },
      { id: "action-new-build", label: "New build", hint: "Open prompt composer", group: "Actions", keywords: "new build prompt app agent", icon: "sparkle", perform: () => go("/landing") },
    ];
    const agentCommands: PaletteCommand[] = agents.map((a) => ({
      id: `agent-${a.id}`,
      label: a.name,
      hint: a.description || a.model,
      group: "Agents",
      keywords: `${a.name} ${a.id} ${a.description ?? ""} ${a.model ?? ""}`,
      icon: "bot",
      perform: async () => runAgentCommand(a.id),
    }));
    return [...nav, ...actions, ...agentCommands];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q));
  }, [commands, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, PaletteCommand[]> = {};
    for (const c of filtered) {
      (groups[c.group] = groups[c.group] || []).push(c);
    }
    return groups;
  }, [filtered]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) void cmd.perform();
    }
  };

  if (!open) return null;

  return (
    <div className="wb-palette-root" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(6, 7, 8, 0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "12vh",
    }}>
      <div className="wb-root wb-root wb-root" onClick={(e) => e.stopPropagation()} style={{
        background: "var(--panel)",
        border: "1px solid var(--line-2)",
        borderRadius: 12,
        width: "min(640px, 92vw)",
        maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 30px 80px -20px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--line-2)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <I.search size={16} style={{ color: "var(--silver-400)" }}/>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search commands, agents, settings…"
            className="field"
            style={{ background: "transparent", border: "none", padding: 0, fontSize: 15, color: "var(--silver-50)", outline: "none" }}
          />
          <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--silver-300)", border: "1px solid var(--line-2)", padding: "1px 5px", borderRadius: 4, background: "var(--ink)" }}>ESC</kbd>
        </div>

        <div style={{ overflow: "auto", flex: 1 }}>
          {filtered.length === 0 && (
            <div className="muted" style={{ padding: 22, textAlign: "center", fontSize: 13 }}>No commands match.</div>
          )}
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group}>
              <div className="kicker" style={{ padding: "10px 16px 6px", color: "var(--silver-500)" }}>{group}</div>
              {cmds.map((cmd) => {
                const idx = filtered.indexOf(cmd);
                const active = idx === activeIndex;
                const Ico = I[cmd.icon] || I.home;
                return (
                  <div
                    key={cmd.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => { void cmd.perform(); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 16px",
                      cursor: "pointer",
                      background: active ? "var(--bg-elev)" : "transparent",
                      borderLeft: `2px solid ${active ? "var(--green)" : "transparent"}`,
                    }}
                  >
                    <Ico size={14} style={{ color: active ? "var(--green)" : "var(--silver-300)", flexShrink: 0 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--silver-50)" }}>{cmd.label}</div>
                      {cmd.hint && <div className="mono muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cmd.hint}</div>}
                    </div>
                    {running === cmd.id.replace(/^agent-/, "") && (
                      <span className="spin"><I.refresh size={12}/></span>
                    )}
                    {active && (
                      <span className="mono muted" style={{ fontSize: 10 }}>↵</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, padding: "10px 16px", borderTop: "1px solid var(--line)", fontSize: 11 }} className="mono muted">
          <span><kbd style={{ fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", padding: "1px 5px", borderRadius: 4, background: "var(--ink)" }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", padding: "1px 5px", borderRadius: 4, background: "var(--ink)" }}>↵</kbd> Run</span>
          <span style={{ marginLeft: "auto" }}><kbd style={{ fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", padding: "1px 5px", borderRadius: 4, background: "var(--ink)" }}>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
