import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canManageWorkspaceRole } from "@/lib/roles";
import type { BootstrapPayload, ShareTokenRecord, ShareTokenScope } from "@/lib/types";

export default function SettingsPage() {
  const { session, refreshSession } = useAuth();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [shareTokens, setShareTokens] = useState<ShareTokenRecord[]>([]);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getBootstrap(),
      api.listShareTokens().catch(() => [] as ShareTokenRecord[]),
    ])
      .then(([nextBootstrap, nextShareTokens]) => {
        setBootstrap(nextBootstrap);
        setShareTokens(nextShareTokens);
      })
      .catch(() => setBootstrap(null));
  }, []);

  if (!session || !bootstrap) {
    return (
      <div className="page-frame flex items-center gap-3 text-sm text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" /> <span className="kicker">LOADING SETTINGS</span>
      </div>
    );
  }

  const workspaceRole = bootstrap.workspace.role ?? session.workspace.role;
  const canManageWorkspace = canManageWorkspaceRole(workspaceRole);
  const workspaceControlsDisabled = !canManageWorkspace;

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

  const createShareToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageWorkspace) return;
    const form = new FormData(event.currentTarget);
    const expiresAt = String(form.get("expiresAt") || "").trim();
    setShareBusyId("create");
    setShareMessage(null);
    try {
      const token = await api.createShareToken({
        scope: String(form.get("scope") || "overview") as ShareTokenScope,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      });
      setShareTokens((current) => [token, ...current]);
      setShareMessage("Share token created.");
      event.currentTarget.reset();
    } catch (error) {
      setShareMessage((error as Error).message);
    } finally {
      setShareBusyId(null);
    }
  };

  const revokeShareToken = async (id: string) => {
    if (!canManageWorkspace) return;
    setShareBusyId(id);
    setShareMessage(null);
    try {
      await api.deleteShareToken(id);
      const nextShareTokens = await api.listShareTokens();
      setShareTokens(nextShareTokens);
      setShareMessage("Share token revoked.");
    } catch (error) {
      setShareMessage((error as Error).message);
    } finally {
      setShareBusyId(null);
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

      {workspaceRole && (
        <div className="mt-6 border border-ink-700 bg-ink-950/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-300">
          WORKSPACE ROLE · {workspaceRole}
          {workspaceControlsDisabled ? " · WORKSPACE EDITS REQUIRE ADMIN" : ""}
        </div>
      )}

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="kicker mb-2">PROFILE</div>
            <h2 className="display text-2xl">Account</h2>
          </div>
          <span className="section-marker">§ 01 / 04</span>
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
          <span className="section-marker">§ 02 / 04</span>
        </div>
        <form className="grid gap-4 md:grid-cols-2 md:max-w-3xl" onSubmit={saveWorkspace}>
          <fieldset className="contents" disabled={workspaceControlsDisabled}>
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
              {workspaceControlsDisabled ? <ReadOnlyRoleNotice /> : <button className="btn-primary" type="submit">Save workspace</button>}
            </div>
          </fieldset>
        </form>
        <StatusMessage message={workspaceMessage} />
      </section>

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="kicker mb-2">SHARING · PUBLIC TOKENS</div>
            <h2 className="display text-2xl">Share workspace output</h2>
          </div>
          <span className="section-marker">§ 03 / 04</span>
        </div>

        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:max-w-4xl" onSubmit={createShareToken}>
          <fieldset className="contents" disabled={!canManageWorkspace || shareBusyId === "create"}>
            <Field label="SCOPE">
              <select name="scope" defaultValue="overview" className="workflow-input">
                <option value="overview">Overview: brief and plan</option>
                <option value="brief">Brief only</option>
                <option value="plan">Plan only</option>
              </select>
            </Field>
            <Field label="EXPIRES AT" hint="optional">
              <input name="expiresAt" type="datetime-local" className="workflow-input" />
            </Field>
            <div className="flex items-end">
              {canManageWorkspace ? (
                <button className="btn-primary w-full" type="submit">Create token</button>
              ) : (
                <ReadOnlyShareNotice />
              )}
            </div>
          </fieldset>
        </form>
        <StatusMessage message={shareMessage} />

        <div className="mt-6 max-w-5xl overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Public link</th>
                <th>Reads</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shareTokens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-sm text-ink-500">No share tokens yet.</td>
                </tr>
              ) : shareTokens.map((token) => {
                const url = shareUrl(token.token);
                const revoked = Boolean(token.revokedAt);
                return (
                  <tr key={token.id}>
                    <td><span className="pill pill--muted">{token.scope}</span></td>
                    <td className="font-mono text-xs text-ink-300">
                      <a href={url} className="underline decoration-ink-600 underline-offset-4">{url}</a>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-500">
                        Created {formatDate(token.createdAt)}{token.expiresAt ? ` · Expires ${formatDate(token.expiresAt)}` : ""}
                      </div>
                    </td>
                    <td className="font-mono text-sm tabular-nums text-ink-200">
                      {token.readCount}{token.lastReadAt ? <span className="block text-[10px] text-ink-500">last {formatDate(token.lastReadAt)}</span> : null}
                    </td>
                    <td><span className={revoked ? "pill pill--danger" : "pill pill--good"}>{revoked ? "revoked" : "active"}</span></td>
                    <td>
                      {canManageWorkspace && !revoked ? (
                        <button className="btn-ghost" type="button" disabled={shareBusyId === token.id} onClick={() => revokeShareToken(token.id)}>
                          Revoke
                        </button>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">Read only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-band">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="kicker mb-2">ACTIVATION SUMMARY · READ ONLY</div>
            <h2 className="display text-2xl">Status from the engine</h2>
          </div>
          <span className="section-marker">§ 04 / 04</span>
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

function ReadOnlyRoleNotice() {
  return <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">Admin role required for workspace edits</span>;
}

function ReadOnlyShareNotice() {
  return <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-500">Admin role required to create share tokens</span>;
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
  const success = ["updated", "created", "revoked"].some((word) => message.toLowerCase().includes(word));
  return (
    <div className={`mt-4 max-w-3xl border px-3 py-2 font-mono text-xs ${success ? "border-signal-green/50 text-signal-green" : "border-signal-red/50 text-signal-red"}`}>
      {success ? "OK · " : "ERR · "}{message}
    </div>
  );
}

function shareUrl(token: string) {
  const path = `/share/${token}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-5">
      <div className="kicker">{label}</div>
      <div className="mt-2 font-mono text-3xl tabular-nums text-ink-100">{value}</div>
    </div>
  );
}
