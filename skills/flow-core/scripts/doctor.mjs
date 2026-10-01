#!/usr/bin/env node
// `flow connect`: the machine, the tools, the project, and every integration the loop needs, with a fix per missing item.
// Usage: node doctor.mjs [--project <dir>] [--home <dir>] [--only <integration>] [--json] [--no-version]
// Exit: 0 nothing required is missing, 1 something required is missing (details printed), 2 usage.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collect as collectRules } from "./rules.mjs";
import { load as loadConfig, homeFile, installedVersion } from "./config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(fs.readFileSync(path.join(here, "..", "integrations.json"), "utf8")).integrations;

const TOOLS = {
  claude: { dir: ".claude", skills: [".claude/skills/flow"], agents: [".claude/agents/flow-judge.md"], hooks: [".claude/settings.json"], install: "/plugin marketplace add agenticair/flow-state  then  /plugin install flow-state@flow-state", agentsFix: "install from a clone: ./install.sh --only claude  (or the plugin route, which carries agents and hooks)" },
  codex: { dir: ".codex", skills: [".agents/skills/flow", ".codex/skills/flow"], agents: [".codex/agents/flow-judge.toml"], hooks: [".codex/hooks.json"], install: "npx skills add agenticair/flow-state  (or: codex plugin marketplace add agenticair/flow-state)", agentsFix: "./install.sh --only codex  (Codex plugins cannot carry agents or hooks)" },
  cursor: { dir: ".cursor", skills: [".agents/skills/flow", ".cursor/skills/flow"], agents: [".cursor/agents/flow-judge.md"], hooks: [".cursor/hooks.json"], install: "npx skills add agenticair/flow-state", agentsFix: "./install.sh --only cursor" },
  copilot: { dir: ".copilot", skills: [".agents/skills/flow", ".copilot/skills/flow"], agents: [".copilot/agents/flow-judge.agent.md"], hooks: [], install: "npx skills add agenticair/flow-state", agentsFix: "./install.sh --only copilot" },
  gemini: { dir: ".gemini", skills: [".agents/skills/flow", ".gemini/skills/flow"], agents: [".gemini/agents/flow-judge.md"], hooks: [], install: "npx skills add agenticair/flow-state", agentsFix: "./install.sh --only gemini" },
};

// Catalog probes only: runs the command with its catalog args (shell on Windows for .cmd shims).
function has(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
  return r.status === 0 ? (r.stdout || r.stderr || "").trim().split("\n")[0] : null;
}
// Config-declared probes: presence on PATH only; the command itself is never executed.
function onPath(cmd) {
  return spawnSync(process.platform === "win32" ? "where" : "which", [String(cmd)], { encoding: "utf8", shell: false }).status === 0;
}
function fileHas(p, needle) {
  try {
    return fs.readFileSync(p, "utf8").includes(needle);
  } catch {
    return false;
  }
}
function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return fs.existsSync(p) ? { __unparsable: p } : null;
  }
}

// MCP server NAMES per tool, read from each tool's config files (keys only; never env, headers or args).
export function mcpServers({ home, project }) {
  const out = {};
  const unparsable = [];
  const names = (obj) => (obj && typeof obj === "object" ? Object.keys(obj) : []);
  const addJSON = (tool, p, pick) => {
    const j = readJSON(p);
    if (!j) return;
    if (j.__unparsable) return void unparsable.push(p);
    (out[tool] ??= []).push(...pick(j));
  };
  // Claude Code: ~/.claude.json (mcpServers + projects[abs].mcpServers), ~/.claude/mcp.json, <project>/.mcp.json
  addJSON("claude", path.join(home, ".claude.json"), (j) => [...names(j.mcpServers), ...names(j.projects?.[project]?.mcpServers)]);
  addJSON("claude", path.join(home, ".claude", "mcp.json"), (j) => names(j.mcpServers));
  addJSON("claude", path.join(project, ".mcp.json"), (j) => names(j.mcpServers));
  // Codex: TOML tables [mcp_servers.<name>] (single segment only)
  for (const p of [path.join(home, ".codex", "config.toml"), path.join(project, ".codex", "config.toml")]) {
    if (!fs.existsSync(p)) continue;
    const re = /^\[mcp_servers\.("[^"]+"|[^\].\s"]+)\]\s*$/gm;
    for (const m of fs.readFileSync(p, "utf8").matchAll(re)) (out.codex ??= []).push(m[1].replace(/^"|"$/g, ""));
  }
  // Cursor
  addJSON("cursor", path.join(home, ".cursor", "mcp.json"), (j) => names(j.mcpServers));
  addJSON("cursor", path.join(project, ".cursor", "mcp.json"), (j) => names(j.mcpServers));
  // Copilot
  addJSON("copilot", path.join(home, ".copilot", "mcp-config.json"), (j) => [...names(j.mcpServers), ...names(j.servers)]);
  addJSON("copilot", path.join(project, ".vscode", "mcp.json"), (j) => names(j.servers));
  // Gemini
  addJSON("gemini", path.join(home, ".gemini", "settings.json"), (j) => names(j.mcpServers));
  addJSON("gemini", path.join(project, ".gemini", "settings.json"), (j) => names(j.mcpServers));
  return { servers: out, unparsable };
}

function probe(p, ctx) {
  switch (p.kind) {
    case "mcp": {
      const needle = String(p.server).toLowerCase();
      const where = Object.entries(ctx.mcp.servers).filter(([, list]) => list.some((n) => n.toLowerCase().includes(needle))).map(([tool]) => tool);
      return where.length ? `mcp "${p.server}" in ${where.join(", ")}` : null;
    }
    case "cli":
      return (p.declared ? onPath(p.command) : has(p.command, p.args || ["--version"])) ? `cli ${p.command}` : null;
    case "env":
      return process.env[p.var] ? `env ${p.var} set` : null;
    case "file":
      return fs.existsSync(path.resolve(ctx.project, p.path)) ? `file ${p.path}` : null;
    default:
      return null;
  }
}

export function resolveIntegrations(cfg) {
  const entries = [...(cfg.integrations || [])];
  const src = cfg.ticket?.source;
  if (src && src !== "none" && !entries.some((e) => e.name === src)) entries.push({ name: src, required: true, usedBy: ["spec"] });
  return entries.map((e) => {
    const cat = CATALOG[e.name] || Object.values(CATALOG).find((c) => (c.aliases || []).includes(e.name));
    const probes = e.kind ? [{ kind: e.kind, server: e.server, command: e.command, var: e.var, path: e.path, declared: true }] : cat ? cat.probes : [];
    return { name: e.name, required: e.required !== false, probes, fix: e.fix || cat?.fix || { default: "declare a kind (mcp | cli | env | file) for this integration in flow.config.json" }, usedBy: e.usedBy || cat?.stages || [], known: !!cat || !!e.kind };
  });
}

export function diagnose({ project = process.cwd(), home = os.homedir(), only = null, version = true } = {}) {
  const items = [];
  const add = (area, name, ok, detail, fix, { optional = false } = {}) => items.push({ area, name, ok, detail, fix: ok ? null : fix, optional });

  const git = has("git");
  add("machine", "git", !!git, git || "not found", "install git: https://git-scm.com");
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  add("machine", "node", nodeMajor >= 20, `v${process.versions.node}`, "install Node 20 or newer: https://nodejs.org");
  add("machine", "welcome (first run on this machine)", fs.existsSync(homeFile()), fs.existsSync(homeFile()) ? "completed" : "not completed", "type: flow settings", { optional: true });

  const tiers = {};
  let claudePlugin = null;
  const pluginInstalled = () => (claudePlugin ??= claudePluginInstalled());
  for (const [tool, t] of Object.entries(TOOLS)) {
    if (!fs.existsSync(path.join(home, t.dir))) continue;
    const skills = t.skills.some((p) => fs.existsSync(path.join(home, p)) || fs.existsSync(path.join(project, p))) || (tool === "claude" && pluginInstalled());
    const agents = t.agents.some((p) => fs.existsSync(path.join(home, p)) || fs.existsSync(path.join(project, p.replace(".copilot/agents", ".github/agents")))) || (tool === "claude" && pluginInstalled());
    const hooks = t.hooks.length === 0 ? null : t.hooks.some((p) => fileHas(path.join(home, p), "flow-state") || fileHas(path.join(project, p), "flow-state")) || (tool === "claude" && pluginInstalled());
    // Codex and Cursor render the judge with a shell (only a read-only sandbox / readonly flag limits writes), so separation is by instruction there.
    tiers[tool] = skills && agents ? (tool === "codex" || tool === "cursor" ? "A- (judge may run; separation by instruction)" : tool === "copilot" || tool === "gemini" ? "A (adapter experimental)" : "A") : skills ? "B" : "not installed";
    add("tool", `${tool}: skills`, skills, skills ? "found" : "missing", t.install, { optional: true });
    add("tool", `${tool}: agent roles (builder with a shell, judge without)`, agents, agents ? "found" : "missing (tier B: roles by instruction)", t.agentsFix, { optional: true });
    if (hooks !== null) add("tool", `${tool}: hooks`, hooks, hooks ? "found" : "missing (frozen-spec guard, dispatch guard, state hydration off)", t.agentsFix, { optional: true });
    else if (tool === "copilot") add("tool", "copilot: hooks", false, "no hook adapter for Copilot yet (the frozen-spec and dispatch guards are prose there)", null, { optional: true });
    for (const stale of t.skills.map((p) => path.join(home, path.dirname(p), "flow-adopt"))) if (fs.existsSync(stale)) add("tool", `${tool}: stale skill folder`, false, `${stale} (renamed to flow-setup in 0.6)`, `remove it: rm -r "${stale}"`, { optional: true });
  }

  const isRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: project, encoding: "utf8" }).status === 0;
  add("project", "git repository", isRepo, isRepo ? project : "not a git repository", "git init, or open the project folder");
  const setUp = fs.existsSync(path.join(project, ".agent", "STATE.md")) || fs.existsSync(path.join(project, "flow.config.json"));
  add("project", "set up (flow.config.json, .agent/STATE.md)", setUp, setUp ? "yes" : "no", "type: flow setup");
  let cfg = null;
  try {
    const r = loadConfig(project);
    cfg = r.config;
    add("project", "config valid", r.errors.length === 0, r.errors.length ? r.errors.join("; ") : `autonomy ${cfg.autonomy}; review ${cfg.review.comment}/${cfg.review.approve ? "approve" : "no approve"}`, "fix the config: flow settings");
  } catch (e) {
    add("project", "config valid", false, e.message, "fix the config: flow settings");
  }
  const rules = collectRules(project);
  add("project", "repository rules found", rules.files.length > 0, rules.files.length ? rules.files.join(", ") : "none (AGENTS.md, CLAUDE.md, CONTRIBUTING.md, .cursor/rules, Copilot instructions)", "flow setup writes a verified block; or add an AGENTS.md");
  const verify = cfg?.ship?.verify || agentsVerifyLine(project);
  add("project", "verify command known", !!verify, verify || "unknown", "flow settings: set ship.verify (build, lint, test)");
  const ways = cfg?.ship?.branching;
  const waysMissing = [!ways && "ship.branching", !cfg?.ship?.verify && "ship.verify"].filter(Boolean);
  add("project", "ways of working recorded (branching, verify, merge requirements, deploy)", !waysMissing.length, waysMissing.length ? `not recorded: ${waysMissing.join(", ")} unset` : `branching ${ways}; verify ${cfg.ship.verify}; pr checks ${(cfg.ship.pr?.requiredChecks || []).length}; deploy ${cfg.ship.deploy || "unset"}`, "flow setup asks these; or flow settings");

  // integrations
  const mcp = mcpServers({ home, project });
  for (const p of mcp.unparsable) add("integration", `config file`, false, `unknown (could not parse ${p})`, "fix the JSON or TOML in that file", { optional: true });
  const ctx = { mcp, project };
  const declared = cfg ? resolveIntegrations(cfg) : [];
  const chosen = only ? declared.filter((d) => d.name === only) : declared;
  if (only && !chosen.length) add("integration", only, false, "not declared in flow.config.json integrations[] and not implied by ticket.source", "flow setup: register it (or flow settings integrations)", { optional: false });
  for (const d of chosen) {
    const hit = d.probes.map((p) => probe(p, ctx)).find(Boolean);
    const searched = d.probes.map((p) => p.kind === "mcp" ? `mcp:${p.server}` : p.kind === "cli" ? `cli:${p.command}` : p.kind === "env" ? `env:${p.var}` : `file:${p.path}`).join(", ");
    const fix = d.fix.default || Object.values(d.fix)[0] || "see flow.config.json";
    add("integration", `${d.name}${d.required ? "" : " (optional)"}${d.usedBy.length ? ` · used by ${d.usedBy.join(", ")}` : ""}`, !!hit, hit || (d.known ? `not found (searched ${searched})` : "unknown integration: declare a kind"), fix, { optional: !d.required });
  }
  if (!only && !declared.length) {
    const found = Object.entries(CATALOG).filter(([, c]) => c.probes.some((p) => probe(p, ctx))).map(([n]) => n);
    if (found.length) add("integration", "found but not registered", false, found.join(", "), "flow setup registers the ones this loop needs (flow.config.json integrations[])", { optional: true });
  }

  const vers = { installed: installedVersion() };
  if (version && cfg) vers.policy = cfg.update?.policy;
  add("version", "installed", true, vers.installed, null);

  const missing = items.filter((i) => !i.ok && !i.optional);
  return { items, tiers, ok: missing.length === 0, missing: missing.length, mcp: mcp.servers, version: vers };
}

function claudePluginInstalled() {
  if (!has("claude")) return false;
  const r = spawnSync("claude", ["plugin", "list"], { encoding: "utf8" });
  return r.status === 0 && /flow-state/.test(r.stdout || "");
}

function agentsVerifyLine(project) {
  for (const f of ["AGENTS.md", "CLAUDE.md"]) {
    const p = path.join(project, f);
    if (!fs.existsSync(p)) continue;
    const m = /\*\*Verify:\*\*\s*`([^`]+)`/.exec(fs.readFileSync(p, "utf8"));
    if (m) return m[1];
  }
  return null;
}

export function report(d) {
  const lines = [];
  for (const area of ["machine", "tool", "project", "integration", "version"]) {
    const rows = d.items.filter((i) => i.area === area);
    if (!rows.length) continue;
    lines.push(area);
    for (const i of rows) lines.push(`  ${i.ok ? "ok " : i.optional ? ".. " : "-- "} ${i.name}: ${i.detail}${i.fix ? `\n       fix: ${i.fix}` : ""}`);
  }
  const t = Object.entries(d.tiers);
  if (t.length) lines.push("tiers", ...t.map(([k, v]) => `  ${k}: ${v}`));
  lines.push(d.ok ? "connected: nothing required is missing" : `${d.missing} required thing(s) missing; fixes above`);
  return lines.join("\n");
}

function main(argv) {
  const get = (f, dflt) => {
    const i = argv.indexOf(f);
    return i === -1 ? dflt : argv[i + 1];
  };
  const d = diagnose({ project: path.resolve(get("--project", ".")), home: path.resolve(get("--home", os.homedir())), only: get("--only", null), version: !argv.includes("--no-version") });
  console.log(argv.includes("--json") ? JSON.stringify(d, null, 2) : report(d));
  return d.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
