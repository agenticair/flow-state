---
name: flow-stories
description: Turns a frozen Flow State spec into a slice table and one story file per slice, scored and ordered so every batch delivers something observable, then stops at the go gate where the human names the story that starts. Use after flow-spec has frozen a spec, or when the user asks to break a spec into stories or slices.
license: MIT
metadata:
  version: "0.3.0"
  flow-stage: stories
---

# flow-stories

You divide a frozen spec into stories a builder can finish in one session each. The frozen file never changes; you write beside it. Paths are relative to this skill; `<core>` is `../flow-core`.

## 0. Preconditions and mode

- `.agent/STATE.md` has `stage: spec` and `gate: freeze`, and its `spec` path has `Status: FROZEN`. Otherwise stop and route to `flow-spec`.
- Mode is `step` (stop after the draft table and after scoring) or `run` (stop only at the go gate). `autonomy: gated` forces step.
- `node --version`; without Node, scores are `UNVERIFIED (no node)`.

## 1. Read

The spec (Hypothesis, Frozen decisions, Context for the builder, Parked), the repository's rules (`node <core>/scripts/rules.mjs --list`), and the code the Context section cites. Do not ask the human anything yet.

## 2. Slice

Write `<spec-without-.md>.stories.md` from `<core>/templates/stories.md` and one file per row under `<spec-without-.md>/stories/<nn>-<slug>.md` from `<core>/templates/story.md`.

Rules for a slice:

- **Delivers** is observable by a person or a test, not a task ("a visitor sees Medium in the footer", not "add Medium to SOCIALS").
- **Accepts** are postconditions, at most seven, each one a test that can exist. Given/When/Then or a plain "X returns/renders/rejects Y".
- **Protected** names what the builder must not touch: paths, behaviours, the spec's anti-scope.
- **Type** is one of ui, backend, infra, bugfix, docs, test. **Area** is one token; two slices with the same area do not run in parallel.
- **Gate** is `visual` for anything a person should look at before merge, `plan` when the plan itself needs a human OK, else `none`.
- **Signal** is what becomes observable in production, or `N/A — <reason>`; never bare `N/A`.
- **Dep** names an order number only when the story cannot deliver partial value without it. "First the data, then the UI" is not a dependency unless the UI shows that data.
- A story that sits on a frozen decision copies the decision id into its Notes; it never restates the decision differently.

## 3. Score and split

For each story: `node <core>/scripts/score_story.mjs <file>`. Cite the output. Below 7, or with red flags, propose two or three alternative splits with their trade-offs (by output, by narrowest segment, by the walking skeleton first, by separating learn from earn) and pick one, saying why. Never split by technical layer.

## 4. Order

Batches of two to four stories. Every batch delivers something observable. Infrastructure only ships in the batch where a story consumes it. The story that settles the riskiest assumption in the Hypothesis goes first. Write the order and the reason per batch under "Order and batches".

## 5. Review

Dispatch `flow-spec-reviewer` with the stories file and the story files only. Apply what you accept; list what you rejected in one line each. Re-score anything you changed.

## 6. The go gate

Print the slice table and the batches. Then stop with exactly: "Name the story that starts (its number), or tell me what to change." Do not proceed on anything else, in any mode.

On the answer: set that story's `Status: ready`, write `Next story: #<n> <slug>` under "Go" in the stories file, and `node <core>/scripts/state.mjs set stage=stories gate=go`. Say what comes next: `flow-build` with that story.

## Never

- Never edit the frozen spec (a hook denies it anyway).
- Never invent an acceptance criterion the spec does not support; mark it `[⚠️ Pending: define with <who>]`.
- Never start a plan or code here.
