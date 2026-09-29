---
name: flow-spec
description: Turns an intent, a ticket or a brief into a Flow State spec and takes it to the freeze gate. Use when the flow hub routes epic-sized work here, or the user asks to spec, define, or freeze a feature. Investigates the repository before asking questions, tags every decision with its provenance, scores the draft with a script, has a fresh reviewer check it, then presents at most fifteen lines and stops until the human says freeze.
license: MIT
metadata:
  version: "0.1.0"
  flow-stage: spec
---

# flow-spec

You write the contract the rest of the flow builds against. The human freezes it after reading fifteen lines, so the fifteen lines must carry every decision and where each came from.

Paths below are relative to this skill's folder. `<core>` is `../flow-core`.

## 0. Preconditions

- `node <core>/scripts/config.mjs` prints the merged config. If it fails because the project has no `flow.config.json` or `.agent/STATE.md`, stop and route to `flow-adopt`.
- Read `.agent/STATE.md`. If a feature is already in `stage: spec` with `gate: none`, ask whether to continue it or start another.
- If `node` is missing, every score you produce is labelled `UNVERIFIED (no node)`.

## 1. Take the intent

Accept any of: a sentence, a ticket reference (with `ticket.source: github`, run `gh issue view <n> --json title,body,url`), a brief file, or a pointer to a document in the repo. Restate it in one line. If it is plainly one-session work, say so and route to `flow-build` instead; a spec for a typo is waste.

## 2. Investigate before asking

Before any question to the human, establish from the repository what exists and what constrains the work. Dispatch `flow-researcher` (or, without subagents, read directly) with at most three bounded questions such as: what already implements or touches this; which conventions, tests or security constraints apply; what the docs already decided. Record answers with `path:line`.

## 3. Draft from the template

Copy `<core>/templates/spec.md` to `<specs.dir>/<YYYY-MM-DD>-<slug>.md` and fill it. Rules that are not negotiable:

- **Hypothesis** needs three lines: the bet, how we would know it failed, the anti-scope. If the failure signal is unknown, write `[⚠️ Pending: define with <who>]`, not a plausible metric.
- **Every frozen decision carries a provenance tag.** `said: "<quote>" (<who>, <date>)` only when the words are the human's, from this conversation or the ticket. `deduced: <from what>` when it follows from a said decision or from a cited file. Anything you thought of yourself is `proposed` and goes under **Parked**, never in the frozen table.
- **Numbers** carry a source and a date or are placeholders.
- **Context for the builder** holds only bullets, bold and closed code fences. It is, with the slice rows, the only part of this file a builder ever sees. A requirement written anywhere else is invisible to the build.
- Gaps you cannot close from the repository are `[NEEDS CLARIFICATION: <question>]` inline.
- Every `path:line` you cite was read in this session at that line. A citation from memory is a defect the reviewer will find.
- The template's `<!-- -->` guidance comments are deleted as you fill each section.

## 4. Ask only what the repository could not settle

Turn each `[NEEDS CLARIFICATION]` into a numbered question with the options you see and what each implies. At most five. Wait for the answers. Write each answer into the spec as a `said` decision with the quote.

## 5. Score and review

1. `node <core>/scripts/spec.mjs score <file>` prints three dimensions and a gate. Cite its output literally. `FAIL` means fix the named gaps before going on; `CONDITIONAL` means say what is weak and ask whether to iterate or proceed.
2. Dispatch `flow-spec-reviewer` with the spec path only, never this conversation. Apply what you accept; list what you rejected and why in one line each. Without subagents, do the review yourself in a separate pass, stating that the feedback-flip is by instruction only.
3. Re-score if you changed anything.

## 6. The freeze gate

Run `node <core>/scripts/spec.mjs summary <file>`. Print its output verbatim: the bet, the failure signal, the anti-scope, and one line per frozen decision with its tag, fifteen lines at most. Then stop with exactly this ask: "Reply `freeze` to freeze this spec, or tell me what to change."

Do not proceed on anything but the word `freeze`. This holds in every autonomy mode.

## 7. After freeze

1. `node <core>/scripts/spec.mjs freeze <file>` sets `Status: FROZEN` and the date. It refuses while any `[NEEDS CLARIFICATION]` remains or a `proposed` decision sits in the frozen table.
2. `node <core>/scripts/state.mjs set feature=<slug> stage=spec gate=freeze spec=<file>`.
3. Offer to commit: `spec: <slug> (frozen)`.
4. Say what comes next: `flow-stories` with this spec (arrives in v0.2).

A frozen file is guarded by a hook and is not edited again. Later changes go to `<file-without-.md>.changes.md`, one dated entry each, and reopen the gate only if the human asks to unfreeze (`spec.mjs unfreeze <file>`).

## Never

- Never freeze a `proposed` decision; park it.
- Never invent a metric, a quote or a deadline.
- Never start stories or code inside this skill.
