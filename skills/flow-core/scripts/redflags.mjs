#!/usr/bin/env node
// Scans story text for words that usually mean "this is two stories": coordination, sequence, scope creep, options, exceptions.
// Usage: node redflags.mjs --text "<text>" | node redflags.mjs < file   [--json]
// Exit 0 always; the count is the signal.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CATEGORIES = {
  coordination: ["and", "or"],
  action: ["manage", "handle", "process", "maintain", "administer", "support"],
  sequence: ["before", "after", "then", "while", "once", "first"],
  scope: ["including", "also", "additionally", "plus", "as well as"],
  option: ["optionally", "alternatively", "either"],
  exception: ["except", "unless", "however", "although", "but"],
};

export function scan(text) {
  const hits = {};
  let count = 0;
  for (const [cat, words] of Object.entries(CATEGORIES)) {
    for (const w of words) {
      const re = new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`, "gi");
      const n = (text.match(re) || []).length;
      if (n) {
        (hits[cat] ??= {})[w] = n;
        count += n;
      }
    }
  }
  return { count, hits };
}

function main(argv) {
  const json = argv.includes("--json");
  const i = argv.indexOf("--text");
  const text = i !== -1 ? argv[i + 1] ?? "" : fs.readFileSync(0, "utf8");
  const r = scan(text);
  if (json) console.log(JSON.stringify(r));
  else if (!r.count) console.log("no red flags");
  else {
    console.log(`${r.count} red flag(s)`);
    for (const [cat, words] of Object.entries(r.hits)) console.log(`  ${cat}: ${Object.entries(words).map(([w, n]) => `${w}×${n}`).join(", ")}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
