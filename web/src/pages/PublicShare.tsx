import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { brand } from "@/config/brand";
import { api } from "@/lib/api";
import type { PublicSharePayload } from "@/lib/types";

export default function PublicSharePage() {
  const { token } = useParams();
  const [shared, setShared] = useState<PublicSharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Share token is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.getPublicShare(token)
      .then(setShared)
      .catch((shareError) => setError((shareError as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main className="min-h-screen bg-ink-950 text-ink-200">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-8 py-7 max-md:px-5">
        <Link to="/" className="flex items-center gap-3">
          <img src={brand.logoPath} alt={brand.name} className="h-7 w-auto" />
          <span className="kicker">PUBLIC SHARE</span>
        </Link>
        <Link to="/sign-in" className="btn-ghost">Sign in</Link>
      </header>

      <section className="mx-auto max-w-6xl px-8 pb-16 max-md:px-5">
        {loading ? (
          <div className="page-frame flex items-center gap-3 text-sm text-ink-400">
            <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING SHARE</span>
          </div>
        ) : error ? (
          <div className="border border-signal-red/50 bg-ink-900 px-5 py-4 font-mono text-sm text-signal-red">
            ERR · {error}
          </div>
        ) : shared ? (
          <SharedContent shared={shared} />
        ) : null}
      </section>
    </main>
  );
}

function SharedContent({ shared }: { shared: PublicSharePayload }) {
  const showBrief = shared.scope === "brief" || shared.scope === "overview";
  const showPlan = shared.scope === "plan" || shared.scope === "overview";

  return (
    <div className="page-frame">
      <div className="kicker mb-4">{shared.scope.toUpperCase()} · SHARED WORKSPACE</div>
      <h1 className="display-xl">{shared.workspace.name}</h1>
      {shared.workspace.automationGoal && (
        <p className="mt-5 max-w-3xl font-sans text-lg leading-7 text-ink-300">{shared.workspace.automationGoal}</p>
      )}

      {showBrief && shared.brief && (
        <section className="section-band">
          <div className="kicker mb-2">BRIEF</div>
          <h2 className="display text-2xl">{shared.brief.summary}</h2>
          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <ShareField label="Audience" value={shared.brief.audience} />
            <ShareField label="Desired outcome" value={shared.brief.desiredOutcome} />
            <ShareField label="Problem" value={shared.brief.problemStatement} />
            <ShareField label="Constraints" value={shared.brief.constraints} />
          </dl>
          {shared.brief.goals.length > 0 && <ShareList title="Goals" items={shared.brief.goals} />}
          {shared.brief.successMetrics?.length ? <ShareList title="Success metrics" items={shared.brief.successMetrics} /> : null}
        </section>
      )}

      {showPlan && (
        <section className="section-band">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="kicker mb-2">PLAN</div>
              <h2 className="display text-2xl">Requirements and implementation plan</h2>
            </div>
            <span className="section-marker">{shared.planItems?.length ?? 0} ITEMS</span>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="kicker mb-3">REQUIREMENTS</h3>
              <div className="space-y-3">
                {(shared.requirements ?? []).map((requirement) => (
                  <article key={requirement.id} className="border border-ink-700 bg-ink-900/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-serif text-lg text-ink-100">{requirement.title}</h4>
                      <span className="pill pill--muted">{requirement.priority}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink-400">{requirement.detail}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="kicker mb-3">PLAN ITEMS</h3>
              <div className="space-y-3">
                {(shared.planItems ?? []).map((item) => (
                  <article key={item.id} className="border border-ink-700 bg-ink-900/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-serif text-lg text-ink-100">{item.title}</h4>
                      <span className="pill pill--muted">{item.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink-400">{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ShareField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="border border-ink-700 bg-ink-900/60 p-4">
      <dt className="kicker mb-2">{label}</dt>
      <dd className="text-sm leading-6 text-ink-300">{value}</dd>
    </div>
  );
}

function ShareList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-6">
      <h3 className="kicker mb-3">{title}</h3>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-300">{item}</li>
        ))}
      </ul>
    </div>
  );
}
