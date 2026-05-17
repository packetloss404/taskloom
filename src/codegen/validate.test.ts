import assert from "node:assert/strict";
import test from "node:test";
import {
  validateFileTree,
  parseTscOutput,
  type RunnerResult,
  type ValidationRunner,
} from "./validate.js";

const SAMPLE_FILES = [
  { path: "src/index.ts", content: "export const answer: number = 42;\n" },
];

function smokeEnv(): NodeJS.ProcessEnv {
  return { TASKLOOM_SANDBOX_SMOKE_ENABLED: "1" };
}

function silencingConsoleWarn(): { restore: () => void; messages: string[] } {
  const original = console.warn;
  const messages: string[] = [];
  console.warn = (...args: unknown[]) => {
    messages.push(args.map((a) => String(a)).join(" "));
  };
  return {
    messages,
    restore: () => {
      console.warn = original;
    },
  };
}

test("returns skipped when smoke env is unset", async () => {
  const guard = silencingConsoleWarn();
  try {
    const result = await validateFileTree(SAMPLE_FILES, { env: {} });
    assert.equal(result.ok, true);
    assert.equal(result.source, "skipped");
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.durationMs, 0);
    assert.ok(
      guard.messages.some((m) => m.includes("[codegen-validate]")),
      "expected a [codegen-validate] warn log",
    );
  } finally {
    guard.restore();
  }
});

test("returns ok=true when the runner reports clean stderr and exit 0", async () => {
  const runner: ValidationRunner = async () => ({
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
  const result = await validateFileTree(SAMPLE_FILES, {
    env: smokeEnv(),
    runner,
  });
  assert.equal(result.source, "real");
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("parses tsc diagnostics into ValidationError[] with line/column", async () => {
  const stderrLines = [
    "src/index.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",
    "src/util.ts(10,15): error TS2304: Cannot find name 'fooo'.",
    "src/util.ts(11,1): warning TS6133: 'unused' is declared but its value is never read.",
    "",
  ];
  const runner: ValidationRunner = async () => ({
    exitCode: 2,
    stdout: stderrLines.join("\n"),
    stderr: "",
  });
  const result = await validateFileTree(SAMPLE_FILES, {
    env: smokeEnv(),
    runner,
  });
  assert.equal(result.source, "real");
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 2);
  assert.equal(result.warnings.length, 1);

  const first = result.errors[0]!;
  assert.equal(first.file, "src/index.ts");
  assert.equal(first.line, 3);
  assert.equal(first.column, 7);
  assert.equal(first.severity, "error");
  assert.match(first.message, /Type 'string' is not assignable/);

  const second = result.errors[1]!;
  assert.equal(second.file, "src/util.ts");
  assert.equal(second.line, 10);
  assert.equal(second.column, 15);

  const warn = result.warnings[0]!;
  assert.equal(warn.severity, "warning");
  assert.equal(warn.file, "src/util.ts");
  assert.equal(warn.line, 11);
  assert.equal(warn.column, 1);
});

test("parses tsc output also when it arrives on stderr", async () => {
  const runner: ValidationRunner = async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "src/x.ts(1,1): error TS9999: bad.\n",
  });
  const result = await validateFileTree(SAMPLE_FILES, {
    env: smokeEnv(),
    runner,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.file, "src/x.ts");
});

test("non-zero exit with no parseable diagnostics surfaces a synthetic error", async () => {
  const runner: ValidationRunner = async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "something went sideways\n",
  });
  const result = await validateFileTree(SAMPLE_FILES, {
    env: smokeEnv(),
    runner,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.file, "<sandbox>");
  assert.match(result.errors[0]!.message, /tsc exited with code 1/);
});

test("returns skipped (no propagation) when the runner throws", async () => {
  const guard = silencingConsoleWarn();
  try {
    const runner: ValidationRunner = async () => {
      throw new Error("spawn ENOENT");
    };
    const result = await validateFileTree(SAMPLE_FILES, {
      env: smokeEnv(),
      runner,
    });
    assert.equal(result.source, "skipped");
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.ok(
      guard.messages.some((m) => m.includes("sandbox spawn failed")),
      "expected a spawn-failure warn log",
    );
  } finally {
    guard.restore();
  }
});

test("timeout path returns the expected error shape", async () => {
  const runner: ValidationRunner = async () => ({
    exitCode: null,
    stdout: "",
    stderr: "",
    timedOut: true,
  });
  const result = await validateFileTree(SAMPLE_FILES, {
    env: smokeEnv(),
    runner,
    timeoutMs: 60000,
  });
  assert.equal(result.source, "real");
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.file, "<sandbox>");
  assert.match(result.errors[0]!.message, /tsc timed out after 60s/);
  assert.deepEqual(result.warnings, []);
});

test("writes the file tree into a temp workspace the runner can see", async () => {
  // Capture the workspaceDir the runner is invoked with and verify the files
  // were actually materialized at that location.
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  let observedDir: string | null = null;
  const runner: ValidationRunner = async ({ workspaceDir }) => {
    observedDir = workspaceDir;
    const entries = await readdir(workspaceDir, { recursive: true });
    // The runner can see all the files we passed plus the synthetic tsconfig.
    assert.ok(entries.includes("tsconfig.json"));
    const content = await readFile(join(workspaceDir, "src", "index.ts"), "utf8");
    assert.match(content, /answer/);
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  const result = await validateFileTree(SAMPLE_FILES, {
    env: smokeEnv(),
    runner,
  });
  assert.equal(result.ok, true);
  assert.ok(observedDir !== null);
});

test("respects a generator-provided tsconfig.json instead of writing a default", async () => {
  const userTsconfig = '{"compilerOptions":{"strict":false}}';
  const files = [
    { path: "src/index.ts", content: "export const x = 1;\n" },
    { path: "tsconfig.json", content: userTsconfig },
  ];
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const runner: ValidationRunner = async ({ workspaceDir }) => {
    const content = await readFile(join(workspaceDir, "tsconfig.json"), "utf8");
    assert.equal(content, userTsconfig);
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  const result = await validateFileTree(files, { env: smokeEnv(), runner });
  assert.equal(result.ok, true);
});

test("rejects file-tree entries that try to escape the workspace", async () => {
  const guard = silencingConsoleWarn();
  try {
    const runner: ValidationRunner = async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
    const escaping = [{ path: "../evil.ts", content: "" }];
    // The implementation throws inside writeTree, which the validator does
    // NOT swallow (path-traversal is a programmer error, not a sandbox spawn
    // failure). So we expect rejection.
    await assert.rejects(
      () => validateFileTree(escaping, { env: smokeEnv(), runner }),
      /escapes workspace/,
    );
  } finally {
    guard.restore();
  }
});

test("parseTscOutput unit: handles empty and noisy input", () => {
  const empty = parseTscOutput("");
  assert.deepEqual(empty, { errors: [], warnings: [] });

  const noisy = parseTscOutput(
    [
      "irrelevant chatter",
      "Found 0 errors. Watching for file changes.",
      "src/a.ts(1,1): error TS1: oops",
    ].join("\n"),
  );
  assert.equal(noisy.errors.length, 1);
  assert.equal(noisy.errors[0]!.line, 1);
});
