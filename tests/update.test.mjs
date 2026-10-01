import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compare, editedFiles, latest, route, readManifest, SKILLS_ROOT } from "../skills/flow-core/scripts/update.mjs";

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test("semver compare", () => {
  assert.equal(compare("0.6.0", "0.6.0"), 0);
  assert.equal(compare("0.6.0", "0.10.0"), -1);
  assert.equal(compare("1.0.0", "0.9.9"), 1);
});

test("the manifest covers every file under skills/ and a clean checkout has no edits", () => {
  const m = readManifest();
  assert.equal(m.version, JSON.parse(fs.readFileSync("plugin.json", "utf8")).version);
  for (const rel of ["flow/SKILL.md", "flow-setup/SKILL.md", "flow-core/ground-rules.md", "flow-core/scripts/step.mjs", "flow-core/templates/welcome.md"]) assert.ok(m.files[rel], `${rel} in manifest`);
  assert.ok(!m.files["flow-core/MANIFEST.json"], "the manifest does not hash itself");
  const e = editedFiles();
  assert.deepEqual(e, { known: true, edited: [], missing: [] });
});

test("an edited installed file is named, so an update refuses to overwrite it", () => {
  const root = tmp("flow-skills-");
  fs.cpSync(SKILLS_ROOT, root, { recursive: true });
  fs.appendFileSync(path.join(root, "flow-build", "SKILL.md"), "\nCompany rule: always ask Bob.\n");
  fs.rmSync(path.join(root, "flow-retro", "SKILL.md"));
  const e = editedFiles(root);
  assert.deepEqual(e.edited, ["flow-build/SKILL.md"]);
  assert.deepEqual(e.missing, ["flow-retro/SKILL.md"]);
  fs.rmSync(path.join(root, "flow-core", "MANIFEST.json"));
  assert.equal(editedFiles(root).known, false, "no manifest: edits unknown");
});

test("latest uses the fetcher once and then the 24h cache, and reports a failure without throwing", async () => {
  const cacheDir = tmp("flow-cache-");
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { ok: true, json: async () => ({ version: "9.9.9" }) };
  };
  const a = await latest("agenticair/flow-state", { cacheDir, fetcher, now: 1000 });
  assert.deepEqual(a, { version: "9.9.9", cached: false });
  const b = await latest("agenticair/flow-state", { cacheDir, fetcher, now: 2000 });
  assert.deepEqual(b, { version: "9.9.9", cached: true });
  assert.equal(calls, 1);
  const c = await latest("agenticair/flow-state", { cacheDir, fetcher, now: 2000 + 25 * 3600 * 1000 });
  assert.equal(c.cached, false);
  assert.equal(calls, 2);
  const d = await latest("other/repo", { cacheDir, fetcher: async () => ({ ok: false, status: 404 }), now: 3000 });
  assert.equal(d.version, null);
  assert.match(d.error, /HTTP 404/);
});

test("the update route is the Claude plugin, the recorded clone, or the skills CLI", () => {
  assert.equal(route(path.join(os.homedir(), ".claude", "plugins", "marketplaces", "x", "skills")).kind, "claude-plugin");
  const home = tmp("flow-home-");
  const prev = process.env.FLOW_HOME;
  process.env.FLOW_HOME = home;
  try {
    assert.equal(route("/somewhere/.agents/skills").kind, "skills-cli");
    fs.writeFileSync(path.join(home, "install.json"), JSON.stringify({ source: "/repo/flow-state", version: "0.6.0" }));
    const r = route("/somewhere/.agents/skills");
    assert.equal(r.kind, "clone");
    assert.match(r.command, /git pull && \.\/install\.sh --yes/);
  } finally {
    if (prev === undefined) delete process.env.FLOW_HOME;
    else process.env.FLOW_HOME = prev;
  }
});
