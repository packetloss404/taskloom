import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { BootstrapPayload } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBootstrap()
      .then(setBootstrap)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const next = searchParams.get("next");

  const completeStep = async (stepKey: string) => {
    setSaving(stepKey);
    setError(null);
    try {
      await api.completeOnboardingStep(stepKey);
      await refreshSession();
      const nextBootstrap = await api.getBootstrap();
      setBootstrap(nextBootstrap);
      if (nextBootstrap.onboarding.status === "completed") {
        navigate(next && next.startsWith("/") ? next : "/", { replace: true });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-ink-950 text-ink-200">Loading onboarding…</div>;
  if (!bootstrap) return <div className="flex min-h-screen items-center justify-center bg-ink-950 text-rose-300">{error || "Failed to load onboarding."}</div>;

  const remaining = bootstrap.activation.summary.items.filter((item) => !item.completed);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 py-10 text-ink-100">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-ink-800/80 bg-ink-900/50 p-8 shadow-card backdrop-blur-sm lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-400/30 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-400">
            <Sparkles className="h-3.5 w-3.5" /> Guided setup
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-100">Complete the remaining Taskloom setup steps.</h1>
          <p className="mt-3 text-sm leading-6 text-ink-300">
            The current step and completion state are persisted on the server. Each completion updates the activation engine directly, so this flow stays aligned with the dashboard and settings views.
          </p>
          <div className="mt-8 space-y-3">
            {bootstrap.activation.summary.items.map((item) => (
              <div key={item.key} className="rounded-2xl border border-ink-800/80 bg-ink-950/35 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-ink-100">{item.label}</div>
                    <div className="mt-1 text-sm text-ink-400">{item.description}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${item.completed ? "bg-emerald-500/10 text-emerald-300" : "bg-ink-800 text-ink-300"}`}>
                    {item.completed ? "Complete" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-8">
          <div className="text-xs uppercase tracking-[0.22em] text-ink-500">Onboarding</div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-100">Current step</h2>
          <p className="mt-2 text-sm text-ink-400">{bootstrap.onboarding.currentStep.replaceAll("_", " ")}</p>

          <div className="mt-8 space-y-3">
            {remaining.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => completeStep(item.key)}
                className="w-full rounded-2xl border border-ink-800 bg-ink-950/35 px-4 py-3 text-left transition-colors hover:border-accent-400/50 hover:bg-ink-900/50"
                disabled={saving !== null}
              >
                <div className="text-sm font-medium text-ink-100">{item.label}</div>
                <div className="mt-1 text-xs text-ink-400">{saving === item.key ? "Completing…" : item.description}</div>
              </button>
            ))}
          </div>

          {error && <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
        </section>
      </div>
    </div>
  );
}
