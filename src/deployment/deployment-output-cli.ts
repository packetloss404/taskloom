export type DeploymentCliReport = Record<string, unknown>;

const MULTI_WRITER_TOPOLOGY_HINTS = new Set([
  "active-active",
  "distributed",
  "multi-host",
  "multi-node",
  "multi-region",
  "multi-writer",
  "production",
  "cluster",
]);
const SENSITIVE_KEY_PATTERN =
  /(secret|token|password|passwd|pwd|credential|private|apikey|api_key|auth|session|cookie|databaseurl|database_url|manageddatabaseurl|managed_database_url)/i;
const SECRET_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalize(value: string | undefined): string {
  return clean(value).toLowerCase();
}

function hasMultiWriterTopologyIntent(env: NodeJS.ProcessEnv): boolean {
  return MULTI_WRITER_TOPOLOGY_HINTS.has(normalize(env.TASKLOOM_DATABASE_TOPOLOGY));
}

function redactValue(value: unknown, force = false): unknown {
  if (typeof value === "string") {
    if (!value) return value;
    return force || SECRET_URL_PATTERN.test(value) ? "[redacted]" : value;
  }
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, force));
  if (value && typeof value === "object") {
    const redacted: DeploymentCliReport = {};
    for (const [key, entry] of Object.entries(value)) {
      const sensitiveKey = SENSITIVE_KEY_PATTERN.test(key);
      redacted[key] = force && (key === "configured" || key === "redacted")
        ? entry
        : redactValue(entry, force || sensitiveKey);
    }
    return redacted;
  }
  return force && value !== null && value !== undefined ? "[redacted]" : value;
}

function withPhase53Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !report || typeof report !== "object" || Array.isArray(report)) {
    return report;
  }

  const existingReport = report as DeploymentCliReport;
  const existingPhase53 = existingReport.phase53 && typeof existingReport.phase53 === "object" && !Array.isArray(existingReport.phase53)
    ? existingReport.phase53 as DeploymentCliReport
    : {};

  return {
    ...existingReport,
    phase53: {
      ...existingPhase53,
      phase: "53",
      multiWriterTopologyRequested: existingPhase53.multiWriterTopologyRequested ?? true,
      multiWriterSupported: existingPhase53.multiWriterSupported ?? existingPhase53.runtimeSupport ?? false,
      summary: existingPhase53.summary ??
        "Phase 53 keeps multi-writer deployment topology blocked until managed runtime coordination support exists.",
    },
  };
}

export function formatDeploymentCliJson(report: unknown, env: NodeJS.ProcessEnv): string {
  return JSON.stringify(redactValue(withPhase53Status(report, env)), null, 2);
}
