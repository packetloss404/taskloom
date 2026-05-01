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
const EVIDENCE_KEY_PATTERN = /evidence/i;
const PHASE59_URL_REDACTION_KEY_PATTERN = /(evidence|ticket|abort|signoff|runbook|approval)/i;
const PHASE60_URL_REDACTION_KEY_PATTERN =
  /(implementation|statement|matrix|evidence|cutover|approval|acceptance|support)/i;

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

function redactValue(
  value: unknown,
  force = false,
  redactPhaseUrl = false,
  inPhaseUrlRedactionReport = false,
  inPhase59Report = false,
  inPhase60Report = false,
): unknown {
  if (typeof value === "string") {
    if (!value) return value;
    return force || SECRET_URL_PATTERN.test(value) || (redactPhaseUrl && URL_PATTERN.test(value))
      ? "[redacted]"
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      redactValue(entry, force, redactPhaseUrl, inPhaseUrlRedactionReport, inPhase59Report, inPhase60Report)
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
        PHASE60_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase59Report = inPhase59Report || PHASE59_REPORT_KEY_PATTERN.test(key);
      const nestedInPhase60Report = inPhase60Report || PHASE60_REPORT_KEY_PATTERN.test(key);
      const nestedRedactPhaseUrl =
        redactPhaseUrl ||
        (nestedInPhase59Report && PHASE59_URL_REDACTION_KEY_PATTERN.test(key)) ||
        (nestedInPhase60Report && PHASE60_URL_REDACTION_KEY_PATTERN.test(key)) ||
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

function phase59EnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = clean(env[key]);
  return value ? value : undefined;
}

function phase60EnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
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

export function formatDeploymentCliJson(report: unknown, env: NodeJS.ProcessEnv): string {
  return JSON.stringify(
    redactValue(
      withPhase60Status(
        withPhase59Status(
          withPhase58Status(
            withPhase57Status(
              withPhase56Status(withPhase55Status(withPhase54Status(withPhase53Status(report, env), env), env), env),
              env,
            ),
            env,
          ),
          env,
        ),
        env,
      ),
    ),
    null,
    2,
  );
}
