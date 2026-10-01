#!/usr/bin/env node
// `flow update`: installed version vs the latest in update.source, with a safety check that never clobbers a customised copy.
//   node update.mjs check [--project <dir>] [--json]   installed, latest (cached 24h), route, edited files
//   node update.mjs run --yes [--project <dir>]        runs the route only when nothing is edited and no build run is open
// Exit: 0 ok / up to date, 1 update available (check) or refused (run), 2 usage, 3 could not check.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load as loadConfig, homeDir, installedVersion } from "./config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SKILLS_ROOT = path.resolve(here, "..", "..");

export function compare(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function readManifest(root = SKILLS_ROOT) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "flow-core", "MANIFEST.json"), "utf8"));
  } catch {
    return null;
  }
}

export function editedFiles(root = SKILLS_ROOT, manifest = readManifest(root)) {
  if (!manifest) return { known: false, edited: [], missing: [] };
  const edited = [], missing = [];
  for (const [rel, sha] of Object.entries(manifest.files || {})) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) {
      missing.push(rel);
      continue;
    }
    const h = crypto.createHash("sha256").update(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");
    if (h !== sha) edited.push(rel);
  }
  return { known: true, edited, missing };
}

export function route(root = SKILLS_ROOT) {
  if (root.split(path.sep).includes("plugins")) return { kind: "claude-plugin", command: "claude plugin update flow-state@flow-state" };
  const install = path.join(homeDir(), "install.json");
  if (fs.existsSync(install)) {
    try {
      const i = JSON.parse(fs.readFileSync(install, "utf8"));
      if (i.source) return { kind: "clone", command: `cd "${i.source}" && git pull && ./install.sh --yes`, cwd: i.source };
    } catch {}
  }
  return { kind: "skills-cli", command: "npx skills update" };
}

export async function latest(source, { cacheDir = homeDir(), fetcher = globalThis.fetch, ttlMs = 24 * 3600 * 1000, now = Date.now() } = {}) {
  const cache = path.join(cacheDir, "update-check.json");
  try {
    const c = JSON.parse(fs.readFileSync(cache, "utf8"));
    if (c.source === source && now - c.checkedAt < ttlMs) return { version: c.version, cached: true };
  } catch {}
  try {
    const r = await fetcher(`https://raw.githubusercontent.com/${source}/main/plugin.json`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const version = (await r.json()).version;
    if (!version) throw new Error("no version field");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cache, JSON.stringify({ source, version, checkedAt: now }) + "\n");
    return { version, cached: false };
  } catch (e) {
    return { version: null, error: e.message };
  }
}

export async function check(project, opts = {}) {
  const cfg = loadConfig(project).config;
  const installed = installedVersion();
  const policy = cfg.update?.policy || "ask";
  const source = cfg.update?.source || "agenticair/flow-state";
  const l = policy === "never" ? { version: null, skipped: true } : await latest(source, opts);
  const edits = editedFiles();
  const r = route();
  const available = l.version && installed !== "unknown" ? compare(installed, l.version) < 0 : null;
  return { installed, latest: l.version, latestError: l.error || null, cached: !!l.cached, policy, source, available, route: r, edited: edits.edited, missing: edits.missing, manifestKnown: edits.known };
}

function main(argv) {
  const get = (f, d) => {
    const i = argv.indexOf(f);
    return i === -1 ? d : argv[i + 1];
  };
  const project = path.resolve(get("--project", "."));
  const verb = argv.find((a) => !a.startsWith("--") && !["--project"].includes(argv[argv.indexOf(a) - 1]));
  return check(project).then((c) => {
    if (verb === "check" || !verb) {
      if (argv.includes("--json")) console.log(JSON.stringify(c, null, 2));
      else {
        console.log(`installed ${c.installed}; latest ${c.latest ?? (c.policy === "never" ? "not checked (update.policy never)" : `could not check (${c.latestError})`)}${c.cached ? " (cached)" : ""}`);
        if (c.available) console.log(`update available via: ${c.route.command}`);
        if (c.edited.length) console.log(`edited since install (an update would overwrite them; move changes to flow.config.json, repository rules, .flow/roles, or a fork):\n  ${c.edited.join("\n  ")}`);
      }
      return c.latest === null && c.policy !== "never" ? 3 : c.available ? 1 : 0;
    }
    if (verb === "run") {
      if (!argv.includes("--yes")) return usage();
      if (fs.existsSync(path.join(project, ".agent", "run.json"))) {
        console.error("refused: a build run is open (.agent/run.json); finish or abort it first");
        return 1;
      }
      if (c.edited.length) {
        console.error("refused: installed files were edited; an update would overwrite:\n  " + c.edited.join("\n  "));
        return 1;
      }
      console.log(`running: ${c.route.command}`);
      const r = spawnSync(c.route.command, { shell: true, stdio: "inherit", cwd: c.route.cwd || process.cwd() });
      return r.status ?? 1;
    }
    return usage();
  });
}

function usage() {
  console.error("usage: update.mjs check [--json] | run --yes   [--project <dir>]");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve(main(process.argv.slice(2))).then((code) => process.exit(code));
}
