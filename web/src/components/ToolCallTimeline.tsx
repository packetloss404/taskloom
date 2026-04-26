import { useState } from "react";
import type { AgentRunToolCall } from "@/lib/types";

function statusPill(status: AgentRunToolCall["status"]) {
  if (status === "ok") return "pill pill--good";
  if (status === "timeout") return "pill pill--warn";
  return "pill pill--danger";
}

function statusLabel(status: AgentRunToolCall["status"]) {
  if (status === "ok") return "OK";
  if (status === "timeout") return "T/O";
  return "ERR";
}

function safeStringify(value: unknown, max = 4000): string {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
  } catch {
    return String(value);
  }
}

export default function ToolCallTimeline({ calls }: { calls: AgentRunToolCall[] | undefined }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!calls || calls.length === 0) return null;

  return (
    <ol>
      {calls.map((call, index) => {
        const open = expanded === call.id;
        return (
          <li key={call.id} className="border-t border-ink-700 py-2 first:border-t-0">
            <button type="button" className="grid w-full grid-cols-[2.5rem_1fr_5rem_5rem] items-baseline gap-3 text-left" onClick={() => setExpanded(open ? null : call.id)}>
              <span className="font-mono text-xs text-ink-500">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 truncate font-mono text-xs text-ink-200">
                <span className={statusPill(call.status)}>{statusLabel(call.status)}</span>
                <span className="ml-2 text-signal-amber">{call.toolName}</span>
                {call.error && <span className="ml-2 text-signal-red">{call.error}</span>}
              </span>
              <span className="font-mono text-[10px] text-ink-500 text-right">{call.durationMs}ms</span>
              <span className="font-mono text-[10px] text-ink-500 text-right">{open ? "[ − ]" : "[ + ]"}</span>
            </button>
            {open && (
              <div className="mt-2 grid gap-2 pl-10">
                <div>
                  <div className="kicker mb-1.5">INPUT</div>
                  <pre className="overflow-x-auto border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] leading-5 text-ink-200">{safeStringify(call.input)}</pre>
                </div>
                {call.output !== undefined && (
                  <div>
                    <div className="kicker mb-1.5">OUTPUT</div>
                    <pre className="overflow-x-auto border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] leading-5 text-ink-200">{safeStringify(call.output)}</pre>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
