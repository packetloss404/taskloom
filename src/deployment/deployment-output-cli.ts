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
const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
const PHASE58_REPORT_KEY_PATTERN = /^phase58/i;
const EVIDENCE_KEY_PATTERN = /evidence/i;

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

function firstReportByKey(
  report: DeploymentCliReport,
  matchesKey: (key: string) => boolean,
): DeploymentCliReport | null {
  for (const [key, entry] of Object.entries(report)) {
    if (matchesKey(key) && isReport(entry)) return entry;
    if (isReport(entry)) {
      const nestedReport = firstReportByKey(entry, matchesKey);
      if (nestedReport) return nestedReport;
    }
  }
  return null;
}

function redactValue(value: unknown, force = false, phase58Evidence = false, inPhase58Report = false): unknown {
  if (typeof value === "string") {
    if (!value) return value;
    return force || SECRET_URL_PATTERN.test(value) || (phase58Evidence && URL_PATTERN.test(value))
      ? "[redacted]"
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, force, phase58Evidence, inPhase58Report));
  }
  if (value && typeof value === "object") {
    const redacted: DeploymentCliReport = {};
    for (const [key, entry] of Object.entries(value)) {
      const sensitiveKey = SENSITIVE_KEY_PATTERN.test(key);
      const nestedInPhase58Report = inPhase58Report || PHASE58_REPORT_KEY_PATTERN.test(key);
      const nestedPhase58Evidence = phase58Evidence || (nestedInPhase58Report && EVIDENCE_KEY_PATTERN.test(key));
      redacted[key] = force && (key === "configured" || key === "redacted")
        ? entry
        : redactValue(entry, force || sensitiveKey, nestedPhase58Evidence, nestedInPhase58Report);
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
    } else if (
      (key === "phase57" ||
        key === "phase57MultiWriterImplementationScopeGate" ||
        key === "phase57MultiWriterImplementationScopeReport") &&
      isReport(entry)
    ) {
      blocked[key] = {
        ...entry,
        runtimeSupport: false,
        multiWriterSupported: false,
        runtimeImplementationBlocked: true,
        runtimeSupportBlocked: true,
        releaseAllowed: false,
      };
    } else if (PHASE58_REPORT_KEY_PATTERN.test(key) && isReport(entry)) {
      blocked[key] = {
        ...(blockMultiWriterRuntimeSupport(entry) as DeploymentCliReport),
        runtimeSupport: false,
        runtimeSupported: false,
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

function withPhase57Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const nestedPhase57 = firstReportAt(report, [
    ["phase57MultiWriterImplementationScopeGate"],
    ["phase57MultiWriterImplementationScopeReport"],
    ["managedDatabase", "phase57"],
    ["managedDatabase", "phase57MultiWriterImplementationScopeGate"],
    ["managedDatabaseTopology", "phase57"],
    ["managedDatabaseTopology", "managedDatabase", "phase57"],
    ["managedDatabaseTopology", "managedDatabase", "phase57MultiWriterImplementationScopeGate"],
    ["managedDatabaseRuntimeGuard", "phase57"],
    ["managedDatabaseRuntimeGuard", "phase57MultiWriterImplementationScopeGate"],
    ["runtimeGuard", "phase57"],
    ["runtimeGuard", "phase57MultiWriterImplementationScopeGate"],
    ["releaseReadiness", "phase57"],
    ["releaseReadiness", "phase57MultiWriterImplementationScopeGate"],
    ["releaseReadiness", "managedDatabaseTopology", "managedDatabase", "phase57"],
    ["releaseReadiness", "managedDatabaseRuntimeGuard", "phase57"],
    ["releaseEvidence", "phase57"],
    ["releaseEvidence", "phase57MultiWriterImplementationScopeGate"],
    ["evidence", "phase57"],
    ["evidence", "phase57MultiWriterImplementationScopeGate"],
    ["asyncStoreBoundary", "phase57"],
    ["asyncStoreBoundary", "phase57MultiWriterImplementationScopeGate"],
  ]);
  const existingPhase57 = reportAt(report, ["phase57"]) ?? nestedPhase57 ?? {};
  const implementationScopeEvidenceRequired =
    existingPhase57.implementationScopeEvidenceRequired ?? true;
  const implementationScopeEvidenceAttached =
    existingPhase57.implementationScopeEvidenceAttached ??
    existingPhase57.implementationScopeGatePassed ??
    existingPhase57.implementationScopeApproved ??
    existingPhase57.implementationScopeDefined ??
    existingPhase57.scopeEvidenceAttached ??
    false;
  const implementationScopeApproved =
    existingPhase57.implementationScopeApproved ??
    existingPhase57.implementationScopeGatePassed ??
    implementationScopeEvidenceAttached === true;
  const implementationScopeGatePassed =
    existingPhase57.implementationScopeGatePassed ?? implementationScopeApproved === true;

  return blockMultiWriterRuntimeSupport({
    ...report,
    phase57: {
      ...existingPhase57,
      phase: existingPhase57.phase ?? "57",
      required: existingPhase57.required ?? true,
      multiWriterTopologyRequested: existingPhase57.multiWriterTopologyRequested ?? true,
      implementationScopeEvidenceRequired,
      implementationScopeEvidenceAttached,
      implementationScopeApproved,
      implementationScopeGatePassed,
      runtimeSupport: false,
      multiWriterSupported: false,
      runtimeImplementationBlocked: true,
      runtimeSupportBlocked: true,
      releaseAllowed: false,
      strictBlocker: existingPhase57.strictBlocker ?? implementationScopeGatePassed !== true,
      summary: existingPhase57.summary ??
        "Phase 57 records explicitly scoped multi-writer implementation evidence before runtime or release support can be claimed; multi-writer runtime support remains blocked.",
    },
  });
}

function withPhase58Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const nestedPhase58 = firstReportAt(report, [
    ["phase58MultiWriterRuntimeImplementationValidationGate"],
    ["phase58MultiWriterRuntimeImplementationValidationReport"],
    ["phase58MultiWriterRuntimeValidationGate"],
    ["phase58MultiWriterRuntimeValidationReport"],
    ["managedDatabase", "phase58"],
    ["managedDatabase", "phase58MultiWriterRuntimeImplementationValidationGate"],
    ["managedDatabaseTopology", "phase58"],
    ["managedDatabaseTopology", "phase58MultiWriterRuntimeImplementationValidationGate"],
    ["managedDatabaseTopology", "managedDatabase", "phase58"],
    ["managedDatabaseRuntimeGuard", "phase58"],
    ["managedDatabaseRuntimeGuard", "phase58MultiWriterRuntimeImplementationValidationGate"],
    ["runtimeGuard", "phase58"],
    ["runtimeGuard", "phase58MultiWriterRuntimeImplementationValidationGate"],
    ["releaseReadiness", "phase58"],
    ["releaseReadiness", "phase58MultiWriterRuntimeImplementationValidationGate"],
    ["releaseReadiness", "managedDatabaseRuntimeGuard", "phase58"],
    ["releaseEvidence", "phase58"],
    ["releaseEvidence", "phase58MultiWriterRuntimeImplementationValidationGate"],
    ["evidence", "phase58"],
    ["evidence", "phase58MultiWriterRuntimeImplementationValidationGate"],
    ["asyncStoreBoundary", "phase58"],
    ["asyncStoreBoundary", "phase58MultiWriterRuntimeImplementationValidationGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE58_REPORT_KEY_PATTERN.test(key));
  const existingPhase58 = reportAt(report, ["phase58"]) ?? nestedPhase58 ?? {};
  const runtimeImplementationValidationEvidenceRequired =
    existingPhase58.runtimeImplementationValidationEvidenceRequired ??
    existingPhase58.validationEvidenceRequired ??
    true;
  const runtimeImplementationValidationEvidenceAttached =
    existingPhase58.runtimeImplementationValidationEvidenceAttached ??
    existingPhase58.validationEvidenceAttached ??
    existingPhase58.runtimeImplementationValidationGatePassed ??
    existingPhase58.validationGatePassed ??
    existingPhase58.runtimeImplementationValidated ??
    false;
  const runtimeImplementationValidated =
    existingPhase58.runtimeImplementationValidated ??
    existingPhase58.runtimeImplementationValidationGatePassed ??
    runtimeImplementationValidationEvidenceAttached === true;
  const runtimeImplementationValidationGatePassed =
    existingPhase58.runtimeImplementationValidationGatePassed ?? runtimeImplementationValidated === true;

  return blockMultiWriterRuntimeSupport({
    ...report,
    phase58: {
      ...existingPhase58,
      phase: existingPhase58.phase ?? "58",
      required: existingPhase58.required ?? true,
      multiWriterTopologyRequested: existingPhase58.multiWriterTopologyRequested ?? true,
      runtimeImplementationValidationEvidenceRequired,
      runtimeImplementationValidationEvidenceAttached,
      runtimeImplementationValidated,
      runtimeImplementationValidationGatePassed,
      runtimeSupport: false,
      runtimeSupported: false,
      multiWriterSupported: false,
      runtimeImplementationBlocked: true,
      runtimeSupportBlocked: true,
      releaseAllowed: false,
      strictBlocker: existingPhase58.strictBlocker ?? runtimeImplementationValidationGatePassed !== true,
      summary: existingPhase58.summary ??
        "Phase 58 validates multi-writer runtime implementation evidence before runtime or release support can be claimed; runtime and release support remain blocked.",
    },
  });
}

export function formatDeploymentCliJson(report: unknown, env: NodeJS.ProcessEnv): string {
  return JSON.stringify(
    redactValue(
      withPhase58Status(
        withPhase57Status(
          withPhase56Status(withPhase55Status(withPhase54Status(withPhase53Status(report, env), env), env), env),
          env,
        ),
        env,
      ),
    ),
    null,
    2,
  );
}
