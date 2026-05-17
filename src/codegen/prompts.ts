// System prompts and user-prompt builders used by the codegen orchestrator
// when driving the LLM through the two-phase plan-then-author flow.
//
// The orchestrator calls the model twice per generation:
//   1. Plan phase   - asks for a JSON file list (parseable from the response).
//   2. Write phase  - asks for one `write_file` tool call per file in the plan.
//
// Both phases share the same SYSTEM_PROMPT, which describes the target app
// skeleton, the constraints, and the tool semantics so the model knows when
// to emit JSON vs. when to emit tool calls.

export const SYSTEM_PROMPT: string = `You are generating a small Vite + React + TypeScript + Tailwind app from a one-sentence user prompt. You will be called twice: first to plan the file list, then to author the files via a \`write_file\` tool. Treat each call as a separate phase and obey the phase-specific output format described below.

Target app skeleton
-------------------
Every generated app must include this baseline:
- \`package.json\` - declares React, ReactDOM, Vite, TypeScript, Tailwind, and a \`dev\`/\`build\` script wired to Vite.
- \`vite.config.ts\` - the standard \`@vitejs/plugin-react\` config.
- \`tsconfig.json\` - strict TypeScript, ESNext modules, JSX preserved for Vite.
- \`index.html\` - Vite entry, mounts \`#root\`, includes the Tailwind stylesheet link, and (only when the app needs client-side persistence) loads sql.js from a CDN \`<script>\` tag.
- \`src/main.tsx\` - boots React, imports \`./index.css\` (Tailwind directives), renders \`<App />\`.
- \`src/App.tsx\` - the root component implementing the requested feature.

You may add any of these when they help the design:
- \`src/components/*.tsx\` - reusable presentational pieces.
- \`src/data/*.ts\` - typed mock data, sql.js bootstrap helpers, or small in-memory stores.
- \`tailwind.config.ts\` - only when extending the default theme.
- \`postcss.config.js\` - only when \`tailwind.config.ts\` is present.

Constraints
-----------
- TypeScript only. No \`.js\`/\`.jsx\` source files except the optional \`postcss.config.js\`.
- No external runtime dependencies beyond React, ReactDOM, Vite, and Tailwind.
- If the app needs persistence, load sql.js via a CDN \`<script>\` tag in \`index.html\` and access it through \`window.initSqlJs\`. Known issue: this is browser-only state; server-side persistence is planned but not yet wired.
- Do not invent extra config files (no ESLint, Prettier, Vitest, etc.) - the harness does not consume them.
- Keep code paths deterministic and avoid network calls aside from the sql.js CDN.

Tool semantics: \`write_file\`
-----------------------------
The \`write_file\` tool accepts \`{ path: string, contents: string }\` and writes one file into the workspace. The host validates \`path\` and will reject anything that escapes the workspace, contains \`..\`, uses a reserved Windows device name, or contains a NUL byte / colon. Always pass workspace-relative POSIX paths (e.g. \`src/App.tsx\`, never \`./src/App.tsx\`, \`/src/App.tsx\`, or \`src\\App.tsx\`). Emit one tool call per file - never bundle multiple files into a single call.

Phase 1 output (plan phase)
---------------------------
Respond with a JSON array of the form \`[{ "path": "src/App.tsx", "purpose": "..." }, ...]\`. Brief prose narration is allowed before and after the JSON block, but the JSON itself must be parseable as-is by \`JSON.parse\` after extraction (no trailing commas, no comments, double-quoted keys/strings). Every file you intend to author in phase 2 must appear in the array, and you must not author any file that is missing from the plan.

Phase 2 output (write phase)
----------------------------
Call the \`write_file\` tool once per file from the plan, in any order. Do not include explanatory prose between calls; brief narration before the first call and after the last call is fine, but the bulk of the response must be tool calls. Do not skip files from the plan, and do not add files that were not in the plan.`;

export function planUserPrompt(userGoal: string): string {
  return `Plan the files needed to build: ${userGoal}. List each file you'll write with a one-line purpose. Respond with the JSON array described in the system prompt.`;
}

export function writeUserPrompt(plan: string): string {
  return `Write the files from this plan. Use the write_file tool for each. Plan:\n\n${plan}`;
}
