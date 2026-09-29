#!/usr/bin/env node
// PreToolUse guard: denies Write/Edit on a spec file whose header says `Status: FROZEN`.
// Changes to a frozen spec go to <spec>.changes.md; reopening is `spec.mjs unfreeze --yes` after the human agrees.
import fs from "node:fs";
import path from "node:path";
import { readInput, toolFromArgv, projectDir, respond, targetPath } from "./lib.mjs";

export function isFrozenSpec(filePath) {
  if (!filePath || !/\.md$/i.test(filePath) || !fs.existsSync(filePath)) return false;
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(4096);
  const n = fs.readSync(fd, buf, 0, 4096, 0);
  fs.closeSync(fd);
  const head = buf.toString("utf8", 0, n);
  return /^Status:\s*FROZEN\s*$/m.test(head);
}

export function decide(input) {
  const tool = input.tool_name || "";
  if (!/^(Write|Edit|MultiEdit|NotebookEdit)$/i.test(tool)) return null;
  const target = targetPath(input);
  if (!target) return null;
  const abs = path.isAbsolute(target) ? target : path.resolve(projectDir(input), target);
  if (!isFrozenSpec(abs)) return null;
  const changes = abs.replace(/\.md$/i, ".changes.md");
  return `${path.basename(abs)} is a frozen spec. Do not edit it. Append a dated entry to ${path.basename(changes)} instead, or ask the human to reopen the gate (spec.mjs unfreeze --yes).`;
}

const input = readInput();
const reason = decide(input);
if (reason) {
  if (toolFromArgv() === "cursor") respond({ permission: "deny", user_message: reason, agent_message: reason });
  else respond({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
} else if (toolFromArgv() === "cursor") {
  respond({ permission: "allow" });
}
