# Contributing to Flow State

Thanks for looking. This repository is prompt content plus a few deterministic scripts. The bar for a change is: does it make a stage ask a better question, refuse a worse shortcut, or check something a model used to guess?

## Ground rules

1. **Skills are content, not code.** Before adding a script, ask whether a sentence in an existing skill does the job.
2. **Length is paid on every run.** Do not add instructions for exotic cases. The human reviewing the output corrects those when they happen.
3. **Never invent.** A skill that lacks a fact writes `[⚠️ Pending: define with <who>]` or `[NEEDS CLARIFICATION]`. Never a plausible number, quote or metric.
4. **Six frontmatter fields only** in any `SKILL.md`: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. This is what keeps one skill loadable in every tool. `name` equals the directory name.
5. **Edit sources, not outputs.** `agents/` and `adapters/` are generated from `skills/flow-core/roles/*.md`. Run `npm run build` after editing a role and commit the result. CI rejects stale output.
6. **Tests for scripts, never for prompts.** `node --test` covers `tools/` and `skills/flow-core/scripts/`. Do not write assertions on model output.
7. **Node 20+ only.** No Python, no npm dependencies. Skills must still work without Node; anything a script would have verified is then labelled `UNVERIFIED`.
8. **Nothing project-specific.** Your team's conventions belong in your project's `flow.config.json` and `AGENTS.md`, not here. Ship a general mechanism, not your house rule.

## Making a change

```
git clone https://github.com/agenticair/flow-state
cd flow-state
npm run check && npm test
```

Try a skill before you change it: `claude --plugin-dir .` in any project, or copy the skill into `.agents/skills/` for Codex, Cursor or Copilot.

Open a pull request with:

- one change per PR;
- a `CHANGELOG.md` entry under Unreleased;
- a version bump in `plugin.json` if a user-invoked thing changed: PATCH for wording and fixes with the same inputs and outputs, MINOR for a new skill, flag, role or template, MAJOR for a rename, a removed skill, or changed inputs or outputs. `npm run build` copies the version into the other manifests. Docs-only changes do not bump;
- for a new or changed skill, one real run you did, described in three lines: the input, what the skill asked, what it produced. A run in a second tool is welcome.

## Adding a tool adapter

Add the target to `tools/build-adapters.mjs` (agent format), `install.sh` and `install.ps1` (destination directories), the table in `README.md`, and a test in `tests/adapters.test.mjs`. Cite the official documentation page for the format in the PR.

## Reporting a retro finding

If a `flow-retro` run in your project produced a proposal that is general rather than project-specific, open an issue titled `retro: <one line>` with the finding, the evidence, and the proposed diff. That is how the flow itself improves.

## Licence

By contributing you agree your contribution is licensed under the MIT licence in `LICENSE`.
