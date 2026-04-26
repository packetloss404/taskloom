import { useEffect, useState } from "react";
import { Activity, DollarSign, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { UsageSummary } from "@/lib/types";

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
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
    <section className="card p-6">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Provider usage</h2>
          <p className="mt-1 text-xs text-ink-500">Token + cost ledger across all LLM providers.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>
      {error && <div className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
      {loading && !summary ? (
        <div className="flex items-center gap-2 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="Cost (24h)" value={formatUsd(summary.last24h.costUsd)} icon={<DollarSign className="h-3 w-3" />} />
            <Tile label="Calls (24h)" value={String(summary.last24h.calls)} icon={<Activity className="h-3 w-3" />} />
            <Tile label="Top provider" value={topProvider ? `${topProvider.provider} (${topProvider.calls})` : "—"} />
          </div>
          {summary.recent.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-ink-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-950/40 text-[10px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Route</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2 text-right">Tokens</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent.slice(0, 8).map((c) => (
                    <tr key={c.id} className="border-t border-ink-800/60">
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-300">{c.routeKey}</td>
                      <td className="px-3 py-2 text-ink-300">{c.provider}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-400">{c.model}</td>
                      <td className="px-3 py-2 text-right text-ink-300">{c.promptTokens + c.completionTokens}</td>
                      <td className="px-3 py-2 text-right text-ink-300">{formatUsd(c.costUsd)}</td>
                      <td className="px-3 py-2 text-ink-500">{new Date(c.completedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-800/80 bg-ink-950/35 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-500">{icon}{label}</div>
      <div className="mt-1.5 text-lg font-semibold text-ink-100">{value}</div>
    </div>
  );
}
