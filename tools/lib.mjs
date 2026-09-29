// Shared helpers for the maintainer tools. Zero dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SKILL_FIELDS = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Minimal YAML frontmatter parser: scalars, one level of nested map, and inline lists are enough for our files.
export function parseFrontmatter(text, file = "<text>") {
  if (!text.startsWith("---\n")) throw new Error(`${file}: missing frontmatter`);
  const end = text.indexOf("\n---", 4);
  if (end === -1) throw new Error(`${file}: unterminated frontmatter`);
  const raw = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};
  let current = null;
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const nested = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (nested && current) {
      data[current][nested[1]] = unquote(nested[2]);
      continue;
    }
    const top = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!top) throw new Error(`${file}: cannot parse frontmatter line: ${line}`);
    const [, key, value] = top;
    if (value === "") {
      data[key] = {};
      current = key;
    } else {
      data[key] = unquote(value);
      current = null;
    }
  }
  return { data, body };
}

function unquote(v) {
  const s = v.trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
  return s;
}

export function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function listSkillDirs(root = ROOT) {
  const dir = path.join(root, "skills");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dir, d.name))
    .sort();
}

export function listRoleFiles(root = ROOT) {
  const dir = path.join(root, "skills", "flow-core", "roles");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f))
    .sort();
}

export function readRole(file) {
  const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"), path.relative(ROOT, file));
  for (const k of ["name", "description", "tools", "model"]) {
    if (!(k in data)) throw new Error(`${path.relative(ROOT, file)}: role is missing "${k}"`);
  }
  return {
    name: data.name,
    description: data.description,
    tools: String(data.tools)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    model: data.model,
    readonly: data.readonly === true,
    body: body.trim() + "\n",
    source: path.relative(ROOT, file).split(path.sep).join("/"),
  };
}

export function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out.sort();
}
