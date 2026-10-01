#!/usr/bin/env node
// Flow State configuration: four layers, one merged view.
//   defaults  <-  ~/.flow/config.json (this machine; FLOW_HOME overrides)  <-  flow.config.json (the team)  <-  flow.config.user.json (just you)
// Scalars override; arrays of objects with a `name` merge by name; other arrays append.
// Keys marked x-team in the schema (review.*, ship.verify, ship.smoke, retro.apply) are refused in flow.config.user.json
// and never merged from ~/.flow/config.json: there they are only the defaults flow setup proposes (where().machineDefaults).
//
// Usage:
//   node config.mjs [--project <dir>] [--get <dotted.key>]            merged config (or one value)
//   node config.mjs where [--json]                                   the files, whether each exists, welcomed version, installed version
//   node config.mjs set --scope user|project|personal key=value ...  write one layer, then re-validate the merge
// Exit codes: 0 ok, 2 usage, 3 invalid config (message on stderr).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, "..", "config.schema.json");

export const DEFAULTS = Object.freeze({
  autonomy: "assisted",
  models: { builder: "sonnet", judge: "opus" },
  docs: { family: "flat", map: {} },
  specs: { dir: "docs/specs" },
  state: { dir: ".agent" },
  lenses: [],
  ticket: { source: "none" },
  retro: { apply: "propose" },
  rules: { include: [], exclude: [], maxBytes: "32768" },
  ship: { verify: "", smoke: "", defaultBranch: "main", branchPattern: "", pr: { template: "", requiredChecks: [], reviewers: [], labels: [], draft: true }, deploy: "", environments: [], release: "", done: [] },
  design: { doc: "" },
  roles: { dir: ".flow/roles" },
  review: { comment: "draft", approve: false, native: true },
  update: { policy: "ask", source: "agenticair/flow-state" },
  integrations: [],
  conventions: { exclude: [] },
  welcomed: "",
  language: "en",
});

export function homeDir() {
  return process.env.FLOW_HOME || path.join(os.homedir(), ".flow");
}
export function homeFile() {
  return path.join(homeDir(), "config.json");
}

const named = (arr) => arr.length > 0 && arr.every((x) => x && typeof x === "object" && "name" in x);

export function merge(base, over) {
  if (Array.isArray(base) && Array.isArray(over)) {
    if (!named(base) && !named(over)) return [...base, ...over];
    const out = [...base];
    for (const item of over) {
      const i = out.findIndex((x) => x && x.name === item.name);
      if (i === -1) out.push(item);
      else out[i] = { ...out[i], ...item };
    }
    return out;
  }
  if (isObj(base) && isObj(over)) {
    const out = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge(base[k], v) : v;
    return out;
  }
  return over === undefined ? base : over;
}

function isObj(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function validate(config, schema) {
  const errors = [];
  walk(config, schema, "", errors);
  return errors;
}

function walk(value, schema, at, errors) {
  if (!schema) return;
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at || "config"}: expected one of ${schema.enum.join(", ")}, got ${JSON.stringify(value)}`);
    return;
  }
  if (schema.type === "object") {
    if (!isObj(value)) return void errors.push(`${at || "config"}: expected an object`);
    const props = schema.properties || {};
    for (const key of Object.keys(value)) {
      if (props[key]) walk(value[key], props[key], at ? `${at}.${key}` : key, errors);
      else if (schema.additionalProperties === false) errors.push(`${at ? at + "." : ""}${key}: unknown key`);
      else if (isObj(schema.additionalProperties)) walk(value[key], schema.additionalProperties, `${at}.${key}`, errors);
    }
    for (const req of schema.required || []) if (!(req in value)) errors.push(`${at || "config"}: missing required ${req}`);
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return void errors.push(`${at}: expected an array`);
    value.forEach((v, i) => walk(v, schema.items, `${at}[${i}]`, errors));
  } else if (schema.type === "string" && typeof value !== "string") {
    errors.push(`${at}: expected a string`);
  } else if (schema.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${at}: expected true or false`);
  }
}

// Dotted keys whose schema says x-team: they may not be set in the personal file.
export function teamKeys(schema, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(schema.properties || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v["x-team"]) out.push(key);
    if (v.type === "object") out.push(...teamKeys(v, key));
  }
  return out;
}

function readJSON(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`${p}: not valid JSON (${e.message})`);
  }
}

function has(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split(".")) {
    if (!isObj(cur) || !(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

// Remove a dotted key from obj and return its value (undefined when absent).
function pluck(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) {
    if (!isObj(cur[p])) return undefined;
    cur = cur[p];
  }
  const last = parts.at(-1);
  if (!(last in cur)) return undefined;
  const v = cur[last];
  delete cur[last];
  return v;
}

export function files(projectDir) {
  return { home: homeFile(), project: path.join(projectDir, "flow.config.json"), personal: path.join(projectDir, "flow.config.user.json") };
}

export function load(projectDir) {
  const f = files(projectDir);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const home = readJSON(f.home) || {};
  const project = readJSON(f.project) || {};
  const personal = readJSON(f.personal) || {};
  const errors = [];
  const machineDefaults = {};
  for (const key of teamKeys(schema)) {
    if (has(personal, key)) errors.push(`${key}: a team setting; set it in flow.config.json, not flow.config.user.json`);
    const v = pluck(home, key);
    if (v !== undefined) machineDefaults[key] = v;
  }
  const merged = merge(merge(merge(DEFAULTS, home), project), personal);
  errors.push(...validate(merged, schema));
  return { config: merged, errors, files: f, machineDefaults, exists: { home: fs.existsSync(f.home), project: fs.existsSync(f.project), personal: fs.existsSync(f.personal) } };
}

export function installedVersion() {
  for (const p of [path.join(here, "..", "MANIFEST.json"), path.join(here, "..", "..", "..", "plugin.json")]) {
    try {
      const v = JSON.parse(fs.readFileSync(p, "utf8")).version;
      if (v) return v;
    } catch {}
  }
  return "unknown";
}

export function where(projectDir) {
  const r = load(projectDir);
  return { ...r.files, exists: r.exists, machineDefaults: r.machineDefaults, welcomed: r.config.welcomed || "", version: installedVersion(), firstRun: !r.exists.home };
}

function coerce(key, value, schema) {
  let node = schema;
  for (const part of key.split(".")) node = node?.properties?.[part];
  if (node?.type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`${key}: expected true or false`);
  }
  if (node?.type === "array" || node?.type === "object") return JSON.parse(value);
  return value;
}

function setDeep(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) cur = cur[p] = isObj(cur[p]) ? cur[p] : {};
  cur[parts.at(-1)] = value;
}

export function set(projectDir, scope, pairs) {
  const f = files(projectDir);
  const target = scope === "user" ? f.home : scope === "project" ? f.project : scope === "personal" ? f.personal : null;
  if (!target) throw new Error("scope must be user, project or personal");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const current = readJSON(target) || {};
  for (const [k, v] of Object.entries(pairs)) {
    if (scope === "personal" && teamKeys(schema).includes(k)) throw new Error(`${k}: a team setting; use --scope project`);
    setDeep(current, k, coerce(k, v, schema));
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(current, null, 2) + "\n");
  const after = load(projectDir);
  return { file: target, errors: after.errors, config: after.config };
}

function main(argv) {
  let project = process.cwd();
  let get = null;
  let scope = null;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") project = path.resolve(argv[++i] ?? "");
    else if (argv[i] === "--get") get = argv[++i];
    else if (argv[i] === "--scope") scope = argv[++i];
    else rest.push(argv[i]);
  }
  const json = rest.includes("--json");
  const verbs = rest.filter((a) => !a.startsWith("--"));
  try {
    if (verbs[0] === "where") {
      const w = where(project);
      if (json) console.log(JSON.stringify(w, null, 2));
      else {
        console.log(`machine : ${w.home}${w.exists.home ? "" : "  (missing: first run; type flow settings)"}`);
        console.log(`team    : ${w.project}${w.exists.project ? "" : "  (missing: not set up; type flow setup)"}`);
        console.log(`personal: ${w.personal}${w.exists.personal ? "" : "  (none)"}`);
        console.log(`welcomed: ${w.welcomed || "never"}   installed: ${w.version}`);
      }
      return 0;
    }
    if (verbs[0] === "set") {
      const pairs = {};
      for (const a of verbs.slice(1)) {
        const eq = a.indexOf("=");
        if (eq === -1) return usage();
        pairs[a.slice(0, eq)] = a.slice(eq + 1);
      }
      if (!scope || !Object.keys(pairs).length) return usage();
      const r = set(project, scope, pairs);
      if (r.errors.length) {
        console.error("written, but the merged config is invalid:\n  " + r.errors.join("\n  "));
        return 3;
      }
      console.log(`wrote ${r.file}`);
      return 0;
    }
    if (verbs.length) return usage();
    const r = load(project);
    if (r.errors.length) {
      console.error("invalid config:\n  " + r.errors.join("\n  "));
      return 3;
    }
    let out = r.config;
    if (get) for (const part of get.split(".")) out = out?.[part];
    process.stdout.write(typeof out === "string" ? out + "\n" : JSON.stringify(out ?? null, null, 2) + "\n");
    return 0;
  } catch (e) {
    console.error(`invalid config: ${e.message}`);
    return 3;
  }
}

function usage() {
  console.error("usage: config.mjs [--project <dir>] [--get key] | where [--json] | set --scope user|project|personal key=value ...");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
