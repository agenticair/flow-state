import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { diagnose, report } from "../skills/flow-core/scripts/doctor.mjs";

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "flow-home-"));
  fs.mkdirSync(path.join(home, ".codex/agents"), { recursive: true });
  fs.mkdirSync(path.join(home, ".agents/skills/flow"), { recursive: true });
  fs.writeFileSync(path.join(home, ".codex/agents/flow-judge.toml"), 'name = "flow-judge"\n');
  fs.mkdirSync(path.join(home, ".cursor"), { recursive: true });
  return home;
}

function project(adopted) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-doc-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  if (adopted) {
    fs.mkdirSync(path.join(dir, ".agent"));
    fs.writeFileSync(path.join(dir, ".agent/STATE.md"), "---\nstage: idle\n---\n");
    fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ ship: { verify: "npm test", branching: "trunk", pr: { requiredChecks: ["ci"] }, deploy: "push to main deploys" } }));
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# rules\n");
  }
  return dir;
}

test("doctor reports tiers per tool from the home directory and names fixes", () => {
  const home = fakeHome();
  const d = diagnose({ project: project(false), home });
  assert.equal(d.tiers.codex, "A", "skills in .agents plus agents in .codex is tier A");
  assert.equal(d.tiers.cursor, "B", "skills in .agents without cursor agents is tier B");
  assert.equal(d.tiers.claude, undefined, "a tool whose home dir is absent is not reported");
  const adopt = d.items.find((i) => /adopted/.test(i.name));
  assert.equal(adopt.ok, false);
  assert.match(adopt.fix, /flow-adopt/);
  assert.equal(d.ok, false);
  assert.match(report(d), /tiers\n  codex: A\n  cursor: B/);
});

test("an adopted project with ways of working recorded passes the project checks", () => {
  const d = diagnose({ project: project(true), home: fakeHome() });
  for (const name of ["adopted", "config valid", "repository rules found", "verify command known", "ways of working"]) {
    const item = d.items.find((i) => i.name.includes(name));
    assert.equal(item.ok, true, `${name}: ${item.detail}`);
  }
  const ways = d.items.find((i) => i.name.includes("ways of working"));
  assert.match(ways.detail, /branching trunk; pr checks 1; deploy push to main deploys/);
});
