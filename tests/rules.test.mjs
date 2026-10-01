import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collect } from "../skills/flow-core/scripts/rules.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "../skills/flow-core/scripts/rules.mjs");

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-rules-"));
  fs.mkdirSync(path.join(dir, "docs"));
  fs.writeFileSync(path.join(dir, "docs/rules.md"), "## Verification\n\nRun the suite.\n");
  fs.writeFileSync(path.join(dir, "CLAUDE.md"), "Read this. See @docs/rules.md and @~/private.md\n");
  return dir;
}

test("inline @imports are followed, ~/ expands to the home directory, and headings are demoted", () => {
  const dir = project();
  const r = collect(dir);
  assert.deepEqual(r.files, ["CLAUDE.md", "docs/rules.md"]);
  assert.match(r.text, /### docs\/rules\.md\n\n#### Verification/);
  assert.doesNotMatch(r.text, /^## /m);
  assert.deepEqual(r.skipped, [{ path: path.join(os.homedir(), "private.md"), reason: "outside project" }]);
});

test("include[] skips paths outside the project, env files and non-markdown, and --list names them", () => {
  const dir = project();
  fs.writeFileSync(path.join(dir, "notes.txt"), "not rules\n");
  fs.writeFileSync(path.join(dir, ".env.example"), "KEY=x\n");
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ rules: { include: ["../outside.md", "notes.txt", ".env.example"] } }));
  const r = collect(dir);
  assert.deepEqual(r.files, ["CLAUDE.md", "docs/rules.md"]);
  assert.deepEqual(r.skipped.map((s) => s.reason), ["outside project", "outside project", "not markdown", "env file"]);
  const out = execFileSync("node", [script, "--project", dir, "--list"], { encoding: "utf8" });
  assert.match(out, /^CLAUDE\.md\ndocs\/rules\.md\n/);
  assert.ok(out.includes(`skipped: ${path.join(dir, "notes.txt")} (not markdown)`), out);
  assert.match(out, /skipped: .*\.env\.example \(env file\)/);
});

test("a file over the budget is left out, smaller later files still paste, and rules.maxBytes sets the budget", () => {
  const dir = project();
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "x".repeat(300) + "\n");
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ rules: { maxBytes: "200" } }));
  const r = collect(dir);
  assert.deepEqual(r.files, ["AGENTS.md", "CLAUDE.md", "docs/rules.md"]);
  assert.deepEqual(r.notPasted, ["AGENTS.md"]);
  assert.equal(r.truncated, true);
  assert.match(r.text, /^### CLAUDE\.md/);
  assert.match(r.text, /### docs\/rules\.md/);
  assert.match(r.text, /\n\n\[not pasted: AGENTS\.md; skipped: [^\]]*private\.md \(outside project\); read them directly\]$/);
  assert.equal(collect(dir, { maxBytes: 1000 }).notPasted.length, 0);
});
