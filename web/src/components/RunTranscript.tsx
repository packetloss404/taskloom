import type { AgentRunStep, AgentRunStepStatus } from "@/lib/types";
import { formatDuration } from "@/lib/agent-runtime";

function statusPill(status: AgentRunStepStatus) {
  if (status === "success") return "pill pill--good";
  if (status === "failed") return "pill pill--danger";
  return "pill pill--muted";
}

function statusLabel(status: AgentRunStepStatus) {
  if (status === "success") return "OK";
  if (status === "failed") return "FAIL";
  if (status === "skipped") return "SKIP";
  return "—";
}

export default function RunTranscript({ steps }: { steps: AgentRunStep[] | undefined }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="border border-dashed border-ink-700 px-3 py-4 font-mono text-xs text-ink-500">
        — NO TRANSCRIPT CAPTURED FOR THIS RUN —
      </div>
    );
  }

  return (
    <ol>
      {steps.map((step, index) => (
        <li key={step.id} className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 border-t border-ink-700 py-3 first:border-t-0">
          <div className="font-mono text-xs text-ink-500">{String(index + 1).padStart(2, "0")}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={statusPill(step.status)}>{statusLabel(step.status)}</span>
              <span className="truncate font-serif text-sm text-ink-100">{step.title}</span>
            </div>
            {step.output && <p className="mt-1.5 text-xs leading-5 text-ink-400">{step.output}</p>}
          </div>
          <div className="font-mono text-[11px] text-ink-500">{formatDuration(step.durationMs)}</div>
        </li>
      ))}
    </ol>
  );
}
