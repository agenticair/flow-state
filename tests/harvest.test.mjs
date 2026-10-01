import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseVerdictName, harvest, table } from "../skills/flow-core/scripts/harvest.mjs";

test("verdict file names parse into plan, story, task, attempt and patch", () => {
  assert.deepEqual(parseVerdictName("01-writing-route-guards-task-1.json"), { plan: "01-writing-route-guards", story: "01", task: 1, attempt: 1, patch: false });
  assert.deepEqual(parseVerdictName("01-writing-route-guards.patch-1-task-2-attempt-2.json"), { plan: "01-writing-route-guards.patch-1", story: "01", task: 2, attempt: 2, patch: true });
  assert.equal(parseVerdictName("notes.json"), null);
});

test("harvest counts attempts, corrections, findings and commits per story", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-harvest-"));
  const g = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  fs.mkdirSync(path.join(dir, "docs/specs/x/stories"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs/specs/x/verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs/specs/x.md"), "# X — Spec\nStatus: FROZEN\n");
  fs.writeFileSync(path.join(dir, "docs/specs/x/stories/01-a.md"), "# 01 a\n\nStatus: done\n");
  fs.writeFileSync(path.join(dir, "docs/specs/x/stories/02-b.md"), "# 02 b\n\nStatus: backlog\n");
  const v = (ruling, findings) => JSON.stringify({ ruling, rubric: [{ rule: "objective", result: "x", outcome: "holds" }, { rule: "scope", result: "x", outcome: "n-a" }], findings });
  fs.writeFileSync(path.join(dir, "docs/specs/x/verdicts/01-a-task-1.json"), v("PASS", [{ rule: "patterns", severity: "medium" }]));
  fs.writeFileSync(path.join(dir, "docs/specs/x/verdicts/01-a-task-1-attempt-2.json"), v("PASS", []));
  fs.writeFileSync(path.join(dir, "docs/specs/x/verdicts/01-a.patch-1-task-1.json"), v("FAIL", [{ rule: "objective", severity: "high" }]));
  g("add", "-A");
  g("commit", "-q", "-m", "base");
  g("commit", "-q", "--allow-empty", "-m", "Do a (01-a, task 1/1)\n\nFlow-State: 01-a#1 verdict abc123");
  g("commit", "-q", "--allow-empty", "-m", "Patch a (01-a, task 1/1)\n\nFlow-State: 01-a#1 verdict def456");
  const h = harvest(dir, "docs/specs/x.md");
  const a = h.stories.find((s) => s.id === "01");
  assert.equal(a.status, "done");
  assert.equal(a.tasks, 2);
  assert.equal(a.attempts, 3);
  assert.equal(a.corrections, 1);
  assert.equal(a.patches, 1);
  assert.deepEqual([a.pass, a.fail], [2, 1]);
  assert.deepEqual(a.findings, { high: 1, medium: 1, low: 0 });
  assert.deepEqual(a.rubric, { holds: 3, "n-a": 3, "no-yardstick": 0 });
  assert.equal(a.commits.length, 2);
  assert.equal(h.stories.find((s) => s.id === "02").attempts, 0);
  assert.deepEqual([h.total.stories, h.total.done, h.total.corrections, h.total.high], [2, 1, 1, 1]);
  const md = table(h);
  assert.match(md, /\| 01-a \| done \| 2 \| 3 \| 1 \| 1 \| 2\/1 \| 1\/1\/0 \| 2 \|/);
  assert.match(md, /Findings by rule: objective 1, patterns 1|Findings by rule: patterns 1, objective 1/);
});
