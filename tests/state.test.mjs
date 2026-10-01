import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { init, set, read, note, validateSet } from "../skills/flow-core/scripts/state.mjs";

const SCRIPT = path.resolve("skills/flow-core/scripts/state.mjs");
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "flow-state-")), ".agent");

test("init creates an idle state and refuses to overwrite", () => {
  const dir = tmp();
  init(dir);
  const { data } = read(dir);
  assert.equal(data.stage, "idle");
  assert.equal(data.feature, "none");
  assert.match(data.updated, /^\d{4}-\d{2}-\d{2}T/);
  assert.throws(() => init(dir), /already exists/);
  init(dir, { force: true });
});

test("set updates keys, bumps updated, keeps notes", () => {
  const dir = tmp();
  init(dir, { now: new Date("2026-01-01T00:00:00Z") });
  note(dir, "adopted", { now: new Date("2026-01-02T00:00:00Z") });
  const data = set(dir, { feature: "writing", stage: "spec", gate: "freeze" }, { now: new Date("2026-01-03T00:00:00Z") });
  assert.equal(data.stage, "spec");
  assert.equal(data.updated, "2026-01-03T00:00:00.000Z");
  const { body } = read(dir);
  assert.match(body, /## Notes\n\n- 2026-01-02 adopted/);
});

test("invalid stage, gate, unknown and reserved keys are rejected", () => {
  assert.deepEqual(validateSet({ stage: "build" }), []);
  assert.match(validateSet({ stage: "flying" }).join(), /stage must be/);
  assert.match(validateSet({ gate: "maybe" }).join(), /gate must be/);
  assert.deepEqual(validateSet({ size: "M" }), []);
  assert.match(validateSet({ size: "XS" }).join(), /size must be/);
  assert.match(validateSet({ colour: "red" }).join(), /unknown/);
  assert.match(validateSet({ updated: "x" }).join(), /reserved/);
});

test("CLI: init, set and get round-trip", () => {
  const dir = tmp();
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, "--dir", dir], { encoding: "utf8" });
  assert.equal(run("init").status, 0);
  assert.equal(run("set", "stage=spec", "spec=docs/specs/x.md").status, 0);
  assert.equal(run("get", "spec").stdout.trim(), "docs/specs/x.md");
  assert.equal(run("set", "stage=nope").status, 4);
  assert.equal(run("get").status, 2);
});
