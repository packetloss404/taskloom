import { getDefaultToolRegistry } from "./registry.js";
import { READ_TOOLS } from "./builtins-read.js";
import { WRITE_TOOLS } from "./builtins-write.js";
import { createSandboxedShellTool } from "./sandbox.js";
import { BROWSER_TOOLS } from "./builtins-browser.js";
import { httpFetchTool } from "./http-fetch.js";
import { slackPostWebhookTool, githubApiTool } from "./slack-github.js";
import { emailSendTool, sqlQueryTool } from "./email-sql.js";
import { shellForAgentTool } from "./shell-agent.js";

let registered = false;

const AGENT_CATALOG_TOOLS = [
  httpFetchTool,
  slackPostWebhookTool,
  githubApiTool,
  emailSendTool,
  sqlQueryTool,
  shellForAgentTool,
];

export function listDefaultToolSummaries(): Array<{ name: string; description: string; side: "read" | "write" | "exec" }> {
  return [
    ...READ_TOOLS,
    ...WRITE_TOOLS,
    createSandboxedShellTool(),
    ...BROWSER_TOOLS,
    ...AGENT_CATALOG_TOOLS,
  ].map((tool) => ({
    name: tool.name,
    description: tool.description,
    side: tool.side,
  }));
}

export function registerDefaultTools(): void {
  if (registered) return;
  registered = true;
  const registry = getDefaultToolRegistry();
  registry.registerMany(READ_TOOLS);
  registry.registerMany(WRITE_TOOLS);
  registry.register(createSandboxedShellTool());
  registry.registerMany(BROWSER_TOOLS);
  registry.registerMany(AGENT_CATALOG_TOOLS);
}
