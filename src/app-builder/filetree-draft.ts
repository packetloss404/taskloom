import { authorAppViaLLM } from "../codegen/llm-author.js";
import { validateFileTree } from "../codegen/validate.js";
import { deriveDraftFromFiles } from "../codegen/derived-draft.js";
import type { ModelRoutingPresetId } from "../model-routing-presets.js";
import type {
  AppDraftEmit,
  AppDraftLLMOptions,
  GenerateAppDraftResult,
} from "./llm-draft.js";

/**
 * Track B file-tree path (now the default in `generateAppDraftWithLLM`):
 * ask the file-tree orchestrator to author a generated app as a list of
 * files, run the build validator, then project the file tree into an
 * AppDraft so all downstream consumers keep working.
 *
 * Returns null when the orchestrator declined (no BYOK key, model gave up,
 * etc.) so the caller can fall through to the existing structured-tool /
 * template paths. The legacy `TASKLOOM_FILETREE_CODEGEN=1` opt-in flag is
 * preserved as a no-op; the opt-out is `TASKLOOM_LEGACY_TEMPLATES=1`, which
 * is handled in `generateAppDraftWithLLM` before this function is called.
 *
 * Note: this code path's runtime behaviour depends on the real B1 / B2 / B3
 * modules under `src/codegen/`. With no BYOK key configured, the
 * orchestrator returns null and the caller falls through transparently.
 */
export async function tryFileTreeCodegen(
  prompt: string,
  options: AppDraftLLMOptions,
  emit?: AppDraftEmit,
): Promise<GenerateAppDraftResult | null> {
  try {
    const workspaceId = options.workspaceId ?? "";
    const authorOptions: { preset?: ModelRoutingPresetId; workspaceId: string; signal?: AbortSignal } = { workspaceId };
    if (options.preset) authorOptions.preset = options.preset;
    if (options.signal) authorOptions.signal = options.signal;
    const noopEmit = (_: string) => {};
    const result = await authorAppViaLLM(prompt, authorOptions, emit ?? noopEmit);
    if (!result) return null;

    const validateOptions: { signal?: AbortSignal } = {};
    if (options.signal) validateOptions.signal = options.signal;
    const validation = await validateFileTree(result.files, validateOptions);

    // 1-retry policy: surface errors and let the caller decide. There is no
    // auto-fix loop in this skeleton — the LLM may have produced a tree that
    // does not compile, and we want the UI to show that rather than silently
    // ship something broken.
    if (!validation.ok && validation.source === "real") {
      console.warn(
        `[codegen] file-tree validation failed: ${validation.errors.length} error(s) in ${validation.durationMs}ms`,
      );
    }

    const draft = deriveDraftFromFiles(result.files, prompt, result.summary);
    const out: GenerateAppDraftResult = {
      draft,
      source: "llm-filetree",
      files: result.files,
    };
    if (!validation.ok && validation.source === "real" && validation.errors.length > 0) {
      out.validationErrors = validation.errors.map((e) => `${e.file}${e.line ? `:${e.line}` : ""}: ${e.message}`);
    }
    return out;
  } catch (error) {
    console.warn(`[codegen] file-tree path failed: ${(error as Error).message}`);
    return null;
  }
}
