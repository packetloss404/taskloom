// STUB — replaced by the real B2 path validator at merge time. Kept minimal
// so typecheck passes inside this worktree only. The merge resolution policy
// is: keep the real implementation.

export type PathValidation =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Stub. Always accepts the path and returns it as-is. The real implementation
 * defends against path traversal, absolute paths, symlinks, Windows reserved
 * names, NTFS alternate data streams, and more.
 */
export function validateWorkspacePath(p: string): PathValidation {
  const normalized = (p ?? "").replace(/\\/g, "/").trim();
  if (normalized.length === 0) {
    return { ok: false, reason: "empty path" };
  }
  return { ok: true, normalized };
}
