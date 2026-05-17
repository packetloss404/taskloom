import assert from "node:assert/strict";
import test from "node:test";

import { validateWorkspacePath } from "./path-validator";

// --- Happy-path cases -------------------------------------------------------

test("validateWorkspacePath accepts a standard source file path", () => {
  const result = validateWorkspacePath("src/App.tsx");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "src/App.tsx");
  assert.equal(result.reason, undefined);
});

test("validateWorkspacePath accepts a top-level manifest path", () => {
  const result = validateWorkspacePath("package.json");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "package.json");
});

test("validateWorkspacePath accepts a nested component path and preserves case", () => {
  const result = validateWorkspacePath("src/components/Header.tsx");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "src/components/Header.tsx");
});

// --- Rule 1: empty / whitespace --------------------------------------------

test("rejects an empty string", () => {
  const result = validateWorkspacePath("");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /empty/i);
});

test("rejects a whitespace-only path", () => {
  const result = validateWorkspacePath("   ");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /empty/i);
});

// --- Rule 2: absolute paths -------------------------------------------------

test("rejects a POSIX absolute path", () => {
  const result = validateWorkspacePath("/etc/passwd");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /absolute/i);
});

test("rejects a Windows drive-letter absolute path", () => {
  const result = validateWorkspacePath("C:\\Windows\\System32\\evil.dll");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /absolute/i);
});

test("rejects a bare drive letter", () => {
  const result = validateWorkspacePath("D:");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /absolute/i);
});

// --- Rule 3: UNC / extended paths ------------------------------------------

test("rejects a UNC server-share path", () => {
  const result = validateWorkspacePath("\\\\server\\share\\file.txt");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /UNC|extended/i);
});

test("rejects a Win32 extended-length path prefix", () => {
  const result = validateWorkspacePath("\\\\?\\C:\\foo");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /UNC|extended/i);
});

// --- Rule 4: '..' segments --------------------------------------------------

test("rejects a leading parent-traversal", () => {
  const result = validateWorkspacePath("../etc/passwd");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /\.\./);
});

test("rejects a constructed traversal that normalizes to escape", () => {
  const result = validateWorkspacePath("foo/../../bar");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /\.\./);
});

// --- Rule 5: NUL byte -------------------------------------------------------

test("rejects a path containing a NUL byte", () => {
  const result = validateWorkspacePath("src/App.tsx\0.txt");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /NUL/);
});

// --- Rule 6: ':' (ADS) ------------------------------------------------------

test("rejects an alternate-data-stream colon in the filename", () => {
  const result = validateWorkspacePath("notes.txt:hidden.exe");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /:/);
});

// --- Rule 7: Windows reserved device names ---------------------------------

test("rejects a CON segment", () => {
  const result = validateWorkspacePath("src/CON");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /reserved/i);
});

test("rejects a reserved name with an extension (case-insensitive)", () => {
  const result = validateWorkspacePath("src/nul.json");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /reserved/i);
});

test("rejects a COM port reserved name", () => {
  const result = validateWorkspacePath("COM1.tsx");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /reserved/i);
});

test("rejects an LPT port reserved name", () => {
  const result = validateWorkspacePath("src/lpt9");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /reserved/i);
});

// --- Rule 8: trailing dot or whitespace ------------------------------------

test("rejects a segment with a trailing dot", () => {
  const result = validateWorkspacePath("src/App.tsx.");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /trailing/i);
});

test("rejects a segment with trailing whitespace", () => {
  const result = validateWorkspacePath("src/App.tsx ");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /trailing/i);
});

// --- Rule 9: length ---------------------------------------------------------

test("rejects paths longer than 255 characters", () => {
  const longSegment = "a".repeat(260);
  const result = validateWorkspacePath(`src/${longSegment}.tsx`);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /255|length|exceeds/i);
});

// --- Rule 10: defense-in-depth resolve check -------------------------------

test("rejects a path that resolves to the workspace root itself", () => {
  const result = validateWorkspacePath(".");
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /root|escape|\.\./i);
});

// --- Normalization niceties -------------------------------------------------

test("strips a leading './' on success", () => {
  const result = validateWorkspacePath("./src/App.tsx");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "src/App.tsx");
});

test("collapses duplicate slashes on success", () => {
  const result = validateWorkspacePath("src//components//Header.tsx");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "src/components/Header.tsx");
});

test("converts Windows separators to POSIX on success", () => {
  const result = validateWorkspacePath("src\\components\\Header.tsx");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "src/components/Header.tsx");
});
