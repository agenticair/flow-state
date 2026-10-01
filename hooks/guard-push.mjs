#!/usr/bin/env node
// PreToolUse guard on shell commands: while a build run is open (.agent/run.json exists), nothing leaves the machine.
// `git push`, `gh pr create|merge|ready`, `gh pr review --approve`, `gh api` writes and `gh release create` are denied until the run is delivered or aborted
// (a quoted "git push" inside another command is refused too: failing closed is the right side);
// flow ship then asks the human for the word (GR-5). Outside a run the hook is silent: the gates there are the human's word.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guard, projectDir, stateDir, commandOf } from "./lib.mjs";

export const EXTERNAL = /\bgit\s+(?:[^\s|;&]+\s+)*push\b|\bgh\s+pr\s+(?:create|merge|ready)\b|\bgh\s+pr\s+review\b[^|;&]*(?:--approve\b|\s-a\b)|\bgh\s+api\b[^|;&]*(?:(?:-X|--method)[\s=]*(?:POST|PUT|PATCH|DELETE)\b|\s-[fF]\b|--(?:field|raw-field|input)\b)|\bgh\s+release\s+create\b/i;

export function decide(input) {
  if (!/^(Bash|Shell|shell|run_shell_command)$/i.test(input.tool_name || "")) return null;
  const cmd = commandOf(input);
  if (!EXTERNAL.test(cmd)) return null;
  const runFile = path.join(stateDir(projectDir(input)), "run.json");
  if (!fs.existsSync(runFile)) return null;
  let run;
  try {
    run = JSON.parse(fs.readFileSync(runFile, "utf8"));
  } catch {
    return `The build run file ${runFile} is unreadable; nothing leaves the machine until it is repaired or discarded (step.mjs abort --yes). Command refused: ${cmd.slice(0, 120)}`;
  }
  if (run.step === "delivered") return null; // delivered: flow ship owns the next external effect, behind the human's word
  return `A build run is open (${runFile}); nothing is pushed, opened, merged or approved until it is delivered or aborted and the human says the word at the gate. Command refused: ${cmd.slice(0, 120)}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) guard(decide);
