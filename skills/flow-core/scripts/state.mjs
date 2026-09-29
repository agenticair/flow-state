#!/usr/bin/env node
// Reads and writes the project state file (.agent/STATE.md): a frontmatter block plus free-form notes.
// Usage:
//   node state.mjs init [--dir .agent] [--force]
//   node state.mjs show | get <key> | set key=value [key=value ...] | note "<text>"    [--dir .agent]
// Exit codes: 0 ok, 2 usage, 3 state missing or already present, 4 invalid value.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(here, "..", "templates", "STATE.md");

export const KEYS = ["feature", "stage", "gate", "spec", "last_commit", "blocked", "updated"];
export const STAGES = ["idle", "spec", "stories", "design", "build", "review", "ship", "retro"];
export const GATES = ["none", "freeze", "go", "merge"];

export function parseState(text) {
  const t = text.replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  if (!m) throw new Error("STATE.md: missing frontmatter");
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: m[2] };
}

export function serializeState(data, body) {
  const front = KEYS.map((k) => `${k}: ${data[k] ?? "none"}`).join("\n");
  return `---\n${front}\n---\n${body.startsWith("\n") ? body : "\n" + body}`;
}

export function validateSet(pairs) {
  const errors = [];
  for (const [k, v] of Object.entries(pairs)) {
    if (!KEYS.includes(k) || k === "updated") errors.push(`unknown or reserved key: ${k}`);
    if (k === "stage" && !STAGES.includes(v)) errors.push(`stage must be one of ${STAGES.join(", ")}`);
    if (k === "gate" && !GATES.includes(v)) errors.push(`gate must be one of ${GATES.join(", ")}`);
  }
  return errors;
}

export function statePath(dir) {
  return path.join(dir, "STATE.md");
}

export function read(dir) {
  const p = statePath(dir);
  if (!fs.existsSync(p)) throw new Error(`no state file at ${p}; run flow-adopt`);
  return parseState(fs.readFileSync(p, "utf8"));
}

export function write(dir, data, body) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(dir), serializeState(data, body));
}

export function init(dir, { force = false, now = new Date() } = {}) {
  const p = statePath(dir);
  if (fs.existsSync(p) && !force) throw new Error(`state already exists at ${p} (use --force to reset)`);
  const { data, body } = parseState(fs.readFileSync(TEMPLATE, "utf8"));
  data.updated = now.toISOString();
  write(dir, data, body);
  return p;
}

export function set(dir, pairs, { now = new Date() } = {}) {
  const errors = validateSet(pairs);
  if (errors.length) throw new Error(errors.join("; "));
  const { data, body } = read(dir);
  Object.assign(data, pairs, { updated: now.toISOString() });
  write(dir, data, body);
  return data;
}

export function note(dir, text, { now = new Date() } = {}) {
  const { data, body } = read(dir);
  const line = `- ${now.toISOString().slice(0, 10)} ${text}`;
  const marker = "## Notes\n";
  const i = body.indexOf(marker);
  const newBody = i === -1 ? body + `\n${marker}\n${line}\n` : body.slice(0, i + marker.length) + "\n" + line + body.slice(i + marker.length);
  data.updated = now.toISOString();
  write(dir, data, newBody);
}

function main(argv) {
  let dir = ".agent";
  let force = false;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i];
    else if (argv[i] === "--force") force = true;
    else rest.push(argv[i]);
  }
  dir = path.resolve(dir);
  const [cmd, ...args] = rest;
  try {
    switch (cmd) {
      case "init": {
        const p = init(dir, { force });
        console.log(`initialised ${p}`);
        return 0;
      }
      case "show":
        process.stdout.write(fs.readFileSync(statePath(dir), "utf8"));
        return 0;
      case "get": {
        if (!args[0]) return usage();
        const { data } = read(dir);
        console.log(data[args[0]] ?? "");
        return 0;
      }
      case "set": {
        if (!args.length) return usage();
        const pairs = {};
        for (const a of args) {
          const eq = a.indexOf("=");
          if (eq === -1) return usage();
          pairs[a.slice(0, eq)] = a.slice(eq + 1);
        }
        const data = set(dir, pairs);
        console.log(KEYS.map((k) => `${k}: ${data[k]}`).join("\n"));
        return 0;
      }
      case "note":
        if (!args[0]) return usage();
        note(dir, args.join(" "));
        console.log("noted");
        return 0;
      default:
        return usage();
    }
  } catch (e) {
    console.error(e.message);
    return /already exists|no state file/.test(e.message) ? 3 : 4;
  }
}

function usage() {
  console.error("usage: state.mjs init [--force] | show | get <key> | set key=value ... | note <text>   [--dir .agent]");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
