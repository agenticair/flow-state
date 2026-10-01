# Flow State

An orchestration layer for your coding agent. It takes a piece of work from idea to merged pull request (spec, stories, build, review, ship, retro) and automates most of it. You keep three decisions: freeze the spec, go on a story, merge the pull request. A program checks the rest.

It is built for the product person who today relays between a ticket, a chat window and a reviewer. With Flow State you orchestrate instead: you say what the work is, you answer the questions the repository cannot, and you approve at three points. Agents with different powers do the rest, and every one of them reads your repository's own rules before it reads Flow State's.

Works in Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and any tool that reads [Agent Skills](https://agentskills.io). Installs on macOS, Windows and Linux.

> **Status: v0.6.0.** Every stage is installed and has run end to end on a real project. Not yet done before a public announcement: see the [ready-to-share checklist](https://github.com/agenticair/flow-state/issues/5). Follow the [changelog](CHANGELOG.md) and the [issues](https://github.com/agenticair/flow-state/issues) for what is planned.

## Why

Coding agents are good at implementation and bad at three things around it: turning an unstated assumption into code, certifying their own work, and remembering where a piece of work is after the context resets. Flow State fixes those with mechanisms, not with longer prompts.

- **A spec you freeze after reading fifteen lines.** Every decision carries where it came from: something you said, something deduced, or something the agent proposed. Proposals are never frozen.
- **A builder that cannot certify and a judge that cannot run.** The builder writes code and tests. The judge has no shell, reads the exact diff by hash, and returns a verdict a script validates. Whoever writes cannot approve; whoever approves cannot run.
- **State in files, not in the conversation.** A new chat, a compaction or a new machine resumes from `.agent/STATE.md`.
- **Ten ground rules every agent reads first.** Never invent, read before you ask, the state on disk beats memory, nothing leaves the machine without your word, secrets are never printed. They are pasted into every brief, every review package and every generated agent. See [`skills/flow-core/ground-rules.md`](skills/flow-core/ground-rules.md).
- **Your repository's rules win.** `AGENTS.md`, `CLAUDE.md` and its imports, `.claude/rules`, `.cursor/rules`, Copilot instructions, `GEMINI.md`, `CONTRIBUTING.md`, the PR template and CODEOWNERS are collected and pasted into every builder brief and judge package above Flow State's own conventions. A company that installs this gets its own house rules enforced, rule by rule.
- **An architect sizes the work first.** S goes straight to build and review; M gets a short frozen spec; L gets the full loop; XL gets a brief first. Anything touching auth, billing, data or deployment moves up a size.
- **A retro that proposes diffs.** After a merge, evidence in, small reviewed changes to your conventions out.

The design is distilled from three public systems that run in production: Mercadona Tech's [user story toolkit](https://github.com/josemerca/mercadona-user-story-toolkit) and [Control Tower](https://github.com/josemerca/control-tower-plugin), and the [BMad Method](https://github.com/bmad-code-org/BMAD-METHOD). Where a file was portable, it was borrowed with attribution.

## Install

You need git and Node 20+. `gh` is needed for tickets, pull requests and retro issues on GitHub.

**Quick (skills only, every tool):**

```bash
npx skills add agenticair/flow-state
```

**Full (skills, agent roles and hooks, every tool it finds):**

```bash
git clone https://github.com/agenticair/flow-state && cd flow-state && ./install.sh
```

```powershell
git clone https://github.com/agenticair/flow-state; cd flow-state; .\install.ps1
```

The quick route installs the skills and nothing else: the judge then runs as an ordinary assistant with a shell, and nothing stops an edit to a frozen spec (tier B). The full route adds the agent roles (builder with a shell, judge without) and the hook scripts, writes `hooks.json` for Codex and Cursor when none exists, prints the settings snippet for Claude Code, and records where it came from so `flow update` knows how to update it. `--project` / `-Project` installs into the current repository instead of your user profile; `--uninstall` / `-Uninstall` removes exactly what was added.

## Connect your tool

After installing, open any project and type `flow`. The first run on a machine shows a short welcome and asks four questions (how much to ask, what to do with review findings, whether it may approve a pull request, how to handle updates). Then type `flow connect` to see what is wired and what is missing, with a fix per line.

| Tool | How to type it | Install for tier A | Native review the flow invokes |
|---|---|---|---|
| **Claude Code** | `/flow <verb>` | `/plugin marketplace add agenticair/flow-state` then `/plugin install flow-state@flow-state`, or the full installer | `/code-review`, `/security-review` |
| **Codex** (CLI, ChatGPT app) | `$flow <verb>` | `./install.sh --only codex` (Codex plugins cannot carry agents or hooks) | the Codex review agent |
| **Cursor** | `/flow <verb>` in the agent pane | `./install.sh --only cursor` | Cursor's review skills |
| **GitHub Copilot** (CLI and VS Code agent mode) | `/flow <verb>` | `./install.sh --only copilot` | Copilot code review on the pull request |
| **Gemini CLI** | `/flow <verb>` | `./install.sh --only gemini` | none yet |
| **Antigravity, Devin, OpenCode, Amp, others** | whatever invokes a skill named `flow` | `npx skills add` (tier B) | none |
| **ChatGPT, Claude.ai, Gemini web** | paste `adapters/web/flow-state-planning.md` into a Project, GPT or Gem with `adapters/web/INSTRUCTIONS.md` as the system prompt | not applicable (tier C: planning only) | none |

The verb is plain text after the skill name. If your tool uses a different prefix, the words are the same.

Integrations your loop needs (Jira, Linear, Slack, Figma, Amplitude, Databricks, Sentry, your own) are declared once by `flow setup` and checked by `flow connect`, which reads the MCP servers configured in each tool, the CLIs on your path and the environment variables that are set. It reports set or unset; it never prints a value.

## Commands

Everything is `flow <verb>`. `flow list` prints this in your tool.

| Verb | What happens |
|---|---|
| `flow` or `flow status` | where the work is, its size, the one next verb |
| `flow list` | every verb, what is installed, the three gates, the two speeds |
| `flow settings` | the welcome on first run; later, walk or set any setting; "only for me" stays out of the team file |
| `flow connect [name]` | machine, tools, project, every integration the loop needs, with fixes |
| `flow setup [refresh]` | reads how this repository works, asks only the gaps, writes config and a verified block in your instructions file |
| `flow size <ticket or intent>` | the architect reads the ask and the repository and returns S, M, L or XL with the route |
| `flow next` / `flow run` | the next stage; `next` stops at every checkpoint, `run` only at a gate or when stuck |
| `flow spec`, `stories`, `design`, `build`, `review`, `ship`, `retro` | that stage now |
| `flow update` | installed vs latest; runs the update only on your yes, and never over files you edited |

Three human gates: **freeze** the spec (fifteen lines, reply `freeze`), **go** on a story (you name it), **merge** the pull request (you merge or push). Nothing else has a permanent external effect: a review comment is a draft for you unless you set `review.comment: post`; approval is off unless you set `review.approve: true`; merging is never automated.

## Plug, play, learn

The flow is not plug-and-play for a company's way of working, and it does not pretend to be. Three layers make it fit:

1. **Discover.** `flow setup` reads what the repository already says: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, Copilot and Cursor rules, the PR template, CODEOWNERS, CI workflows, deploy config, branch names and protection, the scripts in `package.json`, the MCP servers and CLIs already on the machine.
2. **Ask.** What cannot be read is asked once, with the discovered default proposed: branching model, what must be green before a merge and who reviews, whether pull requests open as drafts, how a merge reaches production and through which environments, versioning and release notes, the definition of done, the verify and smoke commands, the integrations this loop needs, autonomy. The answers go to `flow.config.json` and to a Ways of working section in the project's instructions file, so every agent and every human reads the same thing. `flow ship` follows it and refuses to guess: an unrecorded way of working stops the merge gate.
3. **Learn.** `flow retro` harvests the numbers from every build and proposes concrete diffs to the project's rules, lenses and config; you accept each. `flow setup refresh` re-reads the rules when they change. General lessons become issues on this repository.

## Teach the agents

Three places hold what your company knows, and none of them is inside Flow State's files, so an update never erases them:

- **Repository rules** (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, Copilot instructions, `CONTRIBUTING.md`): every builder brief and judge package carries them above Flow State's conventions.
- **Notes per role** in `.flow/roles/<role>.md` (`flow-builder.md`, `flow-judge.md`, `flow-architect.md`, `flow-spec-reviewer.md`, `flow-researcher.md`): what that agent should know about this codebase, in prose. The builder's notes go into its brief; the judge's into its package.
- **Lenses** in `flow.config.json`: your own review commands or agents, run beside the judge on every review.

`flow update` compares the installed files with the shipped manifest and refuses to overwrite anything you edited; it tells you where that change belongs instead.

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
Ticket → Size ─┬─ S ──────────────────────────────→ Build → Review → Ship ─[merge]→
               ├─ M ── Spec-lite ─[freeze]→ Story ─→ Build → Review → Ship ─[merge]→
               └─ L ── Spec ─[freeze]→ Stories ─[go]→ Design? → Build → Review → Ship ─[merge]→ Retro
```

Everything between the gates is a checkpoint you can tighten or loosen with `autonomy: gated | assisted | auto` (default assisted). Freeze and merge are never automated.

## Configure

Three files, merged in this order: `~/.flow/config.json` (this machine: the four welcome answers), `flow.config.json` at the project root (the team), `flow.config.user.json` (git-ignored, just you). Team-owned keys such as what happens on a pull request cannot be overridden in the personal file. Schema: `skills/flow-core/config.schema.json`. Print the merged result:

```bash
node skills/flow-core/scripts/config.mjs
```

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Retro findings that are general rather than project-specific are the most valuable issues you can open.

## Licence

MIT. See [LICENSE](LICENSE).
