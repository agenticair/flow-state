# Flow State: packaging plan for any agent, any OS, any contributor

Date: 2026-09-29. Facts verified against official docs on this date (Claude Code, Codex, Copilot, Cursor, Gemini CLI, Devin/Windsurf, OpenCode, Amp, agentskills.io, agents.md, vercel-labs/skills) and against the Codex and Cursor built-in skills installed on this machine.

## 1. The facts that decide the layout

1. **Skills are the one portable unit.** The Agent Skills spec (`SKILL.md` with `name`, `description`, and optionally `license`, `compatibility`, `metadata`, `allowed-tools`) is read natively by Claude Code, Codex, Cursor, Copilot, Gemini CLI, Devin, OpenCode, Amp and about forty more. Only those six frontmatter fields are safe everywhere; Claude Code and Cursor add extras that other tools ignore, and Claude's own uploader rejects unknown keys.
2. **`.agents/skills/` is the shared project directory** for every tool except Claude Code, which reads only `.claude/skills/`. `AGENTS.md` is the shared instruction file for every tool except Claude Code, which wants `CLAUDE.md` containing `@AGENTS.md`.
3. **Subagents exist in five incompatible formats**: Claude Code Markdown with `tools:`/`model:`; Codex TOML with `developer_instructions`; Copilot `.agent.md`; Cursor/Gemini/OpenCode Markdown with different field names (Cursor has `readonly: true`, which is exactly the judge); Amp needs TypeScript. Codex plugins cannot carry agents at all; Codex agents live in `.codex/agents/`.
4. **Hooks are the least portable layer.** Claude Code and Codex share the same JSON vocabulary (`PreToolUse`, `permissionDecision`, exit 2 blocks). Cursor uses camelCase events and a `permission` field. Copilot wants a `bash` and a `powershell` command per hook. Gemini uses `BeforeTool`/`AfterTool` in settings. OpenCode and Amp only accept code plugins.
5. **No runtime can be assumed.** Claude Code, Codex, Copilot and OpenCode ship native binaries; only Gemini CLI requires Node. Nobody requires Python. PowerShell is on every Windows machine; bash is not.
6. **Three plugin manifests can coexist in one repo** because they live in different files: `.claude-plugin/plugin.json` + `marketplace.json` (Claude), root `plugin.json` in the Agent Plugins 1.0 schema (Codex, Cursor, Copilot, VS Code), `gemini-extension.json` (Gemini). The Vercel `skills` CLI discovers `skills/` and `.claude-plugin/marketplace.json` without any manifest.
7. **Web chat has no filesystem.** ChatGPT GPTs, Claude Projects and Gemini Gems take knowledge files plus instructions. BMAD ships "web bundles" this way: one instruction block to paste, a few Markdown files to upload. Limits are generous (Claude 30 MB per file, GPTs 2M tokens per file, Gems 10 files).
8. **On this machine** you already run Claude Code, Codex (through the ChatGPT app, with the agenticair worker skills symlinked into `~/.codex/skills`), Cursor, and Antigravity. That is the first test matrix.

## 2. Design principle: one source of truth, generated adapters

Everything a human edits lives once. Everything a tool needs in its own dialect is generated from that source and committed, so users never run a build step.

```
flow-state/                                  public git repo, MIT
├── README.md  CONTRIBUTING.md  LICENSE  CHANGELOG.md  AGENTS.md  CLAUDE.md (= @AGENTS.md)
├── plugin.json                              Agent Plugins 1.0 manifest (Codex, Cursor, Copilot, VS Code)
├── .claude-plugin/plugin.json               Claude Code plugin manifest
├── .claude-plugin/marketplace.json          so `/plugin marketplace add agenticair/flow-state` works
├── .agents/plugins/marketplace.json         so `codex plugin marketplace add agenticair/flow-state` works
├── gemini-extension.json                    Gemini CLI extension (phase 3)
│
├── skills/                                  SOURCE OF TRUTH 1: the workflow (Agent Skills spec, six fields only)
│   ├── flow/            hub: tier chooser, stage detection, routing, questions
│   ├── flow-adopt/      once per project: state file, doc family, verified AGENTS.md block, config
│   ├── flow-spec/       intent or ticket -> spec -> freeze gate
│   ├── flow-stories/    spec -> slice table + stories, scored, split, ordered
│   ├── flow-design/     UI story -> screen inventory, four states, handoff
│   ├── flow-build/      story -> plan -> builder -> controls -> judge -> commit
│   ├── flow-review/     any diff or PR -> package -> judge + lenses -> triage
│   ├── flow-ship/       pre-merge checks, changelog, visual gate, PR body
│   ├── flow-retro/      after merge: evidence -> findings -> proposals (the self-improving loop)
│   └── flow-core/       shared, never invoked directly:
│       ├── conventions/     the yardstick pasted into every builder brief
│       ├── templates/       spec, story, slice table, screen, brief, review package, STATE, retro
│       ├── roles/           SOURCE OF TRUTH 2: builder.md, judge.md, spec-reviewer.md, researcher.md
│       │                    (persona text + a small header: tools policy, model tier, receives, returns)
│       ├── scripts/         Node, zero dependencies: score_spec, score_story, redflags, check_verdict,
│       │                    step (state machine), package (diff + sha256), config (merge + print)
│       └── config.schema.json
│
├── hooks/                                   SOURCE OF TRUTH 3: hook logic as pure Node functions
│   ├── session-start.mjs  stop.mjs  guard-frozen.mjs  guard-task.mjs
│   └── hooks.json                           Claude Code format (also valid for Codex plugins)
│
├── agents/                                  GENERATED from roles/: Claude Code format (also read by Cursor)
├── adapters/                                GENERATED, committed:
│   ├── codex/agents/*.toml   codex/hooks.json
│   ├── cursor/agents/*.md    cursor/hooks.json
│   ├── copilot/agents/*.agent.md   copilot/hooks/*.json (bash + powershell)
│   ├── gemini/agents/*.md    gemini/hooks.json
│   └── web/                  flow-state-planning.md + INSTRUCTIONS.md (GPT / Gem / Claude Project)
│
├── install.sh  install.ps1                  zero-dependency installers (detect tools, copy, never symlink)
├── tools/                                   maintainer scripts: build-adapters.mjs, validate.mjs, bundle-web.mjs, release.mjs
├── examples/test-ticket/                    a tiny app + one ticket run end to end, every artifact kept
├── tests/                                   node --test for scripts and adapters only (never for LLM output)
└── .github/workflows/                       validate, build-adapters (fail if stale), test on ubuntu + windows, release on tag
```

Why skills hold the roles rather than `agents/`: `agents/` is a Claude dialect. `roles/*.md` is plain prose with a tiny header; `build-adapters.mjs` turns it into all five agent formats. Tools without subagents still get the role text through the skill ("adopt the judge role, using only the package file").

## 3. How each tool gets the flow

| Tool | Install | Skills | Roles as real subagents | Hooks | Notes |
|---|---|---|---|---|---|
| Claude Code | `/plugin marketplace add agenticair/flow-state` then `/plugin install flow-state` | plugin `skills/` | `agents/*.md` (builder Sonnet + Bash; judge Opus, no Bash) | `hooks/hooks.json` | full fidelity; the reference implementation |
| Codex (CLI, ChatGPT app) | `codex plugin marketplace add agenticair/flow-state` for skills; `install.sh`/`.ps1` adds agents + hooks | `.agents/skills/` | `.codex/agents/*.toml` (plugins cannot carry agents) | `.codex/hooks.json` (Claude-compatible JSON) | `agents/openai.yaml` sidecar per skill for the ChatGPT skill picker |
| Cursor | Cursor marketplace or `npx skills add` + installer | `.agents/skills/` | `.cursor/agents/*.md`, judge `readonly: true` | `.cursor/hooks.json` | Cursor also reads `.claude/agents/` |
| Copilot CLI | `npx skills add` + installer | `.agents/skills/` | `.github/agents/*.agent.md` | `.github/hooks/*.json` | hooks need bash and powershell pairs; generated |
| Gemini CLI | `gemini extensions install <repo>` | `.agents/skills/` | `.gemini/agents/*.md` (experimental) | `settings.json` hooks | `GEMINI.md` must be told to read `AGENTS.md` |
| Antigravity, Devin, OpenCode, Amp, others | `npx skills add agenticair/flow-state` | `.agents/skills/` | no: roles run by instruction in the main session | none | scripts still validate verdicts; judge separation is by prompt, and the skill says so |
| ChatGPT, Claude.ai, Gemini web | upload `adapters/web/` | planning bundle only | no | none | Brief, Spec, Stories, Design; outputs pasted into the repo, then any coding tool continues |

Three fidelity tiers, stated in the README so nobody is surprised: **A** (subagents + hooks: Claude Code, Codex, Cursor, Copilot, Gemini), **B** (skills + scripts, roles by instruction), **C** (web, planning only).

## 4. Install story

One command per audience, all cross-platform:

```
# Skills into whatever agents you have (Node required by the CLI itself)
npx skills add agenticair/flow-state

# Native plugin routes
/plugin marketplace add agenticair/flow-state            # Claude Code
codex plugin marketplace add agenticair/flow-state       # Codex
gemini extensions install https://github.com/agenticair/flow-state

# Full install (skills + agents + hooks, no runtime needed to run the installer)
curl -fsSL https://raw.githubusercontent.com/agenticair/flow-state/main/install.sh | bash
irm https://raw.githubusercontent.com/agenticair/flow-state/main/install.ps1 | iex
```

The installer: detects which tools are present (`~/.claude`, `~/.codex`, `~/.cursor`, `~/.copilot`, `~/.gemini`), asks user-scope or project-scope, copies (never symlinks, for Windows), writes the per-tool agent and hook adapters, checks for Node 20+ and says plainly which features degrade without it, and prints what it did and how to undo it (`--uninstall`). Then, inside any project, `flow adopt` does the per-project part.

Runtime decision: **Node 20+ is the one optional runtime**, for scripts and hooks. No Python (nobody requires it; the Mercadona `.py` scripts get ported to `.mjs`). Without Node, skills still work; scores are computed by the model and stamped `UNVERIFIED (no node)`, and the judge verdict cannot be validated, which the skill reports rather than hides.

## 5. Settings

`flow.config.json` at project root (committed) merged with `flow.config.user.json` (git-ignored), validated by `flow-core/config.schema.json`, printed by `scripts/config.mjs` so the agent and the human see the same merged result.

| Key | Values | Default |
|---|---|---|
| `autonomy` | `gated` (every checkpoint), `assisted` (only the three gates), `auto` (build runs unattended; freeze and merge still human) | `gated` |
| `models.builder` / `models.judge` | tool-specific ids or tiers | `sonnet` / `opus` |
| `docs.family` | `flat`, `numbered`, or a map of role to path | detected by `flow-adopt` |
| `specs.dir`, `state.dir` | paths | `docs/specs`, `.agent` |
| `lenses` | list of `{name, path, triggers[]}` | discovered from `.claude/commands`, `.github/agents`, etc. |
| `ticket.source` | `github`, `linear`, `jira`, `none` | `github` if `gh` is authenticated |
| `retro.apply` | `propose` (write proposals, human accepts), `pr` (open a PR), `auto` | `propose` |
| `language` | output language | `en` |

The "run feature more" the user asked for is `autonomy: auto`: the build stage runs every task without stopping, halts with a blocking reason instead of asking, and marks `followup_review_recommended` when it patched anything high. Gates 1 and 3 are never automated in any mode.

## 6. Ticket to retro, and the self-improving loop

Entry: `flow` accepts a ticket URL or key (`#123`, `LIN-42`, a Jira key), pulls it with `gh` or the tool's MCP, and treats it as the intent. The spec cites it; every story and PR links back to it; `flow-ship` writes `Closes #123` in the PR body.

Retro (`flow-retro`), run after merge or after an epic: reads the frozen spec, the stories, the verdicts committed beside the code, the git evidence and the PR review comments, and writes `docs/retros/<date>-<slug>.md` with three sections. Findings with sources (what the judge caught, what a human caught after the judge, what the spec missed). Numbers (verdict vetoes, findings by rule, time per stage) harvested by script, never typed. Proposals, each a concrete diff: a pitfall line for the project's `AGENTS.md` block, a convention amendment, a lens trigger, a template change. In `propose` mode a human accepts each; nothing changes silently. Proposals that are general rather than project-specific are formatted as an issue for the flow-state repo so contributors improve the flow itself. That is the whole self-improvement mechanism: evidence in, small reviewed diffs out.

## 7. Is there an orchestration layer?

Not a separate process. Orchestration is three things, and they are deliberately boring: the hub skill in the main session decides the stage; the step script decides the next action inside a build and refuses out-of-order steps; hooks refuse the two moves that silently break the sequence. In tier-A tools the roles run as real subagents with restricted tools. In tier-B tools the main session plays the roles in sequence, and the only guarantee left is the script-validated verdict and the diff hash. The README says which guarantee holds where.

## 8. Public repo, contribution, release

- **Public, MIT, from the first commit.** All three sources are public MIT. A private repo breaks `npx skills add` and every marketplace for anyone but you, and makes contribution impossible. Nothing project-specific goes in the repo; your projects' conventions stay in your projects.
- **Owner**: the `agenticair` GitHub account (already authenticated here), repo `agenticair/flow-state`.
- **CONTRIBUTING.md** states the ground rules that came out of the analysis: skills are content, not code; never add a rule for an exotic case ("length is paid on every run"); six frontmatter fields only; `agents/` and `adapters/` are generated, edit `roles/` and `hooks/`; scripts get tests, prompts do not; bump `plugin.json` version on any change to what a user invokes (PATCH wording, MINOR new skill or flag, MAJOR rename or changed input/output); one PR per change with the version bump in it.
- **CI**: validate every skill (`skills-ref validate`), `claude plugin validate`, rebuild adapters and fail if the committed ones are stale, run script tests on ubuntu and windows, run `install.ps1` on windows-latest. On a version tag: GitHub Release with notes, `adapters/web/` zipped as a release asset.
- **Versioning**: `plugin.json` is the single version; `build-adapters.mjs` copies it into the Claude, Codex and Gemini manifests.

## 9. Test plan

1. Script tests (`node --test`): scoring bands, red-flag word boundaries, verdict schema rejections, step machine transitions including out-of-order refusal, diff-hash mismatch, config merge.
2. `examples/test-ticket/`: a small Node app with one ticket ("add a rate limit to the login route" or similar) run through spec, freeze, stories, design (none), build, judge, ship, retro on Claude Code, every artifact committed as the reference walkthrough (Mercadona's `searchmo-facets` pattern).
3. Cross-tool checklist on this machine: the same ticket on Codex and Cursor; confirm skills load, agents dispatch, hooks fire, and where they do not, the skill reports the degraded tier.
4. Windows: CI runs the installer and scripts; a manual pass on a Windows machine before v0.1.0 (you or a contributor).
5. Then the real pilot on your project.

## 10. Phases (revised)

| Phase | Deliverable | Done when |
|---|---|---|
| 0 Scaffold | repo, licence, README, CONTRIBUTING, manifests, installers, adapter generator, CI, rotate the two tokens | `npx skills add` and `/plugin marketplace add` both install an empty-but-valid plugin on this machine |
| 1 Core | hub, adopt, spec, conventions, templates, STATE, config, Node scripts for spec scoring, hooks for Claude + Codex + Cursor | one real spec written and frozen on inkcognito (or the test ticket) in Claude Code |
| 2 Build loop | stories, build, review, roles in all formats, verdict check, step machine, package script, BMAD review lenses, test-ticket example | one story built, judged and committed on the test ticket; same run repeated in Codex and Cursor |
| 3 Round trip | design, ship, retro, autonomy modes, web bundle, Gemini and Copilot adapters | ticket to retro on the test ticket; a retro proposal accepted into the example's AGENTS.md |
| 4 Release | v0.1.0 tag, release assets, README polish, first pilot on your project, share | someone else installs it from the README without asking you anything |

## 11. Decisions to confirm

1. Public MIT repo under `agenticair/flow-state` from the first commit (recommended), or start private and open later.
2. Node 20+ as the single optional runtime; port the Python scripts. (Recommended yes.)
3. Default `autonomy: gated`; `auto` opt-in. (Recommended yes.)
4. Skill prefix `flow-` and the hub simply named `flow`, so users type `flow` or `$flow` or `/flow` depending on the tool.
5. First tier-B/C targets after the big five: Antigravity (you have it) and the web bundle, or skip until asked.
