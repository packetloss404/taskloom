import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Building2, UserRound } from "lucide-react";
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

  if (!session || !bootstrap) return <div className="text-sm text-ink-400">Loading settings…</div>;

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
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-100">Settings</h1>
          <p className="mt-2 text-sm text-ink-400">Manage the account and workspace layer without losing the activation context.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm text-ink-300">
          <Stat label="Stage" value={bootstrap.activation.summary.stageLabel} />
          <Stat label="Risk" value={bootstrap.activation.summary.riskLabel} />
          <Stat label="Progress" value={bootstrap.activation.summary.progressLabel} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form className="card p-6" onSubmit={saveProfile}>
          <SectionTitle icon={<UserRound className="h-4 w-4" />} title="Profile" />
          <div className="mt-6 space-y-4">
            <Field label="Display name">
              <input name="displayName" defaultValue={session.user.displayName} className="field-input" required />
            </Field>
            <Field label="Email" hint="Read-only in this slice.">
              <input value={session.user.email} className="field-input opacity-70" disabled readOnly />
            </Field>
            <Field label="Timezone">
              <input name="timezone" defaultValue={session.user.timezone} className="field-input" required />
            </Field>
          </div>
          <StatusMessage message={profileMessage} />
          <div className="mt-6 flex justify-end"><button className="btn-primary" type="submit">Save profile</button></div>
        </form>

        <div className="space-y-6">
          <form className="card p-6" onSubmit={saveWorkspace}>
            <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Workspace" />
            <div className="mt-6 space-y-4">
              <Field label="Workspace name">
                <input name="name" defaultValue={bootstrap.workspace.name} className="field-input" required />
              </Field>
              <Field label="Website">
                <input name="website" defaultValue={bootstrap.workspace.website} className="field-input" placeholder="https://example.com" />
              </Field>
              <Field label="Automation goal">
                <textarea name="automationGoal" defaultValue={bootstrap.workspace.automationGoal} rows={4} className="field-input resize-none" />
              </Field>
            </div>
            <StatusMessage message={workspaceMessage} />
            <div className="mt-6 flex justify-end"><button className="btn-primary" type="submit">Save workspace</button></div>
          </form>

          <section className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-400">Activation summary</h2>
                <p className="mt-2 text-sm text-ink-400">Read-only status from the activation engine and persisted onboarding flow.</p>
              </div>
              <div className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300">{bootstrap.activation.summary.riskLabel}</div>
            </div>
            <div className="mt-5 space-y-3">
              {bootstrap.activation.summary.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-ink-800/80 bg-ink-950/40 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink-100">{item.label}</div>
                    <div className="mt-1 text-xs text-ink-400">{item.description}</div>
                  </div>
                  <div className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-ink-300">
                    {item.completed ? "Complete" : "Pending"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
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
    </>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-500/12 text-accent-400">{icon}</div>
      <div><div className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-400">{title}</div></div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-200">{label}</span>
        {hint && <span className="text-xs text-ink-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  if (!message) return null;
  const success = message.toLowerCase().includes("updated");
  return <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${success ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border border-rose-400/40 bg-rose-500/10 text-rose-300"}`}>{message}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card min-w-28 p-4 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-ink-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink-100">{value}</div>
    </div>
  );
}
