import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const HOOKS = path.resolve("hooks");
const STATE = path.resolve("skills/flow-core/scripts/state.mjs");

function run(script, input, extra = []) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, script), ...extra], { input: JSON.stringify(input), encoding: "utf8" });
  return { status: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout) : null, err: r.stderr };
}

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-proj-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "one"], { cwd: dir });
  return dir;
}

test("guard-frozen denies Write and Edit on a frozen spec, in both dialects", () => {
  const dir = project();
  const spec = path.join(dir, "frozen.md");
  fs.writeFileSync(spec, "# X — Spec\n\nStatus: FROZEN\nFrozen: 2026-09-29\n\n## Hypothesis\n");
  const claude = run("guard-frozen.mjs", { tool_name: "Edit", tool_input: { file_path: spec }, cwd: dir });
  assert.equal(claude.status, 0);
  assert.equal(claude.out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(claude.out.hookSpecificOutput.permissionDecisionReason, /frozen\.changes\.md/);
  const cursor = run("guard-frozen.mjs", { tool_name: "Write", tool_input: { path: "frozen.md" }, workspace_roots: [dir] }, ["--tool", "cursor"]);
  assert.equal(cursor.out.permission, "deny");
});

test("guard-frozen stays silent for drafts, other tools and non-markdown", () => {
  const dir = project();
  const draft = path.join(dir, "draft.md");
  fs.writeFileSync(draft, "Status: DRAFT\n");
  assert.equal(run("guard-frozen.mjs", { tool_name: "Edit", tool_input: { file_path: draft }, cwd: dir }).out, null);
  assert.equal(run("guard-frozen.mjs", { tool_name: "Bash", tool_input: { command: "ls" }, cwd: dir }).out, null);
  const cursorAllow = run("guard-frozen.mjs", { tool_name: "Write", tool_input: { path: "draft.md" }, workspace_roots: [dir] }, ["--tool", "cursor"]);
  assert.equal(cursorAllow.out.permission, "allow");
});

test("session-start injects the state file and recent commits only when a project is adopted", () => {
  const dir = project();
  assert.equal(run("session-start.mjs", { cwd: dir }).out, null);
  execFileSync(process.execPath, [STATE, "init", "--dir", path.join(dir, ".agent")]);
  const claude = run("session-start.mjs", { cwd: dir });
  const ctx = claude.out.hookSpecificOutput.additionalContext;
  assert.equal(claude.out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(ctx, /stage: idle/);
  assert.match(ctx, /## last commits\n[0-9a-f]+ one/);
  const cursor = run("session-start.mjs", { workspace_roots: [dir] }, ["--tool", "cursor"]);
  assert.match(cursor.out.additional_context, /stage: idle/);
});

test("stop blocks once when HEAD moved past last_commit during an active stage", () => {
  const dir = project();
  execFileSync(process.execPath, [STATE, "init", "--dir", path.join(dir, ".agent")]);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  execFileSync(process.execPath, [STATE, "set", "stage=spec", `last_commit=${head}`, "--dir", path.join(dir, ".agent")]);
  assert.equal(run("stop.mjs", { cwd: dir }).out, null, "in sync: silent");
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "two"], { cwd: dir });
  const blocked = run("stop.mjs", { cwd: dir });
  assert.equal(blocked.out.decision, "block");
  assert.match(blocked.out.reason, /1 commit\(s\) past last_commit/);
  assert.equal(run("stop.mjs", { cwd: dir, stop_hook_active: true }).out, null, "no loop");
  const cursor = run("stop.mjs", { workspace_roots: [dir], loop_count: 0 }, ["--tool", "cursor"]);
  assert.match(cursor.out.followup_message, /last_commit/);
  assert.equal(run("stop.mjs", { workspace_roots: [dir], loop_count: 1 }, ["--tool", "cursor"]).out, null);
});

test("stop is silent when the stage is idle", () => {
  const dir = project();
  execFileSync(process.execPath, [STATE, "init", "--dir", path.join(dir, ".agent")]);
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "two"], { cwd: dir });
  assert.equal(run("stop.mjs", { cwd: dir }).out, null);
});

test("guard-task denies builder/judge dispatch unless the step machine prepared it", () => {
  const dir = project();
  const agentDir = path.join(dir, ".agent");
  fs.mkdirSync(agentDir, { recursive: true });
  assert.equal(run("guard-task.mjs", { tool_name: "Task", tool_input: { subagent_type: "flow-state:flow-builder" }, cwd: dir }).out, null, "no run: allowed");
  fs.writeFileSync(path.join(agentDir, "run.json"), JSON.stringify({ task: 2, tasksTotal: 3, step: "implement", attempt: 1, seal: "2:implement:1" }));
  assert.equal(run("guard-task.mjs", { tool_name: "Task", tool_input: { subagent_type: "flow-state:flow-builder" }, cwd: dir }).out, null, "prepared builder: allowed");
  const judge = run("guard-task.mjs", { tool_name: "Task", tool_input: { subagent_type: "flow-judge" }, cwd: dir });
  assert.equal(judge.out.hookSpecificOutput.permissionDecision, "deny");
  assert.equal(run("guard-task.mjs", { tool_name: "Task", tool_input: { subagent_type: "flow-state:flow-researcher" }, cwd: dir }).out, null, "other agents: allowed");
  const cursor = run("guard-task.mjs", { tool_name: "Task", tool_input: { subagent_type: "flow-judge" }, workspace_roots: [dir] }, ["--tool", "cursor"]);
  assert.equal(cursor.out.permission, "deny");
});

test("guard-push denies pushes, PRs, merges and approvals while a build run is open, and is silent otherwise", () => {
  const dir = project();
  const bash = (command) => ({ tool_name: "Bash", tool_input: { command }, cwd: dir });
  assert.equal(run("guard-push.mjs", bash("git push origin main")).out, null, "no run: silent");
  fs.mkdirSync(path.join(dir, ".agent"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".agent/run.json"), JSON.stringify({ task: 1, tasksTotal: 1, step: "implement", attempt: 1, seal: "1:implement:1" }));
  for (const cmd of ["git push origin main", "git push --force-with-lease", "gh pr create --draft", "gh pr merge 12", "gh pr review 12 --approve", "gh api -X POST repos/o/r/issues", "gh release create v1"]) {
    const r = run("guard-push.mjs", bash(cmd));
    assert.equal(r.out?.hookSpecificOutput?.permissionDecision, "deny", cmd);
  }
  for (const cmd of ["git status", "git commit -m x", "gh pr view 12", "gh pr review 12 --comment -b hi", "npm test"]) assert.equal(run("guard-push.mjs", bash(cmd)).out, null, cmd);
  const cursor = run("guard-push.mjs", { tool_name: "Bash", tool_input: { command: "git push" }, workspace_roots: [dir] }, ["--tool", "cursor"]);
  assert.equal(cursor.out.permission, "deny");
});

test("guards fail closed: garbage input or an unreadable run file denies", () => {
  const dir = project();
  const garbage = spawnSync(process.execPath, [path.join(HOOKS, "guard-frozen.mjs")], { input: "not json", encoding: "utf8" });
  assert.equal(garbage.status, 2, "Claude Code and Codex treat exit 2 as a blocking error");
  assert.match(garbage.stderr, /could not decide/);
  const cursorGarbage = spawnSync(process.execPath, [path.join(HOOKS, "guard-frozen.mjs"), "--tool", "cursor"], { input: "not json", encoding: "utf8" });
  assert.equal(JSON.parse(cursorGarbage.stdout).permission, "deny");
  fs.mkdirSync(path.join(dir, ".agent"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".agent/run.json"), "{ broken");
  const r = run("guard-task.mjs", { tool_name: "Task", tool_input: { subagent_type: "flow-builder" }, cwd: dir });
  assert.equal(r.out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(r.out.hookSpecificOutput.permissionDecisionReason, /unreadable/);
  assert.equal(run("session-start.mjs", { cwd: dir }).status, 0, "hydration never blocks a session");
});

test("guard-push: short flags and gh api writes are refused, a delivered run is not a run, an unreadable run file denies", () => {
  const dir = project();
  const bash = (command) => ({ tool_name: "Bash", tool_input: { command }, cwd: dir });
  fs.mkdirSync(path.join(dir, ".agent"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".agent/run.json"), JSON.stringify({ task: 1, tasksTotal: 1, step: "judge", attempt: 1, seal: "1:judge:1" }));
  for (const cmd of ["gh pr review 12 -a", "gh api repos/o/r/issues -f title=x", "gh api --method=patch repos/o/r -F x=1", "GIT_SSH=x git -c a=b push", "gh PR Ready 3"]) assert.equal(run("guard-push.mjs", bash(cmd)).out?.hookSpecificOutput?.permissionDecision, "deny", cmd);
  assert.equal(run("guard-push.mjs", bash("gh api repos/o/r/pulls/3")).out, null, "a gh api read is not an external effect");
  fs.writeFileSync(path.join(dir, ".agent/run.json"), JSON.stringify({ task: 1, tasksTotal: 1, step: "delivered", attempt: 1, seal: null }));
  assert.equal(run("guard-push.mjs", bash("git push origin HEAD")).out, null, "delivered: flow ship may push on the human's word");
  assert.equal(run("guard-task.mjs", { tool_name: "Task", tool_input: { subagent_type: "flow-builder" }, cwd: dir }).out, null, "delivered: a builder may be dispatched for the next run");
  fs.writeFileSync(path.join(dir, ".agent/run.json"), "{ broken");
  assert.match(run("guard-push.mjs", bash("git push")).out.hookSpecificOutput.permissionDecisionReason, /unreadable/);
});
