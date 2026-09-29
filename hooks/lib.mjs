// Shared helpers for hook scripts. Each hook reads one JSON object on stdin and writes one on stdout.
// `--tool claude|codex|cursor` selects the output dialect; Claude and Codex share one.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function readInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function toolFromArgv(argv = process.argv.slice(2)) {
  const i = argv.indexOf("--tool");
  const t = i === -1 ? "claude" : argv[i + 1];
  return t === "codex" ? "claude" : t;
}

export function projectDir(input) {
  return (
    input.cwd ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.env.CURSOR_PROJECT_DIR ||
    (Array.isArray(input.workspace_roots) && input.workspace_roots[0]) ||
    process.cwd()
  );
}

export function stateDir(project) {
  let dir = ".agent";
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(project, "flow.config.json"), "utf8"));
    if (cfg?.state?.dir) dir = cfg.state.dir;
  } catch {}
  return path.resolve(project, dir);
}

export function git(project, args) {
  try {
    return execFileSync("git", args, { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function respond(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

// Path a Write/Edit tool is about to touch, across dialects.
export function targetPath(input) {
  const ti = input.tool_input || {};
  return ti.file_path || ti.path || ti.filePath || ti.target_file || ti.notebook_path || null;
}
