import { test } from "node:test";
import assert from "node:assert/strict";
import { ProviderRouter } from "../providers/router.js";
import type {
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
  ProviderName,
  ProviderStreamChunk,
} from "../providers/types.js";
import {
  authorAppViaLLM,
  isSafePath,
  parsePlan,
  type ResolvedPrompts,
} from "./llm-author.js";

// ---------------------------------------------------------------------------
// Mock provider scaffolding
// ---------------------------------------------------------------------------
//
// Each scripted "turn" is a sequence of stream chunks that the mock provider
// will replay on the corresponding `stream()` call. Tests build a list of
// turns and pass them in; the orchestrator runs the plan phase (turn 0,
// possibly turn 1 on retry) and then the write phase (next turn).
// ---------------------------------------------------------------------------

type ScriptedChunk = ProviderStreamChunk;
type ScriptedTurn = ScriptedChunk[];

interface MockProviderOptions {
  name?: ProviderName;
  turns: ScriptedTurn[];
  /** Throw from `stream()` itself on the Nth call. */
  throwAtCall?: number;
}

class MockProvider implements LLMProvider {
  name: ProviderName;
  private turns: ScriptedTurn[];
  private throwAtCall: number | undefined;
  public calls: Array<{ tools: string[]; messages: ProviderCallOptions["messages"]; model: string }> = [];

  constructor(opts: MockProviderOptions) {
    this.name = opts.name ?? "stub";
    this.turns = opts.turns;
    this.throwAtCall = opts.throwAtCall;
  }

  async call(opts: ProviderCallOptions): Promise<ProviderCallResult> {
    return {
      content: "",
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
      model: opts.model,
      providerName: this.name,
    };
  }

  stream(opts: ProviderCallOptions): AsyncIterable<ProviderStreamChunk> {
    const callIndex = this.calls.length;
    this.calls.push({
      tools: (opts.tools ?? []).map((t) => t.name),
      messages: opts.messages,
      model: opts.model,
    });
    if (this.throwAtCall === callIndex) {
      throw new Error("mock provider exploded");
    }
    const turn = this.turns[callIndex] ?? [];
    async function* gen() {
      for (const chunk of turn) yield chunk;
    }
    return gen();
  }

  async models(): Promise<string[]> {
    return [];
  }
}

function makeRouterWithProvider(provider: MockProvider): ProviderRouter {
  const router = new ProviderRouter({
    "code.generation": { provider: provider.name, model: "mock-model" },
  });
  router.register(provider.name, provider);
  return router;
}

function fixedPrompts(): ResolvedPrompts {
  return {
    systemPrompt: "SYS",
    planUserPrompt: (goal: string) => `PLAN: ${goal}`,
    writeUserPrompt: (plan: string) => `WRITE: ${plan}`,
  };
}

function planJson(plan: Array<{ path: string; purpose: string }>): string {
  return "Here is the plan:\n\n```json\n" + JSON.stringify(plan) + "\n```";
}

// ---------------------------------------------------------------------------
// Original env capture so tests don't mutate provider resolution globally.
// ---------------------------------------------------------------------------

const ORIGINAL_ANTHROPIC = process.env.ANTHROPIC_API_KEY;

function withFakeAnthropicKey<T>(fn: () => T): T {
  process.env.ANTHROPIC_API_KEY = "test";
  try {
    return fn();
  } finally {
    if (ORIGINAL_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
  }
}

// ---------------------------------------------------------------------------
// parsePlan + isSafePath unit smoke
// ---------------------------------------------------------------------------

test("parsePlan: accepts fenced JSON block with {path, purpose} entries", () => {
  const blob =
    "I'll create three files.\n\n```json\n" +
    JSON.stringify([
      { path: "src/App.tsx", purpose: "root" },
      { path: "src/main.tsx", purpose: "entry" },
    ]) +
    "\n```";
  const parsed = parsePlan(blob);
  assert.ok(parsed);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.path, "src/App.tsx");
});

test("parsePlan: returns null when nothing parses", () => {
  assert.equal(parsePlan("no plan here"), null);
  assert.equal(parsePlan("```json\n{not valid json\n```"), null);
});

test("isSafePath: rejects absolute paths, .. and empty input", () => {
  assert.equal(isSafePath("src/App.tsx"), true);
  assert.equal(isSafePath("a/b/c.ts"), true);
  assert.equal(isSafePath(""), false);
  assert.equal(isSafePath("/etc/passwd"), false);
  assert.equal(isSafePath("C:/Windows/system32"), false);
  assert.equal(isSafePath("../escape"), false);
  assert.equal(isSafePath("src/../../escape"), false);
});

// ---------------------------------------------------------------------------
// authorAppViaLLM: happy path
// ---------------------------------------------------------------------------

test("authorAppViaLLM: plan phase emits prose then write phase yields files", async () => {
  await withFakeAnthropicKey(async () => {
    const plan = [
      { path: "src/App.tsx", purpose: "root component" },
      { path: "src/main.tsx", purpose: "entry point" },
    ];
    const provider = new MockProvider({
      name: "anthropic",
      turns: [
        // Plan phase: stream prose containing a JSON block.
        [
          { delta: "Planning... " },
          { delta: planJson(plan) },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
        // Write phase: stream a tiny prose line then two tool calls.
        [
          { delta: "Writing files." },
          {
            toolCall: {
              id: "t1",
              name: "write_file",
              input: { path: "src/App.tsx", content: "export default function App() {}\n" },
            },
          },
          {
            toolCall: {
              id: "t2",
              name: "write_file",
              input: { path: "src/main.tsx", content: "import App from './App'\n" },
            },
          },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
      ],
    });
    const router = makeRouterWithProvider(provider);

    const emitted: string[] = [];
    const result = await authorAppViaLLM(
      "build a counter",
      {
        workspaceId: "w",
        preset: "fast",
        router,
        resolvePrompts: fixedPrompts,
      },
      (chunk) => {
        emitted.push(chunk);
      },
    );

    assert.ok(result, "expected non-null result");
    assert.equal(result.source, "llm");
    assert.equal(result.files.length, 2);
    assert.equal(result.files[0]?.path, "src/App.tsx");
    assert.equal(result.files[1]?.path, "src/main.tsx");
    assert.match(result.summary, /LLM-authored/);
    // Prose from both phases reached the emit callback.
    const joined = emitted.join("");
    assert.match(joined, /Planning\.\.\./);
    assert.match(joined, /Writing files\./);
    // Write-phase call included the write_file tool definition.
    assert.equal(provider.calls.length, 2);
    assert.deepEqual(provider.calls[1]?.tools, ["write_file"]);
  });
});

// ---------------------------------------------------------------------------
// authorAppViaLLM: failure modes
// ---------------------------------------------------------------------------

test("authorAppViaLLM: returns null when the plan phase errors", async () => {
  await withFakeAnthropicKey(async () => {
    const provider = new MockProvider({
      name: "anthropic",
      turns: [[{ error: "boom" }]],
    });
    const router = makeRouterWithProvider(provider);
    const result = await authorAppViaLLM(
      "anything",
      { workspaceId: "w", preset: "fast", router, resolvePrompts: fixedPrompts },
      () => {},
    );
    assert.equal(result, null);
  });
});

test("authorAppViaLLM: returns null when zero write_file calls are emitted", async () => {
  await withFakeAnthropicKey(async () => {
    const plan = [{ path: "src/App.tsx", purpose: "root" }];
    const provider = new MockProvider({
      name: "anthropic",
      turns: [
        [
          { delta: planJson(plan) },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
        // Write phase: prose only, no tool calls.
        [
          { delta: "I'll think about it." },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
      ],
    });
    const router = makeRouterWithProvider(provider);
    const result = await authorAppViaLLM(
      "build something",
      { workspaceId: "w", preset: "fast", router, resolvePrompts: fixedPrompts },
      () => {},
    );
    assert.equal(result, null);
  });
});

test("authorAppViaLLM: invalid paths are skipped, not aborted", async () => {
  await withFakeAnthropicKey(async () => {
    const plan = [
      { path: "src/App.tsx", purpose: "root" },
      { path: "../escape.ts", purpose: "should be rejected" },
    ];
    const provider = new MockProvider({
      name: "anthropic",
      turns: [
        [
          { delta: planJson(plan) },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
        [
          {
            toolCall: {
              id: "ok",
              name: "write_file",
              input: { path: "src/App.tsx", content: "// ok\n" },
            },
          },
          {
            toolCall: {
              id: "bad",
              name: "write_file",
              input: { path: "../escape.ts", content: "// nope\n" },
            },
          },
          {
            toolCall: {
              id: "abs",
              name: "write_file",
              input: { path: "/etc/passwd", content: "// nope\n" },
            },
          },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
      ],
    });
    const router = makeRouterWithProvider(provider);
    const result = await authorAppViaLLM(
      "build app",
      { workspaceId: "w", preset: "fast", router, resolvePrompts: fixedPrompts },
      () => {},
    );
    assert.ok(result);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0]?.path, "src/App.tsx");
  });
});

test("authorAppViaLLM: retries once when the plan is unparseable, returns null after second failure", async () => {
  await withFakeAnthropicKey(async () => {
    const provider = new MockProvider({
      name: "anthropic",
      turns: [
        // First plan attempt: prose with no JSON.
        [
          { delta: "Hmm, here is a plan in plain words." },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
        // Retry attempt: still no JSON.
        [
          { delta: "Still not JSON." },
          { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
        ],
      ],
    });
    const router = makeRouterWithProvider(provider);
    const result = await authorAppViaLLM(
      "build app",
      { workspaceId: "w", preset: "fast", router, resolvePrompts: fixedPrompts },
      () => {},
    );
    assert.equal(result, null);
    // Should have attempted the plan phase twice (no write phase).
    assert.equal(provider.calls.length, 2);
    // Neither call included the write_file tool.
    assert.deepEqual(provider.calls[0]?.tools, []);
    assert.deepEqual(provider.calls[1]?.tools, []);
  });
});

test("authorAppViaLLM: preset routes through the registered provider", async () => {
  // Resolve `local` preset → only ollama is acceptable. Register ollama as
  // the mock and confirm the orchestrator calls it (rather than failing or
  // hitting a different provider).
  const provider = new MockProvider({
    name: "ollama",
    turns: [
      [
        {
          delta: planJson([{ path: "src/App.tsx", purpose: "root" }]),
        },
        { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
      ],
      [
        {
          toolCall: {
            id: "t1",
            name: "write_file",
            input: { path: "src/App.tsx", content: "// ok\n" },
          },
        },
        { done: true, usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } },
      ],
    ],
  });
  const router = makeRouterWithProvider(provider);
  const result = await authorAppViaLLM(
    "local app",
    { workspaceId: "w", preset: "local", router, resolvePrompts: fixedPrompts },
    () => {},
  );
  assert.ok(result);
  assert.equal(provider.calls[0]?.model, "qwen2.5-coder:32b");
});
