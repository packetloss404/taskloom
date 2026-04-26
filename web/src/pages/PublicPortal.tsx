import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { brand } from "@/config/brand";

export default function PublicPortalPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  const enterWorkspace = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    navigate("/sign-in");
  };

  return (
    <main className="min-h-screen bg-ink-950 text-ink-200">
      <div className="bg-grid-fine">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-12 py-8 max-md:px-5">
          <div className="flex items-center gap-3">
            <img src={brand.logoPath} alt={brand.name} className="h-7 w-auto" />
            <span className="kicker">v0.1 · OPEN SOURCE</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/sign-in" className="btn-ghost">Sign in</Link>
            <Link to="/sign-up" className="btn-primary">Create workspace</Link>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-12 px-12 pb-20 pt-12 md:grid-cols-[1.7fr_1fr] max-md:px-5">
          <div>
            <div className="kicker mb-6">§ 01 · WORKSPACE PORTAL</div>
            <h1 className="display-xl">
              Activation,<br />
              workflows,<br />
              and agents — <span className="text-signal-amber">in one workspace.</span>
            </h1>
            <p className="mt-8 max-w-xl font-sans text-lg leading-7 text-ink-300">
              Taskloom is an open-source workspace for tracking activation, defining workflows, and running persistent agents — with a provider abstraction across Anthropic, OpenAI, MiniMax, and Ollama.
            </p>

            <form
              onSubmit={enterWorkspace}
              className="mt-10 max-w-xl border border-ink-700 bg-ink-875"
            >
              <div className="border-b border-ink-700 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-500">
                DESCRIBE WHAT YOU WANT TO AUTOMATE
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enterWorkspace();
                  }
                }}
                placeholder="Every morning, scan Gmail for support email, classify by urgency, draft a response, and alert me…"
                rows={4}
                className="w-full resize-none bg-transparent px-4 py-4 text-sm leading-7 text-ink-100 outline-none placeholder:text-ink-500"
              />
              <div className="flex items-center justify-between border-t border-ink-700 px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                  enter sends · shift+enter newline
                </span>
                <button type="submit" className="btn-primary">→ Continue</button>
              </div>
            </form>
          </div>

          <aside className="border-l border-ink-700 pl-10 max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-10">
            <div className="kicker mb-6">CAPABILITIES · 06</div>
            <ol>
              {CAPABILITIES.map((cap, i) => (
                <li key={cap.title} className="border-t border-ink-700 py-4 first:border-t-0">
                  <div className="font-mono text-[10px] text-ink-500">
                    {String(i + 1).padStart(2, "0")} ·
                  </div>
                  <h3 className="mt-1 font-serif text-xl text-ink-100">{cap.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-400">{cap.description}</p>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </div>

      <footer className="border-t border-ink-700">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-12 py-6 font-mono text-[11px] text-ink-500 max-md:px-5">
          <span>© Taskloom · open source</span>
          <span>github.com/packetloss404/taskloom</span>
        </div>
      </footer>
    </main>
  );
}

const CAPABILITIES = [
  { title: "Activation tracking", description: "Track milestones, risk signals, and stage transitions across every workspace." },
  { title: "Workflow drafting", description: "Brief, requirements, plan items, blockers, validation evidence, and release confirmation in one continuous chain." },
  { title: "Agent runtime", description: "Persistent agents with playbooks, structured input schemas, and per-step transcripts." },
  { title: "Provider abstraction", description: "One interface across Anthropic, OpenAI, MiniMax, and Ollama. Bring your own keys or run local." },
  { title: "Job queue + cron", description: "Persistent queue with retry/cancel and scheduled recurring runs." },
  { title: "Operations console", description: "Token + cost ledger, SSE streaming, env-var vault, release preflight." },
];
