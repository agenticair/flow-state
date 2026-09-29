#!/usr/bin/env node
// PreToolUse guard on subagent dispatch: while a build run is open, flow-builder and flow-judge may only be dispatched
// for the step that `step.mjs next` prepared (the seal). This is what stops a compacted or confused session from
// launching a builder without a brief, or a judge without a package.
import fs from "node:fs";
import path from "node:path";
import { readInput, toolFromArgv, projectDir, stateDir, respond } from "./lib.mjs";

export function decide(input) {
  if (!/^(Task|Agent)$/i.test(input.tool_name || "")) return null;
  const ti = input.tool_input || {};
  const who = String(ti.subagent_type || ti.agent || ti.name || ti.description || "");
  const role = /flow-builder/.test(who) ? "implement" : /flow-judge/.test(who) ? "judge" : null;
  if (!role) return null;
  const runFile = path.join(stateDir(projectDir(input)), "run.json");
  if (!fs.existsSync(runFile)) return null;
  let run;
  try {
    run = JSON.parse(fs.readFileSync(runFile, "utf8"));
  } catch {
    return null;
  }
  const expected = `${run.task}:${role}:${run.attempt}`;
  if (run.seal === expected) return null;
  return `A build run is open (task ${run.task}/${run.tasksTotal}, step ${run.step}) and this dispatch is not the prepared step. Run: node <flow-core>/scripts/step.mjs next  and dispatch exactly what it prints.`;
}

const input = readInput();
const reason = decide(input);
if (reason) {
  if (toolFromArgv() === "cursor") respond({ permission: "deny", user_message: reason, agent_message: reason });
  else respond({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
} else if (toolFromArgv() === "cursor") {
  respond({ permission: "allow" });
}
