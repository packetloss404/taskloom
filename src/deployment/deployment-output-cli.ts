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

function isReport(value: unknown): value is DeploymentCliReport {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function reportAt(report: DeploymentCliReport, path: string[]): DeploymentCliReport | null {
  let current: unknown = report;
  for (const key of path) {
    if (!isReport(current)) return null;
    current = current[key];
  }
  return isReport(current) ? current : null;
}

function firstReportAt(report: DeploymentCliReport, paths: string[][]): DeploymentCliReport | null {
  for (const path of paths) {
    const nestedReport = reportAt(report, path);
    if (nestedReport) return nestedReport;
  }
  return null;
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
  return value;
}

function blockMultiWriterRuntimeSupport(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => blockMultiWriterRuntimeSupport(entry));
  }
  if (!isReport(value)) {
    return value;
  }

  const blocked: DeploymentCliReport = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "phase55" && isReport(entry)) {
      blocked[key] = {
        ...entry,
        runtimeSupport: false,
        multiWriterSupported: false,
        runtimeImplementationBlocked: true,
      };
    } else if ((key === "phase56" || key === "phase56MultiWriterRuntimeReadinessGate") && isReport(entry)) {
      blocked[key] = {
        ...entry,
        runtimeSupport: false,
        multiWriterSupported: false,
        runtimeImplementationBlocked: true,
        runtimeSupportBlocked: true,
        releaseAllowed: false,
      };
    } else {
      blocked[key] = blockMultiWriterRuntimeSupport(entry);
    }
  }
  return blocked;
}

function withPhase53Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const existingReport = report;
  const existingPhase53 = reportAt(existingReport, ["phase53"]) ?? {};

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

function withPhase54Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const nestedPhase54 =
    reportAt(report, ["managedDatabase", "phase54"]) ??
    reportAt(report, ["managedDatabaseTopology", "managedDatabase", "phase54"]) ??
    reportAt(report, ["releaseReadiness", "managedDatabaseTopology", "managedDatabase", "phase54"]);
  const existingPhase54 = reportAt(report, ["phase54"]) ?? nestedPhase54 ?? {};
  const designPackageGatePassed = existingPhase54.designPackageGatePassed ?? existingPhase54.designPackageReady ?? false;

  return {
    ...report,
    phase54: {
      ...existingPhase54,
      phase: existingPhase54.phase ?? "54",
      multiWriterTopologyRequested: existingPhase54.multiWriterTopologyRequested ?? true,
      designPackageGatePassed,
      runtimeSupport: existingPhase54.runtimeSupport ?? false,
      strictBlocker: existingPhase54.strictBlocker ?? designPackageGatePassed !== true,
      summary: existingPhase54.summary ??
        "Phase 54 requires a multi-writer topology design package before distributed or active-active deployment can proceed.",
    },
  };
}

function withPhase55Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const nestedPhase55 = firstReportAt(report, [
    ["managedDatabase", "phase55"],
    ["managedDatabaseTopology", "managedDatabase", "phase55"],
    ["releaseReadiness", "managedDatabaseTopology", "managedDatabase", "phase55"],
    ["asyncStoreBoundary", "phase55"],
    ["releaseReadiness", "asyncStoreBoundary", "phase55"],
  ]);
  const existingPhase55 = reportAt(report, ["phase55"]) ?? nestedPhase55 ?? {};
  const designPackageReviewPassed =
    existingPhase55.designPackageReviewPassed ?? existingPhase55.reviewGatePassed ?? false;
  const implementationAuthorized =
    existingPhase55.implementationAuthorized ?? existingPhase55.implementationAuthorizationGranted ?? false;

  return blockMultiWriterRuntimeSupport({
    ...report,
    phase55: {
      ...existingPhase55,
      phase: existingPhase55.phase ?? "55",
      multiWriterTopologyRequested: existingPhase55.multiWriterTopologyRequested ?? true,
      designPackageReviewPassed,
      implementationAuthorized,
      runtimeSupport: false,
      multiWriterSupported: false,
      runtimeImplementationBlocked: true,
      strictBlocker: existingPhase55.strictBlocker ??
        (designPackageReviewPassed !== true || implementationAuthorized !== true),
      summary: existingPhase55.summary ??
        "Phase 55 requires multi-writer topology design-package review and implementation authorization before runtime implementation; runtime support remains blocked.",
    },
  });
}

function withPhase56Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const nestedPhase56 = firstReportAt(report, [
    ["phase56MultiWriterRuntimeReadinessGate"],
    ["managedDatabase", "phase56"],
    ["managedDatabaseTopology", "managedDatabase", "phase56"],
    ["releaseReadiness", "managedDatabaseTopology", "managedDatabase", "phase56"],
    ["asyncStoreBoundary", "phase56"],
    ["asyncStoreBoundary", "phase56MultiWriterRuntimeReadinessGate"],
    ["releaseReadiness", "asyncStoreBoundary", "phase56"],
    ["releaseReadiness", "asyncStoreBoundary", "phase56MultiWriterRuntimeReadinessGate"],
  ]);
  const existingPhase56 = reportAt(report, ["phase56"]) ?? nestedPhase56 ?? {};
  const implementationReadinessEvidenceRequired =
    existingPhase56.implementationReadinessEvidenceRequired ?? true;
  const implementationReadinessEvidenceAttached =
    existingPhase56.implementationReadinessEvidenceAttached ??
    existingPhase56.implementationReadinessGatePassed ??
    existingPhase56.runtimeImplementationReady ??
    false;
  const rolloutSafetyEvidenceRequired = existingPhase56.rolloutSafetyEvidenceRequired ?? true;
  const rolloutSafetyEvidenceAttached =
    existingPhase56.rolloutSafetyEvidenceAttached ??
    existingPhase56.rolloutSafetyGatePassed ??
    existingPhase56.rolloutSafetyReady ??
    false;
  const runtimeImplementationReady =
    existingPhase56.runtimeImplementationReady ?? implementationReadinessEvidenceAttached === true;
  const rolloutSafetyReady = existingPhase56.rolloutSafetyReady ?? rolloutSafetyEvidenceAttached === true;
  const runtimeReadinessComplete =
    existingPhase56.runtimeReadinessComplete ??
    existingPhase56.implementationReadinessGatePassed ??
    (runtimeImplementationReady === true && rolloutSafetyReady === true);

  return blockMultiWriterRuntimeSupport({
    ...report,
    phase56: {
      ...existingPhase56,
      phase: existingPhase56.phase ?? "56",
      required: existingPhase56.required ?? true,
      multiWriterTopologyRequested: existingPhase56.multiWriterTopologyRequested ?? true,
      implementationReadinessEvidenceRequired,
      implementationReadinessEvidenceAttached,
      rolloutSafetyEvidenceRequired,
      rolloutSafetyEvidenceAttached,
      runtimeImplementationReady,
      rolloutSafetyReady,
      runtimeReadinessComplete,
      implementationReadinessGatePassed: runtimeReadinessComplete,
      runtimeSupport: false,
      multiWriterSupported: false,
      runtimeImplementationBlocked: true,
      runtimeSupportBlocked: true,
      releaseAllowed: false,
      strictBlocker: existingPhase56.strictBlocker ?? runtimeReadinessComplete !== true,
      summary: existingPhase56.summary ??
        "Phase 56 requires multi-writer runtime implementation-readiness and rollout-safety evidence before runtime support can be claimed; runtime support remains blocked.",
    },
  });
}

export function formatDeploymentCliJson(report: unknown, env: NodeJS.ProcessEnv): string {
  return JSON.stringify(
    redactValue(withPhase56Status(withPhase55Status(withPhase54Status(withPhase53Status(report, env), env), env), env)),
    null,
    2,
  );
}
