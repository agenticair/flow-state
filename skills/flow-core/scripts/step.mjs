#!/usr/bin/env node
// The build step machine. A pure transition table over .agent/run.json decides what comes next; the session asks it and obeys.
//
//   node step.mjs init --plan <plan.md> --story <story.md> --spec <spec.md> [--dir .agent]
//   node step.mjs next [--json]         what to do now; writes the task brief (implement) and sets the dispatch seal
//   node step.mjs report <report.json>  the builder's report: {paths[], summary, noticed[]}
//   node step.mjs controls              scope, TDD presence, verification predicates; exit code only
//   node step.mjs package               stage the reported paths, write the review package with the diff hash, seal the tree
//   node step.mjs verdict <verdict.json> validate, check the hash, route: commit | implement again | blocked
//   node step.mjs commit                commit exactly the sealed tree plus the verdict; advance to the next task
//   node step.mjs status | abort --yes
//
// Steps: implement -> controls -> package -> judge -> commit -> (next task | delivered). Any verb not for the current step exits 9.
// Exit codes: 0 ok · 2 usage · 3 verdict discarded · 4 controls red · 5 tree changed after seal · 6 plan invalid · 8 precondition · 9 wrong step · 10 blocked
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseSpec } from "./spec.mjs";
import { parseStory } from "./score_story.mjs";
import { validate as validateVerdict, outcomeOf } from "./verdict.mjs";
import * as state from "./state.mjs";
import { collect as collectRules } from "./rules.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CONVENTIONS = path.join(here, "..", "conventions");
export const STEPS = ["implement", "controls", "package", "judge", "commit"];
export const BUDGET = { controls: 2, judge: 2 };

// ---------- plan ----------
export function parsePlan(input) {
  const text = input.replace(/\r\n/g, "\n");
  const tasks = [];
  const parts = text.split(/^## Task (\d+):\s*/m);
  for (let i = 1; i < parts.length; i += 2) {
    const n = Number(parts[i]);
    const body = parts[i + 1];
    const name = body.slice(0, body.indexOf("\n")).trim();
    const objective = (/\*\*Objective:\*\*\s*(.*)/.exec(body) || [])[1]?.trim() || "";
    const files = [];
    const filesBlock = (/\*\*Files:\*\*\n([\s\S]*?)(?:\n\*\*|\n## |$)/.exec(body) || [])[1] || "";
    for (const line of filesBlock.split("\n")) {
      const m = /^\s*[-*]\s*(create|modify)\s*:\s*(.+?)\s*$/.exec(line);
      if (m) files.push({ mode: m[1], path: m[2].replace(/`/g, "") });
    }
    const tdd = (/\*\*TDD:\*\*\s*(.*)/.exec(body) || [])[1]?.trim().replace(/^`|`$/g, "") || "";
    const ver = (/\*\*Verification:\*\*\s*\n```[a-z]*\n([\s\S]*?)```/.exec(body) || [])[1] || "";
    const verification = ver
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !/^<.*>$/.test(l));
    tasks.push({ n, name, objective, files, tdd, verification });
  }
  const problems = [];
  if (!tasks.length) problems.push("no tasks found (expected '## Task N: name')");
  tasks.forEach((t, i) => {
    if (t.n !== i + 1) problems.push(`task numbering: expected ${i + 1}, found ${t.n}`);
    if (!t.objective) problems.push(`task ${t.n}: missing **Objective:**`);
    if (!t.files.length) problems.push(`task ${t.n}: missing **Files:** (create:/modify: lines)`);
    if (!t.tdd) problems.push(`task ${t.n}: missing **TDD:**`);
    if (!t.verification.length) problems.push(`task ${t.n}: missing **Verification:** commands`);
  });
  return { tasks, problems };
}

// ---------- machine ----------
export function advance(run, outcome, budget = BUDGET) {
  const r = structuredClone(run);
  const fail = (why) => {
    r.step = "blocked";
    r.blocked = why;
    r.seal = null;
    return r;
  };
  switch (`${r.step}:${outcome}`) {
    case "implement:reported":
      r.step = "controls";
      r.seal = null;
      return r;
    case "controls:done":
      r.step = "package";
      return r;
    case "controls:failed":
      r.retries.controls += 1;
      if (r.retries.controls > budget.controls) return fail(`controls red ${r.retries.controls} times on task ${r.task}`);
      r.step = "implement";
      r.attempt += 1;
      return r;
    case "package:done":
      r.step = "judge";
      return r;
    case "judge:done":
      r.step = "commit";
      r.seal = null;
      return r;
    case "judge:corrections":
    case "judge:failed":
      r.retries.judge += 1;
      if (r.retries.judge > budget.judge) {
        if (outcome === "corrections") {
          r.step = "commit";
          r.seal = null;
          r.notes.push(`task ${r.task}: correction budget spent; committed with medium findings recorded`);
          return r;
        }
        return fail(`judge failed the task ${r.retries.judge} times on task ${r.task}`);
      }
      r.step = "implement";
      r.attempt += 1;
      return r;
    case "judge:discarded":
      return r;
    case "commit:done":
      if (r.task >= r.tasksTotal) {
        r.step = "delivered";
        r.seal = null;
        return r;
      }
      r.task += 1;
      r.attempt = 1;
      r.retries = { controls: 0, judge: 0 };
      r.step = "implement";
      r.seal = null;
      r.lastFailure = null;
      r.lastFindings = null;
      r.verdictFiles = [];
      r.verdictFile = null;
      return r;
    default:
      throw new Error(`impossible transition ${r.step}:${outcome}`);
  }
}

// ---------- io ----------
function ctx(argv) {
  const get = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i === -1 ? dflt : argv[i + 1];
  };
  const project = path.resolve(get("--project", "."));
  const dir = path.resolve(project, get("--dir", ".agent"));
  return { project, dir, runFile: path.join(dir, "run.json"), workDir: path.join(dir, "run"), json: argv.includes("--json") };
}
const readRun = (c) => (fs.existsSync(c.runFile) ? JSON.parse(fs.readFileSync(c.runFile, "utf8")) : null);
const writeRun = (c, run) => {
  fs.mkdirSync(c.workDir, { recursive: true });
  fs.writeFileSync(c.runFile, JSON.stringify(run, null, 2) + "\n");
};
const git = (c, args, opts = {}) => execFileSync("git", args, { cwd: c.project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
const rel = (c, p) => path.relative(c.project, p).split(path.sep).join("/");
const taskOf = (run) => run.tasks[run.task - 1];
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "");
function existsAtBase(c, base, relPath) {
  try {
    execFileSync("git", ["cat-file", "-e", `${base}:${relPath}`], { cwd: c.project, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function wrongStep(run, wanted) {
  console.error(`wrong step: the run is at "${run.step}" (task ${run.task}/${run.tasksTotal}, attempt ${run.attempt}); this verb is for "${wanted}". Run: node step.mjs next`);
  return 9;
}

// ---------- brief ----------
export function composeBrief(run, task, spec, story, conventionsText, paths, rules = { text: "", files: [] }, roleNotes = "") {
  const lines = [];
  lines.push(`# Task ${task.n}/${run.tasksTotal}: ${task.name}`, "");
  lines.push(`Story: ${run.story}`, `Spec: ${run.spec}`, `Attempt: ${run.attempt}`, `Report to: ${paths.report}`, "");
  lines.push("## Objective", "", task.objective, "");
  lines.push("## Files", "", ...task.files.map((f) => `- ${f.mode}: ${f.path}`), "");
  lines.push("## TDD", "", `Write this test first and see it fail: \`${task.tdd}\``, "");
  lines.push("## Verification", "", "```sh", ...task.verification, "```", "");
  lines.push("## Closed decisions", "", ...(spec.decisions.length ? spec.decisions.map((d) => `- ${d.id} ${d.decision}`) : ["- none"]), "");
  lines.push("## Out of scope", "", ...(story.protected.length ? story.protected.map((p) => `- ${p}`) : []), ...(spec.antiScope ? [`- Anti-scope: ${spec.antiScope}`] : []), "");
  lines.push("## Context for the builder", "", ...spec.context, ...story.notes.map((n) => `- ${n}`), "");
  if (run.lastFailure) lines.push("## Previous attempt: controls", "", "```", run.lastFailure.trim(), "```", "");
  if (run.lastFindings) lines.push("## Previous attempt: judge findings", "", ...run.lastFindings.map((f) => `- [${f.severity}] ${f.rule} at ${f.path}:${f.line ?? "?"}: ${f.what}`), "");
  lines.push("## Repository rules", "", "These are the rules of the repository you are working in. They win over the Flow State conventions below, rule by rule. A linter that runs in Verification wins over both.", "");
  lines.push(rules.text || "(no repository rule files found)", "");
  if (roleNotes) lines.push("## Notes this project keeps for the builder", "", roleNotes.trim(), "");
  lines.push("## Flow State conventions", "", "Apply where the repository rules are silent.", "", conventionsText, "");
  lines.push("## Report", "", `When done, write JSON to \`${paths.report}\`:`, "", "```json", '{ "paths": ["<every file you created or modified>"], "summary": "<what changed and why>", "noticed": ["<out-of-scope things you did not touch>"] }', "```", "");
  return lines.join("\n");
}

// "Teach the agents": a project may keep notes per role under <roles.dir> (default .flow/roles/<role>.md).
function roleNotesPath(c, role) {
  let dir = ".flow/roles";
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(c.project, "flow.config.json"), "utf8"));
    if (cfg?.roles?.dir) dir = cfg.roles.dir;
  } catch {}
  const p = path.resolve(c.project, dir, `${role}.md`);
  return fs.existsSync(p) ? p : null;
}
function roleNotes(c, role) {
  const p = roleNotesPath(c, role);
  return p ? fs.readFileSync(p, "utf8") : "";
}

function conventionsText() {
  if (!fs.existsSync(CONVENTIONS)) return "(no conventions folder found)";
  return fs
    .readdirSync(CONVENTIONS)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => `### conventions/${f}\n\n${fs.readFileSync(path.join(CONVENTIONS, f), "utf8").trim()}`)
    .join("\n\n");
}

function workPaths(c, run) {
  const base = path.join(c.workDir, `task-${run.task}`);
  return { brief: `${base}-brief.md`, report: `${base}-report.json`, controls: `${base}-controls.log`, package: `${base}-package.md`, verdict: `${base}-verdict.json` };
}

// ---------- verbs ----------
function init(c, argv) {
  const get = (f) => {
    const i = argv.indexOf(f);
    return i === -1 ? null : argv[i + 1];
  };
  const plan = get("--plan"), story = get("--story"), spec = get("--spec");
  if (!plan || !story || !spec) return usage();
  if (readRun(c) && !argv.includes("--force")) {
    console.error(`a run exists at ${rel(c, c.runFile)}; finish it, or abort --yes`);
    return 8;
  }
  const { tasks, problems } = parsePlan(fs.readFileSync(path.resolve(c.project, plan), "utf8"));
  if (problems.length) {
    console.error("plan invalid:\n  - " + problems.join("\n  - "));
    return 6;
  }
  let base = "";
  try {
    base = git(c, ["rev-parse", "HEAD"]);
  } catch {
    console.error("not a git repository, or no commits yet");
    return 8;
  }
  const baselineDirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: c.project, encoding: "utf8" })
    .split("\n").filter(Boolean).map((l) => norm(l.slice(3).split(" -> ").pop().trim().replace(/^"|"$/g, "")));
  const run = {
    plan, story, spec, base, baselineDirty, tasks, task: 1, tasksTotal: tasks.length, step: "implement", attempt: 1,
    retries: { controls: 0, judge: 0 }, seal: null, sealedTree: null, token: null, report: null, lastFailure: null, lastFindings: null,
    blocked: null, commits: [], notes: [], started: new Date().toISOString(),
  };
  writeRun(c, run);
  console.log(`run initialised: ${tasks.length} task(s) from ${plan}; base ${base.slice(0, 12)}${baselineDirty.length ? `; ${baselineDirty.length} path(s) already dirty, ignored by the scope control unless a task reports them` : ""}`);
  return 0;
}

function next(c) {
  const run = readRun(c);
  if (!run) return noRun(c);
  const p = workPaths(c, run);
  const out = { task: run.task, tasksTotal: run.tasksTotal, step: run.step, attempt: run.attempt };
  switch (run.step) {
    case "implement": {
      const spec = parseSpec(fs.readFileSync(path.resolve(c.project, run.spec), "utf8"));
      const story = parseStory(fs.readFileSync(path.resolve(c.project, run.story), "utf8"));
      fs.mkdirSync(c.workDir, { recursive: true });
      fs.writeFileSync(p.brief, composeBrief(run, taskOf(run), spec, story, conventionsText(), { report: rel(c, p.report) }, collectRules(c.project), roleNotes(c, "flow-builder")));
      run.seal = `${run.task}:implement:${run.attempt}`;
      writeRun(c, run);
      out.action = "dispatch flow-builder";
      out.brief = rel(c, p.brief);
      out.then = `node step.mjs report ${rel(c, p.report)}`;
      break;
    }
    case "controls":
      out.action = "run controls";
      out.then = "node step.mjs controls";
      break;
    case "package":
      out.action = "write the review package";
      out.then = "node step.mjs package";
      break;
    case "judge":
      run.seal = `${run.task}:judge:${run.attempt}`;
      writeRun(c, run);
      out.action = "dispatch flow-judge";
      out.package = rel(c, p.package);
      out.verdictTo = rel(c, p.verdict);
      out.then = `node step.mjs verdict ${rel(c, p.verdict)}`;
      break;
    case "commit":
      out.action = "commit the sealed tree";
      out.then = "node step.mjs commit";
      break;
    case "delivered":
      out.action = "delivered: every task committed. Hand to flow-review.";
      break;
    case "blocked":
      out.action = `blocked: ${run.blocked}. Ask the human; abort --yes to discard.`;
      break;
  }
  if (c.json) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`task ${out.task}/${out.tasksTotal} · step ${out.step} · attempt ${out.attempt}`);
    console.log(`→ ${out.action}`);
    if (out.brief) console.log(`   brief:   ${out.brief}`);
    if (out.package) console.log(`   package: ${out.package}\n   verdict: ${out.verdictTo}`);
    if (out.then) console.log(`   then:    ${out.then}`);
  }
  return run.step === "blocked" ? 10 : 0;
}

function report(c, file) {
  const run = readRun(c);
  if (!run) return noRun(c);
  if (run.step !== "implement") return wrongStep(run, "implement");
  if (!file) return usage();
  let rep;
  try {
    rep = JSON.parse(fs.readFileSync(path.resolve(c.project, file), "utf8"));
  } catch (e) {
    console.error(`cannot read report: ${e.message}`);
    return 8;
  }
  if (!Array.isArray(rep.paths) || !rep.paths.every((x) => typeof x === "string") || typeof rep.summary !== "string") {
    console.error("report must be {paths: string[], summary: string, noticed?: string[]}");
    return 8;
  }
  run.report = { paths: rep.paths.map(norm), summary: rep.summary, noticed: rep.noticed || [] };
  writeRun(c, advance(run, "reported"));
  console.log(`report accepted: ${rep.paths.length} path(s). Next: node step.mjs controls`);
  return 0;
}

export function runControls(c, run) {
  const task = taskOf(run);
  const declared = new Set(task.files.map((f) => norm(f.path)));
  const problems = [];
  for (const p of run.report.paths) if (!declared.has(p)) problems.push(`scope: reported path not declared in Files: ${p}`);
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: c.project, encoding: "utf8" });
  const stateRel = rel(c, c.dir) + "/";
  const verdictsRel = norm(run.spec.replace(/\.md$/, "")) + "/verdicts/";
  for (const line of status.split("\n").filter(Boolean)) {
    const p = norm(line.slice(3).split(" -> ").pop().trim().replace(/^"|"$/g, ""));
    if (p.startsWith(stateRel) || p.startsWith(verdictsRel)) continue; // the program's own evidence is committed at commit time
    if ((run.baselineDirty || []).includes(p) && !run.report.paths.includes(p)) continue; // dirty before the run started; not this task's
    if (!run.report.paths.includes(p)) problems.push(`scope: changed but not reported: ${p}`);
  }
  for (const f of task.files) {
    const abs = path.resolve(c.project, f.path);
    const existedBefore = existsAtBase(c, "HEAD", norm(f.path)); // HEAD moves with each task commit
    if (f.mode === "create" && existedBefore) problems.push(`files: ${f.path} is marked create but existed at base`);
    if (f.mode === "modify" && !existedBefore) problems.push(`files: ${f.path} is marked modify but did not exist at base`);
    if (run.report.paths.includes(norm(f.path)) && !fs.existsSync(abs)) problems.push(`files: reported path does not exist: ${f.path}`);
  }
  const tddFound = run.report.paths.some((p) => {
    const abs = path.resolve(c.project, p);
    return fs.existsSync(abs) && fs.readFileSync(abs, "utf8").includes(task.tdd);
  });
  if (!tddFound) problems.push(`tdd: no reported file contains the test name "${task.tdd}"`);
  const log = [];
  for (const cmd of task.verification) {
    const r = spawnSync(cmd, { cwd: c.project, shell: true, encoding: "utf8" });
    log.push(`$ ${cmd}\n${(r.stdout || "") + (r.stderr || "")}\n[exit ${r.status}]`);
    if (r.status !== 0) problems.push(`verification: exit ${r.status}: ${cmd}`);
  }
  return { problems, log: log.join("\n\n") };
}

function controls(c) {
  const run = readRun(c);
  if (!run) return noRun(c);
  if (run.step !== "controls") return wrongStep(run, "controls");
  const p = workPaths(c, run);
  const { problems, log } = runControls(c, run);
  fs.writeFileSync(p.controls, log);
  if (problems.length) {
    run.lastFailure = problems.join("\n");
    const after = advance(run, "failed");
    writeRun(c, after);
    console.error("controls red:\n  - " + problems.join("\n  - "));
    console.error(after.step === "blocked" ? `blocked: ${after.blocked}` : `back to implement (attempt ${after.attempt}). Next: node step.mjs next`);
    return after.step === "blocked" ? 10 : 4;
  }
  run.lastFailure = null;
  writeRun(c, advance(run, "done"));
  console.log(`controls green (${run.tasks[run.task - 1].verification.length} predicate(s)). Next: node step.mjs package`);
  return 0;
}

function pkg(c) {
  const run = readRun(c);
  if (!run) return noRun(c);
  if (run.step !== "package") return wrongStep(run, "package");
  const p = workPaths(c, run);
  git(c, ["add", "--", ...run.report.paths]);
  const diff = git(c, ["diff", "--cached", "-U10"]);
  if (!diff) {
    console.error("nothing staged: the reported paths produced an empty diff");
    return 8;
  }
  const token = sha256(diff);
  const files = git(c, ["diff", "--cached", "--name-status"]);
  const conv = fs.existsSync(CONVENTIONS) ? fs.readdirSync(CONVENTIONS).filter((f) => f.endsWith(".md")).map((f) => `- ${path.join(CONVENTIONS, f)}`) : [];
  const ruleFiles = collectRules(c.project).files.map((f) => `- ${path.resolve(c.project, f)}`);
  const judgeNotes = roleNotesPath(c, "flow-judge");
  const md = [
    `Review token: ${token}`, "",
    `# Review package: task ${run.task}/${run.tasksTotal} (${taskOf(run).name})`, "",
    "## Brief", "", `- ${p.brief}`, "",
    "## Repository rules (win over conventions, rule by rule; open with Read and cite file and rule)", "", ...(ruleFiles.length ? ruleFiles : ["- none found"]), "",
    ...(judgeNotes ? ["## Notes this project keeps for the judge (open with Read)", "", `- ${judgeNotes}`, ""] : []),
    "## Flow State conventions (apply where repository rules are silent)", "", ...conv, "",
    "## Control logs (paths only; do not read them to decide, the controls already passed)", "", `- ${p.controls}`, "",
    "## Files changed", "", "```", files, "```", "",
    "## Diff (staged, -U10)", "", "```diff", diff, "```", "",
    `## Verdict`, "", `Write JSON to \`${p.verdict}\`. Exactly nine rubric rows, findings with path, line and evidence, ruling FAIL when any finding is high.`, "",
  ].join("\n");
  fs.writeFileSync(p.package, md);
  run.token = token;
  run.sealedTree = git(c, ["write-tree"]);
  writeRun(c, advance(run, "done"));
  console.log(`package written: ${rel(c, p.package)} (token ${token.slice(0, 12)}…, tree sealed). Next: node step.mjs next`);
  return 0;
}

function verdict(c, file) {
  const run = readRun(c);
  if (!run) return noRun(c);
  if (run.step !== "judge") return wrongStep(run, "judge");
  if (!file) return usage();
  let v;
  try {
    v = JSON.parse(fs.readFileSync(path.resolve(c.project, file), "utf8"));
  } catch (e) {
    console.error(`verdict discarded: cannot read (${e.message})`);
    return 3;
  }
  const errors = validateVerdict(v);
  if (errors.length) {
    console.error("verdict discarded:\n  - " + errors.join("\n  - ") + "\nRe-dispatch the judge with the same package.");
    return 3;
  }
  const now = sha256(git(c, ["diff", "--cached", "-U10"]));
  if (now !== run.token) {
    console.error("verdict discarded: the staged diff changed since the package was written. Run: node step.mjs package  (after next)");
    run.step = "package";
    run.seal = null;
    writeRun(c, run);
    return 3;
  }
  v.review_token = run.token;
  const outcome = outcomeOf(v);
  const specDir = path.resolve(c.project, run.spec.replace(/\.md$/, ""));
  const vdir = path.join(specDir, "verdicts");
  fs.mkdirSync(vdir, { recursive: true });
  const planBase = path.basename(run.plan).replace(/\.plan\.md$/, "").replace(/\.md$/, "");
  const kept = path.join(vdir, `${planBase}-task-${run.task}${run.attempt > 1 ? `-attempt-${run.attempt}` : ""}.json`);
  fs.writeFileSync(kept, JSON.stringify(v, null, 2) + "\n");
  run.verdictFile = rel(c, kept);
  run.verdictFiles = [...(run.verdictFiles || []), rel(c, kept)];
  run.lastFindings = outcome === "done" ? null : v.findings;
  const after = advance(run, outcome);
  writeRun(c, after);
  const n = v.findings.length;
  if (after.step === "commit") console.log(`verdict ${v.ruling} (${n} finding(s), ${outcome}). Next: node step.mjs commit`);
  else if (after.step === "blocked") { console.error(`verdict ${v.ruling}; blocked: ${after.blocked}`); return 10; }
  else console.log(`verdict ${v.ruling} (${n} finding(s), ${outcome}). Back to implement, attempt ${after.attempt}. Next: node step.mjs next`);
  return 0;
}

function commit(c) {
  const run = readRun(c);
  if (!run) return noRun(c);
  if (run.step !== "commit") return wrongStep(run, "commit");
  const tree = git(c, ["write-tree"]);
  if (tree !== run.sealedTree) {
    console.error("the index changed after the verdict; nothing is committed. Run: node step.mjs next  (it will re-package)");
    run.step = "package";
    writeRun(c, run);
    return 5;
  }
  for (const f of run.verdictFiles || (run.verdictFile ? [run.verdictFile] : [])) git(c, ["add", "--", f]);
  const task = taskOf(run);
  const storyBase = path.basename(run.story, ".md");
  const msg = `${task.name} (${storyBase}, task ${run.task}/${run.tasksTotal})\n\nFlow-State: ${storyBase}#${run.task} verdict ${(run.token || "").slice(0, 12)}`;
  git(c, ["commit", "-q", "-m", msg]);
  const sha = git(c, ["rev-parse", "HEAD"]);
  run.commits.push(sha);
  try {
    state.set(c.dir, { last_commit: sha.slice(0, 12), stage: "build" });
  } catch {}
  const after = advance(run, "done");
  writeRun(c, after);
  console.log(`committed ${sha.slice(0, 12)}: ${task.name}`);
  console.log(after.step === "delivered" ? "delivered: every task committed. Hand to flow-review." : `next task ${after.task}/${after.tasksTotal}. Next: node step.mjs next`);
  return 0;
}

function status(c) {
  const run = readRun(c);
  if (!run) return noRun(c);
  console.log(JSON.stringify({ story: run.story, task: run.task, tasksTotal: run.tasksTotal, step: run.step, attempt: run.attempt, retries: run.retries, seal: run.seal, commits: run.commits, blocked: run.blocked }, null, 2));
  return 0;
}

function abort(c, argv) {
  if (!argv.includes("--yes")) return usage();
  if (fs.existsSync(c.runFile)) fs.rmSync(c.runFile);
  console.log("run discarded (staged changes and work files left in place)");
  return 0;
}

function noRun(c) {
  console.error(`no run at ${rel(c, c.runFile)}. Start one: node step.mjs init --plan <plan.md> --story <story.md> --spec <spec.md>`);
  return 8;
}
function usage() {
  console.error("usage: step.mjs init --plan <plan.md> --story <story.md> --spec <spec.md> | next [--json] | report <report.json> | controls | package | verdict <verdict.json> | commit | status | abort --yes   [--dir .agent] [--project .]");
  return 2;
}

function main(argv) {
  const c = ctx(argv);
  const verbs = argv.filter((a, i) => !a.startsWith("--") && !["--dir", "--project", "--plan", "--story", "--spec"].includes(argv[i - 1]));
  const [cmd, arg] = verbs;
  switch (cmd) {
    case "init": return init(c, argv);
    case "next": return next(c);
    case "report": return report(c, arg);
    case "controls": return controls(c);
    case "package": return pkg(c);
    case "verdict": return verdict(c, arg);
    case "commit": return commit(c);
    case "status": return status(c);
    case "abort": return abort(c, argv);
    default: return usage();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(e.message);
    process.exit(8);
  }
}
