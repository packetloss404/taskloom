import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "./workflow-llm-service.js";

test("extractJson handles fenced ```json blocks", () => {
  const out = extractJson('```json\n{"a":1,"b":[2,3]}\n```');
  assert.deepEqual(out, { a: 1, b: [2, 3] });
});

test("extractJson handles unfenced JSON", () => {
  assert.deepEqual(extractJson('{"x": "y"}'), { x: "y" });
});

test("extractJson handles JSON with surrounding text", () => {
  const out = extractJson('Here is the result:\n\n{"hello": "world"}\n\nHope that helps.');
  assert.deepEqual(out, { hello: "world" });
});

test("extractJson handles strings containing braces", () => {
  const out = extractJson('{"text":"contains {brace}"}');
  assert.deepEqual(out, { text: "contains {brace}" });
});

test("extractJson throws on no object", () => {
  assert.throws(() => extractJson("just plain text"));
});

test("extractJson throws on unbalanced", () => {
  assert.throws(() => extractJson('{"a": 1'));
});
