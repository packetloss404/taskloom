import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { AgentRunStep, AgentRunStepStatus } from "@/lib/types";
import { formatDuration } from "@/lib/agent-runtime";

export default function RunTranscript({ steps }: { steps: AgentRunStep[] | undefined }) {
  if (!steps || steps.length === 0) {
    return <div className="text-xs text-ink-500">No transcript captured for this run.</div>;
  }

  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-3 rounded-xl border border-ink-800/70 bg-ink-950/40 p-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-ink-300">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink-100">{step.title}</span>
              <span className="flex items-center gap-1 text-xs text-ink-500">
                <StepIcon status={step.status} />
                <span>{formatDuration(step.durationMs)}</span>
              </span>
            </div>
            {step.output && <p className="mt-1 text-xs leading-5 text-ink-400">{step.output}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ status }: { status: AgentRunStepStatus }) {
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-rose-300" />;
  return <CircleDashed className="h-3.5 w-3.5 text-ink-500" />;
}
