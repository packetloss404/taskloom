import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createJobsRepository,
  jsonJobsRepository,
  sqliteJobsRepository,
  type JobsRepository,
  type JobsRepositoryDeps,
} from "./jobs-repo.js";
import type { JobRecord, TaskloomData } from "../taskloom-store.js";

function makeRecord(overrides: Partial<JobRecord> & { id: string }): JobRecord {
  const record: JobRecord = {
    id: overrides.id,
    workspaceId: overrides.workspaceId ?? "ws_default",
    type: overrides.type ?? "agent.run",
    payload: overrides.payload ?? {},
    status: overrides.status ?? "queued",
    attempts: overrides.attempts ?? 0,
    maxAttempts: overrides.maxAttempts ?? 3,
    scheduledAt: overrides.scheduledAt ?? "2026-04-26T10:00:00.000Z",
    createdAt: overrides.createdAt ?? "2026-04-26T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-26T10:00:00.000Z",
  };
  if (overrides.startedAt !== undefined) record.startedAt = overrides.startedAt;
  if (overrides.completedAt !== undefined) record.completedAt = overrides.completedAt;
  if (overrides.cron !== undefined) record.cron = overrides.cron;
  if (overrides.result !== undefined) record.result = overrides.result;
  if (overrides.error !== undefined) record.error = overrides.error;
  if (overrides.cancelRequested !== undefined) record.cancelRequested = overrides.cancelRequested;
  return record;
}

function makeJsonRepo(): JobsRepository {
  const data = { jobs: [] as JobRecord[] } as unknown as TaskloomData;
  const deps: JobsRepositoryDeps = {
    loadStore: () => data,
    mutateStore: <T,>(mutator: (target: TaskloomData) => T) => mutator(data),
  };
  return jsonJobsRepository(deps);
}

function withTempSqlite(testFn: (repo: JobsRepository) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "taskloom-jobs-repo-"));
  const dbPath = join(dir, "taskloom.sqlite");
  const prevStore = process.env.TASKLOOM_STORE;
  const prevDbPath = process.env.TASKLOOM_DB_PATH;
  process.env.TASKLOOM_STORE = "sqlite";
  process.env.TASKLOOM_DB_PATH = dbPath;
  try {
    const repo = sqliteJobsRepository({ dbPath });
    testFn(repo);
  } finally {
    if (prevStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = prevStore;
    if (prevDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = prevDbPath;
    rmSync(dir, { recursive: true, force: true });
  }
}

function runOnBoth(scenario: (repo: JobsRepository) => void): void {
  scenario(makeJsonRepo());
  withTempSqlite(scenario);
}

test("empty repository returns no rows", () => {
  runOnBoth((repo) => {
    assert.deepEqual(repo.list({ workspaceId: "ws_a" }), []);
    assert.equal(repo.count(), 0);
    assert.equal(repo.find("missing"), null);
  });
});

test("upsert then list returns the record verbatim", () => {
  runOnBoth((repo) => {
    const record = makeRecord({
      id: "job_1",
      workspaceId: "ws_a",
      type: "agent.run",
      payload: { agentId: "agent_a", count: 5, ok: true },
      status: "queued",
      attempts: 1,
      maxAttempts: 5,
      scheduledAt: "2026-04-26T10:00:01.000Z",
      cron: "*/5 * * * *",
      createdAt: "2026-04-26T10:00:00.000Z",
      updatedAt: "2026-04-26T10:00:01.000Z",
    });
    repo.upsert(record);
    const rows = repo.list({ workspaceId: "ws_a" });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], record);
    assert.equal(repo.count(), 1);
  });
});

test("list returns rows sorted descending by createdAt", () => {
  runOnBoth((repo) => {
    repo.upsert(makeRecord({ id: "a", workspaceId: "ws_a", createdAt: "2026-04-26T12:00:00.000Z" }));
    repo.upsert(makeRecord({ id: "b", workspaceId: "ws_a", createdAt: "2026-04-26T10:00:00.000Z" }));
    repo.upsert(makeRecord({ id: "c", workspaceId: "ws_a", createdAt: "2026-04-26T11:00:00.000Z" }));
    const ids = repo.list({ workspaceId: "ws_a" }).map((entry) => entry.id);
    assert.deepEqual(ids, ["a", "c", "b"]);
  });
});

test("list filters by workspace", () => {
  runOnBoth((repo) => {
    repo.upsert(makeRecord({ id: "a", workspaceId: "ws_a", createdAt: "2026-04-26T10:00:00.000Z" }));
    repo.upsert(makeRecord({ id: "b", workspaceId: "ws_b", createdAt: "2026-04-26T11:00:00.000Z" }));
    repo.upsert(makeRecord({ id: "c", workspaceId: "ws_a", createdAt: "2026-04-26T12:00:00.000Z" }));
    const aIds = repo.list({ workspaceId: "ws_a" }).map((entry) => entry.id);
    assert.deepEqual(aIds, ["c", "a"]);
    const bIds = repo.list({ workspaceId: "ws_b" }).map((entry) => entry.id);
    assert.deepEqual(bIds, ["b"]);
  });
});

test("list filters by status", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({ id: "a", workspaceId: "ws_a", status: "queued", createdAt: "2026-04-26T10:00:00.000Z" }),
    );
    repo.upsert(
      makeRecord({ id: "b", workspaceId: "ws_a", status: "running", createdAt: "2026-04-26T11:00:00.000Z" }),
    );
    repo.upsert(
      makeRecord({ id: "c", workspaceId: "ws_a", status: "queued", createdAt: "2026-04-26T12:00:00.000Z" }),
    );
    const queued = repo.list({ workspaceId: "ws_a", status: "queued" }).map((entry) => entry.id);
    assert.deepEqual(queued, ["c", "a"]);
    const running = repo.list({ workspaceId: "ws_a", status: "running" }).map((entry) => entry.id);
    assert.deepEqual(running, ["b"]);
  });
});

test("list applies default limit of 50 and caps at 200", () => {
  runOnBoth((repo) => {
    for (let index = 0; index < 210; index += 1) {
      const id = `job_${String(index).padStart(3, "0")}`;
      const seconds = String(index % 60).padStart(2, "0");
      const millis = String(index).padStart(3, "0");
      repo.upsert(
        makeRecord({
          id,
          workspaceId: "ws_a",
          createdAt: `2026-04-26T10:00:${seconds}.${millis}Z`,
        }),
      );
    }
    assert.equal(repo.list({ workspaceId: "ws_a" }).length, 50);
    assert.equal(repo.list({ workspaceId: "ws_a", limit: 1 }).length, 1);
    assert.equal(repo.list({ workspaceId: "ws_a", limit: 1000 }).length, 200);
  });
});

test("find returns the matching row regardless of workspace", () => {
  runOnBoth((repo) => {
    repo.upsert(makeRecord({ id: "job_1", workspaceId: "ws_a", type: "first" }));
    repo.upsert(makeRecord({ id: "job_2", workspaceId: "ws_b", type: "second" }));
    const result = repo.find("job_2");
    assert.ok(result);
    assert.equal(result?.type, "second");
    assert.equal(result?.workspaceId, "ws_b");
  });
});

test("find returns null when id is unknown", () => {
  runOnBoth((repo) => {
    repo.upsert(makeRecord({ id: "job_1", workspaceId: "ws_a" }));
    assert.equal(repo.find("missing"), null);
  });
});

test("upsert replaces existing row by id", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "job_1",
        workspaceId: "ws_a",
        status: "queued",
        attempts: 0,
        updatedAt: "2026-04-26T10:00:00.000Z",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "job_1",
        workspaceId: "ws_a",
        status: "success",
        attempts: 2,
        updatedAt: "2026-04-26T10:05:00.000Z",
      }),
    );
    assert.equal(repo.count(), 1);
    const row = repo.find("job_1");
    assert.equal(row?.status, "success");
    assert.equal(row?.attempts, 2);
    assert.equal(row?.updatedAt, "2026-04-26T10:05:00.000Z");
  });
});

test("update applies the patch and bumps updatedAt", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "job_1",
        workspaceId: "ws_a",
        status: "queued",
        updatedAt: "2026-04-26T10:00:00.000Z",
      }),
    );
    const before = Date.now();
    const updated = repo.update("job_1", { status: "success", error: "none" });
    const after = Date.now();
    assert.ok(updated);
    assert.equal(updated?.status, "success");
    assert.equal(updated?.error, "none");
    const updatedMs = Date.parse(updated!.updatedAt);
    assert.ok(updatedMs >= before && updatedMs <= after);
    const row = repo.find("job_1");
    assert.equal(row?.status, "success");
    assert.equal(row?.error, "none");
  });
});

test("update returns null when id is unknown", () => {
  runOnBoth((repo) => {
    repo.upsert(makeRecord({ id: "job_1", workspaceId: "ws_a" }));
    assert.equal(repo.update("missing", { status: "failed" }), null);
  });
});

test("payload round-trip preserves mixed scalar values", () => {
  runOnBoth((repo) => {
    const record = makeRecord({
      id: "job_payload",
      workspaceId: "ws_a",
      payload: { agentId: "agent_x", count: 5, ok: true },
    });
    repo.upsert(record);
    const found = repo.find("job_payload");
    assert.deepEqual(found?.payload, { agentId: "agent_x", count: 5, ok: true });
  });
});

test("result round-trip handles object, null, and undefined", () => {
  runOnBoth((repo) => {
    repo.upsert(makeRecord({ id: "obj", workspaceId: "ws_a", result: { ok: true, count: 3 } }));
    repo.upsert(makeRecord({ id: "nul", workspaceId: "ws_a", result: null }));
    repo.upsert(makeRecord({ id: "und", workspaceId: "ws_a" }));

    const obj = repo.find("obj");
    assert.deepEqual(obj?.result, { ok: true, count: 3 });

    const nul = repo.find("nul");
    assert.equal(nul?.result, null);

    const und = repo.find("und");
    assert.equal(und?.result, undefined);
  });
});

test("cancelRequested round-trips through undefined, true, and false", () => {
  runOnBoth((repo) => {
    repo.upsert(makeRecord({ id: "und", workspaceId: "ws_a" }));
    repo.upsert(makeRecord({ id: "tru", workspaceId: "ws_a", cancelRequested: true }));
    repo.upsert(makeRecord({ id: "fal", workspaceId: "ws_a", cancelRequested: false }));

    assert.equal(repo.find("und")?.cancelRequested, undefined);
    assert.equal(repo.find("tru")?.cancelRequested, true);
    assert.equal(repo.find("fal")?.cancelRequested, false);
  });
});

test("optional fields round-trip as undefined when omitted", () => {
  runOnBoth((repo) => {
    const record = makeRecord({ id: "minimal", workspaceId: "ws_a" });
    repo.upsert(record);
    const found = repo.find("minimal");
    assert.ok(found);
    assert.equal(found?.startedAt, undefined);
    assert.equal(found?.completedAt, undefined);
    assert.equal(found?.cron, undefined);
    assert.equal(found?.result, undefined);
    assert.equal(found?.error, undefined);
    assert.equal(found?.cancelRequested, undefined);
  });
});

test("claimNext returns null when no queued jobs exist", () => {
  runOnBoth((repo) => {
    assert.equal(repo.claimNext(new Date("2026-04-26T10:00:00.000Z")), null);
    repo.upsert(
      makeRecord({
        id: "running",
        workspaceId: "ws_a",
        status: "running",
        startedAt: "2026-04-26T09:55:00.000Z",
      }),
    );
    assert.equal(repo.claimNext(new Date("2026-04-26T10:00:00.000Z")), null);
  });
});

test("claimNext promotes a queued job to running and increments attempts", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "job_1",
        workspaceId: "ws_a",
        status: "queued",
        attempts: 0,
        scheduledAt: "2026-04-26T09:00:00.000Z",
        createdAt: "2026-04-26T09:00:00.000Z",
        updatedAt: "2026-04-26T09:00:00.000Z",
      }),
    );
    const now = new Date("2026-04-26T10:00:00.000Z");
    const claimed = repo.claimNext(now);
    assert.ok(claimed);
    assert.equal(claimed?.id, "job_1");
    assert.equal(claimed?.status, "running");
    assert.equal(claimed?.attempts, 1);
    assert.equal(claimed?.startedAt, "2026-04-26T10:00:00.000Z");
    assert.equal(claimed?.updatedAt, "2026-04-26T10:00:00.000Z");
    const persisted = repo.find("job_1");
    assert.equal(persisted?.status, "running");
    assert.equal(persisted?.startedAt, "2026-04-26T10:00:00.000Z");
  });
});

test("claimNext picks the oldest scheduledAt among queued jobs", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "later",
        workspaceId: "ws_a",
        scheduledAt: "2026-04-26T09:30:00.000Z",
        createdAt: "2026-04-26T09:00:00.000Z",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "earlier",
        workspaceId: "ws_a",
        scheduledAt: "2026-04-26T09:00:00.000Z",
        createdAt: "2026-04-26T09:00:00.000Z",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "middle",
        workspaceId: "ws_a",
        scheduledAt: "2026-04-26T09:15:00.000Z",
        createdAt: "2026-04-26T09:00:00.000Z",
      }),
    );
    const claimed = repo.claimNext(new Date("2026-04-26T10:00:00.000Z"));
    assert.equal(claimed?.id, "earlier");
  });
});

test("claimNext honors Date.parse-valid non-ISO scheduledAt values", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "rfc_due",
        workspaceId: "ws_a",
        scheduledAt: "Sun, 26 Apr 2026 09:00:00 GMT",
        createdAt: "2026-04-26T08:00:00.000Z",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "iso_later",
        workspaceId: "ws_a",
        scheduledAt: "2026-04-26T09:30:00.000Z",
        createdAt: "2026-04-26T08:00:00.000Z",
      }),
    );

    const claimed = repo.claimNext(new Date("2026-04-26T10:00:00.000Z"));
    assert.equal(claimed?.id, "rfc_due");
    assert.equal(repo.find("rfc_due")?.status, "running");
    assert.equal(repo.find("iso_later")?.status, "queued");
  });
});

test("claimNext skips jobs scheduled in the future", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "future",
        workspaceId: "ws_a",
        scheduledAt: "2026-04-26T11:00:00.000Z",
      }),
    );
    assert.equal(repo.claimNext(new Date("2026-04-26T10:00:00.000Z")), null);
  });
});

test("claimNext invoked twice picks two different jobs", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "first",
        workspaceId: "ws_a",
        scheduledAt: "2026-04-26T09:00:00.000Z",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "second",
        workspaceId: "ws_a",
        scheduledAt: "2026-04-26T09:30:00.000Z",
      }),
    );
    const a = repo.claimNext(new Date("2026-04-26T10:00:00.000Z"));
    const b = repo.claimNext(new Date("2026-04-26T10:00:01.000Z"));
    assert.ok(a);
    assert.ok(b);
    assert.notEqual(a?.id, b?.id);
    assert.equal(a?.id, "first");
    assert.equal(b?.id, "second");
    assert.equal(repo.claimNext(new Date("2026-04-26T10:00:02.000Z")), null);
  });
});

test("sweepStaleRunning returns 0 when no stale rows exist", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "fresh",
        workspaceId: "ws_a",
        status: "running",
        startedAt: "2026-04-26T09:59:30.000Z",
      }),
    );
    const swept = repo.sweepStaleRunning(60_000, new Date("2026-04-26T10:00:00.000Z"));
    assert.equal(swept, 0);
    assert.equal(repo.find("fresh")?.status, "running");
  });
});

test("sweepStaleRunning resets stale rows to queued and clears startedAt", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "stale_a",
        workspaceId: "ws_a",
        status: "running",
        startedAt: "2026-04-26T09:50:00.000Z",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "stale_b",
        workspaceId: "ws_b",
        status: "running",
        startedAt: "2026-04-26T09:40:00.000Z",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "fresh",
        workspaceId: "ws_a",
        status: "running",
        startedAt: "2026-04-26T09:59:30.000Z",
      }),
    );
    const swept = repo.sweepStaleRunning(5 * 60 * 1000, new Date("2026-04-26T10:00:00.000Z"));
    assert.equal(swept, 2);
    const a = repo.find("stale_a");
    assert.equal(a?.status, "queued");
    assert.equal(a?.startedAt, undefined);
    const b = repo.find("stale_b");
    assert.equal(b?.status, "queued");
    assert.equal(b?.startedAt, undefined);
    const fresh = repo.find("fresh");
    assert.equal(fresh?.status, "running");
    assert.equal(fresh?.startedAt, "2026-04-26T09:59:30.000Z");
  });
});

test("sweepStaleRunning honors Date.parse-valid non-ISO startedAt values", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "rfc_stale",
        workspaceId: "ws_a",
        status: "running",
        startedAt: "Sun, 26 Apr 2026 09:00:00 GMT",
      }),
    );
    repo.upsert(
      makeRecord({
        id: "iso_fresh",
        workspaceId: "ws_a",
        status: "running",
        startedAt: "2026-04-26T09:58:00.000Z",
      }),
    );

    const count = repo.sweepStaleRunning(5 * 60 * 1000, new Date("2026-04-26T10:00:00.000Z"));
    assert.equal(count, 1);
    assert.equal(repo.find("rfc_stale")?.status, "queued");
    assert.equal(repo.find("rfc_stale")?.startedAt, undefined);
    assert.equal(repo.find("iso_fresh")?.status, "running");
  });
});

test("sweepStaleRunning ignores rows whose startedAt is recent", () => {
  runOnBoth((repo) => {
    repo.upsert(
      makeRecord({
        id: "recent",
        workspaceId: "ws_a",
        status: "running",
        startedAt: "2026-04-26T09:59:00.000Z",
      }),
    );
    const swept = repo.sweepStaleRunning(5 * 60 * 1000, new Date("2026-04-26T10:00:00.000Z"));
    assert.equal(swept, 0);
    assert.equal(repo.find("recent")?.status, "running");
  });
});

test("createJobsRepository returns json impl when env is unset", () => {
  const prevStore = process.env.TASKLOOM_STORE;
  try {
    delete process.env.TASKLOOM_STORE;
    const data = { jobs: [] as JobRecord[] } as unknown as TaskloomData;
    const repo = createJobsRepository({
      loadStore: () => data,
      mutateStore: <T,>(mutator: (target: TaskloomData) => T) => mutator(data),
    });
    repo.upsert(makeRecord({ id: "job_1", workspaceId: "ws_a" }));
    assert.equal(repo.count(), 1);
    assert.equal(data.jobs.length, 1);
  } finally {
    if (prevStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = prevStore;
  }
});

test("createJobsRepository returns sqlite impl when env requests it", () => {
  const dir = mkdtempSync(join(tmpdir(), "taskloom-jobs-factory-"));
  const dbPath = join(dir, "taskloom.sqlite");
  const prevStore = process.env.TASKLOOM_STORE;
  const prevDbPath = process.env.TASKLOOM_DB_PATH;
  process.env.TASKLOOM_STORE = "sqlite";
  process.env.TASKLOOM_DB_PATH = dbPath;
  try {
    const repo = createJobsRepository({ dbPath });
    repo.upsert(makeRecord({ id: "job_1", workspaceId: "ws_a" }));
    assert.equal(repo.count(), 1);
    assert.equal(repo.list({ workspaceId: "ws_a" })[0]?.id, "job_1");
  } finally {
    if (prevStore === undefined) delete process.env.TASKLOOM_STORE;
    else process.env.TASKLOOM_STORE = prevStore;
    if (prevDbPath === undefined) delete process.env.TASKLOOM_DB_PATH;
    else process.env.TASKLOOM_DB_PATH = prevDbPath;
    rmSync(dir, { recursive: true, force: true });
  }
});
