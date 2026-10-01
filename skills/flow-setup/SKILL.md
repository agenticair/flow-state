---
name: flow-setup
description: Stage setup of Flow State (type "flow setup"). Sets a repository up once, and refreshes it later with "flow setup refresh". Discovers the repo's own rules and how it ships, asks only what it cannot discover, writes flow.config.json, .agent/STATE.md and a verified block in AGENTS.md or CLAUDE.md, registers review lenses and integrations. Never rewrites existing documentation. ("flow adopt" is accepted as an alias until 0.7.)
license: MIT
metadata:
  version: "0.7.0"
  flow-stage: setup
---

# flow-setup

Ground rules: read `../flow-core/ground-rules.md` first; nothing below overrides them.

Plug, then learn. The flow is not plug-and-play for a company's way of working; this is where it learns it. Everything written is small, additive and reversible; nothing existing is rewritten or deleted. `<core>` is `../flow-core`.

## 0. Connect first

`node <core>/scripts/doctor.mjs` reports the machine, the tools, the project and the integrations, with a fix per missing item. Show its output. If the project is not a git repository, stop.

## 1. Discover before asking (read-only)

Read, and keep notes with `path:line`:

- **Rules for agents**: `node <core>/scripts/rules.mjs --list` (AGENTS.md, CLAUDE.md and imports, `.claude/rules`, `.cursor/rules`, Copilot instructions, GEMINI.md, CONTRIBUTING.md, the PR template, CODEOWNERS).
- **How this repository ships**: `.github/workflows/*` or other CI files (what runs, on which branches, what must be green); `.github/PULL_REQUEST_TEMPLATE.md`; `CODEOWNERS`; branch names (`git branch -r`), whether the default branch is protected (`gh api repos/{owner}/{repo}/branches/<default>/protection` and `gh api repos/{owner}/{repo}/rules/branches/<default>` when `gh` is signed in; a non-empty rules array means protected; a 403, or a 404 from a non-admin, is unknown and becomes a question in step 2, never a discovered default); release files (`CHANGELOG.md`, tags, `package.json` version, a release workflow); deploy configuration (`railway.json`, `vercel.json`, Dockerfiles, `fly.toml`, deploy workflows); environments named in config or docs.
- **How it is built and tested**: `package.json` scripts or the equivalent; lint, typecheck, test, e2e; whether lint, typecheck and unit tests fail at HEAD (run only those once; a command that already fails is not a verification predicate). E2e, smoke and any script that references an env var or a URL are listed as "not run" and asked in step 2.
- **Integrations in use**: the `found but not registered` line from the doctor; `.env.example` variable names (names only); `secrets.*` in CI files; the ticket system named in the PR template or CONTRIBUTING.
- **Docs family**: `numbered` (`docs/01_*.md`), `flat` (root `CHANGELOG.md`, `DECISIONS.md`…), else `custom`.
- **Design authority**: `DESIGN_SYSTEM.md`, `docs/*DESIGN*.md`, `docs/*CANON*.md`, a tokens file.
- **Review lenses**: `.claude/commands/*.md`, `.claude/agents/*.md`, `.github/agents/*.md`, `.cursor/agents/*.md`.

Say in one paragraph what you found and what you could not.

## 2. Ask only the gaps, as numbered questions with the discovered default

At most nine questions, each with what you inferred as the proposed answer (`node <core>/scripts/config.mjs where --json` gives `machineDefaults`, the review answers from this machine's welcome, as the proposed answer to question 3):

1. Branching: direct push to `<default>`, no pull request, or pull request into `<default>`, and the branch naming? Propose pull requests whenever a PR template, CODEOWNERS or protection was found; if the human still chooses direct push in that case, print one line that CODEOWNERS and required checks will not run and require an explicit yes.
2. What must be green before a merge: which checks; is a human review required and from whom (CODEOWNERS, a team, anyone)?
3. Pull requests: open them as drafts (default yes); after a review, draft the findings for you, post them as one comment, or keep them in the story file (machine default proposed); may Flow State approve when nothing high or medium remains (default no; merging is never automated)?
4. How a change reaches production: automatic on merge, a manual deploy command, a release tag, a scheduled train? Which environments, in order?
5. Versioning and release notes: changelog file, bump rule, tags, release workflow?
6. Definition of done beyond green tests: docs updated, screenshots for UI, migration notes, feature flags?
7. The verify command Flow State runs before the merge gate, and a smoke command if one exists.
8. Integrations this loop needs: the ticket system (`ticket.source`), and which of the found systems (Jira, Linear, Slack, Figma, Amplitude, Databricks, Sentry, your own) are required; a company's own system needs a `kind` (mcp, cli, env, file).
9. Review lenses to run and on what triggers; autonomy (`gated`, `assisted`, `auto`).

Wait for the answers. In every autonomy mode, setup waits here: it is a one-time human decision.

## 3. Propose, then write after a yes

Show the exact `flow.config.json` (schema `<core>/config.schema.json`): `ship.branching`, `ship.defaultBranch`, `ship.branchPattern`, `ship.pr` (template, requiredChecks, reviewers, labels, draft), `ship.deploy`, `ship.environments`, `ship.release`, `ship.done`, `ship.verify`, `ship.smoke`, `review.comment`, `review.approve`, `review.native`, `ticket.source`, `integrations`, `docs.family` and map, `design.doc`, `lenses`, `autonomy`; and the block for the instructions file from `<core>/templates/agents-block.md`, whose **Ways of working** section states the answers in prose an agent can follow. Then:

1. `flow.config.json` at the project root (`review.*` goes here so the team file wins over any personal file).
2. `node <core>/scripts/state.mjs init --dir <state.dir>`.
3. `.agent/` and `flow.config.user.json` appended to `.gitignore` if absent; `<specs.dir>/` created.
4. The block between `<!-- flow-state:begin -->` and `<!-- flow-state:end -->`: into `AGENTS.md` if it exists or no `CLAUDE.md` exists; into `CLAUDE.md` when that is the only instructions file and it does not import `AGENTS.md`; never both, never a new file when one exists. Every line verified in step 1; a line you cannot verify is omitted. Stamp the date and the commit.
5. Nothing else. Existing instructions stay word for word; a contradiction with Flow State is reported, not resolved.

Run `node <core>/scripts/doctor.mjs` again so the user sees the integrations they declared, with fixes for any still missing. Offer to commit as `chore: set up Flow State`.

## 4. Refresh

With `refresh`: read the SHA stamped in the block; `git log --diff-filter=ADMR --name-only <sha>..HEAD -- <the rule files, CI, PR template, CODEOWNERS, package.json>`; re-run step 1 on what changed; propose the block and config updates as a diff; write after a yes; restamp. Retro proposals that touch the block go through the same path.

## Never

- Never delete or rewrite an instruction someone else wrote.
- Never add a rule a hook, linter or test could enforce; say which mechanism should own it.
- Never guess a way of working; a gap the human does not answer is recorded as `[⚠️ Pending: define with <who>]` in the block, and `flow ship` stops on it.
