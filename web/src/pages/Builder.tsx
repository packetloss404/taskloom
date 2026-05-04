import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  Bug,
  Check,
  Code2,
  Database,
  FileCode2,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Route,
  Rocket,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
  Wand2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canManageWorkspaceRole } from "@/lib/roles";
import type {
  AgentBuilderApproveResult,
  AgentBuilderDraft,
  AgentStatus,
  AgentTemplate,
  BuilderModelPreset,
  BuilderModelPresetId,
  AppBuilderApproveResult,
  AppBuilderCheckpointSummary,
  AppBuilderDraft,
  AppBuilderIterationResult,
  AppBuilderIterationTarget,
  AppBuilderPublishState,
  BootstrapPayload,
  IntegrationReadinessSummary,
} from "@/lib/types";

type BuilderFlowState = "empty" | "generating" | "needs_clarification" | "ready" | "approving" | "approved" | "running" | "error";
type BuilderMode = "agent" | "app";
type IterationPanel = "preview" | "logs" | "smoke" | "error_fix" | "checkpoints";

interface StarterPrompt {
  id: string;
  label: string;
  category: string;
  outcome: string;
  prompt: string;
}

const BUILDER_MODEL_PRESETS: BuilderModelPreset[] = [
  {
    id: "fast",
    label: "Fast",
    model: "auto-fast",
    summary: "Low-latency drafts, summaries, and interactive agent turns.",
    bestFor: "First passes, small edits, and quick preview loops.",
  },
  {
    id: "smart",
    label: "Smart",
    model: "auto-smart",
    summary: "Heavier reasoning, review, and planning work where quality matters most.",
    bestFor: "Auth, payments, data-heavy apps, and release checks.",
  },
  {
    id: "cheap",
    label: "Cheap",
    model: "auto-cheap",
    summary: "High-volume background work with cost-aware hosted fallbacks.",
    bestFor: "Bulk generation, cleanup passes, and repeatable smoke checks.",
  },
  {
    id: "local",
    label: "Local",
    model: "auto-local",
    summary: "Private local development first, with hosted providers only as fallback.",
    bestFor: "Self-hosted builds, offline-friendly testing, and private data.",
  },
];

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: "lead-enrichment",
    label: "Lead enrichment",
    category: "sales",
    outcome: "Daily sales-ready account research",
    prompt: "Build an agent that reviews new leads daily, researches each company website, enriches the lead record, and writes a concise sales-ready summary.",
  },
  {
    id: "support-triage",
    label: "Support triage",
    category: "support",
    outcome: "Incident intake with owner-ready summaries",
    prompt: "Create a webhook agent to triage customer incidents, open blockers for critical risks, and log a concise summary.",
  },
  {
    id: "research-assistant",
    label: "Research assistant",
    category: "research",
    outcome: "Source review and follow-up questions",
    prompt: "Create a research assistant agent that reviews a source URL, extracts the important claims, captures open questions, and reports the next action.",
  },
  {
    id: "scheduled-report",
    label: "Scheduled report",
    category: "operations",
    outcome: "A recurring operator update",
    prompt: "Build an agent that monitors support tickets daily, summarizes urgent escalations, opens blockers for unresolved incidents, and reports outcomes to operators.",
  },
];

const APP_STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: "crm",
    label: "CRM",
    category: "sales",
    outcome: "Accounts, opportunities, notes, and renewal risk",
    prompt: "Build a lightweight CRM app for account managers to track companies, contacts, opportunities, notes, next steps, and renewal risk.",
  },
  {
    id: "booking-app",
    label: "Booking app",
    category: "scheduling",
    outcome: "Customer booking flow with confirmations",
    prompt: "Create a booking app where customers can choose a service, pick available times, submit contact details, and receive a confirmation workflow.",
  },
  {
    id: "internal-dashboard",
    label: "Internal dashboard",
    category: "operations",
    outcome: "Queues, alerts, owners, and service health",
    prompt: "Build an internal dashboard for operators to monitor work queues, alerts, service health, team ownership, and follow-up actions.",
  },
  {
    id: "task-tracker",
    label: "Task tracker",
    category: "productivity",
    outcome: "Projects, task status, and review queue",
    prompt: "Create a task tracker app with projects, tasks, assignees, statuses, due dates, comments, filters, and a simple review queue.",
  },
  {
    id: "customer-portal",
    label: "Customer portal",
    category: "support",
    outcome: "Customer requests, documents, and messages",
    prompt: "Build a customer portal for customers to manage profile details, open requests, view request status, upload documents, and message the team.",
  },
];

const FLOW_STEPS: Array<{ state: BuilderFlowState; label: string }> = [
  { state: "empty", label: "Prompt" },
  { state: "generating", label: "Plan" },
  { state: "approving", label: "Approve" },
  { state: "approved", label: "Run" },
];

function buildAppIterationTargets(draft: AppBuilderDraft | null): AppBuilderIterationTarget[] {
  if (!draft) return [];
  return [
    { id: "app", kind: "app" as const, label: draft.app.name, path: `/${draft.app.slug}` },
    ...draft.app.pages.map((page) => ({ id: `page:${page.route}`, kind: "page" as const, label: page.name, path: page.route })),
    ...draft.app.dataSchema.map((entity) => ({ id: `data:${entity.name}`, kind: "data_entity" as const, label: entity.name })),
    ...draft.app.apiRoutes.map((route) => ({ id: `api:${route.method}:${route.path}`, kind: "api_route" as const, label: `${route.method} ${route.path}`, path: route.path })),
    ...draft.app.authDecisions.map((decision) => ({ id: `auth:${decision.area}`, kind: "auth" as const, label: decision.area })),
    { id: "smoke", kind: "smoke", label: "Smoke/build checks" },
    { id: "config", kind: "config", label: "Generated app config" },
  ];
}

function createPlaceholderIterationDiff({
  appId,
  checkpointId,
  target,
  prompt,
  previewUrl,
  smoke,
}: {
  appId?: string;
  checkpointId?: string;
  target: AppBuilderIterationTarget;
  prompt: string;
  previewUrl?: string;
  smoke: AppBuilderDraft["smokeBuildStatus"];
}): AppBuilderIterationResult {
  return {
    id: `placeholder-${Date.now()}`,
    appId,
    checkpointId,
    target,
    prompt,
    summary: "Phase 69 iteration client is ready, but the backend diff generator is still a placeholder in this environment.",
    status: "pending",
    files: [
      {
        path: target.path ?? target.label,
        changeType: "modified",
        summary: "Placeholder diff preview for the selected scope.",
        diff: `@@ ${target.label}\n- Existing generated app implementation\n+ ${prompt}`,
      },
    ],
    preview: {
      url: previewUrl,
      status: "pending",
      message: "Preview refresh will run after the backend applies the generated diff to a checkpoint.",
    },
    logs: [
      {
        at: new Date().toISOString(),
        level: "warn",
        message: "POST /api/app/builder/app-iteration is not wired yet; showing typed placeholder diff.",
      },
    ],
    smoke,
    errorFix: smoke.blockers[0]
      ? {
          source: "smoke",
          message: smoke.blockers[0],
          prompt: `Fix this generated app smoke failure in ${target.label}: ${smoke.blockers[0]}`,
        }
      : undefined,
  };
}

function createFallbackPublishState({
  draft,
  approval,
  appId,
  checkpointId,
  workspaceSlug,
  checkpoints,
}: {
  draft: AppBuilderDraft;
  approval?: AppBuilderApproveResult | null;
  appId?: string;
  checkpointId?: string;
  workspaceSlug?: string;
  checkpoints: AppBuilderCheckpointSummary[];
}): AppBuilderPublishState {
  const normalizedWorkspace = slugifySegment(workspaceSlug || "workspace");
  const draftSlug = slugifySegment(draft.app.slug || draft.app.name || "generated-app");
  const localPublishPath = `data/published-apps/${normalizedWorkspace}/${draftSlug}`;
  const privateUrl = `/builder/preview/${normalizedWorkspace}/${appId || draftSlug}`;
  const publicUrl = `https://apps.taskloom.example/${normalizedWorkspace}/${draftSlug}`;
  const smokeReady = (approval?.smokeBuild ?? draft.smokeBuildStatus).status === "pass";
  const handoffUrl = approval?.previewUrl ?? approval?.app?.previewUrl ?? privateUrl;
  const checkpointHistory = checkpoints.length > 0
    ? checkpoints
    : checkpointId
      ? [{
        id: checkpointId,
        appId,
        label: "Saved app checkpoint",
        source: "builder",
        buildStatus: approval?.build?.status ?? approval?.app?.status,
        smokeStatus: approval?.smokeBuild?.status ?? draft.smokeBuildStatus.status,
        createdAt: approval?.checkpoint?.savedAt ?? approval?.app?.createdAt ?? new Date().toISOString(),
      }]
      : [];
  const readiness = {
    version: "phase-70-builder-fallback",
    draftSlug,
    workspaceSlug: normalizedWorkspace,
    localPublishPath,
    packaging: {
      runtime: "hono-vite",
      notes: [
        "Use the existing Hono server as the generated app host.",
        "Build the Vite client before exporting self-hosted assets.",
        "Keep generated app assets under the local publish path.",
      ],
      buildCommands: ["npm ci", "npm run build:web", "npm run typecheck"],
      artifactPaths: ["src/server.ts", "web/dist", localPublishPath],
    },
    envChecklist: [
      { name: "NODE_ENV", required: true, purpose: "Set to production for hosted app drafts." },
      { name: "PORT", required: true, purpose: "Port exposed by the Hono server." },
      { name: "TASKLOOM_STORE", required: true, purpose: "Selects the runtime store posture for the API." },
      { name: "TASKLOOM_PUBLIC_APP_BASE_URL", required: false, purpose: "External URL handed to public users after publish." },
      { name: "TASKLOOM_PRIVATE_APP_BASE_URL", required: false, purpose: "Internal operator URL used for admin smoke checks." },
    ],
    dockerComposeExport: {
      fileName: "docker-compose.publish.yml",
      services: ["taskloom-app", "taskloom-db"],
      outline: [
        "Build taskloom-app from the repository root.",
        "Mount the local publish path read-only into the app container.",
        "Run ready health before shifting public traffic.",
      ],
      contents: dockerComposeForPublish(localPublishPath),
    },
    healthCheck: {
      livePath: "/api/health/live",
      readyPath: "/api/health/ready",
      command: `curl -fsS ${privateUrl}/api/health/ready`,
    },
    smokeCheck: {
      command: `curl -fsS ${privateUrl}/api/health/live && curl -fsS ${privateUrl}/api/health/ready`,
      expected: [
        "Live health returns 200.",
        "Ready health returns 200.",
        "Generated app draft is reachable at the private handoff URL.",
      ],
    },
    rollbackNote: `Keep the previous publish directory until smoke checks pass; rollback by repointing hosting to the last known-good directory beside ${localPublishPath}.`,
    urlHandoff: {
      visibility: "private" as const,
      publicUrl,
      privateUrl,
      notes: [
        "Hold the public URL until workspace approval changes visibility to public.",
        "Use the private URL for reviewer handoff and smoke verification.",
      ],
    },
  };

  return {
    appId,
    checkpointId,
    status: smokeReady && appId ? "ready" : "not_started",
    publishedUrl: handoffUrl,
    readiness,
    logs: [
      {
        at: new Date().toISOString(),
        level: smokeReady ? "info" : "warn",
        message: smokeReady
          ? "Self-hosted publish readiness derived from the saved builder checkpoint."
          : "Publish is blocked until smoke/build checks pass.",
      },
    ],
    history: checkpointHistory.map((checkpoint, index) => ({
      id: checkpoint.id,
      status: index === 0 && smokeReady ? "ready" : "not_started",
      url: checkpoint.previewUrl ?? handoffUrl,
      checkpointId: checkpoint.id,
      publishedAt: checkpoint.createdAt,
      summary: `${checkpoint.label} · ${checkpoint.buildStatus ?? "build"} · ${checkpoint.smokeStatus ?? "smoke"}`,
    })),
    nextActions: [
      smokeReady ? "Click publish to create the self-hosted handoff." : "Resolve smoke/build blockers before publish.",
      "Confirm required environment variables.",
      "Export Docker Compose and run health checks.",
      "Keep rollback target available until post-publish smoke passes.",
    ],
    canPublish: Boolean(appId && smokeReady),
    rollbackActions: checkpointHistory.map((checkpoint, index) => ({
      id: `checkpoint-${checkpoint.id}`,
      label: index === 0 ? "Current checkpoint" : `Roll back to ${checkpoint.label}`,
      checkpointId: checkpoint.id,
      disabled: index === 0,
    })),
  };
}

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "generated-app";
}

function dockerComposeForPublish(localPublishPath: string): string {
  return [
    "services:",
    "  taskloom-app:",
    "    build: .",
    "    environment:",
    "      NODE_ENV: production",
    "      PORT: 8484",
    "      TASKLOOM_STORE: postgres",
    "    ports:",
    '      - "8484:8484"',
    "    volumes:",
    `      - ./${localPublishPath}:/app/published-app:ro`,
    "    depends_on:",
    "      - taskloom-db",
    "  taskloom-db:",
    "    image: postgres:16",
    "    environment:",
    "      POSTGRES_DB: taskloom",
    "      POSTGRES_USER: taskloom",
    "      POSTGRES_PASSWORD: taskloom",
  ].join("\n");
}

export default function BuilderPage() {
  const { session } = useAuth();
  const canBuild = canManageWorkspaceRole(session?.workspace.role);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [modelPresets, setModelPresets] = useState<BuilderModelPreset[]>(BUILDER_MODEL_PRESETS);
  const [selectedModelPresetId, setSelectedModelPresetId] = useState<BuilderModelPresetId>("smart");
  const [readiness, setReadiness] = useState<IntegrationReadinessSummary | null>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("agent");
  const [prompt, setPrompt] = useState(STARTER_PROMPTS[1].prompt);
  const [selectedPromptId, setSelectedPromptId] = useState(STARTER_PROMPTS[1].id);
  const [draft, setDraft] = useState<AgentBuilderDraft | null>(null);
  const [approval, setApproval] = useState<AgentBuilderApproveResult | null>(null);
  const [appDraft, setAppDraft] = useState<AppBuilderDraft | null>(null);
  const [appApproval, setAppApproval] = useState<AppBuilderApproveResult | null>(null);
  const [flowState, setFlowState] = useState<BuilderFlowState>("empty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [iterationPrompt, setIterationPrompt] = useState("Tighten the primary workflow and keep the generated app behavior unchanged elsewhere.");
  const [iterationTargetId, setIterationTargetId] = useState("app");
  const [iterationResult, setIterationResult] = useState<AppBuilderIterationResult | null>(null);
  const [iterationLoading, setIterationLoading] = useState(false);
  const [iterationPanel, setIterationPanel] = useState<IterationPanel>("preview");
  const [appCheckpoints, setAppCheckpoints] = useState<AppBuilderCheckpointSummary[]>([]);
  const [publishState, setPublishState] = useState<AppBuilderPublishState | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);

  const loadBuilder = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBootstrap, nextTemplates, nextReadiness, nextModelPresets] = await Promise.all([
        api.getBootstrap().catch(() => null),
        api.listAgentTemplates().catch(() => [] as AgentTemplate[]),
        api.getIntegrationReadiness().catch(() => null),
        api.listBuilderModelPresets().catch(() => BUILDER_MODEL_PRESETS),
      ]);
      setBootstrap(nextBootstrap);
      setTemplates(nextTemplates);
      setReadiness(nextReadiness);
      setModelPresets(nextModelPresets.length > 0 ? nextModelPresets : BUILDER_MODEL_PRESETS);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBuilder();
  }, []);

  const onboardingItems = bootstrap?.activation.summary.items ?? [];
  const activeDraft = approval?.draft ?? draft;
  const activeAppDraft = appApproval?.draft ?? appDraft;
  const starterPrompts = builderMode === "agent" ? STARTER_PROMPTS : APP_STARTER_PROMPTS;
  const isAgentMode = builderMode === "agent";
  const selectedModelPreset = modelPresets.find((preset) => preset.id === selectedModelPresetId) ?? modelPresets[0] ?? BUILDER_MODEL_PRESETS[0];
  const firstRunChecklist = [
    { key: "prompt", label: "Pick a starting point", description: "Choose a template or write the job in plain language.", completed: prompt.trim().length >= 8 },
    { key: "preset", label: "Choose a model preset", description: `Current preset: ${selectedModelPreset.label}.`, completed: Boolean(selectedModelPreset) },
    { key: "review", label: "Review before saving", description: "Check the plan, people-facing screens, data, and readiness notes.", completed: Boolean(activeDraft || activeAppDraft) },
    { key: "save", label: "Save the first version", description: "Keep the generated agent or app in the workspace before publishing.", completed: Boolean(approval?.agent || appApproval?.app) },
  ];
  const completedFirstRunItems = firstRunChecklist.filter((item) => item.completed).length;
  const iterationTargets = useMemo(() => buildAppIterationTargets(activeAppDraft), [activeAppDraft]);
  const selectedIterationTarget = iterationTargets.find((target) => target.id === iterationTargetId) ?? iterationTargets[0];

  useEffect(() => {
    if (iterationTargets.length > 0 && !iterationTargets.some((target) => target.id === iterationTargetId)) {
      setIterationTargetId(iterationTargets[0].id);
    }
  }, [iterationTargetId, iterationTargets]);

  const flowIndex = useMemo(() => {
    if (flowState === "empty" || flowState === "generating") return flowState === "generating" ? 1 : 0;
    if (flowState === "ready" || flowState === "needs_clarification") return 1;
    if (flowState === "approving") return 2;
    return 3;
  }, [flowState]);

  const resetAppIteration = () => {
    setIterationResult(null);
    setIterationPanel("preview");
    setAppCheckpoints([]);
  };

  const resetAppPublish = () => {
    setPublishState(null);
    setPublishLoading(false);
  };

  const loadAppCheckpoints = async (appId?: string) => {
    if (!appId) return;
    const payload = await api.listBuilderCheckpoints({ appId });
    setAppCheckpoints(payload.checkpoints);
  };

  const loadBuilderPublishState = async ({
    draft,
    approval,
    appId,
    checkpointId,
  }: {
    draft: AppBuilderDraft;
    approval?: AppBuilderApproveResult | null;
    appId?: string;
    checkpointId?: string;
  }) => {
    const fallback = createFallbackPublishState({
      draft,
      approval,
      appId,
      checkpointId,
      workspaceSlug: session?.workspace.slug,
      checkpoints: appCheckpoints,
    });
    setPublishState(fallback);
    if (!appId) return;
    try {
      const state = await api.getBuilderPublishState({ appId, checkpointId });
      setPublishState(state);
    } catch (publishStateError) {
      setPublishState({
        ...fallback,
        logs: [
          ...fallback.logs,
          {
            at: new Date().toISOString(),
            level: "warn",
            message: `Publish state API not available; showing derived self-hosted readiness. ${(publishStateError as Error).message}`,
          },
        ],
      });
    }
  };

  const resetDraftsForMode = (mode: BuilderMode) => {
    if (mode === "agent") {
      setDraft(null);
      setApproval(null);
    } else {
      setAppDraft(null);
      setAppApproval(null);
      resetAppIteration();
      resetAppPublish();
    }
  };

  const switchBuilderMode = (mode: BuilderMode) => {
    if (builderMode === mode) return;
    const nextStarter = mode === "agent" ? STARTER_PROMPTS[1] : APP_STARTER_PROMPTS[0];
    setBuilderMode(mode);
    setSelectedPromptId(nextStarter.id);
    setPrompt(nextStarter.prompt);
    setDraft(null);
    setApproval(null);
    setAppDraft(null);
    setAppApproval(null);
    resetAppIteration();
    resetAppPublish();
    setMessage(null);
    setError(null);
    setFlowState("empty");
  };

  const selectStarterPrompt = (starter: StarterPrompt) => {
    setSelectedPromptId(starter.id);
    setPrompt(starter.prompt);
    resetDraftsForMode(builderMode);
    setMessage(null);
    setError(null);
    setFlowState("empty");
  };

  const generateDraft = async () => {
    if (!canBuild || prompt.trim().length < 8) return;
    setFlowState("generating");
    setError(null);
    setMessage(null);
    setApproval(null);
    setAppApproval(null);
    try {
      if (builderMode === "app") {
        const result = await api.generateAppBuilderDraft({ prompt: prompt.trim() });
        setAppDraft(result);
        setDraft(null);
        resetAppIteration();
        resetAppPublish();
        setFlowState(result.plan.openQuestions.length > 0 ? "needs_clarification" : "ready");
        setMessage(result.plan.openQuestions.length > 0 ? "App draft ready with clarification prompts." : "App draft ready.");
      } else {
        const result = await api.generateAgentBuilderDraft({ prompt: prompt.trim() });
        setDraft({ ...result, agent: { ...result.agent, model: result.agent.model ?? selectedModelPreset.model } });
        setAppDraft(null);
        setFlowState(result.plan.openQuestions.length > 0 ? "needs_clarification" : "ready");
        setMessage(result.plan.openQuestions.length > 0 ? "Agent plan ready with clarification prompts." : "Agent plan ready.");
      }
    } catch (draftError) {
      setError((draftError as Error).message);
      setFlowState("error");
    }
  };

  const approveDraft = async (runPreview: boolean) => {
    if (!canBuild || !activeDraft) return;
    setFlowState(runPreview ? "running" : "approving");
    setError(null);
    setMessage(null);
    try {
      const result = await api.approveAgentBuilderDraft({ draft: activeDraft, runPreview });
      setApproval(result);
      setDraft(result.draft);
      setFlowState("approved");
      setMessage(runPreview && result.firstRun ? "Agent saved and preview run recorded." : "Agent saved.");
    } catch (approvalError) {
      setError((approvalError as Error).message);
      setFlowState("error");
    }
  };

  const approveAppDraft = async (runSmoke: boolean) => {
    if (!canBuild || !activeAppDraft) return;
    setFlowState(runSmoke ? "running" : "approving");
    setError(null);
    setMessage(null);
    try {
      const result = await api.approveAppBuilderDraft({ draft: activeAppDraft, runSmoke });
      setAppApproval(result);
      setAppDraft(result.draft);
      await loadAppCheckpoints(result.app?.id);
      await loadBuilderPublishState({
        draft: result.draft,
        approval: result,
        appId: result.app?.id,
        checkpointId: result.checkpoint?.id,
      });
      setFlowState("approved");
      setMessage(runSmoke && result.smokeBuild ? "App draft saved and smoke/build status recorded." : "App draft saved.");
    } catch (approvalError) {
      setError((approvalError as Error).message);
      setFlowState("error");
    }
  };

  const generateIterationDiff = async () => {
    if (!canBuild || !activeAppDraft || !selectedIterationTarget || iterationPrompt.trim().length < 8) return;
    setIterationLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.generateAppBuilderIteration({
        appId: appApproval?.app?.id,
        checkpointId: appApproval?.checkpoint?.id,
        draft: activeAppDraft,
        target: selectedIterationTarget,
        prompt: iterationPrompt.trim(),
        sourceError: iterationResult?.errorFix,
      });
      setIterationResult(result);
      setIterationPanel("preview");
      setMessage("Iteration diff generated for review.");
    } catch (iterationError) {
      const placeholder = createPlaceholderIterationDiff({
        appId: appApproval?.app?.id,
        checkpointId: appApproval?.checkpoint?.id,
        target: selectedIterationTarget,
        prompt: iterationPrompt.trim(),
        previewUrl: appApproval?.previewUrl ?? appApproval?.app?.previewUrl,
        smoke: appApproval?.smokeBuild ?? activeAppDraft.smokeBuildStatus,
      });
      setIterationResult(placeholder);
      setIterationPanel("logs");
      setError(`Iteration backend placeholder not wired yet: ${(iterationError as Error).message}`);
    } finally {
      setIterationLoading(false);
    }
  };

  const applyIterationDiff = async () => {
    if (!iterationResult || !selectedIterationTarget) return;
    if (iterationResult.status === "pending") {
      setMessage("Apply diff is staged for Phase 69 backend wiring; no generated files were changed.");
      return;
    }
    if (iterationResult.status !== "generated") {
      setMessage("Resolve blocked change-set setup before applying this diff.");
      return;
    }
    setIterationLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.applyAppBuilderIterationDiff({
        appId: appApproval?.app?.id,
        checkpointId: appApproval?.checkpoint?.id,
        diffId: iterationResult.id,
        target: selectedIterationTarget,
        files: iterationResult.files,
        diff: iterationResult,
        draft: iterationResult.draft,
        runSmoke: true,
      });
      setIterationResult(result.diff ?? { ...iterationResult, status: "applied", smoke: result.smoke ?? iterationResult.smoke });
      if (result.diff?.draft) {
        setAppDraft(result.diff.draft);
        setAppApproval((current) => current ? {
          ...current,
          draft: result.diff?.draft ?? current.draft,
          app: result.app ? { ...result.app, createdAt: current.app?.createdAt ?? new Date().toISOString() } : current.app,
          checkpoint: result.checkpoint ?? current.checkpoint,
          previewUrl: result.previewUrl ?? current.previewUrl,
          smokeBuild: result.smoke ?? current.smokeBuild,
        } : current);
      }
      await loadAppCheckpoints(appApproval?.app?.id ?? result.app?.id);
      if (activeAppDraft && (appApproval?.app?.id || result.app?.id)) {
        await loadBuilderPublishState({
          draft: result.diff?.draft ?? activeAppDraft,
          approval: appApproval,
          appId: appApproval?.app?.id ?? result.app?.id,
          checkpointId: result.checkpoint?.id ?? appApproval?.checkpoint?.id,
        });
      }
      setMessage("Iteration diff applied. Preview and smoke status are ready to refresh.");
    } catch (applyError) {
      setError(`Apply diff backend placeholder not wired yet: ${(applyError as Error).message}`);
    } finally {
      setIterationLoading(false);
    }
  };

  const rollbackAppCheckpoint = async (checkpointId: string) => {
    const appId = appApproval?.app?.id;
    if (!appId) return;
    setIterationLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.rollbackBuilderCheckpoint(checkpointId, { appId, reason: "Builder checkpoint rollback" });
      if (result.draft) setAppDraft(result.draft);
      setAppApproval((current) => current ? {
        ...current,
        draft: result.draft ?? current.draft,
        app: result.app ? { ...result.app, createdAt: current.app?.createdAt ?? new Date().toISOString() } : current.app,
        checkpoint: result.checkpoint && result.checkpoint.appId ? { id: result.checkpoint.id, appId: result.checkpoint.appId, savedAt: result.checkpoint.savedAt } : current.checkpoint,
        previewUrl: result.preview?.url ?? current.previewUrl,
        smokeBuild: result.smoke ?? current.smokeBuild,
      } : current);
      await loadAppCheckpoints(appId);
      const rollbackDraft = result.draft ?? activeAppDraft;
      if (rollbackDraft) {
        await loadBuilderPublishState({
          draft: rollbackDraft,
          approval: appApproval,
          appId,
          checkpointId: result.checkpoint?.id ?? checkpointId,
        });
      }
      setIterationPanel("checkpoints");
      setMessage("Rolled back to the selected generated app checkpoint.");
    } catch (rollbackError) {
      setError((rollbackError as Error).message);
    } finally {
      setIterationLoading(false);
    }
  };

  const updateDraftAgent = (patch: Partial<AgentBuilderDraft["agent"]>) => {
    setDraft((current) => current ? { ...current, agent: { ...current.agent, ...patch } } : current);
    setApproval(null);
  };

  const updateSampleInput = (key: string, value: string) => {
    setDraft((current) => current ? { ...current, sampleInputs: { ...current.sampleInputs, [key]: value } } : current);
    setApproval(null);
  };

  const selectModelPreset = (presetId: BuilderModelPresetId) => {
    const preset = modelPresets.find((item) => item.id === presetId) ?? BUILDER_MODEL_PRESETS.find((item) => item.id === presetId);
    setSelectedModelPresetId(presetId);
    if (preset && activeDraft && !approval?.agent) {
      updateDraftAgent({ model: preset.model });
    }
  };

  const updateAppName = (name: string) => {
    setAppDraft((current) => current ? { ...current, app: { ...current.app, name } } : current);
    setAppApproval(null);
    resetAppIteration();
    resetAppPublish();
  };

  const publishApp = async () => {
    const appId = appApproval?.app?.id;
    if (!canBuild || !activeAppDraft || !appId) return;
    setPublishLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.publishBuilderApp({
        appId,
        checkpointId: appApproval?.checkpoint?.id,
        draft: activeAppDraft,
        visibility: "private",
        runBuild: true,
        runSmoke: true,
      });
      setPublishState(result.state);
      setMessage(result.published ? "Generated app published to the self-hosted handoff URL." : "Publish state refreshed.");
    } catch (publishError) {
      setPublishState((current) => {
        const fallback = current ?? createFallbackPublishState({
          draft: activeAppDraft,
          approval: appApproval,
          appId,
          checkpointId: appApproval?.checkpoint?.id,
          workspaceSlug: session?.workspace.slug,
          checkpoints: appCheckpoints,
        });
        return {
          ...fallback,
          status: "failed",
          logs: [
            ...fallback.logs,
            {
              at: new Date().toISOString(),
              level: "error",
              message: `Publish API not available yet; export assets remain ready for self-hosting. ${(publishError as Error).message}`,
            },
          ],
          nextActions: [
            "Keep using the Docker Compose export and environment checklist for manual self-hosting.",
            ...fallback.nextActions.filter((action) => !action.includes("Publish")),
          ],
        };
      });
      setError((publishError as Error).message);
    } finally {
      setPublishLoading(false);
    }
  };

  const rollbackPublish = async (action: AppBuilderPublishState["rollbackActions"][number]) => {
    const appId = appApproval?.app?.id;
    if (!appId || action.disabled) return;
    setPublishLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (action.publishId) {
        const result = await api.rollbackBuilderPublish(action.publishId, {
          appId,
          checkpointId: action.checkpointId,
          reason: "Builder publish rollback",
        });
        setPublishState(result.state);
        setMessage(result.rolledBack ? "Publish rolled back to the selected release." : "Publish rollback state refreshed.");
      } else if (action.checkpointId) {
        await rollbackAppCheckpoint(action.checkpointId);
      }
    } catch (publishRollbackError) {
      setError((publishRollbackError as Error).message);
    } finally {
      setPublishLoading(false);
    }
  };

  const applyTemplate = async (template: AgentTemplate) => {
    if (!canBuild) return;
    setApplyingTemplateId(template.id);
    setError(null);
    setMessage(null);
    try {
      const agent = await api.createAgentFromTemplate(template.id);
      setApproval(null);
      setDraft(null);
      setAppApproval(null);
      setAppDraft(null);
      resetAppPublish();
      setFlowState("approved");
      setMessage(`Template saved: ${agent.name}.`);
    } catch (templateError) {
      setError((templateError as Error).message);
      setFlowState("error");
    } finally {
      setApplyingTemplateId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-frame space-y-6">
        <div className="h-3 w-40 animate-pulse bg-ink-850" />
        <div className="h-14 w-2/3 animate-pulse bg-ink-850" />
        <div className="grid gap-px bg-ink-800 md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-28 animate-pulse bg-ink-900" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-frame">
      <header className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="kicker">PHASE 70 · BUILDER PUBLISH</p>
          <h1 className="display-xl mt-3">Builder</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-400">
            Prompt, inspect the generated {isAgentMode ? "agent plan" : "app draft"}, save it, then publish or hand off self-hosted app assets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" onClick={loadBuilder} disabled={loading || flowState === "generating" || flowState === "approving" || flowState === "running"}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <Link to="/agents" className="btn-ghost">
            <Bot className="h-3.5 w-3.5" /> Agents
          </Link>
        </div>
      </header>

      {error && <Banner tone="error">{error}</Banner>}
      {message && !error && <Banner tone="success">{message}</Banner>}

      {!canBuild && (
        <div className="mb-6 border border-signal-amber/50 bg-ink-950 px-4 py-3 text-sm text-ink-200">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal-amber">VIEW ONLY · </span>
          Admin access is required to generate and save builder drafts.
        </div>
      )}

      <section className="mb-8 grid gap-px border border-ink-800 bg-ink-800 md:grid-cols-2">
        {([
          { id: "agent" as const, label: "Agent builder", detail: "Prompts, tools, triggers, templates, and preview runs.", icon: Bot },
          { id: "app" as const, label: "App builder", detail: "Pages, schema, API routes, CRUD, auth, and smoke/build checks.", icon: LayoutDashboard },
        ]).map((mode) => {
          const Icon = mode.icon;
          const active = builderMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              className={`bg-ink-950 p-5 text-left transition-colors ${active ? "outline outline-1 outline-signal-amber" : "hover:bg-ink-925"}`}
              onClick={() => switchBuilderMode(mode.id)}
              disabled={flowState === "generating" || flowState === "approving" || flowState === "running"}
            >
              <span className={active ? "kicker-amber" : "kicker"}>{active ? "ACTIVE MODE" : "BUILDER MODE"}</span>
              <span className="mt-3 flex items-center gap-3 text-base font-semibold text-ink-100">
                <Icon className="h-4 w-4" /> {mode.label}
              </span>
              <span className="mt-2 block text-sm leading-6 text-ink-400">{mode.detail}</span>
            </button>
          );
        })}
      </section>

      <section className="mb-8">
        <ModelPresetStrip
          presets={modelPresets}
          selectedPresetId={selectedModelPreset.id}
          onSelectPreset={selectModelPreset}
        />
      </section>

      <section className="mb-10 grid gap-px border border-ink-800 bg-ink-800 md:grid-cols-4">
        {FLOW_STEPS.map((step, index) => {
          const active = index === flowIndex;
          const done = index < flowIndex || flowState === "approved";
          return (
            <div key={step.state} className="bg-ink-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className={active ? "kicker-amber" : "kicker"}>{step.label}</p>
                <span className={`grid h-6 w-6 place-items-center border font-mono text-[10px] ${done ? "border-signal-green text-signal-green" : active ? "border-signal-amber text-signal-amber" : "border-ink-700 text-ink-500"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_360px]">
        <div className="space-y-10">
          <section className="section-band first:border-t-0 first:pt-0">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="kicker-amber">STARTER PROMPTS</p>
                <h2 className="display mt-2 text-3xl">{isAgentMode ? "Agent intake" : "App intake"}</h2>
              </div>
              <span className="section-marker">§ 01 / 04</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {starterPrompts.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  onClick={() => selectStarterPrompt(starter)}
                  className={`border p-4 text-left transition-colors ${selectedPromptId === starter.id ? "border-signal-amber bg-ink-875" : "border-ink-800 bg-ink-950 hover:border-ink-600"}`}
                >
                  <span className="kicker">{starter.category}</span>
                  <span className="mt-2 block text-sm font-medium text-ink-100">{starter.label}</span>
                  <span className="mt-2 block text-xs font-medium text-signal-amber">{starter.outcome}</span>
                  <span className="mt-2 block text-xs leading-5 text-ink-400">{starter.prompt}</span>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label className="kicker mb-2 block" htmlFor="builder-prompt">
                WHAT SHOULD TASKLOOM BUILD?
              </label>
              <textarea
                id="builder-prompt"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setSelectedPromptId("");
                  resetDraftsForMode(builderMode);
                  setFlowState("empty");
                }}
                rows={6}
                className="workflow-input resize-none"
                placeholder={isAgentMode ? "Describe the agent you want Taskloom to create." : "Describe the app experience you want Taskloom to create."}
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void generateDraft()}
                  disabled={!canBuild || flowState === "generating" || flowState === "approving" || flowState === "running" || prompt.trim().length < 8}
                >
                  {flowState === "generating" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {isAgentMode ? "Generate plan" : "Generate app draft"}
                </button>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                  CHAR · {prompt.length.toString().padStart(4, "0")}
                </span>
              </div>
            </div>
          </section>

          <section className="section-band">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="kicker-amber">{isAgentMode ? "TEMPLATE GALLERY" : "APP BLUEPRINT"}</p>
                <h2 className="display mt-2 text-3xl">{isAgentMode ? "Pick a proven starting point" : "What Taskloom will make"}</h2>
              </div>
              <span className="section-marker">§ 02 / 04</span>
            </div>

            {!isAgentMode ? (
              <div className="grid gap-px bg-ink-800 md:grid-cols-3">
                <FeatureTile icon={<LayoutDashboard className="h-4 w-4" />} title="Pages" detail="Primary routes, page purpose, and component inventory." />
                <FeatureTile icon={<Database className="h-4 w-4" />} title="Data schema" detail="Entities, fields, relationships, and required values." />
                <FeatureTile icon={<Route className="h-4 w-4" />} title="Data actions" detail="What people can create, view, update, archive, and approve." />
              </div>
            ) : templates.length === 0 ? (
              <div className="border border-dashed border-ink-700 px-6 py-10 text-center">
                <p className="kicker">NO TEMPLATES RETURNED</p>
                <p className="mt-3 text-sm text-ink-400">The builder can still generate from a prompt.</p>
              </div>
            ) : (
              <div className="grid gap-px bg-ink-800 md:grid-cols-2">
                {templates.slice(0, 6).map((template) => (
                  <article key={template.id} className="bg-ink-950 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="kicker">{template.category}</p>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{template.id}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-ink-100">{template.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-400">{template.summary}</p>
                    <p className="mt-3 text-xs leading-5 text-ink-500">{template.description}</p>
                    <div className="mt-4 grid grid-cols-2 gap-px bg-ink-800">
                      <MiniStat label="TOOLS" value={template.tools.length} />
                      <MiniStat label="INPUTS" value={template.inputSchema.length} />
                    </div>
                    <button
                      type="button"
                      className="btn-ghost mt-4 w-full justify-center"
                      onClick={() => void applyTemplate(template)}
                      disabled={!canBuild || applyingTemplateId === template.id || flowState === "generating" || flowState === "approving" || flowState === "running"}
                    >
                      {applyingTemplateId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      Save template
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="section-band">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="kicker-amber">REVIEW</p>
                <h2 className="display mt-2 text-3xl">{isAgentMode ? "Agent plan" : "App draft"}</h2>
              </div>
              <span className="section-marker">§ 03 / 04</span>
            </div>

            {isAgentMode && activeDraft ? (
              <AgentDraftPreview
                draft={activeDraft}
                approval={approval}
                editable={!approval?.agent}
                onAgentChange={updateDraftAgent}
                onSampleInputChange={updateSampleInput}
              />
            ) : !isAgentMode && activeAppDraft ? (
              <AppDraftPreview
                draft={activeAppDraft}
                approval={appApproval}
                editable={!appApproval?.app}
                onAppNameChange={updateAppName}
                canBuild={canBuild}
                iterationPrompt={iterationPrompt}
                iterationTargets={iterationTargets}
                iterationTargetId={iterationTargetId}
                iterationResult={iterationResult}
                iterationLoading={iterationLoading}
                iterationPanel={iterationPanel}
                checkpoints={appCheckpoints}
                publishState={publishState}
                publishLoading={publishLoading}
                workspaceSlug={session?.workspace.slug}
                onIterationPromptChange={setIterationPrompt}
                onIterationTargetChange={setIterationTargetId}
                onIterationPanelChange={setIterationPanel}
                onGenerateIterationDiff={generateIterationDiff}
                onApplyIterationDiff={applyIterationDiff}
                onRollbackCheckpoint={rollbackAppCheckpoint}
                onPublish={publishApp}
                onRollbackPublish={rollbackPublish}
              />
            ) : (
              <div className="border border-dashed border-ink-700 px-6 py-12">
                <p className="kicker">WAITING FOR INPUT</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-ink-400">
                  {isAgentMode ? "Generate a plan from the prompt area or save a template starter." : "Generate an app draft from the prompt area to inspect pages, data, routes, CRUD, auth, and checks."}
                </p>
              </div>
            )}

            {isAgentMode && activeDraft && !approval?.agent && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void approveDraft(true)}
                  disabled={!canBuild || !activeDraft.readiness.firstRun.canRun || flowState === "approving" || flowState === "running"}
                >
                  {flowState === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Save and preview
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void generateDraft()}
                  disabled={!canBuild || flowState === "generating" || flowState === "approving" || flowState === "running"}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void approveDraft(false)}
                  disabled={!canBuild || flowState === "approving" || flowState === "running"}
                >
                  Save draft
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDraft(null)} disabled={flowState === "approving" || flowState === "running"}>
                  Discard
                </button>
              </div>
            )}
            {!isAgentMode && activeAppDraft && !appApproval?.app && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void approveAppDraft(true)}
                  disabled={!canBuild || activeAppDraft.smokeBuildStatus.blockers.length > 0 || flowState === "approving" || flowState === "running"}
                >
                  {flowState === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Save and smoke
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void generateDraft()}
                  disabled={!canBuild || flowState === "generating" || flowState === "approving" || flowState === "running"}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void approveAppDraft(false)}
                  disabled={!canBuild || flowState === "approving" || flowState === "running"}
                >
                  Save draft
                </button>
                <button type="button" className="btn-ghost" onClick={() => setAppDraft(null)} disabled={flowState === "approving" || flowState === "running"}>
                  Discard
                </button>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="spec-frame">
            <div className="spec-label spec-label--amber">FIRST-RUN CHECKLIST</div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-100">Workspace readiness</h2>
                <p className="mt-2 text-sm leading-6 text-ink-400">
                  {bootstrap?.activation.summary.nextRecommendedAction ?? "Review setup state before saving production builder drafts."}
                </p>
              </div>
              <span className="pill pill--warn">
                {completedFirstRunItems}/{firstRunChecklist.length}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {firstRunChecklist.map((item) => (
                <div key={item.key} className="border-l border-ink-700 pl-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-100">{item.label}</p>
                    <span className={item.completed ? "text-signal-green" : "text-ink-500"}>
                      {item.completed ? "Done" : "Next"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink-500">{item.description}</p>
                </div>
              ))}
              {onboardingItems.slice(0, 5).map((item) => (
                <div key={item.key} className="border-l border-ink-700 pl-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-100">{item.label}</p>
                    <span className={item.completed ? "text-signal-green" : "text-ink-500"}>
                      {item.completed ? "Done" : "Open"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink-500">{item.description}</p>
                </div>
              ))}
              {onboardingItems.length === 0 && (
                <p className="text-sm text-ink-500">No onboarding checklist was returned.</p>
              )}
            </div>
            <Link to="/onboarding?next=/builder" className="btn-ghost mt-5 w-full justify-center">
              Open onboarding
            </Link>
          </section>

          <section className="spec-frame">
            <div className="spec-label">BUILDER TIMELINE</div>
            <BuilderTimeline
              mode={builderMode}
              flowState={flowState}
              hasDraft={Boolean(activeDraft || activeAppDraft)}
              hasSaved={Boolean(approval?.agent || appApproval?.app)}
              hasPublish={Boolean(publishState?.status === "published" || publishState?.status === "ready")}
              prompt={prompt}
              activeDraft={activeDraft}
              activeAppDraft={activeAppDraft}
              approval={approval}
              appApproval={appApproval}
              iterationResult={iterationResult}
              publishState={publishState}
              error={error}
            />
          </section>

          <section className="spec-frame">
            <div className="spec-label">FLOW STATE</div>
            <FlowStateSummary state={flowState} mode={builderMode} />
          </section>

          <section className="spec-frame">
            <div className="spec-label">{isAgentMode ? "GENERATED PLAN READINESS" : "APP SMOKE / BUILD"}</div>
            {isAgentMode ? (
              <ReadinessSummary readiness={readiness} draft={activeDraft} />
            ) : (
              <AppBuildStatusSummary draft={activeAppDraft} />
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}

function AgentDraftPreview({
  draft,
  approval,
  editable,
  onAgentChange,
  onSampleInputChange,
}: {
  draft: AgentBuilderDraft;
  approval: AgentBuilderApproveResult | null;
  editable: boolean;
  onAgentChange: (patch: Partial<AgentBuilderDraft["agent"]>) => void;
  onSampleInputChange: (key: string, value: string) => void;
}) {
  const savedAgent = approval?.agent;
  const firstRun = approval?.firstRun;
  const sampleInputs = approval?.sampleInputs ?? draft.sampleInputs;
  const blockers = draft.readiness.firstRun.blockers;

  return (
    <div className="spec-frame">
      <div className="spec-label spec-label--amber">GENERATED AGENT</div>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="kicker">{draft.intent}</p>
          <h3 className="mt-2 text-xl font-semibold text-ink-100">{draft.agent.name}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-400">{draft.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill pill--muted">{draft.agent.triggerKind}</span>
            {draft.agent.schedule && <span className="pill pill--muted">{draft.agent.schedule}</span>}
            <span className={draft.readiness.provider.configured ? "pill pill--good" : "pill pill--warn"}>
              {draft.readiness.provider.configured ? "Provider ready" : "Provider setup"}
            </span>
            {draft.readiness.webhook.recommended && <span className="pill pill--warn">Webhook token needed</span>}
          </div>
          {savedAgent && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link to={`/agents/${savedAgent.id}`} className="btn-primary">
                <Bot className="h-3.5 w-3.5" /> Open agent
              </Link>
              {firstRun && (
                <Link to="/runs" className="btn-ghost">
                  <Play className="h-3.5 w-3.5" /> View run
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-5">
          <PreviewList title="Plan steps" items={draft.plan.steps.map((item) => item.title)} />
          <PreviewList title="Clarifying questions" items={draft.plan.openQuestions} />
          <PreviewList title="Acceptance checks" items={draft.plan.acceptanceChecks} />
          <PreviewList title="Enabled tools" items={draft.agent.enabledTools ?? []} />
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="mt-6 border border-signal-amber/50 bg-ink-950 p-4">
          <p className="kicker-amber">FIRST RUN BLOCKERS</p>
          <ul className="mt-3 space-y-2">
            {blockers.map((blocker) => (
              <li key={blocker} className="text-sm leading-5 text-ink-300">{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {editable && (
        <div className="mt-6 grid gap-5 border border-ink-800 bg-ink-950 p-4 lg:grid-cols-2">
          <Field label="AGENT NAME">
            <input
              className="workflow-input"
              value={draft.agent.name}
              onChange={(event) => onAgentChange({ name: event.target.value })}
            />
          </Field>
          <Field label="MODEL">
            <input
              className="workflow-input"
              value={draft.agent.model ?? ""}
              onChange={(event) => onAgentChange({ model: event.target.value || undefined })}
            />
          </Field>
          <Field label="DESCRIPTION">
            <textarea
              className="workflow-input resize-none"
              rows={3}
              value={draft.agent.description}
              onChange={(event) => onAgentChange({ description: event.target.value })}
            />
          </Field>
          <Field label="STATUS">
            <select
              className="workflow-input"
              value={draft.agent.status}
              onChange={(event) => onAgentChange({ status: event.target.value as AgentStatus })}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </Field>
          <div className="lg:col-span-2">
            <Field label="INSTRUCTIONS">
              <textarea
                className="workflow-input resize-none"
                rows={8}
                value={draft.agent.instructions}
                onChange={(event) => onAgentChange({ instructions: event.target.value })}
              />
            </Field>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-px bg-ink-800 md:grid-cols-3">
        <MiniStat label="PLAYBOOK" value={draft.agent.playbook?.length ?? 0} />
        <MiniStat label="TOOLS" value={draft.agent.enabledTools?.length ?? 0} />
        <MiniStat label="INPUTS" value={draft.agent.inputSchema?.length ?? 0} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <PreviewList title="Playbook" items={(draft.agent.playbook ?? []).map((step) => step.title)} />
        <KeyValuePreview title="Sample input" values={sampleInputs} editable={editable} onChange={onSampleInputChange} />
      </div>

      {firstRun && (
        <div className="mt-6 border border-ink-800 bg-ink-950 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="kicker">FIRST RUN</p>
              <h4 className="mt-2 text-base font-semibold text-ink-100">{firstRun.title}</h4>
            </div>
            <span className="pill pill--good">{firstRun.status}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-400">{firstRun.output}</p>
          <PreviewList title="Transcript" items={(firstRun.transcript ?? []).map((step) => `${step.status} · ${step.title}`)} />
        </div>
      )}
    </div>
  );
}

function AppDraftPreview({
  draft,
  approval,
  editable,
  onAppNameChange,
  canBuild,
  iterationPrompt,
  iterationTargets,
  iterationTargetId,
  iterationResult,
  iterationLoading,
  iterationPanel,
  checkpoints,
  publishState,
  publishLoading,
  workspaceSlug,
  onIterationPromptChange,
  onIterationTargetChange,
  onIterationPanelChange,
  onGenerateIterationDiff,
  onApplyIterationDiff,
  onRollbackCheckpoint,
  onPublish,
  onRollbackPublish,
}: {
  draft: AppBuilderDraft;
  approval: AppBuilderApproveResult | null;
  editable: boolean;
  onAppNameChange: (name: string) => void;
  canBuild: boolean;
  iterationPrompt: string;
  iterationTargets: AppBuilderIterationTarget[];
  iterationTargetId: string;
  iterationResult: AppBuilderIterationResult | null;
  iterationLoading: boolean;
  iterationPanel: IterationPanel;
  checkpoints: AppBuilderCheckpointSummary[];
  publishState: AppBuilderPublishState | null;
  publishLoading: boolean;
  workspaceSlug?: string;
  onIterationPromptChange: (prompt: string) => void;
  onIterationTargetChange: (targetId: string) => void;
  onIterationPanelChange: (panel: IterationPanel) => void;
  onGenerateIterationDiff: () => void;
  onApplyIterationDiff: () => void;
  onRollbackCheckpoint: (checkpointId: string) => void;
  onPublish: () => void;
  onRollbackPublish: (action: AppBuilderPublishState["rollbackActions"][number]) => void;
}) {
  const savedApp = approval?.app;
  const smokeBuild = approval?.smokeBuild ?? draft.smokeBuildStatus;

  return (
    <div className="spec-frame">
      <div className="spec-label spec-label--amber">GENERATED APP</div>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="kicker">{draft.intent}</p>
          <h3 className="mt-2 text-xl font-semibold text-ink-100">{draft.app.name}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-400">{draft.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill pill--muted">{draft.app.pages.length} pages</span>
            <span className="pill pill--muted">{draft.app.dataSchema.length} entities</span>
            <span className="pill pill--muted">{draft.app.apiRoutes.length} routes</span>
            <span className={smokeBuild.status === "pass" ? "pill pill--good" : smokeBuild.status === "fail" ? "pill pill--danger" : "pill pill--warn"}>
              {smokeBuild.status}
            </span>
          </div>
          {savedApp && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {savedApp.previewUrl ? (
                <Link to={savedApp.previewUrl} className="btn-primary">
                  <LayoutDashboard className="h-3.5 w-3.5" /> Open app
                </Link>
              ) : (
                <span className="pill pill--good">Saved</span>
              )}
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">{savedApp.status}</span>
            </div>
          )}
        </div>
        <div className="grid gap-5">
          <PreviewList title="Plan steps" items={draft.plan.steps.map((item) => item.title)} />
          <PreviewList title="Clarifying questions" items={draft.plan.openQuestions} />
          <PreviewList title="Acceptance checks" items={draft.plan.acceptanceChecks} />
        </div>
      </div>

      {editable && (
        <div className="mt-6 grid gap-5 border border-ink-800 bg-ink-950 p-4 lg:grid-cols-2">
          <Field label="APP NAME">
            <input
              className="workflow-input"
              value={draft.app.name}
              onChange={(event) => onAppNameChange(event.target.value)}
            />
          </Field>
          <Field label="SUMMARY">
            <textarea className="workflow-input resize-none" rows={3} value={draft.app.description} readOnly />
          </Field>
        </div>
      )}

      <div className="mt-6 grid gap-px bg-ink-800 md:grid-cols-4">
        <MiniStat label="PAGES" value={draft.app.pages.length} />
        <MiniStat label="ENTITIES" value={draft.app.dataSchema.length} />
        <MiniStat label="API ROUTES" value={draft.app.apiRoutes.length} />
        <MiniStat label="CRUD FLOWS" value={draft.app.crudFlows.length} />
      </div>

      <div className="mt-6 grid gap-6">
        <AppPagePreview pages={draft.app.pages} />
        <DataSchemaPreview entities={draft.app.dataSchema} />
        <ApiRoutesPreview routes={draft.app.apiRoutes} />
        <CrudFlowPreview flows={draft.app.crudFlows} />
        <PreviewList title="Auth decisions" items={draft.app.authDecisions.map((item) => `${item.area}: ${item.decision} (${item.rationale})`)} />
        <BuildChecksPreview status={smokeBuild} />
        {savedApp && (
          <AppPublishSurface
            state={publishState}
            fallbackState={createFallbackPublishState({
              draft,
              approval,
              appId: savedApp.id,
              checkpointId: approval?.checkpoint?.id,
              workspaceSlug,
              checkpoints,
            })}
            loading={publishLoading}
            canBuild={canBuild}
            onPublish={onPublish}
            onRollbackPublish={onRollbackPublish}
          />
        )}
        {savedApp && (
          <AppIterationSurface
            previewUrl={approval?.previewUrl ?? savedApp.previewUrl}
            canBuild={canBuild}
            prompt={iterationPrompt}
            targets={iterationTargets}
            targetId={iterationTargetId}
            result={iterationResult}
            loading={iterationLoading}
            activePanel={iterationPanel}
            smokeBuild={smokeBuild}
            checkpoints={checkpoints}
            onPromptChange={onIterationPromptChange}
            onTargetChange={onIterationTargetChange}
            onPanelChange={onIterationPanelChange}
            onGenerateDiff={onGenerateIterationDiff}
            onApplyDiff={onApplyIterationDiff}
            onRollbackCheckpoint={onRollbackCheckpoint}
          />
        )}
      </div>
    </div>
  );
}

function AppPublishSurface({
  state,
  fallbackState,
  loading,
  canBuild,
  onPublish,
  onRollbackPublish,
}: {
  state: AppBuilderPublishState | null;
  fallbackState: AppBuilderPublishState;
  loading: boolean;
  canBuild: boolean;
  onPublish: () => void;
  onRollbackPublish: (action: AppBuilderPublishState["rollbackActions"][number]) => void;
}) {
  const publish = state ?? fallbackState;
  const readiness = publish.readiness;
  const composeContents = readiness.dockerComposeExport.contents ?? dockerComposeForPublish(readiness.localPublishPath);
  const requiredEnv = readiness.envChecklist.filter((item) => item.required);
  const readyEnv = requiredEnv.filter((item) => item.ready !== false).length;
  const statusTone =
    publish.status === "published" ? "pill pill--good" :
    publish.status === "failed" ? "pill pill--danger" :
    publish.status === "ready" || publish.status === "publishing" ? "pill pill--warn" :
    "pill pill--muted";

  return (
    <div className="border-t border-ink-800 pt-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker-amber">PHASE 70 · SELF-HOSTED PUBLISH</p>
          <h3 className="mt-2 text-xl font-semibold text-ink-100">One-click publish</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">
            Private URL handoff, environment checklist, Docker Compose export, history, and rollback target for this generated app.
          </p>
        </div>
        <span className={statusTone}>{publish.status.replace(/_/g, " ")}</span>
      </div>

      <div className="grid gap-px bg-ink-800 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 bg-ink-950 p-4">
          <p className="kicker">Publish dashboard · Published URL</p>
          <p className="mt-2 truncate font-mono text-sm text-ink-100">{publish.publishedUrl ?? readiness.urlHandoff.privateUrl}</p>
          <p className="mt-2 text-xs leading-5 text-ink-500">{readiness.urlHandoff.visibility} handoff · {readiness.localPublishPath}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-ink-950 p-4">
          <a href={publish.publishedUrl ?? readiness.urlHandoff.privateUrl} className="btn-ghost">
            <LayoutDashboard className="h-3.5 w-3.5" /> Open
          </a>
          <button type="button" className="btn-primary" onClick={onPublish} disabled={!canBuild || loading || !publish.canPublish}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            Publish
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-px bg-ink-800 md:grid-cols-4">
        <MiniStat label="REQUIRED SETUP" value={`${readyEnv}/${requiredEnv.length}`} />
        <MiniStat label="BUILD COMMANDS" value={readiness.packaging.buildCommands.length} />
        <MiniStat label="HEALTH PATHS" value="2" />
        <MiniStat label="HISTORY" value={publish.history.length} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div>
          <p className="kicker mb-2">Env checklist</p>
          <div className="grid gap-px bg-ink-800">
            {readiness.envChecklist.map((item) => (
              <div key={item.name} className="grid gap-2 bg-ink-950 px-3 py-2 text-sm md:grid-cols-[160px_88px_1fr]">
                <span className="font-mono text-[11px] uppercase text-ink-200">{item.name}</span>
                <span className={item.required ? "text-signal-amber" : "text-ink-500"}>{item.required ? "Required" : "Optional"}</span>
                <span className="text-ink-400">{item.purpose}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="kicker mb-2">Status logs</p>
          <div className="grid gap-px bg-ink-800">
            {publish.logs.map((log, index) => (
              <div key={`${log.at}-${index}`} className="grid gap-2 bg-ink-950 px-3 py-2 text-sm md:grid-cols-[84px_1fr]">
                <span className={log.level === "error" ? "font-mono text-[11px] uppercase text-signal-red" : log.level === "warn" ? "font-mono text-[11px] uppercase text-signal-amber" : "font-mono text-[11px] uppercase text-ink-500"}>{log.level}</span>
                <span className="text-ink-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="kicker">Docker Compose export</p>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{readiness.dockerComposeExport.fileName}</span>
          </div>
          <pre className="max-h-72 overflow-auto border border-ink-800 bg-ink-950 p-4 text-xs leading-5 text-ink-300"><code>{composeContents}</code></pre>
          <PreviewList title="Compose notes" items={readiness.dockerComposeExport.outline} />
        </div>

        <div className="space-y-5">
          <PreviewList title="Next actions" items={publish.nextActions} />
          <div>
            <p className="kicker mb-2">Rollback actions</p>
            <div className="grid gap-px bg-ink-800">
              {publish.rollbackActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="flex items-center justify-between gap-3 bg-ink-950 px-3 py-2 text-left text-sm text-ink-300 transition-colors hover:text-ink-100 disabled:text-ink-600"
                  onClick={() => onRollbackPublish(action)}
                  disabled={loading || action.disabled}
                >
                  <span>{action.label}</span>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              ))}
              {publish.rollbackActions.length === 0 && <p className="bg-ink-950 px-3 py-4 text-sm text-ink-500">No rollback target yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="kicker mb-2"><History className="mr-1 inline h-3.5 w-3.5" /> Publish history</p>
        <div className="grid gap-px bg-ink-800">
          {publish.history.map((entry) => (
            <div key={entry.id} className="grid gap-3 bg-ink-950 px-3 py-3 text-sm md:grid-cols-[116px_1fr_auto] md:items-center">
              <span className="font-mono text-[11px] uppercase text-ink-500">{entry.status.replace(/_/g, " ")}</span>
              <span className="min-w-0 text-ink-300">{entry.summary}</span>
              <span className="font-mono text-[11px] text-ink-500">{new Date(entry.publishedAt).toLocaleString()}</span>
            </div>
          ))}
          {publish.history.length === 0 && <p className="bg-ink-950 px-3 py-4 text-sm text-ink-500">Publish history appears after the app is saved or published.</p>}
        </div>
      </div>
    </div>
  );
}

function AppIterationSurface({
  previewUrl,
  canBuild,
  prompt,
  targets,
  targetId,
  result,
  loading,
  activePanel,
  smokeBuild,
  checkpoints,
  onPromptChange,
  onTargetChange,
  onPanelChange,
  onGenerateDiff,
  onApplyDiff,
  onRollbackCheckpoint,
}: {
  previewUrl?: string;
  canBuild: boolean;
  prompt: string;
  targets: AppBuilderIterationTarget[];
  targetId: string;
  result: AppBuilderIterationResult | null;
  loading: boolean;
  activePanel: IterationPanel;
  smokeBuild: AppBuilderDraft["smokeBuildStatus"];
  checkpoints: AppBuilderCheckpointSummary[];
  onPromptChange: (prompt: string) => void;
  onTargetChange: (targetId: string) => void;
  onPanelChange: (panel: IterationPanel) => void;
  onGenerateDiff: () => void;
  onApplyDiff: () => void;
  onRollbackCheckpoint: (checkpointId: string) => void;
}) {
  const logs = result?.logs ?? [];
  const smoke = result?.smoke ?? smokeBuild;
  const panelButtons: Array<{ id: IterationPanel; label: string; icon: ReactNode }> = [
    { id: "preview", label: "Preview", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
    { id: "logs", label: "Logs", icon: <TerminalSquare className="h-3.5 w-3.5" /> },
    { id: "smoke", label: "Smoke", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { id: "error_fix", label: "Error fix", icon: <Bug className="h-3.5 w-3.5" /> },
    { id: "checkpoints", label: "Checkpoints", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="spec-frame">
      <div className="spec-label spec-label--amber">PHASE 69 ITERATION</div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <div>
            <p className="kicker mb-2">Scoped target</p>
            <select className="workflow-input" value={targetId} onChange={(event) => onTargetChange(event.target.value)}>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.kind}: {target.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="kicker mb-2 block" htmlFor="app-iteration-prompt">
              Change prompt
            </label>
            <textarea
              id="app-iteration-prompt"
              className="workflow-input resize-none"
              rows={7}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Ask for a scoped change to the selected page, data entity, route, auth rule, smoke check, or app config."
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={onGenerateDiff}
              disabled={!canBuild || loading || prompt.trim().length < 8 || targets.length === 0}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
              Generate diff
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
              Target · {targetId || "none"}
            </span>
          </div>

          <GeneratedDiffPanel result={result} loading={loading} onApplyDiff={onApplyDiff} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px bg-ink-800 md:grid-cols-4">
            {panelButtons.map((panel) => (
              <button
                key={panel.id}
                type="button"
                className={`flex items-center justify-center gap-2 bg-ink-950 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${activePanel === panel.id ? "text-signal-amber outline outline-1 outline-signal-amber" : "text-ink-500 hover:text-ink-200"}`}
                onClick={() => onPanelChange(panel.id)}
              >
                {panel.icon}
                {panel.label}
              </button>
            ))}
          </div>
          {activePanel === "preview" && <IterationPreviewPanel previewUrl={result?.preview?.url ?? previewUrl} result={result} />}
          {activePanel === "logs" && <IterationLogsPanel logs={logs} result={result} />}
          {activePanel === "smoke" && <BuildChecksPreview status={smoke} />}
          {activePanel === "checkpoints" && (
            <IterationCheckpointsPanel checkpoints={checkpoints} loading={loading} onRollbackCheckpoint={onRollbackCheckpoint} />
          )}
          {activePanel === "error_fix" && (
            <IterationErrorFixPanel
              result={result}
              smoke={smoke}
              onUseFixPrompt={(nextPrompt) => onPromptChange(nextPrompt)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneratedDiffPanel({
  result,
  loading,
  onApplyDiff,
}: {
  result: AppBuilderIterationResult | null;
  loading: boolean;
  onApplyDiff: () => void;
}) {
  return (
    <div className="border border-ink-800 bg-ink-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker">Generated diff</p>
          <p className="mt-2 text-sm leading-6 text-ink-400">
            {result ? result.summary : "Generate a scoped change to review file-level edits before applying."}
          </p>
        </div>
        <span className={result?.status === "applied" ? "pill pill--good" : result?.status === "blocked" ? "pill pill--danger" : result?.status === "generated" ? "pill pill--warn" : "pill pill--muted"}>
          {result?.status ?? "waiting"}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {(result?.files ?? []).map((file) => (
          <article key={`${file.changeType}-${file.path}`} className="border border-ink-800 bg-ink-900">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileCode2 className="h-3.5 w-3.5 text-signal-amber" />
                <span className="truncate font-mono text-xs text-ink-100">{file.path}</span>
              </div>
              <span className="pill pill--muted">{file.changeType}</span>
            </div>
            <p className="border-t border-ink-800 px-3 py-2 text-xs leading-5 text-ink-400">{file.summary}</p>
            <pre className="max-h-64 overflow-auto border-t border-ink-800 bg-ink-950 p-3 text-xs leading-5 text-ink-300"><code>{file.diff}</code></pre>
          </article>
        ))}
        {!result && !loading && <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">No diff generated</p>}
      </div>
      <button
        type="button"
        className="btn-ghost mt-4 w-full justify-center"
        onClick={onApplyDiff}
        disabled={!result || loading || result.status !== "generated"}
      >
        <Code2 className="h-3.5 w-3.5" />
        Apply diff
      </button>
    </div>
  );
}

function IterationPreviewPanel({ previewUrl, result }: { previewUrl?: string; result: AppBuilderIterationResult | null }) {
  return (
    <div className="border border-ink-800 bg-ink-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker">Preview</p>
          <p className="mt-2 text-sm leading-6 text-ink-400">
            {result?.preview?.message ?? "Applied diffs will refresh the generated app preview from the latest checkpoint."}
          </p>
        </div>
        <span className={result?.preview?.status === "pass" ? "pill pill--good" : result?.preview?.status === "fail" ? "pill pill--danger" : "pill pill--muted"}>
          {result?.preview?.status ?? "ready"}
        </span>
      </div>
      <div className="mt-4 grid min-h-48 place-items-center border border-dashed border-ink-700 bg-ink-900 p-5 text-center">
        {previewUrl ? (
          <Link to={previewUrl} className="btn-primary">
            <LayoutDashboard className="h-3.5 w-3.5" /> Open preview
          </Link>
        ) : (
          <p className="text-sm leading-6 text-ink-500">Preview URL will appear after the generated app checkpoint is available.</p>
        )}
      </div>
    </div>
  );
}

function IterationCheckpointsPanel({
  checkpoints,
  loading,
  onRollbackCheckpoint,
}: {
  checkpoints: AppBuilderCheckpointSummary[];
  loading: boolean;
  onRollbackCheckpoint: (checkpointId: string) => void;
}) {
  const [current, ...older] = checkpoints;
  return (
    <div className="border border-ink-800 bg-ink-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker">Checkpoints</p>
          <p className="mt-2 text-sm leading-6 text-ink-400">
            {current ? `Current checkpoint ${current.id}. Roll back to an older working state when an iteration regresses.` : "Checkpoints appear after a generated app is saved."}
          </p>
        </div>
        <span className="pill pill--muted">{checkpoints.length}</span>
      </div>
      <div className="mt-4 grid gap-px bg-ink-800">
        {checkpoints.map((checkpoint, index) => (
          <div key={checkpoint.id} className="grid gap-3 bg-ink-900 p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-100">{checkpoint.label}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
                {checkpoint.source} · {checkpoint.buildStatus ?? "build"} · {checkpoint.smokeStatus ?? "smoke"}
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost justify-center"
              onClick={() => onRollbackCheckpoint(checkpoint.id)}
              disabled={loading || index === 0 || older.length === 0}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Roll back
            </button>
          </div>
        ))}
        {checkpoints.length === 0 && (
          <p className="bg-ink-900 px-3 py-4 text-sm text-ink-500">No saved generated app checkpoints yet.</p>
        )}
      </div>
    </div>
  );
}

function IterationLogsPanel({ logs, result }: { logs: AppBuilderIterationResult["logs"]; result: AppBuilderIterationResult | null }) {
  return (
    <div className="border border-ink-800 bg-ink-950 p-4">
      <p className="kicker">Logs</p>
      <div className="mt-4 grid gap-px bg-ink-800">
        {logs.map((log, index) => (
          <div key={`${log.at}-${index}`} className="grid gap-2 bg-ink-900 px-3 py-2 text-sm md:grid-cols-[96px_1fr]">
            <span className={log.level === "error" ? "font-mono text-[11px] uppercase text-signal-red" : log.level === "warn" ? "font-mono text-[11px] uppercase text-signal-amber" : "font-mono text-[11px] uppercase text-ink-500"}>{log.level}</span>
            <span className="text-ink-300">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="bg-ink-900 px-3 py-4 text-sm text-ink-500">
            {result ? "No runtime or build logs were returned with this diff." : "Generate a diff to populate redacted build, preview, and smoke logs."}
          </p>
        )}
      </div>
    </div>
  );
}

function IterationErrorFixPanel({
  result,
  smoke,
  onUseFixPrompt,
}: {
  result: AppBuilderIterationResult | null;
  smoke: AppBuilderDraft["smokeBuildStatus"];
  onUseFixPrompt: (prompt: string) => void;
}) {
  const blocker = smoke.blockers[0] ?? smoke.checks.find((check) => check.status === "fail")?.detail;
  const fixPrompt = result?.errorFix?.prompt ?? (blocker ? `Fix this generated app issue without changing unrelated behavior: ${blocker}` : "");

  return (
    <div className="border border-ink-800 bg-ink-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker">Error-fix handoff</p>
          <p className="mt-2 text-sm leading-6 text-ink-400">
            {result?.errorFix?.message ?? blocker ?? "Runtime, build, and smoke failures can be turned into a scoped fix prompt."}
          </p>
        </div>
        <span className={blocker || result?.errorFix ? "pill pill--warn" : "pill pill--good"}>{blocker || result?.errorFix ? "fixable" : "clear"}</span>
      </div>
      <button
        type="button"
        className="btn-ghost mt-4 w-full justify-center"
        onClick={() => onUseFixPrompt(fixPrompt)}
        disabled={!fixPrompt}
      >
        <Bug className="h-3.5 w-3.5" />
        Use as fix prompt
      </button>
    </div>
  );
}

function AppPagePreview({ pages }: { pages: AppBuilderDraft["app"]["pages"] }) {
  return (
    <div>
      <p className="kicker mb-2">Pages</p>
      <div className="grid gap-px bg-ink-800 md:grid-cols-2">
        {pages.map((page) => (
          <article key={page.route} className="bg-ink-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-semibold text-ink-100">{page.name}</h4>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={page.access === "public" ? "pill pill--muted" : page.access === "admin" ? "pill pill--warn" : "pill pill--good"}>{page.access}</span>
                <span className="font-mono text-[11px] text-ink-500">{page.route}</span>
              </div>
            </div>
            <p className="mt-2 text-sm leading-5 text-ink-400">{page.purpose}</p>
            <PreviewList title="Actions" items={page.actions} />
            <PreviewList title="Components" items={page.components} />
          </article>
        ))}
      </div>
    </div>
  );
}

function DataSchemaPreview({ entities }: { entities: AppBuilderDraft["app"]["dataSchema"] }) {
  return (
    <div>
      <p className="kicker mb-2">Data schema</p>
      <div className="grid gap-px bg-ink-800">
        {entities.map((entity) => (
          <article key={entity.name} className="bg-ink-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-ink-100">{entity.name}</h4>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">{entity.fields.length} fields</span>
            </div>
            <div className="mt-3 grid gap-px bg-ink-800 md:grid-cols-2">
              {entity.fields.map((field) => (
                <div key={`${entity.name}-${field.name}`} className="bg-ink-900 px-3 py-2 text-sm">
                  <span className="font-medium text-ink-100">{field.name}</span>
                  <span className="ml-2 font-mono text-[11px] uppercase text-ink-500">{field.type}{field.required ? " required" : ""}</span>
                  {field.notes && <p className="mt-1 text-xs leading-5 text-ink-500">{field.notes}</p>}
                </div>
              ))}
            </div>
            <PreviewList title="Relationships" items={entity.relationships} />
          </article>
        ))}
      </div>
    </div>
  );
}

function ApiRoutesPreview({ routes }: { routes: AppBuilderDraft["app"]["apiRoutes"] }) {
  return (
    <div>
      <p className="kicker mb-2">API routes</p>
      <div className="grid gap-px bg-ink-800">
        {routes.map((route) => (
          <div key={`${route.method}-${route.path}`} className="grid gap-3 bg-ink-950 p-4 text-sm md:grid-cols-[84px_1fr_auto] md:items-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal-amber">{route.method}</span>
            <div>
              <p className="font-mono text-ink-100">{route.path}</p>
              <p className="mt-1 text-ink-500">{route.purpose}</p>
            </div>
            <span className={route.authRequired ? "pill pill--warn" : "pill pill--muted"}>{route.authRequired ? "auth" : "public"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrudFlowPreview({ flows }: { flows: AppBuilderDraft["app"]["crudFlows"] }) {
  return (
    <div>
      <p className="kicker mb-2">CRUD flow</p>
      <div className="grid gap-px bg-ink-800 md:grid-cols-2">
        {flows.map((flow) => (
          <article key={flow.entity} className="bg-ink-950 p-4">
            <h4 className="text-sm font-semibold text-ink-100">{flow.entity}</h4>
            <div className="mt-3 grid gap-2 text-sm text-ink-300">
              <p><span className="font-mono text-[11px] uppercase text-ink-500">Create</span> {flow.create}</p>
              <p><span className="font-mono text-[11px] uppercase text-ink-500">Read</span> {flow.read}</p>
              <p><span className="font-mono text-[11px] uppercase text-ink-500">Update</span> {flow.update}</p>
              <p><span className="font-mono text-[11px] uppercase text-ink-500">Delete</span> {flow.delete}</p>
            </div>
            <PreviewList title="Validation" items={flow.validation} />
          </article>
        ))}
      </div>
    </div>
  );
}

function BuildChecksPreview({ status }: { status: AppBuilderDraft["smokeBuildStatus"] }) {
  return (
    <div className="border border-ink-800 bg-ink-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker">Smoke/build status</p>
          <p className="mt-2 text-sm leading-6 text-ink-400">{status.message}</p>
        </div>
        <span className={status.status === "pass" ? "pill pill--good" : status.status === "fail" ? "pill pill--danger" : "pill pill--warn"}>{status.status}</span>
      </div>
      <div className="mt-4 grid gap-px bg-ink-800">
        {status.checks.map((check) => (
          <div key={check.name} className="grid gap-2 bg-ink-900 px-3 py-2 text-sm md:grid-cols-[120px_1fr]">
            <span className="font-mono text-[11px] uppercase text-ink-500">{check.status}</span>
            <span className="text-ink-300">{check.name}: {check.detail}</span>
          </div>
        ))}
      </div>
      {status.blockers.length > 0 && <PreviewList title="Blockers" items={status.blockers} />}
    </div>
  );
}

function ReadinessSummary({ readiness, draft }: { readiness: IntegrationReadinessSummary | null; draft: AgentBuilderDraft | null }) {
  const setup = readiness?.recommendedSetup ?? [];
  const warnings = [
    ...(draft?.readiness.provider.configured ? [] : [draft?.readiness.provider.message].filter(Boolean) as string[]),
    ...(draft?.readiness.tools.missing ?? []).map((tool) => `Missing tool: ${tool}`),
    ...(draft?.readiness.webhook.recommended ? [draft.readiness.webhook.message] : []),
    ...setup.slice(0, 3),
  ];

  if (warnings.length === 0) {
    return (
      <div>
        <span className="pill pill--good"><ShieldCheck className="h-3.5 w-3.5" /> Ready</span>
        <p className="mt-4 text-sm leading-6 text-ink-400">Provider and tool setup look ready for generated plans.</p>
      </div>
    );
  }

  return (
    <div>
      <span className="pill pill--warn"><AlertTriangle className="h-3.5 w-3.5" /> Setup</span>
      <ul className="mt-4 space-y-3">
        {warnings.map((item, index) => (
          <li key={`${item}-${index}`} className="border-l border-signal-amber/50 pl-3 text-sm leading-5 text-ink-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppBuildStatusSummary({ draft }: { draft: AppBuilderDraft | null }) {
  if (!draft) {
    return (
      <div>
        <span className="pill pill--muted">Waiting</span>
        <p className="mt-4 text-sm leading-6 text-ink-400">Generate an app draft to see smoke/build readiness.</p>
      </div>
    );
  }

  const status = draft.smokeBuildStatus;
  return (
    <div>
      <span className={status.status === "pass" ? "pill pill--good" : status.status === "fail" ? "pill pill--danger" : "pill pill--warn"}>
        {status.status}
      </span>
      <p className="mt-4 text-sm leading-6 text-ink-400">{status.message}</p>
      <PreviewList title="Checks" items={status.checks.map((check) => `${check.name}: ${check.status}`)} />
    </div>
  );
}

function ModelPresetStrip({
  presets,
  selectedPresetId,
  onSelectPreset,
}: {
  presets: BuilderModelPreset[];
  selectedPresetId: BuilderModelPresetId;
  onSelectPreset: (presetId: BuilderModelPresetId) => void;
}) {
  return (
    <div className="border border-ink-800 bg-ink-800">
      <div className="grid gap-px md:grid-cols-[220px_1fr]">
        <div className="bg-ink-950 p-5">
          <p className="kicker-amber">MODEL PRESET</p>
          <p className="mt-3 text-sm leading-6 text-ink-400">
            Choose how much time Taskloom should spend shaping the plan before you review it.
          </p>
        </div>
        <div className="grid gap-px md:grid-cols-3">
          {presets.map((preset) => {
            const active = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`bg-ink-950 p-4 text-left transition-colors ${active ? "outline outline-1 outline-signal-amber" : "hover:bg-ink-925"}`}
                onClick={() => onSelectPreset(preset.id)}
              >
                <span className={active ? "kicker-amber" : "kicker"}>{preset.label}</span>
                <span className="mt-2 block text-sm font-medium text-ink-100">{preset.summary}</span>
                <span className="mt-2 block text-xs leading-5 text-ink-500">{preset.bestFor}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BuilderTimeline({
  mode,
  flowState,
  hasDraft,
  hasSaved,
  hasPublish,
  prompt,
  activeDraft,
  activeAppDraft,
  approval,
  appApproval,
  iterationResult,
  publishState,
  error,
}: {
  mode: BuilderMode;
  flowState: BuilderFlowState;
  hasDraft: boolean;
  hasSaved: boolean;
  hasPublish: boolean;
  prompt: string;
  activeDraft: AgentBuilderDraft | null;
  activeAppDraft: AppBuilderDraft | null;
  approval: AgentBuilderApproveResult | null;
  appApproval: AppBuilderApproveResult | null;
  iterationResult: AppBuilderIterationResult | null;
  publishState: AppBuilderPublishState | null;
  error: string | null;
}) {
  const draftName = activeDraft?.agent.name ?? activeAppDraft?.app.name;
  const changedSummary = iterationResult?.summary ?? activeDraft?.summary ?? activeAppDraft?.summary;
  const previewMessage = appApproval?.smokeBuild?.message
    ?? appApproval?.smoke?.message
    ?? activeAppDraft?.smokeBuildStatus.message
    ?? approval?.firstRun?.output
    ?? approval?.firstRun?.title
    ?? approval?.firstRun?.status;
  const failedMessage = error
    ?? iterationResult?.errorFix?.message
    ?? appApproval?.smokeBuild?.blockers[0]
    ?? appApproval?.smoke?.blockers[0]
    ?? activeAppDraft?.smokeBuildStatus.blockers[0]
    ?? publishState?.logs.find((log) => log.level === "error")?.message
    ?? "No current blockers reported.";
  const nextAction = publishState?.nextActions[0]
    ?? activeDraft?.plan.openQuestions[0]
    ?? activeAppDraft?.plan.openQuestions[0]
    ?? (hasPublish ? "Monitor the published URL and keep a rollback checkpoint ready." : "Review, save, preview, and publish from the latest draft.");
  const statusCards = [
    {
      label: "Transcript",
      value: prompt.trim().length > 0 ? `${prompt.trim().slice(0, 78)}${prompt.trim().length > 78 ? "..." : ""}` : "Waiting for a prompt.",
    },
    {
      label: "Changed",
      value: changedSummary ?? "No generated changes yet.",
    },
    {
      label: "Failed",
      value: failedMessage,
    },
    {
      label: "Next",
      value: nextAction,
    },
  ];
  const timeline = [
    {
      label: "Prompt transcript",
      detail: `Taskloom is tracking the latest ${mode === "agent" ? "agent" : "app"} request${draftName ? ` for ${draftName}` : ""}.`,
      done: prompt.trim().length >= 8 || flowState !== "empty" || hasDraft,
    },
    {
      label: "Generation changes",
      detail: changedSummary ?? "Generate a draft to see the plan, created screens, data, tools, and tests.",
      done: hasDraft,
    },
    {
      label: "Preview logs and smoke tests",
      detail: previewMessage ?? "Preview, build, runtime logs, and smoke checks appear here after save.",
      done: hasSaved,
    },
    {
      label: "Publish",
      detail: mode === "app" ? "Use the private URL, checks, history, and rollback controls." : "Run the saved agent and monitor results.",
      done: hasPublish,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-px bg-ink-800">
        {statusCards.map((card) => (
          <div key={card.label} className="bg-ink-950 px-3 py-2">
            <span className="font-mono text-[10px] uppercase text-ink-500">{card.label}</span>
            <span className="mt-1 block text-xs leading-5 text-ink-200">{card.value}</span>
          </div>
        ))}
      </div>
      <ol className="space-y-3">
        {timeline.map((item, index) => (
          <li key={item.label} className="grid grid-cols-[28px_1fr] gap-3">
            <span className={`mt-0.5 grid h-6 w-6 place-items-center border font-mono text-[10px] ${item.done ? "border-signal-green text-signal-green" : "border-ink-700 text-ink-500"}`}>
              {item.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span>
              <span className="block text-sm font-medium text-ink-100">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-ink-500">{item.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FeatureTile({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="bg-ink-950 p-5">
      <div className="flex items-center gap-3 text-sm font-semibold text-ink-100">
        <span className="text-signal-amber">{icon}</span>
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-400">{detail}</p>
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="kicker mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">None</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={`${title}-${item}-${index}`} className="flex gap-3 text-sm text-ink-200">
              <span className="font-mono text-[11px] text-ink-500">{String(index + 1).padStart(2, "0")}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function KeyValuePreview({
  title,
  values,
  editable = false,
  onChange,
}: {
  title: string;
  values: Record<string, string | number | boolean>;
  editable?: boolean;
  onChange?: (key: string, value: string) => void;
}) {
  const entries = Object.entries(values);
  return (
    <div>
      <p className="kicker mb-2">{title}</p>
      {entries.length === 0 ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">None</p>
      ) : (
        <div className="grid gap-px bg-ink-800">
          {entries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[120px_1fr] gap-3 bg-ink-950 px-3 py-2 text-sm">
              <span className="font-mono text-[11px] uppercase text-ink-500">{key}</span>
              {editable ? (
                <input
                  className="min-w-0 bg-transparent text-ink-200 outline-none"
                  value={String(value)}
                  onChange={(event) => onChange?.(key, event.target.value)}
                />
              ) : (
                <span className="truncate text-ink-200">{String(value)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kicker mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function FlowStateSummary({ state, mode }: { state: BuilderFlowState; mode: BuilderMode }) {
  const label =
    state === "generating" ? "Generating plan" :
    state === "needs_clarification" ? "Clarifications suggested" :
    state === "ready" ? "Ready for approval" :
    state === "approving" ? `Saving ${mode}` :
    state === "running" ? (mode === "app" ? "Recording smoke status" : "Recording preview") :
    state === "approved" ? "Approved" :
    state === "error" ? "Needs attention" :
    "Prompting";
  const tone = state === "error" ? "pill--danger" : state === "approved" ? "pill--good" : state === "generating" || state === "approving" || state === "running" ? "pill--warn" : "pill--muted";

  return (
    <div>
      <span className={`pill ${tone}`}>{label}</span>
      <p className="mt-4 text-sm leading-6 text-ink-400">
        {state === "approved"
          ? `The generated ${mode} draft is saved in the workspace.`
          : state === "error"
            ? "Resolve the API or permission issue, then retry from the latest prompt."
            : "The builder keeps generated work in review until approval."}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-ink-950 px-3 py-3">
      <p className="kicker">{label}</p>
      <p className="num mt-1 text-lg font-semibold text-ink-100">{value}</p>
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const color = tone === "error" ? "border-signal-red text-signal-red" : "border-signal-green text-signal-green";
  return <div className={`mb-6 border ${color} bg-ink-950 px-4 py-3 font-mono text-xs uppercase tracking-wide`}>{children}</div>;
}
