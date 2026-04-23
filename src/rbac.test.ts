import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKSPACE_ROLE_DEFINITIONS,
  WORKSPACE_ROLES,
  WorkspaceAccessError,
  assertPermission,
  canEditWorkflow,
  canManageWorkspace,
  canViewWorkspace,
  getWorkspaceRole,
  hasWorkspaceRole,
  requireWorkspaceRole,
} from "./rbac";

test("workspace roles are ordered from least to most privileged", () => {
  assert.deepEqual(WORKSPACE_ROLES, ["viewer", "member", "admin", "owner"]);

  assert.equal(WORKSPACE_ROLE_DEFINITIONS.viewer.rank < WORKSPACE_ROLE_DEFINITIONS.member.rank, true);
  assert.equal(WORKSPACE_ROLE_DEFINITIONS.member.rank < WORKSPACE_ROLE_DEFINITIONS.admin.rank, true);
  assert.equal(WORKSPACE_ROLE_DEFINITIONS.admin.rank < WORKSPACE_ROLE_DEFINITIONS.owner.rank, true);
});

test("workspace permission helpers follow the role hierarchy", () => {
  const viewer = { role: "viewer" };
  const member = { role: "member" };
  const admin = { role: "admin" };
  const owner = { role: "owner" };

  assert.equal(canViewWorkspace(viewer), true);
  assert.equal(canEditWorkflow(viewer), false);
  assert.equal(canManageWorkspace(viewer), false);

  assert.equal(canViewWorkspace(member), true);
  assert.equal(canEditWorkflow(member), true);
  assert.equal(canManageWorkspace(member), false);

  assert.equal(canViewWorkspace(admin), true);
  assert.equal(canEditWorkflow(admin), true);
  assert.equal(canManageWorkspace(admin), true);

  assert.equal(canViewWorkspace(owner), true);
  assert.equal(canEditWorkflow(owner), true);
  assert.equal(canManageWorkspace(owner), true);
});

test("role checks accept higher roles for lower requirements", () => {
  assert.equal(hasWorkspaceRole({ role: "owner" }, "viewer"), true);
  assert.equal(hasWorkspaceRole({ role: "admin" }, "member"), true);
  assert.equal(hasWorkspaceRole({ role: "member" }, "admin"), false);
  assert.equal(requireWorkspaceRole({ role: "owner" }, "admin"), "owner");
});

test("invalid or missing membership has no permissions", () => {
  assert.equal(getWorkspaceRole(null), null);
  assert.equal(getWorkspaceRole(undefined), null);
  assert.equal(getWorkspaceRole({ role: null }), null);
  assert.equal(getWorkspaceRole({ role: "billing" }), null);

  for (const membership of [null, undefined, { role: null }, { role: "billing" }]) {
    assert.equal(canViewWorkspace(membership), false);
    assert.equal(canEditWorkflow(membership), false);
    assert.equal(canManageWorkspace(membership), false);
  }
});

test("assert helpers throw for missing, invalid, or insufficient role", () => {
  assert.throws(() => requireWorkspaceRole(null, "viewer"), WorkspaceAccessError);
  assert.throws(() => requireWorkspaceRole({ role: "billing" }, "viewer"), WorkspaceAccessError);
  assert.throws(() => requireWorkspaceRole({ role: "viewer" }, "member"), WorkspaceAccessError);
  assert.throws(() => assertPermission({ role: "member" }, "manageWorkspace"), WorkspaceAccessError);

  assert.equal(assertPermission({ role: "admin" }, "manageWorkspace"), "admin");
});
