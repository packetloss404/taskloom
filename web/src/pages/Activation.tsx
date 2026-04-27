import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { ActivationDetailPayload } from "@/lib/types";
import StatusDot from "@/components/StatusDot";
import ActivityRow from "@/components/ActivityRow";

export default function ActivationPage() {
  const [detail, setDetail] = useState<ActivationDetailPayload | null>(null);

  useEffect(() => {
    api.getActivationDetail().then(setDetail).catch(() => setDetail(null));
  }, []);

  if (!detail) return <div className="page-frame text-sm text-ink-400">Loading activation detail…</div>;

  const status = detail.activation.summary.riskLevel === "high"
    ? "failing"
    : detail.activation.summary.progressPercent === 100
      ? "healthy"
      : detail.onboarding.status === "in_progress"
        ? "paused"
        : "never_run";

  return (
    <div className="page-frame">
      <Link to="/" className="btn-ghost mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <StatusDot status={status} showLabel />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-100">Activation overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">{detail.workspace.automationGoal || "No activation goal set yet."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/onboarding" className="btn-ghost">Continue onboarding</Link>
          <Link to="/settings" className="btn-primary">Edit workspace</Link>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Stage" value={detail.activation.summary.stageLabel} />
        <Stat label="Progress" value={detail.activation.summary.progressLabel} />
        <Stat label="Risk" value={detail.activation.summary.riskLabel} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Checklist</h2>
            <span className="text-xs text-ink-500">{detail.onboarding.currentStep.replaceAll("_", " ")}</span>
          </div>
          <div className="space-y-3">
            {detail.activation.summary.items.map((item) => (
              <div key={item.key} className="flex items-start gap-3 rounded-2xl border border-ink-800/80 bg-ink-950/35 px-4 py-3">
                <span className={`mt-1 inline-flex h-3 w-3 rounded-full ${item.completed ? "bg-emerald-400" : "border border-ink-600"}`} />
                <div>
                  <div className="text-sm font-medium text-ink-100">{item.label}</div>
                  <div className="mt-1 text-sm text-ink-400">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Recent activity</h2>
            <Link to="/activity" className="btn-ghost">All activity</Link>
          </div>
          <div className="px-1">
            {detail.activities.slice(0, 8).map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-1 text-[15px] text-ink-100">{value}</div>
    </div>
  );
}
