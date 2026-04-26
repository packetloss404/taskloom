import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warn";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (input: { tone?: ToastTone; title: string; description?: string; durationMs?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let externalPush: ToastContextValue["push"] | null = null;

export function pushExternalToast(input: { tone?: ToastTone; title: string; description?: string; durationMs?: number }) {
  if (externalPush) externalPush(input);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<ToastContextValue["push"]>((input) => {
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = {
      id,
      tone: input.tone ?? "info",
      title: input.title,
      description: input.description,
      durationMs: input.durationMs ?? (input.tone === "error" ? 7000 : 4500),
    };
    setToasts((current) => [...current, toast]);
    return id;
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  useEffect(() => {
    externalPush = push;
    return () => {
      externalPush = null;
    };
  }, [push]);

  const value = useMemo(() => ({ toasts, push, dismiss, clear }), [toasts, push, dismiss, clear]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value;
}

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = window.setTimeout(onDismiss, toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.durationMs, onDismiss]);

  const { Icon, ring, iconClass } = toneStyles(toast.tone);
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-ink-900/95 px-4 py-3 text-sm text-ink-100 shadow-card backdrop-blur",
        ring,
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="font-medium leading-5">{toast.title}</div>
        {toast.description && <div className="mt-1 text-xs leading-5 text-ink-400">{toast.description}</div>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-mr-1 -mt-1 grid h-6 w-6 place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function toneStyles(tone: ToastTone) {
  switch (tone) {
    case "success":
      return { Icon: CheckCircle2, ring: "border-emerald-400/30", iconClass: "text-emerald-300" };
    case "error":
      return { Icon: XCircle, ring: "border-rose-400/40", iconClass: "text-rose-300" };
    case "warn":
      return { Icon: AlertTriangle, ring: "border-amber-400/30", iconClass: "text-amber-300" };
    case "info":
    default:
      return { Icon: Info, ring: "border-ink-700", iconClass: "text-ink-300" };
  }
}
