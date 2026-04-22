import { Link } from "react-router-dom";
import { Activity, CheckCircle2, PencilLine, Sparkles } from "lucide-react";
import type { ActivityRecord } from "@/lib/types";
import { relative } from "@/lib/format";
import { cn } from "@/lib/utils";

const iconByScope = {
  account: Activity,
  workspace: PencilLine,
  activation: CheckCircle2,
} as const;

const tintByScope = {
  account: "text-ink-300",
  workspace: "text-accent-400",
  activation: "text-emerald-400",
} as const;

export default function ActivityRow({ activity }: { activity: ActivityRecord }) {
  const Icon = iconByScope[activity.scope] ?? Sparkles;

  return (
    <Link to={`/activity/${activity.id}`} className="block border-b border-ink-800/60 px-1 py-3 transition-colors hover:bg-ink-900/30 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className={cn("h-4 w-4 shrink-0", tintByScope[activity.scope])} strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="truncate text-sm text-ink-100">{String(activity.data.title || activity.event)}</div>
          <div className="truncate text-xs text-ink-400">
            {relative(activity.occurredAt)} · {activity.scope} · {activity.actor.displayName || activity.actor.id}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-ink-500">{activity.event}</div>
      </div>
    </Link>
  );
}
