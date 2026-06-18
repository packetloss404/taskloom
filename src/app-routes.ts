import { Hono } from "hono";
import {
  registerAuthBootstrapRoutes,
  registerWorkspaceMemberRoutes,
  resetAppRouteSecurityForTests,
  setHostInfoSourcesForTests,
  buildHostInfoPayload,
} from "./app-routes/auth-bootstrap.js";
import { registerBuilderRoutes } from "./app-routes/builder-core.js";
import { registerPreviewRoutes } from "./app-routes/preview.js";

export const appRoutes = new Hono();

registerAuthBootstrapRoutes(appRoutes);
registerBuilderRoutes(appRoutes);
registerPreviewRoutes(appRoutes);
registerWorkspaceMemberRoutes(appRoutes);

export { resetAppRouteSecurityForTests, setHostInfoSourcesForTests, buildHostInfoPayload };
