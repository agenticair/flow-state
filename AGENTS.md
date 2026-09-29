# Flow State

Portable idea-to-merge workflow for coding agents. This file is for agents and people working ON this repository, not for users of the workflow (see README.md).

## What this repo is

Prompt content plus a few deterministic scripts. Skills under `skills/` are the product. Nothing here is application code.

## Rules

- Skills are content, not code. Before adding logic, ask whether it belongs as a sentence in an existing skill.
- Length is paid on every run. Do not add instructions for exotic cases; the reviewing human corrects those when they happen.
- `SKILL.md` frontmatter uses only the six Agent Skills fields: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. `name` must equal the directory name.
- Never invent. A skill that lacks a fact writes `[⚠️ Pending: define with <who>]`, never a plausible number.
- `agents/` and `adapters/` are generated. Edit `skills/flow-core/roles/*.md` and `hooks/`, then run `npm run build`. CI fails if committed output is stale.
- Scripts get tests (`node --test`). Prompts do not: automated tests assert outcomes of deterministic code only.
- Node 20+ is the only runtime. No Python, no dependencies in `package.json`.
- Bump `version` in `plugin.json` in the same PR as any change to what a user invokes: PATCH for wording, MINOR for a new skill or flag, MAJOR for a rename or a changed input/output. `npm run build` copies the version into the other manifests. Docs-only changes do not bump.

## Verify before pushing

```
npm run check && npm test
```

## Layout

```
skills/           the workflow; each dir is one Agent Skill
skills/flow-core/ shared runtime: roles, conventions, templates, scripts, config schema
hooks/            hook scripts (Node) + hooks.spec.json (source); hooks.json is generated
agents/           generated: Claude Code agent files
adapters/         generated: codex, cursor, copilot, gemini agent files and codex/cursor hooks.json
tools/            maintainer scripts: build-adapters, validate
install.sh / install.ps1   user installers
```
