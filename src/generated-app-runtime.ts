import { createHash } from "node:crypto";
import {
  writeGeneratedAppWorkspace,
  type GeneratedAppWorkspaceManifest,
  type GeneratedAppWorkspaceResolveOptions,
  type GeneratedAppWorkspaceWriteResult,
} from "./generated-app-workspace.js";

export interface GeneratedAppSourceFileRecord {
  path: string;
  content: string;
  contentType: string;
  size: number;
  sha256: string;
  role: "entrypoint" | "source" | "manifest" | "config" | "docs";
}

export interface GeneratedAppRuntimeArtifactRecord {
  entrypoint: string;
  files: GeneratedAppSourceFileRecord[];
  renderedAt: string;
}

export interface GeneratedAppRuntimeDraft {
  prompt: string;
  intent: string;
  summary: string;
  app: {
    slug: string;
    name: string;
    description: string;
    pages: Array<{
      name: string;
      route: string;
      access: "public" | "private" | "admin";
      purpose: string;
      actions: string[];
      components: string[];
    }>;
    dataSchema: Array<{
      name: string;
      fields: Array<{ name: string; type: string; required: boolean; notes?: string }>;
      relationships: string[];
    }>;
    apiRoutes: Array<{
      method: string;
      path: string;
      access: "public" | "private" | "admin";
      purpose: string;
      handler: string;
      authRequired: boolean;
      requiredRole?: "admin";
    }>;
    crudFlows: Array<{
      entity: string;
      create: string;
      read: string;
      update: string;
      delete: string;
      validation: string[];
    }>;
    authDecisions: Array<{ area: string; decision: string; rationale: string }>;
  };
}

export interface GeneratedAppRuntimeInput {
  appId: string;
  workspaceId: string;
  checkpointId: string;
  draft: GeneratedAppRuntimeDraft;
  renderedAt?: string;
}

export interface GeneratedAppRuntimeWorkspaceInput extends GeneratedAppWorkspaceResolveOptions {
  workspaceSlug: string;
  appSlug: string;
  appId: string;
  workspaceId: string;
  checkpointId: string;
  checkpointLabel?: string;
  checkpointCreatedAt?: string;
  artifact: GeneratedAppRuntimeArtifactRecord;
  writtenAt?: string;
}

export type GeneratedAppRuntimeWorkspaceManifest = GeneratedAppWorkspaceManifest;

type RuntimeRecordValue = string | number | boolean | null;
type RuntimeSeedRecord = Record<string, RuntimeRecordValue>;

type RuntimeSchemaEntity = {
  name: string;
  label: string;
  fields: Array<{ name: string; type: string; required: boolean; notes?: string }>;
  requiredFields: string[];
  editableFields: string[];
  relationships: string[];
};

type RuntimeModel = {
  primaryEntity: string;
  schema: RuntimeSchemaEntity[];
  seedData: Record<string, RuntimeSeedRecord[]>;
};

export interface GeneratedAppSourceFileSummary {
  path: string;
  contentType: string;
  size: number;
  sha256: string;
  role: GeneratedAppSourceFileRecord["role"];
}

export function buildGeneratedAppRuntimeArtifact(input: GeneratedAppRuntimeInput): GeneratedAppRuntimeArtifactRecord {
  const renderedAt = input.renderedAt ?? new Date().toISOString();
  const model = buildRuntimeModel(input.draft);
  const previewData = {
    appId: input.appId,
    workspaceId: input.workspaceId,
    checkpointId: input.checkpointId,
    renderedAt,
    draft: input.draft,
    primaryEntity: model.primaryEntity,
    schema: model.schema,
    seedData: model.seedData,
  };
  const files = [
    sourceFile("index.html", renderPreviewHtml(previewData), "entrypoint"),
    sourceFile("package.json", renderPackageJson(input.draft), "manifest"),
    sourceFile("tsconfig.json", renderTsConfig(), "config"),
    sourceFile("vite.config.ts", renderViteConfig(), "config"),
    sourceFile("src/main.tsx", renderMainTsx(input.draft), "source"),
    sourceFile("src/App.tsx", renderAppTsx(input.draft, model), "source"),
    sourceFile("src/styles.css", renderStylesCss(), "source"),
    sourceFile("src/api/generated-api.ts", renderApiHandlerTs(model), "source"),
    sourceFile("src/data/schema.ts", renderSchemaTs(model), "source"),
    sourceFile("src/data/seed-data.json", JSON.stringify(model.seedData, null, 2), "manifest"),
    sourceFile("src/db/migrations/0001_initial.sql", renderMigrationSql(model), "config"),
    sourceFile("src/db/seed.ts", renderSeedTs(model), "source"),
    sourceFile("src/generated-app.json", JSON.stringify(previewData, null, 2), "manifest"),
    sourceFile("README.md", renderReadme(input.draft, input.appId, input.checkpointId, model), "docs"),
  ];

  return {
    entrypoint: "index.html",
    files,
    renderedAt,
  };
}

export function summarizeGeneratedAppSourceFiles(files: GeneratedAppSourceFileRecord[]): GeneratedAppSourceFileSummary[] {
  return files.map(({ path, contentType, size, sha256, role }) => ({ path, contentType, size, sha256, role }));
}

export function findGeneratedAppSourceFile(
  artifact: GeneratedAppRuntimeArtifactRecord | undefined,
  path: string | undefined,
): GeneratedAppSourceFileRecord | undefined {
  if (!artifact) return undefined;
  const normalized = normalizeSourcePath(path || artifact.entrypoint);
  return artifact.files.find((file) => normalizeSourcePath(file.path) === normalized);
}

export function getGeneratedAppPreviewHtml(artifact: GeneratedAppRuntimeArtifactRecord): string {
  const entrypoint = findGeneratedAppSourceFile(artifact, artifact.entrypoint);
  return entrypoint?.content ?? "<!doctype html><title>Generated app preview unavailable</title>";
}

export async function writeGeneratedAppRuntimeWorkspace(
  input: GeneratedAppRuntimeWorkspaceInput,
): Promise<GeneratedAppWorkspaceWriteResult> {
  return writeGeneratedAppWorkspace({
    workspaceSlug: input.workspaceSlug,
    appSlug: input.appSlug,
    appId: input.appId,
    workspaceId: input.workspaceId,
    checkpointId: input.checkpointId,
    checkpointLabel: input.checkpointLabel,
    checkpointCreatedAt: input.checkpointCreatedAt,
    writtenAt: input.writtenAt ?? input.artifact.renderedAt,
    files: input.artifact.files.map((file) => ({
      path: file.path,
      content: file.content,
      contentType: file.contentType,
      role: file.role,
    })),
  }, {
    rootDir: input.rootDir,
    generatedAppsRoot: input.generatedAppsRoot,
  });
}

function sourceFile(
  path: string,
  content: string,
  role: GeneratedAppSourceFileRecord["role"],
): GeneratedAppSourceFileRecord {
  return {
    path,
    content,
    role,
    contentType: contentTypeForPath(path),
    size: Buffer.byteLength(content),
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

function renderPreviewHtml(input: {
  appId: string;
  workspaceId: string;
  checkpointId: string;
  renderedAt: string;
  draft: GeneratedAppRuntimeDraft;
  primaryEntity: string;
  schema: RuntimeSchemaEntity[];
  seedData: Record<string, RuntimeSeedRecord[]>;
}) {
  const data = safeJson(input);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="/api/app/generated-apps/${escapeHtml(input.appId)}/preview/">
  <title>${escapeHtml(input.draft.app.name)} Preview</title>
  <style>
    :root { color-scheme: light; --ink: #172026; --muted: #66737f; --line: #d8e0e6; --panel: #f6f8fa; --accent: #0f766e; --amber: #9a5b00; --blue: #1d4ed8; --danger: #b42318; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #ffffff; }
    #root { min-height: 100vh; }
    header { border-bottom: 1px solid var(--line); padding: 18px clamp(18px, 4vw, 42px); display: flex; justify-content: space-between; gap: 18px; align-items: center; }
    main { padding: clamp(18px, 4vw, 42px); }
    button, input, select, textarea { font: inherit; }
    button { border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 8px; padding: 9px 11px; cursor: pointer; }
    button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    button.danger { color: var(--danger); }
    input, select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 9px 10px; }
    label { display: grid; gap: 5px; color: var(--muted); font-size: 12px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(24px, 4vw, 40px); letter-spacing: 0; }
    h2 { font-size: 24px; letter-spacing: 0; margin-bottom: 10px; }
    h3 { font-size: 15px; letter-spacing: 0; margin-bottom: 8px; }
    .muted { color: var(--muted); line-height: 1.55; }
    .badge { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 999px; padding: 5px 9px; font-size: 12px; color: var(--muted); background: #fff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-top: 18px; }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fff; }
    .workspace { display: grid; grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.4fr); gap: 18px; margin-top: 18px; }
    .list { display: grid; gap: 8px; margin-top: 10px; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
    .row-actions { display: flex; gap: 8px; align-items: start; }
    .form { display: grid; gap: 10px; }
    .entity-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .entity-tabs button[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 -3px 0 var(--accent); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .access-public { color: var(--accent); }
    .access-private { color: var(--blue); }
    .access-admin { color: var(--amber); }
    @media (max-width: 760px) { header, .workspace { grid-template-columns: 1fr; display: grid; } }
  </style>
</head>
<body data-app-id="${escapeHtml(input.appId)}" data-app-slug="${escapeHtml(input.draft.app.slug)}" data-checkpoint-id="${escapeHtml(input.checkpointId)}">
  <div id="root" aria-live="polite"></div>
  <script id="generated-app-data" type="application/json">${data}</script>
  <script type="module" src="src/main.tsx"></script>
  <script>
    const payload = JSON.parse(document.getElementById("generated-app-data").textContent);
    const root = document.getElementById("root");
    const cloneData = (data) => Object.fromEntries(Object.entries(data).map(([entity, records]) => [entity, records.map((record) => ({ ...record }))]));
    let recordsByEntity = cloneData(payload.seedData);
    let activeEntity = payload.primaryEntity;
    let editingId = "";
    let formValues = emptyValues(activeEntity);

    setTimeout(() => {
      if (!root.dataset.reactReady) render();
    }, 80);

    function activeRecords(entity) {
      return (recordsByEntity[entity] || []).filter((record) => !record.archived && !record.archivedAt);
    }
    function entitySchema(entity) {
      return payload.schema.find((entry) => entry.name === entity) || payload.schema[0];
    }
    function editableFields(entity) {
      return (entitySchema(entity)?.editableFields || []).slice(0, 6);
    }
    function emptyValues(entity) {
      return Object.fromEntries(editableFields(entity).map((field) => [field, ""]));
    }
    function render() {
      const schema = entitySchema(activeEntity);
      const active = activeRecords(activeEntity);
      const archivedCount = (recordsByEntity[activeEntity] || []).length - active.length;
      root.innerHTML = [
        '<header><div><h1>' + escapeHtml(payload.draft.app.name) + '</h1><p class="muted">' + escapeHtml(payload.draft.app.description) + '</p></div><span class="badge mono">' + escapeHtml(payload.appId) + '</span></header>',
        '<main>',
          '<section class="grid" aria-label="Dashboard summary">',
            card("Active " + schema.label, '<strong>' + active.length + '</strong><p class="muted">Visible records in local state.</p>'),
            card("Archived", '<strong>' + archivedCount + '</strong><p class="muted">Hidden without deleting seed history.</p>'),
            card("API routes", '<strong>' + payload.draft.app.apiRoutes.length + '</strong><p class="muted">Handler module included in source.</p>'),
          '</section>',
          '<div class="entity-tabs">' + payload.schema.map((entity) => '<button type="button" data-entity="' + escapeAttr(entity.name) + '" aria-pressed="' + String(entity.name === activeEntity) + '">' + escapeHtml(entity.label) + '</button>').join("") + '</div>',
          '<section class="workspace">',
            card((editingId ? "Edit " : "Create ") + schema.label, renderForm(schema)),
            card(schema.label + " list", active.map(renderRecord).join("") || '<p class="muted">No active records yet.</p>'),
          '</section>',
        '</main>'
      ].join("");
      root.querySelectorAll("[data-entity]").forEach((button) => button.addEventListener("click", () => {
        activeEntity = button.dataset.entity;
        editingId = "";
        formValues = emptyValues(activeEntity);
        render();
      }));
      const form = root.querySelector("form");
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        if (editingId) updateRecord(activeEntity, editingId, values);
        else createRecord(activeEntity, values);
      });
      root.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
        startEdit(activeEntity, button.dataset.edit);
      }));
      root.querySelectorAll("[data-archive]").forEach((button) => button.addEventListener("click", () => {
        archiveRecord(activeEntity, button.dataset.archive);
      }));
      root.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
        editingId = "";
        formValues = emptyValues(activeEntity);
        render();
      });
    }
    function renderForm(schema) {
      return '<form class="form">' + editableFields(schema.name).map((field) =>
        '<label>' + escapeHtml(field) + '<input name="' + escapeAttr(field) + '" value="' + escapeAttr(formValues[field] ?? "") + '" ' + (schema.requiredFields.includes(field) ? "required" : "") + '></label>'
      ).join("") + '<button class="primary" type="submit">' + (editingId ? "Save changes" : "Create record") + '</button>' + (editingId ? '<button type="button" data-cancel-edit>Cancel edit</button>' : "") + '</form>';
    }
    function renderRecord(record) {
      const title = record.title || record.name || record.label || record.customerName || record.email || record.id;
      const detail = Object.entries(record).filter(([key]) => key !== "id" && key !== "archived" && key !== "archivedAt").slice(0, 3).map(([key, value]) => key + ": " + value).join(" | ");
      return '<article class="row"><div><strong>' + escapeHtml(title) + '</strong><p class="muted mono">' + escapeHtml(detail) + '</p></div><div class="row-actions"><button type="button" data-edit="' + escapeAttr(record.id) + '">Edit</button><button class="danger" type="button" data-archive="' + escapeAttr(record.id) + '">Archive</button></div></article>';
    }
    function createRecord(entity, values) {
      const id = entity.slice(0, 3).toLowerCase() + "_" + Math.random().toString(36).slice(2, 8);
      recordsByEntity[entity] = [{ id, ...values }, ...(recordsByEntity[entity] || [])];
      formValues = emptyValues(entity);
      render();
    }
    function startEdit(entity, id) {
      const record = (recordsByEntity[entity] || []).find((entry) => String(entry.id) === String(id));
      if (!record) return;
      editingId = id;
      formValues = Object.fromEntries(editableFields(entity).map((field) => [field, record[field] ?? ""]));
      render();
    }
    function updateRecord(entity, id, values) {
      recordsByEntity[entity] = (recordsByEntity[entity] || []).map((record) => String(record.id) === String(id) ? { ...record, ...values } : record);
      editingId = "";
      formValues = emptyValues(entity);
      render();
    }
    function archiveRecord(entity, id) {
      recordsByEntity[entity] = (recordsByEntity[entity] || []).map((record) => String(record.id) === String(id) ? { ...record, archived: true, archivedAt: new Date().toISOString() } : record);
      render();
    }
    function card(title, body) { return '<article class="card"><h3>' + escapeHtml(title) + '</h3><div class="list">' + body + '</div></article>'; }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
    render();
  </script>
</body>
</html>`;
}

function renderMainTsx(draft: GeneratedAppRuntimeDraft) {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import { GeneratedApp } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Generated app root element is missing.");
root.dataset.reactReady = "true";

createRoot(root).render(
  <React.StrictMode>
    <GeneratedApp />
  </React.StrictMode>,
);

export const generatedAppSlug = ${JSON.stringify(draft.app.slug)};
`;
}

function renderAppTsx(draft: GeneratedAppRuntimeDraft, model: RuntimeModel) {
  const appName = JSON.stringify(draft.app.name);
  const description = JSON.stringify(draft.app.description);
  const summary = JSON.stringify(draft.summary);
  const primaryEntity = JSON.stringify(model.primaryEntity);
  const pageMap = JSON.stringify(draft.app.pages, null, 2);
  const pageCount = draft.app.pages.length;
  const apiCount = draft.app.apiRoutes.length;
  return `import { FormEvent, useMemo, useState } from "react";
import { apiRoutes } from "./api/generated-api";
import { generatedSchema, primaryEntity as defaultEntity } from "./data/schema";
import seedData from "./data/seed-data.json";
import "./styles.css";

type RecordValue = string | number | boolean | null;
type GeneratedRecord = Record<string, RecordValue | undefined>;
type SeedData = Record<string, GeneratedRecord[]>;

const appName = ${appName};
const description = ${description};
const summary = ${summary};
const preferredEntity = ${primaryEntity};
const generatedPages = ${pageMap};
const typedSeedData = seedData as SeedData;

export function GeneratedApp() {
  const [selectedEntity, setSelectedEntity] = useState(preferredEntity || defaultEntity);
  const [recordsByEntity, setRecordsByEntity] = useState<SeedData>(() => cloneSeedData(typedSeedData));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>(() => emptyDraft(selectedEntity));
  const schema = entitySchema(selectedEntity);
  const activeRecords = useMemo(
    () => (recordsByEntity[selectedEntity] ?? []).filter((record) => !record.archived && !record.archivedAt),
    [recordsByEntity, selectedEntity],
  );
  const archivedCount = (recordsByEntity[selectedEntity] ?? []).length - activeRecords.length;
  const requiredCount = schema.requiredFields.length;

  function selectEntity(entityName: string) {
    setSelectedEntity(entityName);
    setEditingId(null);
    setDraftValues(emptyDraft(entityName));
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    const id = nextRecordId(selectedEntity);
    setRecordsByEntity((current) => ({
      ...current,
      [selectedEntity]: [{ id, ...values }, ...(current[selectedEntity] ?? [])],
    }));
    setDraftValues(emptyDraft(selectedEntity));
  }

  function startEdit(record: GeneratedRecord) {
    setEditingId(String(record.id ?? ""));
    setDraftValues(Object.fromEntries(schema.editableFields.map((field) => [field, String(record[field] ?? "")])));
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    const values = formValues(event.currentTarget);
    setRecordsByEntity((current) => ({
      ...current,
      [selectedEntity]: (current[selectedEntity] ?? []).map((record) => (
        String(record.id) === editingId ? { ...record, ...values } : record
      )),
    }));
    setEditingId(null);
    setDraftValues(emptyDraft(selectedEntity));
  }

  function archiveRecord(recordId: string) {
    setRecordsByEntity((current) => ({
      ...current,
      [selectedEntity]: (current[selectedEntity] ?? []).map((record) => (
        String(record.id) === recordId
          ? { ...record, archived: true, archivedAt: new Date().toISOString() }
          : record
      )),
    }));
    if (editingId === recordId) {
      setEditingId(null);
      setDraftValues(emptyDraft(selectedEntity));
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Generated Taskloom app</p>
          <h1>{appName}</h1>
          <p>{description}</p>
        </div>
        <dl className="dashboard-summary" aria-label="Dashboard summary">
          <div>
            <dt>Active {schema.label}</dt>
            <dd>{activeRecords.length}</dd>
          </div>
          <div>
            <dt>Archived</dt>
            <dd>{archivedCount}</dd>
          </div>
          <div>
            <dt>API routes</dt>
            <dd>{apiRoutes.length}</dd>
          </div>
        </dl>
      </header>

      <section className="dashboard-strip" aria-label="Generated app dashboard">
        <article>
          <span>Pages</span>
          <strong>${pageCount}</strong>
        </article>
        <article>
          <span>Schema fields</span>
          <strong>{schema.fields.length}</strong>
        </article>
        <article>
          <span>Required inputs</span>
          <strong>{requiredCount}</strong>
        </article>
        <article>
          <span>Handler routes</span>
          <strong>${apiCount}</strong>
        </article>
      </section>

      <section className="panel page-map" aria-label="Generated page map">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pages</p>
            <h2>Generated workflow</h2>
          </div>
        </div>
        <div className="record-stack">
          {generatedPages.map((page) => (
            <article key={page.route} className="record-row">
              <div>
                <strong>{page.name}</strong>
                <p>{page.purpose}</p>
              </div>
              <span className="badge">{page.access}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="entity-tabs" aria-label="Entities">
        {generatedSchema.entities.map((entity) => (
          <button
            key={entity.name}
            type="button"
            aria-pressed={entity.name === selectedEntity}
            onClick={() => selectEntity(entity.name)}
          >
            {entity.label}
          </button>
        ))}
      </section>

      <section className="workspace-grid">
        <form className="panel editor" onSubmit={editingId ? handleEdit : handleCreate}>
          <div>
            <p className="eyebrow">{editingId ? "Edit record" : "Create record"}</p>
            <h2>{schema.label}</h2>
            <p>{summary}</p>
          </div>
          {schema.editableFields.map((field) => (
            <label key={field}>
              <span>{field}</span>
              <input
                name={field}
                value={draftValues[field] ?? ""}
                required={schema.requiredFields.includes(field)}
                onChange={(event) => setDraftValues((current) => ({ ...current, [field]: event.target.value }))}
              />
            </label>
          ))}
          <div className="button-row">
            <button className="primary" type="submit">{editingId ? "Save changes" : "Create"}</button>
            {editingId ? (
              <button type="button" onClick={() => { setEditingId(null); setDraftValues(emptyDraft(selectedEntity)); }}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="panel record-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Local state</p>
              <h2>{schema.label} list</h2>
            </div>
            <span>{activeRecords.length} active</span>
          </div>
          {activeRecords.map((record) => (
            <article key={String(record.id)} className="record-row">
              <div>
                <h3>{recordTitle(record)}</h3>
                <p>{recordSummary(record)}</p>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => startEdit(record)}>Edit</button>
                <button className="danger" type="button" onClick={() => archiveRecord(String(record.id))}>Archive</button>
              </div>
            </article>
          ))}
          {activeRecords.length === 0 ? <p className="empty">No active records. Create one to repopulate the list.</p> : null}
        </section>
      </section>
    </main>
  );
}

function cloneSeedData(data: SeedData): SeedData {
  return Object.fromEntries(Object.entries(data).map(([entity, records]) => [
    entity,
    records.map((record) => ({ ...record })),
  ]));
}

function entitySchema(entityName: string) {
  return generatedSchema.entities.find((entity) => entity.name === entityName) ?? generatedSchema.entities[0];
}

function emptyDraft(entityName: string): Record<string, string> {
  return Object.fromEntries(entitySchema(entityName).editableFields.map((field) => [field, ""]));
}

function formValues(form: HTMLFormElement): GeneratedRecord {
  return Object.fromEntries(new FormData(form).entries()) as GeneratedRecord;
}

function nextRecordId(entityName: string): string {
  return entityName.slice(0, 4).toLowerCase() + "_" + Math.random().toString(36).slice(2, 9);
}

function recordTitle(record: GeneratedRecord): string {
  return String(record.title ?? record.name ?? record.label ?? record.customerName ?? record.email ?? record.id ?? "Untitled record");
}

function recordSummary(record: GeneratedRecord): string {
  return Object.entries(record)
    .filter(([key]) => !["id", "archived", "archivedAt"].includes(key))
    .slice(0, 4)
    .map(([key, value]) => key + ": " + String(value ?? ""))
    .join(" | ");
}
`;
}

function renderPackageJson(draft: GeneratedAppRuntimeDraft) {
  return JSON.stringify({
    name: draft.app.slug,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {
      "@vitejs/plugin-react": "^5.0.0",
      vite: "^7.0.0",
      typescript: "^5.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
  }, null, 2);
}

function renderTsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ES2022"],
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      jsx: "react-jsx",
      resolveJsonModule: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
      isolatedModules: true,
      noEmit: true,
    },
    include: ["src"],
  }, null, 2);
}

function renderViteConfig() {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;
}

function renderStylesCss() {
  return `:root {
  color: #172026;
  background: #f6f8fa;
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input {
  font: inherit;
}

button {
  background: #ffffff;
  border: 1px solid #d8e0e6;
  border-radius: 8px;
  color: #172026;
  cursor: pointer;
  padding: 9px 12px;
}

button.primary {
  background: #0f766e;
  border-color: #0f766e;
  color: #ffffff;
}

button.danger {
  color: #b42318;
}

input {
  border: 1px solid #d8e0e6;
  border-radius: 8px;
  padding: 10px 11px;
  width: 100%;
}

label {
  color: #5f6f7a;
  display: grid;
  gap: 5px;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

.app-shell {
  display: grid;
  gap: 20px;
  min-height: 100vh;
  padding: 32px;
}

.hero,
.panel,
.dashboard-strip article {
  background: #ffffff;
  border: 1px solid #d8e0e6;
  border-radius: 8px;
}

.hero {
  align-items: end;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 24px;
}

.dashboard-summary,
.dashboard-strip,
.workspace-grid {
  display: grid;
  gap: 12px;
}

.dashboard-summary {
  grid-template-columns: repeat(3, minmax(96px, 1fr));
  margin: 0;
}

.dashboard-summary div,
.dashboard-strip article {
  padding: 14px;
}

dt,
.eyebrow,
.dashboard-strip span,
.record-row p,
.empty {
  color: #61717d;
}

dd {
  font-size: 24px;
  font-weight: 800;
  margin: 4px 0 0;
}

.eyebrow {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  margin-bottom: 7px;
  text-transform: uppercase;
}

.dashboard-strip {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.dashboard-strip strong {
  display: block;
  font-size: 24px;
  margin-top: 4px;
}

.entity-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.entity-tabs button[aria-pressed="true"] {
  border-color: #0f766e;
  box-shadow: inset 0 -3px 0 #0f766e;
}

.workspace-grid {
  align-items: start;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.4fr);
}

.panel {
  padding: 20px;
}

.editor {
  display: grid;
  gap: 12px;
}

.section-heading,
.record-row,
.button-row {
  display: flex;
  gap: 12px;
}

.section-heading,
.record-row {
  align-items: flex-start;
  justify-content: space-between;
}

.record-row {
  border-top: 1px solid #e3e9ee;
  padding: 14px 0;
}

.record-row h3 {
  margin-bottom: 6px;
}

.button-row {
  flex-wrap: wrap;
}

@media (max-width: 840px) {
  .app-shell {
    padding: 18px;
  }

  .hero,
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-summary {
    grid-template-columns: 1fr;
  }
}
`;
}

function renderApiHandlerTs(model: RuntimeModel) {
  return `import seedData from "../data/seed-data.json";
import { generatedSchema, primaryEntity } from "../data/schema";

export type GeneratedApiRequest = {
  method: string;
  path: string;
  body?: Record<string, unknown>;
};

type GeneratedRecord = Record<string, string | number | boolean | null | undefined>;

const recordsByEntity: Record<string, GeneratedRecord[]> = Object.fromEntries(
  Object.entries(seedData as Record<string, GeneratedRecord[]>).map(([entity, records]) => [
    entity,
    records.map((record) => ({ ...record })),
  ]),
);

export async function handleGeneratedApiRequest(request: GeneratedApiRequest) {
  const entity = entityForPath(request.path);
  if (!entity) return { status: 404, body: { error: "No generated entity route matched." } };

  const method = request.method.toUpperCase();
  const segments = request.path.split("/").filter(Boolean);
  const id = segments.at(-1);
  const records = recordsByEntity[entity.name] ?? [];
  const normalizedLastSegment = String(id ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedEntity = entity.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const collectionRequest = !id || normalizedLastSegment === normalizedEntity || normalizedLastSegment === normalizedEntity + "s";

  if (method === "GET") {
    const active = records.filter((record) => !record.archived && !record.archivedAt);
    return { status: 200, body: collectionRequest ? active : active.find((record) => String(record.id) === id) ?? null };
  }

  const missingFields = entity.requiredFields.filter((field) => request.body?.[field] === undefined);
  if (missingFields.length > 0) return { status: 400, body: { error: "Missing required fields.", missingFields } };

  if (method === "POST") {
    const record = { id: entity.name.slice(0, 4).toLowerCase() + "_" + Date.now(), ...(request.body ?? {}) };
    recordsByEntity[entity.name] = [record, ...records];
    return { status: 201, body: record };
  }

  if (method === "PATCH" && id) {
    const updated = records.map((record) => String(record.id) === id ? { ...record, ...(request.body ?? {}) } : record);
    recordsByEntity[entity.name] = updated;
    return { status: 200, body: updated.find((record) => String(record.id) === id) ?? null };
  }

  if (method === "DELETE" && id) {
    recordsByEntity[entity.name] = records.map((record) => String(record.id) === id ? { ...record, archived: true, archivedAt: new Date().toISOString() } : record);
    return { status: 200, body: { ok: true, archivedId: id } };
  }

  return { status: 405, body: { error: "Unsupported generated API method." } };
}

function entityForPath(path: string) {
  const normalizedPath = path.toLowerCase().replace(/[^a-z0-9]/g, "");
  return generatedSchema.entities.find((entity) => {
    const normalizedEntity = entity.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalizedPath.includes(normalizedEntity) || normalizedPath.includes(normalizedEntity + "s");
  });
}

export const generatedApiPrimaryEntity = ${JSON.stringify(model.primaryEntity)};
`;
}

function renderSchemaTs(model: RuntimeModel) {
  return `export const primaryEntity = ${JSON.stringify(model.primaryEntity)} as const;

export const generatedSchema = {
  database: "local-state",
  primaryEntity,
  entities: ${JSON.stringify(model.schema, null, 2)}
} as const;

export const schema = generatedSchema.entities;

export type GeneratedSchemaEntity = typeof schema[number];
`;
}

function renderMigrationSql(model: RuntimeModel) {
  return model.schema.map((entity) => {
    const fieldNames = new Set(entity.fields.map((field) => snakeCase(field.name)));
    const columns = entity.fields.map((field) => `  ${snakeCase(field.name)} ${sqlType(field.type)}${field.name === "id" ? " PRIMARY KEY" : field.required ? " NOT NULL" : ""}`);
    if (!fieldNames.has("id")) columns.unshift("  id TEXT PRIMARY KEY");
    columns.push("  archived BOOLEAN NOT NULL DEFAULT FALSE");
    columns.push("  archived_at TIMESTAMPTZ");
    return `CREATE TABLE IF NOT EXISTS ${snakeCase(entity.name)} (
${columns.join(",\n")}
);`;
  }).join("\n\n");
}

function renderSeedTs(model: RuntimeModel) {
  const entityNames = model.schema.map((entity) => entity.name);
  return `import seedData from "../data/seed-data.json";

export const generatedSeedEntities = ${JSON.stringify(entityNames, null, 2)} as const;

export function loadGeneratedSeedData() {
  return seedData as Record<string, Array<Record<string, string | number | boolean | null>>>;
}
`;
}

function renderReadme(draft: GeneratedAppRuntimeDraft, appId: string, checkpointId: string, model?: RuntimeModel) {
  return `# ${draft.app.name}

Generated app artifact for \`${appId}\` at checkpoint \`${checkpointId}\`.

${draft.summary}

Primary entity: \`${model?.primaryEntity ?? draft.app.dataSchema[0]?.name ?? "record"}\`.

## Local CRUD

The generated app runs with local React state seeded from \`src/data/seed-data.json\`.
It includes dashboard counts, entity switching, create, edit, and archive actions for the primary entity.

## Data Files

- \`src/data/schema.ts\` - typed local schema.
- \`src/data/seed-data.json\` - starter records.
- \`src/api/generated-api.ts\` - simple CRUD-ish handler.
- \`src/db/migrations/0001_initial.sql\` - starter table DDL.
- \`src/db/seed.ts\` - seed loader helper.

## Routes

${draft.app.pages.map((page) => `- \`${page.route}\` - ${page.name} (${page.access})`).join("\n")}

## API

${draft.app.apiRoutes.map((route) => `- \`${route.method} ${route.path}\` - ${route.purpose}`).join("\n")}
`;
}

function buildRuntimeModel(draft: GeneratedAppRuntimeDraft): RuntimeModel {
  const primaryEntity = draft.app.crudFlows[0]?.entity
    ?? draft.app.dataSchema[0]?.name
    ?? "record";
  const sourceEntities = draft.app.dataSchema.length > 0
    ? draft.app.dataSchema
    : [{
      name: primaryEntity,
      fields: [
        { name: "id", type: "string", required: true },
        { name: "name", type: "string", required: true },
        { name: "status", type: "string", required: true },
      ],
      relationships: [],
    }];
  const schema = sourceEntities.map((entity) => {
    const fields = ensureIdField(entity.fields).map((field) => ({ ...field }));
    const editableFields = fields
      .filter((field) => field.name !== "id" && !field.name.endsWith("At") && field.name !== "archivedAt")
      .map((field) => field.name);
    return {
      name: entity.name,
      label: titleCase(humanLabel(entity.name)),
      fields,
      requiredFields: fields.filter((field) => field.required && field.name !== "id").map((field) => field.name),
      editableFields: editableFields.length > 0 ? editableFields : ["name", "status"],
      relationships: [...entity.relationships],
    };
  });
  const seedData = Object.fromEntries(schema.map((entity) => [
    entity.name,
    [1, 2].map((index) => seedRecordForEntity(entity, index)),
  ]));
  return { primaryEntity, schema, seedData };
}

function ensureIdField(fields: RuntimeSchemaEntity["fields"]): RuntimeSchemaEntity["fields"] {
  return fields.some((field) => field.name === "id")
    ? fields
    : [{ name: "id", type: "string", required: true }, ...fields];
}

function seedRecordForEntity(entity: RuntimeSchemaEntity, index: number): RuntimeSeedRecord {
  return Object.fromEntries(entity.fields.map((field) => [
    field.name,
    seedValueForField(entity.name, field.name, field.type, index),
  ]));
}

function contentTypeForPath(path: string) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "text/typescript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".sql")) return "application/sql; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function humanLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
}

function seedValueForField(entityName: string, fieldName: string, fieldType: string, index: number): RuntimeRecordValue {
  if (fieldName === "id") return `${entityName}_${String(index).padStart(3, "0")}`;
  if (/email/i.test(fieldName)) return `${entityName}${index}@example.com`;
  if (/Id$/.test(fieldName)) return `${fieldName.replace(/Id$/, "").toLowerCase()}_${String(index).padStart(3, "0")}`;
  if (/title|name|label/i.test(fieldName)) return `${titleCase(humanLabel(entityName))} ${index}`;
  if (/status/i.test(fieldName)) return index === 1 ? "active" : "pending";
  if (/priority/i.test(fieldName)) return index === 1 ? "high" : "medium";
  if (/stage/i.test(fieldName)) return index === 1 ? "discovery" : "proposal";
  if (fieldType === "number") return index * 10;
  if (fieldType === "boolean") return true;
  if (fieldType === "date") return `2026-0${index}-01`;
  if (fieldType === "datetime") return `2026-0${index}-01T00:00:00.000Z`;
  if (fieldType === "enum") return "active";
  return `${humanLabel(fieldName)} sample ${index}`;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function snakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function sqlType(value: string) {
  switch (value) {
    case "uuid": return "TEXT";
    case "number": return "NUMERIC";
    case "boolean": return "BOOLEAN";
    case "date": return "DATE";
    case "datetime": return "TIMESTAMPTZ";
    default: return "TEXT";
  }
}

function normalizeSourcePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/[<>&]/g, (char) => {
    if (char === "<") return "\\u003c";
    if (char === ">") return "\\u003e";
    return "\\u0026";
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function escapeJsxText(value: unknown) {
  return String(value ?? "").replace(/[{}<>]/g, (char) => {
    switch (char) {
      case "{": return "&#123;";
      case "}": return "&#125;";
      case "<": return "&lt;";
      default: return "&gt;";
    }
  });
}
