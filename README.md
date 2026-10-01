# Flow State

A portable idea-to-merge workflow for coding agents. Spec, freeze, stories, build, judge, ship, retro. The human decides three times; a program checks the rest.

Works in Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and any tool that reads [Agent Skills](https://agentskills.io). Installs on macOS, Windows and Linux.

> **Status: v0.4.0.** Every stage is installed: the `flow` hub (`help`, `status`, `settings`, `next`, `run`), `flow-adopt`, `flow-spec` (freeze gate), `flow-stories` (go gate), `flow-design`, `flow-build` (builder/judge loop on a step machine), `flow-review`, `flow-ship` (merge gate), `flow-retro` (harvested numbers, proposals as diffs); four agent roles; conventions; repository-rules collection; the state file; four hooks (Claude Code, Codex, Cursor); a web planning bundle in `adapters/web/`. Not yet done before a public announcement: see the [ready-to-share checklist](https://github.com/agenticair/flow-state/issues/5). Follow the [changelog](CHANGELOG.md) and the [issues](https://github.com/agenticair/flow-state/issues) for what is planned.

## Why

Coding agents are good at implementation and bad at three things around it: turning an unstated assumption into code, certifying their own work, and remembering where a piece of work is after the context resets. Flow State fixes those with mechanisms, not with longer prompts.

- **A spec you freeze after reading fifteen lines.** Every decision carries where it came from: something you said, something deduced, or something the agent proposed. Proposals are never frozen.
- **A builder that cannot certify and a judge that cannot run.** The builder writes code and tests. The judge has no shell, reads the exact diff by hash, and returns a verdict a script validates. Whoever writes cannot approve; whoever approves cannot run.
- **State in files, not in the conversation.** A new chat, a compaction or a new machine resumes from `.agent/STATE.md`.
- **Never invent.** A missing metric is `[⚠️ Pending: define with <who>]`, routed to a person, never a plausible number.
- **Your repository's rules win.** `AGENTS.md`, `CLAUDE.md` and its imports, `.claude/rules`, `.cursor/rules`, Copilot instructions, `GEMINI.md` and `CONTRIBUTING.md` are collected and pasted into every builder brief and judge package above Flow State's own conventions. A company that installs this gets its own house rules enforced, rule by rule.
- **A retro that proposes diffs.** After a merge, evidence in, small reviewed changes to your conventions out.

The design is distilled from three public systems that run in production: Mercadona Tech's [user story toolkit](https://github.com/josemerca/mercadona-user-story-toolkit) and [Control Tower](https://github.com/josemerca/control-tower-plugin), and the [BMad Method](https://github.com/bmad-code-org/BMAD-METHOD). Where a file was portable, it was borrowed with attribution.

## Install

Pick one route per tool.

```bash
# Skills into every agent you have (needs Node for the CLI itself)
npx skills add agenticair/flow-state

# Native plugin routes
/plugin marketplace add agenticair/flow-state        # inside Claude Code, then /plugin install flow-state@flow-state
codex plugin marketplace add agenticair/flow-state    # Codex

# Full install: skills plus agent roles for each tool found, no runtime needed
curl -fsSL https://raw.githubusercontent.com/agenticair/flow-state/main/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/agenticair/flow-state/main/install.ps1 | iex
```

The installer copies (never symlinks) into user scope by default. It also installs three hooks where the tool supports them: session start hydrates the state file, a guard denies edits to a frozen spec, and a stop check asks for the state file to be updated when commits moved past it. For Codex and Cursor it writes `hooks.json` only if none exists and otherwise prints the entries to merge; for Claude Code the plugin route carries the hooks, and the installer route leaves a snippet to merge into `settings.json`. Scope: `--project` (bash) or `-Project` (PowerShell) installs into the current repository instead. `--uninstall` / `-Uninstall` removes exactly what it added. Node 20+ is optional: without it, skills run but every score and verdict check is labelled `UNVERIFIED`.

Then, in a project, invoke `flow` (`/flow`, `$flow` or `@flow` depending on the tool).

## How to start

1. Install (above) and open your coding tool in a project.
2. Type `flow` (`/flow` in Claude Code, Cursor and Copilot; `$flow` in Codex). It tells you the tier your tool runs at and that the project is not adopted yet.
3. Type `flow settings` if you want to change defaults first (autonomy, models, where specs live). It shows the file and writes it after you say yes.
4. Invoke `flow-adopt`. It reads your repo, proposes `flow.config.json` and a short block for your `AGENTS.md` or `CLAUDE.md`, and writes them after you say yes. Nothing existing is rewritten.
5. Invoke `flow-spec` with an intent, a ticket, or a brief. It investigates the repo before asking you anything, drafts the spec, scores it, has a fresh reviewer check it, then shows you at most fifteen lines and stops.
6. Reply `freeze`. Then `flow next` or `flow run` takes you through stories (you name the story that starts: the **go** gate), build (a builder agent writes, a judge agent with no shell judges, a program checks and commits each task), and review.

### Commands

| Command | Does |
|---|---|
| `flow` / `flow status` | Where the project is, what tier your tool runs at, what comes next |
| `flow help` | Lists commands and stages available in your tool, and the three gates |
| `flow settings` | Interactive config; writes `flow.config.json` after you confirm |
| `flow next` | Runs the next stage in step mode: stops at every checkpoint |
| `flow run` | Runs the next stage in run mode: stops only at a gate or when stuck |
| `flow-adopt`, `flow-spec`, … | The stage skills, invocable directly with your tool's skill syntax |

`next` and `run` are the same path at two speeds. `run` never goes below your `autonomy` setting: with `gated` it behaves like `next`.

### What happens when you freeze

The spec file gets `Status: FROZEN` and a date. A hook denies any edit to it from then on; later changes go to `<slug>.changes.md`, one dated entry each, and only you can reopen the gate. The state file records `stage: spec, gate: freeze`. The next stage, stories, turns the spec into a slice table, and the second gate, **go**, is you choosing which story starts. The third gate, **merge**, is you merging the pull request. Nothing in the flow has a permanent external effect except that merge.

## What you get, per tool

| Tool | Skills | Agent roles (builder with a shell, judge without) | Fidelity |
|---|---|---|---|
| Claude Code | plugin or `.claude/skills/` | `agents/*.md` | A |
| Codex (CLI, ChatGPT app) | `.agents/skills/` | `.codex/agents/*.toml` via the installer (Codex plugins cannot carry agents) | A |
| Cursor | `.agents/skills/` | `.cursor/agents/*.md`, judge marked `readonly` | A |
| GitHub Copilot CLI | `.agents/skills/` | `.github/agents/*.agent.md` | A (adapter experimental) |
| Gemini CLI | `.agents/skills/` | `.gemini/agents/*.md` (Gemini subagents are experimental) | A (adapter experimental) |
| Antigravity (`.agent/skills/`), Devin, OpenCode, Amp, others | `.agents/skills/` via `npx skills add` | roles run by instruction in the main session | B |
| ChatGPT, Claude.ai, Gemini web | `adapters/web/flow-state-planning.md` plus `INSTRUCTIONS.md` | none | C |

**A**: real subagents with different tools, so the writer/judge separation is enforced by the tool. **B**: the same skills and scripts, separation by instruction only; the diff hash and verdict validation still run. **C**: brief, spec, stories and design only; paste the output into your repo and continue in any coding tool.

## The flow

```
Brief → Spec ─[freeze]→ Stories ─[go]→ Design? → Build → Review → Ship ─[merge]→ Retro
```

Three human gates: **freeze** the spec, **go** on a story, **merge** the PR. Everything else is a checkpoint you can tighten or loosen in `flow.config.json` (`autonomy: gated | assisted | auto`). Freeze and merge are never automated.

The `flow` hub sizes the work first: a typo gets no method, a one-session change goes straight to build, an epic gets a spec and stories, a project gets a brief first. Size is one signal; touching auth, billing, data or deployment pushes work up a tier.

## Configure

`flow.config.json` at the project root, plus a git-ignored `flow.config.user.json` for personal overrides. Schema: `skills/flow-core/config.schema.json`. Print the merged result:

```bash
node skills/flow-core/scripts/config.mjs
```

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Retro findings that are general rather than project-specific are the most valuable issues you can open.

## Licence

MIT. See [LICENSE](LICENSE).
