import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDeploymentCliJson } from "./deployment-output-cli.js";

export interface ReleaseReadinessReport {
  readyForRelease?: unknown;
  [key: string]: unknown;
}

export interface RunReleaseReadinessCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  out?: (line: string) => void;
  err?: (line: string) => void;
  buildReleaseReadinessReport?: (
    env: NodeJS.ProcessEnv,
    deps?: { strict?: boolean },
  ) => ReleaseReadinessReport | Promise<ReleaseReadinessReport>;
}

export async function runReleaseReadinessCli(options: RunReleaseReadinessCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const out = options.out ?? ((line: string) => console.log(line));
  const err = options.err ?? ((line: string) => console.error(line));
  const buildReleaseReadinessReport = options.buildReleaseReadinessReport ?? loadReleaseReadinessReportBuilder;
  const strict = argv.includes("--strict");

  try {
    const report = await buildReleaseReadinessReport(env, { strict });
    out(formatDeploymentCliJson(report, env));

    if (strict && report.readyForRelease !== true) {
      return 1;
    }
    return 0;
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function loadReleaseReadinessReportBuilder(
  env: NodeJS.ProcessEnv,
  deps?: { strict?: boolean },
): Promise<ReleaseReadinessReport> {
  const releaseReadinessModulePath = "./release-readiness.js";
  const module = await import(releaseReadinessModulePath) as {
    buildReleaseReadinessReport: (
      env: NodeJS.ProcessEnv,
      deps?: { strict?: boolean },
    ) => ReleaseReadinessReport | Promise<ReleaseReadinessReport>;
  };
  return module.buildReleaseReadinessReport(env, deps);
}

function isExecutedDirectly(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entrypoint);
}

if (isExecutedDirectly()) {
  runReleaseReadinessCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
