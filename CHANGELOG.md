# Changelog

All notable changes to Flow State. Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: SemVer on the user-facing contract (what a skill accepts and produces).

## [Unreleased]

## [0.6.0] - 2026-10-01

### Added
- Ground rules: `skills/flow-core/ground-rules.md` (ten rules) loaded first by every skill, pasted first into every builder brief and judge package, inlined into every generated agent and the web bundle; `npm run validate` fails on a skill without the loader line.
- First run: `flow` welcomes a new machine with `templates/welcome.md` and four questions (autonomy, review comment, review approve, update policy), written to `~/.flow/config.json`.
- `flow list`, `flow size`, `flow update`, `flow <stage>` dispatch; the hub routes by the architect's S/M/L/XL size.
- Settings: `review.comment` (draft | post | off), `review.approve`, `review.native`, `ship.pr.draft`, `update.policy`, `update.source`, `integrations[]`, `conventions.exclude`, `welcomed`; `x-question`, `x-scope` and `x-team` annotations in the schema; `config.mjs where` and `config.mjs set --scope user|project|personal`; team keys refused in the personal file.
- `flow connect` checks integrations: a catalog (`integrations.json`: github, jira, linear, slack, figma, amplitude, databricks, sentry, playwright) plus company-declared ones (mcp | cli | env | file), MCP server names read from each tool's config, `--only <name>`, found-but-unregistered suggestions, installed version.
- `update.mjs` and `MANIFEST.json`: `flow update` compares installed files by sha256, refuses to overwrite edits or run with an open build, routes to the plugin update, the recorded clone, or `npx skills update`; the installers record `~/.flow/install.json`.
- `flow-review` acts on `review.*`; `flow-ship` opens drafts by default and requires `flow connect --only github` first; `flow-spec` reads tickets only through a connected integration.

### Changed
- `flow-adopt` is `flow-setup` (`flow setup`, `flow setup refresh`); `flow adopt` is accepted until 0.7; installers and the doctor remove or report the stale folder.
- Default autonomy is `assisted`.
- The doctor marks per-tool install rows as optional: an uninstalled tool no longer fails `flow connect`.
- README: positioning, per-tool connect table, commands table, teach-the-agents.

## [0.5.0] - 2026-10-01

### Added
- `flow connect` and `doctor.mjs`: machine, tools, tier per tool, project adoption, config validity, rules found, verify command, ways of working; a fix command per missing item.
- Ways of working: `flow-adopt` discovers CI, PR template, CODEOWNERS, branch protection, deploy and release configuration, asks only the gaps (branching, merge requirements, deploy, release, definition of done, verify, smoke, lenses, autonomy), records them in `flow.config.json` `ship.*` and a Ways of working section of the instructions block; `flow-ship` follows them and stops when they are unrecorded. `flow-adopt refresh` re-reads changed rules.
- `rules.mjs` also collects the PR template and CODEOWNERS.
- README: install, update, the skills-only caveat, clone install for tier A, and the plug/play/learn model.

## [0.4.0] - 2026-10-01

### Added
- `flow-design`: screen inventory per UI story (reference in the project's design system, components, four states with copy, deviation log); never invents a visual language.
- `flow-ship`: verify, smoke, changelog check, visual-gate evidence, PR body or push summary, then the merge gate.
- `flow-retro`: `harvest.mjs` reads committed verdicts, git trailers and story statuses; the retro judges the result against the frozen hypothesis and proposes changes as diffs at project level and flow level (issues labelled `retro`).
- Web planning bundle: `adapters/web/flow-state-planning.md` and `INSTRUCTIONS.md` for ChatGPT GPTs, Claude Projects and Gemini Gems, generated from the same skills.
- Config: `ship.verify`, `ship.smoke`, `design.doc`.

### Changed (from the first real run's retro)
- `step.mjs init` records files that were already dirty; the scope control ignores them unless a task reports them.
- Build plans must end with a docs task when the project's docs law applies, must not use repository-wide commands that already fail outside the task as predicates, and treat documentation TDD phrases as claims the judge checks against the code.
- Review one story at a time.

## [0.3.0] - 2026-09-29

### Added
- `flow-stories`: frozen spec to slice table and story files, scored (`score_story.mjs`, `redflags.mjs`), split, ordered anti-waterfall, reviewed fresh, ending at the go gate.
- `flow-build`: plan with declared Files/TDD/Verification, then the loop driven by `step.mjs`: builder dispatch on a generated brief, controls (scope, TDD presence, verification predicates), review package with a sha256 token and a sealed tree, judge dispatch, `verdict.mjs` schema validation, commit of exactly the sealed tree with the verdict beside the code. Retry budgets and blocked states. Verdicts discarded on schema or hash mismatch.
- `flow-review`: judge plus the host's native review (Claude `/code-review` and `/security-review`, Codex `review-agent`, Cursor `review`/`review-security`, Copilot review) plus project lenses; grading and routing (patch task, defer, spec gap).
- `rules.mjs`: the repository's own rule files (AGENTS.md, CLAUDE.md and imports, .claude/rules, .cursor/rules, Copilot instructions, GEMINI.md, CONTRIBUTING.md, plus `rules.include`) pasted into every brief and package above Flow State conventions. Repository rules win.
- Hook `guard-task`: denies dispatching flow-builder or flow-judge unless the step machine prepared that exact step.
- Templates: stories, story, plan. Config: `rules.include`, `rules.exclude`, `rules.maxBytes`.
- Integration test of a two-task run, including a scope violation and a tampered index.

### Changed
- Spec template: slices live in `<spec>.stories.md` and `<spec>/stories/`, so the frozen file never changes.
- Judge and builder roles state the precedence: repository rules, then conventions, then a linter in Verification wins over both.

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
