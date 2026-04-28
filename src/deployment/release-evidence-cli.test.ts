import assert from "node:assert/strict";
import test from "node:test";
import { runReleaseEvidenceCli } from "./release-evidence-cli.js";

test("runReleaseEvidenceCli prints the evidence bundle as JSON", async () => {
  const output: string[] = [];
  const env = { TASKLOOM_RELEASE_CHANNEL: "phase-44" } as NodeJS.ProcessEnv;

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    env,
    out: (line) => output.push(line),
    buildReleaseEvidenceBundle: (receivedEnv) => {
      assert.equal(receivedEnv, env);
      return {
        readyForRelease: true,
        phase: 44,
        evidence: [{ id: "release-readiness", status: "pass" }],
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output[0] ?? ""), {
    readyForRelease: true,
    phase: 44,
    evidence: [{ id: "release-readiness", status: "pass" }],
  });
});

test("runReleaseEvidenceCli fails strict mode when the bundle is not release-ready", async () => {
  let receivedStrict: boolean | undefined;

  const exitCode = await runReleaseEvidenceCli({
    argv: ["--strict"],
    out: () => {},
    buildReleaseEvidenceBundle: (_env, deps) => {
      receivedStrict = deps?.strict;
      return { readyForRelease: false };
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(receivedStrict, true);
});

test("runReleaseEvidenceCli passes strict mode when the bundle is release-ready", async () => {
  const exitCode = await runReleaseEvidenceCli({
    argv: ["--strict"],
    out: () => {},
    buildReleaseEvidenceBundle: () => ({ readyForRelease: true }),
  });

  assert.equal(exitCode, 0);
});

test("runReleaseEvidenceCli returns an error exit code when the builder throws", async () => {
  const errors: string[] = [];

  const exitCode = await runReleaseEvidenceCli({
    argv: [],
    out: () => {},
    err: (line) => errors.push(line),
    buildReleaseEvidenceBundle: () => {
      throw new Error("release evidence unavailable");
    },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(errors, ["release evidence unavailable"]);
});
