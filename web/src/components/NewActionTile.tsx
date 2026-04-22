import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

export default function NewActionTile({
  to = "/settings",
  label = "Refine workspace",
  helper = "Update goals, website, and profile",
}: {
  to?: string;
  label?: string;
  helper?: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[158px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-700 text-ink-400 transition-all hover:border-accent-400/60 hover:bg-ink-850/50 hover:text-ink-100"
    >
      <div className="grid h-9 w-9 place-items-center rounded-full border border-ink-700 bg-ink-850 transition-colors group-hover:border-accent-400/60 group-hover:bg-accent-500/10">
        <Plus className="h-4 w-4" strokeWidth={2} />
      </div>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-ink-500">{helper}</span>
    </Link>
  );
}
