import assert from "node:assert/strict";
import test from "node:test";
import { formatDeploymentCliJson } from "./deployment-output-cli.js";

test("formatDeploymentCliJson redacts secrets and annotates Phase 53 multi-writer requests", () => {
  const env = {
    TASKLOOM_DATABASE_TOPOLOGY: "multi-writer",
  } as NodeJS.ProcessEnv;

  const output = formatDeploymentCliJson({
    databaseUrl: "postgres://taskloom:super-secret@db.example.com/taskloom",
    env: {
      DATABASE_URL: {
        configured: true,
        value: "postgres://taskloom:super-secret@db.example.com/taskloom",
        redacted: true,
      },
    },
    nested: {
      schedulerToken: "token-value",
      publicValue: "visible",
    },
  }, env);
  const report = JSON.parse(output) as {
    databaseUrl?: unknown;
    env?: { DATABASE_URL?: { configured?: unknown; value?: unknown; redacted?: unknown } };
    nested?: { schedulerToken?: unknown; publicValue?: unknown };
    phase53?: { phase?: unknown; multiWriterTopologyRequested?: unknown; multiWriterSupported?: unknown };
  };

  assert.equal(report.databaseUrl, "[redacted]");
  assert.equal(report.env?.DATABASE_URL?.configured, true);
  assert.equal(report.env?.DATABASE_URL?.value, "[redacted]");
  assert.equal(report.env?.DATABASE_URL?.redacted, true);
  assert.equal(report.nested?.schedulerToken, "[redacted]");
  assert.equal(report.nested?.publicValue, "visible");
  assert.equal(report.phase53?.phase, "53");
  assert.equal(report.phase53?.multiWriterTopologyRequested, true);
  assert.equal(report.phase53?.multiWriterSupported, false);
  assert.doesNotMatch(output, /super-secret/);
  assert.match(output, /Phase 53/);
});

test("formatDeploymentCliJson preserves detailed Phase 53 report fields", () => {
  const output = formatDeploymentCliJson({
    phase53: {
      multiWriterTopologyRequested: true,
      requirementsEvidenceConfigured: true,
      designEvidenceConfigured: true,
      requirementsDesignGatePassed: true,
      runtimeSupport: false,
      strictBlocker: false,
      summary: "Phase 53 evidence is present; runtime support remains blocked.",
    },
  }, { TASKLOOM_DATABASE_TOPOLOGY: "distributed" } as NodeJS.ProcessEnv);
  const report = JSON.parse(output) as {
    phase53?: {
      phase?: unknown;
      requirementsEvidenceConfigured?: unknown;
      designEvidenceConfigured?: unknown;
      requirementsDesignGatePassed?: unknown;
      runtimeSupport?: unknown;
      multiWriterSupported?: unknown;
      summary?: unknown;
    };
  };

  assert.equal(report.phase53?.phase, "53");
  assert.equal(report.phase53?.requirementsEvidenceConfigured, true);
  assert.equal(report.phase53?.designEvidenceConfigured, true);
  assert.equal(report.phase53?.requirementsDesignGatePassed, true);
  assert.equal(report.phase53?.runtimeSupport, false);
  assert.equal(report.phase53?.multiWriterSupported, false);
  assert.equal(report.phase53?.summary, "Phase 53 evidence is present; runtime support remains blocked.");
});
