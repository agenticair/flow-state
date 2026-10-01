#!/usr/bin/env node
// `flow connect`: checks the machine, the tools, and the project, and prints what is missing with the command that fixes it.
// Usage: node doctor.mjs [--project <dir>] [--home <dir>] [--json]
// Exit: 0 everything needed is present, 1 something is missing (details printed), 2 usage.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collect as collectRules } from "./rules.mjs";
import { load as loadConfig } from "./config.mjs";

const TOOLS = {
  claude: { dir: ".claude", skills: [".claude/skills/flow"], agents: [".claude/agents/flow-judge.md"], hooks: [".claude/settings.json"], install: "/plugin marketplace add agenticair/flow-state  then  /plugin install flow-state@flow-state", agentsFix: "install from a clone: ./install.sh --only claude  (or the plugin route above, which carries agents and hooks)" },
  codex: { dir: ".codex", skills: [".agents/skills/flow", ".codex/skills/flow"], agents: [".codex/agents/flow-judge.toml"], hooks: [".codex/hooks.json"], install: "npx skills add agenticair/flow-state  (or: codex plugin marketplace add agenticair/flow-state)", agentsFix: "./install.sh --only codex  (Codex plugins cannot carry agents or hooks)" },
  cursor: { dir: ".cursor", skills: [".agents/skills/flow", ".cursor/skills/flow"], agents: [".cursor/agents/flow-judge.md"], hooks: [".cursor/hooks.json"], install: "npx skills add agenticair/flow-state", agentsFix: "./install.sh --only cursor" },
  copilot: { dir: ".copilot", skills: [".agents/skills/flow", ".copilot/skills/flow"], agents: [".copilot/agents/flow-judge.agent.md"], hooks: [".copilot/hooks"], install: "npx skills add agenticair/flow-state", agentsFix: "./install.sh --only copilot" },
  gemini: { dir: ".gemini", skills: [".agents/skills/flow", ".gemini/skills/flow"], agents: [".gemini/agents/flow-judge.md"], hooks: [], install: "npx skills add agenticair/flow-state", agentsFix: "./install.sh --only gemini" },
};

function has(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
  return r.status === 0 ? (r.stdout || r.stderr || "").trim().split("\n")[0] : null;
}

function fileHas(p, needle) {
  try {
    return fs.readFileSync(p, "utf8").includes(needle);
  } catch {
    return false;
  }
}

export function diagnose({ project = process.cwd(), home = os.homedir() } = {}) {
  const items = [];
  const add = (area, name, ok, detail, fix) => items.push({ area, name, ok, detail, fix: ok ? null : fix });

  // machine
  const git = has("git");
  add("machine", "git", !!git, git || "not found", "install git: https://git-scm.com");
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  add("machine", "node", nodeMajor >= 20, `v${process.versions.node}`, "install Node 20 or newer: https://nodejs.org");
  const gh = has("gh");
  const ghAuth = gh ? spawnSync("gh", ["auth", "status"], { encoding: "utf8" }).status === 0 : false;
  add("machine", "gh (optional: tickets, PRs, retro issues)", ghAuth, gh ? (ghAuth ? "authenticated" : "installed, not signed in") : "not found", gh ? "gh auth login" : "install GitHub CLI: https://cli.github.com, then gh auth login");

  // tools
  const tiers = {};
  for (const [tool, t] of Object.entries(TOOLS)) {
    const present = fs.existsSync(path.join(home, t.dir));
    if (!present) continue;
    const skills = t.skills.some((p) => fs.existsSync(path.join(home, p)) || fs.existsSync(path.join(project, p))) || (tool === "claude" && claudePluginInstalled());
    const agents = t.agents.some((p) => fs.existsSync(path.join(home, p)) || fs.existsSync(path.join(project, p.replace(".copilot/agents", ".github/agents")))) || (tool === "claude" && claudePluginInstalled());
    const hooks = t.hooks.length === 0 ? null : t.hooks.some((p) => fileHas(path.join(home, p), "flow-state") || fileHas(path.join(project, p), "flow-state")) || (tool === "claude" && claudePluginInstalled());
    const tier = skills && agents ? "A" : skills ? "B" : "not installed";
    tiers[tool] = tier;
    add("tool", `${tool}: skills`, skills, skills ? "found" : "missing", t.install);
    add("tool", `${tool}: agent roles (builder with a shell, judge without)`, agents, agents ? "found" : "missing (tier B: roles by instruction)", t.agentsFix);
    if (hooks !== null) add("tool", `${tool}: hooks`, hooks, hooks ? "found" : "missing (frozen-spec guard, dispatch guard, state hydration off)", t.agentsFix);
  }

  // project
  const isRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: project, encoding: "utf8" }).status === 0;
  add("project", "git repository", isRepo, isRepo ? project : "not a git repository", "git init, or open the project folder");
  const adopted = fs.existsSync(path.join(project, ".agent", "STATE.md")) || fs.existsSync(path.join(project, "flow.config.json"));
  add("project", "adopted (flow.config.json, .agent/STATE.md)", adopted, adopted ? "yes" : "no", "invoke flow-adopt in this project");
  let cfg = null;
  try {
    const r = loadConfig(project);
    cfg = r.config;
    add("project", "config valid", r.errors.length === 0, r.errors.length ? r.errors.join("; ") : `autonomy ${cfg.autonomy}`, "fix flow.config.json (flow settings)");
  } catch (e) {
    add("project", "config valid", false, e.message, "fix flow.config.json (flow settings)");
  }
  const rules = collectRules(project);
  add("project", "repository rules found", rules.files.length > 0, rules.files.length ? rules.files.join(", ") : "none (AGENTS.md, CLAUDE.md, CONTRIBUTING.md, .cursor/rules, Copilot instructions)", "flow-adopt writes a verified block; or add an AGENTS.md");
  const verify = cfg?.ship?.verify || agentsVerifyLine(project);
  add("project", "verify command known", !!verify, verify || "unknown", "flow settings: set ship.verify (build, lint, test)");
  const ways = cfg?.ship?.branching;
  add("project", "ways of working recorded (branching, merge requirements, deploy)", !!ways, ways ? `branching ${ways}; pr checks ${(cfg.ship.pr?.requiredChecks || []).length}; deploy ${cfg.ship.deploy || "unset"}` : "not recorded", "flow-adopt asks these; or flow settings");

  const missing = items.filter((i) => !i.ok && !/optional/.test(i.name));
  return { items, tiers, ok: missing.length === 0, missing: missing.length };
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
  for (const area of ["machine", "tool", "project"]) {
    lines.push(`${area}`);
    for (const i of d.items.filter((i) => i.area === area)) lines.push(`  ${i.ok ? "ok " : "-- "} ${i.name}: ${i.detail}${i.fix ? `\n       fix: ${i.fix}` : ""}`);
  }
  const t = Object.entries(d.tiers);
  if (t.length) lines.push("tiers", ...t.map(([k, v]) => `  ${k}: ${v}`));
  lines.push(d.ok ? "connected: nothing missing" : `${d.missing} thing(s) missing; fixes above`);
  return lines.join("\n");
}

function main(argv) {
  const get = (f, dflt) => {
    const i = argv.indexOf(f);
    return i === -1 ? dflt : argv[i + 1];
  };
  const d = diagnose({ project: path.resolve(get("--project", ".")), home: path.resolve(get("--home", os.homedir())) });
  console.log(argv.includes("--json") ? JSON.stringify(d, null, 2) : report(d));
  return d.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
