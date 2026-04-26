import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle2, Loader2, PencilLine, Search, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type { ActivityRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type ScopeFilter = "all" | ActivityRecord["scope"];
type RecencyFilter = "all" | "24h" | "7d" | "30d";

const scopeOptions: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "All scopes" },
  { value: "account", label: "Account" },
  { value: "workspace", label: "Workspace" },
  { value: "activation", label: "Activation" },
];

const recencyOptions: { value: RecencyFilter; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
  { value: "30d", label: "Last 30d" },
];

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

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [eventQuery, setEventQuery] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  const [recency, setRecency] = useState<RecencyFilter>("all");

  const loadActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      setActivities(await api.listActivity());
    } catch (loadError) {
      setActivities([]);
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivity();
  }, []);

  const filteredActivities = useMemo(() => {
    const normalizedEvent = eventQuery.trim().toLowerCase();
    const normalizedActor = actorQuery.trim().toLowerCase();
    const cutoff = recencyCutoff(recency);

    return activities.filter((activity) => {
      if (scope !== "all" && activity.scope !== scope) return false;
      if (cutoff && new Date(activity.occurredAt).getTime() < cutoff) return false;
      if (normalizedActor && !actorText(activity).toLowerCase().includes(normalizedActor)) return false;
      if (normalizedEvent && !eventText(activity).toLowerCase().includes(normalizedEvent)) return false;
      return true;
    });
  }, [activities, actorQuery, eventQuery, recency, scope]);

  const stats = useMemo(() => {
    const cutoff24h = Date.now() - 86_400_000;
    return {
      total: activities.length,
      shown: filteredActivities.length,
      last24h: activities.filter((activity) => new Date(activity.occurredAt).getTime() >= cutoff24h).length,
      actors: new Set(activities.map((activity) => actorLabel(activity))).size,
    };
  }, [activities, filteredActivities.length]);

  const hasFilters = scope !== "all" || eventQuery.trim() !== "" || actorQuery.trim() !== "" || recency !== "all";
  const clearFilters = () => {
    setScope("all");
    setEventQuery("");
    setActorQuery("");
    setRecency("all");
  };

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <div className="kicker mb-3">ACTIVITY · WORKSPACE LEDGER</div>
          <h1 className="display-xl">Activity.</h1>
          <p className="mt-4 max-w-xl font-mono text-xs text-ink-400">
            <span className="text-ink-200">{stats.total}</span> records ·{" "}
            <span className="text-signal-amber">{stats.last24h}</span> in last 24h ·{" "}
            <span className="text-ink-500">scope, event, actor, and recency filters.</span>
          </p>
        </div>
        <button className="btn-ghost" type="button" onClick={() => void loadActivity()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>↻</span>} Refresh
        </button>
      </header>

      {error && (
        <div className="mb-6 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          ERR · {error}
        </div>
      )}

      <section className="grid grid-cols-2 divide-x divide-y divide-ink-700 border-y border-ink-700 md:grid-cols-4 md:divide-y-0">
        <Stat label="TOTAL RECORDS" value={stats.total} />
        <Stat label="MATCHING" value={stats.shown} tone={hasFilters ? "warn" : "muted"} />
        <Stat label="LAST 24H" value={stats.last24h} tone={stats.last24h > 0 ? "good" : "muted"} />
        <Stat label="ACTORS" value={stats.actors} />
      </section>

      <section className="section-band mt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="kicker mb-2">FILTERS · {filteredActivities.length} SHOWN</div>
            <h2 className="display text-2xl">Ledger controls</h2>
          </div>
          {hasFilters && (
            <button className="btn-ghost" type="button" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.8fr_1.3fr_1fr_0.8fr]">
          <label className="block">
            <span className="kicker mb-1.5 block">Scope</span>
            <select className="workflow-input" value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}>
              {scopeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="kicker mb-1.5 block">Event / Status</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
              <input
                className="workflow-input pl-9"
                value={eventQuery}
                onChange={(event) => setEventQuery(event.target.value)}
                placeholder="Search event, title, status, metadata"
              />
            </div>
          </label>
          <label className="block">
            <span className="kicker mb-1.5 block">Actor</span>
            <input
              className="workflow-input"
              value={actorQuery}
              onChange={(event) => setActorQuery(event.target.value)}
              placeholder="Name, id, system"
            />
          </label>
          <label className="block">
            <span className="kicker mb-1.5 block">Recency</span>
            <select className="workflow-input" value={recency} onChange={(event) => setRecency(event.target.value as RecencyFilter)}>
              {recencyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="kicker mb-2">LEDGER · {filteredActivities.length} ROWS</div>
            <h2 className="display text-2xl">Event stream</h2>
          </div>
          <span className="section-marker">§ 02 / 02</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 border border-ink-700 px-4 py-6 text-sm text-ink-400">
            <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING ACTIVITY</span>
          </div>
        ) : activities.length === 0 ? (
          <EmptyState>No activity recorded yet.</EmptyState>
        ) : filteredActivities.length === 0 ? (
          <EmptyState>No activity matches the current filters.</EmptyState>
        ) : (
          <div className="overflow-hidden border border-ink-700">
            <div className="hidden grid-cols-[9rem_1fr_9rem_10rem_7rem] border-b border-ink-700 bg-ink-950/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500 md:grid">
              <div>When</div>
              <div>Event</div>
              <div>Scope</div>
              <div>Actor</div>
              <div className="text-right">Record</div>
            </div>
            <div className="divide-y divide-ink-800">
              {filteredActivities.map((activity) => (
                <LedgerRow key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function LedgerRow({ activity }: { activity: ActivityRecord }) {
  const Icon = iconByScope[activity.scope] ?? Sparkles;
  const title = String(activity.data.title || activity.event);
  const status = statusLabel(activity);

  return (
    <Link
      to={`/activity/${activity.id}`}
      className="grid gap-3 px-4 py-4 transition-colors hover:bg-signal-amber/5 md:grid-cols-[9rem_1fr_9rem_10rem_7rem] md:items-center"
    >
      <div className="font-mono text-[11px] text-ink-400">
        <div>{relative(activity.occurredAt)}</div>
        <div className="mt-1 text-[10px] text-ink-600 md:hidden">{formatTimestamp(activity.occurredAt)}</div>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className={cn("h-4 w-4 shrink-0", tintByScope[activity.scope])} strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="truncate font-serif text-base text-ink-100 md:text-sm">{title}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-ink-500">{activity.event}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:block">
        <span className="pill">{activity.scope}</span>
        {status && <span className="pill pill--muted md:hidden">{status}</span>}
      </div>
      <div className="min-w-0 font-mono text-[11px] text-ink-400">
        <div className="truncate">{actorLabel(activity)}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-600">{activity.actor.type}</div>
      </div>
      <div className="font-mono text-[11px] text-ink-500 md:text-right">#{activity.id}</div>
    </Link>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: number; tone?: "good" | "muted" | "warn" }) {
  const color = tone === "good" ? "text-signal-green" : tone === "warn" ? "text-signal-amber" : "text-ink-100";
  return (
    <div className="px-5 py-5">
      <div className="kicker">{label}</div>
      <div className={`mt-2 font-mono text-3xl tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="border border-dashed border-ink-700 px-6 py-10 text-center font-mono text-xs text-ink-500">— {children} —</div>;
}

function recencyCutoff(recency: RecencyFilter) {
  if (recency === "24h") return Date.now() - 86_400_000;
  if (recency === "7d") return Date.now() - 7 * 86_400_000;
  if (recency === "30d") return Date.now() - 30 * 86_400_000;
  return null;
}

function eventText(activity: ActivityRecord) {
  return [activity.event, activity.data.title, activity.data.status, ...Object.values(activity.data)].filter(Boolean).join(" ");
}

function actorText(activity: ActivityRecord) {
  return [activity.actor.type, activity.actor.id, activity.actor.displayName].filter(Boolean).join(" ");
}

function actorLabel(activity: ActivityRecord) {
  return activity.actor.displayName || activity.actor.id || activity.actor.type;
}

function statusLabel(activity: ActivityRecord) {
  const status = activity.data.status;
  return typeof status === "string" || typeof status === "number" || typeof status === "boolean" ? String(status) : null;
}

function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
