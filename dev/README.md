# Taskloom dev/

Documentation for people working on Taskloom — self-hosters running a node, contributors changing the code, and release engineers cutting builds. The top-level [README](../README.md) covers product positioning and a five-line quick start; everything past that lives here.

## What's in here

| Path | Audience | Purpose |
| ---- | -------- | ------- |
| [`roadmap.md`](roadmap.md) | Everyone | Current state and what's next. No commitments — priority is set by issue activity. |
| [`TESTING.md`](TESTING.md) | Release | Manual end-to-end smoke playbook run before tagging a release. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contributors | Onboarding: clone, run, test, conventions, PR flow. |
| [`deployment/`](deployment/) | Self-hosters | Operator and self-host guides — `README.md`, `persistence.md`, `security.md`, `operations.md`, `email.md`, plus `examples/`. |
| [`architecture/`](architecture/) | Contributors | Design notes — `activation.md` and other subsystem write-ups. |

## For self-hosters

Start with the [top-level README quick start](../README.md#quick-start) to get a node running locally, then move to [`deployment/README.md`](deployment/README.md) for the operator guide. The deployment directory covers data durability, hardening, day-two operations, email delivery, and worked examples for common topologies.

## For contributors

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first — it covers cloning, running the dev server, the test commands, and the conventions the codebase already follows. Once a change touches more than one subsystem, [`architecture/`](architecture/) has the design notes you'll want before opening a PR.

Issues and discussion live on GitHub: <https://github.com/packetloss404/taskloom/issues>.

## For releases

Before tagging, run the manual smoke playbook in [`TESTING.md`](TESTING.md) against a freshly seeded local node. [`roadmap.md`](roadmap.md) is the public-facing summary of what's landed and what's next; update it when work meaningfully changes the product surface.

## Conventions

- All docs are markdown, ASCII-only, no emojis.
- Cross-references use `dev/`-relative paths (e.g. `[Persistence](deployment/persistence.md)`).
- Code fences are tagged (`bash`, `ts`, `json`).
- Headings stop at H2 within a page; H3 only when a single page genuinely needs three levels.
