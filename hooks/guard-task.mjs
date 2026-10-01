#!/usr/bin/env node
// PreToolUse guard on subagent dispatch: while a build run is open, flow-builder and flow-judge may only be dispatched
// for the step that `step.mjs next` prepared (the seal). This is what stops a compacted or confused session from
// launching a builder without a brief, or a judge without a package. An unreadable run file denies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guard, projectDir, stateDir } from "./lib.mjs";

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
    return `The build run file ${runFile} is unreadable; no builder or judge is dispatched until it is repaired or discarded (node <flow-core>/scripts/step.mjs abort --yes).`;
  }
  if (run.step === "delivered") return null; // a finished run lingers for flow-review; it seals nothing
  const expected = `${run.task}:${role}:${run.attempt}`;
  if (run.seal === expected) return null;
  return `A build run is open (task ${run.task}/${run.tasksTotal}, step ${run.step}) and this dispatch is not the prepared step. Run: node <flow-core>/scripts/step.mjs next  and dispatch exactly what it prints.`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) guard(decide);
