import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { I, type IconKey } from "../icons";
import { Topbar } from "../Shell";
import { api } from "@/lib/api";
import { useApiData } from "../useApiData";
import { ExecTable, SelectedExecPanel } from "./sandbox";
import { AgentBuilderPanel } from "./builder-agent";
import type {
  AppBuilderApproveResult,
  AppBuilderApiRoute,
  AppBuilderCheckpointSummary,
  AppBuilderDataEntity,
  AppBuilderDraft,
  AppBuilderIterationDiffFile,
  AppBuilderIterationResult,
  AppBuilderIterationTarget,
  AppBuilderPageDraft,
  AppBuilderPublishState,
  AppBuilderSourceFileSummary,
  AppBuilderSmokeBuildStatus,
  AppBuilderWorkspaceSummary,
  BuilderModelPresetId,
} from "@/lib/types";

interface SelectedElement {
  selector: string;
  label: string;
}

const PRESET_OPTIONS: Array<{ id: BuilderModelPresetId; label: string; hint: string }> = [
  { id: "fast", label: "Lightning", hint: "Low latency" },
  { id: "smart", label: "Pro", hint: "Best quality" },
  { id: "cheap", label: "Cheap", hint: "Cost-aware" },
  { id: "local", label: "Local", hint: "Ollama-first" },
];

type ChatBody =
  | { kind: "text"; text: string }
  | { kind: "steps"; steps: string[] }
  | { kind: "plan"; draft: AppBuilderDraft }
  | { kind: "diff"; iteration: AppBuilderIterationResult }
  | { kind: "status"; text: string; tone: "info" | "warn" | "error" | "ok" };

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  body: ChatBody;
  streaming?: boolean;
}

function newId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

type Mode = "empty" | "drafting" | "drafted" | "applying" | "applied" | "iterating";
type BuilderKind = "app" | "agent";

interface BuilderState {
  draft: AppBuilderDraft | null;
  appId: string | null;
  checkpointId: string | null;
  previewUrl: string | null;
  smoke: AppBuilderSmokeBuildStatus | null;
  iteration: AppBuilderIterationResult | null;
  sourceFiles: AppBuilderSourceFileSummary[];
  workspace: AppBuilderWorkspaceSummary | null;
}

type IterationTargetOption = AppBuilderIterationTarget & { group: string };
type PublishRollbackAction = AppBuilderPublishState["rollbackActions"][number];
type PublishRollbackBody = NonNullable<Parameters<typeof api.rollbackBuilderPublish>[1]> & { targetPublishId?: string };

export function getPreviewNavigationTarget(previewUrl: string | null, appId: string | null) {
  const cleanPreviewUrl = previewUrl?.trim();
  if (cleanPreviewUrl) {
    if (/^https?:\/\//i.test(cleanPreviewUrl) || cleanPreviewUrl.startsWith("/")) return cleanPreviewUrl;
    return `/${cleanPreviewUrl}`;
  }
  return appId ? `/builder/preview/workspace/${encodeURIComponent(appId)}` : null;
}

export function publishReadinessHeading(state: Pick<AppBuilderPublishState, "canPublish" | "publishedUrl"> | null): string {
  if (!state) return "Loading publish handoff";
  return state.canPublish ? "Ready for local publish handoff" : "Publish handoff blocked";
}

export function publishPrimaryActionLabel(working: boolean): string {
  return working ? " Publishing..." : " Publish";
}

function stableTargetKey(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase()).replace(/%/g, "_");
}

function buildIterationTargetOptions(draft: AppBuilderDraft | null): IterationTargetOption[] {
  if (!draft) {
    return [{ id: "app:draft", kind: "app", label: "Whole app", group: "App" }];
  }
  const appKey = stableTargetKey(draft.app.slug || draft.app.name || "app");
  return [
    { id: `app:${appKey}`, kind: "app", label: draft.app.name || "Whole app", path: draft.app.slug, group: "App" },
    ...draft.app.pages.map((page) => ({
      id: `page:${stableTargetKey(page.route || page.name)}`,
      kind: "page" as const,
      label: `${page.name} (${page.route})`,
      path: page.route,
      group: "Pages",
    })),
    ...draft.app.dataSchema.map((entity) => ({
      id: `data_entity:${stableTargetKey(entity.name)}`,
      kind: "data_entity" as const,
      label: entity.name,
      path: entity.name,
      group: "Data",
    })),
    ...draft.app.apiRoutes.map((route) => ({
      id: `api_route:${stableTargetKey(`${route.method}:${route.path}`)}`,
      kind: "api_route" as const,
      label: `${route.method} ${route.path}`,
      path: route.path,
      group: "API",
    })),
    ...(draft.app.authDecisions.length > 0
      ? [{
          id: `auth:${appKey}`,
          kind: "auth" as const,
          label: `Auth (${draft.app.authDecisions.map((decision) => decision.area).join(", ")})`,
          path: "auth",
          group: "Auth",
        }]
      : []),
    {
      id: `smoke:${appKey}`,
      kind: "smoke",
      label: `Smoke / build (${draft.smokeBuildStatus.status})`,
      path: "smoke",
      group: "Quality",
    },
  ];
}

function escapeCssIdent(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[\0-\x1f\x7f]|^-?\d|^-$|[^\w-]/g, (char, offset) => {
    if (char === "\0") return "\uFFFD";
    const code = char.charCodeAt(0).toString(16).toUpperCase();
    return offset === 0 || /[\0-\x1f\x7f]/.test(char) ? `\\${code} ` : `\\${char}`;
  });
}

function cssPathFor(el: Element): string {
  const segments: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === 1 && segments.length < 6) {
    const node: Element = current;
    const tag = node.tagName.toLowerCase();
    let segment = tag;
    const id = node.getAttribute("id");
    if (id) {
      segment = `${tag}#${escapeCssIdent(id)}`;
      segments.unshift(segment);
      break;
    }
    const classes = (node.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (classes.length > 0) segment += classes.map((className) => `.${escapeCssIdent(className)}`).join("");
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTagSiblings: Element[] = Array.from(parent.children).filter((sibling) => sibling.tagName === node.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(node) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }
    segments.unshift(segment);
    current = parent;
  }
  return segments.join(" > ");
}

function openPreviewTarget(target: string, navigate: NavigateFunction) {
  if (/^https?:\/\//i.test(target)) {
    window.open(target, "_blank", "noopener,noreferrer");
    return;
  }
  navigate(target);
}

export function BuilderView() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("empty");
  const [builderKind, setBuilderKind] = useState<BuilderKind>("app");
  const [prompt, setPrompt] = useState("");
  const [iterPrompt, setIterPrompt] = useState("");
  const [iterTargetId, setIterTargetId] = useState<string>("app:draft");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<"preview" | "files" | "smoke" | "logs" | "sandbox" | "checkpoints" | "publish">("preview");
  const [checkpoints, setCheckpoints] = useState<AppBuilderCheckpointSummary[]>([]);
  const [publishState, setPublishState] = useState<AppBuilderPublishState | null>(null);

  const [state, setState] = useState<BuilderState>({
    draft: null, appId: null, checkpointId: null, previewUrl: null, smoke: null, iteration: null, sourceFiles: [], workspace: null,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerPreset, setComposerPreset] = useState<BuilderModelPresetId>("smart");
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const previewTarget = getPreviewNavigationTarget(state.previewUrl, state.appId);
  const iterationTargetOptions = useMemo(() => buildIterationTargetOptions(state.draft), [state.draft]);
  const selectedIterationTarget = iterationTargetOptions.find((target) => target.id === iterTargetId) ?? iterationTargetOptions[0]!;
  const selectedTargetKind = selectedElement ? "page" : selectedIterationTarget.kind;
  const pageIterationTarget = iterationTargetOptions.find((target) => target.kind === "page") ?? selectedIterationTarget;

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!iterationTargetOptions.some((target) => target.id === iterTargetId)) {
      setIterTargetId(iterationTargetOptions[0]!.id);
    }
  }, [iterationTargetOptions, iterTargetId]);

  const appendMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);
  const updateMessage = (id: string, updater: (msg: ChatMessage) => ChatMessage) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  const pushSystemStatus = (text: string, tone: "info" | "warn" | "error" | "ok" = "info") =>
    appendMessage({ id: newId(), role: "system", body: { kind: "status", text, tone } });

  // Refresh checkpoints + publish state when an app is created
  useEffect(() => {
    if (!state.appId) return;
    let mounted = true;
    void api.listBuilderCheckpoints({ appId: state.appId })
      .then((res) => mounted && setCheckpoints(res.checkpoints))
      .catch(() => {});
    void api.getBuilderPublishState({ appId: state.appId })
      .then((s) => mounted && setPublishState(s))
      .catch(() => {});
    return () => { mounted = false; };
  }, [state.appId, state.checkpointId]);

  const generate = async () => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt || working) return;
    const previousMode = mode;
    setWorking(true);
    setError(null);
    setMode("drafting");
    appendMessage({ id: newId(), role: "user", body: { kind: "text", text: nextPrompt } });
    const assistantId = newId();
    appendMessage({ id: assistantId, role: "assistant", body: { kind: "steps", steps: [] }, streaming: true });
    try {
      await api.streamAppBuilderDraft({ prompt: nextPrompt, preset: composerPreset }, (event) => {
        if (event.type === "step") {
          updateMessage(assistantId, (m) => {
            if (m.body.kind !== "steps") return m;
            return { ...m, body: { kind: "steps", steps: [...m.body.steps, event.text] } };
          });
        } else if (event.type === "draft") {
          setPrompt(event.draft.prompt || nextPrompt);
          setState({
            draft: event.draft,
            appId: null,
            checkpointId: null,
            previewUrl: null,
            smoke: null,
            iteration: null,
            sourceFiles: [],
            workspace: null,
          });
          setCheckpoints([]);
          setPublishState(null);
          setTab("preview");
          updateMessage(assistantId, (m) => ({ ...m, body: { kind: "plan", draft: event.draft }, streaming: false }));
          setMode("drafted");
        } else if (event.type === "error") {
          setError(event.error);
          updateMessage(assistantId, (m) => ({ ...m, body: { kind: "status", text: event.error, tone: "error" }, streaming: false }));
          setMode(previousMode);
        }
      });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      updateMessage(assistantId, (m) => ({ ...m, body: { kind: "status", text: message, tone: "error" }, streaming: false }));
      setMode(previousMode);
    } finally {
      setWorking(false);
    }
  };

  const approve = async () => {
    if (!state.draft || working) return;
    setWorking(true);
    setError(null);
    setMode("applying");
    try {
      const result: AppBuilderApproveResult = await api.approveAppBuilderDraft({ prompt: state.draft.prompt, draft: state.draft, runBuild: true, runSmoke: true, targetStatus: "built" });
      setState({
        draft: result.draft,
        appId: result.app?.id ?? null,
        checkpointId: result.checkpoint?.id ?? null,
        previewUrl: result.previewUrl ?? result.app?.previewUrl ?? null,
        smoke: result.smoke ?? result.smokeBuild ?? null,
        iteration: null,
        sourceFiles: result.sourceFiles ?? result.artifact?.files ?? [],
        workspace: result.workspace ?? null,
      });
      setMode("applied");
      setTab("preview");
      const smokeStatus = result.smoke?.status ?? result.smokeBuild?.status;
      pushSystemStatus(
        smokeStatus === "pass" ? "Draft applied. Smoke checks passed." : `Draft applied${smokeStatus ? `. Smoke: ${smokeStatus}.` : "."}`,
        smokeStatus === "fail" ? "warn" : "ok",
      );
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      pushSystemStatus(message, "error");
      setMode("drafted");
    } finally {
      setWorking(false);
    }
  };

  const iterate = async () => {
    if (!state.draft || !iterPrompt.trim() || working) return;
    const baseTarget = selectedElement ? pageIterationTarget : selectedIterationTarget;
    const target: AppBuilderIterationTarget = selectedElement
      ? {
          ...baseTarget,
          id: `${baseTarget.id}:element:${stableTargetKey(selectedElement.selector)}`,
          kind: "page",
          label: `${baseTarget.label} -> ${selectedElement.selector}`,
          path: selectedElement.selector,
        }
      : baseTarget;
    const composedPrompt = selectedElement
      ? `On the element \`${selectedElement.selector}\`${selectedElement.label ? ` ("${selectedElement.label}")` : ""}: ${iterPrompt}`
      : iterPrompt;
    setWorking(true);
    setError(null);
    setMode("iterating");
    appendMessage({ id: newId(), role: "user", body: { kind: "text", text: composedPrompt } });
    const assistantId = newId();
    appendMessage({ id: assistantId, role: "assistant", body: { kind: "steps", steps: [] }, streaming: true });
    setIterPrompt("");
    setSelectedElement(null);
    try {
      await api.streamAppBuilderIteration({
        appId: state.appId ?? undefined,
        checkpointId: state.checkpointId ?? undefined,
        draft: state.draft,
        target,
        prompt: composedPrompt,
        preset: composerPreset,
      }, (event) => {
        if (event.type === "step") {
          updateMessage(assistantId, (m) => {
            if (m.body.kind !== "steps") return m;
            return { ...m, body: { kind: "steps", steps: [...m.body.steps, event.text] } };
          });
        } else if (event.type === "diff") {
          setState((prev) => ({ ...prev, iteration: event.iteration }));
          updateMessage(assistantId, (m) => ({ ...m, body: { kind: "diff", iteration: event.iteration }, streaming: false }));
          setMode("applied");
        } else if (event.type === "error") {
          setError(event.error);
          updateMessage(assistantId, (m) => ({ ...m, body: { kind: "status", text: event.error, tone: "error" }, streaming: false }));
          setMode("applied");
        }
      });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      updateMessage(assistantId, (m) => ({ ...m, body: { kind: "status", text: message, tone: "error" }, streaming: false }));
      setMode("applied");
    } finally {
      setWorking(false);
    }
  };

  const applyIteration = async () => {
    if (!state.iteration || working) return;
    setWorking(true);
    setError(null);
    try {
      const result = await api.applyAppBuilderIterationDiff({
        appId: state.appId ?? undefined,
        checkpointId: state.checkpointId ?? undefined,
        diffId: state.iteration.id,
        target: state.iteration.target,
        files: state.iteration.files,
        diff: state.iteration,
        draft: state.iteration.draft ?? state.draft ?? undefined,
        runBuild: true,
        runSmoke: true,
        refreshPreview: true,
      });
      setState((prev) => ({
        ...prev,
        draft: result.diff?.draft ?? prev.draft,
        appId: result.app?.id ?? prev.appId,
        checkpointId: result.checkpoint?.id ?? prev.checkpointId,
        previewUrl: result.preview?.previewUrl ?? result.previewUrl ?? result.app?.previewUrl ?? prev.previewUrl,
        smoke: result.smoke ?? prev.smoke,
        iteration: null,
        sourceFiles: result.sourceFiles ?? result.diff?.sourceFiles ?? result.diff?.artifact?.files ?? prev.sourceFiles,
        workspace: result.workspace ?? prev.workspace,
      }));
      setIterPrompt("");
      pushSystemStatus("Diff applied. Preview refreshed.", "ok");
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      pushSystemStatus(message, "error");
    } finally {
      setWorking(false);
    }
  };

  const rollback = async (checkpointId: string) => {
    if (!state.appId || working) return;
    setWorking(true);
    setError(null);
    try {
      const result = await api.rollbackBuilderCheckpoint(checkpointId, { appId: state.appId });
      setState((prev) => ({
        ...prev,
        draft: result.draft ?? prev.draft,
        appId: result.app?.id ?? prev.appId,
        checkpointId: result.checkpoint?.id ?? prev.checkpointId,
        previewUrl: result.preview?.url ?? result.app?.previewUrl ?? prev.previewUrl,
        smoke: result.smoke ?? prev.smoke,
        iteration: null,
        sourceFiles: prev.sourceFiles,
        workspace: prev.workspace,
      }));
      setSelectedElement(null);
      setInspectMode(false);
      setMode("applied");
      setTab("preview");
      const nextAppId = result.app?.id ?? state.appId;
      const cps = await api.listBuilderCheckpoints({ appId: nextAppId });
      setCheckpoints(cps.checkpoints);
      try {
        const ps = await api.getBuilderPublishState({ appId: nextAppId, checkpointId: result.checkpoint?.id });
        setPublishState(ps);
      } catch { /* ignore */ }
      pushSystemStatus(result.preview?.message ?? "Save restored.", "ok");
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      pushSystemStatus(message, "error");
    } finally {
      setWorking(false);
    }
  };

  const branch = async (checkpointId: string) => {
    if (!state.appId || working) return;
    const sourceCheckpointShort = checkpointId.slice(0, 12);
    const sourceAppName = state.draft?.app.name ?? "the source app";
    setWorking(true);
    setError(null);
    try {
      const result = await api.branchBuilderCheckpoint(checkpointId, { appId: state.appId });
      setState({
        draft: result.draft,
        appId: result.app.id,
        checkpointId: result.checkpoint.id,
        previewUrl: result.app.previewUrl ?? null,
        smoke: result.smoke ?? null,
        iteration: null,
        sourceFiles: [],
        workspace: null,
      });
      setMessages([]);
      setSelectedElement(null);
      setInspectMode(false);
      setTab("preview");
      setMode("applied");
      pushSystemStatus(`Branched from ${sourceCheckpointShort} in '${sourceAppName}'.`, "info");
      try {
        const cps = await api.listBuilderCheckpoints({ appId: result.app.id });
        setCheckpoints(cps.checkpoints);
      } catch { /* ignore */ }
      try {
        const ps = await api.getBuilderPublishState({ appId: result.app.id });
        setPublishState(ps);
      } catch { /* ignore */ }
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      pushSystemStatus(message, "error");
    } finally {
      setWorking(false);
    }
  };

  const publish = async () => {
    if (!state.appId || working) return;
    setWorking(true);
    setError(null);
    try {
      const result = await api.publishBuilderApp({ appId: state.appId, checkpointId: state.checkpointId ?? undefined, runBuild: true, runSmoke: true });
      setPublishState(result.state);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const rollbackPublish = async (action: PublishRollbackAction) => {
    if (!state.appId || !publishState || working) return;
    if (!action.publishId) {
      const message = "Publish rollback action is missing a target publish id.";
      setError(message);
      pushSystemStatus(message, "error");
      return;
    }
    const currentPublishId = publishState.history.find((entry) =>
      !publishState.rollbackActions.some((rollbackAction) => rollbackAction.publishId === entry.id)
    )?.id;
    if (!currentPublishId) {
      const message = "Current publish id could not be resolved for rollback.";
      setError(message);
      pushSystemStatus(message, "error");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const body: PublishRollbackBody = {
        appId: state.appId,
        checkpointId: action.checkpointId,
        targetPublishId: action.publishId,
        reason: `Rollback via builder publish panel to ${action.label}.`,
      };
      const result = await api.rollbackBuilderPublish(currentPublishId, body);
      setPublishState(result.state);
      setState((prev) => ({
        ...prev,
        checkpointId: result.state.checkpointId ?? action.checkpointId ?? prev.checkpointId,
        iteration: null,
      }));
      pushSystemStatus(`${action.label} complete.`, "ok");
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      pushSystemStatus(message, "error");
    } finally {
      setWorking(false);
    }
  };

  const draft = state.draft;

  return (
    <>
      <header className="flex items-center justify-between px-4 h-10 border-b border-line text-sm">
        <div className="flex items-center gap-2">
          {state.appId && (
            <a href="/" className="text-silver-400 hover:text-silver-50" aria-label="Back">
              ‹
            </a>
          )}
          <span className="text-silver-50">{state.draft?.app.name ?? "New build"}</span>
        </div>
        <span className="text-silver-400">⋯</span>
      </header>

      {mode === "empty" && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-40px)] px-6">
          <h1 className="text-[28px] font-medium text-silver-50 mb-6">What do you want to build today?</h1>

          <div className="mx-auto w-full max-w-[720px] rounded-2xl border border-line bg-panel/60 backdrop-blur-sm focus-within:border-green-deep/60 transition">
            <textarea
              placeholder="Describe what you want to build..."
              className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[16px] leading-relaxed placeholder:text-silver-500 focus:outline-none min-h-[112px]"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              {/* TODO Phase 2: kind + preset popover */}
              <button
                type="button"
                className="text-silver-400 hover:text-silver-50 px-2 py-1"
                aria-label="Build options"
              >
                ⚙
              </button>
              <button className="btn-primary btn" disabled={!prompt.trim() || working} onClick={() => { void generate(); }}>
                {working ? <><span className="spin"><I.refresh size={13}/></span> Generating</> : <><I.arrowUp size={13}/> Build</>}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 max-w-[720px] mx-auto w-full">
            <button
              type="button"
              className="rounded-xl border border-line bg-panel/40 px-4 py-3 text-left text-sm hover:border-green-deep/40 hover:bg-panel transition"
              onClick={() => {
                setBuilderKind("app");
                setPrompt("Build a lightweight CRM for account managers to track companies, contacts, opportunities, and renewal risk.");
              }}
            >
              Lightweight CRM
            </button>
            <button
              type="button"
              className="rounded-xl border border-line bg-panel/40 px-4 py-3 text-left text-sm hover:border-green-deep/40 hover:bg-panel transition"
              onClick={() => {
                setBuilderKind("app");
                setPrompt("Build a customer portal where customers can manage profile details, open requests, and upload documents.");
              }}
            >
              Customer portal
            </button>
            <button
              type="button"
              className="rounded-xl border border-line bg-panel/40 px-4 py-3 text-left text-sm hover:border-green-deep/40 hover:bg-panel transition"
              onClick={() => {
                setBuilderKind("agent");
                setPrompt("Build an agent that posts a daily standup digest summarising the team's overnight progress and today's plan.");
              }}
            >
              Standup digest agent
            </button>
            <button
              type="button"
              className="rounded-xl border border-line bg-panel/40 px-4 py-3 text-left text-sm hover:border-green-deep/40 hover:bg-panel transition"
              onClick={() => {
                setBuilderKind("agent");
                setPrompt("Create a webhook agent to triage customer incidents, open blockers for critical risks, and post a summary to Slack.");
              }}
            >
              Support triage agent
            </button>
          </div>

          {error && (
            <div className="card max-w-[720px] mx-auto w-full" style={{ padding: "10px 14px", marginTop: 14, borderColor: "rgba(242,107,92,0.3)", color: "var(--danger)" }}>
              <span className="mono" style={{ fontSize: 11.5 }}>ERR · {error}</span>
            </div>
          )}
        </div>
      )}

      {builderKind === "agent" && mode !== "empty" && (
        <AgentBuilderPanel initialPrompt={prompt} embedded />
      )}

      {(mode === "drafted" || mode === "applying" || mode === "applied" || mode === "iterating") && draft && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(440px, 520px) 1fr", height: "calc(100vh - 52px)" }}>
          <aside style={{ borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", background: "var(--bg-elev)", minWidth: 0 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
              <I.layout size={15} style={{ color: "var(--green)", flexShrink: 0 }}/>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="h3" style={{ fontSize: 14, color: "var(--silver-50)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.app.name}</div>
                <div className="mono muted" style={{ fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  /{draft.app.slug} · {draft.app.pages.length}p · {draft.app.dataSchema.length}e · {draft.app.apiRoutes.length}r
                </div>
              </div>
              {state.appId
                ? <span className="pill good" style={{ flexShrink: 0 }}><span className="dot"></span>saved preview</span>
                : <span className="pill warn" style={{ flexShrink: 0 }}><span className="dot"></span>draft</span>}
            </div>

            <div ref={threadRef} style={{ flex: 1, overflow: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((msg) => (
                <ThreadMessage
                  key={msg.id}
                  message={msg}
                  onApplyIteration={() => { void applyIteration(); }}
                  working={working}
                />
              ))}

              {!state.appId && mode === "drafted" && state.draft && (
                <div className="card" style={{ padding: 14, marginLeft: 30, background: "var(--bg-elev)", borderColor: "var(--green-deep)" }}>
                  <div className="kicker" style={{ marginBottom: 6, color: "var(--green)" }}>Ready to approve</div>
                  <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Approving saves generated source metadata, runs build + smoke checks, and creates a checkpoint.</p>
                  <button className="btn btn-primary" disabled={working} onClick={() => { void approve(); }}>
                    {working ? <span className="spin"><I.refresh size={13}/></span> : <I.check size={13}/>}
                    {working ? " Applying…" : " Approve"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: 12, borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {iterationTargetOptions.map((t) => {
                  const active = selectedIterationTarget.id === t.id && !selectedElement;
                  return (
                    <button key={t.id} className="btn btn-sm" title={t.group} onClick={() => { setIterTargetId(t.id); setSelectedElement(null); }} style={{
                      background: active ? "var(--bg-elev)" : "var(--panel)",
                      borderColor: active ? "var(--green-deep)" : "var(--line-2)",
                      color: active ? "var(--green)" : "var(--silver-300)",
                      fontSize: 11,
                    }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {selectedElement && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", marginBottom: 8,
                  background: "rgba(184,242,92,0.08)",
                  border: "1px solid rgba(184,242,92,0.3)",
                  borderRadius: 8,
                  fontSize: 11.5, color: "var(--green)",
                }}>
                  <I.zap size={11}/>
                  <span className="mono" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    scoped: {selectedElement.selector}
                    {selectedElement.label && <span style={{ color: "var(--silver-300)" }}> · "{selectedElement.label}"</span>}
                  </span>
                  <button onClick={() => setSelectedElement(null)} style={{ background: "transparent", border: "none", color: "var(--silver-300)", cursor: "pointer", padding: 0 }}>
                    <I.close size={11}/>
                  </button>
                </div>
              )}
              <div style={{ position: "relative" }}>
                <textarea
                  className="field"
                  placeholder={selectedElement ? "Tell me what to change about that element" : state.appId ? "Refine — e.g. 'add inline notes' or 'fix smoke check'" : "Refine — what should change next?"}
                  value={iterPrompt}
                  onChange={(e) => setIterPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && iterPrompt.trim() && !working) {
                      e.preventDefault();
                      void iterate();
                    }
                  }}
                  style={{ paddingRight: 80, minHeight: 64 }}
                />
                <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", gap: 4 }}>
                  <button className="btn-primary btn btn-sm" disabled={!iterPrompt.trim() || working} onClick={() => { void iterate(); }}>
                    {working ? <span className="spin"><I.refresh size={11}/></span> : <I.arrowUp size={12}/>}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                {PRESET_OPTIONS.map((p) => {
                  const active = composerPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setComposerPreset(p.id)}
                      title={p.hint}
                      style={{
                        padding: "3px 9px",
                        borderRadius: 999,
                        border: `1px solid ${active ? "var(--green-deep)" : "var(--line-2)"}`,
                        background: active ? "rgba(184,242,92,0.08)" : "transparent",
                        color: active ? "var(--green)" : "var(--silver-300)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
                <span className="mono muted" style={{ marginLeft: "auto", fontSize: 10.5 }}>⌘↵ to send</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span className="pill muted">target: {selectedTargetKind}</span>
                {state.smoke && <span className={`pill ${state.smoke.status === "pass" ? "good" : state.smoke.status === "fail" ? "danger" : "warn"}`}><span className="dot"></span>build {state.smoke.status}</span>}
              </div>
            </div>
          </aside>

          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="tabbar">
              {([
                { id: "preview", label: "Local preview", icon: "eye" as IconKey },
                { id: "files", label: "Source", icon: "code" as IconKey, count: state.iteration?.files.length ?? 0 },
                { id: "smoke", label: "Quality", icon: "shield" as IconKey },
                { id: "logs", label: "Activity", icon: "activity" as IconKey, count: state.iteration?.logs.length ?? 0 },
                { id: "sandbox", label: "Runs", icon: "cpu" as IconKey },
                { id: "checkpoints", label: "Saves", icon: "history" as IconKey, count: checkpoints.length },
                { id: "publish", label: "Publish", icon: "rocket" as IconKey },
              ] as const).map(t => {
                const Ico = I[t.icon];
                return (
                  <div key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                    <Ico size={13} style={{ marginRight: 6, verticalAlign: "-2px" }}/>{t.label}
                    {"count" in t && t.count !== undefined && t.count > 0 && <span className="mono muted" style={{ fontSize: 10.5, marginLeft: 6 }}>{t.count}</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ flex: 1, overflow: "auto" }}>
              {tab === "preview" && (
                <PreviewTab
                  draft={draft}
                  previewUrl={state.previewUrl}
                  inspectMode={inspectMode}
                  onToggleInspect={() => setInspectMode((v) => !v)}
                  onSelectElement={(sel) => {
                    setSelectedElement(sel);
                    setInspectMode(false);
                  }}
                  selectedSelector={selectedElement?.selector ?? null}
                />
              )}
              {tab === "files" && <FilesTab draft={draft} iteration={state.iteration} sourceFiles={state.sourceFiles} workspace={state.workspace}/>}
              {tab === "smoke" && <SmokeTab smoke={state.smoke ?? draft.smokeBuildStatus}/>}
              {tab === "logs" && <LogsTab iteration={state.iteration}/>}
              {tab === "sandbox" && <SandboxBuilderTab appId={state.appId} appName={state.draft?.app?.name ?? "App"}/>}
              {tab === "checkpoints" && <CheckpointsTab checkpoints={checkpoints} currentId={state.checkpointId} onRollback={(id) => { void rollback(id); }} onBranch={(id) => { void branch(id); }} working={working}/>}
              {tab === "publish" && <PublishTab state={publishState} canPublish={!!state.appId} onPublish={() => { void publish(); }} onRollback={(action) => { void rollbackPublish(action); }} working={working}/>}
            </div>
          </div>
        </div>
      )}

      {(mode === "drafting" || mode === "applying") && (
        <div style={{ position: "fixed", top: 60, right: 28, padding: "10px 14px", background: "var(--panel)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12, color: "var(--green)", display: "flex", alignItems: "center", gap: 8, zIndex: 50 }}>
          <span className="spin"><I.refresh size={12}/></span>
          {mode === "drafting" ? "Generating draft…" : "Applying changes…"}
        </div>
      )}

      {error && (mode === "drafted" || mode === "applied" || mode === "iterating") && (
        <div style={{ position: "fixed", bottom: 20, right: 28, padding: "10px 14px", background: "rgba(242,107,92,0.1)", border: "1px solid rgba(242,107,92,0.3)", borderRadius: 8, fontSize: 11.5, color: "var(--danger)", maxWidth: 320, zIndex: 50 }}>
          <span className="mono">ERR · {error}</span>
        </div>
      )}
    </>
  );
}

function ThreadMessage({
  message,
  onApplyIteration,
  working,
}: {
  message: ChatMessage;
  onApplyIteration: () => void;
  working: boolean;
}) {
  const { role, body, streaming } = message;
  if (role === "system") {
    if (body.kind !== "status") return null;
    const tone = body.tone;
    const color = tone === "error" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : tone === "ok" ? "var(--green)" : "var(--silver-400)";
    const Glyph = tone === "error" ? I.alert : tone === "warn" ? I.alert : tone === "ok" ? I.check : I.activity;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", color, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
        <Glyph size={12}/>
        <span style={{ flex: 1 }}>{body.text}</span>
      </div>
    );
  }

  const isUser = role === "user";
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        background: isUser ? "linear-gradient(135deg, #3F4549, #1E2225)" : "linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%)",
        display: "grid", placeItems: "center",
        color: isUser ? "var(--silver-100)" : "#0E1A02", fontSize: 10, fontWeight: 700,
      }}>{isUser ? "U" : "TL"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker" style={{ fontSize: 9.5, marginBottom: 4 }}>
          {isUser ? "You" : "Taskloom"}
          {streaming && <span className="mono" style={{ marginLeft: 8, color: "var(--green)" }}>· thinking</span>}
        </div>
        <ThreadMessageBody body={body} onApplyIteration={onApplyIteration} working={working}/>
      </div>
    </div>
  );
}

function ThreadMessageBody({
  body,
  onApplyIteration,
  working,
}: {
  body: ChatBody;
  onApplyIteration: () => void;
  working: boolean;
}) {
  if (body.kind === "text") {
    return <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--silver-100)" }}>{body.text}</div>;
  }
  if (body.kind === "steps") {
    if (body.steps.length === 0) {
      return <div className="mono muted" style={{ fontSize: 11.5, fontStyle: "italic" }}>working…</div>;
    }
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {body.steps.map((step, i) => (
          <li key={i} className="mono" style={{ fontSize: 12, color: "var(--silver-300)", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--green)" }}>›</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (body.kind === "plan") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--silver-100)" }}>{body.draft.summary}</div>
        <PlanCard draft={body.draft}/>
      </div>
    );
  }
  if (body.kind === "diff") {
    return <IterationCard iteration={body.iteration} onApply={onApplyIteration} working={working}/>;
  }
  if (body.kind === "status") {
    const color = body.tone === "error" ? "var(--danger)" : body.tone === "warn" ? "var(--warn)" : body.tone === "ok" ? "var(--green)" : "var(--silver-300)";
    return <div className="mono" style={{ fontSize: 12, color }}>{body.text}</div>;
  }
  return null;
}

function ChatBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        background: isUser ? "linear-gradient(135deg, #3F4549, #1E2225)" : "linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%)",
        display: "grid", placeItems: "center",
        color: isUser ? "var(--silver-100)" : "#0E1A02", fontSize: 10, fontWeight: 700,
      }}>{isUser ? "U" : "TL"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker" style={{ fontSize: 9.5, marginBottom: 2 }}>
          {isUser ? "You" : "Taskloom"}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--silver-100)" }}>{text}</div>
      </div>
    </div>
  );
}

function PlanCard({ draft }: { draft: AppBuilderDraft }) {
  return (
    <div className="card" style={{ padding: 14, marginLeft: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <I.flow size={14} style={{ color: "var(--green)" }}/>
        <div className="kicker">Plan · {draft.plan.steps.length} step{draft.plan.steps.length === 1 ? "" : "s"}</div>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--silver-100)", marginBottom: 8 }}>{draft.plan.title}</div>
      {draft.plan.steps.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
          <span className="mono muted" style={{ fontSize: 11, paddingTop: 1, width: 24 }}>{String(i + 1).padStart(2, "0")}</span>
          <div>
            <div style={{ color: "var(--silver-100)" }}>{step.title}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{step.detail}</div>
          </div>
        </div>
      ))}
      {draft.plan.acceptanceChecks.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="kicker" style={{ marginBottom: 4 }}>Acceptance</div>
          {draft.plan.acceptanceChecks.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--silver-300)", padding: "2px 0" }}>· {c}</div>
          ))}
        </div>
      )}
      {draft.plan.openQuestions.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="kicker" style={{ marginBottom: 4 }}>Open questions</div>
          {draft.plan.openQuestions.map((q, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--warn)", padding: "2px 0" }}>? {q}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function IterationCard({ iteration, onApply, working }: { iteration: AppBuilderIterationResult; onApply: () => void; working: boolean }) {
  return (
    <div className="card" style={{ marginLeft: 30, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <I.branch size={13} style={{ color: "var(--green)" }}/>
        <div style={{ fontSize: 11.5, color: "var(--silver-200)" }}>Latest change · {iteration.files.length} file{iteration.files.length === 1 ? "" : "s"}</div>
        <span className={`pill ${iteration.status === "applied" ? "good" : iteration.status === "blocked" ? "danger" : "warn"}`} style={{ marginLeft: "auto" }}>
          <span className="dot"></span>{iteration.status}
        </span>
      </div>
      <div style={{ padding: "8px 14px", fontSize: 12.5, color: "var(--silver-200)" }}>{iteration.summary}</div>
      <div className="mono" style={{ fontSize: 11.5, padding: "6px 14px" }}>
        {iteration.files.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", color: "var(--silver-300)" }}>
            <span style={{ color: f.changeType === "added" ? "var(--green)" : f.changeType === "modified" ? "var(--warn)" : "var(--danger)", width: 12 }}>
              {f.changeType === "added" ? "A" : f.changeType === "modified" ? "M" : f.changeType === "deleted" ? "D" : "R"}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.path}</span>
          </div>
        ))}
      </div>
      {iteration.status !== "applied" && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)" }}>
          <button className="btn btn-primary btn-sm" disabled={working} onClick={onApply}>
            {working ? <span className="spin"><I.refresh size={11}/></span> : <I.check size={11}/>}
            {working ? " Applying…" : " Apply changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewTab({
  draft,
  previewUrl,
  inspectMode,
  onToggleInspect,
  onSelectElement,
  selectedSelector,
}: {
  draft: AppBuilderDraft;
  previewUrl: string | null;
  inspectMode: boolean;
  onToggleInspect: () => void;
  onSelectElement: (sel: SelectedElement) => void;
  selectedSelector: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [hoverRect, setHoverRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!inspectMode) {
      setHoverRect(null);
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;

    const attach = () => {
      let doc: Document | null = null;
      try { doc = iframe.contentDocument; } catch { doc = null; }
      if (!doc) return;
      doc.body.style.cursor = "crosshair";

      const onMove = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target || target === doc!.documentElement || target === doc!.body) {
          setHoverRect(null);
          return;
        }
        const rect = target.getBoundingClientRect();
        setHoverRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      };
      const onLeave = () => setHoverRect(null);
      const onClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target as HTMLElement | null;
        if (!target) return;
        onSelectElement({
          selector: cssPathFor(target),
          label: (target.textContent ?? "").trim().slice(0, 60),
        });
        setHoverRect(null);
      };
      doc.addEventListener("mousemove", onMove);
      doc.addEventListener("mouseleave", onLeave);
      doc.addEventListener("click", onClick, true);
      return () => {
        doc!.removeEventListener("mousemove", onMove);
        doc!.removeEventListener("mouseleave", onLeave);
        doc!.removeEventListener("click", onClick, true);
        try { doc!.body.style.cursor = ""; } catch { /* ignore */ }
      };
    };

    let cleanup = attach();
    const onLoad = () => {
      if (cleanup) cleanup();
      cleanup = attach();
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      if (cleanup) cleanup();
    };
  }, [inspectMode, previewUrl, onSelectElement]);

  return (
    <div style={{ padding: 20, height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute", top: 28, right: 28, zIndex: 10,
        display: "flex", gap: 6, alignItems: "center",
        padding: "4px 8px",
        background: "var(--panel)",
        border: `1px solid ${inspectMode ? "var(--green-deep)" : "var(--line-2)"}`,
        borderRadius: 8,
      }}>
        <button
          onClick={onToggleInspect}
          title={inspectMode ? "Exit inspect mode" : "Click an element in the preview to scope the next message"}
          style={{
            background: "transparent", border: "none", padding: "2px 6px",
            color: inspectMode ? "var(--green)" : "var(--silver-300)",
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11.5,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <I.zap size={12}/> {inspectMode ? "Inspecting" : "Inspect"}
        </button>
        {selectedSelector && (
          <span className="mono" style={{ fontSize: 10.5, color: "var(--silver-400)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            · {selectedSelector}
          </span>
        )}
      </div>
      {previewUrl ? (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            style={{
              width: "100%", height: "100%",
              border: `1px solid ${inspectMode ? "rgba(184,242,92,0.5)" : "var(--line)"}`,
              borderRadius: 8,
              background: "var(--ink)",
            }}
          />
          {inspectMode && hoverRect && (
            <div style={{
              position: "absolute",
              left: hoverRect.left,
              top: hoverRect.top,
              width: hoverRect.width,
              height: hoverRect.height,
              border: "2px solid var(--green)",
              background: "rgba(184,242,92,0.08)",
              borderRadius: 2,
              pointerEvents: "none",
              boxSizing: "border-box",
            }}/>
          )}
        </div>
      ) : (
        <div className="card grid-bg" style={{ height: "100%", overflow: "hidden", padding: 24 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Preview · not yet live</div>
          <h2 className="h2" style={{ fontSize: 22, marginBottom: 6 }}>{draft.app.name}</h2>
          <p className="muted" style={{ fontSize: 13, maxWidth: 640, marginBottom: 20 }}>{draft.app.description}</p>

          <div className="kicker" style={{ marginBottom: 8 }}>Pages · {draft.app.pages.length}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 20 }}>
            {draft.app.pages.map((p, i) => <PageCard key={i} page={p}/>)}
          </div>

          <div className="kicker" style={{ marginBottom: 8 }}>API routes · {draft.app.apiRoutes.length}</div>
          <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
            <table className="tbl">
              <thead><tr><th>Method</th><th>Path</th><th>Access</th><th>Purpose</th></tr></thead>
              <tbody>
                {draft.app.apiRoutes.map((r, i) => <RouteRow key={i} route={r}/>)}
              </tbody>
            </table>
          </div>

          <div className="kicker" style={{ marginBottom: 8 }}>Data · {draft.app.dataSchema.length} entit{draft.app.dataSchema.length === 1 ? "y" : "ies"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {draft.app.dataSchema.map((e, i) => <DataCard key={i} entity={e}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

function PageCard({ page }: { page: AppBuilderPageDraft }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--green)" }}>{page.route}</span>
        <span className={`pill ${page.access === "private" ? "good" : page.access === "admin" ? "warn" : "muted"}`}><span className="dot"></span>{page.access}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--silver-50)", marginBottom: 4 }}>{page.name}</div>
      <p className="muted" style={{ fontSize: 11.5 }}>{page.purpose}</p>
    </div>
  );
}

function RouteRow({ route }: { route: AppBuilderApiRoute }) {
  return (
    <tr>
      <td><span className={`pill ${route.method === "GET" ? "info" : route.method === "DELETE" ? "danger" : "warn"}`}>{route.method}</span></td>
      <td className="mono" style={{ fontSize: 11.5, color: "var(--silver-50)" }}>{route.path}</td>
      <td><span className="pill muted">{route.access}</span></td>
      <td className="muted" style={{ fontSize: 12 }}>{route.purpose}</td>
    </tr>
  );
}

function DataCard({ entity }: { entity: AppBuilderDataEntity }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <I.database size={13} style={{ color: "var(--green)" }}/>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--silver-50)" }}>{entity.name}</span>
        <span className="mono muted" style={{ fontSize: 10.5, marginLeft: "auto" }}>{entity.fields.length} fields</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {entity.fields.slice(0, 6).map((f) => (
          <span key={f.name} className="mono" style={{ fontSize: 10.5, padding: "2px 6px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 4, color: "var(--silver-200)" }}>
            {f.name}: <span style={{ color: "var(--silver-400)" }}>{f.type}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FilesTab({
  draft,
  iteration,
  sourceFiles,
  workspace,
}: {
  draft: AppBuilderDraft;
  iteration: AppBuilderIterationResult | null;
  sourceFiles: AppBuilderSourceFileSummary[];
  workspace: AppBuilderWorkspaceSummary | null;
}) {
  const files = useMemo<AppBuilderIterationDiffFile[]>(() => iteration?.files ?? [], [iteration]);
  const [selected, setSelected] = useState<number>(0);
  if (files.length === 0) {
    return (
      <div style={{ padding: 22 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Generated workspace</div>
          <h2 className="h2" style={{ marginBottom: 6 }}>Saved source bundle</h2>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            No pending diff. The current checkpoint has {sourceFiles.length || "no"} generated source file{sourceFiles.length === 1 ? "" : "s"}.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 8, fontSize: 12.5, marginBottom: 14 }}>
            <span className="muted">Workspace</span>
            <span className="mono" style={{ color: "var(--silver-200)", overflowWrap: "anywhere" }}>{workspace?.checkpointPath ?? "not written yet"}</span>
            <span className="muted">Manifest</span>
            <span className="mono" style={{ color: "var(--silver-200)", overflowWrap: "anywhere" }}>{workspace?.manifest.path ?? "pending"}</span>
            <span className="muted">App skeleton</span>
            <span className="mono" style={{ color: "var(--silver-200)" }}>{draft.app.pages.length} pages · {draft.app.apiRoutes.length} routes</span>
          </div>
          {sourceFiles.length > 0 && (
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="tbl">
                <thead><tr><th>Path</th><th>Role</th><th>Size</th><th>SHA</th></tr></thead>
                <tbody>
                  {sourceFiles.slice(0, 14).map((file) => (
                    <tr key={file.path}>
                      <td className="mono" style={{ fontSize: 11.5 }}>{file.path}</td>
                      <td><span className="pill muted">{file.role}</span></td>
                      <td className="mono muted" style={{ fontSize: 11.5 }}>{file.size}</td>
                      <td className="mono muted" style={{ fontSize: 11.5 }}>{file.sha256.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }
  const current = files[selected]!;
  return (
    <div style={{ padding: 18, display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, height: "100%" }}>
      <div className="card" style={{ overflow: "auto" }}>
        {files.map((f, i) => (
          <div
            key={i}
            onClick={() => setSelected(i)}
            style={{
              padding: "9px 14px",
              borderBottom: i === files.length - 1 ? "none" : "1px solid var(--line)",
              display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer",
              background: selected === i ? "var(--bg-elev)" : "transparent",
            }}
          >
            <span className="mono" style={{ fontSize: 11, width: 14, color: f.changeType === "added" ? "var(--green)" : f.changeType === "modified" ? "var(--warn)" : "var(--danger)" }}>
              {f.changeType === "added" ? "A" : f.changeType === "modified" ? "M" : f.changeType === "deleted" ? "D" : "R"}
            </span>
            <span className="mono" style={{ fontSize: 11.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--silver-200)" }}>{f.path}</span>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--silver-100)" }}>{current.path}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{current.summary}</div>
        </div>
        <pre className="mono" style={{ margin: 0, padding: 14, fontSize: 11.5, lineHeight: 1.6, background: "var(--ink)", color: "var(--silver-200)", overflow: "auto", flex: 1, whiteSpace: "pre" }}>{current.diff}</pre>
      </div>
    </div>
  );
}

function SmokeTab({ smoke }: { smoke: AppBuilderSmokeBuildStatus | null }) {
  if (!smoke) {
    return (
      <div style={{ padding: 22 }}>
        <div className="card muted" style={{ padding: 22, textAlign: "center" }}>No smoke / build status yet. Approve the draft to run the first build.</div>
      </div>
    );
  }
  return (
    <div style={{ padding: 22, maxWidth: 800 }}>
      <div className="kicker">Quality checks</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4, marginBottom: 14 }}>
        <h2 className="h2">{smoke.message}</h2>
        <span className={`pill ${smoke.status === "pass" ? "good" : smoke.status === "fail" ? "danger" : "warn"}`}><span className="dot"></span>{smoke.status}</span>
      </div>

      {smoke.blockers.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 14, borderColor: "rgba(242,107,92,0.3)", background: "rgba(242,107,92,0.06)" }}>
          <div className="kicker" style={{ marginBottom: 6, color: "var(--danger)" }}>Blockers · {smoke.blockers.length}</div>
          {smoke.blockers.map((b, i) => <div key={i} className="mono" style={{ fontSize: 11.5, color: "var(--danger)" }}>· {b}</div>)}
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        {smoke.checks.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              background: c.status === "pass" ? "rgba(184,242,92,0.1)" : c.status === "fail" ? "rgba(242,107,92,0.1)" : "rgba(242,196,92,0.1)",
              border: `1px solid ${c.status === "pass" ? "var(--green-deep)" : c.status === "fail" ? "var(--danger)" : "var(--warn)"}`,
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              {c.status === "pass" ? <I.check size={11} stroke="var(--green)" strokeWidth={2.5}/> : <I.alert size={11} stroke={c.status === "fail" ? "var(--danger)" : "var(--warn)"}/>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--silver-100)" }}>{c.name}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{c.detail}</div>
            </div>
            <span className={`pill ${c.status === "pass" ? "good" : c.status === "fail" ? "danger" : "warn"}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab({ iteration }: { iteration: AppBuilderIterationResult | null }) {
  const logs = iteration?.logs ?? [];
  return (
    <div style={{ padding: 18 }}>
      <div className="card" style={{ padding: 14, fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.7, background: "var(--ink)", minHeight: 200 }}>
        {logs.length === 0 && <div className="muted" style={{ textAlign: "center", padding: 22 }}>No iteration logs yet.</div>}
        {logs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "var(--silver-500)" }}>{new Date(l.at).toLocaleTimeString()}</span>
            <span style={{ color: l.level === "warn" ? "var(--warn)" : l.level === "error" ? "var(--danger)" : "var(--green)", width: 50 }}>{l.level}</span>
            <span style={{ color: "var(--silver-200)", flex: 1 }}>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckpointsTab({
  checkpoints,
  currentId,
  onRollback,
  onBranch,
  working,
}: {
  checkpoints: AppBuilderCheckpointSummary[];
  currentId: string | null;
  onRollback: (id: string) => void;
  onBranch: (id: string) => void;
  working: boolean;
}) {
  return (
    <div style={{ padding: 22, maxWidth: 880 }}>
      <div className="kicker">Checkpoints · {checkpoints.length} total</div>
      <h2 className="h2" style={{ marginBottom: 14 }}>History</h2>
      {checkpoints.length === 0 && <div className="card muted" style={{ padding: 22, textAlign: "center" }}>No checkpoints yet. Approving the draft creates the first one.</div>}
      <div className="card" style={{ overflow: "hidden" }}>
        {checkpoints.map((c, i) => {
          const isCurrent = c.id === currentId;
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isCurrent ? "var(--green)" : "var(--silver-500)", boxShadow: isCurrent ? "0 0 8px var(--green)" : "none" }}></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</div>
                <div className="muted" style={{ fontSize: 11 }}>Save #{i + 1} · {formatRelative(c.createdAt)} · {c.source}</div>
                <details style={{ marginTop: 4 }}>
                  <summary className="muted" style={{ fontSize: 11, cursor: "pointer" }}>Details</summary>
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>{c.id}{c.previousCheckpointId ? ` · ← ${c.previousCheckpointId}` : ""}</div>
                </details>
              </div>
              <span className="mono muted" style={{ fontSize: 11 }}>{new Date(c.createdAt).toLocaleString()}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {isCurrent && <span className="pill good"><span className="dot"></span>current</span>}
                {!isCurrent && <button className="btn btn-sm" disabled={working} onClick={() => onRollback(c.id)} title="Restore this checkpoint as the current state"><I.history size={11}/> Restore</button>}
                <button className="btn btn-sm" disabled={working} onClick={() => onBranch(c.id)} title="Fork into a new app starting from this checkpoint"><I.branch size={11}/> Branch</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublishTab({
  state,
  canPublish,
  onPublish,
  onRollback,
  working,
}: {
  state: AppBuilderPublishState | null;
  canPublish: boolean;
  onPublish: () => void;
  onRollback: (action: PublishRollbackAction) => void;
  working: boolean;
}) {
  if (!canPublish) {
    return (
      <div style={{ padding: 22 }}>
        <div className="card muted" style={{ padding: 22, textAlign: "center" }}>Approve the draft first — publish handoff requires a saved preview and checkpoint.</div>
      </div>
    );
  }
  if (!state) {
    return <div style={{ padding: 22 }} className="muted">Loading publish state…</div>;
  }
  const readiness = state.readiness;
  const handoffUrl = state.publishedUrl ?? readiness.urlHandoff.privateUrl;
  return (
    <div style={{ padding: 22, maxWidth: 900 }}>
      <div className="kicker">Publish · {state.status}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4, marginBottom: 14 }}>
        <h2 className="h2">{publishReadinessHeading(state)}</h2>
        {handoffUrl && <a href={handoffUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12, color: "var(--green)", textDecoration: "underline" }}>{handoffUrl}</a>}
      </div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, maxWidth: 720, marginBottom: 14 }}>
        This panel records the local publish package, validation checks, and URL handoff. It does not start a separate cloud runtime.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={!state.canPublish || working} onClick={onPublish}>
          {working ? <span className="spin"><I.refresh size={13}/></span> : <I.rocket size={13}/>}
          {publishPrimaryActionLabel(working)}
        </button>
        {state.rollbackActions.map((action) => (
          <button key={action.id} className="btn btn-sm" disabled={action.disabled || working || !action.publishId} onClick={() => onRollback(action)}>
            <I.history size={11}/> {action.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>Local package</div>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, fontSize: 12.5 }}>
          <span className="muted">Runtime</span>
          <span className="mono" style={{ color: "var(--silver-200)" }}>{readiness.packaging.runtime}</span>
          <span className="muted">Bundle path</span>
          <span className="mono" style={{ color: "var(--silver-200)" }}>{readiness.localPublishPath}</span>
          <span className="muted">Artifacts</span>
          <span className="mono" style={{ color: "var(--silver-200)" }}>{readiness.packaging.artifactPaths.join(", ")}</span>
        </div>
      </div>

      {state.nextActions.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Next actions</div>
          {state.nextActions.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: "var(--silver-300)", padding: "2px 0" }}>· {a}</div>)}
        </div>
      )}

      {state.history.length > 0 && (
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>History · {state.history.length}</div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead><tr><th>Publish</th><th>Status</th><th>Actor</th><th>Recorded</th><th>Handoff URL</th></tr></thead>
              <tbody>
                {state.history.map((h, i) => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 11.5 }}>
                      <details>
                        <summary style={{ cursor: "pointer" }}>Publish #{i + 1} · {h.publishedAt ? formatRelative(h.publishedAt) : "—"}</summary>
                        <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>{h.id}</div>
                      </details>
                    </td>
                    <td><span className={`pill ${h.status === "published" ? "good" : h.status === "rolled_back" ? "warn" : "muted"}`}><span className="dot"></span>{h.status}</span></td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{h.actor ?? "—"}</td>
                    <td className="mono muted" style={{ fontSize: 11.5 }}>{h.publishedAt ? new Date(h.publishedAt).toLocaleString() : "—"}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{h.url ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SandboxBuilderTab({ appId, appName }: { appId: string | null; appName: string }) {
  const execs = useApiData(
    () => (appId ? api.listSandboxExecs({ appId, limit: 50 }) : Promise.resolve([])),
    [appId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = execs.data ?? [];
  const selected = useMemo(() => list.find((e) => e.id === selectedId) ?? null, [list, selectedId]);

  if (!appId) {
    return (
      <div style={{ padding: 22 }}>
        <div className="card muted" style={{ padding: 22, textAlign: "center" }}>
          Approve the draft first — sandbox executions are scoped to a saved app.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <div className="kicker">Sandbox runs · {appName}</div>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => void execs.refresh()}>
          <I.refresh size={11}/> Refresh
        </button>
      </div>
      {execs.loading && <div className="muted" style={{ padding: 12 }}>Loading…</div>}
      {execs.error && <div className="card" style={{ padding: 14, color: "var(--danger)" }}>{execs.error}</div>}
      <ExecTable
        execs={list}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCancel={async (id) => { await api.cancelSandboxExec(id).catch(() => {}); void execs.refresh(); }}
      />
      {selected && (
        <div style={{ marginTop: 14 }}>
          <SelectedExecPanel
            exec={selected}
            onCancel={async () => { await api.cancelSandboxExec(selected.id).catch(() => {}); void execs.refresh(); }}
            onClose={() => setSelectedId(null)}
            onUpdate={() => { void execs.refresh(); }}
          />
        </div>
      )}
    </div>
  );
}
