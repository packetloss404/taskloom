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
    <div className="min-h-screen bg-ink-950 text-ink-200">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-12 py-8 max-md:px-5">
        <Link to="/" className="flex items-center gap-3">
          <img src={brand.logoPath} alt={brand.name} className="h-7 w-auto" />
          <span className="kicker">v0.1</span>
        </Link>
        <Link to="/" className="btn-ghost">← Back</Link>
      </header>

      <main className="mx-auto grid max-w-7xl gap-16 px-12 pb-20 md:grid-cols-[1.4fr_1fr] max-md:px-5">
        <section>
          <div className="kicker mb-6">{mode === "sign-up" ? "§ NEW WORKSPACE" : "§ AUTHENTICATE"}</div>
          <h1 className="display-xl">
            {mode === "sign-up" ? "Create workspace." : "Sign in."}
          </h1>
          <p className="mt-8 max-w-lg font-sans text-lg leading-7 text-ink-300">
            {mode === "sign-up"
              ? "A self-hosted workspace for activation tracking, workflow drafting, and persistent agents — across Anthropic, OpenAI, MiniMax, and Ollama."
              : "Resume your workspace. Pick up briefs, plans, blockers, validation evidence, runs, and agent telemetry where you left them."}
          </p>

          <div className="mt-10 max-w-md space-y-4 font-mono text-xs text-ink-500">
            <div className="border-t border-ink-700 pt-3">
              <span className="text-ink-300">PROVIDERS</span> · ANTHROPIC · OPENAI · MINIMAX · OLLAMA
            </div>
            <div className="border-t border-ink-700 pt-3">
              <span className="text-ink-300">SECRETS</span> · AES-256-GCM AT REST · MASKED ON READ
            </div>
            <div className="border-t border-ink-700 pt-3">
              <span className="text-ink-300">RUNTIME</span> · PERSISTENT JOB QUEUE · CRON · SSE STREAM
            </div>
          </div>
        </section>

        <section className="border-l border-ink-700 pl-10 max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-10">
          <div className="tab-strip">
            <Link to="/sign-in" className={`tab-strip__item ${mode === "sign-in" ? "tab-strip__item--active" : ""}`}>
              Sign in
            </Link>
            <Link to="/sign-up" className={`tab-strip__item ${mode === "sign-up" ? "tab-strip__item--active" : ""}`}>
              Create
            </Link>
          </div>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            {mode === "sign-up" && (
              <Field label="DISPLAY NAME">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="workflow-input"
                  placeholder="New Owner"
                  required
                />
              </Field>
            )}

            <Field label="EMAIL">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="workflow-input"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="PASSWORD">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="workflow-input"
                placeholder="••••••••"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                required
              />
            </Field>

            {error && (
              <div className="border border-signal-red/50 bg-ink-950/60 px-3 py-2 font-mono text-xs text-signal-red">
                ERR · {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
              {submitting
                ? (mode === "sign-up" ? "Creating…" : "Authenticating…")
                : (mode === "sign-up" ? "→ Create account" : "→ Sign in")}
            </button>
          </form>

          {showSeedAccounts && (
            <details className="mt-8 border border-ink-700 px-4 py-3 font-mono text-[11px] text-ink-400">
              <summary className="cursor-pointer select-none text-ink-200">DEV SEED ACCOUNTS</summary>
              <p className="mt-2 leading-5">
                <code>alpha@taskloom.local</code>, <code>beta@taskloom.local</code>, <code>gamma@taskloom.local</code> · password <code>demo12345</code>
              </p>
            </details>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kicker mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
