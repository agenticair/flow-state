---
name: flow-adopt
description: Adopts a project into Flow State, once. Use when the flow hub says a project has no state file, or the user asks to set up, adopt, or onboard a repository for Flow State. Detects the doc family, writes flow.config.json and .agent/STATE.md, adds a verified block to AGENTS.md or CLAUDE.md, and registers existing review lenses. Never rewrites existing documentation.
license: MIT
metadata:
  version: "0.1.0"
  flow-stage: adopt
---

# flow-adopt

Once per repository. Everything you write is small, additive and reversible; nothing existing is rewritten or deleted.

## 1. Read before proposing

- `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `.cursor/rules/` if present: these hold the rules the project already lives by.
- `docs/` listing and the root `*.md` listing.
- `package.json` scripts (or the equivalent): which command builds, tests, lints.
- `.claude/commands/*.md`, `.claude/agents/*.md`, `.github/agents/*.md`: candidate review lenses.
- `node --version`. Without Node, say so; `flow-spec` and later stages will label their scores `UNVERIFIED`.

Then say in one paragraph what you found: the doc family, the verify command, the rules already present, the lenses. If it is not a git repository, stop; Flow State needs commits.

## 2. Detect the doc family

- `numbered`: files like `docs/01_*.md`, `docs/03_CHANGELOG.md`.
- `flat`: root `CHANGELOG.md`, `DECISIONS.md`, `TECH_SPEC.md` or similar capitalised files.
- Otherwise `custom`, and ask where the changelog and decisions live; write those two paths into `docs.map`.

## 3. Propose, then wait

Show the exact `flow.config.json` you intend to write (schema: `../flow-core/config.schema.json`; defaults are `autonomy: gated`, judge `opus`, builder `sonnet`), the lens entries with triggers you inferred from each lens's own text, and the block you intend to add to the instructions file. Ask: "Write these?" Wait for a yes. In `assisted` or `auto` mode still wait here; adoption is a one-time human decision.

## 4. Write

1. `flow.config.json` at the project root.
2. `node ../flow-core/scripts/state.mjs init --dir <state.dir>` creates `.agent/STATE.md` with `stage: idle`.
3. Append `.agent/` and `flow.config.user.json` to `.gitignore` if absent.
4. Create `<specs.dir>/` if absent (default `docs/specs/`).
5. The verified block, from `../flow-core/templates/agents-block.md`, between `<!-- flow-state:begin -->` and `<!-- flow-state:end -->` markers:
   - into `AGENTS.md` if it exists or if no `CLAUDE.md` exists;
   - into `CLAUDE.md` when that is the only instructions file and it does not import `AGENTS.md`;
   - never both, never a new file when one of them exists.
   Fill every line from what you read in step 1. A line you cannot verify is omitted, not guessed. Stamp the block with today's date and the current commit.
6. Nothing else. Existing instructions stay word for word; if one contradicts Flow State (for example "never write tests"), report it and let the human decide.

## 5. Report

List each file written or changed with one line each, the doc family, the lenses registered, and the next step: `flow-spec` with an intent or a ticket. Offer to commit as `chore: adopt Flow State`.

## Never

- Never delete or rewrite an instruction someone else wrote.
- Never add a rule that a hook, linter or test could enforce instead; say which mechanism should own it.
- Never adopt without the human's yes in step 3.
