import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Bot, Clock3, HelpCircle, PlayCircle, UserRound, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type { ActivityDetailPayload, ActivityRecord, ActivityWorkflowContext, AgentRecord, AgentRunRecord } from "@/lib/types";

export default function ActivityDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<ActivityDetailPayload | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setDetail(null);
    setNotFound(false);
    api.getActivityDetail(id).then(setDetail).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="page-frame text-ink-300">
        <Link to="/activity" className="btn-ghost mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p>Activity not found.</p>
      </div>
    );
  }
  if (!detail) return <div className="page-frame text-sm text-ink-400">Loading activity detail…</div>;

  const activity = detail.activity;
  const actorName = activity.actor?.displayName || activity.actor?.id || "System";
  const relatedAgent = detail.related?.agent ?? detail.agent ?? null;
  const relatedRun = detail.related?.run ?? detail.run ?? null;
  const relatedWorkflow = detail.related?.workflow ?? detail.workflow ?? null;

  return (
    <div className="page-frame">
      <Link to="/activity" className="btn-ghost mb-6">
        <ArrowLeft className="h-4 w-4" /> All activity
      </Link>

      <header className="relative mb-8 overflow-hidden border border-ink-700 bg-ink-875 p-5 shadow-card sm:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal-amber/80 to-transparent" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="kicker mb-3">Control room / Activity detail</div>
            <h1 className="break-words text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">{activityTitle(activity)}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-400">
              {sentenceCase(activity.event)} event captured for the {activity.scope} scope.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[24rem]">
            <HeroStat label="Scope" value={activity.scope} />
            <HeroStat label="Event" value={activity.event} mono />
          </div>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SignalCard icon={<Clock3 className="h-4 w-4" />} label="When" value={relative(activity.occurredAt)} detail={activity.occurredAt} />
        <SignalCard icon={<UserRound className="h-4 w-4" />} label="Actor" value={actorName} detail={activity.actor?.type || "unknown"} />
        <SignalCard label="Activity ID" value={activity.id} detail="Trace reference" mono />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <main className="space-y-6">
          <article className="card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-300">Decoded data</h2>
                <p className="mt-1 text-sm text-ink-500">Readable fields extracted from the event payload.</p>
              </div>
              <span className="rounded-full border border-ink-800 px-3 py-1 text-xs text-ink-500">{dataEntries(activity).length} fields</span>
            </div>
            <DecodedData activity={activity} />
          </article>

          <article className="card p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-300">Raw payload</h2>
            <p className="mt-1 text-sm text-ink-500">Available for debugging without making JSON the primary view.</p>
            <details className="mt-4 rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-200">Show JSON payload</summary>
              <pre className="mt-4 max-h-[28rem] overflow-auto text-xs leading-5 text-ink-300">{JSON.stringify(activity.data ?? {}, null, 2)}</pre>
            </details>
          </article>
        </main>

        <aside className="space-y-6">
          <article className="card p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-300">Timeline navigation</h2>
            <div className="mt-4 grid gap-3">
              <TimelineLink label="Previous" activity={detail.previous} direction="back" />
              <TimelineLink label="Next" activity={detail.next} direction="forward" />
            </div>
          </article>

          <article className="card p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-300">Related context</h2>
            <div className="mt-4 space-y-3">
              {relatedAgent && <AgentPanel agent={relatedAgent} />}
              {relatedRun && <RunPanel run={relatedRun} />}
              {relatedWorkflow && <WorkflowPanel workflow={relatedWorkflow} />}
              {!relatedAgent && !relatedRun && !relatedWorkflow && (
                <div className="rounded-2xl border border-dashed border-ink-800 bg-ink-950/20 p-4 text-sm text-ink-500">
                  No related agent, run, or workflow context was provided for this event.
                </div>
              )}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}

function HeroStat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className={`mt-2 truncate text-sm text-ink-100 ${mono ? "font-mono" : "capitalize"}`}>{value}</div>
    </div>
  );
}

function SignalCard({ icon, label, value, detail, mono = false }: { icon?: ReactNode; label: string; value: string; detail?: string; mono?: boolean }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-400">
        {icon}
        {label}
      </div>
      <div className={`mt-2 break-words text-[15px] text-ink-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
      {detail && <div className="mt-1 break-words text-xs text-ink-500">{detail}</div>}
    </div>
  );
}

function DecodedData({ activity }: { activity: ActivityRecord }) {
  const entries = dataEntries(activity);
  if (entries.length === 0) return <div className="mt-4 rounded-2xl border border-dashed border-ink-800 p-4 text-sm text-ink-500">No event data fields were provided.</div>;

  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-2xl border border-ink-800/80 bg-ink-950/25 p-4">
          <dt className="text-xs uppercase tracking-[0.18em] text-ink-500">{labelize(key)}</dt>
          <dd className="mt-2 break-words text-sm leading-6 text-ink-200">{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TimelineLink({ label, activity, direction }: { label: string; activity: ActivityRecord | null | undefined; direction: "back" | "forward" }) {
  const Icon = direction === "back" ? ArrowLeft : ArrowRight;
  if (!activity) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-800 bg-ink-950/20 p-4 text-sm text-ink-500">
        <div className="text-xs uppercase tracking-[0.18em]">{label}</div>
        <div className="mt-2">No {direction === "back" ? "earlier" : "later"} event.</div>
      </div>
    );
  }

  return (
    <Link to={`/activity/${activity.id}`} className="group block rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4 transition-colors hover:border-signal-amber/60">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-ink-500">
        {label}
        <Icon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-2 text-sm font-medium text-ink-100">{activityTitle(activity)}</div>
      <div className="mt-1 text-xs text-ink-500">{relative(activity.occurredAt)} · {activity.event}</div>
    </Link>
  );
}

function AgentPanel({ agent }: { agent: Partial<AgentRecord> }) {
  return (
    <ContextPanel icon={<Bot className="h-4 w-4" />} title={stringValue(agent.name) || "Related agent"} label="Agent" href={stringValue(agent.id) ? `/agents/${agent.id}` : "/agents"}>
      <MetaLine label="Status" value={stringValue(agent.status)} />
      <MetaLine label="Model" value={stringValue(agent.model)} />
      <MetaLine label="Updated" value={relative(stringValue(agent.updatedAt))} />
    </ContextPanel>
  );
}

function RunPanel({ run }: { run: Partial<AgentRunRecord> }) {
  return (
    <ContextPanel icon={<PlayCircle className="h-4 w-4" />} title={stringValue(run.title) || "Related run"} label="Run" href="/runs">
      <MetaLine label="Status" value={stringValue(run.status)} />
      <MetaLine label="Trigger" value={stringValue(run.triggerKind)} />
      <MetaLine label="Created" value={relative(stringValue(run.createdAt))} />
    </ContextPanel>
  );
}

function WorkflowPanel({ workflow }: { workflow: ActivityWorkflowContext }) {
  const counts = [
    countLabel(workflow.requirements, "requirement"),
    countLabel(workflow.planItems, "plan item"),
    countLabel(workflow.blockers, "blocker"),
    countLabel(workflow.questions, "question"),
  ].filter(Boolean);

  const activeBlockers = (workflow.blockers ?? []).filter((b) => {
    const status = (b.status ?? "").toString().toLowerCase();
    return status !== "resolved" && status !== "closed" && status !== "obsolete";
  });
  const openQuestions = (workflow.questions ?? []).filter((q) => {
    const status = (q.status ?? "").toString().toLowerCase();
    return status !== "answered" && status !== "closed" && status !== "obsolete";
  });

  const visibleBlockers = activeBlockers.slice(0, 3);
  const extraBlockers = activeBlockers.length - visibleBlockers.length;
  const visibleQuestions = openQuestions.slice(0, 3);
  const extraQuestions = openQuestions.length - visibleQuestions.length;

  return (
    <ContextPanel icon={<Workflow className="h-4 w-4" />} title={workflow.brief?.summary || "Workflow context"} label="Workflow" href="/workflows">
      <MetaLine label="Audience" value={workflow.brief?.audience} />
      <MetaLine label="Updated" value={relative(workflow.brief?.updatedAt)} />
      {counts.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{counts.map((count) => <span key={count} className="rounded-full border border-ink-800 px-2.5 py-1 text-xs text-ink-400">{count}</span>)}</div>}

      <div className="mt-4 space-y-1.5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Active blockers</div>
        {visibleBlockers.length === 0 ? (
          <div className="text-xs text-ink-500">No active blockers.</div>
        ) : (
          <ul className="space-y-1">
            {visibleBlockers.map((blocker, index) => {
              const title = stringValue(blocker.title) || stringValue(blocker.detail) || stringValue(blocker.description) || "Untitled blocker";
              return (
                <li key={stringValue(blocker.id) || `blocker-${index}`} className="flex items-start gap-2 text-xs text-ink-300">
                  <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${severityColor(blocker.severity)}`} />
                  <span className="break-words">{title}</span>
                </li>
              );
            })}
          </ul>
        )}
        {extraBlockers > 0 && <div className="text-[11px] text-ink-500">+ {extraBlockers} more</div>}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500">Open questions</div>
        {visibleQuestions.length === 0 ? (
          <div className="text-xs text-ink-500">No open questions.</div>
        ) : (
          <ul className="space-y-1">
            {visibleQuestions.map((question, index) => {
              const title = stringValue(question.title) || stringValue(question.prompt) || stringValue(question.description) || "Untitled question";
              return (
                <li key={stringValue(question.id) || `question-${index}`} className="flex items-start gap-2 text-xs text-ink-300">
                  <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="break-words">{title}</span>
                </li>
              );
            })}
          </ul>
        )}
        {extraQuestions > 0 && <div className="text-[11px] text-ink-500">+ {extraQuestions} more</div>}
      </div>

      <Link to="/workflows" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-signal-amber hover:text-signal-amber/80">
        View workflow <ArrowRight className="h-3 w-3" />
      </Link>
    </ContextPanel>
  );
}

function severityColor(severity: unknown): string {
  const s = typeof severity === "string" ? severity.toLowerCase() : "";
  if (s === "critical" || s === "high") return "text-rose-500";
  if (s === "medium") return "text-amber-500";
  return "text-slate-400";
}

function ContextPanel({ icon, label, title, href, children }: { icon: ReactNode; label: string; title: string; href: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-950/30 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink-500">
        {icon}
        {label}
      </div>
      <Link to={href} className="mt-2 block break-words text-sm font-medium text-ink-100 hover:text-signal-amber">{title}</Link>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: unknown }) {
  const rendered = renderValue(value);
  if (rendered === "—") return null;
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-ink-500">{label}</span>
      <span className="break-words text-right text-ink-300">{rendered}</span>
    </div>
  );
}

function activityTitle(activity: ActivityRecord): string {
  return stringValue(activity.data?.title) || stringValue(activity.data?.name) || sentenceCase(activity.event);
}

function dataEntries(activity: ActivityRecord): [string, unknown][] {
  return Object.entries(activity.data ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "—";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length ? value.map(renderValue).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function labelize(key: string): string {
  return key.replace(/[_-]/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sentenceCase(value: string): string {
  return labelize(value).replace(/\b\w/g, (char, index) => (index === 0 ? char.toUpperCase() : char.toLowerCase()));
}

function countLabel(items: unknown[] | undefined, singular: string): string | null {
  if (!items?.length) return null;
  return `${items.length} ${singular}${items.length === 1 ? "" : "s"}`;
}
