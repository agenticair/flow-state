#!/usr/bin/env node
// Generates every per-tool artifact from the sources of truth:
//   skills/flow-core/roles/*.md  ->  agents/ (Claude Code), adapters/{codex,cursor,copilot,gemini}/agents/
//   plugin.json version          ->  .claude-plugin/plugin.json, .claude-plugin/marketplace.json, package.json
// Usage: node tools/build-adapters.mjs [--check]
//   --check  generate in memory and exit 1 if any committed file differs (used by CI).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, listRoleFiles, readRole, readJSON, walkFiles } from "./lib.mjs";

const GENERATED_DIRS = ["agents", "adapters/codex/agents", "adapters/cursor/agents", "adapters/copilot/agents", "adapters/gemini/agents"];

// Tool-name maps. Claude names are the source vocabulary.
const GEMINI_TOOLS = { Read: "read_file", Grep: "grep_search", Glob: "glob", Write: "write_file", Edit: "replace", Bash: "run_shell_command" };
const COPILOT_TOOLS = { Read: "read", Grep: "search", Glob: "search", Write: "edit", Edit: "edit", Bash: "shell" };

export function render(role) {
  const stamp = `Generated from ${role.source} by tools/build-adapters.mjs. Do not edit; edit the source and run npm run build.`;
  const out = {};

  // Claude Code (also read by Cursor from .claude/agents/)
  out[`agents/${role.name}.md`] =
    `---\nname: ${role.name}\ndescription: ${role.description}\ntools: ${role.tools.join(", ")}\nmodel: ${role.model}\n---\n<!-- ${stamp} -->\n\n${role.body}`;

  // Cursor: name, description, model (ids differ per tool; inherit), readonly
  out[`adapters/cursor/agents/${role.name}.md`] =
    `---\nname: ${role.name}\ndescription: ${role.description}\nmodel: inherit\nreadonly: ${role.readonly}\n---\n<!-- ${stamp} -->\n\n${role.body}`;

  // Codex: TOML, developer_instructions carries the body; read-only sandbox for read-only roles
  out[`adapters/codex/agents/${role.name}.toml`] =
    `# ${stamp}\nname = ${tomlStr(role.name)}\ndescription = ${tomlStr(role.description)}\n` +
    (role.readonly ? `sandbox_mode = "read-only"\n` : "") +
    `developer_instructions = """\n${role.body.replace(/\\/g, "\\\\").replace(/"""/g, '\\"""')}"""\n`;

  // Copilot: .agent.md with a tools list in Copilot vocabulary
  const copilotTools = uniq(role.tools.map((t) => COPILOT_TOOLS[t]).filter(Boolean));
  out[`adapters/copilot/agents/${role.name}.agent.md`] =
    `---\nname: ${role.name}\ndescription: ${role.description}\ntools: [${copilotTools.map((t) => `"${t}"`).join(", ")}]\n---\n<!-- ${stamp} -->\n\n${role.body}`;

  // Gemini CLI: experimental subagents, local kind, tool names in Gemini vocabulary
  const geminiTools = uniq(role.tools.map((t) => GEMINI_TOOLS[t]).filter(Boolean));
  out[`adapters/gemini/agents/${role.name}.md`] =
    `---\nname: ${role.name}\ndescription: ${role.description}\nkind: local\ntools: [${geminiTools.join(", ")}]\n---\n<!-- ${stamp} -->\n\n${role.body}`;

  return out;
}

function tomlStr(s) {
  return JSON.stringify(s);
}

function uniq(a) {
  return [...new Set(a)];
}

export function generateAll(root = ROOT) {
  const files = {};
  for (const file of listRoleFiles(root)) Object.assign(files, render(readRole(file)));

  const version = readJSON(path.join(root, "plugin.json")).version;
  const claude = readJSON(path.join(root, ".claude-plugin/plugin.json"));
  claude.version = version;
  files[".claude-plugin/plugin.json"] = JSON.stringify(claude, null, 2) + "\n";

  const market = readJSON(path.join(root, ".claude-plugin/marketplace.json"));
  if (market.metadata) market.metadata.version = version;
  for (const p of market.plugins || []) p.version = version;
  files[".claude-plugin/marketplace.json"] = JSON.stringify(market, null, 2) + "\n";

  const pkg = readJSON(path.join(root, "package.json"));
  pkg.version = version;
  files["package.json"] = JSON.stringify(pkg, null, 2) + "\n";

  return files;
}

export function diffAgainstDisk(files, root = ROOT) {
  const stale = [];
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p) || fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n") !== content) stale.push(rel);
  }
  for (const dir of GENERATED_DIRS) {
    for (const p of walkFiles(path.join(root, dir))) {
      const rel = path.relative(root, p).split(path.sep).join("/");
      if (!(rel in files)) stale.push(`${rel} (orphan)`);
    }
  }
  return stale;
}

export function writeAll(files, root = ROOT) {
  for (const dir of GENERATED_DIRS) {
    for (const p of walkFiles(path.join(root, dir))) {
      const rel = path.relative(root, p).split(path.sep).join("/");
      if (!(rel in files)) fs.rmSync(p);
    }
  }
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const files = generateAll();
  if (check) {
    const stale = diffAgainstDisk(files);
    if (stale.length) {
      console.error("generated files are stale; run `npm run build` and commit:\n  " + stale.join("\n  "));
      process.exit(1);
    }
    console.log(`adapters up to date (${Object.keys(files).length} files)`);
  } else {
    writeAll(files);
    console.log(`wrote ${Object.keys(files).length} generated files`);
  }
}
