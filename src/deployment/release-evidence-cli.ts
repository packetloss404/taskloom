import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ReleaseEvidenceBundle {
  readyForRelease?: unknown;
  [key: string]: unknown;
}

export interface RunReleaseEvidenceCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  out?: (line: string) => void;
  err?: (line: string) => void;
  buildReleaseEvidenceBundle?: (
    env: NodeJS.ProcessEnv,
    deps?: { strict?: boolean },
  ) => ReleaseEvidenceBundle | Promise<ReleaseEvidenceBundle>;
}

export async function runReleaseEvidenceCli(options: RunReleaseEvidenceCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const out = options.out ?? ((line: string) => console.log(line));
  const err = options.err ?? ((line: string) => console.error(line));
  const buildReleaseEvidenceBundle = options.buildReleaseEvidenceBundle ?? loadReleaseEvidenceBundleBuilder;
  const strict = argv.includes("--strict");

  try {
    const bundle = await buildReleaseEvidenceBundle(env, { strict });
    out(JSON.stringify(bundle, null, 2));

    if (strict && bundle.readyForRelease !== true) {
      return 1;
    }
    return 0;
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function loadReleaseEvidenceBundleBuilder(
  env: NodeJS.ProcessEnv,
  deps?: { strict?: boolean },
): Promise<ReleaseEvidenceBundle> {
  const releaseEvidenceModulePath = "./release-evidence.js";
  const { buildReleaseEvidenceBundle } = await import(releaseEvidenceModulePath) as {
    buildReleaseEvidenceBundle: (
      env: NodeJS.ProcessEnv,
      deps?: { strict?: boolean },
    ) => ReleaseEvidenceBundle | Promise<ReleaseEvidenceBundle>;
  };
  return buildReleaseEvidenceBundle(env, deps);
}

function isExecutedDirectly(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entrypoint);
}

if (isExecutedDirectly()) {
  runReleaseEvidenceCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
