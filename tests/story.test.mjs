import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseStory, score } from "../skills/flow-core/scripts/score_story.mjs";
import { scan } from "../skills/flow-core/scripts/redflags.mjs";
import { validate, outcomeOf, RULES } from "../skills/flow-core/scripts/verdict.mjs";

const TEMPLATE = fs.readFileSync(path.resolve("skills/flow-core/templates/story.md"), "utf8");

const good = `# 01 Footer Medium link — Story

Status: backlog
Spec: docs/specs/x.md
Type: ui
Area: footer
Gate: visual
Signal: N/A — static markup, covered by the e2e guard
Dep: none

## Delivers

A visitor sees Medium beside Instagram, Spotify and YouTube in the footer.

## Accepts

- Given the homepage, when the footer renders, then it shows four social links including Medium
- Given the Medium link, when it is inspected, then its href points at medium.com

## Protected

- src/app/page.tsx section count
`;

test("the untouched story template scores rework", () => {
  const s = score(parseStory(TEMPLATE));
  assert.equal(s.band, "rework");
});

test("a complete story scores proceed", () => {
  const s = score(parseStory(good));
  assert.equal(s.dims.clarity, 10);
  assert.equal(s.dims.independence, 10);
  assert.equal(s.dims.testability, 10);
  assert.ok(s.total >= 9, `total ${s.total}`);
  assert.equal(s.band, "proceed");
});

test("red flags lower the size dimension and are counted with word boundaries", () => {
  assert.equal(scan("The band played on").count, 0);
  const r = scan("Manage the feed and handle errors, then retry");
  assert.equal(r.count, 4);
  assert.deepEqual(Object.keys(r.hits).sort(), ["action", "coordination", "sequence"]);
  const s = score(parseStory(good.replace("A visitor sees Medium beside Instagram, Spotify and YouTube", "Add Medium, handle the filter, then update tests so a visitor sees Medium")));
  assert.ok(s.dims.size < 10);
  assert.ok(s.notes.some((n) => /red-flag/.test(n)));
});

test("more than seven acceptance criteria lowers testability and asks for a split", () => {
  const many = good.replace("## Protected", Array.from({ length: 7 }, (_, i) => `- Given x${i}, when y, then z`).join("\n") + "\n\n## Protected");
  const s = score(parseStory(many));
  assert.ok(s.dims.testability < 10);
  assert.ok(s.notes.some((n) => /split/.test(n)));
});

function verdict(over = {}) {
  return {
    ruling: "PASS",
    rubric: RULES.map((rule) => ({ rule, result: "ok", outcome: "holds" })),
    findings: [],
    ...over,
  };
}

test("a clean verdict validates; outcome done", () => {
  assert.deepEqual(validate(verdict()), []);
  assert.equal(outcomeOf(verdict()), "done");
});

test("PASS with a high finding, FAIL without one, and a missing rule are rejected", () => {
  const high = { rule: "objective", severity: "high", what: "x", path: "a.ts", line: 3, evidence: "y" };
  assert.ok(validate(verdict({ findings: [high] })).some((e) => /contradictory/.test(e)));
  assert.ok(validate(verdict({ ruling: "FAIL" })).some((e) => /FAIL needs/.test(e)));
  assert.deepEqual(validate(verdict({ ruling: "FAIL", findings: [high] })), []);
  const missing = verdict();
  missing.rubric = missing.rubric.slice(1);
  assert.ok(validate(missing).some((e) => /objective missing/.test(e)));
});

test("severity limits, evidence and line types are enforced", () => {
  const bad = verdict({ findings: [{ rule: "test-quality", severity: "high", what: "x", path: "a", line: "3", evidence: "" }] });
  const errors = validate(bad);
  assert.ok(errors.some((e) => /may not be high/.test(e)));
  assert.ok(errors.some((e) => /line must be an integer/.test(e)));
  assert.ok(errors.some((e) => /evidence must be/.test(e)));
  const medium = verdict({ findings: [{ rule: "scope", severity: "medium", what: "x", path: "a", line: null, evidence: "y" }] });
  assert.deepEqual(validate(medium), []);
  assert.equal(outcomeOf(medium), "corrections");
});
