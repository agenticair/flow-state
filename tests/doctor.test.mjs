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
  assert.equal(d.tiers.codex, "A- (judge may run; separation by instruction)", "skills in .agents plus agents in .codex is tier A-, since the Codex judge keeps a shell");
  assert.equal(d.tiers.cursor, "B", "skills in .agents without cursor agents is tier B");
  assert.equal(d.tiers.claude, undefined, "a tool whose home dir is absent is not reported");
  const adopt = d.items.find((i) => /set up/.test(i.name));
  assert.equal(adopt.ok, false);
  assert.match(adopt.fix, /flow setup/);
  assert.equal(d.ok, false);
  assert.match(report(d), /tiers\n  codex: A- \(judge may run; separation by instruction\)\n  cursor: B/);
});

test("copilot gets an informational hooks row with no fix, and tier A when skills and agents are present", () => {
  const home = fakeHome();
  fs.mkdirSync(path.join(home, ".copilot/agents"), { recursive: true });
  fs.writeFileSync(path.join(home, ".copilot/agents/flow-judge.agent.md"), "# judge\n");
  const d = diagnose({ project: project(false), home });
  assert.equal(d.tiers.copilot, "A (adapter experimental)");
  const hooks = d.items.find((i) => i.name === "copilot: hooks");
  assert.ok(hooks, "the row exists");
  assert.equal(hooks.optional, true);
  assert.equal(hooks.fix, null, "nothing to install");
  assert.match(hooks.detail, /no hook adapter for Copilot yet/);
});

test("ways of working needs both branching and verify; the detail names what is unset", () => {
  const dir = project(true);
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ ship: { verify: "", branching: "trunk" } }));
  const d = diagnose({ project: dir, home: fakeHome() });
  const ways = d.items.find((i) => i.name.includes("ways of working"));
  assert.equal(ways.ok, false);
  assert.match(ways.detail, /ship\.verify unset/);
  assert.ok(!ways.detail.includes("ship.branching"), "branching is set, so it is not listed");
});

test("an adopted project with ways of working recorded passes the project checks", () => {
  const d = diagnose({ project: project(true), home: fakeHome() });
  for (const name of ["set up", "config valid", "repository rules found", "verify command known", "ways of working"]) {
    const item = d.items.find((i) => i.name.includes(name));
    assert.equal(item.ok, true, `${name}: ${item.detail}`);
  }
  const ways = d.items.find((i) => i.name.includes("ways of working"));
  assert.match(ways.detail, /branching trunk; verify npm test; pr checks 1; deploy push to main deploys/);
});

import { mcpServers, resolveIntegrations } from "../skills/flow-core/scripts/doctor.mjs";

function mcpHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "flow-mcp-"));
  fs.mkdirSync(path.join(home, ".codex"), { recursive: true });
  fs.mkdirSync(path.join(home, ".cursor"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.mkdirSync(path.join(home, ".copilot"), { recursive: true });
  fs.mkdirSync(path.join(home, ".gemini"), { recursive: true });
  fs.writeFileSync(path.join(home, ".codex", "config.toml"), '[model]\nname = "x"\n\n[mcp_servers.atlassian]\ncommand = "npx"\nenv = { JIRA_API_TOKEN = "secret-value" }\n\n[mcp_servers."my figma"]\nurl = "http://x"\n\n[mcp_servers.linear.env]\nX = "1"\n');
  fs.writeFileSync(path.join(home, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { slack: { command: "x" } } }));
  fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ mcpServers: { github: {} }, projects: { "/p": { mcpServers: { amplitude: {} } } } }));
  fs.writeFileSync(path.join(home, ".copilot", "mcp-config.json"), JSON.stringify({ mcpServers: { databricks: {} } }));
  fs.writeFileSync(path.join(home, ".gemini", "settings.json"), "{ not json");
  return home;
}

test("MCP server names are read per tool, keys only, and unparsable files are reported", () => {
  const home = mcpHome();
  const { servers, unparsable } = mcpServers({ home, project: "/p" });
  assert.deepEqual(servers.codex, ["atlassian", "my figma"], "a [mcp_servers.x.env] sub-table is not a server");
  assert.deepEqual(servers.cursor, ["slack"]);
  assert.deepEqual(servers.claude, ["github", "amplitude"]);
  assert.deepEqual(servers.copilot, ["databricks"]);
  assert.equal(unparsable.length, 1);
  assert.ok(!JSON.stringify(servers).includes("secret-value"));
});

test("declared integrations are probed, ticket.source is implied, unknown ones need a kind, --only narrows", () => {
  const home = mcpHome();
  const dir = project(true);
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ ship: { verify: "npm test", branching: "trunk" }, ticket: { source: "jira" }, integrations: [{ name: "figma", required: false }, { name: "acme-ledger", kind: "env", var: "ACME_LEDGER_TOKEN", fix: { default: "ask platform for a token" } }, { name: "mystery" }] }));
  const prevEnv = process.env.ACME_LEDGER_TOKEN;
  process.env.ACME_LEDGER_TOKEN = "x";
  try {
    const d = diagnose({ project: dir, home });
    const row = (n) => d.items.find((i) => i.area === "integration" && i.name.startsWith(n));
    assert.equal(row("jira").ok, true, row("jira").detail);
    assert.match(row("jira").detail, /mcp "atlassian" in codex/);
    assert.equal(row("figma").ok, true, "figma matched the quoted codex table");
    assert.match(row("figma").name, /optional/);
    assert.equal(row("acme-ledger").ok, true);
    assert.match(row("acme-ledger").detail, /env ACME_LEDGER_TOKEN set/);
    assert.ok(!row("acme-ledger").detail.includes("x\n"), "values are never printed");
    assert.equal(row("mystery").ok, false);
    assert.match(row("mystery").detail, /unknown integration: declare a kind/);
    assert.equal(d.ok, false, "mystery is required and missing");
    const only = diagnose({ project: dir, home, only: "figma" });
    assert.equal(only.items.filter((i) => i.area === "integration" && i.name !== "config file").length, 1);
    const none = diagnose({ project: dir, home, only: "nope" });
    assert.match(none.items.find((i) => i.area === "integration" && i.name !== "config file").detail, /not declared/);
    assert.match(report(d), /integration\n/);
    assert.match(report(d), /version\n  ok  installed: \d+\.\d+\.\d+/);
  } finally {
    if (prevEnv === undefined) delete process.env.ACME_LEDGER_TOKEN;
    else process.env.ACME_LEDGER_TOKEN = prevEnv;
  }
});

test("a config-declared cli probe tests PATH presence only and never runs its args", () => {
  const dir = project(true);
  fs.writeFileSync(path.join(dir, "flow.config.json"), JSON.stringify({ ship: { verify: "npm test", branching: "trunk" }, integrations: [{ name: "vcs", kind: "cli", command: "git", args: ["rev-parse", "--definitely-not-a-flag"] }, { name: "ghost", kind: "cli", command: "flow-state-no-such-command-xyz" }] }));
  const d = diagnose({ project: dir, home: fakeHome() });
  const row = (n) => d.items.find((i) => i.area === "integration" && i.name.startsWith(n));
  assert.equal(row("vcs").ok, true, "git is on PATH; the bogus args are not executed");
  assert.equal(row("ghost").ok, false);
  assert.deepEqual(resolveIntegrations({ integrations: [{ name: "x", kind: "cli", command: "c", args: ["a"] }] })[0].probes, [{ kind: "cli", server: undefined, command: "c", var: undefined, path: undefined, declared: true }]);
});

test("found-but-unregistered integrations are suggested when none is declared", () => {
  const d = diagnose({ project: project(true), home: mcpHome() });
  const found = d.items.find((i) => i.name === "found but not registered");
  assert.ok(found, "a suggestion row exists");
  assert.match(found.detail, /jira/);
  assert.equal(found.optional, true);
  assert.deepEqual(resolveIntegrations({ ticket: { source: "linear" }, integrations: [] }).map((i) => i.name), ["linear"]);
});

test("a stale flow-adopt folder is reported with its removal command", () => {
  const home = fakeHome();
  fs.mkdirSync(path.join(home, ".agents/skills/flow-adopt"), { recursive: true });
  const d = diagnose({ project: project(false), home });
  const stale = d.items.find((i) => /stale skill folder/.test(i.name));
  assert.ok(stale);
  assert.match(stale.fix, /rm -r/);
  assert.equal(stale.optional, true);
});
