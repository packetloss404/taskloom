import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Keyboard, X } from "lucide-react";

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
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="card relative z-10 max-h-[calc(100dvh-4rem)] w-full max-w-lg overflow-y-auto p-6 outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-ink-300" strokeWidth={1.75} />
            <h2 className="text-base font-semibold text-ink-100">Keyboard shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <SectionTitle>General</SectionTitle>
          <div className="mt-2 divide-y divide-ink-800 rounded-xl border border-ink-800">
            {generalShortcuts.map((shortcut) => (
              <Row key={shortcut.label} label={shortcut.label}>
                {shortcut.keys.map((key, index) => (
                  <Kbd key={`${shortcut.label}-${index}`}>{key}</Kbd>
                ))}
              </Row>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <SectionTitle>Navigation</SectionTitle>
          <p className="mt-1 text-xs text-ink-500">Press <Kbd>g</Kbd> then the indicated key.</p>
          <div className="mt-2 divide-y divide-ink-800 rounded-xl border border-ink-800">
            {navShortcuts.map((shortcut) => (
              <Row key={shortcut.to} label={shortcut.label}>
                <Kbd>g</Kbd>
                <span className="text-ink-600">then</span>
                <Kbd>{shortcut.chord}</Kbd>
              </Row>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">{children}</h3>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="text-ink-200">{label}</span>
      <span className="flex items-center gap-1.5 text-xs">{children}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono text-[11px] text-ink-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.5)]">
      {children}
    </kbd>
  );
}
