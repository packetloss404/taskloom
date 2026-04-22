import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = searchParams.get("next");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "sign-up") {
        await signUp({ displayName: displayName.trim(), email: email.trim(), password });
      } else {
        await signIn({ email: email.trim(), password });
      }
      navigate(next && next.startsWith("/") ? next : "/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 py-10 text-ink-100">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-ink-800/80 bg-ink-900/50 p-8 shadow-card backdrop-blur-sm lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-400/30 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-400">
            <Sparkles className="h-3.5 w-3.5" /> Workspace access
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-100">Use the real Taskloom workspace shell.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-300">
            Sign in to manage the current workspace, continue onboarding, review activation progress, and update settings without falling back to the public demo surface.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Feature title="Workspace auth" body="Cookie sessions, file-backed users, and private workspace bootstrap." />
            <Feature title="Activation tracking" body="The imported engine now drives onboarding, progress, and risk views." />
            <Feature title="Activity feed" body="Workspace actions and activation transitions are visible inside the app." />
          </div>
        </section>

        <section className="card p-8">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-500/15 text-accent-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-ink-100">
            {mode === "sign-up" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm text-ink-400">
            Demo accounts are seeded too: `alpha@taskloom.local`, `beta@taskloom.local`, `gamma@taskloom.local` with password `demo12345`.
          </p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            {mode === "sign-up" && (
              <Field label="Display name">
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field-input" placeholder="New Owner" required />
              </Field>
            )}

            <Field label="Email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" placeholder="alpha@taskloom.local" required />
            </Field>

            <Field label="Password">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field-input" placeholder="demo12345" required />
            </Field>

            {error && <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

            <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
              {submitting ? (mode === "sign-up" ? "Creating account…" : "Signing in…") : mode === "sign-up" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-sm text-ink-400">
            {mode === "sign-up" ? "Already have an account?" : "Need an account?"}{" "}
            <Link to={mode === "sign-up" ? "/sign-in" : "/sign-up"} className="font-medium text-accent-400 hover:text-accent-300">
              {mode === "sign-up" ? "Sign in" : "Create one"}
            </Link>
          </p>
        </section>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          background: rgb(11 11 18 / 0.6);
          border: 1px solid rgb(38 40 56);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          color: rgb(230 231 240);
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }
        .field-input::placeholder { color: rgb(107 110 133); }
        .field-input:focus {
          border-color: rgb(167 139 250 / 0.5);
          box-shadow: 0 0 0 3px rgb(167 139 250 / 0.15);
        }
      `}</style>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-ink-950/35 p-4">
      <div className="text-sm font-medium text-ink-100">{title}</div>
      <p className="mt-2 text-sm leading-6 text-ink-400">{body}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-ink-200">{label}</div>
      {children}
    </label>
  );
}
