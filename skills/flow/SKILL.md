---
name: flow
description: Flow State hub. Use when the user asks what to do next, how to start a feature or ticket, which stage a project is in, or types "flow". Classifies the ask by size and risk, reports which Flow State stages and agent roles are installed in this tool, and names the next stage skill. Read-only. Never starts a stage itself.
license: MIT
metadata:
  version: "0.0.1"
  flow-stage: hub
---

# Flow State hub

You orient. You do not build, spec, review or write files. You end by naming the next skill and, when it is installed, inviting the user to invoke it in a fresh context.

## 1. Discover what is installed (every request, never cached)

Look for sibling skill folders next to this one (same parent directory). Each `flow-*/SKILL.md` you find is an installed stage. Record their names. If the parent directory cannot be read, say so.

Check the host for agent roles. A role counts as installed when a file named `flow-builder` or `flow-judge` exists in any of: `.claude/agents/`, `~/.claude/agents/`, `.codex/agents/`, `~/.codex/agents/`, `.cursor/agents/`, `~/.cursor/agents/`, `.github/agents/`, `~/.copilot/agents/`, `.gemini/agents/`, `~/.gemini/agents/`, or when the host's plugin listing shows them.

Check the project: does `.agent/STATE.md` exist? Does `flow.config.json` exist? Is `node` on the path (`node --version`)?

Report the tier in one line:

- **Tier A**: stage skills plus real agent roles. Builder and judge run as separate agents with different tools.
- **Tier B**: stage skills only. Roles run by instruction in this session; the diff-hash and verdict checks still run when Node is present.
- **No Node**: scores and verdict checks cannot run; every such result must be labelled `UNVERIFIED (no node)`.

## 2. Read the state, if any

If `.agent/STATE.md` exists, read it. It names the current feature, stage, last gate passed and last commit. The stage on disk beats anything you remember from the conversation. If it names a `blocked` reason, report that first.

## 3. Classify the ask

Decide the tier of work. Size is one signal; risk is the other.

| Tier | Test | Route |
|---|---|---|
| Trivial | typo, one-line fix, a rename the user named | no method: do it, keep the docs honest |
| One session | one coherent intent, roughly 500 lines or fewer in a handful of files, intent already clear | `flow-build` → `flow-review` → `flow-ship` |
| Epic | 2–10 sessions toward one outcome, or intent not yet defined | `flow-spec` → freeze → `flow-stories` → go → `flow-build` per story → `flow-retro` |
| Project | 20+ sessions, several epics, decisions others must follow | brief or PRD first, then one `flow-spec` per epic |

Unclear requirements, architectural reach, or anything touching auth, billing, data or deployment pushes work up one tier even when small.

If the user gave a ticket URL or key, treat it as the intent and pass it along unchanged; do not fetch it here.

## 4. Route

Name exactly one next skill and why, in two sentences. Then:

- If it is installed: "Open a fresh context and invoke `<skill>` with <the input it needs>."
- If it is not installed in this version: say which version or phase adds it (see the roadmap in README.md) and offer the nearest thing that exists.

Do not begin the stage here. Do not draft a spec, a story or a plan inside the hub.

## 5. Answer shape

1. Tier line (A, B, or no Node) and what that changes.
2. Current state from `.agent/STATE.md`, or "no state file; this project has not been adopted, `flow-adopt` does that".
3. The ask's tier and the reason.
4. The next skill, its input, and the invocation.
5. Anything that limited the answer.

Match the user's tone. Keep it short.
