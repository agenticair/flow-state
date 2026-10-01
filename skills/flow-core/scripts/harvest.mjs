#!/usr/bin/env node
// Harvests a spec's build evidence from what is committed: verdict files, git trailers, story statuses.
// Nothing is typed by hand; a number that is not here is not in the retro.
// Usage: node harvest.mjs --spec <spec.md> [--project <dir>] [--json]
// Exit: 0 ok, 2 usage, 3 spec or folder missing.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function parseVerdictName(name) {
  const m = /^(.*?)-task-(\d+)(?:-attempt-(\d+))?\.json$/.exec(name);
  if (!m) return null;
  const plan = m[1];
  const story = (/^(\d+)/.exec(plan) || [])[1] || plan;
  return { plan, story, task: Number(m[2]), attempt: m[3] ? Number(m[3]) : 1, patch: /\.patch-\d+$/.test(plan) };
}

export function harvest(project, specFile) {
  const specAbs = path.resolve(project, specFile);
  if (!fs.existsSync(specAbs)) throw new Error(`no such spec: ${specFile}`);
  const specDir = specAbs.replace(/\.md$/, "");
  const vdir = path.join(specDir, "verdicts");
  const sdir = path.join(specDir, "stories");
  const stories = {};
  const story = (id) => (stories[id] ??= { id, status: "?", tasks: new Set(), attempts: 0, corrections: 0, pass: 0, fail: 0, findings: { high: 0, medium: 0, low: 0 }, byRule: {}, rubric: { holds: 0, "n-a": 0, "no-yardstick": 0 }, commits: [], first: null, last: null, patches: new Set() });

  if (fs.existsSync(sdir)) {
    for (const f of fs.readdirSync(sdir).filter((f) => f.endsWith(".md")).sort()) {
      const id = (/^(\d+)/.exec(f) || [])[1] || f;
      const text = fs.readFileSync(path.join(sdir, f), "utf8");
      story(id).status = (/^Status:\s*(.*)$/m.exec(text) || [, "?"])[1].trim();
      story(id).name = f.replace(/\.md$/, "");
    }
  }
  if (fs.existsSync(vdir)) {
    for (const f of fs.readdirSync(vdir).filter((f) => f.endsWith(".json")).sort()) {
      const meta = parseVerdictName(f);
      if (!meta) continue;
      let v;
      try {
        v = JSON.parse(fs.readFileSync(path.join(vdir, f), "utf8"));
      } catch {
        continue;
      }
      const s = story(meta.story);
      s.tasks.add(`${meta.plan}#${meta.task}`);
      s.attempts += 1;
      if (meta.attempt > 1) s.corrections += 1;
      if (meta.patch) s.patches.add(meta.plan);
      if (v.ruling === "PASS") s.pass += 1;
      else s.fail += 1;
      for (const fnd of v.findings || []) {
        if (fnd.severity in s.findings) s.findings[fnd.severity] += 1;
        s.byRule[fnd.rule] = (s.byRule[fnd.rule] || 0) + 1;
      }
      for (const row of v.rubric || []) if (row.outcome in s.rubric) s.rubric[row.outcome] += 1;
    }
  }
  let log = "";
  try {
    log = execFileSync("git", ["log", "--format=%H%x09%cI%x09%s%x09%(trailers:key=Flow-State,valueonly)"], { cwd: project, encoding: "utf8" });
  } catch {}
  for (const line of log.split("\n").filter(Boolean)) {
    const [sha, date, subject, trailer] = line.split("\t");
    const m = /^(\d+)[^#]*#(\d+)/.exec(trailer || "");
    if (!m) continue;
    const s = story(m[1]);
    s.commits.push({ sha: sha.slice(0, 7), date, subject });
    if (!s.last) s.last = date;
    s.first = date;
  }
  const rows = Object.values(stories)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      ...s,
      tasks: s.tasks.size,
      patches: s.patches.size,
      hours: s.first && s.last ? Math.round(((new Date(s.last) - new Date(s.first)) / 36e5) * 10) / 10 : null,
    }));
  const total = rows.reduce(
    (t, s) => ({
      stories: t.stories + 1, done: t.done + (s.status === "done" ? 1 : 0), tasks: t.tasks + s.tasks, attempts: t.attempts + s.attempts, corrections: t.corrections + s.corrections,
      pass: t.pass + s.pass, fail: t.fail + s.fail, high: t.high + s.findings.high, medium: t.medium + s.findings.medium, low: t.low + s.findings.low, commits: t.commits + s.commits.length, patches: t.patches + s.patches,
    }),
    { stories: 0, done: 0, tasks: 0, attempts: 0, corrections: 0, pass: 0, fail: 0, high: 0, medium: 0, low: 0, commits: 0, patches: 0 },
  );
  return { spec: specFile, stories: rows, total };
}

export function table(h) {
  const lines = [];
  lines.push("| story | status | tasks | attempts | corrections | patch plans | PASS/FAIL | high/med/low | commits | hours |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const s of h.stories) lines.push(`| ${s.name || s.id} | ${s.status} | ${s.tasks} | ${s.attempts} | ${s.corrections} | ${s.patches} | ${s.pass}/${s.fail} | ${s.findings.high}/${s.findings.medium}/${s.findings.low} | ${s.commits.length} | ${s.hours ?? "—"} |`);
  const t = h.total;
  lines.push(`| **total** | ${t.done}/${t.stories} done | ${t.tasks} | ${t.attempts} | ${t.corrections} | ${t.patches} | ${t.pass}/${t.fail} | ${t.high}/${t.medium}/${t.low} | ${t.commits} | — |`);
  const rules = {};
  for (const s of h.stories) for (const [r, n] of Object.entries(s.byRule)) rules[r] = (rules[r] || 0) + n;
  if (Object.keys(rules).length) lines.push("", "Findings by rule: " + Object.entries(rules).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(", "));
  return lines.join("\n");
}

function main(argv) {
  const get = (f, d) => {
    const i = argv.indexOf(f);
    return i === -1 ? d : argv[i + 1];
  };
  const spec = get("--spec");
  if (!spec) {
    console.error("usage: harvest.mjs --spec <spec.md> [--project <dir>] [--json]");
    return 2;
  }
  let h;
  try {
    h = harvest(path.resolve(get("--project", ".")), spec);
  } catch (e) {
    console.error(e.message);
    return 3;
  }
  console.log(argv.includes("--json") ? JSON.stringify(h, (k, v) => (v instanceof Set ? [...v] : v), 2) : table(h));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
