import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseSpec, score, summary, freezable, setStatus } from "../skills/flow-core/scripts/spec.mjs";

const SCRIPT = path.resolve("skills/flow-core/scripts/spec.mjs");
const TEMPLATE = fs.readFileSync(path.resolve("skills/flow-core/templates/spec.md"), "utf8");

function filled({
  needs = 0,
  proposed = false,
  pending = false,
  ticket = "none",
  failure = 'list sign-ups from /writing stay at zero for four weeks (analytics, weekly)',
  measure = "`SELECT count(*) FROM signups WHERE source='writing'` in Metabase; 0 on 2026-09-29",
  said = 'said: "never client-side" (owner, 2026-09-29)',
  deduced = "deduced: from the CSP in `next.config.ts:12`",
} = {}) {
  return `# Writing — Spec

Status: DRAFT
Date: 2026-09-29
Project: demo
Ticket: ${ticket}

## Hypothesis

**Bet:** Visitors who read one post are likelier to join the list.
**We would know it failed if:** ${pending ? "[⚠️ Pending: define with owner]" : failure}
**Measure:** ${measure}
**Anti-scope:** No comments, no search, no images from Medium.

## Frozen decisions

| # | Decision | Provenance |
|---|---|---|
| D-1 | Feed is fetched server-side with revalidate 3600 | ${said} |
| D-2 | Text only, no Medium images | ${deduced} |
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

test("a said decision without a quote and (who, date) blocks freeze; the score is unchanged", () => {
  const spec = parseSpec(filled({ said: 'said: "never client-side"' }));
  assert.equal(score(spec).d2, 10);
  const f = freezable(spec);
  assert.equal(f.ok, false);
  assert.match(f.reasons.join(), /D-1 said without a quote and \(who, date\)/);
});

test("a deduced decision without a source blocks freeze", () => {
  const f = freezable(parseSpec(filled({ deduced: "deduced: obvious" })));
  assert.equal(f.ok, false);
  assert.match(f.reasons.join(), /D-2 deduced without a source/);
});

test("a ticket that could not be read blocks freeze", () => {
  const f = freezable(parseSpec(filled({ ticket: "[⚠️ Pending: ticket X not readable; connect jira]" })));
  assert.equal(f.ok, false);
  assert.match(f.reasons.join(), /ticket not readable/);
});

test("an empty or placeholder failure signal and an empty measure block freeze", () => {
  const f1 = freezable(parseSpec(filled({ failure: "<how we would know>" })));
  assert.match(f1.reasons.join(), /failure signal is empty/);
  const f2 = freezable(parseSpec(filled({ measure: "" })));
  assert.equal(f2.ok, false);
  assert.match(f2.reasons.join(), /measure is empty/);
  assert.equal(freezable(parseSpec(filled({ measure: "[⚠️ Pending: define with owner]" }))).ok, true);
});

test("summary shows each decision's provenance and points at Context for the builder", () => {
  const lines = summary(parseSpec(filled()));
  assert.equal(lines[2], "Measure: `SELECT count(*) FROM signups WHERE source='writing'` in Metabase; 0 on 2026-09-29");
  assert.match(lines[4], /^D-1 .* \[said: "never client-side" \(owner, 2026-09-29\)\]$/);
  assert.match(lines[5], /^D-2 .* \[deduced: from the CSP in `next\.config\.ts:12`\]$/);
  assert.equal(lines[6], "Context for the builder: 2 bullets; read that section before freezing");
  assert.equal(lines.length, 9);
  assert.match(lines[7], /^ {2}- Feed URL/);
});

test("freeze flips the status and stamps the date and who froze it; unfreeze reverts", () => {
  const frozen = setStatus(filled(), "FROZEN", "2026-09-29", "owner");
  assert.match(frozen, /^Status: FROZEN\nFrozen: 2026-09-29\nFrozen by: owner$/m);
  const back = setStatus(frozen, "DRAFT", "2026-09-30");
  assert.match(back, /^Status: DRAFT$/m);
  assert.doesNotMatch(back, /^Frozen/m);
});

test("CLI: freeze needs --yes, refuses open questions (exit 4), then freezes a clean one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-spec-"));
  const good = path.join(dir, "good.md");
  fs.writeFileSync(good, filled());
  const noFlag = spawnSync(process.execPath, [SCRIPT, "freeze", good], { encoding: "utf8" });
  assert.equal(noFlag.status, 2);
  assert.match(noFlag.stderr, /human gate/);
  assert.match(fs.readFileSync(good, "utf8"), /^Status: DRAFT$/m);
  const bad = path.join(dir, "bad.md");
  fs.writeFileSync(bad, filled({ needs: 1 }));
  const r = spawnSync(process.execPath, [SCRIPT, "freeze", bad, "--yes"], { encoding: "utf8" });
  assert.equal(r.status, 4);
  const out = execFileSync(process.execPath, [SCRIPT, "freeze", good, "--yes"], { encoding: "utf8" });
  assert.match(out, /^frozen good\.md/);
  const text = fs.readFileSync(good, "utf8");
  assert.match(text, /^Status: FROZEN$/m);
  assert.match(text, /^Frozen by: .+$/m);
  const again = spawnSync(process.execPath, [SCRIPT, "freeze", good, "--yes"], { encoding: "utf8" });
  assert.equal(again.status, 4);
});
