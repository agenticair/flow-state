import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseSpec, score, summary, freezable, setStatus } from "../skills/flow-core/scripts/spec.mjs";

const SCRIPT = path.resolve("skills/flow-core/scripts/spec.mjs");
const TEMPLATE = fs.readFileSync(path.resolve("skills/flow-core/templates/spec.md"), "utf8");

function filled({ needs = 0, proposed = false, pending = false } = {}) {
  return `# Writing — Spec

Status: DRAFT
Date: 2026-09-29
Project: demo
Ticket: none

## Hypothesis

**Bet:** Visitors who read one post are likelier to join the list.
**We would know it failed if:** ${pending ? "[⚠️ Pending: define with owner]" : "list sign-ups from /writing stay at zero for four weeks (analytics, weekly)"}
**Anti-scope:** No comments, no search, no images from Medium.

## Frozen decisions

| # | Decision | Provenance |
|---|---|---|
| D-1 | Feed is fetched server-side with revalidate 3600 | said: "never client-side" |
| D-2 | Text only, no Medium images | deduced: from the CSP in \`next.config.ts:12\` |
${proposed ? "| D-3 | Add a search box | proposed |\n" : ""}
## Context for the builder

- Feed URL lives in \`src/lib/writing.ts\`
- **Never** add media queries; responsiveness is clamp-based${needs ? "\n- [NEEDS CLARIFICATION: how many posts on the homepage?]" : ""}

## Parked

| # | Question or proposal | Options seen | Owner |
|---|---|---|---|
| P-1 | proposed: show reading time | yes / no | owner |

## Slices

| # | Slice | Type | Delivers | Dep | Accepts | Protected | Area | Gate | Signal |
|---|---|---|---|---|---|---|---|---|---|
`;
}

test("the untouched template scores FAIL", () => {
  const s = score(parseSpec(TEMPLATE));
  assert.equal(s.gate, "FAIL");
  assert.equal(s.d1, 0);
});

test("a complete spec scores PASS and is freezable", () => {
  const spec = parseSpec(filled());
  const s = score(spec);
  assert.equal(s.d1, 10);
  assert.equal(s.d2, 10);
  assert.equal(s.d3, 10);
  assert.equal(s.gate, "PASS");
  assert.equal(freezable(spec).ok, true);
});

test("a remaining NEEDS CLARIFICATION forces FAIL and blocks freeze", () => {
  const spec = parseSpec(filled({ needs: 1 }));
  assert.equal(score(spec).gate, "FAIL");
  const f = freezable(spec);
  assert.equal(f.ok, false);
  assert.match(f.reasons.join(), /NEEDS CLARIFICATION/);
});

test("a proposed decision in the frozen table blocks freeze", () => {
  const f = freezable(parseSpec(filled({ proposed: true })));
  assert.equal(f.ok, false);
  assert.match(f.reasons.join(), /proposed decision/);
});

test("a pending placeholder lowers the score but does not block freeze", () => {
  const spec = parseSpec(filled({ pending: true }));
  const s = score(spec);
  assert.equal(s.d1, 7);
  assert.equal(s.d3, 9);
  assert.equal(freezable(spec).ok, true);
});

test("summary is one line per hypothesis field and per decision", () => {
  const lines = summary(parseSpec(filled()));
  assert.equal(lines.length, 5);
  assert.match(lines[3], /^D-1 .* \[said\]$/);
  assert.match(lines[4], /^D-2 .* \[deduced\]$/);
});

test("freeze flips the status and stamps the date; unfreeze reverts", () => {
  const frozen = setStatus(filled(), "FROZEN", "2026-09-29");
  assert.match(frozen, /^Status: FROZEN\nFrozen: 2026-09-29$/m);
  const back = setStatus(frozen, "DRAFT", "2026-09-30");
  assert.match(back, /^Status: DRAFT$/m);
  assert.doesNotMatch(back, /^Frozen:/m);
});

test("CLI: freeze refuses a draft with open questions (exit 4) and freezes a clean one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-spec-"));
  const bad = path.join(dir, "bad.md");
  fs.writeFileSync(bad, filled({ needs: 1 }));
  const r = spawnSync(process.execPath, [SCRIPT, "freeze", bad], { encoding: "utf8" });
  assert.equal(r.status, 4);
  const good = path.join(dir, "good.md");
  fs.writeFileSync(good, filled());
  const out = execFileSync(process.execPath, [SCRIPT, "freeze", good], { encoding: "utf8" });
  assert.match(out, /^frozen good\.md/);
  assert.match(fs.readFileSync(good, "utf8"), /^Status: FROZEN$/m);
  const again = spawnSync(process.execPath, [SCRIPT, "freeze", good], { encoding: "utf8" });
  assert.equal(again.status, 4);
});
