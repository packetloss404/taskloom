import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { BootstrapPayload, PublicDashboardPayload } from "@/lib/types";
import NewActionTile from "@/components/NewActionTile";
import { useAuth } from "@/context/AuthContext";
import WorkspaceCard, { type WorkspaceCardModel } from "@/components/WorkspaceCard";

export default function DashboardPage() {
  const { session, loading } = useAuth();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [publicDashboard, setPublicDashboard] = useState<PublicDashboardPayload | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (session) {
      api.getBootstrap().then(setBootstrap).catch(() => setBootstrap(null));
      setPublicDashboard(null);
      return;
    }

    api.getPublicDashboard().then(setPublicDashboard).catch(() => setPublicDashboard({ summaries: [] }));
    setBootstrap(null);
  }, [session]);

  const ready = session ? bootstrap !== null : publicDashboard !== null;
  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-ink-950 text-ink-100">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <div className="text-sm text-ink-400">Loading workspace…</div>
        </div>
      </div>
    );
  }

  if (!session && publicDashboard) {
    const cards: WorkspaceCardModel[] = publicDashboard.summaries.map((entry) => ({
      id: entry.subject.workspaceId,
      name: entry.subject.workspaceId,
      description: entry.summary.nextRecommendedAction || entry.summary.title,
      status: entry.summary.riskLevel === "high" ? "failing" : entry.summary.progressPercent === 100 ? "healthy" : "paused",
      href: "/sign-in",
      primaryMeta: entry.summary.stageLabel,
      secondaryMeta: `${entry.summary.progressLabel} · ${entry.summary.riskLabel} risk`,
      updatedAt: null,
    }));

    const filteredPublic = cards.filter((entry) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return entry.name.toLowerCase().includes(q)
        || entry.description.toLowerCase().includes(q)
        || entry.secondaryMeta.toLowerCase().includes(q);
    });

    return (
      <div className="min-h-screen bg-ink-950 text-ink-100">
        <div className="mx-auto max-w-6xl px-8 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-100">Workspaces</h1>
            <p className="mt-1 text-sm text-ink-400">
              <span className="text-ink-200">{cards.length}</span> total ·{" "}
              <span className="text-ink-200">{cards.filter((card) => card.status === "healthy").length}</span> healthy
              {cards.filter((card) => card.status === "failing").length > 0 && (
                <>
                  {" · "}
                  <span className="text-rose-400">{cards.filter((card) => card.status === "failing").length} failing</span>
                </>
              )}
            </p>
          </div>
          <Link to="/sign-in" className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.25} /> Sign in
          </Link>
        </header>

        <div className="mb-6 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspaces"
              className="w-full rounded-xl border border-ink-700 bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-ink-100 placeholder:text-ink-400 focus:border-accent-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400/20"
            />
          </div>
        </div>

        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPublic.map((entry) => (
              <WorkspaceCard key={entry.id} workspace={entry} />
            ))}
            <NewActionTile label="Create account" helper="Start a workspace-backed session" to="/sign-up" />
          </div>
        </section>
        </div>
      </div>
    );
  }

  if (!bootstrap) return <div className="text-sm text-ink-400">Loading workspace…</div>;

  const cards = useMemo<WorkspaceCardModel[]>(() => {
    const summary = bootstrap.activation.summary;
    const status = summary.riskLevel === "high"
      ? "failing"
      : summary.progressPercent === 100
        ? "healthy"
        : bootstrap.onboarding.status === "completed"
          ? "healthy"
          : bootstrap.onboarding.status === "not_started"
            ? "never_run"
            : "paused";

    return [
      {
        id: "activation-overview",
        name: "Activation overview",
        description: bootstrap.workspace.automationGoal || "No activation goal set yet.",
        status,
        href: "/activation",
        primaryMeta: summary.stageLabel,
        secondaryMeta: `${summary.progressLabel} · ${summary.riskLabel} risk`,
        updatedAt: bootstrap.onboarding.updatedAt,
      },
      {
        id: "onboarding-state",
        name: "Onboarding state",
        description: `Current step: ${bootstrap.onboarding.currentStep.replaceAll("_", " ")}`,
        status: bootstrap.onboarding.status === "completed" ? "healthy" : bootstrap.onboarding.status === "in_progress" ? "paused" : "never_run",
        href: "/onboarding",
        primaryMeta: bootstrap.onboarding.status,
        secondaryMeta: `${bootstrap.onboarding.completedSteps.length} steps completed`,
        updatedAt: bootstrap.onboarding.updatedAt,
      },
      {
        id: "recent-activity",
        name: "Recent activity",
        description: String(bootstrap.activities[0]?.data.title || "No recent activity yet."),
        status: bootstrap.activities.length > 0 ? "healthy" : "never_run",
        href: "/activity",
        primaryMeta: `${bootstrap.activities.length} events visible`,
        secondaryMeta: "Workspace + activation feed",
        updatedAt: bootstrap.activities[0]?.occurredAt ?? null,
      },
    ];
  }, [bootstrap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => card.name.toLowerCase().includes(q) || card.description.toLowerCase().includes(q) || card.secondaryMeta.toLowerCase().includes(q));
  }, [cards, query]);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-100">Workspaces</h1>
          <p className="mt-1 text-sm text-ink-400">
            <span className="text-ink-200">{cards.length}</span> total ·{" "}
            <span className="text-ink-200">{cards.filter((card) => card.status === "healthy").length}</span> healthy
            {cards.filter((card) => card.status === "failing").length > 0 && (
              <>
                {" · "}
                <span className="text-rose-400">{cards.filter((card) => card.status === "failing").length} failing</span>
              </>
            )}
          </p>
        </div>
        <Link to="/settings" className="btn-primary">
          <Plus className="h-4 w-4" strokeWidth={2.25} /> Refine workspace
        </Link>
      </header>

      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            strokeWidth={1.75}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workspaces"
            className="w-full rounded-xl border border-ink-700 bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-ink-100 placeholder:text-ink-400 focus:border-accent-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((card) => (
          <WorkspaceCard key={card.id} workspace={card} />
        ))}
        <NewActionTile />
      </div>
    </>
  );
}
