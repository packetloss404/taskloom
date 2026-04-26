import { useRef, useState } from "react";
import { Loader2, Send, Square } from "lucide-react";
import { streamLLM, type StreamHandle } from "@/lib/llm-stream";

export default function StreamingTextDemo() {
  const [prompt, setPrompt] = useState("Summarize Taskloom in two sentences.");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<StreamHandle | null>(null);

  function start() {
    setOutput("");
    setError(null);
    setStreaming(true);
    handleRef.current = streamLLM(
      { routeKey: "agent.summary", messages: [{ role: "user", content: prompt }] },
      {
        onDelta: (delta) => setOutput((current) => current + delta),
        onError: (msg) => { setError(msg); setStreaming(false); },
        onDone: () => setStreaming(false),
      },
    );
  }

  async function cancel() {
    await handleRef.current?.cancel();
    setStreaming(false);
  }

  return (
    <section className="card p-6">
      <header className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">LLM Stream Test</h2>
        <p className="mt-1 text-xs text-ink-500">
          Verifies the SSE pipeline end to end. Without provider API keys configured, this returns a deterministic stub stream.
        </p>
      </header>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        className="workflow-input w-full resize-none"
        placeholder="Prompt..."
      />
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn-primary" onClick={start} disabled={streaming || prompt.trim().length === 0}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Stream
        </button>
        <button type="button" className="btn-ghost" onClick={cancel} disabled={!streaming}>
          <Square className="h-4 w-4" /> Cancel
        </button>
      </div>
      {error && <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
      <pre className="mt-4 max-h-72 min-h-[6rem] overflow-y-auto whitespace-pre-wrap rounded-xl border border-ink-800/80 bg-ink-950/40 p-3 text-xs text-ink-200">{output || (streaming ? "…" : "Output will appear here.")}</pre>
    </section>
  );
}
