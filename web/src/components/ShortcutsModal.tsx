import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

interface Shortcut {
  keys: string[];
  label: string;
}

interface NavShortcut {
  chord: string;
  label: string;
  to: string;
}

const navShortcuts: NavShortcut[] = [
  { chord: "d", label: "Go to Dashboard", to: "/dashboard" },
  { chord: "a", label: "Go to Agents", to: "/agents" },
  { chord: "w", label: "Go to Workflows", to: "/workflows" },
  { chord: "r", label: "Go to Runs", to: "/runs" },
  { chord: "i", label: "Go to Providers", to: "/integrations" },
  { chord: "s", label: "Go to Settings", to: "/settings" },
];

const generalShortcuts: Shortcut[] = [
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["Esc"], label: "Close dialogs and overlays" },
  { keys: ["g", "then key"], label: "Jump to a section (see below)" },
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export default function ShortcutsModal() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const pendingGoRef = useRef<{ until: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        pendingGoRef.current = null;
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setOpen((current) => !current);
        pendingGoRef.current = null;
        return;
      }

      const now = Date.now();
      const pending = pendingGoRef.current;
      if (pending && now < pending.until) {
        const match = navShortcuts.find((shortcut) => shortcut.chord === event.key.toLowerCase());
        pendingGoRef.current = null;
        if (match) {
          event.preventDefault();
          setOpen(false);
          navigate(match.to);
        }
        return;
      }

      if (event.key.toLowerCase() === "g") {
        pendingGoRef.current = { until: now + 1500 };
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, open]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
    >
      <button
        type="button"
        aria-label="Close shortcuts"
        className="absolute inset-0 bg-ink-950/85"
        onClick={() => setOpen(false)}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 max-h-[calc(100dvh-4rem)] w-full max-w-2xl overflow-y-auto border border-ink-700 bg-ink-900 outline-none"
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
          <span className="kicker-amber">KEYBOARD SHORTCUTS</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-xs text-ink-400 hover:text-signal-amber"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-5">
          <div className="kicker mb-3">GENERAL</div>
          <table className="data-table">
            <thead>
              <tr><th>Key</th><th>Action</th></tr>
            </thead>
            <tbody>
              {generalShortcuts.map((s) => (
                <tr key={s.label}>
                  <td className="whitespace-nowrap">
                    {s.keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
                  </td>
                  <td className="text-sm text-ink-200">{s.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-5">
          <div className="kicker mb-3">NAVIGATION · PRESS <Kbd>g</Kbd> THEN KEY</div>
          <table className="data-table">
            <thead>
              <tr><th>Chord</th><th>Destination</th></tr>
            </thead>
            <tbody>
              {navShortcuts.map((s) => (
                <tr key={s.to}>
                  <td className="whitespace-nowrap">
                    <Kbd>g</Kbd> <span className="text-ink-500">+</span> <Kbd>{s.chord}</Kbd>
                  </td>
                  <td className="text-sm text-ink-200">{s.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-ink-700 bg-ink-950/40 px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-500">
          [ESC] CLOSE · [?] TOGGLE
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-1 inline-flex min-w-[1.5rem] items-center justify-center border border-ink-700 bg-ink-950 px-1.5 py-0.5 font-mono text-[10px] text-ink-200">
      {children}
    </kbd>
  );
}
