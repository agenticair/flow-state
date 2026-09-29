#!/usr/bin/env node
// Validates a judge verdict against the schema. A verdict that fails here is discarded, never interpreted.
// Usage: node verdict.mjs check <verdict.json>
// Exit: 0 valid, 2 usage, 3 invalid (reasons on stderr).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RULES = ["objective", "tdd-assertion", "contract", "closed-decisions", "patterns", "test-tampering", "fixture-theatre", "scope", "test-quality"];
export const OUTCOMES = ["holds", "n-a", "no-yardstick"];
export const SEVERITIES = ["high", "medium", "low"];
export const HIGH_ALLOWED = ["objective", "contract", "closed-decisions", "test-tampering", "fixture-theatre"];

export function validate(v) {
  const errors = [];
  if (!v || typeof v !== "object") return ["verdict is not an object"];
  if (!["PASS", "FAIL"].includes(v.ruling)) errors.push(`ruling must be PASS or FAIL, got ${JSON.stringify(v.ruling)}`);
  if (!Array.isArray(v.rubric)) errors.push("rubric must be an array");
  else {
    const seen = new Set();
    for (const row of v.rubric) {
      if (!RULES.includes(row?.rule)) errors.push(`rubric: unknown rule ${JSON.stringify(row?.rule)}`);
      else if (seen.has(row.rule)) errors.push(`rubric: rule ${row.rule} repeated`);
      else seen.add(row.rule);
      if (!row?.result || typeof row.result !== "string") errors.push(`rubric ${row?.rule}: result must be a non-empty string`);
      if (!OUTCOMES.includes(row?.outcome)) errors.push(`rubric ${row?.rule}: outcome must be one of ${OUTCOMES.join(", ")}`);
    }
    for (const r of RULES) if (!seen.has(r)) errors.push(`rubric: rule ${r} missing`);
  }
  if (!Array.isArray(v.findings)) errors.push("findings must be an array");
  else {
    v.findings.forEach((f, i) => {
      if (!RULES.includes(f?.rule)) errors.push(`finding ${i}: unknown rule ${JSON.stringify(f?.rule)}`);
      if (!SEVERITIES.includes(f?.severity)) errors.push(`finding ${i}: severity must be one of ${SEVERITIES.join(", ")}`);
      if (f?.severity === "high" && !HIGH_ALLOWED.includes(f?.rule)) errors.push(`finding ${i}: rule ${f.rule} may not be high`);
      for (const k of ["what", "path", "evidence"]) if (!f?.[k] || typeof f[k] !== "string") errors.push(`finding ${i}: ${k} must be a non-empty string`);
      if (!(f?.line === null || Number.isInteger(f?.line))) errors.push(`finding ${i}: line must be an integer or null`);
    });
    if (v.ruling === "PASS" && v.findings.some((f) => f?.severity === "high")) errors.push("PASS with a high finding is contradictory");
    if (v.ruling === "FAIL" && !v.findings.some((f) => f?.severity === "high")) errors.push("FAIL needs at least one high finding");
  }
  return errors;
}

export function outcomeOf(v) {
  if (v.ruling === "FAIL") return "failed";
  return v.findings.some((f) => f.severity === "medium") ? "corrections" : "done";
}

function main(argv) {
  const [cmd, file] = argv;
  if (cmd !== "check" || !file) {
    console.error("usage: verdict.mjs check <verdict.json>");
    return 2;
  }
  let v;
  try {
    v = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  } catch (e) {
    console.error(`cannot read verdict: ${e.message}`);
    return 3;
  }
  const errors = validate(v);
  if (errors.length) {
    console.error("verdict discarded:\n  - " + errors.join("\n  - "));
    return 3;
  }
  console.log(`valid: ${v.ruling}, ${v.findings.length} finding(s), outcome ${outcomeOf(v)}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
