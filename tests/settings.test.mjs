import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { load, set, where, teamKeys, DEFAULTS } from "../skills/flow-core/scripts/config.mjs";

const SCRIPT = path.resolve("skills/flow-core/scripts/config.mjs");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
function withHome(fn) {
  const home = tmp("flow-home-");
  const prev = process.env.FLOW_HOME;
  process.env.FLOW_HOME = home;
  try {
    return fn(home);
  } finally {
    if (prev === undefined) delete process.env.FLOW_HOME;
    else process.env.FLOW_HOME = prev;
  }
}

test("defaults are assisted, draft comments, no approve, ask for updates, drafts PRs", () => {
  assert.equal(DEFAULTS.autonomy, "assisted");
  assert.deepEqual(DEFAULTS.review, { comment: "draft", approve: false, native: true });
  assert.equal(DEFAULTS.update.policy, "ask");
  assert.equal(DEFAULTS.ship.pr.draft, true);
});

test("the machine file sits under the team file, which sits under the personal file", () =>
  withHome((home) => {
    const project = tmp("flow-cfg-");
    fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ autonomy: "gated", review: { comment: "post" }, update: { policy: "notify" } }));
    fs.writeFileSync(path.join(project, "flow.config.json"), JSON.stringify({ autonomy: "auto", review: { comment: "off" } }));
    fs.writeFileSync(path.join(project, "flow.config.user.json"), JSON.stringify({ autonomy: "assisted" }));
    const r = load(project);
    assert.deepEqual(r.errors, []);
    assert.equal(r.config.autonomy, "assisted", "personal wins");
    assert.equal(r.config.review.comment, "off", "team beats machine");
    assert.equal(r.config.update.policy, "notify", "machine beats defaults");
    assert.equal(r.config.review.approve, false, "untouched keys keep defaults");
  }));

test("x-team keys are refused in the personal file and listed from the schema", () =>
  withHome(() => {
    const schema = JSON.parse(fs.readFileSync("skills/flow-core/config.schema.json", "utf8"));
    assert.deepEqual(teamKeys(schema).sort(), ["review.approve", "review.comment"]);
    const project = tmp("flow-cfg-");
    fs.writeFileSync(path.join(project, "flow.config.user.json"), JSON.stringify({ review: { approve: true } }));
    const r = load(project);
    assert.ok(r.errors.some((e) => /review\.approve: a team setting/.test(e)), r.errors.join("; "));
    assert.throws(() => set(project, "personal", { "review.comment": "post" }), /team setting/);
  }));

test("set --scope writes one layer, coerces booleans, and where reports the first run", () =>
  withHome((home) => {
    const project = tmp("flow-cfg-");
    assert.equal(where(project).firstRun, true);
    const r = set(project, "user", { autonomy: "assisted", "review.comment": "draft", "review.approve": "false", "update.policy": "ask", welcomed: "0.6.0" });
    assert.deepEqual(r.errors, []);
    assert.equal(r.file, path.join(home, "config.json"));
    const written = JSON.parse(fs.readFileSync(r.file, "utf8"));
    assert.equal(written.review.approve, false, "a boolean, not the string \"false\"");
    assert.equal(where(project).firstRun, false);
    assert.equal(where(project).welcomed, "0.6.0");
    assert.throws(() => set(project, "project", { "review.approve": "yes" }), /expected true or false/);
    assert.throws(() => set(project, "nowhere", { autonomy: "auto" }), /scope must be/);
    const bad = set(project, "project", { autonomy: "fast" });
    assert.ok(bad.errors.some((e) => /autonomy: expected one of/.test(e)));
  }));

test("the CLI: where, set, and --get read the merged view", () =>
  withHome((home) => {
    const project = tmp("flow-cfg-");
    const env = { ...process.env, FLOW_HOME: home };
    const out = execFileSync("node", [SCRIPT, "where", "--project", project, "--json"], { env, encoding: "utf8" });
    assert.equal(JSON.parse(out).firstRun, true);
    execFileSync("node", [SCRIPT, "set", "--scope", "user", "--project", project, "autonomy=gated"], { env, encoding: "utf8" });
    execFileSync("node", [SCRIPT, "set", "--scope", "project", "--project", project, "review.comment=post", "integrations=[{\"name\":\"jira\"}]"], { env, encoding: "utf8" });
    assert.equal(execFileSync("node", [SCRIPT, "--project", project, "--get", "autonomy"], { env, encoding: "utf8" }).trim(), "gated");
    assert.equal(execFileSync("node", [SCRIPT, "--project", project, "--get", "review.comment"], { env, encoding: "utf8" }).trim(), "post");
    const integrations = JSON.parse(execFileSync("node", [SCRIPT, "--project", project, "--get", "integrations"], { env, encoding: "utf8" }));
    assert.deepEqual(integrations, [{ name: "jira" }]);
    const text = execFileSync("node", [SCRIPT, "where", "--project", project], { env, encoding: "utf8" });
    assert.match(text, /welcomed: never\s+installed: \d+\.\d+\.\d+/);
  }));

test("integrations declared by name merge by name across layers", () =>
  withHome(() => {
    const project = tmp("flow-cfg-");
    fs.writeFileSync(path.join(project, "flow.config.json"), JSON.stringify({ integrations: [{ name: "jira", required: true }, { name: "slack", required: false }] }));
    fs.writeFileSync(path.join(project, "flow.config.user.json"), JSON.stringify({ integrations: [{ name: "slack", required: true }] }));
    const r = load(project);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.config.integrations, [{ name: "jira", required: true }, { name: "slack", required: true }]);
  }));

test("every question key in the schema has a scope or is team-owned, and the welcome names the four", () => {
  const schema = JSON.parse(fs.readFileSync("skills/flow-core/config.schema.json", "utf8"));
  const questions = [];
  (function walk(node, prefix) {
    for (const [k, v] of Object.entries(node.properties || {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v["x-question"]) questions.push(key);
      if (v.type === "object") walk(v, key);
    }
  })(schema, "");
  for (const k of ["autonomy", "review.comment", "review.approve", "update.policy", "ship.pr.draft", "review.native", "integrations", "ticket.source"]) assert.ok(questions.includes(k), `${k} is a question`);
  const welcome = fs.readFileSync("skills/flow-core/templates/welcome.md", "utf8");
  assert.match(welcome, /^Welcome to Flow State\./);
  assert.match(welcome, /three decisions: freeze the spec, go on a story, merge the pull request/);
  assert.match(welcome, /default: \*\*assisted\*\*/);
  assert.match(welcome, /Merging is never automated/);
});
