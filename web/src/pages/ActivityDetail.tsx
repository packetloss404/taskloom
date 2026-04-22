import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { ActivityDetailPayload } from "@/lib/types";

export default function ActivityDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<ActivityDetailPayload | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.getActivityDetail(id).then(setDetail).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="text-ink-300">
        <Link to="/activity" className="btn-ghost mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p>Activity not found.</p>
      </div>
    );
  }
  if (!detail) return <div className="text-sm text-ink-400">Loading activity detail…</div>;

  return (
    <>
      <Link to="/activity" className="btn-ghost mb-6">
        <ArrowLeft className="h-4 w-4" /> All activity
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-100">{String(detail.activity.data.title || detail.activity.event)}</h1>
        <p className="mt-2 text-sm text-ink-400">{detail.activity.scope} · {detail.activity.event}</p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="When" value={detail.activity.occurredAt} />
        <Stat label="Actor" value={detail.activity.actor.displayName || detail.activity.actor.id} />
        <Stat label="Scope" value={detail.activity.scope} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Event data</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4 text-xs text-ink-300">{JSON.stringify(detail.activity.data, null, 2)}</pre>
        </article>

        <article className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Timeline context</h2>
          <div className="mt-4 space-y-3 text-sm text-ink-300">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500">Previous</div>
              {detail.previous ? <Link to={`/activity/${detail.previous.id}`} className="mt-2 block rounded-2xl border border-ink-800/80 bg-ink-950/35 px-4 py-3 hover:border-ink-700">{String(detail.previous.data.title || detail.previous.event)}</Link> : <div className="mt-2 text-ink-500">No earlier event.</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500">Next</div>
              {detail.next ? <Link to={`/activity/${detail.next.id}`} className="mt-2 block rounded-2xl border border-ink-800/80 bg-ink-950/35 px-4 py-3 hover:border-ink-700">{String(detail.next.data.title || detail.next.event)}</Link> : <div className="mt-2 text-ink-500">No later event.</div>}
            </div>
          </div>
        </article>
      </section>
    </>
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
