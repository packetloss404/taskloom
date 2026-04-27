import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { __resetAccessLogForTests, accessLogMiddleware, formatAccessLogLine } from "./access-log.js";

const FIXED_NOW = new Date("2026-04-26T12:00:00.000Z");

function baseInput(overrides: Partial<Parameters<typeof formatAccessLogLine>[0]> = {}) {
  return {
    method: "GET",
    status: 200,
    path: "/",
    query: null,
    durationMs: 12,
    userId: null,
    workspaceId: null,
    requestId: null,
    now: FIXED_NOW,
    ...overrides,
  };
}

test("formatAccessLogLine redacts whk_ webhook tokens in path", () => {
  const line = formatAccessLogLine(baseInput({
    path: "/api/public/webhooks/agents/whk_some_secret_token",
  }));
  const parsed = JSON.parse(line);
  assert.equal(parsed.path.includes("whk_some_secret_token"), false);
  assert.equal(parsed.path.startsWith("/api/public/webhooks/agents/[redacted]"), true);
});

test("formatAccessLogLine redacts /share/<token> path", () => {
  const line = formatAccessLogLine(baseInput({
    path: "/share/share-token-1234",
  }));
  const parsed = JSON.parse(line);
  assert.equal(parsed.path.includes("share-token-1234"), false);
  assert.equal(parsed.path.startsWith("/share/[redacted]"), true);
});

test("formatAccessLogLine redacts /api/app/invitations/<token>/accept", () => {
  const line = formatAccessLogLine(baseInput({
    path: "/api/app/invitations/invite-secret-1234/accept",
  }));
  const parsed = JSON.parse(line);
  assert.equal(parsed.path.includes("invite-secret-1234"), false);
  assert.equal(parsed.path.includes("[redacted]"), true);
  assert.equal(parsed.path.endsWith("/accept"), true);
});

test("formatAccessLogLine redacts token and access_token query params", () => {
  const line = formatAccessLogLine(baseInput({
    path: "/api/things",
    query: "token=secret&access_token=other",
  }));
  const parsed = JSON.parse(line);
  assert.equal(parsed.path.includes("secret"), false);
  assert.equal(parsed.path.includes("other"), false);
  assert.equal(parsed.path.includes("[redacted]"), true);
});

test("formatAccessLogLine keeps method, status, durationMs, userId, workspaceId verbatim", () => {
  const line = formatAccessLogLine(baseInput({
    method: "POST",
    status: 201,
    path: "/api/app/agents",
    durationMs: 42,
    userId: "user-abc",
    workspaceId: "ws-xyz",
    requestId: "req-1",
  }));
  const parsed = JSON.parse(line);
  assert.equal(parsed.method, "POST");
  assert.equal(parsed.status, 201);
  assert.equal(parsed.durationMs, 42);
  assert.equal(parsed.userId, "user-abc");
  assert.equal(parsed.workspaceId, "ws-xyz");
  assert.equal(parsed.requestId, "req-1");
  assert.equal(parsed.ts, FIXED_NOW.toISOString());
  assert.equal(line.endsWith("\n"), true);
});

test("middleware in 'off' mode does not write to stdout", async () => {
  const previousMode = process.env.TASKLOOM_ACCESS_LOG_MODE;
  process.env.TASKLOOM_ACCESS_LOG_MODE = "off";
  __resetAccessLogForTests();
  const captured: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (chunk: unknown) => boolean }).write = ((chunk: unknown) => {
    captured.push(String(chunk));
    return true;
  }) as never;
  try {
    const app = new Hono();
    app.use("*", accessLogMiddleware());
    app.get("/ping", (c) => c.json({ ok: true }));
    const res = await app.request("/ping");
    assert.equal(res.status, 200);
    assert.equal(captured.length, 0);
  } finally {
    (process.stdout as unknown as { write: typeof originalWrite }).write = originalWrite;
    if (previousMode === undefined) delete process.env.TASKLOOM_ACCESS_LOG_MODE;
    else process.env.TASKLOOM_ACCESS_LOG_MODE = previousMode;
    __resetAccessLogForTests();
  }
});

test("middleware in 'stdout' mode writes one redacted line per request", async () => {
  const previousMode = process.env.TASKLOOM_ACCESS_LOG_MODE;
  process.env.TASKLOOM_ACCESS_LOG_MODE = "stdout";
  __resetAccessLogForTests();
  const captured: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (chunk: unknown) => boolean }).write = ((chunk: unknown) => {
    captured.push(String(chunk));
    return true;
  }) as never;
  try {
    const app = new Hono();
    app.use("*", accessLogMiddleware());
    app.get("/api/public/webhooks/agents/:token", (c) => c.json({ ok: true }));
    const res = await app.request("/api/public/webhooks/agents/whk_super_secret?token=abc");
    assert.equal(res.status, 200);
    assert.equal(captured.length, 1);
    const line = captured[0];
    assert.equal(line.endsWith("\n"), true);
    const parsed = JSON.parse(line);
    assert.equal(parsed.method, "GET");
    assert.equal(parsed.status, 200);
    assert.equal(parsed.path.includes("whk_super_secret"), false);
    assert.equal(parsed.path.includes("abc"), false);
    assert.equal(typeof parsed.durationMs, "number");
  } finally {
    (process.stdout as unknown as { write: typeof originalWrite }).write = originalWrite;
    if (previousMode === undefined) delete process.env.TASKLOOM_ACCESS_LOG_MODE;
    else process.env.TASKLOOM_ACCESS_LOG_MODE = previousMode;
    __resetAccessLogForTests();
  }
});
