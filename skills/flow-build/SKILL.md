---
name: flow-build
description: Stage build of Flow State (type "flow build"). Builds one story (or one one-session change) through a program-driven loop: a plan with declared files and tests, a builder agent that cannot certify, controls the program runs, a judge agent that cannot execute, a schema-checked verdict tied to the exact diff, and a commit of the sealed tree. Use after the go gate, when the flow hub routes one-session work here, or when the user asks to build, implement or code a story.
license: MIT
metadata:
  version: "0.7.0"
  flow-stage: build
---

# flow-build

Ground rules: read `../flow-core/ground-rules.md` first; nothing below overrides them.

You drive the loop; you do not write the code and you do not judge it. The step machine at `<core>/scripts/step.mjs` decides what comes next; you ask it and do exactly what it prints. `<core>` is `../flow-core`, relative to this skill.

## 0. Preconditions and mode

- `.agent/STATE.md` names a story (`gate: go`) or the hub sent one-session work with an intent (`flow build <intent>`); if `size` in the state is `none`, stop and run `flow size` first. Node is required for this stage; without it, stop and say so.
- Mode `step`: stop after the plan is approved and after every commit. Mode `run`: continue until delivered or blocked; the plan gate still applies when the story's `Gate` is `plan`. `autonomy: gated` forces step; `assisted` and `auto` are run.
- If `.agent/run.json` exists and is not `delivered`, resume it: `node <core>/scripts/step.mjs next` and continue at section 3. Never start a second run beside an open one; a delivered run is replaced by the next `init`, a blocked one needs `abort --yes` first.

## 1. Investigate, then plan

Read the story, the spec's Context for the builder, the repository rules (`node <core>/scripts/rules.mjs --list`), and every file the story or the accepts point at. Dispatch `flow-researcher` for anything that needs a search rather than a read. Only what the repository cannot settle becomes a question to the human, as numbered choices; write the answer into the plan.

Write `<spec-without-.md>/plans/<nn>-<slug>.plan.md` from `<core>/templates/plan.md`:

- one task per builder dispatch, in order, each finishable in minutes not hours;
- **Files** lists every path a task may touch, marked `create` or `modify`; the controls reject anything else, so a forgotten test file fails the task;
- **TDD** is the exact name of the test the builder writes first;
- **Verification** is shell that exits 0 when the task holds (the project's test runner, lint, a grep), never a description;
- the first task usually creates the failing test and the smallest slice of behaviour; refactors are separate tasks or parked;
- **a docs task last** whenever the project's docs law applies (a changelog, a decisions entry): the judge treats a missing entry as a finding, so plan it rather than patch it;
- **Verification runs only what the task can make green.** A repository-wide lint or test that already fails on files outside the task is not a predicate; scope the command to the files in scope and record why in the plan;
- for a documentation task, **TDD** is the exact phrase the document must contain and Verification is a grep; the judge still checks every claim against the code, so write what is true at HEAD, not what the story planned.

For one-session work without a story, write a story file first from `<core>/templates/story.md` with the intent as Delivers and the accepts you can verify and `Status: ready`; it lives under `docs/specs/adhoc/stories/`, and the run is started with `--spec none` (verdicts then live under `docs/specs/adhoc/verdicts/`).

Checkpoint: on the first `init` of a run, in every mode, show the plan and wait for approval (the human sees Files and Verification once); a later re-plan follows the mode, or `Gate: plan`.

## 2. Start the run

`node <core>/scripts/step.mjs init --plan <plan> --story <story> --spec <spec>`. It validates the plan (exit 6 with reasons if not), refuses modified-tracked or staged files (commit or stash first), prints the verification commands and records the base commit. Then `node <core>/scripts/state.mjs set stage=build`.

## 3. The loop

Repeat until `next` says delivered or blocked:

1. `node <core>/scripts/step.mjs next --json`. Read `action`.
2. `dispatch flow-builder`: dispatch the builder agent with the brief path it printed and nothing else ("Read the brief at <path> and do what it says."). Without agents, adopt the builder role yourself using only the brief. Then `node <core>/scripts/step.mjs report <report path>`.
3. `run controls`: `node <core>/scripts/step.mjs controls`. Exit 4 means red: it already routed back to implement with the failure in the next brief; go to 1. Exit 10 means blocked; go to section 4.
4. `write the review package`: `node <core>/scripts/step.mjs package`. It stages the reported paths, hashes the diff, seals the tree.
5. `dispatch flow-judge`: dispatch the judge agent with the package path it printed and the verdict path ("Read the package at <path>; write your verdict to <path>."). Without agents, adopt the judge role in a separate pass using only the package. If the host's judge cannot write (read-only sandbox), it returns the JSON as its whole reply; save it verbatim to the verdict path. Then `node <core>/scripts/step.mjs verdict <verdict path>`. Exit 3 means discarded (schema or hash): re-dispatch the judge with the same package, or re-package if it says the diff moved. FAIL routes back to implement with the findings in the next brief.
6. `commit the sealed tree`: `node <core>/scripts/step.mjs commit`. Exit 5 means the index changed after the verdict; it re-packages; go to 1. In step mode, stop here and show the commit; in run mode continue. When `verdict` or `commit` prints "correction budget spent", stop and show the findings to the human, in run mode too.

Never run `git add -A`, never commit by hand, never edit files during the loop. If you need to change something, it goes through a task.

## 4. Blocked

`next` prints the reason (controls red three times, judge failed three times, empty diff at `package`, which counts like red controls: back to implement, blocked once the budget is spent). Stop and show the human: the last brief, the controls log or findings, and what you think is wrong. Options: fix the plan and `abort --yes` then `init` again; or ask the human to take over. Never loosen a control to get past it.

## 5. Delivered

`node <core>/scripts/state.mjs set stage=review reviewed_commit=none` and hand to `flow-review` with the story path and the base commit from `.agent/run.json`. The commits carry the verdicts beside the code; the story's `Status` becomes `in-review`.
