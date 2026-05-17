// STUB — replaced by the real B3 build validator at merge time. Kept minimal
// so typecheck passes inside this worktree only. The merge resolution policy
// is: keep the real implementation.

import type { GeneratedFile } from "./llm-author.js";

export interface ValidateFileTreeOptions {
  workspaceId?: string;
  signal?: AbortSignal;
}

export type ValidateFileTreeResult = {
  ok: boolean;
  /**
   * `"real"` means the validator actually ran a build / typecheck pass.
   * `"skipped"` means validation was disabled (e.g. sandbox smoke not
   * enabled) and the result is a permissive default. Callers should ignore
   * `errors` when source is `"skipped"`.
   */
  source: "real" | "skipped";
  errors: string[];
  warnings: string[];
  durationMs: number;
};

/**
 * Stub. The real validator runs a sandboxed build + typecheck pass to surface
 * compile errors before the file tree is offered to the user. This stub
 * always reports a permissive pass so the opt-in code path can be wired up
 * end-to-end before B3 lands.
 */
export async function validateFileTree(
  _files: GeneratedFile[],
  _options: ValidateFileTreeOptions = {},
): Promise<ValidateFileTreeResult> {
  return {
    ok: true,
    source: "skipped",
    errors: [],
    warnings: [],
    durationMs: 0,
  };
}
