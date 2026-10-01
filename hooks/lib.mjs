// Shared helpers for hook scripts. Each hook reads one JSON object on stdin and writes one on stdout.
// `--tool claude|codex|cursor` selects the output dialect; Claude and Codex share one.
// Guards fail closed: an unreadable input, an unreadable run file or an exception denies the call and says why.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function readInput() {
  const raw = fs.readFileSync(0, "utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw); // throws on garbage; a guard turns that into a deny
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

// The shell command a Bash/shell tool is about to run, across dialects.
export function commandOf(input) {
  const ti = input.tool_input || {};
  return String(ti.command || ti.cmd || input.command || "");
}

export function deny(reason) {
  if (toolFromArgv() === "cursor") respond({ permission: "deny", user_message: reason, agent_message: reason });
  else respond({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
}

export function allow() {
  if (toolFromArgv() === "cursor") respond({ permission: "allow" });
}

// Run a PreToolUse guard: decide(input) returns a reason to deny or null. Any failure denies (exit 2 for Claude Code and
// Codex, which treat it as a blocking error; a deny object for Cursor), never allows by accident.
export function guard(decide) {
  try {
    const input = readInput();
    const reason = decide(input);
    if (reason) deny(reason);
    else allow();
  } catch (e) {
    const reason = `hook could not decide (${e.message}); denied. Fix the input or the state file, or ask the human.`;
    if (toolFromArgv() === "cursor") deny(reason);
    else {
      process.stderr.write(reason + "\n");
      process.exit(2);
    }
  }
}
