---
name: flow-retro
description: Closes an epic or a spec with evidence: harvests the numbers from committed verdicts and git, judges the result against the frozen hypothesis, lists what the judge caught and what humans caught, and turns the lessons into concrete proposals, each a small diff the human accepts or rejects. Use when a spec's stories are done, after a merge, or when the user asks for a retro. This is the self-improvement loop; nothing changes silently.
license: MIT
metadata:
  version: "0.5.0"
  flow-stage: retro
---

# flow-retro

You judge the whole against the frozen spec, with numbers a script produced, and you propose changes as diffs. The human accepts each one. `<core>` is `../flow-core`.

## 0. Preconditions

A spec with `Status: FROZEN` whose stories are `done` (or parked with a reason). Node is required for the harvest; without it, stop and say so. Read `retro.apply` from the config: `propose` (default: write proposals, human accepts each), `pr` (open a PR with the accepted project-level diffs), `auto` (apply project-level diffs and commit; never for flow-level ones).

## 1. Harvest, never type a number

`node <core>/scripts/harvest.mjs --spec <spec.md>` reads the committed verdicts, the git trailers and the story files and prints, per story and in total: tasks, attempts, correction rounds, rulings, findings by severity and by rule, rubric outcomes, commits, and elapsed time from plan to done. Cite its output literally. If a number is not in the harvest, it is not in the retro.

## 2. Read the evidence

The frozen spec (hypothesis, failure signal, decisions), the stories file, every story's Review Findings, `deferred-work.md`, `<spec>.changes.md`, the state file's notes, and the git log between the adoption commit and the last story commit.

## 3. Write `docs/retros/<date>-<slug>.md` from `<core>/templates/retro.md`

- **Verdict**: `accepted`, `accepted with open items`, or `rejected`, judged against the hypothesis and the failure signal. A failure signal that was never measured (a parked story, a pending runner) is an open item, not a pass.
- **Numbers**: the harvest table.
- **What the judge caught, what the human caught, what nobody caught yet**: one line each, with the commit or finding it came from. The ratio of judge corrections to human corrections is the loop's own health signal.
- **Findings**: what cost time or trust, with its source. Patterns across stories count more than single events.
- **Proposals**: each one a concrete change with a target file and the exact text or diff, labelled by level:
  - **project**: a pitfall line for the project's `AGENTS.md` or `CLAUDE.md` block, a convention amendment, a lens trigger, a `flow.config.json` change, a template change under `docs/specs/`;
  - **flow**: a change to Flow State itself (a skill sentence, a script behaviour, a template), written as an issue body for `https://github.com/agenticair/flow-state/issues`, labelled `retro`, with the evidence attached.
  No proposal without a finding behind it. No finding without a source.

## 4. Apply

Present the proposals as a numbered list and stop: "Accept by number, reject by number, or `all`." In `propose` mode apply only the accepted project-level diffs, as one commit `retro: <slug>`; in `pr` mode open a PR with them; in `auto` mode apply and commit the project-level ones without asking, and still ask for the flow-level ones. Flow-level proposals the human accepts become issues (`gh issue create --label retro`) when `gh` is available, otherwise a file the human can paste.

Then `node <core>/scripts/state.mjs set stage=idle feature=none gate=none spec=none` and a note naming the retro file.

## Never

- Never invent a number, a quote, or a cause.
- Never change a file the human did not accept a proposal for.
- Never skip the verdict because the numbers look good.
