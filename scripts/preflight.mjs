#!/usr/bin/env node
// Preflight check: verify Node version and that at least one AI provider is
// configured. Exits non-zero with a friendly message if anything is missing so
// the wrapper scripts can stop before launching the dev server.

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function line(s = "") {
  process.stdout.write(s + "\n");
}

function errLine(s = "") {
  process.stderr.write(s + "\n");
}

// ---------------------------------------------------------------------------
// 1. Node version check.
// ---------------------------------------------------------------------------

const REQUIRED_MAJOR = 22;
const nodeVersion = process.versions.node;
const major = Number.parseInt(nodeVersion.split(".")[0] ?? "0", 10);

if (!Number.isFinite(major) || major < REQUIRED_MAJOR) {
  errLine(`${RED}${BOLD}Node ${REQUIRED_MAJOR} or newer is required.${RESET}`);
  errLine(`${DIM}You're running Node ${nodeVersion}.${RESET}`);
  errLine("");
  errLine("Install the latest LTS from https://nodejs.org/ and try again.");
  errLine("If you use nvm:  nvm install 22 && nvm use 22");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. AI provider check.
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { env: "ANTHROPIC_API_KEY", name: "Anthropic" },
  { env: "OPENAI_API_KEY", name: "OpenAI" },
  { env: "GOOGLE_API_KEY", name: "Google" },
  { env: "GEMINI_API_KEY", name: "Gemini" },
  { env: "OPENROUTER_API_KEY", name: "OpenRouter" },
  { env: "MINIMAX_API_KEY", name: "MiniMax" },
  { env: "OLLAMA_BASE_URL", name: "Ollama (local)" },
  { env: "LOCAL_LLM_BASE_URL", name: "Local LLM" },
];

const detected = PROVIDERS.filter((p) => {
  const value = process.env[p.env];
  return typeof value === "string" && value.trim().length > 0;
});

if (detected.length === 0) {
  errLine(`${YELLOW}${BOLD}No AI provider configured.${RESET}`);
  errLine(
    "Taskloom needs at least one to generate apps. Three easy options:",
  );
  errLine("");
  errLine(`  ${BOLD}(a) Anthropic${RESET} ${DIM}— recommended${RESET}`);
  errLine(
    `      Copy this line into a file named ${CYAN}.env${RESET} in this folder:`,
  );
  errLine(`        ${GREEN}ANTHROPIC_API_KEY=sk-ant-...${RESET}`);
  errLine(`      Get a key at ${CYAN}https://console.anthropic.com/${RESET}`);
  errLine("");
  errLine(`  ${BOLD}(b) OpenAI${RESET}`);
  errLine(
    `      Copy this line into a file named ${CYAN}.env${RESET} in this folder:`,
  );
  errLine(`        ${GREEN}OPENAI_API_KEY=sk-...${RESET}`);
  errLine(`      Get a key at ${CYAN}https://platform.openai.com/${RESET}`);
  errLine("");
  errLine(`  ${BOLD}(c) Local Ollama${RESET} ${DIM}— free, no key needed${RESET}`);
  errLine(`      Install from ${CYAN}https://ollama.com${RESET}`);
  errLine(`      Then run:  ${GREEN}ollama serve${RESET}`);
  errLine(
    `      And add this line to ${CYAN}.env${RESET}:  ${GREEN}OLLAMA_BASE_URL=http://localhost:11434${RESET}`,
  );
  errLine("");
  errLine(
    `${DIM}Tip: there's an ${RESET}${CYAN}.env.example${RESET}${DIM} file you can copy to ${RESET}${CYAN}.env${RESET}${DIM} to start.${RESET}`,
  );
  process.exit(1);
}

const primary = detected[0];
line(
  `${GREEN}Detected provider: ${BOLD}${primary.name}${RESET}${GREEN}. Starting Taskloom...${RESET}`,
);
if (detected.length > 1) {
  const extras = detected.slice(1).map((p) => p.name).join(", ");
  line(`${DIM}(also configured: ${extras})${RESET}`);
}

process.exit(0);
