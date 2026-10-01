---
name: flow-ship
description: Takes reviewed, committed stories to the merge gate: runs the project's verify command and smoke, checks the changelog, collects the visual-gate evidence, writes the pull request body (or prepares the push when the work is on the main branch), and stops for the human to merge. Use after flow-review closes a story or a batch, or when the user says ship it or open a PR.
license: MIT
metadata:
  version: "0.5.0"
  flow-stage: ship
---

# flow-ship

You get everything ready for the one action that has a permanent external effect, and then you stop. Merging, or pushing to the main branch, is the human's. `<core>` is `../flow-core`.

## 0. Preconditions

Every story in scope has `Status: done` with its review closed. The working tree is clean. `node <core>/scripts/config.mjs --get ship` gives this repository's ways of working as `flow-adopt` recorded them: `verify`, `smoke`, `branching`, `defaultBranch`, `branchPattern`, `pr` (template, required checks, reviewers, labels), `deploy`, `environments`, `release`, `done`. The Ways of working section of the project's Flow State block says the same in prose. If `branching` is unset, or any of these reads `[⚠️ Pending`, stop and route to `flow-adopt`: shipping a company's code the wrong way is not a judgement call.

## 1. Checks, all of them, exit codes only

1. **HEAD is the reviewed commit**: `git rev-parse HEAD` equals the last commit the review closed on (the story's review-close commit, or the last verdict commit when the review added none). Any commit after the review that carries no verdict is unreviewed work: stop and send it through `flow review`. Nothing ships that a judge did not see.
2. **Verify**: the project's build, lint and test command. Red stops the stage; nothing is pushed on red.
3. **Smoke**: the project's smoke command if one exists (a production or staging sweep). Report its result; a red smoke is a human decision, not an automatic stop, because it may describe production rather than the change.
4. **Changelog**: the project's changelog has entries under Unreleased for every story in scope (the docs law). Missing entries go back to `flow-build` as a docs task, never written here by hand.
5. **Visual gate**: for every story with `Gate: visual`, produce the evidence the human will look at: start the app locally and take a screenshot of the affected screen, or point at the deployed preview. Attach the path or link to the story file. No screenshot, no merge for that story.
6. **Deferred work**: list what `deferred-work.md` holds for these stories, so the human knows what is not in this merge.

## 2. The pull request, or the push, the way this repository does it

- `ship.done` items are checked one by one before anything else (docs, screenshots, migration notes, flags); a missing one goes back to `flow-build` as a task.
- `branching: branches`: the work must be on a branch matching `branchPattern`; if it was built on the default branch, say so and stop (moving commits is the human's call). `gh pr create` with a body that lists the spec, the stories, the verdict commits (`git log --grep "Flow-State:"`), the visual evidence, the deferred items, and `Closes #<ticket>` when the spec has a ticket. The project's native review runs on the PR where the tool offers it (Copilot review, Claude Code `/code-review` on the PR number).
- `branching: trunk`: the push to `defaultBranch` is the merge. Show the commit list and the same summary; do not push.
- Then say what `deploy` means for this merge (automatic on merge, a command the human runs, a tag, a train) and which `environments` it reaches in order, so the human knows what the merge sets in motion.

## 3. The merge gate

Print the summary and stop with exactly: "Ready to merge. Reply `merge` (or `push`) to proceed, or tell me what to change." Do not proceed on anything else, in any autonomy mode.

On the human's word: push, or merge the PR as the human prefers; set each story's `Status: done` if not already; `node <core>/scripts/state.mjs set stage=retro gate=merge` and a note; say that `flow-retro` comes next when the spec's stories are done or the epic is closed.

## Never

- Never push, merge, or deploy without the human's word in this conversation.
- Never loosen a check to get past it; report red as red.
- Never write changelog or doc lines here; they go through a build task.
