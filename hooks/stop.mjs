#!/usr/bin/env node
// Stop: when a feature is in flight and HEAD moved past the recorded last_commit, ask for the state file to be updated
// before the turn ends. Claude/Codex: a blocking decision (once; stop_hook_active breaks the loop).
// Cursor cannot block a stop, so it sends one follow-up message (loop_count 0 only).
import fs from "node:fs";
import path from "node:path";
import { readInput, toolFromArgv, projectDir, stateDir, git, respond } from "./lib.mjs";

export function check(project) {
  const stateFile = path.join(stateDir(project), "STATE.md");
  if (!fs.existsSync(stateFile)) return null;
  const text = fs.readFileSync(stateFile, "utf8");
  const stage = (/^stage:\s*(.*)$/m.exec(text) || [])[1]?.trim();
  const last = (/^last_commit:\s*(.*)$/m.exec(text) || [])[1]?.trim();
  if (!stage || stage === "idle" || !last || last === "none") return null;
  const head = git(project, ["rev-parse", "HEAD"]);
  if (!head || head.startsWith(last)) return null;
  const ahead = git(project, ["rev-list", "--count", `${last}..HEAD`]);
  if (ahead === "" || ahead === "0") return null;
  return `HEAD is ${ahead} commit(s) past last_commit in .agent/STATE.md. Before stopping, record where the work is: node <flow-core>/scripts/state.mjs set last_commit=${head.slice(0, 12)} stage=<stage> and add a note. Then stop.`;
}

const input = readInput();
const tool = toolFromArgv();
const reason = check(projectDir(input));
if (reason) {
  if (tool === "cursor") {
    if (!input.loop_count) respond({ followup_message: reason });
  } else if (!input.stop_hook_active) {
    respond({ decision: "block", reason });
  }
}
