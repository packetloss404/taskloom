import type { WorkspaceRole } from "./types";
export type { WorkspaceRole } from "./types";

const roleRanks: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function hasWorkspaceRole(role: WorkspaceRole | undefined, minimum: WorkspaceRole) {
  return role !== undefined && roleRanks[role] >= roleRanks[minimum];
}

export function canEditWorkflowRole(role: WorkspaceRole | undefined) {
  return hasWorkspaceRole(role, "member");
}

export function canManageWorkspaceRole(role: WorkspaceRole | undefined) {
  return hasWorkspaceRole(role, "admin");
}
