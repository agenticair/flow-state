---
name: flow-ship
description: Stage ship of Flow State (type "flow ship"). Takes reviewed, committed stories to the merge gate: runs the project's verify command and smoke, checks the changelog, collects the visual-gate evidence, writes the pull request body (or prepares the push when the work is on the main branch), and stops for the human to merge. Use after flow-review closes a story or a batch, or when the user says ship it or open a PR.
license: MIT
metadata:
  version: "0.7.0"
  flow-stage: ship
---

# flow-ship

Ground rules: read `../flow-core/ground-rules.md` first; nothing below overrides them.

You get everything ready, then stop. The push and the pull request are external effects that wait for the human's word; merging is the human's, on GitHub, in every mode. `<core>` is `../flow-core`.

## 0. Preconditions

Every story in scope has `Status: done` with its review closed. The working tree is clean. `node <core>/scripts/config.mjs --get ship` gives this repository's ways of working as `flow setup` recorded them: `verify`, `smoke`, `branching`, `defaultBranch`, `branchPattern`, `pr` (template, required checks, reviewers, labels), `deploy`, `environments`, `release`, `done`. The Ways of working section of the project's Flow State block says the same in prose. If `branching` is unset, `verify` or `deploy` is empty, `branching` is `branches` with an empty `branchPattern`, or any of these reads `[⚠️ Pending`, stop and route to `flow setup`: shipping a company's code the wrong way is not a judgement call.

## 1. Checks, all of them, exit codes only

1. **HEAD is the reviewed commit**: `node <core>/scripts/state.mjs get reviewed_commit` gives the sha `flow-review` closed on; stop unless `git rev-parse HEAD` starts with it. A value of `none` means the review did not close: route to `flow review`. Nothing ships that a judge did not see.
2. **Verify**: the project's build, lint and test command. Red stops the stage; nothing is pushed on red.
3. **Smoke**: the project's smoke command if one exists (a production or staging sweep). Report its result; a red smoke is a human decision, not an automatic stop, because it may describe production rather than the change.
4. **Changelog**: the project's changelog has entries under Unreleased for every story in scope (the docs law). Missing entries go back to `flow-build` as a docs task, never written here by hand.
5. **Visual gate**: for every story with `Gate: visual`, start the app locally and take a screenshot of the affected screen, or point at the deployed preview, and append to the story file `Evidence: <path or URL> @ <sha12>`, the sha being `git rev-parse HEAD` at capture. If this host cannot capture a screenshot, say so and stop that story at the gate; text output is not evidence.
6. **Deferred work**: list what `deferred-work.md` holds for these stories, so the human knows what is not in this merge.

## 2. The pull request, or the push, the way this repository does it

- `ship.done` items are checked one by one before anything else (docs, screenshots, migration notes, flags); a missing one goes back to `flow-build` as a task.
- `branching: branches`: the work must be on a branch matching `branchPattern`; if it was built on the default branch, say so and stop (moving commits is the human's call). Write the pull request body: the spec, the stories, the verdict commits (`git log --grep "Flow-State:"`), the visual evidence, the deferred items, and `Closes #<ticket>` when the spec has a ticket. Nothing is pushed or opened yet.
- `branching: trunk`: the push to `defaultBranch` is the merge. Show the commit list and the same summary; nothing is pushed yet.
- Then say what `deploy` means for this merge (automatic on merge, a command the human runs, a tag, a train) and which `environments` it reaches in order, so the human knows what the merge sets in motion.

## 3. The merge gate

Print the summary and the pull request body, then stop with exactly: "Ready. Reply `pr` to push the branch and open a draft pull request (you merge it on GitHub), or `push` for trunk." Do not proceed on anything else, in any autonomy mode.

On `pr`: `node <core>/scripts/doctor.mjs --only github` (stop on failure), push the branch, then `gh pr create` with `--draft` when `ship.pr.draft` is true (the default) and ready otherwise, using `pr.template`, `labels` and `reviewers`; the project's native review runs on the PR where the tool offers it (Copilot review, Claude Code `/code-review` on the PR number). Then, when `review.comment` is `post`, `gh pr comment` with the story's review draft, naming the setting. On `push`, with `branching: trunk`: push to `defaultBranch`. Merging stays the human's, on GitHub, in every mode.

Close: set each story's `Status: done` if not already. When the state has no spec (the S route, an adhoc story): `node <core>/scripts/state.mjs set stage=idle gate=none size=none feature=none`. Otherwise `node <core>/scripts/state.mjs set stage=retro gate=merge` and a note, and say "flow stories to name the next story, or flow retro when every story is done".

## Never

- Never push, open a pull request, or deploy without the human's word in this conversation; never merge.
- Never loosen a check to get past it; report red as red.
- Never write changelog or doc lines here; they go through a build task.
