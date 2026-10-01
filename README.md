# Flow State

A portable idea-to-merge workflow for coding agents. Spec, freeze, stories, build, judge, ship, retro. The human decides three times; a program checks the rest.

Works in Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and any tool that reads [Agent Skills](https://agentskills.io). Installs on macOS, Windows and Linux.

> **Status: v0.5.0.** Every stage is installed: the `flow` hub (`help`, `status`, `settings`, `next`, `run`), `flow-adopt`, `flow-spec` (freeze gate), `flow-stories` (go gate), `flow-design`, `flow-build` (builder/judge loop on a step machine), `flow-review`, `flow-ship` (merge gate), `flow-retro` (harvested numbers, proposals as diffs); four agent roles; conventions; repository-rules collection; the state file; four hooks (Claude Code, Codex, Cursor); a web planning bundle in `adapters/web/`. Not yet done before a public announcement: see the [ready-to-share checklist](https://github.com/agenticair/flow-state/issues/5). Follow the [changelog](CHANGELOG.md) and the [issues](https://github.com/agenticair/flow-state/issues) for what is planned.

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

```bash
npx skills add agenticair/flow-state
```

Pick the skills and the editors you use. You need git and Node 20+; `gh` is optional (tickets, pull requests, retro issues). Works in PowerShell, Git Bash and WSL: every script is Node.

Then run `flow connect` in your project: it checks git, node, gh, which tools you have, whether the skills, agent roles and hooks are installed in each, whether the project is adopted, and tells you how to fix anything missing.

Update anytime with `npx skills update`.

**`npx skills add` installs the skills only: no agent roles and no hooks.** Without the roles, the judge runs as an ordinary assistant with a shell and nothing stops an edit to a frozen spec (tier B). For tier A, install from a clone or a plugin route:

```bash
git clone https://github.com/agenticair/flow-state && cd flow-state && ./install.sh
```

```powershell
git clone https://github.com/agenticair/flow-state; cd flow-state; .\install.ps1
```

That copies the skills, the agent roles (builder with a shell, judge without) and the hook scripts for every tool it finds, writes `hooks.json` for Codex and Cursor when none exists, and prints the settings snippet for Claude Code. `git pull` then re-running the installer updates it. `--project` / `-Project` installs into the current repository instead of your user profile; `--uninstall` / `-Uninstall` removes exactly what was added.

Native plugin routes carry roles and hooks where the tool allows:

```text
/plugin marketplace add agenticair/flow-state      # Claude Code, then /plugin install flow-state@flow-state
codex plugin marketplace add agenticair/flow-state  # Codex: skills only; run the installer for roles and hooks
```

## Plug, play, learn

The flow is not plug-and-play for a company's way of working, and it does not pretend to be. Three layers make it fit:

1. **Discover.** `flow-adopt` reads what the repository already says: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, Copilot and Cursor rules, the PR template, CODEOWNERS, CI workflows, deploy config, branch names and protection, the scripts in `package.json`. Those rules are pasted into every builder brief and judge package above Flow State's own conventions; repository rules win, rule by rule.
2. **Ask.** What cannot be read is asked once, with the discovered default proposed: branching model, what must be green before a merge and who reviews, how a merge reaches production and through which environments, versioning and release notes, the definition of done, the verify and smoke commands, autonomy. The answers go to `flow.config.json` (`ship.*`) and to a Ways of working section in the project's instructions file, so every agent and every human reads the same thing. `flow-ship` follows it and refuses to guess: an unrecorded way of working stops the merge gate.
3. **Learn.** `flow-retro` harvests the numbers from every build and proposes concrete diffs to the project's rules, lenses and config; the human accepts each. `flow-adopt refresh` re-reads the rules when they change. General lessons become issues on this repository.

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
