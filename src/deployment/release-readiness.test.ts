import assert from "node:assert/strict";
import test from "node:test";
import {
  assessReleaseReadiness,
  buildReleaseReadinessReport,
  type ReleaseReadinessEnv,
} from "./release-readiness.js";
import type { StorageTopologyReport } from "./storage-topology.js";

function checkStatus(report: ReturnType<typeof assessReleaseReadiness>, id: string): string | undefined {
  return report.checks.find((check) => check.id === id)?.status;
}

test("local JSON development produces warnings instead of release blockers", () => {
  const report = assessReleaseReadiness({ env: {} });

  assert.equal(report.phase, "43");
  assert.equal(report.readyForRelease, true);
  assert.equal(report.storageTopology.mode, "json");
  assert.equal(checkStatus(report, "storage-topology"), "warn");
  assert.equal(checkStatus(report, "backup-dir"), "warn");
  assert.equal(checkStatus(report, "restore-drill"), "warn");
  assert.equal(report.blockers.length, 0);
  assert.ok(report.warnings.some((warning) => warning.includes("TASKLOOM_BACKUP_DIR")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_STORE=sqlite")));
});

test("production SQLite with backup directory and restore drill passes release readiness", () => {
  const env: ReleaseReadinessEnv = {
    NODE_ENV: "production",
    TASKLOOM_STORE: "sqlite",
    TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
    TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
    TASKLOOM_ARTIFACTS_PATH: "/srv/taskloom/artifacts",
    TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
    TASKLOOM_TRUST_PROXY: "true",
    TASKLOOM_ACCESS_LOG_MODE: "file",
    TASKLOOM_ACCESS_LOG_PATH: "/var/log/taskloom/access.log",
  };

  const report = buildReleaseReadinessReport(env, {
    probes: {
      directoryExists: (path) =>
        ["/srv/taskloom/backups", "/srv/taskloom/artifacts", "/var/log/taskloom"].includes(path),
    },
  });

  assert.equal(report.readyForRelease, true);
  assert.equal(report.blockers.length, 0);
  assert.equal(checkStatus(report, "storage-topology"), "pass");
  assert.equal(checkStatus(report, "database-path"), "pass");
  assert.equal(checkStatus(report, "backup-dir"), "pass");
  assert.equal(checkStatus(report, "restore-drill"), "pass");
  assert.equal(checkStatus(report, "artifact-path"), "pass");
  assert.equal(checkStatus(report, "access-log-path"), "pass");
  assert.match(report.summary, /passed strict/);
});

test("production SQLite missing backup directory fails release readiness", () => {
  const report = assessReleaseReadiness({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(checkStatus(report, "storage-topology"), "pass");
  assert.equal(checkStatus(report, "backup-dir"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("TASKLOOM_BACKUP_DIR")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_BACKUP_DIR")));
});

test("production SQLite with distributed storage topology fails release readiness", () => {
  const report = assessReleaseReadiness({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/srv/taskloom/backups",
      TASKLOOM_RESTORE_DRILL_AT: "2026-04-28T16:30:00Z",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_SCHEDULER_LEADER_MODE: "http",
      TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://limits.internal/check",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
    probes: {
      directoryExists: (path) => path === "/srv/taskloom/backups",
    },
  });

  assert.equal(report.readyForRelease, false);
  assert.equal(checkStatus(report, "storage-topology"), "fail");
  assert.ok(report.blockers.some((blocker) => blocker.includes("not production-ready")));
  assert.equal(report.storageTopology.classification, "production-blocked");
  assert.ok(report.nextSteps.some((step) => step.includes("deployment-managed database")));
});

test("injected storage report is embedded and used without calling the report builder", () => {
  const storageTopology: StorageTopologyReport = {
    mode: "sqlite",
    classification: "single-node",
    readyForProduction: true,
    summary: "Injected single-node topology.",
    requirements: [],
    warnings: ["Injected topology warning."],
    nextSteps: ["Injected topology next step."],
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

  const report = assessReleaseReadiness({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "json",
      TASKLOOM_DB_PATH: "/data/taskloom.sqlite",
      TASKLOOM_BACKUP_DIR: "/data/backups",
      TASKLOOM_RESTORE_DRILL_MARKER: "restore-drill-ticket-123",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
    storageTopology,
    buildStorageTopologyReport: () => {
      throw new Error("builder should not be called when storageTopology is injected");
    },
  });

  assert.equal(report.readyForRelease, true);
  assert.equal(report.storageTopology, storageTopology);
  assert.equal(checkStatus(report, "storage-topology"), "pass");
  assert.ok(report.warnings.includes("Injected topology warning."));
});
