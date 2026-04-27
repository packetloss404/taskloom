# Taskloom Access-Log Shipping And Retention

Phase 23 layers managed log shipping, retention, and SIEM integration on top of the Phase 20 access-log middleware. Phase 20 added an opt-in Hono middleware that writes redacted JSON access lines to stdout or a file based on `TASKLOOM_ACCESS_LOG_MODE`/`TASKLOOM_ACCESS_LOG_PATH`, plus reverse-proxy rewriting templates and a validator at `src/security/proxy-access-log-validator.ts`. Phase 23 fills the operator gap that came after: in-app size-based rotation, an out-of-band rotation CLI, and tested integration recipes for the common shipping paths to Vector, Fluent Bit, and Promtail/Loki. The goal is a redacted access-log surface that an operator can plug into the rest of their SIEM/object-store stack without holding raw token-bearing strings on local disk longer than necessary.

The doc covers two paths in parallel: the in-app rotation/retention knobs that bound disk usage when the middleware writes to a file, and the integration story for external shippers that tail those rotated files (or stdout, when running under a process supervisor). Both paths share the same Phase 19 + Phase 20 redaction posture, so the SIEM ingests the same masked path/query and identifier fields the app emits at the request boundary.

## Built-In Rotation

The file-mode access logger now supports size-based rotation through two env knobs:

- `TASKLOOM_ACCESS_LOG_MAX_BYTES`: maximum size of the active log file in bytes. Defaults to `0`, which disables rotation. When greater than zero, the middleware rotates the current file before writing a line that would push `currentFileSize + nextLineLength` past the threshold, so the active file always stays under the cap.
- `TASKLOOM_ACCESS_LOG_MAX_FILES`: number of historical rotations to retain. Defaults to `5` and is clamped to `>= 1`. Older rotations beyond this count are deleted on rotation.

File suffix scheme:

- `<path>` is the active log file currently being written.
- `<path>.1` is the most recent rotation.
- `<path>.2`, `<path>.3`, ... ascend through older rotations up to `<path>.<MAX_FILES>`.
- On rotation, files cascade: `<path>.<MAX_FILES>` is deleted, `<path>.<n>` becomes `<path>.<n+1>` for descending `n`, and the active `<path>` becomes `<path>.1`. A new empty active file is then opened.

Behavior on Windows: `renameSync` may fail with `EBUSY` when another process or a held file handle is keeping the file open. The middleware closes its cached write stream before rotation to release the handle from the Node side, but a concurrent process tailing or writing the same file can still trigger `EBUSY`. In that case the middleware skips the rotation and continues to write to the existing file; the next request will retry the rotation. For multi-process deployments that cannot tolerate skipped rotations, prefer one of:

- Give each process its own `TASKLOOM_ACCESS_LOG_PATH` so rotations never contend.
- Run rotation only through the manual CLI under controlled conditions (for example, a maintenance window cron) rather than via in-line size-based rotation.
- Switch to `TASKLOOM_ACCESS_LOG_MODE=stdout` and let the process supervisor handle rotation.

In-app rotation is a local disk-bound buffer to keep the active file size predictable; it is not a substitute for compliance-grade retention storage downstream.

## Manual Rotation CLI

For cron-driven daily rotation or operator-initiated rotation, Taskloom ships an out-of-band CLI:

```bash
npm run access-log:rotate -- --path=data/access.log --max-files=10
```

Behavior:

- `--path=<file>` selects the access log file to rotate. Falls back to `TASKLOOM_ACCESS_LOG_PATH` when the flag is omitted.
- `--max-files=<n>` caps the number of retained rotations. Falls back to `TASKLOOM_ACCESS_LOG_MAX_FILES` when the flag is omitted, then defaults to `5` and is clamped to `>= 1`.
- Exits `0` even when the file does not exist, so a daily cron entry is safe to run before the file is created or during quiet windows when no log lines have been written.
- Exits `2` when no path can be resolved (no flag and no env var).
- Exits `1` on unexpected errors (filesystem, permissions, etc.) so cron and supervisors flag the run.

The CLI calls the same `rotateAccessLogFile(path, maxFiles)` helper as the in-app middleware, so cascade behavior and pruning are identical. Operators that prefer time-based rotation (for example, "rotate every day at 02:00") can leave `TASKLOOM_ACCESS_LOG_MAX_BYTES=0` and drive rotation entirely from cron.

## Stdout-Mode Shipping

When the app runs under a process supervisor that already captures stdout (`systemd` with `StandardOutput=journal`, `docker logs`, Kubernetes container logs, or any platform log driver), `TASKLOOM_ACCESS_LOG_MODE=stdout` is the natural choice. The app writes one JSON line per request to stdout and the supervisor handles persistence, rotation, and shipping.

In stdout mode:

- `TASKLOOM_ACCESS_LOG_PATH`, `TASKLOOM_ACCESS_LOG_MAX_BYTES`, and `TASKLOOM_ACCESS_LOG_MAX_FILES` are not used; rotation/retention is the supervisor's responsibility.
- Configure the platform log driver (Docker `json-file` with `max-size`/`max-file`, journald with `SystemMaxUse`, Kubernetes log rotation defaults) for the size/retention envelope.
- Forward the supervisor's captured stream into the same downstream shipper (Vector, Fluent Bit, Promtail) used for the file-mode path. The JSON line shape is identical.

File mode remains the right choice when the deployment cannot give the Node process a clean stdout (legacy launchers, mixed binary output) or when an out-of-process tailer reads the file directly without a supervisor in between.

## File-Mode Shipping With Vector

Vector tails the rotated file, parses each line as JSON, optionally enriches with hostname/environment metadata, and ships to Loki, S3, Elasticsearch, or any other Vector sink. The example config lives at `docs/deployment/access-log-shipping/vector.toml.example`.

Recipe summary:

- A `[sources.taskloom_access_log]` block of type `file` watches the path supplied to `TASKLOOM_ACCESS_LOG_PATH`. Vector's `file` source handles rotation natively when configured to follow renamed files, so the rotation cascade described above does not lose lines.
- A `[transforms.parse]` block of type `remap` parses each line as JSON, drops any line that fails to parse, and optionally adds enrichment fields such as `hostname`, `env`, or service tags.
- One or more `[sinks.*]` blocks ship to the configured destination (Loki, S3, Elasticsearch, or a forwarder).

Minimal source/transform shape:

```toml
[sources.taskloom_access_log]
type = "file"
include = ["/var/log/taskloom/access.log"]
read_from = "beginning"

[transforms.parse]
type = "remap"
inputs = ["taskloom_access_log"]
source = '''
  . = parse_json!(.message)
  .service = "taskloom"
'''
```

Operator notes:

- Keep enrichment fields free of secrets. Hostname and environment tags are usually fine; do not enrich with anything sourced from request bodies, headers, or auth context, because the access log line is already redacted at the source and reintroducing those fields would defeat the redaction.
- Vector's checkpointing keeps tail position across restarts, so a restart during rotation does not duplicate or lose lines beyond the buffer Vector has already acknowledged.
- Pin the `include` glob to the active path only (not `access.log*`); Vector follows the rename cascade by inode, so matching the rotated siblings is unnecessary and can cause re-reads.

## File-Mode Shipping With Fluent Bit

Fluent Bit's `tail` input reads the active access log and any rotated siblings, parses JSON, and forwards to the operator's chosen destination. The example config lives at `docs/deployment/access-log-shipping/fluent-bit.conf.example`.

Recipe summary:

- An `[INPUT]` of type `tail` matches the access log path with a glob (for example, `data/access.log*`) so it picks up both the current file and rotated files. `Parser json` decodes each line into structured fields.
- `Rotate_Wait` controls how long Fluent Bit keeps a file descriptor on a rotated file before closing it, so in-flight reads finish before the file is renamed away.
- A `DB` setting persists the tail offset so Fluent Bit resumes from where it left off across restarts and rotations rather than re-reading the whole file.
- An `[OUTPUT]` block forwards the structured records to Loki, CloudWatch, Elasticsearch, a forwarder, or another Fluent Bit destination.

Minimal input shape:

```ini
[INPUT]
    Name        tail
    Path        /var/log/taskloom/access.log*
    Parser      json
    Tag         taskloom.access
    DB          /var/lib/fluent-bit/taskloom-access.db
    Rotate_Wait 10
    Refresh_Interval 5
```

Operator notes:

- The glob match means the rotation cascade is followed automatically; there is no need to teach Fluent Bit about each `<path>.<n>` file individually.
- If the deployment uses very tight `MAX_FILES` (for example, `1`), confirm `Rotate_Wait` plus the scrape interval still leaves Fluent Bit time to finish reading rotated files before they are pruned.
- The `DB` file should sit on the same persistent volume Fluent Bit uses across restarts; otherwise the tail position resets and the shipper re-reads the entire active file on the next start.

## File-Mode Shipping With Promtail (Loki)

Promtail tails the access log files and ships structured records into Loki with extracted labels. The example config lives at `docs/deployment/access-log-shipping/promtail.yaml.example`.

Recipe summary:

- A `scrape_configs` job with a `static_configs` target watches the access log path. Promtail follows renamed files when the underlying inode changes, so the rotation cascade is followed automatically.
- `pipeline_stages` includes a `json` stage that extracts fields like `userId`, `workspaceId`, `status`, and `method` for promotion to Loki labels, plus a `labels` stage that selects a small subset for indexing.
- The remainder of the JSON line stays in the log body, available for full-text queries in Loki.

Minimal scrape config:

```yaml
scrape_configs:
  - job_name: taskloom-access
    static_configs:
      - targets: [localhost]
        labels:
          job: taskloom-access
          __path__: /var/log/taskloom/access.log
    pipeline_stages:
      - json:
          expressions:
            method: method
            status: status
            workspace_id: workspaceId
      - labels:
          method:
          status:
          workspace_id:
```

Cardinality cautions:

- Promote only low-cardinality fields to labels. `status`, `method`, and `workspaceId` are usually safe; `userId` is borderline depending on the deployment size.
- Keep high-cardinality identifiers (for example, `requestId`, `path`) in the log line and not as labels. High-cardinality labels balloon Loki's index and degrade query performance.
- The Phase 20 redactor masks token-bearing path segments before they reach the access log, so the `path` field is safe to keep in the body even when the SIEM operator can search it.

## SIEM Integration Notes

The access-log shipping pipeline is one of three redaction surfaces the SIEM should ingest together for a consistent view:

- The access-log middleware (Phase 20) covers requests that reach the Node app.
- The reverse-proxy access-log rewriting templates under `docs/deployment/proxy-access-log-redaction/` (Phase 20D), validated by `src/security/proxy-access-log-validator.ts`, cover requests Taskloom may never see (TLS failures, edge 404s, health probes).
- The workspace export pipeline (`npm run jobs:export-workspace`, Phase 20B) provides a redacted snapshot of workspace state for audit handoff or DSAR responses.

Pair all three so SIEM dashboards and incident-response queries see the same redacted shape for tokens, bearer values, and token-bearing URLs regardless of which traffic surface produced the record.

Retention guidance:

- Configure compliance-grade retention on the SIEM or object-store side, not through Taskloom-side `MAX_FILES`. The in-app rotation is a disk-bound buffer; treat the shipped destination as the source of truth for retention windows, legal hold, and tamper evidence.
- Size the local buffer (`MAX_BYTES * MAX_FILES`) generously enough to cover the worst-case shipper outage the operator is willing to absorb, then accept that older lines will roll off the local disk once the cap is reached.

PII and regulatory expectations:

- Phase 19 + Phase 20 ensure tokens, bearer values, and token-bearing URLs are redacted at the source. The shipped JSON line should never contain a raw `whk_`, share, or invitation-accept token.
- Operators should still review their own enrichment fields (hostname, environment tags, custom labels added by Vector/Fluent Bit/Promtail) for sensitivity. Adding a customer-identifying tag at the shipper level can reintroduce PII the app stripped at the boundary.
- For data-subject requests, pair the shipped access logs with the workspace export pipeline rather than re-deriving subject activity from the access log alone; the export covers durable state, while access logs cover request shape.

## Validation Checklist

After enabling Phase 23 controls, walk through:

- Trigger several thousand requests against the running app (or run `npm run access-log:rotate` repeatedly with a small `--max-files`) and verify `<path>.1`, `<path>.2`, ... appear in order, that the active `<path>` stays under `TASKLOOM_ACCESS_LOG_MAX_BYTES`, and that older files beyond `TASKLOOM_ACCESS_LOG_MAX_FILES` are pruned.
- Confirm the configured shipper picks up rotated files within its `Rotate_Wait` (Fluent Bit), follow-renames (Vector), or inode-tracking (Promtail) window. Watch for "file truncated" or "file disappeared" warnings in the shipper log; those usually mean the rotation cascade outran the shipper's read cursor and `MAX_FILES` should be raised.
- Confirm the SIEM ingests the JSON lines as structured events with parsed fields (not opaque strings). Each event should carry `ts`, `method`, `status`, `path`, `durationMs`, `userId`, `workspaceId`, and `requestId`.
- Run `node --import tsx src/security/proxy-access-log-validator.ts <shipped-sample>` against a sample exported from the SIEM. Exit code `0` means no raw `whk_`, `Bearer `, share/invitation/webhook token segments, or sensitive query parameter values reached the SIEM. A non-zero exit code points at a redaction gap to fix at the source (proxy, app middleware, or shipper enrichment).
- Cross-link the rest of the production posture: `docs/deployment-export-redaction.md` for the workspace export pipeline and proxy templates, `docs/deployment-scheduler-coordination.md` for multi-process scheduler coordination, `docs/deployment-auth-hardening.md` for auth/invitation rate limits and CSRF behavior, `docs/deployment-sqlite-topology.md` for storage topology, and `docs/invitation-email-operations.md` for invitation webhook delivery and reconciliation expectations.
