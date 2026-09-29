# Flow State

A portable idea-to-merge workflow for coding agents. Spec, freeze, stories, build, judge, ship, retro. The human decides three times; a program checks the rest.

Works in Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and any tool that reads [Agent Skills](https://agentskills.io). Installs on macOS, Windows and Linux.

> **Status: v0.0.1, scaffold.** The `flow` hub and the four agent roles are here. The stage skills arrive in this order: `flow-adopt` and `flow-spec` (v0.1), `flow-stories`, `flow-build`, `flow-review` (v0.2), `flow-design`, `flow-ship`, `flow-retro` (v0.3). Follow the [changelog](CHANGELOG.md).

## Why

Coding agents are good at implementation and bad at three things around it: turning an unstated assumption into code, certifying their own work, and remembering where a piece of work is after the context resets. Flow State fixes those with mechanisms, not with longer prompts.

- **A spec you freeze after reading fifteen lines.** Every decision carries where it came from: something you said, something deduced, or something the agent proposed. Proposals are never frozen.
- **A builder that cannot certify and a judge that cannot run.** The builder writes code and tests. The judge has no shell, reads the exact diff by hash, and returns a verdict a script validates. Whoever writes cannot approve; whoever approves cannot run.
- **State in files, not in the conversation.** A new chat, a compaction or a new machine resumes from `.agent/STATE.md`.
- **Never invent.** A missing metric is `[⚠️ Pending: define with <who>]`, routed to a person, never a plausible number.
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

The installer copies (never symlinks) into user scope by default; `--project` (bash) or `-Project` (PowerShell) installs into the current repository instead. `--uninstall` / `-Uninstall` removes exactly what it added. Node 20+ is optional: without it, skills run but every score and verdict check is labelled `UNVERIFIED`.

Then, in a project, invoke `flow` (`/flow`, `$flow` or `@flow` depending on the tool).

## What you get, per tool

| Tool | Skills | Agent roles (builder with a shell, judge without) | Fidelity |
|---|---|---|---|
| Claude Code | plugin or `.claude/skills/` | `agents/*.md` | A |
| Codex (CLI, ChatGPT app) | `.agents/skills/` | `.codex/agents/*.toml` via the installer (Codex plugins cannot carry agents) | A |
| Cursor | `.agents/skills/` | `.cursor/agents/*.md`, judge marked `readonly` | A |
| GitHub Copilot CLI | `.agents/skills/` | `.github/agents/*.agent.md` | A (adapter experimental) |
| Gemini CLI | `.agents/skills/` | `.gemini/agents/*.md` (Gemini subagents are experimental) | A (adapter experimental) |
| Antigravity, Devin, OpenCode, Amp, others | `.agents/skills/` | roles run by instruction in the main session | B |
| ChatGPT, Claude.ai, Gemini web | planning bundle (v0.3) | none | C |

**A**: real subagents with different tools, so the writer/judge separation is enforced by the tool. **B**: the same skills and scripts, separation by instruction only; the diff hash and verdict validation still run. **C**: brief, spec, stories and design only; paste the output into your repo and continue in any coding tool.

## The flow

```
Brief → Spec ─[freeze]→ Stories ─[go]→ Design? → Build → Review → Ship ─[merge]→ Docs → Retro
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
