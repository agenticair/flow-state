#!/usr/bin/env node
// Collects the repository's own rules for agents, deterministically, so every Flow State stage follows the house rules
// of whichever company installed it. Repository rules win over Flow State conventions, rule by rule.
//
// Sources, in this order (each only if present):
//   AGENTS.md, CLAUDE.md (+ its @imports, one level), .claude/rules/*.md, .cursor/rules/*.mdc (alwaysApply or with a description),
//   .github/copilot-instructions.md, .github/instructions/*.instructions.md, GEMINI.md, CONTRIBUTING.md,
//   then flow.config.json rules.include[] (globs are not supported; list paths). rules.exclude[] removes paths.
//
// Usage: node rules.mjs [--project <dir>] [--list] [--max-bytes 32768]
// Prints the concatenated rules with a source header per file, truncated at --max-bytes with a note. Exit 0 always.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_SOURCES = ["AGENTS.md", "CLAUDE.md", ".claude/rules", ".cursor/rules", ".github/copilot-instructions.md", ".github/instructions", "GEMINI.md", "CONTRIBUTING.md"];

function readConfig(project) {
  try {
    return JSON.parse(fs.readFileSync(path.join(project, "flow.config.json"), "utf8"));
  } catch {
    return {};
  }
}

function listDir(dir, ext) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs.readdirSync(dir).filter((f) => ext.some((e) => f.endsWith(e))).sort().map((f) => path.join(dir, f));
}

function cursorRuleApplies(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!fm) return true;
  if (/^alwaysApply:\s*true/m.test(fm[1])) return true;
  if (/^globs:\s*\S/m.test(fm[1])) return false; // path-scoped rules are applied by the editor, not globally
  return /^description:\s*\S/m.test(fm[1]);
}

export function collect(project, { maxBytes = 32768 } = {}) {
  const cfg = readConfig(project).rules || {};
  const exclude = new Set((cfg.exclude || []).map((p) => path.resolve(project, p)));
  const files = [];
  const add = (p) => {
    const abs = path.resolve(project, p);
    if (exclude.has(abs) || files.includes(abs) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return;
    files.push(abs);
  };
  for (const src of DEFAULT_SOURCES) {
    const abs = path.join(project, src);
    if (src === ".claude/rules") listDir(abs, [".md"]).forEach(add);
    else if (src === ".github/instructions") listDir(abs, [".instructions.md"]).forEach(add);
    else if (src === ".cursor/rules") listDir(abs, [".mdc", ".md"]).forEach((f) => cursorRuleApplies(fs.readFileSync(f, "utf8")) && add(f));
    else add(src);
    if (src === "CLAUDE.md" && fs.existsSync(abs)) {
      for (const m of fs.readFileSync(abs, "utf8").matchAll(/^@([^\s]+)/gm)) add(path.resolve(path.dirname(abs), m[1]));
    }
  }
  for (const p of cfg.include || []) add(p);

  const sections = [];
  let bytes = 0;
  let truncated = false;
  for (const abs of files) {
    const relp = path.relative(project, abs).split(path.sep).join("/");
    const body = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n").trim();
    if (!body) continue;
    const chunk = `### ${relp}\n\n${body}`;
    if (bytes + chunk.length > maxBytes) {
      const room = Math.max(0, maxBytes - bytes - 80);
      sections.push(chunk.slice(0, room) + `\n\n[… truncated: ${relp} exceeds the ${maxBytes}-byte rules budget; read it directly]`);
      truncated = true;
      break;
    }
    sections.push(chunk);
    bytes += chunk.length;
  }
  return { files: files.map((f) => path.relative(project, f).split(path.sep).join("/")), text: sections.join("\n\n"), truncated };
}

function main(argv) {
  const i = argv.indexOf("--project");
  const project = path.resolve(i === -1 ? "." : argv[i + 1]);
  const j = argv.indexOf("--max-bytes");
  const maxBytes = j === -1 ? 32768 : Number(argv[j + 1]);
  const r = collect(project, { maxBytes });
  if (argv.includes("--list")) {
    console.log(r.files.length ? r.files.join("\n") : "(no repository rule files found)");
    return 0;
  }
  console.log(r.text || "(no repository rule files found)");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
