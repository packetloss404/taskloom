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
const PHASE59_REPORT_KEY_PATTERN = /^phase59/i;
const PHASE60_REPORT_KEY_PATTERN = /^phase60/i;
const PHASE61_REPORT_KEY_PATTERN = /^phase61/i;
const PHASE62_REPORT_KEY_PATTERN = /^phase62/i;
const PHASE63_REPORT_KEY_PATTERN = /^phase63/i;
const PHASE64_REPORT_KEY_PATTERN = /^phase64/i;
const PHASE65_REPORT_KEY_PATTERN = /^phase65/i;
const EVIDENCE_KEY_PATTERN = /evidence/i;
const PHASE59_URL_REDACTION_KEY_PATTERN = /(evidence|ticket|abort|signoff|runbook|approval)/i;
const PHASE60_URL_REDACTION_KEY_PATTERN =
  /(implementation|statement|matrix|evidence|cutover|approval|acceptance|support)/i;
const PHASE61_URL_REDACTION_KEY_PATTERN =
  /(active|regional|pitr|sqlite|distributed|support|claim|evidence|ticket|approval|url)/i;
const PHASE62_URL_REDACTION_KEY_PATTERN =
  /(implementation|hardening|concurrency|transaction|retry|compare|swap|evidence|url)/i;
const PHASE63_URL_REDACTION_KEY_PATTERN =
  /(rate|limit|scheduler|coordination|durable|job|access|log|shipping|alert|delivery|health|monitoring|evidence|url)/i;
const PHASE64_URL_REDACTION_KEY_PATTERN =
  /(backup|restore|pitr|failover|rehearsal|integrity|recovery|time|expectation|evidence|url)/i;
const PHASE65_URL_REDACTION_KEY_PATTERN =
  /(cutover|preflight|activation|dry|run|smoke|rollback|command|guidance|monitoring|threshold|operations|health|status|safe|posture|evidence|url)/i;
const UNSUPPORTED_RUNTIME_RELEASE_CLAIM_KEY_PATTERNS = [
  /(activeactive|active_active|active-active).*(support|supported|releaseallowed|releasesupported|runtimesupport)/i,
  /(support|supported|releaseallowed|releasesupported|runtimesupport).*(activeactive|active_active|active-active)/i,
  /regional.*(support|supported|releaseallowed|releasesupported|runtimesupport)/i,
  /(support|supported|releaseallowed|releasesupported|runtimesupport).*regional/i,
  /pitr.*(support|supported|releaseallowed|releasesupported|runtimesupport)/i,
  /(support|supported|releaseallowed|releasesupported|runtimesupport).*pitr/i,
  /(sqlitedistributed|sqlite_distributed|sqlite-distributed|distributedsqlite|distributed_sqlite|distributed-sqlite).*(support|supported|releaseallowed|releasesupported|runtimesupport)/i,
  /(support|supported|releaseallowed|releasesupported|runtimesupport).*(sqlitedistributed|sqlite_distributed|sqlite-distributed|distributedsqlite|distributed_sqlite|distributed-sqlite)/i,
];
const HORIZONTAL_WRITER_TOPOLOGY_HINTS = new Set([
  "managed-postgres-horizontal-app-writers",
  "managed-postgres-horizontal-writers",
  "postgres-horizontal-app-writers",
  "postgres-horizontal-writers",
]);
const DURABLE_JOB_EXECUTION_POSTURES = new Set([
  "managed-postgres-transactional-queue",
  "managed-postgres-durable-jobs",
  "shared-managed-postgres",
  "external-durable-queue",
]);

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalize(value: string | undefined): string {
  return clean(value).toLowerCase();
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(normalize(value));
}

function hasMultiWriterTopologyIntent(env: NodeJS.ProcessEnv): boolean {
  return MULTI_WRITER_TOPOLOGY_HINTS.has(normalize(env.TASKLOOM_DATABASE_TOPOLOGY));
}

function hasHorizontalWriterTopologyIntent(env: NodeJS.ProcessEnv): boolean {
  return HORIZONTAL_WRITER_TOPOLOGY_HINTS.has(normalize(env.TASKLOOM_DATABASE_TOPOLOGY));
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

function redactValue(
  value: unknown,
  force = false,
  redactPhaseUrl = false,
  inPhaseUrlRedactionReport = false,
  inPhase59Report = false,
  inPhase60Report = false,
  inPhase61Report = false,
): unknown {
  if (typeof value === "string") {
    if (!value) return value;
    return force || SECRET_URL_PATTERN.test(value) || (redactPhaseUrl && URL_PATTERN.test(value))
      ? "[redacted]"
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      redactValue(
        entry,
        force,
        redactPhaseUrl,
        inPhaseUrlRedactionReport,
        inPhase59Report,
        inPhase60Report,
        inPhase61Report,
      )
    );
  }
  if (value && typeof value === "object") {
    const redacted: DeploymentCliReport = {};
    for (const [key, entry] of Object.entries(value)) {
      const sensitiveKey = SENSITIVE_KEY_PATTERN.test(key);
      const nestedInPhaseUrlRedactionReport =
        inPhaseUrlRedactionReport ||
        PHASE58_REPORT_KEY_PATTERN.test(key) ||
        PHASE59_REPORT_KEY_PATTERN.test(key) ||
        PHASE60_REPORT_KEY_PATTERN.test(key) ||
        PHASE61_REPORT_KEY_PATTERN.test(key) ||
        PHASE62_REPORT_KEY_PATTERN.test(key) ||
        PHASE63_REPORT_KEY_PATTERN.test(key) ||
        PHASE64_REPORT_KEY_PATTERN.test(key) ||
        PHASE65_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase59Report = inPhase59Report || PHASE59_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase60Report = inPhase60Report || PHASE60_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase61Report = inPhase61Report || PHASE61_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase62Report = PHASE62_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase63Report = PHASE63_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase64Report = PHASE64_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase65Report = PHASE65_REPORT_KEY_PATTERN.test(key);
      const nestedRedactPhaseUrl =
        redactPhaseUrl ||
        (nestedInPhase59Report && PHASE59_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhase60Report && PHASE60_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhase61Report && PHASE61_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhase62Report && PHASE62_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhase63Report && PHASE63_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhase64Report && PHASE64_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhase65Report && PHASE65_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhaseUrlRedactionReport && EVIDENCE_KEY_PATTERN.test(key));
      redacted[key] = force && (key === "configured" || key === "redacted")
        ? entry
        : redactValue(
          entry,
          force || sensitiveKey,
          nestedRedactPhaseUrl,
          nestedInPhaseUrlRedactionReport,
          nestedInPhase59Report,
          nestedInPhase60Report,
          nestedInPhase61Report,
        );
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
    } else if (PHASE59_REPORT_KEY_PATTERN.test(key) && isReport(entry)) {
      blocked[key] = {
        ...(blockMultiWriterRuntimeSupport(entry) as DeploymentCliReport),
        runtimeSupport: false,
        runtimeSupported: false,
        multiWriterSupported: false,
        runtimeImplementationBlocked: true,
        runtimeSupportBlocked: true,
        releaseAllowed: false,
      };
    } else if (PHASE60_REPORT_KEY_PATTERN.test(key) && isReport(entry)) {
      blocked[key] = {
        ...(blockMultiWriterRuntimeSupport(entry) as DeploymentCliReport),
        runtimeSupport: false,
        runtimeSupported: false,
        multiWriterSupported: false,
        runtimeImplementationBlocked: true,
        runtimeSupportBlocked: true,
        releaseAllowed: false,
      };
    } else if (PHASE61_REPORT_KEY_PATTERN.test(key) && isReport(entry)) {
      blocked[key] = blockUnsupportedRuntimeReleaseClaims({
        ...(blockMultiWriterRuntimeSupport(entry) as DeploymentCliReport),
        runtimeSupport: false,
        runtimeSupported: false,
        releaseSupported: false,
        multiWriterSupported: false,
        activeActiveSupport: false,
        activeActiveSupported: false,
        regionalSupport: false,
        regionalSupported: false,
        pitrSupport: false,
        pitrSupported: false,
        sqliteDistributedSupport: false,
        sqliteDistributedSupported: false,
        runtimeImplementationBlocked: true,
        runtimeSupportBlocked: true,
        releaseAllowed: false,
      });
    } else {
      blocked[key] = blockMultiWriterRuntimeSupport(entry);
    }
  }
  return blocked;
}

function isUnsupportedRuntimeReleaseClaimKey(key: string): boolean {
  return UNSUPPORTED_RUNTIME_RELEASE_CLAIM_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function blockUnsupportedRuntimeReleaseClaims(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => blockUnsupportedRuntimeReleaseClaims(entry));
  }
  if (!isReport(value)) {
    return value;
  }

  const blocked: DeploymentCliReport = {};
  for (const [key, entry] of Object.entries(value)) {
    blocked[key] = isUnsupportedRuntimeReleaseClaimKey(key)
      ? false
      : blockUnsupportedRuntimeReleaseClaims(entry);
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

function phase59EnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = clean(env[key]);
  return value ? value : undefined;
}

function phase60EnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = clean(env[key]);
  return value ? value : undefined;
}

function phase61EnvValue(env: NodeJS.ProcessEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = clean(env[key]);
    if (value) return value;
  }
  return undefined;
}

function phase62EnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = clean(env[key]);
  return value ? value : undefined;
}

function withPhase59Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const nestedPhase59 = firstReportAt(report, [
    ["phase59MultiWriterRuntimeEnablementGate"],
    ["phase59MultiWriterRuntimeEnablementReport"],
    ["phase59MultiWriterRuntimeReleaseEnablementGate"],
    ["phase59MultiWriterRuntimeReleaseEnablementReport"],
    ["phase59MultiWriterReleaseEnablementGate"],
    ["phase59MultiWriterReleaseApprovalGate"],
    ["managedDatabase", "phase59"],
    ["managedDatabase", "phase59MultiWriterRuntimeEnablementGate"],
    ["managedDatabaseTopology", "phase59"],
    ["managedDatabaseTopology", "phase59MultiWriterRuntimeEnablementGate"],
    ["managedDatabaseTopology", "managedDatabase", "phase59"],
    ["managedDatabaseRuntimeGuard", "phase59"],
    ["managedDatabaseRuntimeGuard", "phase59MultiWriterRuntimeEnablementGate"],
    ["runtimeGuard", "phase59"],
    ["runtimeGuard", "phase59MultiWriterRuntimeEnablementGate"],
    ["releaseReadiness", "phase59"],
    ["releaseReadiness", "phase59MultiWriterRuntimeEnablementGate"],
    ["releaseReadiness", "managedDatabaseRuntimeGuard", "phase59"],
    ["releaseEvidence", "phase59"],
    ["releaseEvidence", "phase59MultiWriterRuntimeEnablementGate"],
    ["evidence", "phase59"],
    ["evidence", "phase59MultiWriterRuntimeEnablementGate"],
    ["asyncStoreBoundary", "phase59"],
    ["asyncStoreBoundary", "phase59MultiWriterRuntimeEnablementGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE59_REPORT_KEY_PATTERN.test(key));
  const existingPhase59 = reportAt(report, ["phase59"]) ?? nestedPhase59 ?? {};

  const runtimeEnablementDecision = existingPhase59.runtimeEnablementDecision ??
    existingPhase59.enablementDecision ??
    phase59EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_DECISION");
  const runtimeEnablementApprover = existingPhase59.runtimeEnablementApprover ??
    existingPhase59.approver ??
    phase59EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_APPROVER");
  const runtimeEnablementRolloutWindow = existingPhase59.runtimeEnablementRolloutWindow ??
    existingPhase59.rolloutWindow ??
    phase59EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ROLLOUT_WINDOW");
  const runtimeEnablementMonitoringSignoff = existingPhase59.runtimeEnablementMonitoringSignoff ??
    existingPhase59.monitoringSignoff ??
    phase59EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_MONITORING_SIGNOFF");
  const runtimeEnablementAbortPlan = existingPhase59.runtimeEnablementAbortPlan ??
    existingPhase59.abortPlan ??
    phase59EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_ABORT_PLAN");
  const runtimeEnablementReleaseTicket = existingPhase59.runtimeEnablementReleaseTicket ??
    existingPhase59.releaseTicket ??
    phase59EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_ENABLEMENT_RELEASE_TICKET");

  const runtimeEnablementDecisionRecorded =
    existingPhase59.runtimeEnablementDecisionRecorded ?? runtimeEnablementDecision !== undefined;
  const runtimeEnablementApproverRecorded =
    existingPhase59.runtimeEnablementApproverRecorded ?? runtimeEnablementApprover !== undefined;
  const runtimeEnablementRolloutWindowRecorded =
    existingPhase59.runtimeEnablementRolloutWindowRecorded ?? runtimeEnablementRolloutWindow !== undefined;
  const runtimeEnablementMonitoringSignoffRecorded =
    existingPhase59.runtimeEnablementMonitoringSignoffRecorded ?? runtimeEnablementMonitoringSignoff !== undefined;
  const runtimeEnablementAbortPlanRecorded =
    existingPhase59.runtimeEnablementAbortPlanRecorded ?? runtimeEnablementAbortPlan !== undefined;
  const runtimeEnablementReleaseTicketRecorded =
    existingPhase59.runtimeEnablementReleaseTicketRecorded ?? runtimeEnablementReleaseTicket !== undefined;
  const runtimeEnablementApprovalEvidenceComplete =
    existingPhase59.runtimeEnablementApprovalEvidenceComplete ??
    existingPhase59.runtimeEnablementGatePassed ??
    (
      runtimeEnablementDecisionRecorded === true &&
      runtimeEnablementApproverRecorded === true &&
      runtimeEnablementRolloutWindowRecorded === true &&
      runtimeEnablementMonitoringSignoffRecorded === true &&
      runtimeEnablementAbortPlanRecorded === true &&
      runtimeEnablementReleaseTicketRecorded === true
    );

  return blockMultiWriterRuntimeSupport({
    ...report,
    phase59: {
      ...existingPhase59,
      phase: existingPhase59.phase ?? "59",
      required: existingPhase59.required ?? true,
      multiWriterTopologyRequested: existingPhase59.multiWriterTopologyRequested ?? true,
      runtimeEnablementDecision,
      runtimeEnablementApprover,
      runtimeEnablementRolloutWindow,
      runtimeEnablementMonitoringSignoff,
      runtimeEnablementAbortPlan,
      runtimeEnablementReleaseTicket,
      runtimeEnablementDecisionRecorded,
      runtimeEnablementApproverRecorded,
      runtimeEnablementRolloutWindowRecorded,
      runtimeEnablementMonitoringSignoffRecorded,
      runtimeEnablementAbortPlanRecorded,
      runtimeEnablementReleaseTicketRecorded,
      runtimeEnablementApprovalEvidenceComplete,
      runtimeSupport: false,
      runtimeSupported: false,
      multiWriterSupported: false,
      runtimeImplementationBlocked: true,
      runtimeSupportBlocked: true,
      releaseAllowed: false,
      strictBlocker: existingPhase59.strictBlocker ?? runtimeEnablementApprovalEvidenceComplete !== true,
      summary: existingPhase59.summary ??
        "Phase 59 records multi-writer runtime release-enablement approval evidence; runtime support and release approval remain blocked in CLI output.",
    },
  });
}

function withPhase60Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!hasMultiWriterTopologyIntent(env) || !isReport(report)) {
    return report;
  }

  const nestedPhase60 = firstReportAt(report, [
    ["phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["phase60MultiWriterRuntimeSupportPresenceAssertionReport"],
    ["phase60MultiWriterRuntimeSupportGate"],
    ["phase60MultiWriterRuntimeSupportReport"],
    ["managedDatabase", "phase60"],
    ["managedDatabase", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["managedDatabaseTopology", "phase60"],
    ["managedDatabaseTopology", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["managedDatabaseTopology", "managedDatabase", "phase60"],
    ["managedDatabaseRuntimeGuard", "phase60"],
    ["managedDatabaseRuntimeGuard", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["runtimeGuard", "phase60"],
    ["runtimeGuard", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["releaseReadiness", "phase60"],
    ["releaseReadiness", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["releaseReadiness", "managedDatabaseRuntimeGuard", "phase60"],
    ["releaseEvidence", "phase60"],
    ["releaseEvidence", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["evidence", "phase60"],
    ["evidence", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
    ["asyncStoreBoundary", "phase60"],
    ["asyncStoreBoundary", "phase60MultiWriterRuntimeSupportPresenceAssertionGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE60_REPORT_KEY_PATTERN.test(key));
  const existingPhase60 = reportAt(report, ["phase60"]) ?? nestedPhase60 ?? {};

  const runtimeSupportImplementationPresent = existingPhase60.runtimeSupportImplementationPresent ??
    existingPhase60.implementationPresent ??
    phase60EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_IMPLEMENTATION_PRESENT");
  const runtimeSupportExplicitSupportStatement = existingPhase60.runtimeSupportExplicitSupportStatement ??
    existingPhase60.explicitSupportStatement ??
    phase60EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_EXPLICIT_SUPPORT_STATEMENT");
  const runtimeSupportCompatibilityMatrix = existingPhase60.runtimeSupportCompatibilityMatrix ??
    existingPhase60.compatibilityMatrix ??
    phase60EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_COMPATIBILITY_MATRIX");
  const runtimeSupportCutoverEvidence = existingPhase60.runtimeSupportCutoverEvidence ??
    existingPhase60.cutoverEvidence ??
    phase60EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_CUTOVER_EVIDENCE");
  const runtimeSupportReleaseAutomationApproval = existingPhase60.runtimeSupportReleaseAutomationApproval ??
    existingPhase60.releaseAutomationApproval ??
    phase60EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_RELEASE_AUTOMATION_APPROVAL");
  const runtimeSupportOwnerAcceptance = existingPhase60.runtimeSupportOwnerAcceptance ??
    existingPhase60.ownerAcceptance ??
    phase60EnvValue(env, "TASKLOOM_MULTI_WRITER_RUNTIME_SUPPORT_OWNER_ACCEPTANCE");

  const runtimeSupportImplementationPresentRecorded =
    existingPhase60.runtimeSupportImplementationPresentRecorded ?? runtimeSupportImplementationPresent !== undefined;
  const runtimeSupportExplicitSupportStatementRecorded =
    existingPhase60.runtimeSupportExplicitSupportStatementRecorded ??
    runtimeSupportExplicitSupportStatement !== undefined;
  const runtimeSupportCompatibilityMatrixRecorded =
    existingPhase60.runtimeSupportCompatibilityMatrixRecorded ?? runtimeSupportCompatibilityMatrix !== undefined;
  const runtimeSupportCutoverEvidenceRecorded =
    existingPhase60.runtimeSupportCutoverEvidenceRecorded ?? runtimeSupportCutoverEvidence !== undefined;
  const runtimeSupportReleaseAutomationApprovalRecorded =
    existingPhase60.runtimeSupportReleaseAutomationApprovalRecorded ??
    runtimeSupportReleaseAutomationApproval !== undefined;
  const runtimeSupportOwnerAcceptanceRecorded =
    existingPhase60.runtimeSupportOwnerAcceptanceRecorded ?? runtimeSupportOwnerAcceptance !== undefined;
  const runtimeSupportPresenceAssertionComplete =
    existingPhase60.runtimeSupportPresenceAssertionComplete ??
    existingPhase60.runtimeSupportPresenceAssertionGatePassed ??
    (
      runtimeSupportImplementationPresentRecorded === true &&
      runtimeSupportExplicitSupportStatementRecorded === true &&
      runtimeSupportCompatibilityMatrixRecorded === true &&
      runtimeSupportCutoverEvidenceRecorded === true &&
      runtimeSupportReleaseAutomationApprovalRecorded === true &&
      runtimeSupportOwnerAcceptanceRecorded === true
    );

  return blockMultiWriterRuntimeSupport({
    ...report,
    phase60: {
      ...existingPhase60,
      phase: existingPhase60.phase ?? "60",
      required: existingPhase60.required ?? true,
      multiWriterTopologyRequested: existingPhase60.multiWriterTopologyRequested ?? true,
      runtimeSupportImplementationPresent,
      runtimeSupportExplicitSupportStatement,
      runtimeSupportCompatibilityMatrix,
      runtimeSupportCutoverEvidence,
      runtimeSupportReleaseAutomationApproval,
      runtimeSupportOwnerAcceptance,
      runtimeSupportImplementationPresentRecorded,
      runtimeSupportExplicitSupportStatementRecorded,
      runtimeSupportCompatibilityMatrixRecorded,
      runtimeSupportCutoverEvidenceRecorded,
      runtimeSupportReleaseAutomationApprovalRecorded,
      runtimeSupportOwnerAcceptanceRecorded,
      runtimeSupportPresenceAssertionComplete,
      runtimeSupportPresenceAssertionGatePassed: runtimeSupportPresenceAssertionComplete,
      runtimeSupport: false,
      runtimeSupported: false,
      multiWriterSupported: false,
      runtimeImplementationBlocked: true,
      runtimeSupportBlocked: true,
      releaseAllowed: false,
      strictBlocker: existingPhase60.strictBlocker ?? runtimeSupportPresenceAssertionComplete !== true,
      summary: existingPhase60.summary ??
        "Phase 60 records multi-writer runtime-support presence assertion evidence; runtime support and release approval remain blocked in CLI output.",
    },
  });
}

function withPhase61Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!isReport(report)) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const nestedPhase61 = firstReportAt(report, [
    ["phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["phase61UnsupportedRuntimeReleaseClaimsReport"],
    ["phase61RuntimeReleaseClaimsGate"],
    ["phase61RuntimeReleaseClaimsReport"],
    ["managedDatabase", "phase61"],
    ["managedDatabase", "phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["managedDatabaseTopology", "phase61"],
    ["managedDatabaseTopology", "phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["managedDatabaseTopology", "managedDatabase", "phase61"],
    ["managedDatabaseRuntimeGuard", "phase61"],
    ["managedDatabaseRuntimeGuard", "phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["runtimeGuard", "phase61"],
    ["runtimeGuard", "phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["releaseReadiness", "phase61"],
    ["releaseReadiness", "phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["releaseReadiness", "managedDatabaseRuntimeGuard", "phase61"],
    ["releaseEvidence", "phase61"],
    ["releaseEvidence", "phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["evidence", "phase61"],
    ["evidence", "phase61UnsupportedRuntimeReleaseClaimsGate"],
    ["asyncStoreBoundary", "phase61"],
    ["asyncStoreBoundary", "phase61UnsupportedRuntimeReleaseClaimsGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE61_REPORT_KEY_PATTERN.test(key));
  const existingPhase61 = reportAt(report, ["phase61"]) ?? nestedPhase61 ?? {};
  const hasPhase61EnvEvidence = phase61EnvValue(env, [
    "TASKLOOM_PHASE61_ACTIVE_ACTIVE_CLAIM_EVIDENCE",
    "TASKLOOM_PHASE61_ACTIVE_ACTIVE_SUPPORT_CLAIM_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_ACTIVE_ACTIVE_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_ACTIVE_ACTIVE_EVIDENCE",
    "TASKLOOM_PHASE61_REGIONAL_CLAIM_EVIDENCE",
    "TASKLOOM_PHASE61_REGIONAL_SUPPORT_CLAIM_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_REGIONAL_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_REGIONAL_EVIDENCE",
    "TASKLOOM_PHASE61_PITR_CLAIM_EVIDENCE",
    "TASKLOOM_PHASE61_PITR_SUPPORT_CLAIM_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_PITR_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_PITR_EVIDENCE",
    "TASKLOOM_PHASE61_SQLITE_DISTRIBUTED_CLAIM_EVIDENCE",
    "TASKLOOM_PHASE61_SQLITE_DISTRIBUTED_SUPPORT_CLAIM_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_SQLITE_DISTRIBUTED_EVIDENCE",
    "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_SQLITE_DISTRIBUTED_EVIDENCE",
  ]) !== undefined;

  if (!hasMultiWriterTopologyIntent(env) && !nestedPhase61 && !reportAt(report, ["phase61"]) && !hasPhase61EnvEvidence) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const activeActiveClaimEvidence = existingPhase61.activeActiveClaimEvidence ??
    existingPhase61.activeActiveEvidence ??
    existingPhase61.activeActiveSupportClaimEvidence ??
    phase61EnvValue(env, [
      "TASKLOOM_PHASE61_ACTIVE_ACTIVE_CLAIM_EVIDENCE",
      "TASKLOOM_PHASE61_ACTIVE_ACTIVE_SUPPORT_CLAIM_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_ACTIVE_ACTIVE_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_ACTIVE_ACTIVE_EVIDENCE",
    ]);
  const regionalClaimEvidence = existingPhase61.regionalClaimEvidence ??
    existingPhase61.regionalEvidence ??
    existingPhase61.regionalSupportClaimEvidence ??
    phase61EnvValue(env, [
      "TASKLOOM_PHASE61_REGIONAL_CLAIM_EVIDENCE",
      "TASKLOOM_PHASE61_REGIONAL_SUPPORT_CLAIM_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_REGIONAL_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_REGIONAL_EVIDENCE",
    ]);
  const pitrClaimEvidence = existingPhase61.pitrClaimEvidence ??
    existingPhase61.pitrEvidence ??
    existingPhase61.pitrSupportClaimEvidence ??
    phase61EnvValue(env, [
      "TASKLOOM_PHASE61_PITR_CLAIM_EVIDENCE",
      "TASKLOOM_PHASE61_PITR_SUPPORT_CLAIM_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_PITR_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_PITR_EVIDENCE",
    ]);
  const sqliteDistributedClaimEvidence = existingPhase61.sqliteDistributedClaimEvidence ??
    existingPhase61.sqliteDistributedEvidence ??
    existingPhase61.sqliteDistributedSupportClaimEvidence ??
    phase61EnvValue(env, [
      "TASKLOOM_PHASE61_SQLITE_DISTRIBUTED_CLAIM_EVIDENCE",
      "TASKLOOM_PHASE61_SQLITE_DISTRIBUTED_SUPPORT_CLAIM_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_SQLITE_DISTRIBUTED_EVIDENCE",
      "TASKLOOM_UNSUPPORTED_RUNTIME_RELEASE_CLAIMS_SQLITE_DISTRIBUTED_EVIDENCE",
    ]);

  const activeActiveClaimEvidenceRecorded =
    existingPhase61.activeActiveClaimEvidenceRecorded ?? activeActiveClaimEvidence !== undefined;
  const regionalClaimEvidenceRecorded =
    existingPhase61.regionalClaimEvidenceRecorded ?? regionalClaimEvidence !== undefined;
  const pitrClaimEvidenceRecorded =
    existingPhase61.pitrClaimEvidenceRecorded ?? pitrClaimEvidence !== undefined;
  const sqliteDistributedClaimEvidenceRecorded =
    existingPhase61.sqliteDistributedClaimEvidenceRecorded ?? sqliteDistributedClaimEvidence !== undefined;
  const unsupportedRuntimeReleaseClaimsComplete =
    existingPhase61.unsupportedRuntimeReleaseClaimsComplete ??
    existingPhase61.unsupportedRuntimeReleaseClaimsGatePassed ??
    (
      activeActiveClaimEvidenceRecorded === true &&
      regionalClaimEvidenceRecorded === true &&
      pitrClaimEvidenceRecorded === true &&
      sqliteDistributedClaimEvidenceRecorded === true
    );

  return blockUnsupportedRuntimeReleaseClaims(blockMultiWriterRuntimeSupport({
    ...report,
    phase61: {
      ...existingPhase61,
      phase: existingPhase61.phase ?? "61",
      required: existingPhase61.required ?? true,
      multiWriterTopologyRequested: existingPhase61.multiWriterTopologyRequested ?? true,
      activeActiveClaimEvidence,
      regionalClaimEvidence,
      pitrClaimEvidence,
      sqliteDistributedClaimEvidence,
      activeActiveClaimEvidenceRecorded,
      regionalClaimEvidenceRecorded,
      pitrClaimEvidenceRecorded,
      sqliteDistributedClaimEvidenceRecorded,
      unsupportedRuntimeReleaseClaimsComplete,
      unsupportedRuntimeReleaseClaimsGatePassed: unsupportedRuntimeReleaseClaimsComplete,
      runtimeSupport: false,
      runtimeSupported: false,
      releaseSupported: false,
      multiWriterSupported: false,
      activeActiveSupport: false,
      activeActiveSupported: false,
      regionalSupport: false,
      regionalSupported: false,
      pitrSupport: false,
      pitrSupported: false,
      sqliteDistributedSupport: false,
      sqliteDistributedSupported: false,
      runtimeImplementationBlocked: true,
      runtimeSupportBlocked: true,
      releaseAllowed: false,
      strictBlocker: existingPhase61.strictBlocker ?? unsupportedRuntimeReleaseClaimsComplete !== true,
      summary: existingPhase61.summary ??
        "Phase 61 records unsupported runtime/release claim evidence; active-active, regional, PITR, and SQLite-distributed support remain blocked in CLI output.",
    },
  }));
}

function withPhase62Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!isReport(report)) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const nestedPhase62 = firstReportAt(report, [
    ["phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ["phase62ManagedPostgresHorizontalWriterHardeningReport"],
    ["managedDatabase", "phase62"],
    ["managedDatabase", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ["managedDatabaseTopology", "phase62"],
    ["managedDatabaseTopology", "managedDatabase", "phase62"],
    ["managedDatabaseTopology", "managedDatabase", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ["managedDatabaseRuntimeGuard", "phase62"],
    ["managedDatabaseRuntimeGuard", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ["releaseReadiness", "phase62"],
    ["releaseReadiness", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ["releaseEvidence", "phase62"],
    ["releaseEvidence", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ["evidence", "phase62"],
    ["evidence", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
    ["asyncStoreBoundary", "phase62"],
    ["asyncStoreBoundary", "phase62ManagedPostgresHorizontalWriterHardeningGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE62_REPORT_KEY_PATTERN.test(key));
  const existingPhase62 = reportAt(report, ["phase62"]) ?? nestedPhase62 ?? {};
  const horizontalWriterIntent =
    existingPhase62.horizontalWriterTopologyRequested === true ||
    existingPhase62.required === true ||
    hasHorizontalWriterTopologyIntent(env);
  const hasPhase62EnvEvidence =
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE") !== undefined;

  if (!horizontalWriterIntent && !nestedPhase62 && !reportAt(report, ["phase62"]) && !hasPhase62EnvEvidence) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const horizontalWriterHardeningImplementation =
    existingPhase62.horizontalWriterHardeningImplementation ??
    existingPhase62.hardeningImplementation ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_HARDENING_IMPLEMENTATION");
  const horizontalWriterConcurrencyTestEvidence =
    existingPhase62.horizontalWriterConcurrencyTestEvidence ??
    existingPhase62.concurrencyTestEvidence ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_CONCURRENCY_TEST_EVIDENCE");
  const horizontalWriterTransactionRetryEvidence =
    existingPhase62.horizontalWriterTransactionRetryEvidence ??
    existingPhase62.transactionRetryEvidence ??
    existingPhase62.compareAndSwapEvidence ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_HORIZONTAL_WRITER_TRANSACTION_RETRY_EVIDENCE");

  const horizontalWriterHardeningImplementationRecorded =
    existingPhase62.horizontalWriterHardeningImplementationRecorded ??
    existingPhase62.horizontalWriterHardeningImplementationAttached ??
    horizontalWriterHardeningImplementation !== undefined;
  const horizontalWriterConcurrencyTestEvidenceRecorded =
    existingPhase62.horizontalWriterConcurrencyTestEvidenceRecorded ??
    existingPhase62.horizontalWriterConcurrencyTestEvidenceAttached ??
    horizontalWriterConcurrencyTestEvidence !== undefined;
  const horizontalWriterTransactionRetryEvidenceRecorded =
    existingPhase62.horizontalWriterTransactionRetryEvidenceRecorded ??
    existingPhase62.horizontalWriterTransactionRetryEvidenceAttached ??
    horizontalWriterTransactionRetryEvidence !== undefined;
  const phase61ActivationReady =
    existingPhase62.phase61ActivationReady ??
    existingPhase62.phase61ActivationGatePassed ??
    reportAt(report, ["phase61"])?.activationReady ??
    reportAt(report, ["phase61"])?.activationGatePassed ??
    false;
  const managedPostgresStartupSupported =
    existingPhase62.managedPostgresStartupSupported ??
    existingPhase62.phase52ManagedStartupSupported ??
    reportAt(report, ["asyncStoreBoundary"])?.phase52ManagedStartupSupported ??
    false;
  const horizontalWriterHardeningReady =
    existingPhase62.horizontalWriterHardeningReady ??
    existingPhase62.horizontalWriterHardeningGatePassed ??
    (
      horizontalWriterIntent &&
      managedPostgresStartupSupported === true &&
      phase61ActivationReady === true &&
      horizontalWriterHardeningImplementationRecorded === true &&
      horizontalWriterConcurrencyTestEvidenceRecorded === true &&
      horizontalWriterTransactionRetryEvidenceRecorded === true
    );

  return blockUnsupportedRuntimeReleaseClaims({
    ...report,
    phase62: {
      ...existingPhase62,
      phase: existingPhase62.phase ?? "62",
      required: existingPhase62.required ?? horizontalWriterIntent,
      horizontalWriterTopologyRequested: horizontalWriterIntent,
      managedPostgresStartupSupported,
      phase61ActivationReady,
      horizontalWriterHardeningImplementation,
      horizontalWriterConcurrencyTestEvidence,
      horizontalWriterTransactionRetryEvidence,
      horizontalWriterHardeningImplementationRecorded,
      horizontalWriterConcurrencyTestEvidenceRecorded,
      horizontalWriterTransactionRetryEvidenceRecorded,
      horizontalWriterHardeningReady,
      horizontalWriterHardeningGatePassed: horizontalWriterHardeningReady,
      horizontalWriterRuntimeSupported: horizontalWriterHardeningReady,
      managedPostgresHorizontalWriterSupported: horizontalWriterHardeningReady,
      activeActiveSupported: false,
      regionalFailoverSupported: false,
      pitrRuntimeSupported: false,
      distributedSqliteSupported: false,
      genericMultiWriterDatabaseSupported: false,
      phases63To66Pending: horizontalWriterIntent,
      pendingPhases: horizontalWriterIntent ? ["63", "64", "65", "66"] : [],
      releaseAllowed: false,
      strictBlocker: existingPhase62.strictBlocker ?? horizontalWriterHardeningReady !== true,
      summary: existingPhase62.summary ?? (
        horizontalWriterHardeningReady
          ? "Phase 62 records managed Postgres horizontal app-writer concurrency hardening; active-active, regional failover, PITR runtime, distributed SQLite, and final release remain blocked pending Phases 63-66."
          : "Phase 62 requires managed Postgres horizontal app-writer concurrency hardening evidence before the supported horizontal writer posture can be claimed."
      ),
    },
  });
}

function withPhase63Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!isReport(report)) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const nestedPhase63 = firstReportAt(report, [
    ["phase63DistributedDependencyEnforcementGate"],
    ["phase63DistributedDependencyEnforcementReport"],
    ["managedDatabase", "phase63"],
    ["managedDatabase", "phase63DistributedDependencyEnforcementGate"],
    ["managedDatabaseTopology", "phase63"],
    ["managedDatabaseTopology", "managedDatabase", "phase63"],
    ["managedDatabaseRuntimeGuard", "phase63"],
    ["managedDatabaseRuntimeGuard", "phase63DistributedDependencyEnforcementGate"],
    ["releaseReadiness", "phase63"],
    ["releaseReadiness", "phase63DistributedDependencyEnforcementGate"],
    ["releaseEvidence", "phase63"],
    ["releaseEvidence", "phase63DistributedDependencyEnforcementGate"],
    ["evidence", "phase63"],
    ["evidence", "phase63DistributedDependencyEnforcementGate"],
    ["asyncStoreBoundary", "phase63"],
    ["asyncStoreBoundary", "phase63DistributedDependencyEnforcementGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE63_REPORT_KEY_PATTERN.test(key));
  const existingPhase63 = reportAt(report, ["phase63"]) ?? nestedPhase63 ?? {};
  const phase62 = reportAt(report, ["phase62"]) ?? {};
  const horizontalWriterIntent =
    existingPhase63.horizontalWriterTopologyRequested === true ||
    existingPhase63.required === true ||
    phase62.horizontalWriterTopologyRequested === true ||
    hasHorizontalWriterTopologyIntent(env);
  const hasPhase63EnvEvidence =
    phase62EnvValue(env, "TASKLOOM_DISTRIBUTED_RATE_LIMIT_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_SCHEDULER_COORDINATION_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_ALERT_DELIVERY_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_HEALTH_MONITORING_EVIDENCE") !== undefined;

  if (!horizontalWriterIntent && !nestedPhase63 && !reportAt(report, ["phase63"]) && !hasPhase63EnvEvidence) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const distributedRateLimitEvidence =
    existingPhase63.distributedRateLimitEvidence ??
    phase62EnvValue(env, "TASKLOOM_DISTRIBUTED_RATE_LIMIT_EVIDENCE");
  const schedulerCoordinationEvidence =
    existingPhase63.schedulerCoordinationEvidence ??
    phase62EnvValue(env, "TASKLOOM_SCHEDULER_COORDINATION_EVIDENCE");
  const durableJobExecutionEvidence =
    existingPhase63.durableJobExecutionEvidence ??
    phase62EnvValue(env, "TASKLOOM_DURABLE_JOB_EXECUTION_EVIDENCE");
  const accessLogShippingEvidence =
    existingPhase63.accessLogShippingEvidence ??
    phase62EnvValue(env, "TASKLOOM_ACCESS_LOG_SHIPPING_EVIDENCE");
  const alertDeliveryEvidence =
    existingPhase63.alertDeliveryEvidence ??
    phase62EnvValue(env, "TASKLOOM_ALERT_DELIVERY_EVIDENCE");
  const healthMonitoringEvidence =
    existingPhase63.healthMonitoringEvidence ??
    phase62EnvValue(env, "TASKLOOM_HEALTH_MONITORING_EVIDENCE");
  const schedulerLeaderMode =
    existingPhase63.schedulerLeaderMode ?? (normalize(env.TASKLOOM_SCHEDULER_LEADER_MODE) || "off");
  const durableJobExecutionPosture =
    existingPhase63.durableJobExecutionPosture ?? normalize(env.TASKLOOM_DURABLE_JOB_EXECUTION_POSTURE);
  const accessLogMode = existingPhase63.accessLogMode ?? (normalize(env.TASKLOOM_ACCESS_LOG_MODE) || "off");
  const phase62HorizontalWriterHardeningReady =
    existingPhase63.phase62HorizontalWriterHardeningReady ??
    phase62.horizontalWriterHardeningReady ??
    false;
  const distributedRateLimitConfigured =
    existingPhase63.distributedRateLimitConfigured ??
    (phase62EnvValue(env, "TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL") !== undefined);
  const distributedRateLimitEvidenceAttached =
    existingPhase63.distributedRateLimitEvidenceAttached ??
    distributedRateLimitEvidence !== undefined;
  const distributedRateLimitFailOpen =
    existingPhase63.distributedRateLimitFailOpen ?? truthy(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_FAIL_OPEN);
  const distributedRateLimitReady =
    existingPhase63.distributedRateLimitReady ??
    (distributedRateLimitConfigured === true &&
      distributedRateLimitEvidenceAttached === true &&
      distributedRateLimitFailOpen !== true);
  const schedulerCoordinationHttpUrlConfigured =
    existingPhase63.schedulerCoordinationHttpUrlConfigured ??
    (phase62EnvValue(env, "TASKLOOM_SCHEDULER_LEADER_HTTP_URL") !== undefined);
  const schedulerCoordinationEvidenceAttached =
    existingPhase63.schedulerCoordinationEvidenceAttached ??
    schedulerCoordinationEvidence !== undefined;
  const schedulerCoordinationFailOpen =
    existingPhase63.schedulerCoordinationFailOpen ?? truthy(env.TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN);
  const schedulerCoordinationLocalOnly =
    existingPhase63.schedulerCoordinationLocalOnly ?? schedulerLeaderMode !== "http";
  const schedulerCoordinationReady =
    existingPhase63.schedulerCoordinationReady ??
    (schedulerLeaderMode === "http" &&
      schedulerCoordinationHttpUrlConfigured === true &&
      schedulerCoordinationEvidenceAttached === true &&
      schedulerCoordinationFailOpen !== true);
  const durableJobExecutionPostureSafe =
    existingPhase63.durableJobExecutionPostureSafe ??
    DURABLE_JOB_EXECUTION_POSTURES.has(String(durableJobExecutionPosture));
  const durableJobExecutionEvidenceAttached =
    existingPhase63.durableJobExecutionEvidenceAttached ??
    durableJobExecutionEvidence !== undefined;
  const durableJobExecutionReady =
    existingPhase63.durableJobExecutionReady ??
    (durableJobExecutionPostureSafe === true && durableJobExecutionEvidenceAttached === true);
  const accessLogShippingConfigured =
    existingPhase63.accessLogShippingConfigured ??
    (accessLogMode === "stdout" || accessLogMode === "file");
  const accessLogShippingEvidenceAttached =
    existingPhase63.accessLogShippingEvidenceAttached ??
    accessLogShippingEvidence !== undefined;
  const accessLogShippingLocalOnly =
    existingPhase63.accessLogShippingLocalOnly ??
    (accessLogMode !== "stdout" && accessLogMode !== "file");
  const accessLogShippingReady =
    existingPhase63.accessLogShippingReady ??
    (accessLogShippingConfigured === true && accessLogShippingEvidenceAttached === true);
  const alertEvaluateCronConfigured =
    existingPhase63.alertEvaluateCronConfigured ??
    (phase62EnvValue(env, "TASKLOOM_ALERT_EVALUATE_CRON") !== undefined);
  const alertWebhookUrlConfigured =
    existingPhase63.alertWebhookUrlConfigured ??
    (phase62EnvValue(env, "TASKLOOM_ALERT_WEBHOOK_URL") !== undefined);
  const alertDeliveryEvidenceAttached =
    existingPhase63.alertDeliveryEvidenceAttached ??
    alertDeliveryEvidence !== undefined;
  const alertDeliveryReady =
    existingPhase63.alertDeliveryReady ??
    (alertEvaluateCronConfigured === true &&
      alertWebhookUrlConfigured === true &&
      alertDeliveryEvidenceAttached === true);
  const healthMonitoringEvidenceAttached =
    existingPhase63.healthMonitoringEvidenceAttached ??
    healthMonitoringEvidence !== undefined;
  const healthMonitoringReady =
    existingPhase63.healthMonitoringReady ?? healthMonitoringEvidenceAttached === true;
  const distributedDependencyEnforcementReady =
    existingPhase63.distributedDependencyEnforcementReady ??
    (
      distributedRateLimitReady === true &&
      schedulerCoordinationReady === true &&
      durableJobExecutionReady === true &&
      accessLogShippingReady === true &&
      alertDeliveryReady === true &&
      healthMonitoringReady === true
    );
  const activationDependencyGatePassed =
    existingPhase63.activationDependencyGatePassed ??
    (
      horizontalWriterIntent &&
      phase62HorizontalWriterHardeningReady === true &&
      distributedDependencyEnforcementReady === true
    );

  return blockUnsupportedRuntimeReleaseClaims({
    ...report,
    phase63: {
      ...existingPhase63,
      phase: existingPhase63.phase ?? "63",
      required: existingPhase63.required ?? horizontalWriterIntent,
      horizontalWriterTopologyRequested: horizontalWriterIntent,
      phase62HorizontalWriterHardeningReady,
      distributedRateLimitRequired: existingPhase63.distributedRateLimitRequired ?? horizontalWriterIntent,
      distributedRateLimitConfigured,
      distributedRateLimitEvidence,
      distributedRateLimitEvidenceAttached,
      distributedRateLimitFailOpen,
      distributedRateLimitReady,
      schedulerCoordinationRequired: existingPhase63.schedulerCoordinationRequired ?? horizontalWriterIntent,
      schedulerLeaderMode,
      schedulerCoordinationHttpUrlConfigured,
      schedulerCoordinationEvidence,
      schedulerCoordinationEvidenceAttached,
      schedulerCoordinationFailOpen,
      schedulerCoordinationLocalOnly,
      schedulerCoordinationReady,
      durableJobExecutionRequired: existingPhase63.durableJobExecutionRequired ?? horizontalWriterIntent,
      durableJobExecutionPosture,
      durableJobExecutionPostureSafe,
      durableJobExecutionEvidence,
      durableJobExecutionEvidenceAttached,
      durableJobExecutionReady,
      accessLogShippingRequired: existingPhase63.accessLogShippingRequired ?? horizontalWriterIntent,
      accessLogMode,
      accessLogShippingConfigured,
      accessLogShippingEvidence,
      accessLogShippingEvidenceAttached,
      accessLogShippingLocalOnly,
      accessLogShippingReady,
      alertDeliveryRequired: existingPhase63.alertDeliveryRequired ?? horizontalWriterIntent,
      alertEvaluateCronConfigured,
      alertWebhookUrlConfigured,
      alertDeliveryEvidence,
      alertDeliveryEvidenceAttached,
      alertDeliveryReady,
      healthMonitoringRequired: existingPhase63.healthMonitoringRequired ?? horizontalWriterIntent,
      healthMonitoringEvidence,
      healthMonitoringEvidenceAttached,
      healthMonitoringReady,
      distributedDependencyEnforcementReady,
      activationDependencyGatePassed,
      strictActivationBlocked: existingPhase63.strictActivationBlocked ?? activationDependencyGatePassed !== true,
      activeActiveSupported: false,
      regionalFailoverSupported: false,
      pitrRuntimeSupported: false,
      distributedSqliteSupported: false,
      phases64To66Pending: horizontalWriterIntent,
      pendingPhases: horizontalWriterIntent ? ["64", "65", "66"] : [],
      releaseAllowed: existingPhase63.releaseAllowed ?? !horizontalWriterIntent,
      strictBlocker: existingPhase63.strictBlocker ?? (horizontalWriterIntent && activationDependencyGatePassed !== true),
      summary: existingPhase63.summary ?? (
        activationDependencyGatePassed
          ? "Phase 63 records distributed dependency enforcement for managed Postgres horizontal app writers; recovery validation, cutover automation, final release closure, and release approval remain blocked pending Phases 64-66."
          : "Phase 63 requires production-safe shared dependencies before managed Postgres horizontal app-writer activation can proceed."
      ),
    },
  });
}

function withPhase64Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!isReport(report)) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const nestedPhase64 = firstReportAt(report, [
    ["phase64ManagedPostgresRecoveryValidationGate"],
    ["phase64ManagedPostgresRecoveryValidationReport"],
    ["managedDatabase", "phase64"],
    ["managedDatabase", "phase64ManagedPostgresRecoveryValidationGate"],
    ["managedDatabaseTopology", "phase64"],
    ["managedDatabaseTopology", "managedDatabase", "phase64"],
    ["managedDatabaseRuntimeGuard", "phase64"],
    ["managedDatabaseRuntimeGuard", "phase64ManagedPostgresRecoveryValidationGate"],
    ["releaseReadiness", "phase64"],
    ["releaseReadiness", "phase64ManagedPostgresRecoveryValidationGate"],
    ["releaseEvidence", "phase64"],
    ["releaseEvidence", "phase64ManagedPostgresRecoveryValidationGate"],
    ["evidence", "phase64"],
    ["evidence", "phase64ManagedPostgresRecoveryValidationGate"],
    ["asyncStoreBoundary", "phase64"],
    ["asyncStoreBoundary", "phase64ManagedPostgresRecoveryValidationGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE64_REPORT_KEY_PATTERN.test(key));
  const existingPhase64 = reportAt(report, ["phase64"]) ?? nestedPhase64 ?? {};
  const phase63 = reportAt(report, ["phase63"]) ?? {};
  const horizontalWriterIntent =
    existingPhase64.horizontalWriterTopologyRequested === true ||
    existingPhase64.required === true ||
    phase63.horizontalWriterTopologyRequested === true ||
    hasHorizontalWriterTopologyIntent(env);
  const hasPhase64EnvEvidence =
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION") !== undefined;

  if (!horizontalWriterIntent && !nestedPhase64 && !reportAt(report, ["phase64"]) && !hasPhase64EnvEvidence) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const backupRestoreEvidence =
    existingPhase64.backupRestoreEvidence ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_BACKUP_RESTORE_EVIDENCE");
  const pitrRehearsalEvidence =
    existingPhase64.pitrRehearsalEvidence ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_PITR_REHEARSAL_EVIDENCE");
  const failoverRehearsalEvidence =
    existingPhase64.failoverRehearsalEvidence ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_FAILOVER_REHEARSAL_EVIDENCE");
  const dataIntegrityValidationEvidence =
    existingPhase64.dataIntegrityValidationEvidence ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_DATA_INTEGRITY_VALIDATION_EVIDENCE");
  const recoveryTimeExpectation =
    existingPhase64.recoveryTimeExpectation ??
    phase62EnvValue(env, "TASKLOOM_MANAGED_POSTGRES_RECOVERY_TIME_EXPECTATION");
  const phase63ActivationDependencyGatePassed =
    existingPhase64.phase63ActivationDependencyGatePassed ??
    phase63.activationDependencyGatePassed ??
    false;
  const backupRestoreEvidenceAttached =
    existingPhase64.backupRestoreEvidenceAttached ?? backupRestoreEvidence !== undefined;
  const pitrRehearsalEvidenceAttached =
    existingPhase64.pitrRehearsalEvidenceAttached ?? pitrRehearsalEvidence !== undefined;
  const failoverRehearsalEvidenceAttached =
    existingPhase64.failoverRehearsalEvidenceAttached ?? failoverRehearsalEvidence !== undefined;
  const dataIntegrityValidationEvidenceAttached =
    existingPhase64.dataIntegrityValidationEvidenceAttached ?? dataIntegrityValidationEvidence !== undefined;
  const recoveryTimeExpectationAttached =
    existingPhase64.recoveryTimeExpectationAttached ?? recoveryTimeExpectation !== undefined;
  const managedPostgresRecoveryValidationReady =
    existingPhase64.managedPostgresRecoveryValidationReady ??
    (
      horizontalWriterIntent &&
      phase63ActivationDependencyGatePassed === true &&
      backupRestoreEvidenceAttached === true &&
      pitrRehearsalEvidenceAttached === true &&
      failoverRehearsalEvidenceAttached === true &&
      dataIntegrityValidationEvidenceAttached === true &&
      recoveryTimeExpectationAttached === true
    );

  return blockUnsupportedRuntimeReleaseClaims({
    ...report,
    phase64: {
      ...existingPhase64,
      phase: existingPhase64.phase ?? "64",
      required: existingPhase64.required ?? horizontalWriterIntent,
      horizontalWriterTopologyRequested: horizontalWriterIntent,
      phase63ActivationDependencyGatePassed,
      backupRestoreEvidenceRequired: existingPhase64.backupRestoreEvidenceRequired ?? horizontalWriterIntent,
      backupRestoreEvidence,
      backupRestoreEvidenceAttached,
      pitrRehearsalEvidenceRequired: existingPhase64.pitrRehearsalEvidenceRequired ?? horizontalWriterIntent,
      pitrRehearsalEvidence,
      pitrRehearsalEvidenceAttached,
      failoverRehearsalEvidenceRequired: existingPhase64.failoverRehearsalEvidenceRequired ?? horizontalWriterIntent,
      failoverRehearsalEvidence,
      failoverRehearsalEvidenceAttached,
      dataIntegrityValidationEvidenceRequired: existingPhase64.dataIntegrityValidationEvidenceRequired ?? horizontalWriterIntent,
      dataIntegrityValidationEvidence,
      dataIntegrityValidationEvidenceAttached,
      recoveryTimeExpectationRequired: existingPhase64.recoveryTimeExpectationRequired ?? horizontalWriterIntent,
      recoveryTimeExpectation,
      recoveryTimeExpectationAttached,
      managedPostgresRecoveryValidationReady,
      providerOwnedHaPitrValidated: existingPhase64.providerOwnedHaPitrValidated ?? managedPostgresRecoveryValidationReady,
      activeActiveSupported: false,
      regionalFailoverSupported: false,
      pitrRuntimeSupported: false,
      distributedSqliteSupported: false,
      applicationManagedRegionalFailoverSupported: false,
      applicationManagedPitrSupported: false,
      phases65To66Pending: horizontalWriterIntent,
      pendingPhases: horizontalWriterIntent ? ["65", "66"] : [],
      releaseAllowed: existingPhase64.releaseAllowed ?? !horizontalWriterIntent,
      strictBlocker: existingPhase64.strictBlocker ?? (horizontalWriterIntent && managedPostgresRecoveryValidationReady !== true),
      summary: existingPhase64.summary ?? (
        managedPostgresRecoveryValidationReady
          ? "Phase 64 records managed Postgres recovery validation for provider-owned HA/PITR; cutover automation, final release closure, and release approval remain blocked pending Phases 65-66."
          : "Phase 64 requires backup restore, PITR rehearsal, failover rehearsal, data-integrity validation, and recovery-time expectation evidence before activation can proceed."
      ),
    },
  });
}

function withPhase65Status(report: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!isReport(report)) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const nestedPhase65 = firstReportAt(report, [
    ["phase65CutoverRollbackAutomationGate"],
    ["phase65CutoverRollbackAutomationReport"],
    ["managedDatabase", "phase65"],
    ["managedDatabase", "phase65CutoverRollbackAutomationGate"],
    ["managedDatabaseTopology", "phase65"],
    ["managedDatabaseTopology", "phase65CutoverRollbackAutomationGate"],
    ["managedDatabaseRuntimeGuard", "phase65"],
    ["managedDatabaseRuntimeGuard", "phase65CutoverRollbackAutomationGate"],
    ["releaseReadiness", "phase65"],
    ["releaseReadiness", "phase65CutoverRollbackAutomationGate"],
    ["releaseEvidence", "phase65"],
    ["releaseEvidence", "phase65CutoverRollbackAutomationGate"],
    ["evidence", "phase65"],
    ["evidence", "phase65CutoverRollbackAutomationGate"],
    ["asyncStoreBoundary", "phase65"],
    ["asyncStoreBoundary", "phase65CutoverRollbackAutomationGate"],
  ]) ?? firstReportByKey(report, (key) => PHASE65_REPORT_KEY_PATTERN.test(key));
  const existingPhase65 = reportAt(report, ["phase65"]) ?? nestedPhase65 ?? {};
  const phase64 = reportAt(report, ["phase64"]) ?? {};
  const horizontalWriterIntent =
    existingPhase65.horizontalWriterTopologyRequested === true ||
    existingPhase65.required === true ||
    phase64.horizontalWriterTopologyRequested === true ||
    hasHorizontalWriterTopologyIntent(env);
  const hasPhase65EnvEvidence =
    phase62EnvValue(env, "TASKLOOM_CUTOVER_PREFLIGHT_STATUS") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_CUTOVER_PREFLIGHT_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_CUTOVER_PREFLIGHT_FAILED") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_ACTIVATION_DRY_RUN_STATUS") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_ACTIVATION_DRY_RUN_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_ACTIVATION_DRY_RUN_FAILED") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_POST_ACTIVATION_SMOKE_STATUS") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_POST_ACTIVATION_SMOKE_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_POST_ACTIVATION_SMOKE_CHECK_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_POST_ACTIVATION_SMOKE_CHECK_FAILED") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_ROLLBACK_COMMAND_GUIDANCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MONITORING_THRESHOLDS") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_MONITORING_THRESHOLD_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_OPERATIONS_HEALTH_CUTOVER_STATUS_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_SMOKE_FAILURE_ROLLBACK_EVIDENCE") !== undefined ||
    phase62EnvValue(env, "TASKLOOM_ROLLBACK_SAFE_POSTURE_EVIDENCE") !== undefined;

  if (!horizontalWriterIntent && !nestedPhase65 && !reportAt(report, ["phase65"]) && !hasPhase65EnvEvidence) {
    return blockUnsupportedRuntimeReleaseClaims(report);
  }

  const failedStatus = (value: string | undefined): boolean =>
    ["failed", "fail", "error", "blocked", "down", "rollback"].includes(normalize(value));
  const cutoverPreflightEvidence =
    existingPhase65.cutoverPreflightEvidence ??
    phase62EnvValue(env, "TASKLOOM_CUTOVER_PREFLIGHT_EVIDENCE");
  const activationDryRunEvidence =
    existingPhase65.activationDryRunEvidence ??
    phase62EnvValue(env, "TASKLOOM_ACTIVATION_DRY_RUN_EVIDENCE");
  const postActivationSmokeCheckEvidence =
    existingPhase65.postActivationSmokeCheckEvidence ??
    existingPhase65.postActivationSmokeEvidence ??
    phase62EnvValue(env, "TASKLOOM_POST_ACTIVATION_SMOKE_EVIDENCE") ??
    phase62EnvValue(env, "TASKLOOM_POST_ACTIVATION_SMOKE_CHECK_EVIDENCE");
  const rollbackCommandGuidance =
    existingPhase65.rollbackCommandGuidance ??
    phase62EnvValue(env, "TASKLOOM_ROLLBACK_COMMAND_GUIDANCE");
  const monitoringThresholdEvidence =
    existingPhase65.monitoringThresholdEvidence ??
    existingPhase65.monitoringThresholds ??
    phase62EnvValue(env, "TASKLOOM_MONITORING_THRESHOLDS") ??
    phase62EnvValue(env, "TASKLOOM_MONITORING_THRESHOLD_EVIDENCE");
  const operationsHealthCutoverStatusEvidence =
    existingPhase65.operationsHealthCutoverStatusEvidence ??
    phase62EnvValue(env, "TASKLOOM_OPERATIONS_HEALTH_CUTOVER_STATUS_EVIDENCE");
  const rollbackSafePostureEvidence =
    existingPhase65.rollbackSafePostureEvidence ??
    existingPhase65.smokeFailureRollbackEvidence ??
    phase62EnvValue(env, "TASKLOOM_SMOKE_FAILURE_ROLLBACK_EVIDENCE") ??
    phase62EnvValue(env, "TASKLOOM_ROLLBACK_SAFE_POSTURE_EVIDENCE");

  const cutoverPreflightEvidenceAttached =
    existingPhase65.cutoverPreflightEvidenceAttached ?? cutoverPreflightEvidence !== undefined;
  const activationDryRunEvidenceAttached =
    existingPhase65.activationDryRunEvidenceAttached ?? activationDryRunEvidence !== undefined;
  const postActivationSmokeCheckEvidenceAttached =
    existingPhase65.postActivationSmokeCheckEvidenceAttached ??
    existingPhase65.postActivationSmokeEvidenceAttached ??
    postActivationSmokeCheckEvidence !== undefined;
  const rollbackCommandGuidanceAttached =
    existingPhase65.rollbackCommandGuidanceAttached ?? rollbackCommandGuidance !== undefined;
  const monitoringThresholdEvidenceAttached =
    existingPhase65.monitoringThresholdEvidenceAttached ??
    existingPhase65.monitoringThresholdsAttached ??
    monitoringThresholdEvidence !== undefined;
  const operationsHealthCutoverStatusEvidenceAttached =
    existingPhase65.operationsHealthCutoverStatusEvidenceAttached ??
    operationsHealthCutoverStatusEvidence !== undefined;
  const rollbackSafePostureEvidenceAttached =
    existingPhase65.rollbackSafePostureEvidenceAttached ??
    existingPhase65.smokeFailureRollbackEvidenceAttached ??
    rollbackSafePostureEvidence !== undefined;
  const cutoverPreflightFailed =
    existingPhase65.cutoverPreflightFailed ??
    (truthy(env.TASKLOOM_CUTOVER_PREFLIGHT_FAILED) || failedStatus(env.TASKLOOM_CUTOVER_PREFLIGHT_STATUS));
  const activationDryRunFailed =
    existingPhase65.activationDryRunFailed ??
    (truthy(env.TASKLOOM_ACTIVATION_DRY_RUN_FAILED) || failedStatus(env.TASKLOOM_ACTIVATION_DRY_RUN_STATUS));
  const postActivationSmokeCheckFailed =
    existingPhase65.postActivationSmokeCheckFailed ??
    existingPhase65.postActivationSmokeFailed ??
    (
      truthy(env.TASKLOOM_POST_ACTIVATION_SMOKE_CHECK_FAILED) ||
      failedStatus(env.TASKLOOM_POST_ACTIVATION_SMOKE_STATUS)
    );
  const phase64ManagedPostgresRecoveryValidationReady =
    existingPhase65.phase64ManagedPostgresRecoveryValidationReady ??
    phase64.managedPostgresRecoveryValidationReady ??
    false;
  const rollbackToPriorSafePostureProven =
    existingPhase65.rollbackToPriorSafePostureProven ??
    existingPhase65.rollbackSafePostureEvidenceAttached ??
    existingPhase65.smokeFailureRollbackEvidenceAttached ??
    rollbackSafePostureEvidenceAttached;
  const automationFailureDetected =
    cutoverPreflightFailed === true ||
    activationDryRunFailed === true ||
    postActivationSmokeCheckFailed === true;
  const cutoverRollbackAutomationReady =
    existingPhase65.cutoverRollbackAutomationReady ??
    (
      horizontalWriterIntent &&
      phase64ManagedPostgresRecoveryValidationReady === true &&
      cutoverPreflightEvidenceAttached === true &&
      activationDryRunEvidenceAttached === true &&
      postActivationSmokeCheckEvidenceAttached === true &&
      rollbackCommandGuidanceAttached === true &&
      monitoringThresholdEvidenceAttached === true &&
      operationsHealthCutoverStatusEvidenceAttached === true &&
      rollbackToPriorSafePostureProven === true &&
      automationFailureDetected !== true
    );
  const summary = existingPhase65.summary ?? (
    cutoverRollbackAutomationReady
      ? "Phase 65 records repeatable managed Postgres cutover, smoke-check, rollback, and observability automation; final release closure and release approval remain blocked pending Phase 66."
      : automationFailureDetected
        ? "Phase 65 cutover automation detected a failed preflight, dry-run, or smoke check; activation remains blocked until rollback to the prior safe posture is proven."
        : "Phase 65 requires cutover preflight, activation dry-run, post-activation smoke, rollback command guidance, monitoring threshold, operations health status, and prior safe posture evidence before activation can proceed."
  );

  return blockUnsupportedRuntimeReleaseClaims({
    ...report,
    phase65: {
      ...existingPhase65,
      phase: existingPhase65.phase ?? "65",
      required: existingPhase65.required ?? horizontalWriterIntent,
      horizontalWriterTopologyRequested: horizontalWriterIntent,
      phase64ManagedPostgresRecoveryValidationReady,
      cutoverPreflightEvidenceRequired: existingPhase65.cutoverPreflightEvidenceRequired ?? horizontalWriterIntent,
      cutoverPreflightEvidence,
      cutoverPreflightEvidenceAttached,
      cutoverPreflightFailed,
      activationDryRunEvidenceRequired: existingPhase65.activationDryRunEvidenceRequired ?? horizontalWriterIntent,
      activationDryRunEvidence,
      activationDryRunEvidenceAttached,
      activationDryRunFailed,
      postActivationSmokeCheckEvidenceRequired:
        existingPhase65.postActivationSmokeCheckEvidenceRequired ?? horizontalWriterIntent,
      postActivationSmokeCheckEvidence,
      postActivationSmokeEvidence: postActivationSmokeCheckEvidence,
      postActivationSmokeCheckEvidenceAttached,
      postActivationSmokeEvidenceAttached: postActivationSmokeCheckEvidenceAttached,
      postActivationSmokeCheckFailed,
      postActivationSmokeFailed: postActivationSmokeCheckFailed,
      rollbackCommandGuidanceRequired: existingPhase65.rollbackCommandGuidanceRequired ?? horizontalWriterIntent,
      rollbackCommandGuidance,
      rollbackCommandGuidanceAttached,
      monitoringThresholdEvidenceRequired:
        existingPhase65.monitoringThresholdEvidenceRequired ?? horizontalWriterIntent,
      monitoringThresholdEvidence,
      monitoringThresholds: monitoringThresholdEvidence,
      monitoringThresholdEvidenceAttached,
      monitoringThresholdsAttached: monitoringThresholdEvidenceAttached,
      operationsHealthCutoverStatusEvidenceRequired:
        existingPhase65.operationsHealthCutoverStatusEvidenceRequired ?? horizontalWriterIntent,
      operationsHealthCutoverStatusEvidence,
      operationsHealthCutoverStatusEvidenceAttached,
      rollbackSafePostureEvidenceRequired: existingPhase65.rollbackSafePostureEvidenceRequired ?? horizontalWriterIntent,
      rollbackSafePostureEvidence,
      smokeFailureRollbackEvidence: rollbackSafePostureEvidence,
      rollbackSafePostureEvidenceAttached,
      smokeFailureRollbackEvidenceAttached: rollbackSafePostureEvidenceAttached,
      rollbackToPriorSafePostureProven,
      automationFailureDetected,
      cutoverRollbackAutomationReady,
      activationBlocked: existingPhase65.activationBlocked ?? (horizontalWriterIntent && cutoverRollbackAutomationReady !== true),
      activeActiveSupported: false,
      regionalFailoverSupported: false,
      pitrRuntimeSupported: false,
      distributedSqliteSupported: false,
      applicationManagedRegionalFailoverSupported: false,
      applicationManagedPitrSupported: false,
      phase66Pending: horizontalWriterIntent,
      pendingPhases: horizontalWriterIntent ? ["66"] : [],
      releaseAllowed: existingPhase65.releaseAllowed ?? !horizontalWriterIntent,
      strictBlocker: existingPhase65.strictBlocker ?? (horizontalWriterIntent && cutoverRollbackAutomationReady !== true),
      summary,
    },
  });
}

export function formatDeploymentCliJson(report: unknown, env: NodeJS.ProcessEnv): string {
  let enrichedReport = withPhase53Status(report, env);
  enrichedReport = withPhase54Status(enrichedReport, env);
  enrichedReport = withPhase55Status(enrichedReport, env);
  enrichedReport = withPhase56Status(enrichedReport, env);
  enrichedReport = withPhase57Status(enrichedReport, env);
  enrichedReport = withPhase58Status(enrichedReport, env);
  enrichedReport = withPhase59Status(enrichedReport, env);
  enrichedReport = withPhase60Status(enrichedReport, env);
  enrichedReport = withPhase61Status(enrichedReport, env);
  enrichedReport = withPhase62Status(enrichedReport, env);
  enrichedReport = withPhase63Status(enrichedReport, env);
  enrichedReport = withPhase64Status(enrichedReport, env);
  enrichedReport = withPhase65Status(enrichedReport, env);

  return JSON.stringify(redactValue(enrichedReport), null, 2);
}
