import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@/lib/types";

interface WorkbenchContextValue {
  session: Session;
  signOut: () => Promise<void>;
}

const WorkbenchCtx = createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({
  session,
  signOut,
  children,
}: {
  session: Session;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <WorkbenchCtx.Provider value={{ session, signOut }}>
      {children}
    </WorkbenchCtx.Provider>
  );
}

export function useWorkbench() {
  const value = useContext(WorkbenchCtx);
  if (!value) throw new Error("useWorkbench must be used within WorkbenchProvider");
  return value;
}

export function useWorkspaceName() {
  return useWorkbench().session.workspace.name || "Workspace";
}

export function useUser() {
  return useWorkbench().session.user;
}

export function useRole() {
  return useWorkbench().session.workspace.role ?? "viewer";
}
