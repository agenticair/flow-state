---
name: flow-review
description: Stage review of Flow State (type "flow review"). Reviews a story's finished diff, a branch, or a pull request with the judge agent plus the host tool's native review and any project lenses, grades every finding in the parent session, and routes each to patch, defer or spec. Use after flow-build delivers, when the user says review this, or before opening a pull request.
license: MIT
metadata:
  version: "0.7.0"
  flow-stage: review
---

# flow-review

Ground rules: read `../flow-core/ground-rules.md` first; nothing below overrides them.

Reviewers find; you grade and route. No reviewer's severity is final, and no reviewer edits code. `<core>` is `../flow-core`.

## 1. Target

In order of preference: the story's commits since `base` in `.agent/run.json`; a branch (`git diff <base>...HEAD`); a PR number (`gh pr diff <n>`); the working tree (`git diff`). Write the unified diff to `.agent/review/diff.patch` with `-U10` and note its `sha256`. Above about 3000 lines, say so and offer to review by story instead.

## 2. Reviewers, in parallel where the tool allows

1. **Judge** (`flow-judge`, no shell): give it the diff path, the story path, the spec's Context section path, the repository rules (`node <core>/scripts/rules.mjs --list`) and the conventions by path; it returns a verdict JSON. Validate with `node <core>/scripts/verdict.mjs check <file>`; discard and re-dispatch on failure. This is the slice-level judgement: coherence across the tasks and the story's Accepts, not the per-task rubric already committed.
2. **The host's native review**, by tool:
   - Claude Code: `/code-review`; add `/security-review` when the diff touches auth, sessions, secrets, webhooks, payments, prompts or row-level security.
   - Codex: the built-in `review-agent` skill on the same diff.
   - Cursor: `review`, plus `review-security` on the same triggers.
   - Copilot: `copilot review` or the PR review.
   - Others: none known; say so in the report.
3. **Project lenses** from `flow.config.json` `lenses[]` whose triggers match the diff (paths, keywords). Each gets the diff path and its own instructions file, nothing else.

## 3. Grade

For every finding, open the cited location and decide: `high` (the story does not do what it promised, a decision is broken, a test was weakened, behaviour is faked, or a security boundary is crossed), `medium` (works, leaves a defect the next change pays for), `low` (cosmetic), `false` (refuted: say how), `maybe-false` (undecidable: say what would settle it). Group findings that share a root cause.

## 4. Route

- **patch**: a new plan `<spec-dir>/plans/<nn>-<slug>-patch<k>.plan.md` whose tasks start at `## Task 1`, every path marked `modify`, with Files, TDD and Verification; `flow-build` runs it through the loop (`step.mjs init` accepts the story while it is `in-review`; the delivered run is replaced). Never patch by hand.
- **defer**: append to `docs/specs/<slug>/deferred-work.md` with the finding and the reason.
- **spec gap**: the finding contradicts a frozen decision or reveals a missing one: append to `<spec>.changes.md` and tell the human; only they reopen the gate.
- **false / maybe-false**: recorded in the report, nothing else.

`high` and `medium` route only to patch or spec gap; defer takes `low`. A high the human chooses to defer is written by them, not by this stage.

Write `### Review Findings` into the story file: one line per finding with grade, route and location. Run `node <core>/scripts/state.mjs note "review: <n> findings, <p> patched, <d> deferred"`.

## 5. What leaves this stage, by setting

`node <core>/scripts/config.mjs --get review` decides what happens outside the repository (GR-5):

- `review.comment`: `draft` (default) writes the findings as a ready-to-paste comment in the story file and shows it; `post` posts them, after the patch tasks have landed, on the pull request as one comment under the user's account (`gh pr comment`) when the target is a pull request, naming the setting in the output; on the story route no pull request exists yet, so the draft stays in the story file and `flow ship` posts it after `pr`; `off` keeps them in the story file only.
- `review.approve`: `false` (default) never approves; `true` approves a pull request someone else opened, by number (`gh pr review <n> --approve`) under the user's account, only after the patch tasks have landed and nothing high or medium remains, naming the setting in the output; never a bare PR without a verdict trail (`git log --grep "Flow-State:"` on its commits); GitHub refuses approval on the user's own PR, which is reported, not worked around.
- `review.native`: `false` skips section 2.2.
- Merging is never automated by this stage or any other.

## 6. Close

If nothing is high or medium after the patch tasks have landed: story `Status: done`; commit the stage's own bookkeeping (the story file, `deferred-work.md`) as `review: close <story>` with trailer `Flow-State: <story> review-close <token12>`, token12 being the first 12 hex of the sha256 of `git diff <base>..HEAD` for the story; then `node <core>/scripts/state.mjs set reviewed_commit=<sha12 of HEAD> stage=review`. This is what `flow ship` checks. Hand to `flow-ship`. Otherwise back to `flow-build` for the patch tasks. Review one story at a time; a combined review of several stories hides which story a finding belongs to.

## Never

- Never accept a reviewer's severity without opening the location.
- Never apply a fix outside the loop.
- Never treat "no findings" from a native review as evidence the judge was wrong.
