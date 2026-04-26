import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { BootstrapPayload } from "@/lib/types";

export default function SettingsPage() {
  const { session, refreshSession } = useAuth();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getBootstrap().then(setBootstrap).catch(() => setBootstrap(null));
  }, []);

  if (!session || !bootstrap) {
    return (
      <div className="page-frame flex items-center gap-3 text-sm text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING SETTINGS</span>
      </div>
    );
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.updateProfile({
        displayName: String(form.get("displayName") || ""),
        timezone: String(form.get("timezone") || ""),
      });
      await refreshSession();
      setBootstrap(await api.getBootstrap());
      setProfileMessage("Profile updated.");
    } catch (error) {
      setProfileMessage((error as Error).message);
    }
  };

  const saveWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.updateWorkspace({
        name: String(form.get("name") || ""),
        website: String(form.get("website") || ""),
        automationGoal: String(form.get("automationGoal") || ""),
      });
      await refreshSession();
      setBootstrap(await api.getBootstrap());
      setWorkspaceMessage("Workspace updated.");
    } catch (error) {
      setWorkspaceMessage((error as Error).message);
    }
  };

  return (
    <div className="page-frame">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <div className="kicker mb-3">SETTINGS · WORKSPACE & PROFILE</div>
          <h1 className="display-xl">Settings.</h1>
          <p className="mt-4 max-w-xl font-mono text-xs text-ink-400">
            <span className="text-ink-500">manage account, workspace, and read-only activation summary.</span>
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 divide-x divide-ink-700 border-y border-ink-700">
        <Stat label="STAGE" value={bootstrap.activation.summary.stageLabel} />
        <Stat label="RISK" value={bootstrap.activation.summary.riskLabel} />
        <Stat label="PROGRESS" value={bootstrap.activation.summary.progressLabel} />
      </section>

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="kicker mb-2">PROFILE</div>
            <h2 className="display text-2xl">Account</h2>
          </div>
          <span className="section-marker">§ 01 / 03</span>
        </div>
        <form className="grid gap-4 md:grid-cols-2 md:max-w-3xl" onSubmit={saveProfile}>
          <Field label="DISPLAY NAME">
            <input name="displayName" defaultValue={session.user.displayName} className="workflow-input" required />
          </Field>
          <Field label="EMAIL · READ ONLY">
            <input value={session.user.email} className="workflow-input opacity-70" disabled readOnly />
          </Field>
          <Field label="TIMEZONE">
            <input name="timezone" defaultValue={session.user.timezone} className="workflow-input" required />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" type="submit">Save profile</button>
          </div>
        </form>
        <StatusMessage message={profileMessage} />
      </section>

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="kicker mb-2">WORKSPACE</div>
            <h2 className="display text-2xl">Workspace profile</h2>
          </div>
          <span className="section-marker">§ 02 / 03</span>
        </div>
        <form className="grid gap-4 md:grid-cols-2 md:max-w-3xl" onSubmit={saveWorkspace}>
          <Field label="WORKSPACE NAME">
            <input name="name" defaultValue={bootstrap.workspace.name} className="workflow-input" required />
          </Field>
          <Field label="WEBSITE">
            <input name="website" defaultValue={bootstrap.workspace.website} className="workflow-input" placeholder="https://example.com" />
          </Field>
          <div className="md:col-span-2">
            <Field label="AUTOMATION GOAL">
              <textarea name="automationGoal" defaultValue={bootstrap.workspace.automationGoal} rows={4} className="workflow-input resize-none" />
            </Field>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" type="submit">Save workspace</button>
          </div>
        </form>
        <StatusMessage message={workspaceMessage} />
      </section>

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="kicker mb-2">ACTIVATION SUMMARY · READ ONLY</div>
            <h2 className="display text-2xl">Status from the engine</h2>
          </div>
          <span className="section-marker">§ 03 / 03</span>
        </div>
        <table className="data-table max-w-3xl">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bootstrap.activation.summary.items.map((item) => (
              <tr key={item.key}>
                <td className="font-serif text-base text-ink-100">{item.label}</td>
                <td className="text-sm text-ink-400">{item.description}</td>
                <td>
                  <span className={item.completed ? "pill pill--good" : "pill pill--muted"}>
                    {item.completed ? "complete" : "pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="kicker">{label}</span>
        {hint && <span className="font-mono text-[10px] text-ink-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  if (!message) return null;
  const success = message.toLowerCase().includes("updated");
  return (
    <div className={`mt-4 max-w-3xl border px-3 py-2 font-mono text-xs ${success ? "border-signal-green/50 text-signal-green" : "border-signal-red/50 text-signal-red"}`}>
      {success ? "OK · " : "ERR · "}{message}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-5">
      <div className="kicker">{label}</div>
      <div className="mt-2 font-mono text-3xl tabular-nums text-ink-100">{value}</div>
    </div>
  );
}
