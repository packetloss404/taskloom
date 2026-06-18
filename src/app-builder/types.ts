export type AppDraftTemplateId =
  | "crm"
  | "booking"
  | "internal_dashboard"
  | "task_tracker"
  | "customer_portal";

export type RouteAccess = "public" | "private" | "admin";

export type AppDraft = {
  prompt: string;
  templateId: AppDraftTemplateId;
  appName: string;
  summary: string;
  integrationMetadata: Phase71IntegrationMetadata;
  pageMap: PageDraft[];
  components: ComponentDraft[];
  apiRouteStubs: ApiRouteStub[];
  dataSchema: DataSchemaDraft;
  seedData: Record<string, SeedRecord[]>;
  crudFlows: CrudFlowDraft[];
  auth: AuthDraft;
  acceptanceChecks: string[];
};

export type Phase71IntegrationId =
  | "openai"
  | "anthropic"
  | "ollama"
  | "custom_api"
  | "slack_webhook"
  | "email"
  | "github"
  | "browser"
  | "stripe"
  | "database";

export type Phase71IntegrationDraft = {
  id: Phase71IntegrationId;
  label: string;
  envVars: string[];
  flows: string[];
  setupGuidance: string[];
};

export type Phase71IntegrationMetadata = {
  requested: Phase71IntegrationDraft[];
  setupGuidance: string[];
};

export type PageDraft = {
  path: string;
  name: string;
  access: RouteAccess;
  purpose: string;
  primaryEntity?: string;
  actions: string[];
};

export type ComponentDraft = {
  name: string;
  type: "layout" | "list" | "form" | "detail" | "chart" | "navigation";
  usedOn: string[];
  responsibilities: string[];
};

export type ApiRouteStub = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  access: RouteAccess;
  purpose: string;
  requestBody?: string;
  responseShape: string;
};

export type DataSchemaDraft = {
  database: "postgres";
  entities: EntitySchemaDraft[];
  notes: string[];
};

export type EntitySchemaDraft = {
  name: string;
  primaryKey: string;
  fields: FieldSchemaDraft[];
  indexes: string[];
  relations: string[];
};

export type FieldSchemaDraft = {
  name: string;
  type: "uuid" | "string" | "text" | "number" | "boolean" | "date" | "datetime" | "enum";
  required: boolean;
  enumValues?: string[];
  references?: string;
};

export type SeedRecord = Record<string, string | number | boolean | null>;

export type CrudFlowDraft = {
  entity: string;
  create: string[];
  read: string[];
  update: string[];
  delete: string[];
};

export type AuthDraft = {
  defaultPolicy: "authenticated-by-default";
  publicRoutes: string[];
  privateRoutes: string[];
  roleRoutes: Array<{ role: "admin"; routes: string[]; reason: string }>;
  decisions: string[];
};

export type GeneratedAppSourceFileKind =
  | "manifest"
  | "config"
  | "source"
  | "route-data"
  | "api"
  | "seed-data"
  | "documentation";

export type GeneratedAppSourceFile = {
  path: string;
  kind: GeneratedAppSourceFileKind;
  contents: string;
  sizeBytes: number;
  checksum: string;
};

export type GeneratedAppSourceArtifactBundle = {
  appName: string;
  appSlug: string;
  templateId: AppDraftTemplateId;
  entrypoint: string;
  files: GeneratedAppSourceFile[];
};
