import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { UsageSummary } from "@/lib/types";

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export default function UsageSummaryCard() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try { setSummary(await api.getUsageSummary()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const topProvider = summary?.byProvider[0];

  return (
    <section className="spec-frame">
      <div className="spec-label">PROVIDER USAGE</div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="kicker mb-2">LLM LEDGER · TOKENS · COST</div>
          <p className="text-sm leading-6 text-ink-300">
            Token and cost accounting across every configured provider. Recent calls are streamed
            in below.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh usage summary"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-4 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          ERR · {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading usage summary…
        </div>
      ) : summary ? (
        <>
          <div className="mt-6 grid grid-cols-3 divide-x divide-ink-700 border-y border-ink-700">
            <StatCell label="COST · 24H" value={formatUsd(summary.last24h.costUsd)} />
            <StatCell label="CALLS · 24H" value={String(summary.last24h.calls)} />
            <StatCell
              label="TOP PROVIDER"
              value={topProvider ? topProvider.provider : "—"}
              suffix={topProvider ? `${topProvider.calls} calls` : undefined}
              mono
            />
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="kicker">RECENT CALLS · LATEST {Math.min(summary.recent.length, 8)}</span>
              <span className="kicker">
                TOTAL · {summary.totalCalls} CALLS · {formatUsd(summary.totalCostUsd)}
              </span>
            </div>
            {summary.recent.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-4 py-6 text-center text-xs text-ink-500">
                No provider calls recorded yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Provider</th>
                    <th>Model</th>
                    <th className="num">Tokens</th>
                    <th className="num">Cost</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent.slice(0, 8).map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-[11px] text-ink-200">{c.routeKey}</td>
                      <td className="font-mono text-[11px] lowercase text-ink-300">{c.provider}</td>
                      <td className="font-mono text-[11px] text-ink-400">{c.model}</td>
                      <td className="num">{c.promptTokens + c.completionTokens}</td>
                      <td className="num">{formatUsd(c.costUsd)}</td>
                      <td className="font-mono text-[11px] text-ink-400">{formatTime(c.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function StatCell({
  label,
  value,
  suffix,
  mono,
}: {
  label: string;
  value: string;
  suffix?: string;
  mono?: boolean;
}) {
  return (
    <div className="px-4 py-4 first:pl-0 last:pr-0">
      <div className="kicker">{label}</div>
      <div
        className={`mt-2 text-3xl tabular-nums ${
          mono ? "font-mono lowercase tracking-tight text-ink-100" : "font-mono text-ink-100"
        }`}
      >
        {value}
      </div>
      {suffix && <div className="mt-1 font-mono text-[11px] text-ink-500">{suffix}</div>}
    </div>
  );
}
