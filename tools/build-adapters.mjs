#!/usr/bin/env node
// Generates every per-tool artifact from the sources of truth:
//   skills/flow-core/roles/*.md  ->  agents/ (Claude Code), adapters/{codex,cursor,copilot,gemini}/agents/
//   plugin.json version          ->  .claude-plugin/plugin.json, .claude-plugin/marketplace.json, package.json
// Usage: node tools/build-adapters.mjs [--check]
//   --check  generate in memory and exit 1 if any committed file differs (used by CI).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { ROOT, listRoleFiles, readRole, readJSON, walkFiles } from "./lib.mjs";

const GROUND_RULES_PATH = path.join(ROOT, "skills", "flow-core", "ground-rules.md");
export const groundRules = () => fs.readFileSync(GROUND_RULES_PATH, "utf8").replace(/\r\n/g, "\n").trim();

const HOOKS_SPEC = path.join(ROOT, "hooks", "hooks.spec.json");
const CURSOR_EVENTS = { SessionStart: "sessionStart", PreToolUse: "preToolUse", Stop: "stop" };
const GENERATED_DIRS = ["agents", "adapters/codex/agents", "adapters/cursor/agents", "adapters/copilot/agents", "adapters/gemini/agents"];

// Tool-name maps. Claude names are the source vocabulary.
const GEMINI_TOOLS = { Read: "read_file", Grep: "grep_search", Glob: "glob", Write: "write_file", Edit: "replace", Bash: "run_shell_command" };
const COPILOT_TOOLS = { Read: "read", Grep: "search", Glob: "search", Write: "edit", Edit: "edit", Bash: "shell" };

export function render(role, gr = groundRules()) {
  const stamp = `Generated from ${role.source} by tools/build-adapters.mjs. Do not edit; edit the source and run npm run build.`;
  const out = {};
  const grSection = `## Ground rules\n\n${gr.replace(/^# Ground rules\n+/, "")}\n\n`;
  role = { ...role, body: grSection + role.body };

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

export function renderHooks(spec) {
  const claude = { hooks: {} };
  const codex = { hooks: {} };
  const cursor = { version: 1, hooks: {} };
  for (const h of spec.hooks) {
    const c = { hooks: [{ type: "command", command: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/${h.script}"`, timeout: h.timeout }] };
    if (h.matcher) c.matcher = h.matcher;
    (claude.hooks[h.event] ??= []).push(c);
    const x = { hooks: [{ type: "command", command: `node "\${FLOW_HOOKS_DIR}/${h.script}" --tool codex`, timeout: h.timeout }] };
    if (h.matcher) x.matcher = h.matcher;
    (codex.hooks[h.event] ??= []).push(x);
    const u = { command: `node "\${FLOW_HOOKS_DIR}/${h.script}" --tool cursor`, timeout: h.timeout };
    if (h.event === "PreToolUse" && h.matcher) u.matcher = h.matcher;
    if (h.failClosed) u.failClosed = true;
    (cursor.hooks[CURSOR_EVENTS[h.event]] ??= []).push(u);
  }
  const json = (o) => JSON.stringify(o, null, 2) + "\n";
  return { "hooks/hooks.json": json(claude), "adapters/codex/hooks.json": json(codex), "adapters/cursor/hooks.json": json(cursor) };
}

function tomlStr(s) {
  return JSON.stringify(s);
}

function uniq(a) {
  return [...new Set(a)];
}

// Web bundle: the planning stages as one Markdown file for ChatGPT GPTs, Claude Projects and Gemini Gems (no filesystem, no scripts).
const WEB_SKILLS = ["flow", "flow-spec", "flow-stories", "flow-design"];
const WEB_TEMPLATES = ["spec.md", "stories.md", "story.md", "screen.md"];
export function renderWeb(root = ROOT) {
  const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n").trim();
  const version = readJSON(path.join(root, "plugin.json")).version;
  const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  const parts = [
    `# Flow State ${version} — planning bundle for web chats`,
    "",
    "This file carries the planning stages of Flow State (hub, spec, stories, design) for a chat without a filesystem: a ChatGPT GPT, a Claude Project, a Gemini Gem. Read it in full on the first message.",
    "",
    "## How this differs from the coding-tool version",
    "",
    "- There is no repository to investigate: ask the human for the files or facts a stage would otherwise read, and say when a question could be answered by looking at the repo.",
    "- There are no scripts: every score is computed by hand and labelled `UNVERIFIED (web)`; the freeze is the human's word, recorded in the spec text.",
    "- Every artifact (spec, slice table, story, screen) is written in full in the chat, under its file path as a heading, so the human can paste it into the repository at that path and continue in any coding tool.",
    "- The gates are the same: freeze (spec), go (first story), merge (never here). Never proceed past a gate without the human's word.",
    "- Never invent: a missing fact is `[⚠️ Pending: define with <who>]` or `[NEEDS CLARIFICATION: <question>]`.",
    "",
  ];
  parts.push("# Ground rules", "", groundRules().replace(/^# Ground rules\n+/, ""), "");
  for (const name of WEB_SKILLS) parts.push(`# Stage: ${name}`, "", body(read(`skills/${name}/SKILL.md`)), "");
  parts.push("# Templates", "");
  for (const t of WEB_TEMPLATES) parts.push(`## templates/${t}`, "", "```markdown", read(`skills/flow-core/templates/${t}`), "```", "");
  parts.push("# Conventions (apply where the repository's own rules are silent)", "");
  for (const f of fs.readdirSync(path.join(root, "skills/flow-core/conventions")).filter((f) => f.endsWith(".md")).sort()) parts.push(body(read(`skills/flow-core/conventions/${f}`)), "");
  const bundle = parts.join("\n");
  const instructions = `# Flow State planning bundle — setup

## ChatGPT (Custom GPT)
1. Create a GPT named "Flow State planner". Under Configure, upload \`flow-state-planning.md\` as Knowledge.
2. Paste the block below the PASTE BOUNDARY into Instructions. Save.

## Claude (Project)
1. Create a Project named "Flow State planner". Add \`flow-state-planning.md\` to its knowledge.
2. Paste the block below the PASTE BOUNDARY into the project instructions.

## Gemini (Gem)
1. Create a Gem named "Flow State planner". Upload \`flow-state-planning.md\` as a knowledge file.
2. Paste the block below the PASTE BOUNDARY into the instructions box. Save.

Afterwards, paste each artifact the planner writes into your repository at the path it names, and continue with \`flow\` in your coding tool.

═══════════════ PASTE BOUNDARY: everything below goes into Instructions ═══════════════

You are the Flow State planner (version ${version}). Your protocol is the knowledge file flow-state-planning.md: read it in full on the first message, then act as its "flow" stage: size the ask, route to spec, stories or design, and run that stage exactly as written. Write every artifact in full under its file path. Stop at every gate (freeze, go) and wait for the human's word. Never invent a fact, a metric or a quote; mark gaps as the protocol says. Label every score UNVERIFIED (web). Keep answers short between artifacts.
`;
  return { "adapters/web/flow-state-planning.md": bundle + "\n", "adapters/web/INSTRUCTIONS.md": instructions };
}

export function generateAll(root = ROOT) {
  const files = {};
  for (const file of listRoleFiles(root)) Object.assign(files, render(readRole(file)));
  Object.assign(files, renderHooks(readJSON(HOOKS_SPEC)));
  Object.assign(files, renderWeb(root));

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

  // MANIFEST.json: sha256 of every file under skills/ (relative to skills/), so flow update can tell an edited install from a clean one.
  const manifest = { version, repository: readJSON(path.join(root, "plugin.json")).repository || "", files: {} };
  const skillsDir = path.join(root, "skills");
  for (const p of walkFiles(skillsDir)) {
    const rel2 = path.relative(skillsDir, p).split(path.sep).join("/");
    if (rel2 === "flow-core/MANIFEST.json") continue;
    manifest.files[rel2] = crypto.createHash("sha256").update(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");
  }
  files["skills/flow-core/MANIFEST.json"] = JSON.stringify(manifest, null, 2) + "\n";

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
