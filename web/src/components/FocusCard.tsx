import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { relative } from "@/lib/format";
import StatusDot from "./StatusDot";

type CardStatus = "healthy" | "failing" | "paused" | "never_run";

export interface FocusCardModel {
  id: string;
  title: string;
  description: string;
  status: CardStatus;
  href: string;
  primaryMeta: string;
  secondaryMeta: string;
  footer: string;
  updatedAt?: string | null;
}

export default function FocusCard({ card }: { card: FocusCardModel }) {
  const dimmed = card.status === "paused";

  return (
    <Link
      to={card.href}
      className={cn("card group relative block p-5 transition-all duration-150 hover:border-ink-600 hover:bg-ink-800/70 hover:-translate-y-px", dimmed && "opacity-70")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={card.status} />
            <h3 className="truncate text-[15px] font-semibold text-ink-100">{card.title}</h3>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-ink-300">{card.description}</p>
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-500 transition-colors group-hover:text-ink-200" strokeWidth={1.8} />
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-ink-400">
        <span>{card.primaryMeta}</span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
          {relative(card.updatedAt ?? null)}
        </span>
      </div>

      <div className="mt-3 border-t border-ink-800/80 pt-3 text-xs text-ink-400">
        {card.secondaryMeta}
      </div>

      <div className="mt-2 text-xs text-ink-500">{card.footer}</div>
    </Link>
  );
}
