---
name: flow
description: Flow State hub. Use when the user types "flow" with or without a verb (list, help, status, settings, connect, setup, size, next, run, update, or a stage name such as spec, stories, design, build, review, ship, retro), asks what to do next, how to start a feature or ticket, or which stage a project is in. Welcomes a first-time user, orients, sizes the ask and records the size in the state, and dispatches to the stage skills. Writes only configuration, and only after the user confirms.
license: MIT
metadata:
  version: "0.7.0"
  flow-stage: hub
---

# Flow State hub

Ground rules: read `../flow-core/ground-rules.md` first; nothing below overrides them.

You orient and dispatch. You never do a stage's work yourself: no spec, story, plan or code is drafted inside the hub. The user types `flow <verb>` and never a hyphenated skill name; `flow spec` means "invoke the `flow-spec` skill with the remaining words as input and the mode from `autonomy`". `flow adopt` is accepted as `flow setup` until 0.7.

## First run

Run `node ../flow-core/scripts/config.mjs where --json`. If `firstRun` is true and the environment variable `CI` is unset, and the verb is not `list` or `help`: print `../flow-core/templates/welcome.md` verbatim and wait. Then show the four answers as the JSON you intend to write, wait for a yes, and write them with `node ../flow-core/scripts/config.mjs set --scope user autonomy=<a> review.comment=<c> review.approve=<true|false> update.policy=<p> welcomed=<installed version>`. `review.comment` and `review.approve` stored here are the defaults `flow setup` proposes; only `flow.config.json` makes them effective. Then run `flow connect`. If the project is not set up, say: "This repository is not set up yet: `flow setup` reads it and asks only what it cannot read", and stop unless the verb was `setup`, `settings` or `connect`. With `CI` set, skip the welcome and write nothing.

## Verbs

| Verb | What it does | Writes |
|---|---|---|
| `flow`, `flow status` | tier, state, size, version, one next verb; when `update.policy` is not `never`, also the one line from `node ../flow-core/scripts/update.mjs check` (cached 24 h) | nothing |
| `flow list`, `flow help` | this table with what is installed and missing per stage, the three gates, the two speeds | nothing |
| `flow settings [key value \| reset]` | first run: the welcome; later: walk every key with its current value and where it comes from, or set one key; "only for me" goes to `flow.config.user.json`; writes after a yes; `reset` deletes the machine file after a yes | config files |
| `flow connect [name]` | `node ../flow-core/scripts/doctor.mjs [--only name]`: machine, tools, tiers, project, every integration the loop needs, installed version; show it verbatim, then one line per missing item | nothing |
| `flow setup [refresh]` | invokes `flow-setup`: discovers how this repository works, asks only the gaps, writes config, state and the instructions block after a yes | via the stage |
| `flow size <ticket or intent>` | dispatches `flow-architect` (or applies its rubric yourself without agents) and records `size` in the state; answers its questions first if `confidence` is low | `.agent/STATE.md` |
| `flow next` / `flow run` | the next stage in step mode (stops at every checkpoint) or run mode (stops only at a gate or when stuck); never below `autonomy` | via the stage |
| `flow spec \| stories \| design \| build \| review \| ship \| retro [input]` | that stage now; with an ask and no size in the state, sizing runs first; its own preconditions still stop it | via the stage |
| `flow update` | `node ../flow-core/scripts/update.mjs check --force`, always, whatever the policy; runs the route only on a yes, and never while a build run is open or installed files were edited | nothing by itself |

Unknown verb: say so and print the list.

## Status and sizing

1. **Installed**: sibling `flow-*` folders are the stages; agent roles exist when `flow-builder` or `flow-judge` is found under `.claude/agents`, `~/.claude/agents`, `.codex/agents`, `~/.codex/agents`, `.cursor/agents`, `~/.cursor/agents`, `.github/agents`, `~/.copilot/agents`, `.gemini/agents`, `~/.gemini/agents`, or in the host's plugin listing. Tier A: stages plus roles. Tier B: stages only, roles by instruction. No Node: every score is `UNVERIFIED (no node)`.
2. **State**: `.agent/STATE.md` if present; the stage on disk beats memory; a `blocked` reason comes first. `stage: review` with `reviewed_commit` matching the start of `git rev-parse HEAD` means the review closed and `flow ship` is next. Not set up: every verb except `list`, `help`, `settings`, `connect` routes to `flow setup`.
3. **Size** decides the route. With an ask that is not the current feature, or no size in the state, dispatch `flow-architect` with the ticket text or intent and the project root. If `confidence` is `low` or `questions` is non-empty, ask them in every autonomy mode before recording. A size `S` with a non-empty `riskAreas` is a contradiction: re-size. Record `node ../flow-core/scripts/state.mjs set size=<S|M|L|XL>` and the risk areas with `node ../flow-core/scripts/state.mjs note "risk: <areas>"`. Routes: **S** build → review → ship; **M** spec-lite (hypothesis plus at most five decisions, frozen) → one story → build → review → ship; **L** spec → freeze → stories → go → build per story → review → ship → retro; **XL** brief first, one spec per epic. Auth, billing, data, deployment, untrusted input, another team's code or a regulation push the size up one step. A ticket URL or key is passed to the stage unchanged.
4. For `flow` and `flow status`: name exactly one next verb and why, then invite the user to type it or `flow run` (`flow next` only under `autonomy: gated`). For `next` and `run`: invoke that stage skill now with the mode, the state, and the input it needs. Nothing else.

`next` and `run` are the same route at two speeds. `run` never goes below the autonomy in effect (the personal file may set it): with `autonomy: gated`, `flow run` behaves like `flow next` and says so. Neither can pass a gate.

## Settings walk (after the first run)

Read `../flow-core/config.schema.json`: every key with an `x-question` is a question; show the current value and its source (machine, team, personal, default). Ask in groups of at most five; skip keys the user says to leave. Keys with `x-team` are written to `flow.config.json`; `x-scope` lists where each key may live. Show the complete file before writing; write with `config.mjs set --scope <user|project|personal>`; then `node ../flow-core/scripts/config.mjs` to show the merged result.

## `flow list`

Print, for this tool's syntax (`/flow …` in Claude Code, Cursor and Copilot; `$flow …` in Codex): the verbs above with one line each and, per stage, installed or missing; then the three gates (**freeze**: fifteen lines, reply `freeze`; **go**: you name the story; **merge**: you reply `pr` (push the branch, open a draft pull request, merge it yourself on GitHub) or `push` for trunk; nothing else has a permanent external effect, and a hook refuses pushes while a build is open) and the two speeds (`next` stops at every checkpoint; `run` only at gates or when stuck).

## Answer shape (status)

1. Tier and version, and what the tier changes.
2. State: feature, size, stage, gate, or "not set up".
3. The size and the route, with the reason.
4. The next verb and how to type it.
5. Anything that limited the answer.

Match the user's tone. Keep it short.
