import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  refreshSession: () => Promise<Session | null>;
  signIn: (body: { email: string; password: string }) => Promise<void>;
  signUp: (body: { displayName: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = (nextSession: Session | null) => {
    setSessionState(nextSession);
  };

  const refreshSession = async () => {
    try {
      const nextSession = await api.getSession();
      setSessionState(nextSession);
      return nextSession;
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        setSessionState(null);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (body: { email: string; password: string }) => {
    const nextSession = await api.signIn(body);
    setSessionState(nextSession);
  };

  const signUp = async (body: { displayName: string; email: string; password: string }) => {
    const nextSession = await api.signUp(body);
    setSessionState(nextSession);
  };

  const signOut = async () => {
    await api.signOut();
    setSessionState(null);
    navigate("/", { replace: true });
  };

  useEffect(() => {
    void refreshSession().catch(() => {
      setSessionState(null);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({ session, loading, refreshSession, signIn, signUp, signOut, setSession }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
