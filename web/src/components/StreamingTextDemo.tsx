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

  const statusLabel = error ? "ERROR" : streaming ? "STREAMING…" : output ? "READY" : "IDLE";
  const statusClass = error
    ? "pill pill--danger"
    : streaming
      ? "pill pill--warn"
      : output
        ? "pill pill--good"
        : "pill pill--muted";

  return (
    <section className="spec-frame">
      <div className="spec-label">LIVE STREAM TEST</div>
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="kicker mb-2">SSE PIPELINE · ROUTE agent.summary</div>
          <p className="text-sm leading-6 text-ink-300">
            Verifies the SSE pipeline end to end. Without provider API keys configured this returns a
            deterministic stub stream — useful for smoke-testing the transport without spending tokens.
          </p>
        </div>
        <span className={statusClass}>{statusLabel}</span>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="block">
          <span className="kicker mb-1.5 block">PROMPT</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="workflow-input resize-none"
            placeholder="Prompt..."
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={start} disabled={streaming || prompt.trim().length === 0}>
            {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Stream
          </button>
          <button type="button" className="btn-ghost" onClick={cancel} disabled={!streaming}>
            <Square className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
          ERR · {error}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="kicker">OUTPUT · STDOUT</span>
          <span className="kicker">{output ? `${output.length} CHARS` : "—"}</span>
        </div>
        <pre className="max-h-72 min-h-[6rem] overflow-y-auto whitespace-pre-wrap border border-ink-700 bg-ink-950 p-3 font-mono text-xs leading-5 text-ink-200">
          {output || (streaming ? "…" : "Output will appear here.")}
        </pre>
      </div>
    </section>
  );
}
