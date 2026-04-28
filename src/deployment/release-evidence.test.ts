import assert from "node:assert/strict";
import test from "node:test";
import { assessReleaseEvidence, buildReleaseEvidenceBundle, type ReleaseEvidenceEntry } from "./release-evidence.js";
import type { ReleaseReadinessReport } from "./release-readiness.js";
import type { StorageTopologyReport } from "./storage-topology.js";

function evidenceEntry(entries: ReleaseEvidenceEntry[], name: string): ReleaseEvidenceEntry {
  const entry = entries.find((candidate) => candidate.name === name);
  assert.ok(entry, `expected evidence entry for ${name}`);
  return entry;
}

function injectedStorageTopology(): StorageTopologyReport {
  return {
    mode: "sqlite",
    classification: "single-node",
    readyForProduction: true,
    summary: "Injected storage topology.",
    requirements: [],
    warnings: [],
    nextSteps: ["Injected storage next step."],
    observed: {
      nodeEnv: "production",
      isProductionEnv: true,
      store: "sqlite",
      dbPath: "/data/taskloom.sqlite",
      trustProxy: true,
      distributedRateLimitUrl: null,
      schedulerLeaderMode: "off",
      accessLogMode: "stdout",
      accessLogPath: null,
      probes: {},
    },
  };
}

function injectedReleaseReadiness(storageTopology: StorageTopologyReport): ReleaseReadinessReport {
  return {
    phase: "43",
    readyForRelease: true,
    summary: "Injected release readiness.",
    checks: [],
    blockers: [],
    warnings: [],
    nextSteps: ["Injected release next step."],
    storageTopology,
  };
}

test("local JSON development evidence embeds Phase 42 and Phase 43 reports", () => {
  const bundle = assessReleaseEvidence({
    env: {},
    generatedAt: "2026-04-28T18:00:00.000Z",
  });

  assert.equal(bundle.phase, "44");
  assert.equal(bundle.generatedAt, "2026-04-28T18:00:00.000Z");
  assert.equal(bundle.readyForRelease, true);
  assert.equal(bundle.storageTopology.mode, "json");
  assert.equal(bundle.releaseReadiness.phase, "43");
  assert.equal(bundle.releaseReadiness.storageTopology, bundle.storageTopology);
  assert.equal(bundle.evidence.config.storageMode, "json");
  assert.equal(bundle.evidence.config.backupConfigured, false);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_STORE").configured, false);
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-42-storage-topology"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-43-release-readiness"));
  assert.ok(bundle.attachments.some((attachment) => attachment.id === "phase-44-release-evidence"));
  assert.ok(bundle.nextSteps.some((step) => step.includes("TASKLOOM_STORE=sqlite")));
});

test("production SQLite evidence passes release handoff when readiness inputs pass", () => {
  const bundle = assessReleaseEvidence({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_ARTIFACTS_PATH: "/srv/taskloom/artifacts",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_ACCESS_LOG_MODE: "file",
      TASKLOOM_ACCESS_LOG_PATH: "/var/log/taskloom/access.log",
    },
    probes: {
      directoryExists: (path) =>
        ["/srv/taskloom/backups", "/srv/taskloom/artifacts", "/var/log/taskloom"].includes(path),
    },
    generatedAt: "2026-04-28T18:30:00.000Z",
  });

  assert.equal(bundle.readyForRelease, true);
  assert.equal(bundle.storageTopology.readyForProduction, true);
  assert.equal(bundle.releaseReadiness.readyForRelease, true);
  assert.equal(bundle.evidence.config.nodeEnv, "production");
  assert.equal(bundle.evidence.config.storageMode, "sqlite");
  assert.equal(bundle.evidence.config.backupConfigured, true);
  assert.equal(bundle.evidence.config.restoreDrillRecorded, true);
  assert.equal(bundle.evidence.config.artifactPathConfigured, true);
  assert.equal(evidenceEntry(bundle.evidence.environment, "TASKLOOM_BACKUP_DIR").value, "/srv/taskloom/backups");
  assert.match(bundle.summary, /ready for handoff/);
});

test("secret names and URLs with embedded credentials are redacted in evidence", () => {
  const bundle = assessReleaseEvidence({
    env: {
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_API_TOKEN: "super-secret-token",
      TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://taskloom:secret@limits.internal/check",
    },
    generatedAt: "2026-04-28T19:00:00.000Z",
  });

  const token = evidenceEntry(bundle.evidence.environment, "TASKLOOM_API_TOKEN");
  const limiterUrl = evidenceEntry(bundle.evidence.environment, "TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL");
  const backupDir = evidenceEntry(bundle.evidence.environment, "TASKLOOM_BACKUP_DIR");

  assert.equal(token.configured, true);
  assert.equal(token.redacted, true);
  assert.equal(token.value, "[redacted]");
  assert.equal(limiterUrl.redacted, true);
  assert.equal(limiterUrl.value, "[redacted]");
  assert.equal(backupDir.redacted, false);
  assert.equal(backupDir.value, "/srv/taskloom/backups");
});

test("injected reports are embedded without calling report builders", () => {
  const storageTopology = injectedStorageTopology();
  const releaseReadiness = injectedReleaseReadiness(storageTopology);
  const bundle = assessReleaseEvidence({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "json",
    },
    storageTopology,
    releaseReadiness,
    buildStorageTopologyReport: () => {
      throw new Error("storage builder should not be called");
    },
    buildReleaseReadinessReport: () => {
      throw new Error("release builder should not be called");
    },
  });

  assert.equal(bundle.storageTopology, storageTopology);
  assert.equal(bundle.releaseReadiness, releaseReadiness);
  assert.equal(bundle.readyForRelease, true);
  assert.deepEqual(bundle.nextSteps, ["Injected release next step."]);
});

test("generatedAt accepts Date injection", () => {
  const bundle = assessReleaseEvidence({
    env: {},
    generatedAt: new Date("2026-04-28T20:15:00.000Z"),
  });

  assert.equal(bundle.generatedAt, "2026-04-28T20:15:00.000Z");
});

test("buildReleaseEvidenceBundle accepts env and dependency arguments", () => {
  const bundle = buildReleaseEvidenceBundle(
    { TASKLOOM_STORE: "json" },
    { generatedAt: "2026-04-28T21:00:00.000Z", strict: true },
  );

  assert.equal(bundle.generatedAt, "2026-04-28T21:00:00.000Z");
  assert.equal(bundle.evidence.config.storageMode, "json");
  assert.equal(bundle.evidence.config.strictRelease, true);
});
