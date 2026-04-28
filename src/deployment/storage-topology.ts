export type StorageTopologyMode = "json" | "sqlite" | "unsupported";
export type StorageTopologyClassification =
  | "local-dev"
  | "single-node"
  | "production-blocked"
  | "unsupported";

export type SchedulerLeaderMode = "off" | "file" | "http" | "unsupported";
export type AccessLogMode = "off" | "stdout" | "file" | "unsupported";

export interface StorageTopologyEnv {
  TASKLOOM_STORE?: string;
  TASKLOOM_DB_PATH?: string;
  NODE_ENV?: string;
  TASKLOOM_TRUST_PROXY?: string;
  TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL?: string;
  TASKLOOM_SCHEDULER_LEADER_MODE?: string;
  TASKLOOM_ACCESS_LOG_MODE?: string;
  TASKLOOM_ACCESS_LOG_PATH?: string;
}

export interface StorageTopologyProbeDeps {
  fileExists?: (path: string) => boolean;
  directoryExists?: (path: string) => boolean;
}

export interface StorageTopologyInput {
  env?: StorageTopologyEnv;
  probes?: StorageTopologyProbeDeps;
}

export interface StorageTopologyObservedConfig {
  nodeEnv: string;
  isProductionEnv: boolean;
  store: string;
  dbPath: string | null;
  trustProxy: boolean;
  distributedRateLimitUrl: string | null;
  schedulerLeaderMode: SchedulerLeaderMode;
  accessLogMode: AccessLogMode;
  accessLogPath: string | null;
  probes: {
    dbPathExists?: boolean;
    accessLogPathExists?: boolean;
    accessLogDirectoryExists?: boolean;
  };
}

export interface StorageTopologyRequirement {
  id: string;
  met: boolean;
  summary: string;
}

export interface StorageTopologyReport {
  mode: StorageTopologyMode;
  classification: StorageTopologyClassification;
  readyForProduction: boolean;
  summary: string;
  requirements: StorageTopologyRequirement[];
  warnings: string[];
  nextSteps: string[];
  observed: StorageTopologyObservedConfig;
}

const DEFAULT_JSON_PATH = "data/taskloom.json";
const DEFAULT_SQLITE_PATH = "data/taskloom.sqlite";
const VALID_LEADER_MODES: ReadonlySet<SchedulerLeaderMode> = new Set(["off", "file", "http"]);
const VALID_ACCESS_LOG_MODES: ReadonlySet<AccessLogMode> = new Set(["off", "stdout", "file"]);

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalize(value: string | undefined): string {
  return clean(value).toLowerCase();
}

function hasValue(value: string | null): boolean {
  return value !== null && value.length > 0;
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(normalize(value));
}

function resolveMode(store: string): StorageTopologyMode {
  if (store === "" || store === "json") return "json";
  if (store === "sqlite") return "sqlite";
  return "unsupported";
}

function resolveLeaderMode(raw: string): SchedulerLeaderMode {
  if (raw === "") return "off";
  if (VALID_LEADER_MODES.has(raw as SchedulerLeaderMode)) return raw as SchedulerLeaderMode;
  return "unsupported";
}

function resolveAccessLogMode(raw: string): AccessLogMode {
  if (raw === "") return "off";
  if (VALID_ACCESS_LOG_MODES.has(raw as AccessLogMode)) return raw as AccessLogMode;
  return "unsupported";
}

function parentPath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  if (slash <= 0) return null;
  return path.slice(0, slash);
}

function pushRequirement(
  requirements: StorageTopologyRequirement[],
  id: string,
  met: boolean,
  summary: string,
): void {
  requirements.push({ id, met, summary });
}

export function assessStorageTopology(input: StorageTopologyInput = {}): StorageTopologyReport {
  const env = input.env ?? {};
  const store = normalize(env.TASKLOOM_STORE);
  const mode = resolveMode(store);
  const nodeEnv = normalize(env.NODE_ENV) || "development";
  const isProductionEnv = nodeEnv === "production";
  const dbPath = mode === "sqlite" ? clean(env.TASKLOOM_DB_PATH) || DEFAULT_SQLITE_PATH : null;
  const trustProxy = truthy(env.TASKLOOM_TRUST_PROXY);
  const distributedRateLimitUrl = clean(env.TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL) || null;
  const schedulerLeaderMode = resolveLeaderMode(normalize(env.TASKLOOM_SCHEDULER_LEADER_MODE));
  const accessLogMode = resolveAccessLogMode(normalize(env.TASKLOOM_ACCESS_LOG_MODE));
  const accessLogPath = accessLogMode === "file" ? clean(env.TASKLOOM_ACCESS_LOG_PATH) || null : null;
  const distributedTopology = hasValue(distributedRateLimitUrl) || schedulerLeaderMode === "http";
  const fileLeaderTopology = schedulerLeaderMode === "file";

  const probes: StorageTopologyObservedConfig["probes"] = {};
  if (dbPath && input.probes?.fileExists) {
    probes.dbPathExists = input.probes.fileExists(dbPath);
  }
  if (accessLogPath && input.probes?.fileExists) {
    probes.accessLogPathExists = input.probes.fileExists(accessLogPath);
  }
  if (accessLogPath && input.probes?.directoryExists) {
    const parent = parentPath(accessLogPath);
    probes.accessLogDirectoryExists = parent === null ? true : input.probes.directoryExists(parent);
  }

  const requirements: StorageTopologyRequirement[] = [];
  const warnings: string[] = [];
  const nextSteps: string[] = [];
  let classification: StorageTopologyClassification;
  let summary: string;

  if (mode === "unsupported") {
    classification = "unsupported";
    summary = `Unsupported TASKLOOM_STORE value "${clean(env.TASKLOOM_STORE)}"; expected json or sqlite.`;
    pushRequirement(requirements, "supported-store-mode", false, "TASKLOOM_STORE must be unset, json, or sqlite.");
    warnings.push("The application cannot classify production readiness until the storage backend is supported.");
    nextSteps.push("Set TASKLOOM_STORE=sqlite for durable single-node persistence or leave it unset for local JSON development.");
  } else if (mode === "json") {
    classification = isProductionEnv ? "production-blocked" : "local-dev";
    summary = isProductionEnv
      ? "JSON storage is configured in production and is blocked for production use."
      : "JSON storage is configured for local development.";
    pushRequirement(requirements, "durable-production-store", false, "JSON storage is file-backed local state and is never production-ready.");
    pushRequirement(
      requirements,
      "single-writer-topology",
      !distributedTopology && !fileLeaderTopology,
      "JSON storage must not be used with multi-process or distributed coordination.",
    );
    warnings.push(`JSON mode stores data in ${DEFAULT_JSON_PATH} and is intended for contributor workflows only.`);
    nextSteps.push("Use TASKLOOM_STORE=sqlite with a durable TASKLOOM_DB_PATH for single-node production.");
    nextSteps.push("Move to a managed database before running multiple writers, multiple hosts, or multiple regions.");
  } else if (distributedTopology) {
    classification = "production-blocked";
    summary = "SQLite is configured with distributed coordination signals; this topology needs a managed database before production.";
    pushRequirement(requirements, "durable-production-store", true, "SQLite provides durable local persistence for one node.");
    pushRequirement(
      requirements,
      "managed-database-for-distribution",
      false,
      "HTTP leader election or distributed rate limiting indicates a distributed topology that SQLite cannot safely back.",
    );
    warnings.push("SQLite WAL/transactions protect local concurrency, not cross-host or multi-region writer coordination.");
    nextSteps.push("Keep only one writer process on the SQLite host, or replace SQLite with a deployment-managed database.");
    nextSteps.push("Retain shared rate limiting and HTTP leader coordination only after the primary store can support distributed writers.");
  } else {
    classification = isProductionEnv ? "single-node" : "local-dev";
    summary = isProductionEnv
      ? "SQLite is configured for durable single-node production."
      : "SQLite is configured for local or pre-production single-node use.";
    pushRequirement(requirements, "durable-production-store", true, "SQLite is durable when TASKLOOM_DB_PATH is on persistent backed-up storage.");
    pushRequirement(
      requirements,
      "single-writer-topology",
      true,
      "No distributed coordination signals were detected; keep the deployment to one SQLite writer node.",
    );
    if (fileLeaderTopology) {
      warnings.push("File leader mode can coordinate processes on one host, but it is still a single-node topology.");
    }
    nextSteps.push("Put TASKLOOM_DB_PATH, artifacts, and file logs on backed-up persistent storage.");
    nextSteps.push("Use backups and restore validation before migrations or release handoff.");
    nextSteps.push("Move to a managed database before scaling beyond one writer node.");
  }

  if (isProductionEnv && !trustProxy) {
    warnings.push("NODE_ENV=production is set without TASKLOOM_TRUST_PROXY=true; only enable it behind a trusted proxy.");
  }
  if (accessLogMode === "file" && !accessLogPath) {
    warnings.push("TASKLOOM_ACCESS_LOG_MODE=file requires TASKLOOM_ACCESS_LOG_PATH.");
  }
  if (accessLogMode === "unsupported") {
    warnings.push("Unknown TASKLOOM_ACCESS_LOG_MODE; access log readiness cannot be fully classified.");
  }
  if (schedulerLeaderMode === "unsupported") {
    warnings.push("Unknown TASKLOOM_SCHEDULER_LEADER_MODE; scheduler topology cannot be fully classified.");
  }
  if (probes.dbPathExists === false) {
    warnings.push(`SQLite database file does not exist yet at ${dbPath}.`);
  }
  if (probes.accessLogDirectoryExists === false) {
    warnings.push(`Access log directory does not exist for ${accessLogPath}.`);
  }

  return {
    mode,
    classification,
    readyForProduction: classification === "single-node",
    summary,
    requirements,
    warnings,
    nextSteps,
    observed: {
      nodeEnv,
      isProductionEnv,
      store: store || "json",
      dbPath,
      trustProxy,
      distributedRateLimitUrl,
      schedulerLeaderMode,
      accessLogMode,
      accessLogPath,
      probes,
    },
  };
}

export function buildStorageTopologyReport(
  env: StorageTopologyEnv = {},
  probes?: StorageTopologyProbeDeps,
): StorageTopologyReport {
  return assessStorageTopology({ env, probes });
}
