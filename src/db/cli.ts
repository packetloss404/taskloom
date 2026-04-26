import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { deriveActivationStatus } from "../activation/service";
import { activationSubjectForWorkspace } from "../jobs";
import {
  createSeedStore,
  loadSqliteAppData,
  normalizeStore,
  persistSqliteAppData,
  resetLocalStore,
  snapshotForWorkspace,
  type TaskloomData,
} from "../taskloom-store";

export interface DbCliOptions {
  dbPath?: string;
  jsonPath?: string;
  migrationsDir?: string;
}

export interface MigrationResult {
  command: "migrate";
  dbPath: string;
  applied: string[];
  skipped: string[];
}

export interface DbSeedResult {
  command: "seed-db";
  dbPath: string;
  workspaces: number;
  tracks: number;
  milestones: number;
  checklistItems: number;
}

export interface AppDataResult {
  command: "seed-app" | "backfill" | "reset-app";
  dbPath: string;
  source: "seed" | "backfill";
  workspaces: number;
  users: number;
  agents: number;
  jobs: number;
}

export interface ResetResult {
  command: "reset-db" | "reset-store" | "seed-store";
  path: string;
}

const DEFAULT_DB_PATH = resolve(process.cwd(), "data", "taskloom.sqlite");
const DEFAULT_JSON_PATH = resolve(process.cwd(), "data", "taskloom.json");
const DEFAULT_MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");

export function migrateDatabase(options: DbCliOptions = {}): MigrationResult {
  const dbPath = options.dbPath ?? DEFAULT_DB_PATH;
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  try {
    db.exec("pragma foreign_keys = on");
    db.exec("create table if not exists schema_migrations (name text primary key, applied_at text not null default (datetime('now')))");

    const appliedRows = db.prepare("select name from schema_migrations order by name").all() as Array<{ name: string }>;
    const alreadyApplied = new Set(appliedRows.map((row) => row.name));
    const migrations = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const name of migrations) {
      if (alreadyApplied.has(name)) {
        skipped.push(name);
        continue;
      }

      const sql = readFileSync(resolve(migrationsDir, name), "utf8");
      db.exec("begin");
      try {
        db.exec(sql);
        db.prepare("insert into schema_migrations (name) values (?)").run(name);
        db.exec("commit");
        applied.push(name);
      } catch (error) {
        db.exec("rollback");
        throw error;
      }
    }

    return { command: "migrate", dbPath, applied, skipped };
  } finally {
    db.close();
  }
}

export function seedDatabase(options: DbCliOptions = {}, seedData: TaskloomData = createSeedStore()): DbSeedResult {
  const migrated = migrateDatabase(options);
  const db = new DatabaseSync(migrated.dbPath);
  try {
    db.exec("pragma foreign_keys = on");
    db.exec("begin");
    try {
      db.exec("delete from activation_checklist_items");
      db.exec("delete from activation_milestones");
      db.exec("delete from activation_tracks");

      const insertTrack = db.prepare(`
        insert into activation_tracks (id, workspace_id, subject_type, subject_id, started_at, current_stage, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMilestone = db.prepare(`
        insert into activation_milestones (id, workspace_id, subject_type, subject_id, key, reached_at, source, notes, created_at)
        values (?, ?, ?, ?, ?, ?, 'seed', ?, ?)
      `);
      const insertChecklist = db.prepare(`
        insert into activation_checklist_items (id, workspace_id, subject_type, subject_id, key, completed, completed_at, source, notes, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?, ?)
      `);

      let milestones = 0;
      let checklistItems = 0;

      for (const workspace of seedData.workspaces) {
        const subject = activationSubjectForWorkspace(workspace.id);
        const snapshot = snapshotForWorkspace(seedData, workspace.id);
        const status = deriveActivationStatus(subject, snapshot, seedData.activationMilestones[workspace.id] ?? []);
        const timestamp = snapshot.now;

        insertTrack.run(
          `activation_track_${workspace.id}`,
          subject.workspaceId,
          subject.subjectType,
          subject.subjectId,
          snapshot.startedAt ?? null,
          status.stage,
          timestamp,
          timestamp,
        );

        for (const milestone of status.milestones.filter((entry) => entry.reached)) {
          insertMilestone.run(
            `activation_milestone_${workspace.id}_${milestone.key}`,
            subject.workspaceId,
            subject.subjectType,
            subject.subjectId,
            milestone.key,
            milestone.reachedAt ?? timestamp,
            milestone.reason,
            timestamp,
          );
          milestones += 1;
        }

        for (const item of status.checklist) {
          insertChecklist.run(
            `activation_checklist_${workspace.id}_${item.key}`,
            subject.workspaceId,
            subject.subjectType,
            subject.subjectId,
            item.key,
            item.completed ? 1 : 0,
            item.completedAt ?? null,
            item.reason,
            timestamp,
            timestamp,
          );
          checklistItems += 1;
        }
      }

      db.exec("commit");
      return {
        command: "seed-db",
        dbPath: migrated.dbPath,
        workspaces: seedData.workspaces.length,
        tracks: seedData.workspaces.length,
        milestones,
        checklistItems,
      };
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  } finally {
    db.close();
  }
}

export function seedAppDatabase(options: DbCliOptions = {}, seedData: TaskloomData = createSeedStore()): AppDataResult {
  return writeAppData(options, normalizeStore(seedData), "seed", "seed-app");
}

export function backfillAppDatabase(options: DbCliOptions = {}): AppDataResult {
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const data = normalizeStore(JSON.parse(readFileSync(jsonPath, "utf8")) as Partial<TaskloomData>);
  return writeAppData(options, data, "backfill", "backfill");
}

export function resetAppDatabase(options: DbCliOptions = {}, seedData: TaskloomData = createSeedStore()): AppDataResult {
  const dbPath = options.dbPath ?? DEFAULT_DB_PATH;
  if (existsSync(dbPath)) rmSync(dbPath);
  return writeAppData(options, normalizeStore(seedData), "seed", "reset-app");
}

export function readAppData(options: DbCliOptions = {}): TaskloomData | null {
  const migrated = migrateDatabase(options);
  return loadSqliteAppData(migrated.dbPath);
}

function writeAppData(
  options: DbCliOptions,
  data: TaskloomData,
  source: AppDataResult["source"],
  command: AppDataResult["command"],
): AppDataResult {
  const migrated = migrateDatabase(options);
  seedDatabase(options, data);
  persistSqliteAppData(migrated.dbPath, data);

  return {
    command,
    dbPath: migrated.dbPath,
    source,
    workspaces: data.workspaces.length,
    users: data.users.length,
    agents: data.agents.length,
    jobs: data.jobs.length,
  };
}

export function resetDatabase(options: DbCliOptions = {}): ResetResult {
  const dbPath = options.dbPath ?? DEFAULT_DB_PATH;
  if (existsSync(dbPath)) rmSync(dbPath);
  migrateDatabase(options);
  return { command: "reset-db", path: dbPath };
}

export function seedLocalStore(): ResetResult {
  resetLocalStore();
  return { command: "seed-store", path: resolve(process.cwd(), "data", "taskloom.json") };
}

export function resetLocalDataStore(): ResetResult {
  resetLocalStore();
  return { command: "reset-store", path: resolve(process.cwd(), "data", "taskloom.json") };
}

export async function runDbCli(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv;
  const options = parseOptions(args);

  try {
    if (command === "migrate") {
      console.log(JSON.stringify(migrateDatabase(options), null, 2));
      return 0;
    }
    if (command === "seed-db") {
      console.log(JSON.stringify(seedDatabase(options), null, 2));
      return 0;
    }
    if (command === "seed-app") {
      console.log(JSON.stringify(seedAppDatabase(options), null, 2));
      return 0;
    }
    if (command === "backfill") {
      console.log(JSON.stringify(backfillAppDatabase(options), null, 2));
      return 0;
    }
    if (command === "reset-db") {
      console.log(JSON.stringify(resetDatabase(options), null, 2));
      return 0;
    }
    if (command === "reset-app") {
      console.log(JSON.stringify(resetAppDatabase(options), null, 2));
      return 0;
    }
    if (command === "seed-store") {
      console.log(JSON.stringify(seedLocalStore(), null, 2));
      return 0;
    }
    if (command === "reset-store") {
      console.log(JSON.stringify(resetLocalDataStore(), null, 2));
      return 0;
    }
    writeUsage();
    return 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

function parseOptions(args: string[]): DbCliOptions {
  const dbPath = readOption(args, "--db-path=");
  const jsonPath = readOption(args, "--json-path=");
  return {
    ...(dbPath ? { dbPath: resolve(dbPath) } : {}),
    ...(jsonPath ? { jsonPath: resolve(jsonPath) } : {}),
  };
}

function readOption(args: string[], prefix: string): string | undefined {
  const arg = args.find((entry) => entry.startsWith(prefix));
  const value = arg?.slice(prefix.length).trim();
  return value || undefined;
}

function writeUsage(): void {
  console.error("Usage: node --import tsx src/db/cli.ts <migrate|seed-db|seed-app|backfill|reset-db|reset-app|seed-store|reset-store> [--db-path=data/taskloom.sqlite] [--json-path=data/taskloom.json]");
}

function isExecutedDirectly(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entrypoint);
}

if (isExecutedDirectly()) {
  runDbCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
