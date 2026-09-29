#!/usr/bin/env node
// Prints the merged Flow State configuration for a project as JSON.
// Usage: node config.mjs [--project <dir>] [--get <dotted.key>]
// Merge order: defaults <- flow.config.json <- flow.config.user.json
// Scalars override; arrays of objects with a `name` merge by name; other arrays append.
// Exit codes: 0 ok, 2 usage, 3 invalid config (message on stderr).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, "..", "config.schema.json");

export const DEFAULTS = Object.freeze({
  autonomy: "gated",
  models: { builder: "sonnet", judge: "opus" },
  docs: { family: "flat", map: {} },
  specs: { dir: "docs/specs" },
  state: { dir: ".agent" },
  lenses: [],
  ticket: { source: "none" },
  retro: { apply: "propose" },
  language: "en",
});

export function merge(base, over) {
  if (Array.isArray(base) && Array.isArray(over)) {
    const keyed = base.every((x) => x && typeof x === "object" && "name" in x);
    if (!keyed) return [...base, ...over];
    const out = [...base];
    for (const item of over) {
      const i = out.findIndex((x) => x.name === item.name);
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
  }
}

export function load(projectDir) {
  const read = (name) => {
    const p = path.join(projectDir, name);
    if (!fs.existsSync(p)) return {};
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
      throw new Error(`${name}: not valid JSON (${e.message})`);
    }
  };
  const merged = merge(merge(DEFAULTS, read("flow.config.json")), read("flow.config.user.json"));
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const errors = validate(merged, schema);
  return { config: merged, errors };
}

function main(argv) {
  let project = process.cwd();
  let get = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") project = path.resolve(argv[++i] ?? "");
    else if (argv[i] === "--get") get = argv[++i];
    else {
      console.error("usage: config.mjs [--project <dir>] [--get <dotted.key>]");
      return 2;
    }
  }
  let result;
  try {
    result = load(project);
  } catch (e) {
    console.error(`invalid config: ${e.message}`);
    return 3;
  }
  if (result.errors.length) {
    console.error("invalid config:\n  " + result.errors.join("\n  "));
    return 3;
  }
  let out = result.config;
  if (get) for (const part of get.split(".")) out = out?.[part];
  process.stdout.write(typeof out === "string" ? out + "\n" : JSON.stringify(out ?? null, null, 2) + "\n");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
