import { createWriteStream, type WriteStream } from "node:fs";
import { resolve } from "node:path";
import type { Context } from "hono";
import { redactSensitiveString } from "./redaction.js";

type AccessLogMode = "stdout" | "file" | "off";

type AccessLogConfig = {
  mode: AccessLogMode;
  filePath: string | null;
};

export type AccessLogLineInput = {
  method: string;
  status: number;
  path: string;
  query?: string | null;
  durationMs: number;
  userId: string | null;
  workspaceId: string | null;
  requestId: string | null;
  now: Date;
};

let cachedFileStream: WriteStream | null = null;
let cachedFilePath: string | null = null;

function readConfig(): AccessLogConfig {
  const rawMode = (process.env.TASKLOOM_ACCESS_LOG_MODE ?? "off").toLowerCase();
  const mode: AccessLogMode = rawMode === "stdout" || rawMode === "file" ? rawMode : "off";
  const rawPath = process.env.TASKLOOM_ACCESS_LOG_PATH;
  const filePath = mode === "file" && rawPath ? resolve(process.cwd(), rawPath) : null;
  return { mode, filePath };
}

function getFileStream(filePath: string): WriteStream {
  if (cachedFileStream && cachedFilePath === filePath) return cachedFileStream;
  if (cachedFileStream) {
    try { cachedFileStream.end(); } catch { /* ignore */ }
  }
  cachedFileStream = createWriteStream(filePath, { flags: "a" });
  cachedFilePath = filePath;
  return cachedFileStream;
}

export function formatAccessLogLine(input: AccessLogLineInput): string {
  const { method, status, path, query, durationMs, userId, workspaceId, requestId, now } = input;
  const fullPath = query ? `${path}?${query}` : path;
  const redactedPath = redactSensitiveString(fullPath);
  const line = {
    ts: now.toISOString(),
    method,
    status,
    path: redactedPath,
    durationMs,
    userId,
    workspaceId,
    requestId,
  };
  return `${JSON.stringify(line)}\n`;
}

export function __resetAccessLogForTests(): void {
  if (cachedFileStream) {
    try { cachedFileStream.end(); } catch { /* ignore */ }
  }
  cachedFileStream = null;
  cachedFilePath = null;
}

export function accessLogMiddleware(): (c: Context, next: () => Promise<void>) => Promise<void> {
  const config = readConfig();
  if (config.mode === "off") {
    return async (_c, next) => {
      await next();
    };
  }
  return async (c, next) => {
    const start = Date.now();
    let threwError: unknown = null;
    let status = 500;
    try {
      await next();
      status = c.res.status;
    } catch (error) {
      threwError = error;
      status = 500;
    }
    const durationMs = Date.now() - start;
    const url = new URL(c.req.url);
    const query = url.search.slice(1);
    const userId = (c.get("user") as { id?: string } | undefined)?.id ?? null;
    const workspaceId = (c.get("workspace") as { id?: string } | undefined)?.id ?? null;
    const requestId = c.req.header("x-request-id") ?? null;
    const serialized = formatAccessLogLine({
      method: c.req.method,
      status,
      path: c.req.path,
      query: query || null,
      durationMs,
      userId,
      workspaceId,
      requestId,
      now: new Date(),
    });
    if (config.mode === "stdout") {
      process.stdout.write(serialized);
    } else if (config.mode === "file" && config.filePath) {
      const stream = getFileStream(config.filePath);
      stream.write(serialized);
    }
    if (threwError) throw threwError;
  };
}
