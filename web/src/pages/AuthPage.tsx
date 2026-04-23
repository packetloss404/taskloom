import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { brand } from "@/config/brand";

const showSeedAccounts = import.meta.env.DEV && import.meta.env.VITE_SHOW_SEED_ACCOUNTS === "true";

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
    <div className="flex min-h-screen items-center justify-center bg-[#32342f] px-5 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-black/30 bg-[#3b3d38] p-7 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_18px_50px_rgba(0,0,0,0.18)]">
        <Link to="/" className="inline-flex items-center">
          <img src={brand.logoPath} alt={brand.name} className="h-8 w-auto" />
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-100">
          {mode === "sign-up" ? "Create account" : "Log in"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {mode === "sign-up" ? "Create an account to use your own agents." : "Sign in to use your agents."}
        </p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          {mode === "sign-up" && (
            <Field label="Display name">
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field-input" placeholder="New Owner" required />
            </Field>
          )}

          <Field label="Email">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" placeholder="you@example.com" autoComplete="email" required />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
              placeholder="Password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              required
            />
          </Field>

          {error && <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-[#32342f] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitting}
          >
            {submitting ? (mode === "sign-up" ? "Creating account..." : "Logging in...") : mode === "sign-up" ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-400">
          {mode === "sign-up" ? "Already have an account?" : "Need an account?"}{" "}
          <Link to={mode === "sign-up" ? "/sign-in" : "/sign-up"} className="font-medium text-zinc-100 hover:text-white">
            {mode === "sign-up" ? "Log in" : "Create one"}
          </Link>
        </p>

        {showSeedAccounts && (
          <details className="mt-5 rounded-xl border border-black/25 bg-black/10 px-4 py-3 text-xs text-zinc-400">
            <summary className="cursor-pointer select-none font-medium text-zinc-300">Development accounts</summary>
            <p className="mt-2 leading-5">
              Local seed accounts are available for contributors: <code>alpha@taskloom.local</code>,{" "}
              <code>beta@taskloom.local</code>, or <code>gamma@taskloom.local</code> with password{" "}
              <code>demo12345</code>.
            </p>
          </details>
        )}
      </section>

      <style>{`
        .field-input {
          width: 100%;
          background: rgb(0 0 0 / 0.14);
          border: 1px solid rgb(0 0 0 / 0.26);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          color: rgb(244 244 245);
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }
        .field-input::placeholder { color: rgb(161 161 170); }
        .field-input:focus {
          border-color: rgb(244 244 245 / 0.42);
          box-shadow: 0 0 0 3px rgb(244 244 245 / 0.12);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-zinc-200">{label}</div>
      {children}
    </label>
  );
}
