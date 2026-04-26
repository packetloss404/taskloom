import assert from "node:assert/strict";
import test from "node:test";
import {
  createAgent,
  createAgentFromTemplate,
  listAgentTemplates,
  login,
  runAgent,
  updateAgent,
} from "./taskloom-services";
import { resetStoreForTests } from "./taskloom-store";

test("agent template catalog exposes built-in templates", () => {
  resetStoreForTests();
  const { templates } = listAgentTemplates();
  assert.ok(templates.length >= 3);
  assert.ok(templates.every((entry) => entry.id && entry.name && Array.isArray(entry.inputSchema)));
});

test("createAgentFromTemplate clones template fields and links templateId", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const { agent } = createAgentFromTemplate(auth.context, "support_triage");

  assert.equal(agent.templateId, "support_triage");
  assert.equal(agent.name, "Support inbox triage");
  assert.ok(agent.inputSchema.some((field) => field.key === "mailbox"));
  assert.ok(agent.tools.includes("gmail"));
});

test("createAgentFromTemplate rejects unknown template", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });
  assert.throws(() => createAgentFromTemplate(auth.context, "nope"), /agent template not found/);
});

test("agent input schema is validated and persisted", () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const { agent } = createAgent(auth.context, {
    name: "Schema agent",
    instructions: "Capture typed inputs and validate them.",
    inputSchema: [
      { key: "topic", label: "Topic", type: "string", required: true },
      { key: "depth", label: "Depth", type: "enum", required: true, options: ["quick", "deep"], defaultValue: "quick" },
    ],
  });

  assert.equal(agent.inputSchema.length, 2);

  assert.throws(
    () => updateAgent(auth.context, agent.id, {
      inputSchema: [
        { key: "bad-key!", label: "Bad", type: "string", required: false },
      ],
    } as any),
    /input field keys must be/,
  );

  assert.throws(
    () => updateAgent(auth.context, agent.id, {
      inputSchema: [
        { key: "mode", label: "Mode", type: "enum", required: true, options: [] },
      ],
    } as any),
    /enum field/,
  );
});

test("runAgent validates required inputs and records logs", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const { agent } = createAgentFromTemplate(auth.context, "release_audit");

  await assert.rejects(
    () => runAgent(auth.context, agent.id, { inputs: {} }),
    /input release_label is required/,
  );

  const { run } = await runAgent(auth.context, agent.id, {
    inputs: { release_label: "v1.2.3", evidence_url: "https://example.com/evidence" },
  });

  assert.equal(run.status, "success");
  assert.equal(run.inputs?.release_label, "v1.2.3");
  assert.equal(run.inputs?.evidence_url, "https://example.com/evidence");
  assert.ok((run.logs ?? []).length >= 2);
  assert.ok((run.logs ?? []).some((entry: { message: string }) => entry.message.includes("release_label")));
});

test("runAgent rejects invalid url and enum inputs", async () => {
  resetStoreForTests();
  const auth = login({ email: "alpha@taskloom.local", password: "demo12345" });

  const { agent } = createAgentFromTemplate(auth.context, "release_audit");

  await assert.rejects(
    () => runAgent(auth.context, agent.id, { inputs: { release_label: "v1", evidence_url: "not-a-url" } }),
    /must be a valid http/,
  );

  const { agent: triage } = createAgentFromTemplate(auth.context, "support_triage");
  await assert.rejects(
    () => runAgent(auth.context, triage.id, { inputs: { mailbox: "inbox", urgency_threshold: "extreme" } }),
    /must be one of/,
  );
});
