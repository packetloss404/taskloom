import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface StorageTopologyReport {
  readyForProduction?: unknown;
  [key: string]: unknown;
}

export interface RunStorageTopologyCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  out?: (line: string) => void;
  err?: (line: string) => void;
  buildStorageTopologyReport?: (env: NodeJS.ProcessEnv) => StorageTopologyReport | Promise<StorageTopologyReport>;
}

export async function runStorageTopologyCli(options: RunStorageTopologyCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const out = options.out ?? ((line: string) => console.log(line));
  const err = options.err ?? ((line: string) => console.error(line));
  const buildStorageTopologyReport = options.buildStorageTopologyReport ?? loadStorageTopologyReportBuilder;

  try {
    const report = await buildStorageTopologyReport(env);
    out(JSON.stringify(report, null, 2));

    if (argv.includes("--strict") && report.readyForProduction !== true) {
      return 1;
    }
    return 0;
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function loadStorageTopologyReportBuilder(env: NodeJS.ProcessEnv): Promise<StorageTopologyReport> {
  const storageTopologyModulePath = "./storage-topology.js";
  const module = await import(storageTopologyModulePath) as {
    buildStorageTopologyReport: (env: NodeJS.ProcessEnv) => StorageTopologyReport | Promise<StorageTopologyReport>;
  };
  return module.buildStorageTopologyReport(env);
}

function isExecutedDirectly(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entrypoint);
}

if (isExecutedDirectly()) {
  runStorageTopologyCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
