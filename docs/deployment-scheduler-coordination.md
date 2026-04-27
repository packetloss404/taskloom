# Taskloom Scheduler Coordination

Phase 21 introduces an opt-in leader-election gate for the local job scheduler so multi-process and multi-host Taskloom deployments stop double-executing queued jobs. Operators running more than one Node process today share the same persisted `jobs` rows but each scheduler tick polls and dequeues independently, so two processes can both claim the same `agent.run` or `invitation.email` job, run it twice, and double-write retry/dead-letter records. The leader-election gate makes only one process at a time eligible to dequeue, while every process keeps draining in-flight jobs it already claimed.

The gate is implemented through a `SchedulerLeaderLock` interface with three methods:

```ts
interface SchedulerLeaderLock {
  acquire(): Promise<boolean>; // atomic acquire-or-renew; returns true iff this process holds the lock
  release(): Promise<void>;    // best-effort release if owned by us
  isHeld(): boolean;           // synchronous local view
}
```

Each scheduler tick calls `acquire()` first. If it returns `false`, the tick skips dequeueing and re-checks on the next poll. In-flight jobs already running in this process are never interrupted by losing the lock; the gate only affects new dequeues. On graceful `stop()`, the scheduler calls `release()` if `isHeld()` is true, so a sibling process can take over without waiting for the lock to expire.

## Single-Process Default (Off Mode)

`TASKLOOM_SCHEDULER_LEADER_MODE` defaults to `off`. In off mode the scheduler runs as it does today: a no-op leader lock is installed, `acquire()` always returns `true`, and there is no coordination overhead. Operators running a single Node process do not need to set anything for Phase 21.

This pairs naturally with the supported single-node SQLite posture documented in `docs/deployment-sqlite-topology.md`. A single SQLite writer and a single scheduler-active Node process is the lowest-coordination supported topology and remains the default until a deployment has a reason to scale out.

## File-Based Lock (File Mode)

Set `TASKLOOM_SCHEDULER_LEADER_MODE=file` to enable a JSON file lock at `TASKLOOM_SCHEDULER_LEADER_FILE_PATH` (default `data/scheduler-leader.json`). Every scheduler tick on every process performs an atomic create/rename to claim or renew the file. The file payload is:

```json
{
  "processId": "host-12345-a1b2",
  "expiresAt": 1714099200000
}
```

`processId` defaults to `${hostname}-${pid}-${randomShortHex}` and can be overridden with `TASKLOOM_SCHEDULER_LEADER_PROCESS_ID`. `expiresAt` is the epoch-millisecond timestamp computed from the current acquire plus `TASKLOOM_SCHEDULER_LEADER_TTL_MS` (default `30000`).

Topology expectations:

- File mode is intended for multiple Node processes on the same host, or for hosts sharing a fast local filesystem with reliable `rename(2)` atomicity.
- File mode is NOT safe on NFS, SMB, EFS, Azure Files, or other network filesystems where atomic rename semantics across hosts are not guaranteed. The same network-filesystem caveats called out for SQLite in `docs/deployment-sqlite-topology.md` apply here: file locking and atomic rename are filesystem-specific, and silent split-brain is the failure mode if the assumption breaks.
- Crash semantics: a process that exits without calling `release()` leaves the file behind. The next scheduler poll on any process sees an `expiresAt` in the past and takes over. Set `TASKLOOM_SCHEDULER_LEADER_TTL_MS` to a value greater than or equal to the worst-case scheduler tick latency for the deployment, so a busy leader does not keep losing the lock to a sibling that polled during a slow tick.

## HTTP Coordinator (HTTP Mode)

Set `TASKLOOM_SCHEDULER_LEADER_MODE=http` to coordinate leadership through an external HTTP service. The scheduler calls two endpoints under `TASKLOOM_SCHEDULER_LEADER_HTTP_URL`.

`POST <url>/acquire` requests or renews the lock:

```bash
curl -X POST https://coordinator.example.com/scheduler-leader/acquire \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET" \
  -d '{"processId":"host-12345-a1b2","ttlMs":30000,"timestamp":1714099200000}'
```

Response shape:

- `200 { "leader": true }` or `200 { "acquired": true }`: this process holds the lock for `ttlMs`.
- `200 { "leader": false }` or `200 { "acquired": false }`: another process holds the lock; this process skips the tick.
- `409 Conflict`: another holder has the lock; treated the same as a `false` response.
- `401` or `403`: the coordinator rejected the credentials or the request shape; the scheduler refuses to dequeue while the configuration is broken.
- Network errors, timeouts, and unexpected non-2xx responses fail closed by default: the tick is skipped. Set `TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN=true` to keep using the previous local belief instead. Fail-open is useful for degraded read-only operation, but accepts the duplicate-execution risk Phase 21 is designed to prevent.

`POST <url>/release` is called on graceful stop:

```bash
curl -X POST https://coordinator.example.com/scheduler-leader/release \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET" \
  -d '{"processId":"host-12345-a1b2","timestamp":1714099200000}'
```

The coordinator should drop the lock if it is still owned by `processId`. Release is best-effort: a coordinator that times out on release simply forces the next leader to wait up to `ttlMs` for natural expiry.

`TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET` is optional; when set, Taskloom adds an `Authorization: Bearer <secret>` header to both endpoints. `TASKLOOM_SCHEDULER_LEADER_HTTP_TIMEOUT_MS` defaults to `5000` and caps each request.

Taskloom does NOT ship a coordinator service. The protocol above is intentionally minimal so operators can build the coordinator against existing infrastructure. Conceptual options include a Consul or etcd KV with TTLs fronted by a tiny adapter, a single-replica Redis with `SET NX PX`, or a small custom Hono/Express service backed by any database that supports atomic upserts. None of these are endorsed; the choice depends on the rest of the deployment topology.

## Operating With Multiple Schedulers

Sizing guidance:

- Use `TASKLOOM_SCHEDULER_LEADER_MODE=file` for two-to-four Node processes on the same host or hosts sharing a local filesystem.
- Use `TASKLOOM_SCHEDULER_LEADER_MODE=http` once schedulers cross hosts, regions, or filesystems without shared atomic rename semantics.

Handoff latency:

- When the leader process exits gracefully, `release()` returns the lock immediately and another process can claim it on its next tick.
- When the leader process exits ungracefully, expect up to `TASKLOOM_SCHEDULER_LEADER_TTL_MS` of scheduler quiet time before another process takes over. Lower the TTL for faster takeover, but never below the worst-case scheduler tick or the lock will flap between processes.

Job semantics across handoff:

- Cron jobs are unaffected by handoff. `enqueueRecurringJob` only runs after a successful execution, and the next leader picks up the same persisted queue from the local store.
- The scheduler already runs a stale-running-job sweep on `start()`. A new leader sweeps any runs that were in-flight when the prior leader died and re-queues them according to the existing retry policy.
- In-flight jobs in non-leader processes continue to run to completion. The leader gate only affects which process is allowed to dequeue new work; it does not interrupt or migrate running jobs.

## Configuration Reference

| Env var | Default | Description |
| --- | --- | --- |
| `TASKLOOM_SCHEDULER_LEADER_MODE` | `off` | `off`, `file`, or `http`. Selects the leader-lock implementation. |
| `TASKLOOM_SCHEDULER_LEADER_TTL_MS` | `30000` | Lock TTL in milliseconds. Lock expires this long after the most recent acquire/renew. |
| `TASKLOOM_SCHEDULER_LEADER_PROCESS_ID` | `${hostname}-${pid}-${randomShortHex}` | Stable per-process identifier written into the lock record. |
| `TASKLOOM_SCHEDULER_LEADER_FILE_PATH` | `data/scheduler-leader.json` | File-mode lock path. Use a path on a local filesystem with atomic rename semantics. |
| `TASKLOOM_SCHEDULER_LEADER_HTTP_URL` | unset | HTTP-mode coordinator base URL. Required when mode is `http`. |
| `TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET` | unset | Optional bearer secret sent as `Authorization: Bearer <secret>` to the coordinator. |
| `TASKLOOM_SCHEDULER_LEADER_HTTP_TIMEOUT_MS` | `5000` | Per-request HTTP timeout in milliseconds. |
| `TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN` | unset (fail-closed) | Set to `true`, `1`, or `yes` to preserve the prior local leader belief on coordinator outages. Otherwise outages skip the tick. |

## Validation Checklist

After enabling the leader gate, walk through:

- Start two Node processes against the same store and confirm only one runs jobs at a time. Tail `data/taskloom.json` or query `data/taskloom.sqlite` for `runs` and `jobs` mutation timestamps to verify exactly one process is dequeueing.
- Kill the leader process and wait longer than `TASKLOOM_SCHEDULER_LEADER_TTL_MS`; confirm the surviving process starts running queued jobs.
- Stop the leader gracefully (SIGINT) and confirm the surviving process picks up jobs without waiting for TTL expiry.
- HTTP mode with `TASKLOOM_SCHEDULER_LEADER_HTTP_SECRET` set: confirm coordinator request logs show `Authorization: Bearer ...` on every `/acquire` and `/release` call.
- HTTP mode without a secret: confirm no `Authorization` header is sent.
- HTTP mode: configure the coordinator to return `401`, confirm the scheduler stops dequeuing and no new jobs run while the configuration is broken.
- HTTP mode: simulate a coordinator outage and confirm the default fail-closed posture skips ticks; toggle `TASKLOOM_SCHEDULER_LEADER_HTTP_FAIL_OPEN=true` only if the deployment has accepted the duplicate-execution risk.
- File mode: confirm the chosen `TASKLOOM_SCHEDULER_LEADER_FILE_PATH` is on a local filesystem, not NFS/SMB/EFS, and that backups exclude the leader file (it is recovery-irrelevant runtime state).
- Cross-link the rest of the production posture: `docs/deployment-auth-hardening.md` for auth/invitation rate limits and CSRF behavior, `docs/deployment-sqlite-topology.md` for storage topology, `docs/invitation-email-operations.md` for invitation webhook delivery and dead-letter expectations, and `docs/deployment-export-redaction.md` for access-log and export redaction.
