import { getDefaultToolRegistry } from "./registry.js";
import { READ_TOOLS } from "./builtins-read.js";
import { WRITE_TOOLS } from "./builtins-write.js";
import { createSandboxedShellTool } from "./sandbox.js";
import { BROWSER_TOOLS } from "./builtins-browser.js";

let registered = false;

export function registerDefaultTools(): void {
  if (registered) return;
  registered = true;
  const registry = getDefaultToolRegistry();
  registry.registerMany(READ_TOOLS);
  registry.registerMany(WRITE_TOOLS);
  registry.register(createSandboxedShellTool());
  registry.registerMany(BROWSER_TOOLS);
}
