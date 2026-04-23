import { useState, type FormEvent } from "react";
import { ArrowUp, ChevronDown, Paperclip } from "lucide-react";
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
    <main className="min-h-screen bg-[#32342f] px-5 py-8 text-zinc-100">
      <header className="mx-auto flex max-w-[672px] items-center justify-between gap-4">
        <img src={brand.logoPath} alt={brand.name} className="h-8 w-auto" />
        <Link
          to="/sign-in"
          className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-black/20 hover:text-white"
        >
          Log in
        </Link>
      </header>

      <div className="mx-auto mt-8 max-w-[672px] sm:mt-6">
        <section className="flex flex-col items-center">
          <h1 className="text-center font-serif text-[34px] font-semibold leading-tight tracking-wide text-zinc-100 sm:text-[38px]">
            What do you want to automate?
          </h1>
          <p className="mt-3 max-w-xl text-center text-sm leading-6 text-zinc-300/70">
            Open-source agent builder. Bring your own API key, provider, or Agent SDK integration.
          </p>

          <form
            onSubmit={enterWorkspace}
            className="mt-6 w-full rounded-2xl border border-black/30 bg-[#3b3d38] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_16px_44px_rgba(0,0,0,0.12)]"
          >
            <label className="sr-only" htmlFor="automation-intent">Automation request</label>
            <textarea
              id="automation-intent"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  enterWorkspace();
                }
              }}
              placeholder="Every morning, scan my Gmail for new support emails, classify by urgency, draft a response, and alert me"
              rows={3}
              className="block min-h-20 w-full resize-none bg-transparent px-5 pt-4 text-[17px] leading-7 text-zinc-100 outline-none placeholder:text-zinc-300/45"
            />

            <div className="flex items-center justify-between gap-4 px-5 pb-4">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-full text-zinc-300/70 transition-colors hover:bg-black/10 hover:text-zinc-100"
                aria-label="Attach context"
                title="Attach context"
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.8} />
              </button>

              <div className="flex items-center gap-5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-zinc-200 transition-colors hover:text-white"
                >
                  New workspace <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
                <button
                  type="submit"
                  className="grid h-8 w-8 place-items-center rounded-full bg-zinc-300 text-[#32342f] transition-colors hover:bg-white"
                  aria-label="Continue"
                  title="Continue"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
