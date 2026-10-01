import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parsePlan, advance } from "../skills/flow-core/scripts/step.mjs";
import { collect } from "../skills/flow-core/scripts/rules.mjs";
import { RULES } from "../skills/flow-core/scripts/verdict.mjs";

const STEP = path.resolve("skills/flow-core/scripts/step.mjs");
const STATE = path.resolve("skills/flow-core/scripts/state.mjs");
const NODE = process.execPath;

const PLAN = `# Plan: 01 hello

Story: docs/specs/x/stories/01-hello.md
Spec: docs/specs/x.md
Base: abc

## Task 1: Create the greeting module

**Objective:** greet() returns "hello"

**Files:**
- create: src/greet.mjs
- create: tests/greet.test.mjs

**TDD:** greet returns hello

**Verification:**
\`\`\`sh
node --test tests/
\`\`\`

## Task 2: Export a shout helper

**Objective:** shout() returns "HELLO"

**Files:**
- modify: src/greet.mjs
- modify: tests/greet.test.mjs

**TDD:** shout returns HELLO

**Verification:**
\`\`\`sh
node --test tests/
\`\`\`
`;

const SPEC = `# X — Spec

Status: FROZEN
Frozen: 2026-09-29
Date: 2026-09-29
Project: t
Ticket: none

## Hypothesis

**Bet:** b
**We would know it failed if:** f
**Anti-scope:** no shouting in production

## Frozen decisions

| # | Decision | Provenance |
|---|---|---|
| D-1 | greet is a pure function | said: "pure" (t, 2026-09-29) |

## Context for the builder

- module lives in src/

## Parked

| # | Question or proposal | Options seen | Owner |
|---|---|---|---|
`;

const STORY = `# 01 hello — Story

Status: ready
Spec: docs/specs/x.md
Type: backend
Area: greet
Gate: none
Signal: N/A — library
Dep: none

## Delivers

A caller gets "hello".

## Accepts

- Given greet, when called, then it returns "hello"

## Protected

- README.md
`;

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-run-"));
  const g = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.name", "t");
  g("config", "user.email", "t@t");
  g("config", "core.autocrlf", "false");
  fs.mkdirSync(path.join(dir, "docs/specs/x/stories"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"));
  fs.mkdirSync(path.join(dir, "tests"));
  fs.writeFileSync(path.join(dir, "docs/specs/x.md"), SPEC);
  fs.writeFileSync(path.join(dir, "docs/specs/x/stories/01-hello.md"), STORY);
  fs.writeFileSync(path.join(dir, "docs/specs/x/plans/01-hello.plan.md".replace("plans/", "")), PLAN);
  fs.writeFileSync(path.join(dir, "README.md"), "# t\n");
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# House rules\n\n- Never use semicolons.\n");
  fs.mkdirSync(path.join(dir, ".flow/roles"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".flow/roles/flow-builder.md"), "Prefer named exports in this codebase.\n");
  fs.writeFileSync(path.join(dir, ".flow/roles/flow-judge.md"), "Our judge cares about named exports.\n");
  fs.writeFileSync(path.join(dir, ".gitignore"), ".agent/\n");
  g("add", "-A");
  g("commit", "-q", "-m", "base");
  execFileSync(NODE, [STATE, "init", "--dir", path.join(dir, ".agent")]);
  execFileSync(NODE, [STATE, "set", "stage=build", "--dir", path.join(dir, ".agent")]);
  return { dir, g };
}

const run = (dir, ...args) => spawnSync(NODE, [STEP, ...args, "--project", dir], { cwd: dir, encoding: "utf8" });
const ok = (r, what) => assert.equal(r.status, 0, `${what}: exit ${r.status}\n${r.stdout}${r.stderr}`);

function goodVerdict(findings = []) {
  return { ruling: findings.some((f) => f.severity === "high") ? "FAIL" : "PASS", rubric: RULES.map((rule) => ({ rule, result: "looked", outcome: "holds" })), findings };
}

test("parsePlan reads tasks, files with modes, TDD and verification", () => {
  const { tasks, problems } = parsePlan(PLAN);
  assert.deepEqual(problems, []);
  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks[0].files, [{ mode: "create", path: "src/greet.mjs" }, { mode: "create", path: "tests/greet.test.mjs" }]);
  assert.equal(tasks[1].tdd, "shout returns HELLO");
  assert.deepEqual(tasks[1].verification, ["node --test tests/"]);
});

test("advance: controls red twice retries, a third time blocks; judge FAIL retries; commit advances tasks then delivers", () => {
  let r = { step: "implement", task: 1, tasksTotal: 2, attempt: 1, retries: { controls: 0, judge: 0 }, notes: [] };
  r = advance(r, "reported");
  r = advance(advance(r, "failed"), "reported");
  r = advance(advance(r, "failed"), "reported");
  assert.equal(r.attempt, 3);
  r = advance(r, "failed");
  assert.equal(r.step, "blocked");
  let s = { step: "judge", task: 2, tasksTotal: 2, attempt: 1, retries: { controls: 0, judge: 0 }, notes: [] };
  s = advance(s, "failed");
  assert.equal(s.step, "implement");
  assert.equal(s.attempt, 2);
  let t = { step: "commit", task: 1, tasksTotal: 2, attempt: 2, retries: { controls: 1, judge: 1 }, notes: [] };
  t = advance(t, "done");
  assert.deepEqual([t.step, t.task, t.attempt, t.retries], ["implement", 2, 1, { controls: 0, judge: 0 }]);
  assert.equal(advance({ ...t, step: "commit" }, "done").step, "delivered");
  assert.throws(() => advance({ step: "implement", retries: {}, notes: [] }, "done"), /impossible transition/);
});

test("rules.mjs collects AGENTS.md and CLAUDE.md imports and respects exclude", () => {
  const { dir } = project();
  fs.writeFileSync(path.join(dir, "CLAUDE.md"), "@AGENTS.md\n");
  fs.mkdirSync(path.join(dir, ".cursor/rules"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".cursor/rules/scoped.mdc"), "---\nglobs: src/**\n---\nscoped\n");
  fs.writeFileSync(path.join(dir, ".cursor/rules/always.mdc"), "---\nalwaysApply: true\n---\nalways rule\n");
  fs.mkdirSync(path.join(dir, ".github"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".github/PULL_REQUEST_TEMPLATE.md"), "## Why\n");
  fs.writeFileSync(path.join(dir, ".github/CODEOWNERS"), "* @team\n");
  const r = collect(dir);
  assert.deepEqual(r.files, ["AGENTS.md", "CLAUDE.md", ".cursor/rules/always.mdc", ".github/PULL_REQUEST_TEMPLATE.md", ".github/CODEOWNERS"]);
  assert.match(r.text, /Never use semicolons/);
  assert.doesNotMatch(r.text, /scoped/);
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ rules: { exclude: ["CLAUDE.md"] } }));
  assert.deepEqual(collect(dir).files, ["AGENTS.md", ".cursor/rules/always.mdc", ".github/PULL_REQUEST_TEMPLATE.md", ".github/CODEOWNERS"]);
});

test("a full two-task run: brief with repository rules, controls, package with hash, verdict, sealed commit, delivered", () => {
  const { dir, g } = project();
  fs.writeFileSync(path.join(dir, "scratch.txt"), "already dirty before the run\n");
  const initRes = run(dir, "init", "--plan", "docs/specs/x/01-hello.plan.md", "--story", "docs/specs/x/stories/01-hello.md", "--spec", "docs/specs/x.md");
  ok(initRes, "init");
  assert.match(initRes.stdout, /1 path\(s\) already dirty/);
  assert.equal(run(dir, "controls").status, 9, "wrong step exits 9");

  // task 1
  let n = run(dir, "next", "--json");
  ok(n, "next");
  let out = JSON.parse(n.stdout);
  assert.equal(out.action, "dispatch flow-builder");
  const brief = fs.readFileSync(path.join(dir, out.brief), "utf8");
  assert.ok(brief.indexOf("## Ground rules") < brief.indexOf("## Objective"), "ground rules come first in the brief");
  assert.match(brief, /GR-8 Never loosen a check/);
  assert.match(brief, /## Repository rules[\s\S]*Never use semicolons/);
  assert.match(brief, /## Closed decisions\n\n- D-1 greet is a pure function/);
  assert.match(brief, /Anti-scope: no shouting in production/);
  assert.match(brief, /## Flow State conventions[\s\S]*conventions\/testing\.md/);
  assert.match(brief, /## Notes this project keeps for the builder\n\nPrefer named exports/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ".agent/run.json"), "utf8")).seal, "1:implement:1");

  fs.writeFileSync(path.join(dir, "src/greet.mjs"), 'export const greet = () => "hello"\n');
  fs.writeFileSync(path.join(dir, "tests/greet.test.mjs"), 'import { test } from "node:test"\nimport assert from "node:assert/strict"\nimport { greet } from "../src/greet.mjs"\ntest("greet returns hello", () => assert.equal(greet(), "hello"))\n');
  fs.writeFileSync(path.join(dir, ".agent/run/task-1-report.json"), JSON.stringify({ paths: ["src/greet.mjs", "tests/greet.test.mjs"], summary: "added greet" }));
  ok(run(dir, "report", ".agent/run/task-1-report.json"), "report");
  ok(run(dir, "controls"), "controls");
  ok(run(dir, "package"), "package");
  const pkg = fs.readFileSync(path.join(dir, ".agent/run/task-1-package.md"), "utf8");
  assert.match(pkg, /^Review token: [0-9a-f]{64}/);
  assert.match(pkg, /## Ground rules \(not overridable; open with Read\)\n\n- .*ground-rules\.md/);
  assert.match(pkg, /## Repository rules[\s\S]*AGENTS\.md/);
  assert.match(pkg, /## Notes this project keeps for the judge[\s\S]*\.flow[\\/]roles[\\/]flow-judge\.md/);
  assert.match(pkg, /\+export const greet/);
  n = run(dir, "next", "--json");
  out = JSON.parse(n.stdout);
  assert.equal(out.action, "dispatch flow-judge");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ".agent/run.json"), "utf8")).seal, "1:judge:1");

  // a verdict that fails validation is discarded and the step stays
  fs.writeFileSync(path.join(dir, out.verdictTo), JSON.stringify({ ruling: "PASS", rubric: [], findings: [] }));
  assert.equal(run(dir, "verdict", out.verdictTo).status, 3);
  fs.writeFileSync(path.join(dir, out.verdictTo), JSON.stringify(goodVerdict()));
  ok(run(dir, "verdict", out.verdictTo), "verdict");
  assert.ok(fs.existsSync(path.join(dir, "docs/specs/x/verdicts/01-hello-task-1.json")), "verdict kept beside the code");
  ok(run(dir, "commit"), "commit");
  assert.match(g("log", "-1", "--pretty=%B"), /Create the greeting module \(01-hello, task 1\/2\)\n\nFlow-State: 01-hello#1 verdict [0-9a-f]{12}/);
  assert.match(g("show", "--stat", "HEAD"), /docs\/specs\/x\/verdicts\/01-hello-task-1\.json/);
  assert.equal(execFileSync(NODE, [STATE, "get", "last_commit", "--dir", path.join(dir, ".agent")], { encoding: "utf8" }).trim().length, 12);

  // task 2: scope violation, then a tampered index after the verdict
  n = run(dir, "next", "--json");
  out = JSON.parse(n.stdout);
  assert.equal(out.task, 2);
  fs.appendFileSync(path.join(dir, "src/greet.mjs"), 'export const shout = () => "HELLO"\n');
  fs.appendFileSync(path.join(dir, "tests/greet.test.mjs"), 'import { shout } from "../src/greet.mjs"\ntest("shout returns HELLO", () => assert.equal(shout(), "HELLO"))\n');
  fs.writeFileSync(path.join(dir, "README.md"), "# t changed\n");
  fs.writeFileSync(path.join(dir, ".agent/run/task-2-report.json"), JSON.stringify({ paths: ["src/greet.mjs", "tests/greet.test.mjs"], summary: "shout" }));
  fs.mkdirSync(path.join(dir, "docs/specs/x/verdicts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs/specs/x/verdicts/stray-attempt.json"), "{}");
  ok(run(dir, "report", ".agent/run/task-2-report.json"), "report 2");
  const red = run(dir, "controls");
  assert.equal(red.status, 4);
  assert.match(red.stderr, /changed but not reported: README\.md/);
  assert.doesNotMatch(red.stderr, /verdicts/, "program-written verdict files are not scope violations");
  fs.rmSync(path.join(dir, "docs/specs/x/verdicts/stray-attempt.json"));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ".agent/run.json"), "utf8")).attempt, 2);
  g("checkout", "--", "README.md");
  n = run(dir, "next", "--json");
  assert.match(fs.readFileSync(path.join(dir, JSON.parse(n.stdout).brief), "utf8"), /## Previous attempt: controls[\s\S]*README\.md/);
  ok(run(dir, "report", ".agent/run/task-2-report.json"), "report 2b");
  ok(run(dir, "controls"), "controls 2");
  ok(run(dir, "package"), "package 2");
  n = run(dir, "next", "--json");
  out = JSON.parse(n.stdout);
  fs.writeFileSync(path.join(dir, out.verdictTo), JSON.stringify(goodVerdict()));
  ok(run(dir, "verdict", out.verdictTo), "verdict 2");
  fs.appendFileSync(path.join(dir, "src/greet.mjs"), "// sneaky\n");
  g("add", "src/greet.mjs");
  const tampered = run(dir, "commit");
  assert.equal(tampered.status, 5, "index changed after the verdict must not commit");
  g("checkout", "HEAD", "--", "src/greet.mjs");
  // restore the sealed content and go round again
  fs.writeFileSync(path.join(dir, "src/greet.mjs"), 'export const greet = () => "hello"\nexport const shout = () => "HELLO"\n');
  ok(run(dir, "package"), "package 2 again");
  n = run(dir, "next", "--json");
  out = JSON.parse(n.stdout);
  fs.writeFileSync(path.join(dir, out.verdictTo), JSON.stringify(goodVerdict()));
  ok(run(dir, "verdict", out.verdictTo), "verdict 2 again");
  const done = run(dir, "commit");
  ok(done, "commit 2");
  assert.match(done.stdout, /delivered/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ".agent/run.json"), "utf8")).step, "delivered");
  assert.equal(g("status", "--porcelain").trim(), "?? scratch.txt", "the pre-existing dirty file was neither committed nor flagged");
});
