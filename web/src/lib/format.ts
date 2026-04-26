const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  const absMin = Math.abs(diffMs) / 60_000;

  if (absMin < 1) return diffMs < 0 ? "just now" : "in a moment";
  if (absMin < 60) return RELATIVE.format(Math.round(diffMs / 60_000), "minute");
  if (absMin < 60 * 24) return RELATIVE.format(Math.round(diffMs / 3_600_000), "hour");
  return RELATIVE.format(Math.round(diffMs / 86_400_000), "day");
}

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}
