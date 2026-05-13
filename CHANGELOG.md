# Changelog

All notable changes to Taskloom are tracked here.

This project follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning once releases are tagged.

## [Unreleased]

### Added

- Builder-first generated app runtime: prompt-to-app now writes a real React/Vite source workspace to `data/generated-apps/<workspace>/<app>/workspace`.
- Generated app preview route at `/api/app/generated-apps/:appId/preview`, including nested source and asset serving from the generated workspace.
- Generated source manifest with file hashes, byte counts, workspace path, app slug, checkpoint ID, and source file summaries.
- Source-diff iteration flow that compares previous and candidate generated files before applying scoped app changes.
- Rollback support that restores checkpoint source artifacts instead of regenerating unrelated source metadata.
- Local publish handoff that materializes generated bundles, runtime config, artifact manifests, and Taskloom-served preview URLs.
- Builder UI support for generated source file summaries, workspace metadata, publish handoff copy, and clearer preview status.
- OSS launch basics: MIT license, security policy, `.env.example`, Dockerfile, and Docker Compose starter.
- Production startup hardening for security-sensitive settings and clearer local/development defaults.

### Changed

- README now positions Taskloom as a self-hosted app and agent workbench with explicit local preview and publish-handoff limits.
- Builder copy now distinguishes saved local previews from public deployments.
- Generated runtime output and publish exports are ignored by git to keep local build artifacts out of commits.

### Fixed

- Provider/tool readiness now fails loudly for missing required setup instead of implying a real run happened.
- Agent dry-run paths are labelled explicitly.
- Publish validation now blocks missing generated bundle/workspace artifacts.
- Generated preview routes resolve actual app IDs, slugs, checkpoints, and nested files instead of relying on placeholder preview paths.

## [0.1.0] - In development

Initial public development line for the Taskloom self-hosted app and agent workbench.

### Included

- Prompt-to-agent and prompt-to-app builder flows.
- App drafts, checkpoints, scoped iteration, local preview, smoke checks, and publish handoff.
- Agent templates, runs, transcripts, tool-call timeline, jobs, schedules, webhooks, secrets, audit, RBAC, and sandbox surfaces.
- JSON store for contributor flow, SQLite for single-node installs, and managed Postgres support behind explicit startup gates.
- React workbench, Hono API, and Node 22 runtime.
