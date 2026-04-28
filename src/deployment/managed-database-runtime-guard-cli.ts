import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ManagedDatabaseRuntimeGuardReport {
  allowed?: unknown;
  blocked?: unknown;
  runtimeBlocked?: unknown;
  managedDatabaseRuntimeBlocked?: unknown;
  [key: string]: unknown;
}

export interface RunManagedDatabaseRuntimeGuardCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  out?: (line: string) => void;
  err?: (line: string) => void;
  buildManagedDatabaseRuntimeGuardReport?: (
    env: NodeJS.ProcessEnv,
    deps?: { strict?: boolean },
  ) => ManagedDatabaseRuntimeGuardReport | Promise<ManagedDatabaseRuntimeGuardReport>;
}

export async function runManagedDatabaseRuntimeGuardCli(
  options: RunManagedDatabaseRuntimeGuardCliOptions = {},
): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const out = options.out ?? ((line: string) => console.log(line));
  const err = options.err ?? ((line: string) => console.error(line));
  const buildManagedDatabaseRuntimeGuardReport =
    options.buildManagedDatabaseRuntimeGuardReport ?? loadManagedDatabaseRuntimeGuardReportBuilder;
  const strict = argv.includes("--strict");

  try {
    const report = await buildManagedDatabaseRuntimeGuardReport(env, { strict });
    out(JSON.stringify(report, null, 2));

    if (strict && isRuntimeGuardBlocked(report)) {
      return 1;
    }
    return 0;
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function loadManagedDatabaseRuntimeGuardReportBuilder(
  env: NodeJS.ProcessEnv,
  deps?: { strict?: boolean },
): Promise<ManagedDatabaseRuntimeGuardReport> {
  const managedDatabaseRuntimeGuardModulePath = "./managed-database-runtime-guard.js";
  const { buildManagedDatabaseRuntimeGuardReport } = await import(managedDatabaseRuntimeGuardModulePath) as {
    buildManagedDatabaseRuntimeGuardReport: (
      env: NodeJS.ProcessEnv,
      deps?: { strict?: boolean },
    ) => ManagedDatabaseRuntimeGuardReport | Promise<ManagedDatabaseRuntimeGuardReport>;
  };
  return buildManagedDatabaseRuntimeGuardReport(env, deps);
}

function isRuntimeGuardBlocked(report: ManagedDatabaseRuntimeGuardReport): boolean {
  return report.allowed !== true ||
    report.blocked === true ||
    report.runtimeBlocked === true ||
    report.managedDatabaseRuntimeBlocked === true;
}

function isExecutedDirectly(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entrypoint);
}

if (isExecutedDirectly()) {
  runManagedDatabaseRuntimeGuardCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
