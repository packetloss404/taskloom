import assert from "node:assert/strict";
import test from "node:test";
import { translateError } from "./error-translator";

test("rate-limit messages map to busy provider with retry", () => {
  const r = translateError("HTTP 429: rate_limit_exceeded");
  assert.equal(r.title, "AI provider is busy");
  assert.match(r.body, /rate limit/i);
  assert.match(r.suggestion, /Admin . Integrations/);
  assert.equal(r.retryable, true);
  assert.equal(r.technical, "HTTP 429: rate_limit_exceeded");
});

test("401/unauthorized messages map to API key not accepted (not retryable)", () => {
  const r = translateError("Error 401: Unauthorized — invalid api key");
  assert.equal(r.title, "API key not accepted");
  assert.match(r.suggestion, /Admin . Integrations|\.env/);
  assert.equal(r.retryable, false);
});

test("timeout messages map to took too long (retryable)", () => {
  const r = translateError("Request timed out after 60s");
  assert.equal(r.title, "Took too long");
  assert.equal(r.retryable, true);
});

test("ECONNREFUSED maps to can't reach the AI", () => {
  const r = translateError("connect ECONNREFUSED 127.0.0.1:11434");
  assert.equal(r.title, "Can't reach the AI");
  assert.match(r.suggestion, /Ollama|vLLM/);
  assert.equal(r.retryable, true);
});

test("malformed JSON / tool_use failures map to unclear response", () => {
  const r = translateError("tool_use parse failed: malformed JSON at position 247");
  assert.equal(r.title, "AI response was unclear");
  assert.equal(r.retryable, true);
});

test("quota / billing messages map to out of credits (not retryable)", () => {
  const r = translateError("You have exceeded your monthly quota. Please add billing.");
  assert.equal(r.title, "Out of credits");
  assert.equal(r.retryable, false);
});

test("no provider configured maps to no AI provider set up (not retryable)", () => {
  const r = translateError("No provider registered for builder draft");
  assert.equal(r.title, "No AI provider set up");
  assert.match(r.suggestion, /ANTHROPIC_API_KEY|\.env/);
  assert.equal(r.retryable, false);
});

test("TypeScript / TSxxxx errors map to generated code has errors (retryable)", () => {
  const r = translateError("TS2304: Cannot find name 'foo'");
  assert.equal(r.title, "Generated code has errors");
  assert.match(r.suggestion, /Fix these errors|chat/i);
  assert.equal(r.retryable, true);
});

test("context length / file too large maps to app getting too big", () => {
  const r = translateError("This model's maximum context length is 200000 tokens");
  assert.equal(r.title, "App is getting too big");
  assert.equal(r.retryable, true);
});

test("network error maps to can't reach the AI", () => {
  const r = translateError("network error: unable to resolve host");
  assert.equal(r.title, "Can't reach the AI");
  assert.equal(r.retryable, true);
});

test("fallback case for unknown gibberish", () => {
  const r = translateError("flibberty jibberty wozzle");
  assert.equal(r.title, "Something went wrong");
  assert.equal(r.body, "An unexpected error happened.");
  assert.equal(r.retryable, true);
  assert.equal(r.technical, "flibberty jibberty wozzle");
});

test("retryable is false for auth and quota issues", () => {
  assert.equal(translateError("401 unauthorized").retryable, false);
  assert.equal(translateError("billing requires a payment method").retryable, false);
  assert.equal(translateError("insufficient credits to complete request").retryable, false);
  assert.equal(translateError("No provider configured").retryable, false);
});

test("accepts Error instances, not just strings", () => {
  const r = translateError(new Error("HTTP 429 rate limit"));
  assert.equal(r.title, "AI provider is busy");
  assert.equal(r.technical, "HTTP 429 rate limit");
});

test("empty input still produces a fallback (no technical field)", () => {
  const r = translateError("");
  assert.equal(r.title, "Something went wrong");
  assert.equal(r.technical, undefined);
});
