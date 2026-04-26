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
    <div>
      {steps.length === 0 ? (
        <div className="border border-dashed border-ink-700 px-4 py-6 text-center">
          <div className="kicker mb-1.5">EMPTY PLAYBOOK</div>
          <p className="font-mono text-xs text-ink-500">Add steps so each run produces a transcript.</p>
        </div>
      ) : (
        <ol>
          {steps.map((step, index) => (
            <li key={step.id} className="grid grid-cols-[2.5rem_1fr_5rem] gap-3 border-t border-ink-700 py-3 first:border-t-0">
              <div className="pt-1.5 font-mono text-xs text-ink-500">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="space-y-2">
                <input
                  className="workflow-input"
                  placeholder="Step title"
                  value={step.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                />
                <textarea
                  className="workflow-input resize-none"
                  rows={2}
                  placeholder="What the agent should do in this step"
                  value={step.instruction}
                  onChange={(event) => update(index, { instruction: event.target.value })}
                />
              </div>
              <div className="flex flex-col items-end gap-1 pt-1.5 font-mono text-xs">
                <button
                  type="button"
                  className="text-ink-400 hover:text-signal-amber disabled:opacity-30"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move step up"
                >
                  ↑ UP
                </button>
                <button
                  type="button"
                  className="text-ink-400 hover:text-signal-amber disabled:opacity-30"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                  aria-label="Move step down"
                >
                  ↓ DN
                </button>
                <button
                  type="button"
                  className="text-ink-500 hover:text-signal-red"
                  onClick={() => removeStep(index)}
                  aria-label="Remove step"
                >
                  × DEL
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 border-t border-ink-700 pt-4">
        <button type="button" className="btn-ghost" onClick={addStep}>
          + Add step
        </button>
      </div>
    </div>
  );
}
