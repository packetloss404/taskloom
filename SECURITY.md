# Security Policy

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through GitHub Security Advisories for `packetloss404/taskloom`. If advisories are unavailable, open a minimal issue asking for a private security contact and do not include exploit details or secrets in the public issue.

Include the affected version or commit, a concise impact summary, reproduction steps, and any relevant deployment assumptions. We aim to acknowledge reports within 72 hours.

## Supported Versions

Taskloom is pre-1.0. Security fixes target the latest `main` branch and the newest tagged release when tags exist. Older snapshots may not receive backports.

## Production Baseline

Self-hosted production deployments should set:

- `NODE_ENV=production`
- `MASTER_KEY` to a long deployment-specific secret
- `TASKLOOM_RATE_LIMIT_KEY_SALT` to a deployment-specific secret
- `TASKLOOM_SANDBOX_DRIVER=docker`
- `TASKLOOM_ARTIFACT_SERVING_ENABLED=false` unless generated artifacts are intentionally public

The native sandbox driver runs commands on the host and is blocked in production unless `TASKLOOM_ALLOW_INSECURE_NATIVE_SANDBOX=true` is set for a trusted development environment.

Do not publish `.env`, database files, `data/artifacts/`, logs, or workspace exports. These may contain bearer material, encrypted secret blobs, user content, or operational metadata.
