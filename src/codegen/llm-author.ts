// STUB — replaced by the real B1 orchestrator implementation at merge time.
// This file exists only to keep typecheck green inside this worktree while the
// parallel agent producing the real `llm-author.ts` writes to a separate
// worktree. The merge resolution policy is: keep the real implementation.

import type { ModelRoutingPresetId } from "../model-routing-presets.js";

export type GeneratedFile = {
  path: string;
  contents: string;
};

export interface AuthorAppOptions {
  preset?: ModelRoutingPresetId;
  workspaceId?: string;
  signal?: AbortSignal;
}

export type AuthorAppEmit = (text: string) => void | Promise<void>;

export type AuthorAppResult = {
  files: GeneratedFile[];
  summary: string;
  source: "llm" | "template";
};

/**
 * Stub. The real orchestrator (B1) streams a plan → write pass through the
 * LLM and returns a generated file tree. This stub returns null so the caller
 * always falls through to the existing template path.
 */
export async function authorAppViaLLM(
  _userGoal: string,
  _options: AuthorAppOptions = {},
  _emit?: AuthorAppEmit,
): Promise<AuthorAppResult | null> {
  return null;
}
