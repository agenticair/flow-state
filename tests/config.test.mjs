import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { merge, load, DEFAULTS } from "../skills/flow-core/scripts/config.mjs";

test("defaults load when no config file exists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-cfg-"));
  const { config, errors } = load(dir);
  assert.deepEqual(errors, []);
  assert.equal(config.autonomy, "gated");
  assert.equal(config.models.judge, "opus");
});

test("user config overrides project config, scalars and nested", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-cfg-"));
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ autonomy: "assisted", models: { builder: "x" } }));
  fs.writeFileSync(path.join(dir, "flow.config.user.json"), JSON.stringify({ autonomy: "auto" }));
  const { config, errors } = load(dir);
  assert.deepEqual(errors, []);
  assert.equal(config.autonomy, "auto");
  assert.equal(config.models.builder, "x");
  assert.equal(config.models.judge, "opus");
});

test("lenses merge by name", () => {
  const out = merge(
    { lenses: [{ name: "a", path: "p1", triggers: ["auth"] }] },
    { lenses: [{ name: "a", path: "p2" }, { name: "b", path: "p3" }] },
  );
  assert.deepEqual(out.lenses, [{ name: "a", path: "p2", triggers: ["auth"] }, { name: "b", path: "p3" }]);
});

test("invalid enum and unknown key are reported", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-cfg-"));
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ autonomy: "yolo", nope: 1 }));
  const { errors } = load(dir);
  assert.ok(errors.some((e) => /autonomy/.test(e)));
  assert.ok(errors.some((e) => /nope: unknown key/.test(e)));
});

test("DEFAULTS is frozen", () => {
  assert.ok(Object.isFrozen(DEFAULTS));
});
