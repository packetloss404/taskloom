import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDeploymentCliJson } from "./deployment-output-cli.js";

export interface ManagedDatabaseTopologyReport {
  readyForManagedDatabase?: unknown;
  readyForProductionManagedDatabase?: unknown;
  readyForProduction?: unknown;
  ready?: unknown;
  [key: string]: unknown;
}

export interface RunManagedDatabaseTopologyCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  out?: (line: string) => void;
  err?: (line: string) => void;
  buildManagedDatabaseTopologyReport?: (
    env: NodeJS.ProcessEnv,
    deps?: { strict?: boolean },
  ) => ManagedDatabaseTopologyReport | Promise<ManagedDatabaseTopologyReport>;
}

export async function runManagedDatabaseTopologyCli(
  options: RunManagedDatabaseTopologyCliOptions = {},
): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const out = options.out ?? ((line: string) => console.log(line));
  const err = options.err ?? ((line: string) => console.error(line));
  const buildManagedDatabaseTopologyReport =
    options.buildManagedDatabaseTopologyReport ?? loadManagedDatabaseTopologyReportBuilder;
  const strict = argv.includes("--strict");

  try {
    const report = await buildManagedDatabaseTopologyReport(env, { strict });
    out(formatDeploymentCliJson(report, env));

    if (strict && !isReadyForProductionManagedDatabase(report)) {
      return 1;
    }
    return 0;
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function loadManagedDatabaseTopologyReportBuilder(
  env: NodeJS.ProcessEnv,
  deps?: { strict?: boolean },
): Promise<ManagedDatabaseTopologyReport> {
  const managedDatabaseTopologyModulePath = "./managed-database-topology.js";
  const { buildManagedDatabaseTopologyReport } = await import(managedDatabaseTopologyModulePath) as {
    buildManagedDatabaseTopologyReport: (
      env: NodeJS.ProcessEnv,
      deps?: { strict?: boolean },
    ) => ManagedDatabaseTopologyReport | Promise<ManagedDatabaseTopologyReport>;
  };
  return buildManagedDatabaseTopologyReport(env, deps);
}

function isReadyForProductionManagedDatabase(report: ManagedDatabaseTopologyReport): boolean {
  return report.readyForProductionManagedDatabase === true ||
    report.readyForManagedDatabase === true ||
    report.readyForProduction === true ||
    report.ready === true;
}

function isExecutedDirectly(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entrypoint);
}

if (isExecutedDirectly()) {
  runManagedDatabaseTopologyCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
