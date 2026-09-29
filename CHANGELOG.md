# Changelog

All notable changes to Flow State. Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: SemVer on the user-facing contract (what a skill accepts and produces).

## [Unreleased]

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
