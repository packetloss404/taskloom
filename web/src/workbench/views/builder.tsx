import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { I, type IconKey } from "../icons";
import { Topbar } from "../Shell";
import { api } from "@/lib/api";
import { useApiData } from "../useApiData";
import { ExecTable, SelectedExecPanel } from "./sandbox";
import type {
  AppBuilderApproveResult,
  AppBuilderApiRoute,
  AppBuilderCheckpointSummary,
  AppBuilderDataEntity,
  AppBuilderDraft,
  AppBuilderIterationDiffFile,
  AppBuilderIterationResult,
  AppBuilderIterationTarget,
  AppBuilderIterationTargetKind,
  AppBuilderPageDraft,
  AppBuilderPublishState,
  AppBuilderSmokeBuildStatus,
} from "@/lib/types";

type Mode = "empty" | "drafting" | "drafted" | "applying" | "applied" | "iterating";

interface BuilderState {
  draft: AppBuilderDraft | null;
  appId: string | null;
  checkpointId: string | null;
  previewUrl: string | null;
  smoke: AppBuilderSmokeBuildStatus | null;
  iteration: AppBuilderIterationResult | null;
}

const TARGET_KINDS: { kind: AppBuilderIterationTargetKind; label: string }[] = [
  { kind: "app", label: "Whole app" },
  { kind: "page", label: "Page" },
  { kind: "data_entity", label: "Data" },
  { kind: "api_route", label: "API route" },
  { kind: "auth", label: "Auth" },
  { kind: "smoke", label: "Smoke / build" },
];

export function BuilderView() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("empty");
  const [prompt, setPrompt] = useState("");
  const [iterPrompt, setIterPrompt] = useState("");
  const [iterTargetKind, setIterTargetKind] = useState<AppBuilderIterationTargetKind>("app");
  const [iterTargetLabel, setIterTargetLabel] = useState<string>("Whole app");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<"preview" | "files" | "smoke" | "logs" | "sandbox" | "checkpoints" | "publish">("preview");
  const [checkpoints, setCheckpoints] = useState<AppBuilderCheckpointSummary[]>([]);
  const [publishState, setPublishState] = useState<AppBuilderPublishState | null>(null);

  const [state, setState] = useState<BuilderState>({
    draft: null, appId: null, checkpointId: null, previewUrl: null, smoke: null, iteration: null,
  });

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
    if (!prompt.trim() || working) return;
    setWorking(true);
    setError(null);
    setMode("drafting");
    try {
      const draft = await api.generateAppBuilderDraft({ prompt });
      setState((prev) => ({ ...prev, draft, iteration: null }));
      setMode("drafted");
    } catch (e) {
      setError((e as Error).message);
      setMode("empty");
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
      const result: AppBuilderApproveResult = await api.approveAppBuilderDraft({ draft: state.draft, runBuild: true, runSmoke: true, targetStatus: "built" });
      setState({
        draft: result.draft,
        appId: result.app?.id ?? null,
        checkpointId: result.checkpoint?.id ?? null,
        previewUrl: result.previewUrl ?? result.app?.previewUrl ?? null,
        smoke: result.smoke ?? result.smokeBuild ?? null,
        iteration: null,
      });
      setMode("applied");
      setTab("preview");
    } catch (e) {
      setError((e as Error).message);
      setMode("drafted");
    } finally {
      setWorking(false);
    }
  };

  const iterate = async () => {
    if (!state.draft || !iterPrompt.trim() || working) return;
    const target: AppBuilderIterationTarget = {
      id: `target_${iterTargetKind}_${Date.now().toString(36)}`,
      kind: iterTargetKind,
      label: iterTargetLabel,
    };
    setWorking(true);
    setError(null);
    setMode("iterating");
    try {
      const result = await api.generateAppBuilderIteration({
        appId: state.appId ?? undefined,
        checkpointId: state.checkpointId ?? undefined,
        draft: state.draft,
        target,
        prompt: iterPrompt,
      });
      setState((prev) => ({ ...prev, iteration: result }));
      setMode("applied");
    } catch (e) {
      setError((e as Error).message);
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
        checkpointId: result.checkpoint?.id ?? prev.checkpointId,
        previewUrl: result.preview?.previewUrl ?? result.previewUrl ?? prev.previewUrl,
        smoke: result.smoke ?? prev.smoke,
        iteration: null,
      }));
      setIterPrompt("");
    } catch (e) {
      setError((e as Error).message);
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
        checkpointId: result.checkpoint?.id ?? prev.checkpointId,
        previewUrl: result.preview?.url ?? prev.previewUrl,
      }));
      const cps = await api.listBuilderCheckpoints({ appId: state.appId });
      setCheckpoints(cps.checkpoints);
    } catch (e) {
      setError((e as Error).message);
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

  const draft = state.draft;

  return (
    <>
      <Topbar
        crumbs={["__WS__", "Builder", draft?.app.name ?? "Untitled"]}
        actions={
          <>
            {state.appId && (
              <button className="top-btn" onClick={() => navigate(`/builder/preview/workspace/${draft?.app.slug ?? "app"}`)}>
                <I.eye size={13}/> Preview
              </button>
            )}
            <button className="top-btn" onClick={() => setTab("checkpoints")}><I.history size={13}/> Checkpoints</button>
            {state.appId && <button className="top-btn" onClick={() => setTab("publish")}><I.rocket size={13}/> Publish</button>}
          </>
        }
      />

      {mode === "empty" && (
        <div style={{ padding: "60px 32px", maxWidth: 760, margin: "0 auto" }}>
          <div className="kicker">START A BUILD</div>
          <h1 className="h1" style={{ fontSize: 32, marginTop: 6, marginBottom: 6 }}>Describe the app you want to build.</h1>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>
            The builder drafts a plan with pages, data, API routes, and auth decisions. Approve to apply,
            iterate to refine, and publish when smoke checks are green.
          </p>
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <textarea
              className="field"
              style={{ background: "transparent", border: "none", padding: 0, fontSize: 15, minHeight: 100, resize: "vertical" }}
              placeholder="e.g. A lightweight CRM for account managers to track companies, contacts, and renewal risk…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <span className="mono muted" style={{ fontSize: 11 }}>{prompt.length} chars</span>
              <button className="btn btn-primary" disabled={!prompt.trim() || working} onClick={() => { void generate(); }}>
                {working ? <span className="spin"><I.refresh size={13}/></span> : <I.arrowUp size={13}/>}
                {working ? " Drafting…" : " Generate draft"}
              </button>
            </div>
          </div>
          {error && <div className="card" style={{ padding: "10px 14px", borderColor: "rgba(242,107,92,0.3)", color: "var(--danger)" }}><span className="mono" style={{ fontSize: 11.5 }}>ERR · {error}</span></div>}
        </div>
      )}

      {(mode === "drafted" || mode === "applying" || mode === "applied" || mode === "iterating") && draft && (
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", height: "calc(100vh - 52px)" }}>
          <aside style={{ borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", background: "var(--bg-elev)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
              <div className="kicker">PROJECT</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <I.layout size={15} style={{ color: "var(--green)" }}/>
                <div className="h3" style={{ fontSize: 14 }}>{draft.app.name}</div>
                {state.appId
                  ? <span className="pill good" style={{ marginLeft: "auto" }}><span className="dot"></span>built</span>
                  : <span className="pill warn" style={{ marginLeft: "auto" }}><span className="dot"></span>draft</span>}
              </div>
              <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>
                {state.checkpointId ? `${state.checkpointId.slice(0, 12)} · ` : ""}/{draft.app.slug} · {draft.app.pages.length} pages · {draft.app.dataSchema.length} entities · {draft.app.apiRoutes.length} routes
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <ChatBubble role="user" text={draft.prompt}/>
              <ChatBubble role="assistant" text={draft.summary}/>

              <PlanCard draft={draft}/>
              {state.iteration && <IterationCard iteration={state.iteration} onApply={() => { void applyIteration(); }} working={working}/>}

              {!state.appId && mode === "drafted" && (
                <div className="card" style={{ padding: 14, marginLeft: 30, background: "var(--bg-elev)", borderColor: "var(--green-deep)" }}>
                  <div className="kicker" style={{ marginBottom: 6, color: "var(--green)" }}>READY TO APPROVE</div>
                  <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Approving applies the draft, runs build + smoke, and creates a checkpoint.</p>
                  <button className="btn btn-primary" disabled={working} onClick={() => { void approve(); }}>
                    {working ? <span className="spin"><I.refresh size={13}/></span> : <I.check size={13}/>}
                    {working ? " Applying…" : " Approve & apply"}
                  </button>
                </div>
              )}
            </div>

            {state.appId && (
              <div style={{ padding: 12, borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  {TARGET_KINDS.map((t) => {
                    const active = iterTargetKind === t.kind;
                    return (
                      <button key={t.kind} className="btn btn-sm" onClick={() => { setIterTargetKind(t.kind); setIterTargetLabel(t.label); }} style={{
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
                <div style={{ position: "relative" }}>
                  <textarea
                    className="field"
                    placeholder="Refine — e.g. 'add inline notes' or 'fix smoke check'"
                    value={iterPrompt}
                    onChange={(e) => setIterPrompt(e.target.value)}
                    style={{ paddingRight: 80, minHeight: 64 }}
                  />
                  <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", gap: 4 }}>
                    <button className="btn-primary btn btn-sm" disabled={!iterPrompt.trim() || working} onClick={() => { void iterate(); }}>
                      {working ? <span className="spin"><I.refresh size={11}/></span> : <I.arrowUp size={12}/>}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span className="pill muted">target: {iterTargetKind}</span>
                  {state.smoke && <span className={`pill ${state.smoke.status === "pass" ? "good" : state.smoke.status === "fail" ? "danger" : "warn"}`}><span className="dot"></span>build {state.smoke.status}</span>}
                </div>
              </div>
            )}
          </aside>

          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="tabbar">
              {([
                { id: "preview", label: "Preview", icon: "eye" as IconKey },
                { id: "files", label: "Files", icon: "code" as IconKey, count: state.iteration?.files.length ?? 0 },
                { id: "smoke", label: "Smoke / Build", icon: "shield" as IconKey },
                { id: "logs", label: "Logs", icon: "activity" as IconKey, count: state.iteration?.logs.length ?? 0 },
                { id: "sandbox", label: "Sandbox", icon: "cpu" as IconKey },
                { id: "checkpoints", label: "Checkpoints", icon: "history" as IconKey, count: checkpoints.length },
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
              {tab === "preview" && <PreviewTab draft={draft} previewUrl={state.previewUrl}/>}
              {tab === "files" && <FilesTab draft={draft} iteration={state.iteration}/>}
              {tab === "smoke" && <SmokeTab smoke={state.smoke ?? draft.smokeBuildStatus}/>}
              {tab === "logs" && <LogsTab iteration={state.iteration}/>}
              {tab === "sandbox" && <SandboxBuilderTab appId={state.appId}/>}
              {tab === "checkpoints" && <CheckpointsTab checkpoints={checkpoints} currentId={state.checkpointId} onRollback={(id) => { void rollback(id); }} working={working}/>}
              {tab === "publish" && <PublishTab state={publishState} canPublish={!!state.appId} onPublish={() => { void publish(); }} working={working}/>}
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
        <div className="kicker">PLAN · {draft.plan.steps.length} STEP{draft.plan.steps.length === 1 ? "" : "S"}</div>
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
          <div className="kicker" style={{ marginBottom: 4 }}>ACCEPTANCE</div>
          {draft.plan.acceptanceChecks.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--silver-300)", padding: "2px 0" }}>· {c}</div>
          ))}
        </div>
      )}
      {draft.plan.openQuestions.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="kicker" style={{ marginBottom: 4 }}>OPEN QUESTIONS</div>
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
        <div className="mono" style={{ fontSize: 11.5, color: "var(--silver-200)" }}>{iteration.id.slice(0, 12)} · {iteration.files.length} file{iteration.files.length === 1 ? "" : "s"}</div>
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
            {working ? " Applying…" : " Apply diff"}
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewTab({ draft, previewUrl }: { draft: AppBuilderDraft; previewUrl: string | null }) {
  return (
    <div style={{ padding: 20, height: "100%" }}>
      {previewUrl ? (
        <iframe src={previewUrl} style={{ width: "100%", height: "100%", border: "1px solid var(--line)", borderRadius: 8, background: "var(--ink)" }}/>
      ) : (
        <div className="card grid-bg" style={{ height: "100%", overflow: "hidden", padding: 24 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>PREVIEW · NOT YET LIVE</div>
          <h2 className="h2" style={{ fontSize: 22, marginBottom: 6 }}>{draft.app.name}</h2>
          <p className="muted" style={{ fontSize: 13, maxWidth: 640, marginBottom: 20 }}>{draft.app.description}</p>

          <div className="kicker" style={{ marginBottom: 8 }}>PAGES · {draft.app.pages.length}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 20 }}>
            {draft.app.pages.map((p, i) => <PageCard key={i} page={p}/>)}
          </div>

          <div className="kicker" style={{ marginBottom: 8 }}>API ROUTES · {draft.app.apiRoutes.length}</div>
          <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
            <table className="tbl">
              <thead><tr><th>Method</th><th>Path</th><th>Access</th><th>Purpose</th></tr></thead>
              <tbody>
                {draft.app.apiRoutes.map((r, i) => <RouteRow key={i} route={r}/>)}
              </tbody>
            </table>
          </div>

          <div className="kicker" style={{ marginBottom: 8 }}>DATA · {draft.app.dataSchema.length} ENTIT{draft.app.dataSchema.length === 1 ? "Y" : "IES"}</div>
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

function FilesTab({ draft, iteration }: { draft: AppBuilderDraft; iteration: AppBuilderIterationResult | null }) {
  const files = useMemo<AppBuilderIterationDiffFile[]>(() => iteration?.files ?? [], [iteration]);
  const [selected, setSelected] = useState<number>(0);
  if (files.length === 0) {
    return (
      <div style={{ padding: 22 }}>
        <div className="card muted" style={{ padding: 22, textAlign: "center" }}>
          No files in current diff. Iterate to generate file changes.
          <div className="mono muted" style={{ fontSize: 11, marginTop: 8 }}>App skeleton: {draft.app.pages.length} pages · {draft.app.apiRoutes.length} routes</div>
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
      <div className="kicker">SMOKE / BUILD STATUS</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4, marginBottom: 14 }}>
        <h2 className="h2">{smoke.message}</h2>
        <span className={`pill ${smoke.status === "pass" ? "good" : smoke.status === "fail" ? "danger" : "warn"}`}><span className="dot"></span>{smoke.status}</span>
      </div>

      {smoke.blockers.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 14, borderColor: "rgba(242,107,92,0.3)", background: "rgba(242,107,92,0.06)" }}>
          <div className="kicker" style={{ marginBottom: 6, color: "var(--danger)" }}>BLOCKERS · {smoke.blockers.length}</div>
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

function CheckpointsTab({ checkpoints, currentId, onRollback, working }: { checkpoints: AppBuilderCheckpointSummary[]; currentId: string | null; onRollback: (id: string) => void; working: boolean }) {
  return (
    <div style={{ padding: 22, maxWidth: 800 }}>
      <div className="kicker">CHECKPOINTS · {checkpoints.length} TOTAL</div>
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
                <div className="mono muted" style={{ fontSize: 11 }}>{c.id.slice(0, 16)}{c.previousCheckpointId ? ` · ← ${c.previousCheckpointId.slice(0, 12)}` : ""} · {c.source}</div>
              </div>
              <span className="mono muted" style={{ fontSize: 11 }}>{new Date(c.createdAt).toLocaleString()}</span>
              {isCurrent
                ? <span className="pill good"><span className="dot"></span>current</span>
                : <button className="btn btn-sm" disabled={working} onClick={() => onRollback(c.id)}><I.history size={11}/> Restore</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublishTab({ state, canPublish, onPublish, working }: { state: AppBuilderPublishState | null; canPublish: boolean; onPublish: () => void; working: boolean }) {
  if (!canPublish) {
    return (
      <div style={{ padding: 22 }}>
        <div className="card muted" style={{ padding: 22, textAlign: "center" }}>Approve the draft first — publishing requires a saved app.</div>
      </div>
    );
  }
  if (!state) {
    return <div style={{ padding: 22 }} className="muted">Loading publish state…</div>;
  }
  return (
    <div style={{ padding: 22, maxWidth: 900 }}>
      <div className="kicker">PUBLISH · STATUS: {state.status.toUpperCase()}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4, marginBottom: 14 }}>
        <h2 className="h2">{state.canPublish ? "Ready to publish" : "Not ready"}</h2>
        {state.publishedUrl && <a href={state.publishedUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12, color: "var(--green)", textDecoration: "underline" }}>{state.publishedUrl}</a>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={!state.canPublish || working} onClick={onPublish}>
          {working ? <span className="spin"><I.refresh size={13}/></span> : <I.rocket size={13}/>}
          {working ? " Publishing…" : " Publish now"}
        </button>
        {state.rollbackActions.map((action) => (
          <button key={action.id} className="btn btn-sm" disabled={action.disabled || working}>
            <I.history size={11}/> {action.label}
          </button>
        ))}
      </div>

      {state.nextActions.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>NEXT ACTIONS</div>
          {state.nextActions.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: "var(--silver-300)", padding: "2px 0" }}>· {a}</div>)}
        </div>
      )}

      {state.history.length > 0 && (
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>HISTORY · {state.history.length}</div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead><tr><th>ID</th><th>Status</th><th>Actor</th><th>Published</th><th>URL</th></tr></thead>
              <tbody>
                {state.history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{h.id.slice(0, 16)}</td>
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

function SandboxBuilderTab({ appId }: { appId: string | null }) {
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
        <div className="kicker">SANDBOX EXECUTIONS · APP {appId.slice(0, 12)}</div>
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
