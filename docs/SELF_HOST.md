# Self-Host Setup Guide

Taskloom runs as a single Node process. This guide takes you from `git clone` to "I built an app with my own LLM key and ran the generated bundle on my own machine." It is the canonical setup path for Fork B (self-host first).

If you want the strategic background on what self-host *intentionally* gives up versus hosted competitors, see [CLOUD.md](../CLOUD.md).

---

## Prerequisites

- **Node.js 22.5.0 or later.** Taskloom uses native `tsx` imports and modern ESM features. Check with `node --version`. Use `nvm`, `fnm`, or `volta` if you need to manage multiple versions.
- **npm 10+** (ships with Node 22).
- **OS.** Linux, macOS, or Windows. Tested on Ubuntu 22.04+, macOS 13+, and Windows 11 with PowerShell 7+. WSL2 is also supported and recommended on Windows for the Docker sandbox path.
- **Disk.** ~500 MB for `node_modules`, plus space for generated app workspaces and SQLite data under `data/`. Budget at least 2 GB free.
- **Memory.** ~512 MB resident for the API process, ~512 MB for the Vite dev server, plus whatever the sandbox uses when active.
- **Docker** (optional but recommended). Required for the secure sandbox runtime and for running generated apps from the publish handoff. Without Docker, the sandbox falls back to a `native` host-process driver that is clearly marked **insecure** in the UI.

---

## 5-Minute Quick Start

```bash
git clone https://github.com/packetloss404/taskloom.git
cd taskloom
npm install
npm run dev
```

Open **http://localhost:7341** in your browser.

Sign in with the seeded developer account:

- Email: `alpha@taskloom.local`
- Password: `demo12345`

You are now in the workbench. The sidebar collapses to four items — Build, Projects, Runs, Admin — and sixteen operator surfaces (Roles, SSO, Secrets, Rate limits, Webhooks, Releases, Storage, Backups, Notifications, Operations, Integrations, Activation, Sandbox, Workflows, Billing, Alerts) live as tabs under `/admin/:tab`. Back-compat redirects mean old per-page URLs still work.

Go to `/builder` (a full-bleed route outside the workbench Shell), choose **Build an app**, and try a starter prompt like `Build a lightweight CRM for renewal tracking`.

**That is the full local loop.** No account creation, no email verification, no credit card. The two processes that started are:

| Port | Process | Purpose |
| ---- | ------- | ------- |
| `7341` | Vite (web) | React workbench UI, proxies `/api/*` to the API |
| `8484` | Hono (api) | REST + SSE endpoints, jobs scheduler, sandbox |

If port `7341` or `8484` is already in use, see the troubleshooting section below.

To reset local data back to the seed state at any time, stop the dev server and run `npm run store:reset`.

---

## Configure your LLM key (the Fork B step)

Taskloom does not ship with a bundled LLM key. You bring your own — this is the central tradeoff of Fork B. Without a key, the builder falls back to **template-only generation**: deterministic, no LLM round-trip, useful for verifying the workbench is wired up but not for producing real apps from open-ended prompts.

### What is wired in today

Honest snapshot of where multi-provider BYOK actually stands:

- **Builder draft + iteration**: Anthropic only. Both `generateAppDraftViaLLM` and `applyAppIterationViaLLM` call `AnthropicProvider` directly. Setting only `OPENAI_API_KEY`, `OLLAMA_BASE_URL`, or `MINIMAX_API_KEY` will not make the builder use those providers yet — the builder will use template-only fallback.
- **Agent runs**: All configured providers (Anthropic, OpenAI, MiniMax, Ollama) route through `ProviderRouter` and are switchable per agent.
- **Planned**: Routing the builder draft path through `ProviderRouter` with a local-first preset map. This is [Phase 3 Track A](PHASE3_SCOPE.md). Gemini and OpenRouter adapters are scheduled for Phase 3.5.

So today, if your goal is to drive the builder with an LLM, set `ANTHROPIC_API_KEY`. The other variables below are documented because the agent surface uses them and because the builder will catch up to them.

### Where to put the key

You can configure keys two ways:

1. **Per-workspace in the workbench** (recommended for most users). Open **Admin → Integrations** in the workbench. Paste your key. It is stored in the encrypted secrets vault (AES-256-GCM at rest), never logged, never sent anywhere except to the LLM provider you selected.
2. **As environment variables at startup** (useful for headless installs or Docker Compose). Copy `.env.example` to `.env` and set the variables below.

Configure **only the providers you actually use**. You do not need all of them.

### Option A — Anthropic Claude (today's full path)

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at https://console.anthropic.com. The default model Taskloom targets is `claude-sonnet-4-6` — a good balance of cost, latency, and quality for builder workloads. For more demanding multi-turn agent work, switch per-agent to `claude-opus-4-7` under **Admin → Integrations**.

Reference: https://docs.claude.com/en/api

### Option B — OpenAI (agent runs today; builder pending)

```bash
# .env
OPENAI_API_KEY=sk-...
```

Get a key at https://platform.openai.com/api-keys. Default model is `gpt-4o`; switch per-agent under **Admin → Integrations**. Note: this key is not yet consumed by the builder draft path — set `ANTHROPIC_API_KEY` if you want the builder to call an LLM today.

### Option C — Local LLM (Ollama / vLLM / LM Studio / remote llama.cpp)

The "ollama" provider is intentionally generic: it can talk to **any OpenAI-compatible local LLM server**, on `localhost` or on a separate machine on your LAN (think: a beefy GPU box). It is registered unconditionally — but it is **not the default** for hosted presets. Anthropic / OpenAI / Gemini / OpenRouter take precedence unless you (a) explicitly request the `local` preset, or (b) set `TASKLOOM_PROVIDER_PRIORITY=ollama,...`.

Three env vars control where requests go and how they're shaped:

| Env var | Default | Purpose |
| --- | --- | --- |
| `LOCAL_LLM_BASE_URL` | unset | Base URL of the local LLM server. Takes precedence over `OLLAMA_BASE_URL`. Use this for non-Ollama servers (vLLM, LM Studio, llama.cpp) — it documents intent. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Legacy synonym for `LOCAL_LLM_BASE_URL`. Honored when `LOCAL_LLM_BASE_URL` is unset. |
| `LOCAL_LLM_API_FORMAT` | `ollama` | Either `ollama` (native `/api/chat`) or `openai` (`/v1/chat/completions`). Set to `openai` for vLLM, LM Studio, and llama.cpp's OpenAI-compat server. |
| `LOCAL_LLM_MODEL` | unset | Overrides the per-call model name. Useful when the remote server only loads one specific model. |

**Recipe 1: Local Ollama (zero config).** No env needed; Taskloom hits `http://localhost:11434` by default.

```bash
ollama pull qwen2.5-coder:32b
# Taskloom will pick this up automatically when the `local` preset is selected.
```

**Recipe 2: Remote Ollama on another box (same LAN).**

```bash
# .env
OLLAMA_BASE_URL=http://192.168.1.100:11434
```

Run Ollama on the GPU box with `OLLAMA_HOST=0.0.0.0:11434 ollama serve` so it binds to the LAN interface, not just localhost.

**Recipe 3: vLLM on a remote GPU machine.**

```bash
# .env
LOCAL_LLM_BASE_URL=http://gpu-box:8000
LOCAL_LLM_API_FORMAT=openai
LOCAL_LLM_MODEL=qwen2.5-coder-32b-instruct
```

Start vLLM with e.g. `vllm serve Qwen/Qwen2.5-Coder-32B-Instruct --host 0.0.0.0 --port 8000`. `LOCAL_LLM_MODEL` is required because vLLM only serves the one model that was loaded at startup, and its OpenAI-compat layer matches model names strictly.

**Recipe 4: LM Studio (local app on a developer laptop).**

```bash
# .env
LOCAL_LLM_BASE_URL=http://localhost:1234
LOCAL_LLM_API_FORMAT=openai
```

In LM Studio, load a model and start the "Local Server" tab. Default port is `1234`. LM Studio exposes the OpenAI-compatible API.

**Recipe 5: llama.cpp's OpenAI-compatible server.**

```bash
# .env
LOCAL_LLM_BASE_URL=http://localhost:8080
LOCAL_LLM_API_FORMAT=openai
LOCAL_LLM_MODEL=deepseek-coder-v2
```

Run llama.cpp with `./llama-server -m deepseek-coder-v2.gguf --port 8080 --host 0.0.0.0`. Same caveat as vLLM: set `LOCAL_LLM_MODEL` to whatever name your server reports.

**Quality caveat.** Smaller local models (7B–13B) produce noticeably worse generated apps than Claude / GPT-4-class hosted models. For real builder workloads on local hardware, plan to run `qwen2.5-coder:32b` or larger. The Phase 3 plan calls out `qwen3-coder-next` (80B MoE, 3B active) as the local sweet spot once the builder is routed through `ProviderRouter`.

**Making local first.** To force every preset that supports it to prefer your local server over hosted providers (e.g. when you want the 1.5 TB RAM farm to do everything):

```bash
TASKLOOM_PROVIDER_PRIORITY=ollama,anthropic,openai
```

Otherwise, the `local` Builder preset is the explicit knob — it routes only to the local provider and returns null (template-only fallback) if `LOCAL_LLM_BASE_URL` and `OLLAMA_BASE_URL` are both unset and `localhost:11434` is unreachable.

As with OpenAI: the local provider works today for agent runs but is not yet wired into the builder draft path.

### Option D — No key (template-only fallback)

If no provider key is set, the builder falls back to deterministic template-only generation. This is fine for:

- Verifying the workbench is wired up end-to-end.
- Running the sandbox and publish handoff against the bundled CRM template.
- CI / smoke tests that should not consume LLM tokens.

It is **not** sufficient for producing real apps from open-ended prompts — the LLM step is what turns "build a lightweight CRM for renewal tracking" into a tailored brief, plan, and source files.

### MiniMax (optional, additional provider for agents)

```bash
# .env
MINIMAX_API_KEY=...
```

Configured the same way as Anthropic / OpenAI, and similarly available to agent runs but not yet to the builder. Used by some agent templates that want a non-Anthropic, non-OpenAI option.

---

## Deploy your generated app

When you click **Publish handoff** in the builder, Taskloom produces a local package — not a hosted deployment. The package lands under:

```
data/generated-apps/<workspace>/<app>/workspace/
```

It contains the generated React/Vite source files, a `package.json`, a seed schema, an API helper, a migration starter, and a Docker-Compose-ready bundle. The publish handoff panel surfaces the path, the artifact manifest, the smoke-check results, and rollback metadata.

**To run a published app locally:**

```bash
cd data/generated-apps/<workspace>/<app>/workspace
docker compose up
```

The generated app exposes its own health endpoint and serves on its own port (defined in the generated `docker-compose.yml`). Open the port shown in the publish handoff panel — by default it's a free port allocated at generation time, not a hard-coded one.

**To deploy to your own infrastructure:**

The generated bundle is a normal Node app. You can:

- `scp` or `rsync` it to a VPS and run `docker compose up -d` there.
- Push it to a registry and deploy via Kubernetes / Fly Machines / Cloud Run / your own orchestrator.
- Wrap it in your existing CI / CD pipeline — there is nothing Taskloom-specific in the generated artifacts.

DNS, TLS, reverse-proxy, and public URL configuration are your responsibility. The README's **Self-Host Publish** notes link to a reverse-proxy example for local-network / VPN deployment. The tradeoff: you own the URL and the certificate, end-to-end, with no vendor in the path.

For hosted-only conveniences Taskloom does not ship (free public subdomain, auto TLS, managed App Store submission, hosted OAuth proxy), see [CLOUD.md](../CLOUD.md) for the full deferred-features inventory.

---

## Troubleshooting

### "No API key configured" / builder produces only template output

The builder fell back to template-only generation because it could not find an Anthropic LLM key. Check, in order:

1. Open **Admin → Integrations** in the workbench. Is `ANTHROPIC_API_KEY` configured? Other provider keys (OpenAI, Ollama, MiniMax) are accepted but not yet consumed by the builder draft path — see "What is wired in today" above.
2. If you set the key via `.env`, did you restart `npm run dev` after editing the file? `.env` is read at process startup, not on every request.
3. Test the key directly: `curl -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" https://api.anthropic.com/v1/messages -d '{"model":"claude-sonnet-4-6","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'`. If this fails, the problem is the key or the provider, not Taskloom.

### Port collision (`EADDRINUSE` on 7341 or 8484)

Another process is already bound to one of Taskloom's ports.

- Find what's using the port (Linux/macOS): `lsof -i :7341` or `lsof -i :8484`.
- Find what's using the port (Windows PowerShell): `Get-NetTCPConnection -LocalPort 7341` or `Get-NetTCPConnection -LocalPort 8484`.
- Either stop the conflicting process, or override Taskloom's API port: `PORT=9090 npm run dev`. The Vite dev port is set in `web/vite.config.ts` if you need to change it.

### Missing native deps on `npm install` (`better-sqlite3`, `playwright`)

Some optional dependencies build native code. If `npm install` fails:

- On Linux, ensure `build-essential`, `python3`, and `make` are installed (`sudo apt install build-essential python3`).
- On macOS, ensure Xcode Command Line Tools are installed (`xcode-select --install`).
- On Windows, install the Visual Studio Build Tools (the `Desktop development with C++` workload) or use WSL2.
- For Playwright specifically, after install run `npx playwright install chromium` to fetch the browser binary.

### Generated app preview shows a blank page

The generated app is served from disk through the API at `/api/app/generated-apps/:appId/preview`. If the preview is blank:

1. Check the **Generated source** tab — are files actually written under `data/generated-apps/...`?
2. Open the browser devtools network tab and check for 404s or CORS errors on `/api/app/generated-apps/:appId/preview/...`.
3. If smoke checks failed, the publish handoff panel will list which checks blocked the preview; rerun them after fixing the underlying issue.

### Docker sandbox not available

The sandbox runtime defaults to `docker`. If Docker is not installed or not running:

- The workbench Sandbox panel will show `Docker not available`.
- You can switch to the `native` host-process driver with `TASKLOOM_SANDBOX_DRIVER=native` plus `TASKLOOM_ALLOW_INSECURE_NATIVE_SANDBOX=true`. **This runs sandbox commands as the host user with no isolation.** Only do this on a trusted dev machine.
- For production, install Docker Desktop (macOS/Windows) or `docker-ce` (Linux), confirm `docker ps` works for your user, and restart Taskloom.

### Reset everything

```bash
npm run store:reset   # JSON store
# or
npm run db:reset      # SQLite store
```

Both stop short of deleting generated app workspaces under `data/generated-apps/`. Remove that directory manually if you want a fully clean slate.

---

## What's next

- Read [PHASE3_SCOPE.md](PHASE3_SCOPE.md) for the next planned chunk of work: multi-provider BYOK at the builder, file-tree codegen, real per-app SQLite runtime, a fuller agent tool catalog, and cross-cutting security hardening.
- Read [CLOUD.md](../CLOUD.md) to understand what self-host intentionally does not do, and what a hypothetical Taskloom Cloud product would have to own.
- Read [BACKLOG.md](../BACKLOG.md) for the in-flight self-host improvements and the "Done in this pass" / "Still planned" split.
- Read [dev/TESTING.md](../dev/TESTING.md) for local verification and release checks.
- Open an issue at https://github.com/packetloss404/taskloom/issues if your setup hit something this guide does not cover.
