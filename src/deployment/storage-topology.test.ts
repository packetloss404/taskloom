import assert from "node:assert/strict";
import test from "node:test";
import { assessStorageTopology } from "./storage-topology.js";

test("default JSON config is local development and not production-ready", () => {
  const report = assessStorageTopology({ env: {} });

  assert.equal(report.mode, "json");
  assert.equal(report.classification, "local-dev");
  assert.equal(report.readyForProduction, false);
  assert.match(report.summary, /local development/);
  assert.equal(report.observed.store, "json");
  assert.equal(report.observed.dbPath, null);
  assert.ok(report.requirements.some((requirement) => requirement.id === "durable-production-store" && !requirement.met));
  assert.ok(report.warnings.some((warning) => warning.includes("contributor workflows")));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_STORE=sqlite")));
});

test("production JSON is blocked", () => {
  const report = assessStorageTopology({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "json",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
  });

  assert.equal(report.mode, "json");
  assert.equal(report.classification, "production-blocked");
  assert.equal(report.readyForProduction, false);
  assert.match(report.summary, /blocked for production/);
  assert.ok(report.requirements.some((requirement) => requirement.id === "durable-production-store" && !requirement.met));
});

test("SQLite in production is single-node ready when no distributed topology is configured", () => {
  const report = assessStorageTopology({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "var/lib/taskloom/taskloom.sqlite",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_ACCESS_LOG_MODE: "file",
      TASKLOOM_ACCESS_LOG_PATH: "var/log/taskloom/access.log",
    },
    probes: {
      fileExists: (path) => path.endsWith("taskloom.sqlite") || path.endsWith("access.log"),
      directoryExists: (path) => path === "var/log/taskloom",
    },
  });

  assert.equal(report.mode, "sqlite");
  assert.equal(report.classification, "single-node");
  assert.equal(report.readyForProduction, true);
  assert.equal(report.observed.dbPath, "var/lib/taskloom/taskloom.sqlite");
  assert.equal(report.observed.accessLogPath, "var/log/taskloom/access.log");
  assert.equal(report.observed.probes.dbPathExists, true);
  assert.equal(report.observed.probes.accessLogDirectoryExists, true);
  assert.ok(report.requirements.every((requirement) => requirement.met));
  assert.ok(report.nextSteps.some((step) => step.includes("managed database")));
});

test("SQLite with http leader and distributed limiter is still blocked for managed-db readiness", () => {
  const report = assessStorageTopology({
    env: {
      NODE_ENV: "production",
      TASKLOOM_STORE: "sqlite",
      TASKLOOM_DB_PATH: "/srv/taskloom/taskloom.sqlite",
      TASKLOOM_TRUST_PROXY: "true",
      TASKLOOM_SCHEDULER_LEADER_MODE: "http",
      TASKLOOM_DISTRIBUTED_RATE_LIMIT_URL: "https://limits.internal/check",
      TASKLOOM_ACCESS_LOG_MODE: "stdout",
    },
  });

  assert.equal(report.mode, "sqlite");
  assert.equal(report.classification, "production-blocked");
  assert.equal(report.readyForProduction, false);
  assert.equal(report.observed.schedulerLeaderMode, "http");
  assert.equal(report.observed.distributedRateLimitUrl, "https://limits.internal/check");
  assert.ok(
    report.requirements.some(
      (requirement) => requirement.id === "managed-database-for-distribution" && !requirement.met,
    ),
  );
  assert.ok(report.warnings.some((warning) => warning.includes("cross-host")));
  assert.ok(report.nextSteps.some((step) => step.includes("deployment-managed database")));
});

test("unknown store mode is unsupported", () => {
  const report = assessStorageTopology({
    env: {
      TASKLOOM_STORE: "postgres",
      NODE_ENV: "production",
    },
  });

  assert.equal(report.mode, "unsupported");
  assert.equal(report.classification, "unsupported");
  assert.equal(report.readyForProduction, false);
  assert.match(report.summary, /Unsupported TASKLOOM_STORE/);
  assert.equal(report.observed.store, "postgres");
  assert.ok(report.requirements.some((requirement) => requirement.id === "supported-store-mode" && !requirement.met));
  assert.ok(report.nextSteps.some((step) => step.includes("TASKLOOM_STORE=sqlite")));
});
