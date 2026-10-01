import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, outcomeOf, RULES } from "../skills/flow-core/scripts/verdict.mjs";

function rubric(overrides = {}) {
  return RULES.map((rule) => ({ rule, result: "looked", outcome: overrides[rule] ?? "holds" }));
}

const finding = (rule, severity) => ({ rule, severity, what: "x", path: "src/x.ts", line: 1, evidence: "line" });

test("a valid PASS passes and is done", () => {
  const v = { ruling: "PASS", rubric: rubric(), findings: [] };
  assert.deepEqual(validate(v), []);
  assert.equal(outcomeOf(v), "done");
});

test("a PASS with objective no-yardstick is rejected", () => {
  const v = { ruling: "PASS", rubric: rubric({ objective: "no-yardstick" }), findings: [] };
  assert.deepEqual(validate(v), ["PASS needs objective and tdd-assertion to hold"]);
});

test("a FAIL with a high scope finding is accepted", () => {
  const v = { ruling: "FAIL", rubric: rubric({ scope: "holds" }), findings: [finding("scope", "high")] };
  assert.deepEqual(validate(v), []);
  assert.equal(outcomeOf(v), "failed");
});

test("a PASS with a high finding is rejected", () => {
  const v = { ruling: "PASS", rubric: rubric(), findings: [finding("objective", "high")] };
  assert.deepEqual(validate(v), ["PASS with a high finding is contradictory"]);
});
