import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { AgentPlaybookStep } from "@/lib/types";

type DraftStep = AgentPlaybookStep;

export default function PlaybookEditor({
  steps,
  onChange,
}: {
  steps: DraftStep[];
  onChange: (next: DraftStep[]) => void;
}) {
  const update = (index: number, patch: Partial<DraftStep>) => {
    const next = steps.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addStep = () => {
    onChange([
      ...steps,
      { id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, title: "", instruction: "" },
    ]);
  };

  const removeStep = (index: number) => {
    const next = steps.slice();
    next.splice(index, 1);
    onChange(next);
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = steps.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {steps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-700 bg-ink-950/35 px-4 py-5 text-sm text-ink-500">
          No playbook steps yet. Add steps so each run produces a transcript.
        </div>
      ) : (
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step.id} className="rounded-2xl border border-ink-800/80 bg-ink-950/40 p-3">
              <div className="flex items-start gap-3">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-semibold text-ink-300">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className="dashboard-input"
                    placeholder="Step title"
                    value={step.title}
                    onChange={(event) => update(index, { title: event.target.value })}
                  />
                  <textarea
                    className="dashboard-input resize-none"
                    rows={2}
                    placeholder="What the agent should do in this step"
                    value={step.instruction}
                    onChange={(event) => update(index, { instruction: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md border border-ink-800 text-ink-400 hover:bg-ink-850 hover:text-ink-100 disabled:opacity-30"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move step up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md border border-ink-800 text-ink-400 hover:bg-ink-850 hover:text-ink-100 disabled:opacity-30"
                    onClick={() => move(index, 1)}
                    disabled={index === steps.length - 1}
                    aria-label="Move step down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md border border-ink-800 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    onClick={() => removeStep(index)}
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-ink-700 px-3 py-2 text-sm text-ink-300 hover:border-ink-500 hover:bg-ink-850 hover:text-ink-100"
        onClick={addStep}
      >
        <Plus className="h-4 w-4" /> Add step
      </button>
    </div>
  );
}
