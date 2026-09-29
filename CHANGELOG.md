# Changelog

All notable changes to Flow State. Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: SemVer on the user-facing contract (what a skill accepts and produces).

## [Unreleased]

## [0.2.0] - 2026-09-29

### Added
- Hub verbs: `flow help`, `flow status`, `flow settings` (interactive config, written after confirmation), `flow next` (step mode) and `flow run` (run mode, stops only at gates or when stuck; never below the project's `autonomy`).
- `flow-spec` accepts step and run modes.
- README: how to start, the command table, and what happens at freeze, go and merge.

### Changed
- Spec template guidance moved into HTML comments; the scorer ignores comments. `said` tags carry who and date. Citations must be read in the session.
- Roadmap shifted: stories, build, review in v0.3; design, ship, retro in v0.4.

## [0.1.0] - 2026-09-29

### Added
- `flow-adopt`: one-time project adoption (doc family detection, `flow.config.json`, `.agent/STATE.md`, verified block in `AGENTS.md`/`CLAUDE.md`, lens registration). Never rewrites existing docs.
- `flow-spec`: intent or ticket to a spec with provenance-tagged decisions, script scoring, a fresh-context review, and the freeze gate (at most fifteen lines, then stop until the human says `freeze`).
- `flow-core/templates`: spec, STATE, agents-block. `flow-core/conventions`: simplicity, boundaries, testing, ui-states, no-hardcoding, docs-update-law.
- Scripts: `state.mjs` (init/show/get/set/note) and `spec.mjs` (score/summary/check/freeze/unfreeze), both tested.
- Hooks: session-start hydration, frozen-spec guard, stop check; wired for Claude Code (plugin), Codex and Cursor from one `hooks.spec.json`.
- Installers copy hook scripts and write `hooks.json` for Codex and Cursor when absent.

### Changed
- Hub routes un-adopted projects to `flow-adopt` and names the version that adds each missing stage.

## [0.0.1] - 2026-09-29

### Added
- Repository scaffold: MIT licence, README, CONTRIBUTING, AGENTS.md.
- Manifests for Claude Code (`.claude-plugin/`), Agent Plugins 1.0 (`plugin.json`) and Codex marketplace (`.agents/plugins/marketplace.json`).
- `flow` hub skill: reports the installed tier, classifies an ask by size and risk, and routes to the stage skills that exist.
- `flow-core` shared runtime: four role definitions (builder, judge, spec-reviewer, researcher), config schema and `config.mjs`.
- Adapter generator (`tools/build-adapters.mjs`) producing agent definitions for Claude Code, Codex, Cursor, Copilot and Gemini from one source.
- Validator (`tools/validate.mjs`) for skill frontmatter, manifest version consistency and adapter freshness.
- Installers `install.sh` and `install.ps1` with user or project scope, tool detection, copy-only installs and uninstall.
- CI on Ubuntu and Windows.
