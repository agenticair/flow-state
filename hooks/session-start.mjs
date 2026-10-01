#!/usr/bin/env node
// SessionStart: when the project has a Flow State state file, inject it, the current run (if any) and the last five commits.
// Projects without .agent/STATE.md get nothing; the hook is silent there.
import fs from "node:fs";
import path from "node:path";
import { readInput, toolFromArgv, projectDir, stateDir, git, respond } from "./lib.mjs";

export function hydration(project) {
  const dir = stateDir(project);
  const stateFile = path.join(dir, "STATE.md");
  if (!fs.existsSync(stateFile)) return null;
  const parts = ["# Flow State (hydrated at session start)", "", "## .agent/STATE.md", fs.readFileSync(stateFile, "utf8").trim()];
  const run = path.join(dir, "run.json");
  if (fs.existsSync(run)) parts.push("", "## .agent/run.json", fs.readFileSync(run, "utf8").trim());
  const log = git(project, ["log", "--oneline", "-5"]);
  if (log) parts.push("", "## last commits", log);
  parts.push("", "The stage on disk beats anything remembered. Invoke `flow` to route.");
  return parts.join("\n");
}

let input = {};
try {
  input = readInput();
} catch {}
const ctx = hydration(projectDir(input));
if (ctx) {
  if (toolFromArgv() === "cursor") respond({ additional_context: ctx });
  else respond({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } });
}
