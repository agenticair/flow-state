---
name: flow
description: Flow State hub. Use when the user types "flow" with or without a verb (help, status, settings, next, run), asks what to do next, how to start a feature or ticket, or which stage a project is in. Orients, sizes the ask, and dispatches to the right stage skill. Writes nothing except flow.config.json through "flow settings", and only after the user confirms.
license: MIT
metadata:
  version: "0.5.0"
  flow-stage: hub
---

# Flow State hub

You orient and dispatch. You never do a stage's work yourself: no spec, story, plan or code is drafted inside the hub.

## Verbs

The user types `flow` followed by an optional verb. In Claude Code and Cursor the skill is `/flow`, in Codex `$flow`, in Copilot `/flow`; the verb follows as plain text.

| Verb | What it does | Writes |
|---|---|---|
| `flow` or `flow status` | Sections 1–3 below: tier, state, sizing, next skill | nothing |
| `flow connect` | Runs `node ../flow-core/scripts/doctor.mjs`: machine, tools, tiers, project; prints a fix per missing item | nothing |
| `flow help` | Lists the commands available in this tool (section 5) | nothing |
| `flow settings` | Walks the config schema, proposes `flow.config.json`, writes it after a yes (section 4) | `flow.config.json` |
| `flow next` | Dispatches the next stage skill in step mode: it stops at its first checkpoint | via the stage skill |
| `flow run` | Dispatches the next stage skill in run mode: checkpoints auto-continue until a human gate, a question the repository cannot answer, or a blocked state | via the stage skill |

`next` and `run` are the same route at two speeds. `next` asks at every checkpoint; `run` asks only at the three gates (freeze, go, merge) and when it is genuinely stuck. Neither can pass a gate. `run` never goes below the project's `autonomy` setting: with `autonomy: gated`, `flow run` behaves like `flow next` and says so.

## 1. Discover what is installed (every request, never cached)

For `flow connect`, run the doctor script and show its output verbatim, then explain each missing item in one line and stop. For other verbs, the checks below are enough.

Look for sibling skill folders next to this one. Each `flow-*/SKILL.md` you find is an installed stage. Check the host for agent roles: a file named `flow-builder` or `flow-judge` in `.claude/agents/`, `~/.claude/agents/`, `.codex/agents/`, `~/.codex/agents/`, `.cursor/agents/`, `~/.cursor/agents/`, `.github/agents/`, `~/.copilot/agents/`, `.gemini/agents/`, `~/.gemini/agents/`, or in the host's plugin listing. Check `node --version`.

Report the tier in one line:

- **Tier A**: stage skills plus real agent roles with different tools.
- **Tier B**: stage skills only; roles run by instruction; the diff-hash and verdict checks still run when Node is present.
- **No Node**: scores and verdict checks cannot run; every such result is labelled `UNVERIFIED (no node)`.

## 2. Read the state

If `.agent/STATE.md` exists, read it. The stage on disk beats anything remembered. If `blocked` is set, report that first. If it does not exist, the project is not adopted: every verb except `help` and `settings` routes to `flow-adopt`.

## 3. Size the ask and route

| Tier | Test | Route |
|---|---|---|
| Trivial | typo, one-line fix, a rename the user named | no method: do it, keep the docs honest |
| One session | one coherent intent, roughly 500 lines or fewer in a handful of files, intent already clear | `flow-build` → `flow-review` → `flow-ship` |
| Epic | 2–10 sessions toward one outcome, or intent not yet defined | `flow-spec` → freeze → `flow-stories` → go → `flow-build` per story → `flow-retro` |
| Project | 20+ sessions, several epics | brief or PRD first, then one `flow-spec` per epic |

Unclear requirements, architectural reach, or anything touching auth, billing, data or deployment pushes work up one tier. A ticket URL or key is passed to the stage unchanged.

For `flow` and `flow status`: name exactly one next skill and why, then invite the user to invoke it (or to type `flow next`). If a stage skill is missing from this install, say so and offer the nearest thing that exists.

For `flow next` and `flow run`: invoke that stage skill now, passing the mode (`step` or `run`), the state, and the input it needs. Nothing else.

## 4. `flow settings`

1. Read `../flow-core/config.schema.json` and the current `flow.config.json` if any.
2. Ask, one question per key that matters, with the current or default value shown and what each option changes: `autonomy` (gated / assisted / auto), `models.builder` and `models.judge`, `docs.family` and map, `specs.dir`, `ticket.source`, `retro.apply`, `language`. Skip keys the user says to leave.
3. Show the complete file you intend to write. Wait for a yes. Write it. Run `node ../flow-core/scripts/config.mjs` and show the merged result.
4. Personal overrides go to `flow.config.user.json` if the user says the setting is only for them.

## 5. `flow help`

Print, for this tool's invocation syntax, the verbs above and the installed stage skills with one line each, then the three gates:

- **freeze**: you read at most fifteen lines and reply `freeze`. The spec becomes read-only (a hook denies edits), the state records `stage: spec, gate: freeze`, and the next stage is stories.
- **go**: you pick which story starts. The state records the story; build runs one story per session.
- **merge**: you merge the pull request. Nothing else has a permanent external effect.

And the two speeds: `flow next` stops at every checkpoint; `flow run` stops only at gates or when stuck.

## Answer shape (status)

1. Tier line and what it changes.
2. Current state, or "not adopted; `flow-adopt` does that".
3. The ask's tier and the reason.
4. The next skill, its input, and how to invoke it.
5. Anything that limited the answer.

Match the user's tone. Keep it short.
