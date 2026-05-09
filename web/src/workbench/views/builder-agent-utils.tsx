import type { AgentBuilderDraft, AgentInputField, AgentRunRecord } from "@/lib/types";

export type AgentBuilderSampleInputs = Record<string, string | number | boolean>;
export type ReadinessTone = "good" | "warn" | "danger" | "muted";

export function sampleInputsForDraft(draft: AgentBuilderDraft): AgentBuilderSampleInputs {
  const schema = draft.agent.inputSchema ?? [];
  const next: AgentBuilderSampleInputs = { ...draft.sampleInputs };

  for (const field of schema) {
    if (next[field.key] !== undefined) continue;
    next[field.key] = generatedFieldSample(field);
  }

  return next;
}

export function coerceSampleValue(field: AgentInputField | undefined, value: string | boolean): string | number | boolean {
  if (!field) return value;
  if (field.type === "boolean") return Boolean(value);
  if (field.type === "number") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
  return String(value);
}

export function inputValueForField(value: string | number | boolean | undefined): string {
  if (value === undefined) return "";
  return String(value);
}

export function draftToolNames(draft: AgentBuilderDraft): string[] {
  const tools = draft.agent.enabledTools?.length
    ? draft.agent.enabledTools
    : draft.agent.tools?.length
      ? draft.agent.tools
      : draft.readiness.tools.recommended;
  return uniqueStrings(tools);
}

export function providerReadinessTone(draft: AgentBuilderDraft): ReadinessTone {
  return draft.readiness.provider.configured ? "good" : "warn";
}

export function toolReadinessTone(draft: AgentBuilderDraft): ReadinessTone {
  if (draft.readiness.tools.missing.length > 0) return "warn";
  if (draftToolNames(draft).length > 0) return "good";
  return "muted";
}

export function firstRunReadinessTone(draft: AgentBuilderDraft): ReadinessTone {
  if (draft.readiness.firstRun.canRun) return "good";
  return draft.readiness.firstRun.blockers.length > 0 ? "warn" : "muted";
}

export function runStatusTone(run: AgentRunRecord | undefined): ReadinessTone {
  if (!run) return "muted";
  if (run.status === "success") return "good";
  if (run.status === "failed" || run.status === "canceled") return "danger";
  if (run.status === "running" || run.status === "queued") return "warn";
  return "muted";
}

export function agentEditorPath(agentId: string | undefined): string {
  return agentId ? `/agents/${agentId}` : "/agents";
}

export function formatSampleValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function generatedFieldSample(field: AgentInputField): string | number | boolean {
  if (field.defaultValue !== undefined) {
    if (field.type === "boolean") return field.defaultValue === "true";
    if (field.type === "number") {
      const numberValue = Number(field.defaultValue);
      return Number.isFinite(numberValue) ? numberValue : 1;
    }
    return field.defaultValue;
  }

  if (field.type === "boolean") return false;
  if (field.type === "number") return 1;
  if (field.type === "url") return "https://example.com";
  if (field.type === "enum") return field.options?.[0] ?? "";
  return `Sample ${field.label || field.key}`;
}

function uniqueStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}
