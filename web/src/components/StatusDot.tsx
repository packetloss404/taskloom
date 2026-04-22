import { cn } from "@/lib/utils";

type TaskloomStatus = "healthy" | "failing" | "paused" | "never_run";

const styles: Record<TaskloomStatus, { ring: string; core: string; label: string }> = {
  healthy: {
    ring: "bg-emerald-400/20",
    core: "bg-emerald-400",
    label: "Healthy",
  },
  failing: {
    ring: "bg-rose-400/20",
    core: "bg-rose-400",
    label: "Needs attention",
  },
  paused: {
    ring: "bg-ink-400/20",
    core: "bg-ink-400",
    label: "Blocked",
  },
  never_run: {
    ring: "bg-amber-400/20",
    core: "bg-amber-400",
    label: "Not started",
  },
};

export default function StatusDot({
  status,
  showLabel = false,
  className,
}: {
  status: TaskloomStatus;
  showLabel?: boolean;
  className?: string;
}) {
  const s = styles[status];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("relative grid h-2.5 w-2.5 place-items-center rounded-full", s.ring)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", s.core)} />
      </span>
      {showLabel && <span className="text-xs text-ink-300">{s.label}</span>}
    </span>
  );
}
