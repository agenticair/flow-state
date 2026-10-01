#!/usr/bin/env node
// Collects the repository's own rules for agents, deterministically, so every Flow State stage follows the house rules
// of whichever company installed it. Repository rules win over Flow State conventions, rule by rule.
//
// Sources, in this order (each only if present):
//   AGENTS.md, CLAUDE.md (+ its @imports, one level), .claude/rules/*.md, .cursor/rules/*.mdc (alwaysApply or with a description),
//   .github/copilot-instructions.md, .github/instructions/*.instructions.md, GEMINI.md, CONTRIBUTING.md, the PR template, CODEOWNERS,
//   then flow.config.json rules.include[] (globs are not supported; list paths). rules.exclude[] removes paths.
// Imports and include[] must be .md/.mdc files inside the project; anything else is listed as skipped with a reason.
//
// Usage: node rules.mjs [--project <dir>] [--list] [--max-bytes 32768]
// Prints the concatenated rules with a source header per file (headings demoted one level). A file that does not fit the
// budget (--max-bytes, else rules.maxBytes, else 32768) is left out and named in a closing "[not pasted: …]" line. Exit 0 always.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_SOURCES = ["AGENTS.md", "CLAUDE.md", ".claude/rules", ".cursor/rules", ".github/copilot-instructions.md", ".github/instructions", "GEMINI.md", "CONTRIBUTING.md", ".github/PULL_REQUEST_TEMPLATE.md", "PULL_REQUEST_TEMPLATE.md", ".github/CODEOWNERS", "CODEOWNERS"];

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

// Headings in a pasted rule file sit two levels under the brief's own sections; fenced code is left as it is.
export function demote(body) {
  let fenced = false;
  return body
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) fenced = !fenced;
      return fenced ? line : line.replace(/^(#{1,4}) /, "##$1 ");
    })
    .join("\n");
}

export function collect(project, { maxBytes } = {}) {
  const cfg = readConfig(project).rules || {};
  maxBytes ??= Number(cfg.maxBytes) || 32768;
  const exclude = new Set((cfg.exclude || []).map((p) => path.resolve(project, p)));
  const files = [];
  const skipped = [];
  const root = path.resolve(project) + path.sep;
  const add = (p, extra = false) => {
    const abs = path.resolve(project, p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);
    const reason = !abs.startsWith(root) ? "outside project" : extra && /^\.env/.test(path.basename(abs)) ? "env file" : extra && !/\.mdc?$/.test(abs) ? "not markdown" : null;
    if (reason) return skipped.push({ path: abs, reason });
    if (exclude.has(abs) || files.includes(abs) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return;
    files.push(abs);
  };
  for (const src of DEFAULT_SOURCES) {
    const abs = path.join(project, src);
    if (src === ".claude/rules") listDir(abs, [".md"]).forEach((f) => add(f));
    else if (src === ".github/instructions") listDir(abs, [".instructions.md"]).forEach((f) => add(f));
    else if (src === ".cursor/rules") listDir(abs, [".mdc", ".md"]).forEach((f) => cursorRuleApplies(fs.readFileSync(f, "utf8")) && add(f));
    else add(src);
    if (src === "CLAUDE.md" && fs.existsSync(abs)) {
      for (const m of fs.readFileSync(abs, "utf8").matchAll(/(?:^|\s)@([^\s]+)/gm)) add(m[1].startsWith("~/") ? m[1] : path.resolve(path.dirname(abs), m[1]), true);
    }
  }
  for (const p of cfg.include || []) add(p, true);

  const rel = (f) => path.relative(project, f).split(path.sep).join("/");
  const sections = [];
  const notPasted = [];
  let bytes = 0;
  for (const abs of files) {
    const body = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n").trim();
    if (!body) continue;
    const chunk = `### ${rel(abs)}\n\n${demote(body)}`;
    if (bytes + chunk.length > maxBytes) {
      notPasted.push(rel(abs));
      continue;
    }
    sections.push(chunk);
    bytes += chunk.length;
  }
  const tail = [];
  if (notPasted.length) tail.push(`not pasted: ${notPasted.join(", ")}`);
  if (skipped.length) tail.push(`skipped: ${skipped.map((s) => `${s.path} (${s.reason})`).join(", ")}`);
  if (tail.length) sections.push(`[${tail.join("; ")}; read them directly]`);
  return { files: files.map(rel), text: sections.join("\n\n"), truncated: notPasted.length > 0, notPasted, skipped };
}

function main(argv) {
  const i = argv.indexOf("--project");
  const project = path.resolve(i === -1 ? "." : argv[i + 1]);
  const j = argv.indexOf("--max-bytes");
  const maxBytes = j === -1 ? undefined : Number(argv[j + 1]) || undefined;
  const r = collect(project, { maxBytes });
  if (argv.includes("--list")) {
    console.log([...r.files, ...r.skipped.map((s) => `skipped: ${s.path} (${s.reason})`)].join("\n") || "(no repository rule files found)");
    return 0;
  }
  console.log(r.text || "(no repository rule files found)");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
