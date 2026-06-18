import type { ResolvedTaskloomStoreMode, TaskloomStoreMode } from "./types.js";

export const MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE =
  "Managed database storage is not supported by Taskloom's synchronous store API yet. Use TASKLOOM_STORE=json or TASKLOOM_STORE=sqlite until an async managed database adapter is implemented.";

export const MANAGED_DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "TASKLOOM_DATABASE_URL",
  "TASKLOOM_MANAGED_DATABASE_URL",
] as const;
const MANAGED_STORE_MODES = new Set(["managed", "managed-db", "managed-database", "postgres", "postgresql"]);

export class ManagedDatabaseStoreBoundaryError extends Error {
  readonly code = "TASKLOOM_MANAGED_DATABASE_SYNC_ADAPTER_GAP";
  readonly storeMode: string;
  readonly managedDatabaseUrlKeys: string[];

  constructor(resolution: ResolvedTaskloomStoreMode) {
    const hints = [
      resolution.requestedStore ? `TASKLOOM_STORE=${resolution.requestedStore}` : null,
      ...resolution.managedDatabaseUrlKeys,
    ].filter(Boolean).join(", ");
    super(hints ? `${MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE} Unsupported managed database hint(s): ${hints}.` : MANAGED_DATABASE_SYNC_ADAPTER_GAP_MESSAGE);
    this.name = "ManagedDatabaseStoreBoundaryError";
    this.storeMode = resolution.requestedStore;
    this.managedDatabaseUrlKeys = resolution.managedDatabaseUrlKeys;
  }
}

export class ManagedPostgresStoreConfigurationError extends Error {
  readonly code = "TASKLOOM_MANAGED_POSTGRES_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = "ManagedPostgresStoreConfigurationError";
  }
}

export function cleanStoreEnvValue(value: string | undefined): string {
  return (value ?? "").trim();
}

export function resolveTaskloomStoreMode(env: NodeJS.ProcessEnv = process.env): ResolvedTaskloomStoreMode {
  const requestedStore = cleanStoreEnvValue(env.TASKLOOM_STORE).toLowerCase();
  const managedDatabaseUrlKeys = MANAGED_DATABASE_URL_ENV_KEYS.filter((key) => cleanStoreEnvValue(env[key]).length > 0);
  const mode: TaskloomStoreMode = requestedStore === "sqlite"
    ? "sqlite"
    : requestedStore === "json" || requestedStore === ""
      ? managedDatabaseUrlKeys.length > 0 ? "managed" : "json"
      : MANAGED_STORE_MODES.has(requestedStore)
        ? requestedStore === "postgres" || requestedStore === "postgresql" ? "postgres" : "managed"
        : "json";

  return {
    mode,
    requestedStore,
    managedDatabaseUrlKeys,
  };
}

