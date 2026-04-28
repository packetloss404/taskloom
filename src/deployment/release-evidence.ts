import {
  buildStorageTopologyReport as defaultBuildStorageTopologyReport,
  type StorageTopologyEnv,
  type StorageTopologyProbeDeps,
  type StorageTopologyReport,
} from "./storage-topology.js";
import {
  buildReleaseReadinessReport as defaultBuildReleaseReadinessReport,
  type ReleaseReadinessDeps,
  type ReleaseReadinessEnv,
  type ReleaseReadinessReport,
} from "./release-readiness.js";

export type ReleaseEvidenceEnvValue = string | number | boolean | null | undefined;
export type ReleaseEvidenceEnv = ReleaseReadinessEnv & Record<string, ReleaseEvidenceEnvValue>;

export interface ReleaseEvidenceEntry {
  name: string;
  configured: boolean;
  value: string | null;
  redacted: boolean;
}

export interface ReleaseEvidenceAttachment {
  id: string;
  label: string;
  format: "json";
  required: boolean;
  summary: string;
}

export interface ReleaseEvidenceBundle {
  phase: "44";
  generatedAt: string;
  summary: string;
  readyForRelease: boolean;
  storageTopology: StorageTopologyReport;
  releaseReadiness: ReleaseReadinessReport;
  evidence: {
    environment: ReleaseEvidenceEntry[];
    config: {
      nodeEnv: string;
      storageMode: StorageTopologyReport["mode"];
      storageClassification: StorageTopologyReport["classification"];
      strictRelease: boolean;
      backupConfigured: boolean;
      restoreDrillRecorded: boolean;
      artifactPathConfigured: boolean;
      accessLogMode: string;
    };
  };
  attachments: ReleaseEvidenceAttachment[];
  nextSteps: string[];
}

export interface ReleaseEvidenceDeps {
  probes?: StorageTopologyProbeDeps;
  storageTopology?: StorageTopologyReport;
  releaseReadiness?: ReleaseReadinessReport;
  buildStorageTopologyReport?: (
    env?: StorageTopologyEnv,
    probes?: StorageTopologyProbeDeps,
  ) => StorageTopologyReport;
  buildReleaseReadinessReport?: (
    env?: ReleaseReadinessEnv,
    deps?: ReleaseReadinessDeps,
  ) => ReleaseReadinessReport;
  strict?: boolean;
}

export interface ReleaseEvidenceInput extends ReleaseEvidenceDeps {
  env?: ReleaseEvidenceEnv;
  generatedAt?: string | Date;
}

const DEPLOYMENT_ENV_KEYS = [
  "NODE_ENV",
  "TASKLOOM_STORE",
  "TASKLOOM_DB_PATH",
  "TASKLOOM_BACKUP_DIR",
  "TASKLOOM_ARTIFACTS_PATH",
  "TASKLOOM_ARTIFACT_DIR",
  "TASKLOOM_RESTORE_DRILL_AT",
  "TASKLOOM_LAST_RESTORE_DRILL_AT",
  "TASKLOOM_RESTORE_DRILL_MARKER",
  "TASKLOOM_TRUST_PROXY",
  "TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL",
  "TASKLOOM_SCHEDULER_LEADER_MODE",
  "TASKLOOM_ACCESS_LOG_MODE",
  "TASKLOOM_ACCESS_LOG_PATH",
  "TASKLOOM_RELEASE_STRICT",
  "TASKLOOM_STRICT_RELEASE",
] as const;

const SENSITIVE_NAME_PATTERN = /(secret|token|password|passwd|pwd|credential|private|apikey|api_key|auth|session|cookie)/i;
const SECRET_URL_PATTERN = /^https?:\/\/[^/\s:@]+:[^/\s@]+@/i;

function stringValue(value: ReleaseEvidenceEnvValue): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function configured(value: ReleaseEvidenceEnvValue): boolean {
  return stringValue(value).length > 0;
}

function truthy(value: ReleaseEvidenceEnvValue): boolean {
  return ["1", "true", "yes", "on"].includes(stringValue(value).toLowerCase());
}

function generatedAtString(value: string | Date | undefined): string {
  if (value instanceof Date) return value.toISOString();
  return value ?? new Date().toISOString();
}

function hasUrlSecret(value: string): boolean {
  return SECRET_URL_PATTERN.test(value);
}

function shouldRedact(name: string, value: string): boolean {
  return configured(value) && (SENSITIVE_NAME_PATTERN.test(name) || hasUrlSecret(value));
}

function redactValue(name: string, value: ReleaseEvidenceEnvValue): Pick<ReleaseEvidenceEntry, "value" | "redacted"> {
  const normalized = stringValue(value);
  if (!normalized) return { value: null, redacted: false };
  if (shouldRedact(name, normalized)) return { value: "[redacted]", redacted: true };
  return { value: normalized, redacted: false };
}

function releaseEnv(env: ReleaseEvidenceEnv): ReleaseReadinessEnv {
  return env;
}

function storageEnv(env: ReleaseEvidenceEnv): StorageTopologyEnv {
  return env;
}

function buildEnvironmentEvidence(env: ReleaseEvidenceEnv): ReleaseEvidenceEntry[] {
  const keys = new Set<string>(DEPLOYMENT_ENV_KEYS);

  for (const key of Object.keys(env).sort()) {
    if (key.startsWith("TASKLOOM_") && (SENSITIVE_NAME_PATTERN.test(key) || hasUrlSecret(stringValue(env[key])))) {
      keys.add(key);
    }
  }

  return Array.from(keys)
    .sort()
    .map((name) => ({
      name,
      configured: configured(env[name]),
      ...redactValue(name, env[name]),
    }));
}

function restoreDrillRecorded(env: ReleaseEvidenceEnv): boolean {
  return (
    configured(env.TASKLOOM_RESTORE_DRILL_AT) ||
    configured(env.TASKLOOM_LAST_RESTORE_DRILL_AT) ||
    configured(env.TASKLOOM_RESTORE_DRILL_MARKER)
  );
}

function artifactPathConfigured(env: ReleaseEvidenceEnv): boolean {
  return configured(env.TASKLOOM_ARTIFACTS_PATH) || configured(env.TASKLOOM_ARTIFACT_DIR);
}

function buildAttachments(
  storageTopology: StorageTopologyReport,
  releaseReadiness: ReleaseReadinessReport,
  bundleReady: boolean,
): ReleaseEvidenceAttachment[] {
  return [
    {
      id: "phase-42-storage-topology",
      label: "Phase 42 storage topology report",
      format: "json",
      required: true,
      summary: storageTopology.summary,
    },
    {
      id: "phase-43-release-readiness",
      label: "Phase 43 release readiness report",
      format: "json",
      required: true,
      summary: releaseReadiness.summary,
    },
    {
      id: "phase-44-release-evidence",
      label: "Phase 44 release evidence bundle",
      format: "json",
      required: true,
      summary: bundleReady
        ? "Release evidence bundle is ready for handoff."
        : "Release evidence bundle includes unresolved release blockers.",
    },
  ];
}

function buildSummary(releaseReadiness: ReleaseReadinessReport): string {
  return releaseReadiness.readyForRelease
    ? `Phase 44 release evidence is ready for handoff. ${releaseReadiness.summary}`
    : `Phase 44 release evidence is blocked. ${releaseReadiness.summary}`;
}

export function assessReleaseEvidence(input: ReleaseEvidenceInput = {}): ReleaseEvidenceBundle {
  const env = input.env ?? {};
  const generatedAt = generatedAtString(input.generatedAt);
  const buildStorageTopologyReport =
    input.buildStorageTopologyReport ?? defaultBuildStorageTopologyReport;
  const storageTopology =
    input.storageTopology ??
    input.releaseReadiness?.storageTopology ??
    buildStorageTopologyReport(storageEnv(env), input.probes);
  const releaseReadiness =
    input.releaseReadiness ??
    (input.buildReleaseReadinessReport ?? defaultBuildReleaseReadinessReport)(releaseEnv(env), {
      probes: input.probes,
      storageTopology,
      strict: input.strict,
      buildStorageTopologyReport,
    });
  const readyForRelease = releaseReadiness.readyForRelease;

  return {
    phase: "44",
    generatedAt,
    summary: buildSummary(releaseReadiness),
    readyForRelease,
    storageTopology,
    releaseReadiness,
    evidence: {
      environment: buildEnvironmentEvidence(env),
      config: {
        nodeEnv: storageTopology.observed.nodeEnv,
        storageMode: storageTopology.mode,
        storageClassification: storageTopology.classification,
        strictRelease: input.strict === true || truthy(env.TASKLOOM_RELEASE_STRICT) || truthy(env.TASKLOOM_STRICT_RELEASE),
        backupConfigured: configured(env.TASKLOOM_BACKUP_DIR),
        restoreDrillRecorded: restoreDrillRecorded(env),
        artifactPathConfigured: artifactPathConfigured(env),
        accessLogMode: storageTopology.observed.accessLogMode,
      },
    },
    attachments: buildAttachments(storageTopology, releaseReadiness, readyForRelease),
    nextSteps: releaseReadiness.nextSteps,
  };
}

export function buildReleaseEvidenceBundle(
  env: ReleaseEvidenceEnv = {},
  deps: ReleaseEvidenceDeps & { generatedAt?: string | Date } = {},
): ReleaseEvidenceBundle {
  return assessReleaseEvidence({ env, ...deps });
}
