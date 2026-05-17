// STUB — replaced by the real B2 prompts at merge time. Kept minimal so
// typecheck passes inside this worktree only. The merge resolution policy is:
// keep the real implementation.

export const SYSTEM_PROMPT = "stub system prompt";

export function planUserPrompt(userGoal: string): string {
  return `Plan an app for: ${userGoal}`;
}

export function writeUserPrompt(plan: unknown): string {
  return `Write the files for plan: ${JSON.stringify(plan ?? {})}`;
}
