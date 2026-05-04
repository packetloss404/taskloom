import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bot,
  Compass,
  CornerDownLeft,
  Home,
  KeyRound,
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AgentRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: "Navigation" | "Actions" | "Agents";
  keywords: string;
  icon: typeof Home;
  perform: () => void | Promise<void>;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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
    api.listAgents()
      .then((nextAgents) => {
        if (mounted) setAgents(nextAgents);
      })
      .catch(() => {
        if (mounted) setAgents([]);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

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
    const base: PaletteCommand[] = [
      { id: "nav-dashboard", label: "Go to Dashboard", group: "Navigation", keywords: "home overview", icon: Home, perform: () => go("/dashboard") },
      { id: "nav-builder", label: "Go to Builder", group: "Navigation", keywords: "build starter prompt templates onboarding draft", icon: Sparkles, perform: () => go("/builder") },
      { id: "nav-agents", label: "Go to Agents", group: "Navigation", keywords: "bots automation", icon: Bot, perform: () => go("/agents") },
      { id: "nav-workflows", label: "Go to Workflows", group: "Navigation", keywords: "workflow plan", icon: Workflow, perform: () => go("/workflows") },
      { id: "nav-runs", label: "Go to Runs / Activity", group: "Navigation", keywords: "runs activity history logs", icon: Activity, perform: () => go("/runs") },
      { id: "nav-operations", label: "Go to Operations", group: "Navigation", keywords: "blockers questions release", icon: Compass, perform: () => go("/operations") },
      { id: "nav-providers", label: "Go to Providers", group: "Navigation", keywords: "providers integrations api keys", icon: KeyRound, perform: () => go("/integrations") },
      { id: "nav-settings", label: "Go to Settings", group: "Navigation", keywords: "profile workspace", icon: Settings, perform: () => go("/settings") },
      { id: "act-new-agent", label: "Create new agent", group: "Actions", hint: "Open the agent editor", keywords: "new create agent", icon: Plus, perform: () => go("/agents/new") },
    ];

    for (const agent of agents.slice(0, 20)) {
      base.push({
        id: `agent-open-${agent.id}`,
        label: `Open ${agent.name}`,
        hint: agent.provider?.name ?? "No provider",
        group: "Agents",
        keywords: `${agent.name} ${agent.description ?? ""} ${agent.provider?.name ?? ""}`.toLowerCase(),
        icon: Bot,
        perform: () => go(`/agents/${agent.id}`),
      });
      base.push({
        id: `agent-run-${agent.id}`,
        label: `Run ${agent.name}`,
        hint: running === agent.id ? "Running…" : "Records a new run",
        group: "Agents",
        keywords: `run ${agent.name}`.toLowerCase(),
        icon: ArrowRight,
        perform: () => runAgentCommand(agent.id),
      });
    }
    return base;
  }, [agents, running]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) =>
      command.label.toLowerCase().includes(q) || command.keywords.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLButtonElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, { command: PaletteCommand; index: number }[]>>((acc, command, index) => {
    (acc[command.group] ||= []).push({ command, index });
    return acc;
  }, {});

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(filtered.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = filtered[activeIndex];
      if (target) void target.perform();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 pt-[10vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl border border-ink-700 bg-ink-900"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2">
          <span className="kicker-amber">COMMAND PALETTE</span>
          <span className="font-mono text-[10px] text-ink-500">ESC TO CLOSE</span>
        </div>
        <div className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search pages, agents, actions…"
            className="flex-1 bg-transparent font-mono text-sm text-ink-100 outline-none placeholder:text-ink-500"
          />
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center font-mono text-xs text-ink-500">— NO MATCHES —</div>
          ) : (
            Object.entries(grouped).map(([group, entries]) => (
              <div key={group}>
                <div className="border-b border-ink-800 bg-ink-950/40 px-4 py-2">
                  <span className="kicker">{group.toUpperCase()}</span>
                </div>
                {entries.map(({ command, index }) => {
                  const Icon = command.icon;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-index={index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => { void command.perform(); }}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-ink-800 px-4 py-2.5 text-left text-sm transition-colors",
                        active ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-850",
                      )}
                    >
                      <span className={cn("font-mono text-xs", active ? "text-signal-amber" : "text-ink-600")}>
                        {active ? "▸" : " "}
                      </span>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-500" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint && <span className="hidden truncate font-mono text-[10px] text-ink-500 sm:inline">{command.hint}</span>}
                      {active && <CornerDownLeft className="h-3 w-3 text-signal-amber" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-700 bg-ink-950/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-500">
          <div className="flex items-center gap-4">
            <span>[↑↓] NAVIGATE</span>
            <span>[↵] SELECT</span>
            <span>[ESC] CLOSE</span>
          </div>
          <span>{filtered.length} RESULT{filtered.length === 1 ? "" : "S"}</span>
        </div>
      </div>
    </div>
  );
}
