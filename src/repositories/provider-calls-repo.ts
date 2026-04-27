import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { ProviderCallRecord, TaskloomData } from "../taskloom-store.js";
import { loadStore as defaultLoadStore, mutateStore as defaultMutateStore } from "../taskloom-store.js";

const DEFAULT_DB_FILE = "data/taskloom.sqlite";
const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

export interface ListProviderCallsFilter {
  workspaceId: string;
  since?: string;
  limit?: number;
}

export interface ProviderCallsRepository {
  list(filter: ListProviderCallsFilter): ProviderCallRecord[];
  upsert(record: ProviderCallRecord): void;
  insertMany(records: ProviderCallRecord[]): void;
  pruneRetainLatest(maxRows: number): number;
  count(): number;
}

export interface ProviderCallsRepositoryDeps {
  loadStore?: () => TaskloomData;
  mutateStore?: <T>(mutator: (data: TaskloomData) => T) => T;
  dbPath?: string;
}

export function createProviderCallsRepository(
  deps: ProviderCallsRepositoryDeps = {},
): ProviderCallsRepository {
  if (process.env.TASKLOOM_STORE === "sqlite") return sqliteProviderCallsRepository(deps);
  return jsonProviderCallsRepository(deps);
}

export function jsonProviderCallsRepository(
  deps: ProviderCallsRepositoryDeps = {},
): ProviderCallsRepository {
  const load = deps.loadStore ?? defaultLoadStore;
  const mutate = deps.mutateStore ?? defaultMutateStore;
  return {
    list(filter) {
      const data = load();
      const collection = Array.isArray(data.providerCalls) ? data.providerCalls : [];
      return applyListFilter(collection, filter);
    },
    upsert(record) {
      mutate((data) => {
        if (!Array.isArray(data.providerCalls)) data.providerCalls = [];
        upsertIntoCollection(data.providerCalls, record);
        return null;
      });
    },
    insertMany(records) {
      if (records.length === 0) return;
      mutate((data) => {
        if (!Array.isArray(data.providerCalls)) data.providerCalls = [];
        for (const record of records) {
          upsertIntoCollection(data.providerCalls, record);
        }
        return null;
      });
    },
    pruneRetainLatest(maxRows) {
      const retain = normalizeMaxRows(maxRows);
      return mutate((data) => {
        if (!Array.isArray(data.providerCalls)) {
          data.providerCalls = [];
          return 0;
        }
        const before = data.providerCalls.length;
        if (before <= retain) return 0;
        data.providerCalls = sortNewestFirst(data.providerCalls).slice(0, retain);
        return before - data.providerCalls.length;
      });
    },
    count() {
      const data = load();
      return Array.isArray(data.providerCalls) ? data.providerCalls.length : 0;
    },
  };
}

export function sqliteProviderCallsRepository(
  deps: ProviderCallsRepositoryDeps = {},
): ProviderCallsRepository {
  const dbPath = resolveDbPath(deps.dbPath);
  return {
    list(filter) {
      const db = openDatabase(dbPath);
      try {
        const sql: string[] = [
          "select * from provider_calls where workspace_id = ? order by completed_at desc, id desc",
        ];
        const params: Array<string | number> = [filter.workspaceId];
        if (filter.since === undefined && isPositiveLimit(filter.limit)) {
          sql.push("limit ?");
          params.push(filter.limit);
        }
        const rows = db.prepare(sql.join(" ")).all(...params) as unknown as ProviderCallRow[];
        const records = rows.map(rowToRecord);
        return applySinceAndLimit(records, filter.since, filter.limit);
      } finally {
        db.close();
      }
    },
    upsert(record) {
      const db = openDatabase(dbPath);
      try {
        upsertRow(db, record);
      } finally {
        db.close();
      }
    },
    insertMany(records) {
      if (records.length === 0) return;
      const db = openDatabase(dbPath);
      try {
        db.exec("begin immediate");
        try {
          const stmt = prepareUpsert(db);
          for (const record of records) {
            runUpsert(stmt, record);
          }
          db.exec("commit");
        } catch (error) {
          db.exec("rollback");
          throw error;
        }
      } finally {
        db.close();
      }
    },
    pruneRetainLatest(maxRows) {
      const db = openDatabase(dbPath);
      try {
        const result = db.prepare(`
          delete from provider_calls
          where id not in (
            select id from provider_calls
            order by completed_at desc, id desc
            limit ?
          )
        `).run(normalizeMaxRows(maxRows));
        return Number(result.changes ?? 0);
      } finally {
        db.close();
      }
    },
    count() {
      const db = openDatabase(dbPath);
      try {
        const row = db.prepare("select count(*) as count from provider_calls").get() as
          | { count: number }
          | undefined;
        return row?.count ?? 0;
      } finally {
        db.close();
      }
    },
  };
}

interface ProviderCallRow {
  id: string;
  workspace_id: string;
  route_key: string;
  provider: ProviderCallRecord["provider"];
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  duration_ms: number;
  status: ProviderCallRecord["status"];
  error_message: string | null;
  started_at: string;
  completed_at: string;
}

type ProviderCallStatement = ReturnType<DatabaseSync["prepare"]>;

function upsertRow(db: DatabaseSync, record: ProviderCallRecord): void {
  runUpsert(prepareUpsert(db), record);
}

function prepareUpsert(db: DatabaseSync): ProviderCallStatement {
  return db.prepare(`
    insert or replace into provider_calls (
      id, workspace_id, route_key, provider, model, prompt_tokens, completion_tokens,
      cost_usd, duration_ms, status, error_message, started_at, completed_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
}

function runUpsert(stmt: ProviderCallStatement, record: ProviderCallRecord): void {
  stmt.run(
    record.id,
    record.workspaceId,
    record.routeKey,
    record.provider,
    record.model,
    record.promptTokens,
    record.completionTokens,
    record.costUsd,
    record.durationMs,
    record.status,
    record.errorMessage ?? null,
    record.startedAt,
    record.completedAt,
  );
}

function rowToRecord(row: ProviderCallRow): ProviderCallRecord {
  const record: ProviderCallRecord = {
    id: row.id,
    workspaceId: row.workspace_id,
    routeKey: row.route_key,
    provider: row.provider,
    model: row.model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
  if (row.error_message !== null) record.errorMessage = row.error_message;
  return record;
}

function upsertIntoCollection(collection: ProviderCallRecord[], record: ProviderCallRecord): void {
  const index = collection.findIndex((entry) => entry.id === record.id);
  if (index >= 0) {
    collection[index] = record;
  } else {
    collection.push(record);
  }
}

function applyListFilter(
  collection: ProviderCallRecord[],
  filter: ListProviderCallsFilter,
): ProviderCallRecord[] {
  const workspaceRows = collection.filter((entry) => entry.workspaceId === filter.workspaceId);
  return applySinceAndLimit(sortNewestFirst(workspaceRows), filter.since, filter.limit);
}

function applySinceAndLimit(
  records: ProviderCallRecord[],
  since: string | undefined,
  limit: number | undefined,
): ProviderCallRecord[] {
  const filtered = since === undefined
    ? records
    : records.filter((entry) => Date.parse(entry.completedAt) >= Date.parse(since));
  return isPositiveLimit(limit) ? filtered.slice(0, limit) : filtered;
}

function sortNewestFirst(records: ProviderCallRecord[]): ProviderCallRecord[] {
  return records.slice().sort((left, right) => {
    const cmp = right.completedAt.localeCompare(left.completedAt);
    if (cmp !== 0) return cmp;
    return right.id.localeCompare(left.id);
  });
}

function isPositiveLimit(limit: number | undefined): limit is number {
  return typeof limit === "number" && limit > 0;
}

function normalizeMaxRows(maxRows: number): number {
  if (!Number.isFinite(maxRows)) return 0;
  return Math.max(0, Math.floor(maxRows));
}

function resolveDbPath(override?: string): string {
  if (override) return resolve(override);
  return resolve(process.cwd(), process.env.TASKLOOM_DB_PATH ?? DEFAULT_DB_FILE);
}

function openDatabase(dbPath: string): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("pragma busy_timeout = 5000");
  db.exec("pragma journal_mode = wal");
  db.exec("pragma synchronous = normal");
  db.exec("pragma foreign_keys = on");
  applyMigrations(db);
  return db;
}

function applyMigrations(db: DatabaseSync): void {
  db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at text not null default (datetime('now')))",
  );
  const appliedRows = db.prepare("select name from schema_migrations order by name").all() as Array<{ name: string }>;
  const alreadyApplied = new Set(appliedRows.map((row) => row.name));
  const migrations = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrations) {
    if (alreadyApplied.has(name)) continue;
    const sql = readFileSync(resolve(MIGRATIONS_DIR, name), "utf8");
    db.exec("begin");
    try {
      db.exec(sql);
      db.prepare("insert into schema_migrations (name) values (?)").run(name);
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }
}
