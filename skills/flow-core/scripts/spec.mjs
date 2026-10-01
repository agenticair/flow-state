#!/usr/bin/env node
// Deterministic checks on a Flow State spec file.
// Usage:
//   node spec.mjs score   <spec.md> [--json]   three dimensions and a gate
//   node spec.mjs summary <spec.md>            the freeze summary, at most fifteen lines
//   node spec.mjs check   <spec.md>            exit 0 if freezable, 4 with reasons otherwise
//   node spec.mjs freeze  <spec.md> --yes      check, then set Status: FROZEN, the date and who froze it
//   node spec.mjs unfreeze <spec.md> --yes     set Status: DRAFT again
// Exit codes: 0 ok, 2 usage, 3 file problem, 4 not freezable / already in that state.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PENDING = /\[⚠️ Pending[^\]]*\]/g;
const NEEDS = /\[NEEDS CLARIFICATION[^\]]*\]/g;
const TAG = /^(said|deduced|proposed)\b\s*:?/;

export function parseSpec(input) {
  const text = input.replace(/\r\n/g, "\n");
  const header = {};
  for (const key of ["Status", "Date", "Project", "Ticket", "Frozen"]) {
    const m = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(text);
    if (m) header[key] = m[1].trim();
  }
  const sections = {};
  const parts = text.split(/^## +/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const name = part.slice(0, nl).trim().toLowerCase();
    sections[name] = part.slice(nl + 1);
  }
  const hyp = sections["hypothesis"] || "";
  const field = (label) => {
    const m = new RegExp(`\\*\\*${label}:\\*\\*[ \\t]*(.*)`).exec(hyp);
    return m ? m[1].trim() : "";
  };
  const decisions = tableRows(sections["frozen decisions"] || "").map((cells) => ({
    id: cells[0],
    decision: cells[1] || "",
    provenance: cells[2] || "",
    tag: (TAG.exec(cells[2] || "") || [])[1] || null,
  }));
  const parked = tableRows(sections["parked"] || "");
  const context = (sections["context for the builder"] || "")
    .split("\n")
    .filter((l) => l.trim() && !/^<!--/.test(l.trim()));
  return {
    header,
    bet: field("Bet"),
    failure: field("We would know it failed if"),
    measure: field("Measure"),
    antiScope: field("Anti-scope"),
    decisions,
    parked,
    context,
    needs: (text.match(NEEDS) || []).length,
    pending: (text.match(PENDING) || []).length,
  };
}

function tableRows(section) {
  return section
    .split("\n")
    .filter((l) => /^\|/.test(l.trim()))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .filter((cells) => cells.length >= 2 && !/^-+$/.test(cells[0]) && !/^#$/.test(cells[0]));
}

const blank = (s) => !s || /^<.*>$/.test(s);
const unfilled = (s) => blank(s) || /^\[⚠️ Pending/.test(s);
const SAID_FULL = /("[^"]+"|“[^”]+”)\s*\([^,)]+,\s*\d{4}-\d{2}-\d{2}\)/;
const DEDUCED_FROM = /deduced\s*:?\s*from\b/i;

export function score(spec) {
  const d1 = (unfilled(spec.bet) ? 0 : 4) + (unfilled(spec.failure) ? 0 : 3) + (unfilled(spec.antiScope) ? 0 : 3);

  const rows = spec.decisions.filter((d) => !unfilled(d.decision));
  const allTagged = rows.length > 0 && rows.every((d) => d.tag);
  const noProposed = rows.every((d) => d.tag !== "proposed");
  const saidQuoted = rows.filter((d) => d.tag === "said").every((d) => /"[^"]+"|“[^”]+”/.test(d.provenance));
  const d2 = (rows.length ? 2 : 0) + (allTagged ? 4 : 0) + (rows.length && noProposed ? 2 : 0) + (rows.length && saidQuoted ? 2 : 0);

  const contextLines = spec.context.filter((l) => !/^<.*>$/.test(l.trim()) && !/^-\s*<.*>$/.test(l.trim()));
  const nonBullet = contextLines.filter((l) => !/^(\s*[-*]|\s*\*\*|```|\s*$)/.test(l)).length;
  let d3 = 10 - 2 * spec.needs - spec.pending - (contextLines.length ? 0 : 3) - (nonBullet ? 1 : 0);
  d3 = Math.max(0, Math.min(10, d3));

  const proposedFrozen = rows.filter((d) => d.tag === "proposed").map((d) => d.id);
  const total = Math.round(((d1 + d2 + d3) / 3) * 10) / 10;
  let gate = total < 5 ? "FAIL" : total < 7 ? "CONDITIONAL" : "PASS";
  const reasons = [];
  if (spec.needs) reasons.push(`${spec.needs} [NEEDS CLARIFICATION] remaining`);
  if (proposedFrozen.length) reasons.push(`proposed decision(s) in the frozen table: ${proposedFrozen.join(", ")}`);
  if (rows.length && !allTagged) reasons.push("a frozen decision has no provenance tag");
  if (!rows.length) reasons.push("no frozen decisions");
  if (unfilled(spec.bet)) reasons.push("bet is empty");
  if (unfilled(spec.antiScope)) reasons.push("anti-scope is empty");
  if (blank(spec.failure)) reasons.push("failure signal is empty");
  if (blank(spec.measure)) reasons.push("measure is empty");
  for (const d of rows) {
    if (d.tag === "said" && !SAID_FULL.test(d.provenance)) reasons.push(`${d.id} said without a quote and (who, date)`);
    if (d.tag === "deduced" && !DEDUCED_FROM.test(d.provenance)) reasons.push(`${d.id} deduced without a source`);
  }
  if (/^\[⚠️ Pending/.test(spec.header.Ticket || "")) reasons.push("ticket not readable");
  if (spec.needs || proposedFrozen.length) gate = "FAIL";
  return { d1, d2, d3, total, gate, reasons, decisions: rows.length, pending: spec.pending };
}

export function summary(spec) {
  const lines = [];
  lines.push(`Bet: ${spec.bet || "(empty)"}`);
  lines.push(`Fails if: ${spec.failure || "(empty)"}`);
  lines.push(`Measure: ${spec.measure && !unfilled(spec.measure) ? spec.measure : "(empty)"}`);
  lines.push(`Anti-scope: ${spec.antiScope || "(empty)"}`);
  for (const d of spec.decisions.filter((d) => !unfilled(d.decision))) lines.push(`${d.id} ${d.decision} [${d.provenance || "UNTAGGED"}]`);
  const bullets = spec.context.filter((l) => /^\s*[-*]\s/.test(l) && !/^\s*[-*]\s*<.*>$/.test(l.trim()));
  lines.push(`Context for the builder: ${bullets.length} bullets; read that section before freezing`);
  if (lines.length + bullets.length <= 15) for (const b of bullets) lines.push(`  ${b.trim()}`);
  return lines;
}

export function freezable(spec) {
  const s = score(spec);
  const blocking = s.reasons.filter((r) =>
    /NEEDS CLARIFICATION|proposed|no provenance|no frozen|bet is empty|anti-scope|failure signal is empty|measure is empty|said without|deduced without|ticket not readable/.test(r)
  );
  return { ok: blocking.length === 0 && s.gate !== "FAIL", reasons: blocking, score: s };
}

export function setStatus(text, status, date, by) {
  let t = text.replace(/\r\n/g, "\n").replace(/^Status:\s*.*$/m, `Status: ${status}`);
  t = t.replace(/^Frozen:.*\n/m, "").replace(/^Frozen by:.*\n/m, "");
  if (status === "FROZEN") t = t.replace(/^(Status: FROZEN)$/m, `$1\nFrozen: ${date}${by ? `\nFrozen by: ${by}` : ""}`);
  return t;
}

function gitUser(cwd) {
  try {
    return execFileSync("git", ["config", "user.name"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function main(argv) {
  const [cmd, file, ...rest] = argv;
  if (!cmd || !file) return usage();
  const p = path.resolve(file);
  if (!fs.existsSync(p)) {
    console.error(`no such file: ${p}`);
    return 3;
  }
  const text = fs.readFileSync(p, "utf8");
  const spec = parseSpec(text);
  const today = new Date().toISOString().slice(0, 10);
  switch (cmd) {
    case "score": {
      const s = score(spec);
      if (rest.includes("--json")) console.log(JSON.stringify(s, null, 2));
      else {
        console.log(`D1 hypothesis   ${s.d1}/10`);
        console.log(`D2 decisions    ${s.d2}/10  (${s.decisions} frozen)`);
        console.log(`D3 clarity      ${s.d3}/10  (${spec.needs} needs-clarification, ${s.pending} pending)`);
        console.log(`Score ${s.total}  Gate: ${s.gate}`);
        for (const r of s.reasons) console.log(`  - ${r}`);
      }
      return 0;
    }
    case "summary": {
      const lines = summary(spec);
      console.log(lines.join("\n"));
      if (lines.length > 15) console.error(`warning: ${lines.length} lines; the freeze summary should fit in 15. Merge or park decisions.`);
      return 0;
    }
    case "check": {
      const f = freezable(spec);
      if (f.ok) {
        console.log(`freezable (score ${f.score.total}, ${f.score.gate})`);
        return 0;
      }
      console.error("not freezable:\n  - " + f.reasons.join("\n  - "));
      return 4;
    }
    case "freeze": {
      if (!rest.includes("--yes")) {
        console.error("freeze is a human gate; pass --yes only after the human replied `freeze`");
        return 2;
      }
      if (spec.header.Status === "FROZEN") {
        console.error("already frozen");
        return 4;
      }
      const f = freezable(spec);
      if (!f.ok) {
        console.error("not freezable:\n  - " + f.reasons.join("\n  - "));
        return 4;
      }
      fs.writeFileSync(p, setStatus(text, "FROZEN", today, gitUser(path.dirname(p))));
      console.log(`frozen ${path.basename(p)} on ${today} (score ${f.score.total})`);
      return 0;
    }
    case "unfreeze": {
      if (!rest.includes("--yes")) {
        console.error("unfreeze needs --yes; this reopens a human gate");
        return 2;
      }
      if (spec.header.Status !== "FROZEN") {
        console.error("not frozen");
        return 4;
      }
      fs.writeFileSync(p, setStatus(text, "DRAFT", today));
      console.log(`unfrozen ${path.basename(p)}`);
      return 0;
    }
    default:
      return usage();
  }
}

function usage() {
  console.error("usage: spec.mjs score|summary|check <spec.md> [--json] | freeze|unfreeze <spec.md> --yes");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
