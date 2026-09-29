#!/usr/bin/env node
// Deterministic six-dimension score for a Flow State story file. A lite yardstick: it measures shape, not substance;
// the fresh reviewer judges substance.
// Usage: node score_story.mjs <story.md> [--json]
// Exit: 0 ok, 2 usage, 3 file problem.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "./redflags.mjs";

const unfilled = (s) => !s || /^<.*>$/.test(s.trim());

export function parseStory(input) {
  const text = input.replace(/\r\n/g, "\n");
  const header = {};
  for (const key of ["Status", "Spec", "Type", "Area", "Gate", "Signal", "Dep"]) {
    const m = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(text);
    header[key] = m ? m[1].trim() : "";
  }
  const sections = {};
  for (const part of text.split(/^## +/m).slice(1)) {
    const nl = part.indexOf("\n");
    sections[part.slice(0, nl).trim().toLowerCase()] = part.slice(nl + 1);
  }
  const bullets = (s) =>
    (s || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+/.test(l) && !/<[^>]+>/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, ""));
  const delivers = (sections["delivers"] || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("<!--"))
    .join(" ");
  const title = (/^# +(.*)$/m.exec(text) || [])[1] || "";
  return { title, header, delivers: unfilled(delivers) ? "" : delivers, accepts: bullets(sections["accepts"]), protected: bullets(sections["protected"]), notes: bullets(sections["notes for the builder"]) };
}

export function score(story) {
  const h = story.header;
  const accepts = story.accepts;
  const gwt = accepts.filter((a) => /\bgiven\b.*\bwhen\b.*\bthen\b/i.test(a) || /\b(returns|renders|shows|rejects|contains|redirects|is|are|has|have)\b/i.test(a)).length;

  const d1 = (story.delivers ? 4 : 0) + (accepts.length ? 3 : 0) + (accepts.length && gwt === accepts.length ? 3 : accepts.length && gwt ? 1 : 0); // clarity
  const d2 = !h.Dep || /^none$/i.test(h.Dep) ? 10 : 6; // independence
  const d3 = (story.delivers ? 5 : 0) + (h.Signal && !/^n\/a\s*$/i.test(h.Signal) && !unfilled(h.Signal) ? 5 : /^n\/a\s*[—-]/i.test(h.Signal) ? 3 : 0); // value
  const d4 = (h.Type && !unfilled(h.Type) ? 3 : 0) + (h.Area && !unfilled(h.Area) ? 3 : 0) + (story.protected.length ? 4 : 0); // estimability
  const d5 = accepts.length === 0 ? 0 : accepts.length <= 7 ? 10 : Math.max(0, 10 - 2 * (accepts.length - 7)); // testability
  // Red flags are read from the title and Delivers only: Given/When/Then criteria legitimately use "when", "then" and "and".
  const flags = scan([story.title, story.delivers].join("\n")).count;
  const d6 = Math.max(0, 10 - 2 * flags - Math.max(0, accepts.length - 5)); // survivable size

  const dims = { clarity: d1, independence: d2, value: d3, estimability: d4, testability: d5, size: d6 };
  const total = Math.round((Object.values(dims).reduce((a, b) => a + b, 0) / 6) * 10) / 10;
  const band = total < 5 ? "rework" : total < 7 ? "refine or split" : total < 9 ? "proceed with notes" : "proceed";
  const notes = [];
  if (!story.delivers) notes.push("Delivers is empty");
  if (!accepts.length) notes.push("no acceptance criteria");
  if (accepts.length && gwt < accepts.length) notes.push(`${accepts.length - gwt} acceptance line(s) read as actions, not postconditions`);
  if (accepts.length > 7) notes.push("more than seven acceptance criteria: split");
  if (flags) notes.push(`${flags} red-flag word(s) in the title or Delivers: consider splitting`);
  if (!story.protected.length) notes.push("Protected is empty: the builder has no out-of-scope list");
  if (unfilled(h.Signal) || !h.Signal) notes.push("Signal is empty: say what becomes observable, or N/A — reason");
  return { dims, total, band, flags, notes };
}

function main(argv) {
  const [file, ...rest] = argv;
  if (!file) {
    console.error("usage: score_story.mjs <story.md> [--json]");
    return 2;
  }
  const p = path.resolve(file);
  if (!fs.existsSync(p)) {
    console.error(`no such file: ${p}`);
    return 3;
  }
  const s = score(parseStory(fs.readFileSync(p, "utf8")));
  if (rest.includes("--json")) console.log(JSON.stringify(s, null, 2));
  else {
    for (const [k, v] of Object.entries(s.dims)) console.log(`${k.padEnd(13)} ${v}/10`);
    console.log(`Score ${s.total}  ${s.band}`);
    for (const n of s.notes) console.log(`  - ${n}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
