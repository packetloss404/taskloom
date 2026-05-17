/**
 * File-tree build validator.
 *
 * Takes an in-memory `{ path, content }[]` representing a generated
 * application, writes it to a fresh temp workspace, and runs `tsc --noEmit`
 * against it via the existing sandbox infrastructure. tsc's diagnostics are
 * parsed into a structured `ValidationResult` so the caller can surface them
 * (e.g. as a one-shot retry hint per Reviewer E's recommendation — this module
 * does NOT attempt multi-round auto-fix).
 *
 * The validator is gated on the same env switch as the sandbox smoke pipeline
 * (`TASKLOOM_SANDBOX_SMOKE_ENABLED=1`). When the gate is off, or when the
 * sandbox cannot be spawned (e.g. the Windows ENOENT issue documented in
 * sandbox notes), `validateFileTree` returns `{ ok: true, source: "skipped" }`
 * so the surrounding codegen flow never blocks on a missing sandbox.
 *
 * Tests inject `options.runner` to avoid spawning a real sandbox.
 */

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getDefaultSandboxService } from "../sandbox/sandbox-service.js";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface ValidationError {
  /** Path of the offending file, relative to the temp workspace where possible. */
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  /** "skipped" when the sandbox gate is off or the sandbox is unavailable. */
  source: "real" | "skipped";
  errors: ValidationError[];
  warnings: ValidationError[];
  durationMs: number;
}

/** Result of a single tsc invocation, as observed from outside the sandbox. */
export interface RunnerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  errorMessage?: string;
}

/** Function signature for the pluggable command runner. */
export type ValidationRunner = (params: {
  workspaceDir: string;
  command: string;
  timeoutMs: number;
  signal?: AbortSignal;
}) => Promise<RunnerResult>;

export interface ValidateOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Test-only override. When omitted, uses the real sandbox service. */
  runner?: ValidationRunner;
  /** Test-only override. When omitted, reads `process.env`. */
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const SMOKE_ENV_VAR = "TASKLOOM_SANDBOX_SMOKE_ENABLED";
const LOG_PREFIX = "[codegen-validate]";

/**
 * tsc default diagnostic format:
 *   path/to/file.ts(line,col): error TSnnnn: message
 *   path/to/file.ts(line,col): warning TSnnnn: message
 *
 * tsc may also emit diagnostics without a location (e.g. config errors):
 *   error TSnnnn: message
 */
const TSC_LOCATED_RE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s*(.*)$/;
const TSC_GLOBAL_RE = /^(error|warning)\s+TS\d+:\s*(.*)$/;

function skipped(durationMs = 0): ValidationResult {
  return {
    ok: true,
    source: "skipped",
    errors: [],
    warnings: [],
    durationMs,
  };
}

/**
 * Write the file tree to `workspaceDir`. Any nested directories are created.
 * Paths are normalized and constrained to the workspace (no `..` escapes).
 */
async function writeTree(workspaceDir: string, files: GeneratedFile[]): Promise<void> {
  for (const file of files) {
    if (isAbsolute(file.path)) {
      throw new Error(`generated file path must be relative: ${file.path}`);
    }
    const target = resolve(workspaceDir, file.path);
    if (!target.startsWith(resolve(workspaceDir))) {
      throw new Error(`generated file path escapes workspace: ${file.path}`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

/**
 * Returns true if the tree already contains a tsconfig at its root.
 */
function hasRootTsconfig(files: GeneratedFile[]): boolean {
  return files.some((f) => f.path === "tsconfig.json" || f.path === "./tsconfig.json");
}

/** Minimal tsconfig used when the generated tree does not include one. */
const DEFAULT_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      noEmit: true,
    },
    include: ["**/*.ts", "**/*.tsx"],
  },
  null,
  2,
);

/**
 * Parse tsc's combined stdout/stderr into structured diagnostics. tsc writes
 * diagnostics to stdout in default mode, but some hosts route via stderr; we
 * accept both.
 */
export function parseTscOutput(combined: string): {
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const lines = combined.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const locatedMatch = TSC_LOCATED_RE.exec(line);
    if (locatedMatch) {
      const [, file, lineStr, colStr, severity, message] = locatedMatch;
      const diag: ValidationError = {
        file: file!,
        line: Number(lineStr),
        column: Number(colStr),
        message: message!,
        severity: severity === "warning" ? "warning" : "error",
      };
      if (diag.severity === "warning") warnings.push(diag);
      else errors.push(diag);
      continue;
    }
    const globalMatch = TSC_GLOBAL_RE.exec(line);
    if (globalMatch) {
      const [, severity, message] = globalMatch;
      const diag: ValidationError = {
        file: "<tsconfig>",
        message: message!,
        severity: severity === "warning" ? "warning" : "error",
      };
      if (diag.severity === "warning") warnings.push(diag);
      else errors.push(diag);
    }
  }
  return { errors, warnings };
}

/**
 * Build the default runner that drives commands through the real sandbox
 * service. This intentionally lives behind a function so tests can inject a
 * lightweight fake without spinning up the sandbox store.
 */
function createDefaultRunner(): ValidationRunner {
  return async ({ workspaceDir, command, timeoutMs, signal }) => {
    const sandbox = getDefaultSandboxService();
    const workspaceId = `codegen-validate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const started = await sandbox.startExec({
      workspaceId,
      command,
      workingDir: workspaceDir,
      timeoutMs,
    });
    let canceled = false;
    const onAbort = (): void => {
      if (canceled) return;
      canceled = true;
      void sandbox.cancelExec(workspaceId, started.id).catch(() => {});
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      const final = await sandbox.waitForExec(started.id);
      const stdout = final?.stdoutPreview ?? "";
      const stderr = final?.stderrPreview ?? "";
      const exitCode = typeof final?.exitCode === "number" ? final.exitCode : null;
      const result: RunnerResult = { exitCode, stdout, stderr };
      if (final?.status === "timeout") result.timedOut = true;
      if (final?.errorMessage) result.errorMessage = final.errorMessage;
      return result;
    } finally {
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  };
}

/**
 * Resolve the absolute path of the locally-installed tsc binary by walking up
 * from this module location. Returns null when the package is not installed
 * (which is the typical sandbox-spawn-failure path we should treat as
 * "skipped").
 */
function resolveTscBinary(): string | null {
  try {
    const requireFn = createRequire(import.meta.url);
    // typescript/package.json is the safest resolve target; the bin sits at a
    // known relative location.
    const pkgJsonPath = requireFn.resolve("typescript/package.json");
    return join(dirname(pkgJsonPath), "bin", "tsc");
  } catch {
    return null;
  }
}

/**
 * Build the shell command used to invoke tsc. Quoting handles spaces in paths
 * on Windows.
 */
function buildTscCommand(tscBinary: string): string {
  const quoted = JSON.stringify(tscBinary);
  // tsc as a JS file → invoke with node. `-p .` picks up the tsconfig we
  // either wrote or that the generated tree already provided.
  return `node ${quoted} --noEmit -p tsconfig.json`;
}

export async function validateFileTree(
  files: GeneratedFile[],
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const env = options.env ?? process.env;
  if (env[SMOKE_ENV_VAR] !== "1") {
    console.warn(
      `${LOG_PREFIX} sandbox smoke gate ${SMOKE_ENV_VAR} is not "1"; returning skipped result`,
    );
    return skipped();
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? createDefaultRunner();
  const started = Date.now();
  let workspaceDir: string | null = null;

  try {
    workspaceDir = await mkdtemp(join(tmpdir(), "taskloom-codegen-"));

    // Ensure a tsconfig exists.
    const treeWithConfig = hasRootTsconfig(files)
      ? files
      : [...files, { path: "tsconfig.json", content: DEFAULT_TSCONFIG }];
    await writeTree(workspaceDir, treeWithConfig);

    // The default runner needs an absolute path to tsc since the temp
    // workspace has no node_modules.
    let command: string;
    if (options.runner) {
      // Tests provide their own runner; the command string is opaque to them.
      command = "tsc --noEmit -p tsconfig.json";
    } else {
      const tscBinary = resolveTscBinary();
      if (!tscBinary) {
        console.warn(
          `${LOG_PREFIX} could not resolve typescript binary; returning skipped result`,
        );
        return skipped(Date.now() - started);
      }
      command = buildTscCommand(tscBinary);
    }

    let result: RunnerResult;
    try {
      const runArgs: Parameters<ValidationRunner>[0] = {
        workspaceDir,
        command,
        timeoutMs,
      };
      if (options.signal) runArgs.signal = options.signal;
      result = await runner(runArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${LOG_PREFIX} sandbox spawn failed: ${message}; returning skipped result`);
      return skipped(Date.now() - started);
    }

    const durationMs = Date.now() - started;

    if (result.timedOut) {
      return {
        ok: false,
        source: "real",
        errors: [
          {
            file: "<sandbox>",
            message: `tsc timed out after ${Math.round(timeoutMs / 1000)}s`,
            severity: "error",
          },
        ],
        warnings: [],
        durationMs,
      };
    }

    const combined = `${result.stdout}\n${result.stderr}`;
    const { errors, warnings } = parseTscOutput(combined);

    // If tsc exited non-zero but we couldn't parse a diagnostic, surface a
    // generic error so callers don't see ok=true on a real failure.
    if (
      typeof result.exitCode === "number" &&
      result.exitCode !== 0 &&
      errors.length === 0
    ) {
      errors.push({
        file: "<sandbox>",
        message:
          result.errorMessage ??
          `tsc exited with code ${result.exitCode}${
            combined.trim() ? `: ${combined.trim().split(/\r?\n/).pop() ?? ""}` : ""
          }`,
        severity: "error",
      });
    }

    return {
      ok: errors.length === 0,
      source: "real",
      errors,
      warnings,
      durationMs,
    };
  } finally {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true }).catch(() => {
        /* best-effort cleanup */
      });
    }
  }
}

// Re-export for tests/diagnostics. The `fileURLToPath` import is needed when
// callers want to resolve relative paths from this module's URL; not used in
// the validator body itself but kept available so internal tests can probe it.
export const __internal = {
  parseTscOutput,
  hasRootTsconfig,
  resolveTscBinary,
  fileURLToPath,
};
