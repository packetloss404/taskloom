import type {
  WorkflowBlocker,
  WorkflowBrief,
  WorkflowOverviewPayload,
  WorkflowPlanItem,
  WorkflowQuestion,
  WorkflowReleaseConfirmation,
  WorkflowRequirement,
  WorkflowValidationEvidence,
} from "@/lib/types";

export type LineageStageKey = "brief" | "requirements" | "plan" | "validation" | "release";

export type LineageNodeStatus = "empty" | "pending" | "in_progress" | "blocked" | "passed" | "failed" | "done";

export interface LineageNode {
  id: string;
  stage: LineageStageKey;
  label: string;
  sublabel?: string;
  status: LineageNodeStatus;
  meta?: string;
  requirementIds?: string[];
  planItemId?: string;
}

export interface LineageEdge {
  from: string;
  to: string;
  kind: "covers" | "implements" | "validates" | "ships";
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  stageOrder: LineageStageKey[];
}

interface LineageInput {
  brief: WorkflowBrief | null;
  requirements: WorkflowRequirement[];
  planItems: WorkflowPlanItem[];
  validationEvidence: WorkflowValidationEvidence[];
  release: WorkflowReleaseConfirmation | null;
  blockers?: WorkflowBlocker[];
  questions?: WorkflowQuestion[];
}

export function buildLineageGraph(input: LineageInput): LineageGraph {
  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];

  const briefNode: LineageNode = {
    id: "brief",
    stage: "brief",
    label: "Workspace Brief",
    sublabel: input.brief?.summary?.slice(0, 90) || "No brief captured",
    status: input.brief?.summary ? "done" : "empty",
    meta: input.brief?.updatedAt,
  };
  nodes.push(briefNode);

  const reqNodes = input.requirements.map<LineageNode>((requirement) => ({
    id: `req:${requirement.id}`,
    stage: "requirements",
    label: requirement.title,
    sublabel: `${requirement.priority} · ${requirement.status}`,
    status: requirementStatus(requirement),
    meta: requirement.updatedAt,
  }));

  if (reqNodes.length === 0) {
    reqNodes.push({
      id: "req:empty",
      stage: "requirements",
      label: "No requirements",
      status: "empty",
    });
  }
  nodes.push(...reqNodes);
  for (const requirementNode of reqNodes) {
    edges.push({ from: briefNode.id, to: requirementNode.id, kind: "covers" });
  }

  const planNodes = input.planItems.map<LineageNode>((plan) => ({
    id: `plan:${plan.id}`,
    stage: "plan",
    label: plan.title,
    sublabel: plan.description ? plan.description.slice(0, 80) : undefined,
    status: planStatus(plan),
    meta: plan.updatedAt,
    requirementIds: collectRequirementIds(plan),
  }));

  if (planNodes.length === 0) {
    planNodes.push({
      id: "plan:empty",
      stage: "plan",
      label: "No plan items",
      status: "empty",
    });
  }
  nodes.push(...planNodes);

  for (const planNode of planNodes) {
    const refs = planNode.requirementIds ?? [];
    if (refs.length === 0) {
      edges.push({ from: reqNodes[0]?.id ?? briefNode.id, to: planNode.id, kind: "implements" });
      continue;
    }
    for (const requirementId of refs) {
      const targetId = `req:${requirementId}`;
      if (reqNodes.some((node) => node.id === targetId)) {
        edges.push({ from: targetId, to: planNode.id, kind: "implements" });
      }
    }
  }

  const evidenceNodes = input.validationEvidence.map<LineageNode>((evidence) => ({
    id: `evidence:${evidence.id}`,
    stage: "validation",
    label: evidence.title,
    sublabel: evidence.source || evidence.detail?.slice(0, 80),
    status: validationStatus(evidence),
    meta: evidence.updatedAt,
    planItemId: collectPlanItemId(evidence),
  }));

  if (evidenceNodes.length === 0) {
    evidenceNodes.push({
      id: "evidence:empty",
      stage: "validation",
      label: "No validation evidence",
      status: "empty",
    });
  }
  nodes.push(...evidenceNodes);

  for (const evidenceNode of evidenceNodes) {
    const planRef = evidenceNode.planItemId ? `plan:${evidenceNode.planItemId}` : undefined;
    if (planRef && planNodes.some((node) => node.id === planRef)) {
      edges.push({ from: planRef, to: evidenceNode.id, kind: "validates" });
    } else {
      edges.push({ from: planNodes[0]?.id ?? briefNode.id, to: evidenceNode.id, kind: "validates" });
    }
  }

  const releaseNode: LineageNode = {
    id: "release",
    stage: "release",
    label: input.release?.confirmed ? "Release confirmed" : "Release pending",
    sublabel: input.release?.summary?.slice(0, 90) || (input.release ? "Awaiting confirmation" : "No release record"),
    status: input.release?.confirmed ? "done" : input.release ? "pending" : "empty",
    meta: input.release?.updatedAt,
  };
  nodes.push(releaseNode);
  for (const evidenceNode of evidenceNodes) {
    edges.push({ from: evidenceNode.id, to: releaseNode.id, kind: "ships" });
  }

  return { nodes, edges, stageOrder: ["brief", "requirements", "plan", "validation", "release"] };
}

export function buildLineageFromOverview(payload: WorkflowOverviewPayload): LineageGraph {
  return buildLineageGraph({
    brief: payload.brief,
    requirements: payload.requirements,
    planItems: payload.planItems,
    validationEvidence: payload.validationEvidence,
    release: payload.releaseConfirmation,
    blockers: payload.blockersAndQuestions?.blockers,
    questions: payload.blockersAndQuestions?.questions,
  });
}

export function lineageNeighbors(graph: LineageGraph, nodeId: string) {
  const upstream = graph.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
  const downstream = graph.edges.filter((edge) => edge.from === nodeId).map((edge) => edge.to);
  return { upstream, downstream };
}

function requirementStatus(requirement: WorkflowRequirement): LineageNodeStatus {
  if (requirement.status === "accepted") return "done";
  if (requirement.status === "deferred") return "blocked";
  return "pending";
}

function planStatus(plan: WorkflowPlanItem): LineageNodeStatus {
  if (plan.status === "done") return "done";
  if (plan.status === "in_progress") return "in_progress";
  if (plan.status === "blocked") return "blocked";
  return "pending";
}

function validationStatus(evidence: WorkflowValidationEvidence): LineageNodeStatus {
  if (evidence.status === "passed") return "passed";
  if (evidence.status === "failed") return "failed";
  return "pending";
}

function collectRequirementIds(plan: WorkflowPlanItem): string[] {
  return Array.isArray(plan.requirementIds) ? plan.requirementIds.filter(Boolean) : [];
}

function collectPlanItemId(evidence: WorkflowValidationEvidence): string | undefined {
  return evidence.planItemId && evidence.planItemId.length > 0 ? evidence.planItemId : undefined;
}
