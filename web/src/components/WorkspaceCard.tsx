import { Link } from "react-router-dom";
import { Clock, FolderKanban, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { relative } from "@/lib/format";
import StatusDot from "./StatusDot";

type WorkspaceCardStatus = "healthy" | "failing" | "paused" | "never_run";

export interface WorkspaceCardModel {
  id: string;
  name: string;
  description: string;
  status: WorkspaceCardStatus;
  href: string;
  primaryMeta: string;
  secondaryMeta: string;
  updatedAt?: string | null;
}

export default function WorkspaceCard({ workspace }: { workspace: WorkspaceCardModel }) {
  const dimmed = workspace.status === "paused";

  return (
    <Link
      to={workspace.href}
      className={cn("card card-hover group relative block p-5", dimmed && "opacity-60")}
    >
      <button
        type="button"
        aria-label="View workspace"
        title="View workspace"
        className={cn(
          "absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-ink-700/70 bg-ink-900/60 text-ink-300 opacity-0 transition-all hover:border-ink-600 hover:bg-ink-800 hover:text-ink-100 group-hover:opacity-100",
          dimmed && "opacity-100",
        )}
      >
        <Pause className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      <div className="flex items-start justify-between gap-3 pr-9">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={workspace.status} />
            <h3 className="truncate text-[15px] font-semibold text-ink-100">{workspace.name}</h3>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-ink-300">{workspace.description}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5" strokeWidth={1.75} />
          {workspace.primaryMeta}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
          {relative(workspace.updatedAt ?? null)}
        </span>
      </div>

      <div className="mt-3 border-t border-ink-800/80 pt-3 text-xs text-ink-400">
        {workspace.secondaryMeta}
      </div>
    </Link>
  );
}
