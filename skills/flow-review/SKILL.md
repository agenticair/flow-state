---
name: flow-review
description: Reviews a story's finished diff, a branch, or a pull request with the judge agent plus the host tool's native review and any project lenses, grades every finding in the parent session, and routes each to patch, defer or spec. Use after flow-build delivers, when the user says review this, or before opening a pull request.
license: MIT
metadata:
  version: "0.5.0"
  flow-stage: review
---

# flow-review

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

- **patch**: a task appended to the story's plan (`## Task N+1`) with Files, TDD and Verification, then `flow-build` runs it through the loop. Never patch by hand.
- **defer**: append to `docs/specs/<slug>/deferred-work.md` with the finding and the reason.
- **spec gap**: the finding contradicts a frozen decision or reveals a missing one: append to `<spec>.changes.md` and tell the human; only they reopen the gate.
- **false / maybe-false**: recorded in the report, nothing else.

Write `### Review Findings` into the story file: one line per finding with grade, route and location. Run `node <core>/scripts/state.mjs note "review: <n> findings, <p> patched, <d> deferred"`.

## 5. Close

If nothing is high or medium after routing: story `Status: done`, `node <core>/scripts/state.mjs set stage=ship`, and hand to `flow-ship`. Otherwise back to `flow-build` for the patch tasks. Review one story at a time; a combined review of several stories hides which story a finding belongs to.

## Never

- Never accept a reviewer's severity without opening the location.
- Never apply a fix outside the loop.
- Never treat "no findings" from a native review as evidence the judge was wrong.
