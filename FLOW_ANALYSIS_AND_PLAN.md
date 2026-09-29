# AI delivery flow: what Mercadona runs, what you have, and how to get there

Date: 2026-09-18. Sources read in full: Mercadona Control Tower artifact (v0.56.0), Boris Cherny "Steps of AI Adoption" artifact, `josemerca/mercadona-user-story-toolkit` (80 files), `josemerca/control-tower-plugin` (plugin/, docs/), `bmad-code-org/bmad-method` (29 skills + English docs), paper.design, astryx.atmeta.com, your `~/.claude` (CLAUDE.md, 4 skills, 11 routines, 4 plans, settings), and the Claude/agent files in agenticair, project-workflow, clancyhr, broker-valuation-os, cikku, inkcognito, project rfp. The Gemba article behind the toolkit was unreachable (TLS failure from this machine).

---

## 1. What Mercadona actually runs

JR (Jose Ramon Perez Aguera, CPTO of Mercadona Tech) has published three things, and they are three layers of one stack. His own Control Tower doc draws it:

```
METHOD AND INTENT      what has to be done, and why     -> user-story toolkit, brainstorming, design doc, execution spec
CONTROL TOWER          what may start, on what evidence -> admission, state, gates, judges
DATA PLANE             who writes the code              -> Claude Code sessions in git worktrees
```

### Layer 1: the user-story toolkit (product definition, "before the code")

A Claude Code plugin: 8 skills, 11 slash commands, 5 Python scripts, one `shared-config.md`. Pipeline:

```
PRD | GSD .planning/ | nothing
  -> /prd-quality-guard   (3-dimension score, gate: FAIL <5, CONDITIONAL 5-6, PASS >=7, D3<5 = auto-FAIL)
  -> /research            (gap detection, then a Mom Test interview script; pipeline PAUSES for real interviews)
  -> /analyze-research    (JTBDs with evidence; research gap score)
  -> /stories             (stories from JTBDs, 6-dimension score via script)
  -> /validate-stories    (ALWAYS a fresh sub-agent: "feedback-flip", the reviewer must not have seen the generation)
  -> /split-stories       (regex red-flag scan for oversized stories, 2-3 alternative splits with trade-offs)
  -> /prioritize          (5 lenses weighted, dependency graph, anti-waterfall batch rules AW-1..5)
```

The mechanics that matter, more than the pipeline shape:

- Copilot, not autopilot. Every skill refuses to invent. Missing metric becomes the literal placeholder `[⚠️ Pendiente: definir con PM/Data]` plus a recommendation of what to measure and who owns it. Missing PRD section becomes a `> ⚠️ GAP` block shaped exactly like what the next step needs.
- Every command starts with a mandatory "Step 0: read shared-config.md; if you cannot, stop." Ground rules load regardless of entry point.
- Scoring is done by deterministic Python scripts, never in the model's head ("cite the script output literally").
- Named checkpoints with scripted wording between steps; the orchestrator never loads a skill itself, it dispatches each step to a fresh sub-agent with only the inputs that step needs.
- Provenance footers (`> Origen: PROJECT.md §What This Is`) on every generated section.
- Rule IDs everywhere (AP-PRD-3, GAP-RES-11, AW-4) so reports cite rules, not prose.
- A confirmation-bias detector: if research findings match the PRD hypotheses 100%, that is flagged as a red flag.

It is Spanish, Mercadona-flavoured (Farolas/Penumbras, "Jefe"), and internally inconsistent in places (two different 6D dimension lists, script bands that differ from the markdown). Not for wholesale install.

### Layer 2: Control Tower (execution governance, "during the code")

The Control Tower artifact is a positioning document for `control-tower-plugin` v0.56. It solves a problem you do not have: six agents on one repo colliding. But four of its mechanisms are the best-engineered versions I have seen of things you do need.

- The execution spec with a freeze gate. Template: Hypothesis (bet / how we would know it failed / anti-scope), Frozen decisions each tagged with provenance (`hablada` with a quote, `deducida`, or `propuesta`, and a `propuesta` is never frozen), Epic context, a Slice table, Parked decisions. The freeze is a human gate: the agent presents at most 15 lines (hypothesis, one line per decision with its tag, anti-scope) and stops. The design rationale is a quote from a real PM: "I don't usually read the specs." Everything else in the spec is invisible to the implementing agent; only the slice row and Epic context reach it.
- The slice table as the only machine-parsed contract. Columns: `# | Slice | Type | Delivers | Dep | Accepts | Protected | Area | Touches | Gate | Signal | E2E`. `Accepts` are postconditions, not actions. `Signal` is the observability the slice promises.
- Builder / judge separation by capability, not trust. Implementer subagent (Sonnet, has Bash) writes code and tests but never certifies green. Judge subagent (Opus, tools: Read/Grep/Glob/Write, no Bash) cannot run the tests it judges, receives a review package (diff hash token + files changed + diff) and paths to control logs, never their output. Verdict is JSON validated against a schema (9 rubric items each with `conforme | no-aplica | sin-vara`; findings need `path`, `line`, `evidence`; PASS with a `high` finding is discarded). The program recomputes the diff hash before accepting the verdict, seals the tree at verdict time, and refuses to commit if the index changed.
- "What's next" is a table, not a model reading prose. `.agent/run-<issue>.json` records task/step/retries; `ct-step next` prints the exact next action; asking for a step out of order exits 9; a PreToolUse hook denies spawning a subagent unless `next` was asked for this step. A SessionStart hook injects the state file; a Stop hook blocks the turn if work above the recorded `last_commit` is unrecorded.
- Conventions ("la vara") shipped as eight short documents (defects, style, simplicity, decisions, domain, architecture, boundaries, testing), pasted verbatim into every task brief and handed by path to the judge, with an explicit precedence rule: plugin rule beats repo rule, rule by rule.
- Every "could not verify" is a distinct exit code from "verified clean". Unverified is never reported as OK.

Their "three loops" doc shows three people at Mercadona Tech independently built loops and are converging on mechanisms. All three fork Superpowers (brainstorming, writing-plans, TDD, subagent-driven-development, verification-before-completion).

### Layer 3: the data plane

Claude Code in worktrees, driven by the CT kickoff prompt. Nothing exotic.

### Design tooling in the list

- paper.design: an HTML/CSS canvas that agents read and write through MCP; design and code stay in sync. It is a tool, not a method.
- Astryx (Meta): 170-component React + StyleX design system, "agent-ready" through CLI and MCP. A component library agents can scaffold from.

Neither is a design *process*. Mercadona's process is BMAD-style: a design doc precedes the spec, and the spec's UI slices carry a `visual` gate (human looks at a screenshot before merge).

## 2. What BMAD adds (the "others" link)

BMAD is the general-purpose version of the same idea, and it is far more polished as a solo tool:

- Right-sized process. Four tiers: trivial (no method), one session (about 500 lines, a handful of files: go straight to build), epic (2-10 sessions: spec + stories), project (20+ sessions: brief/PRD/UX/architecture). Scope is only one signal; risk, unclear requirements, architectural reach push work up a tier.
- A hub skill (`bmad`) that is read-only, re-scans installed skills, routes from one knowledge document, and tells you to open a fresh context for the next skill.
- The spec as contract: a `<frozen-after-approval>` block (Intent, Always/Never boundaries, an I/O and edge-case matrix) and agent-owned append-only sections (Implementation Notes, Spec Change Log, Review Triage Log). Target 900-1600 tokens.
- "Investigate before asking": subagents search the repo first; only what the repo cannot settle becomes an Open Question, presented as numbered choices.
- Context-free reviewers, parent-owned severity. Lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) get a diff file path, never severity vocabulary; the parent verifies each finding and grades it high/medium/low/false/maybe-false, then routes by root cause: intent gap (back to human), bad spec (amend and re-derive), patch (same implementer, minimal message), defer.
- Matrix Test Audit: every edge-case row needs a test that ran and passed; never edit the expectation to match the code.
- `.memlog.md`: an append-only per-run log so a fresh chat can resume.
- A verified `AGENTS.md` block with provenance (`Verified <date> against <sha>`), a ledger for pre-existing instructions, and a rule to prefer a hook or lint over a prose instruction.
- Prompt-length discipline: "Length and ambiguity are paid on every run; a corner case is paid only when it occurs."

## 3. Where you are on Cherny's ladder

Steps of AI Adoption: 0 Gated, 1 Assisted (you + one agent, you read everything), 2 Parallel (5-10 agents, self-verification you trust, automated code review on by default), 3 Supervised autonomy (routines, loops, Claude kicks off Claude), 4 AI-native.

You are at step 1 with pieces of step 3 already in place (11 routines, remote scheduled health checks, a memory) and none of step 2's core: no self-verification loop you trust, no automated code review, no worktree parallelism. Cherny's stated unlock from 1 to 2 is exactly what Mercadona's layer 2 is: "a self-verification loop you trust (tests + build + lint + e2e) ... automate code review." Everything else in this plan is in service of that one unlock.

## 4. What you already have

Strengths (keep, do not rebuild):

- A real working loop in `~/.claude/CLAUDE.md`: Read, Plan, Research, Act, Document, Summarize, with calibration tiers. It is a single-agent discipline for changes to existing code and it is good.
- Seven review lenses in agenticair (`.claude/commands/`: devops-king, cso-agent, qa-lead, lead-architect, ai-researcher, cfo-agent, cpo-agent). Each has a read-first list, a checklist, an output format, and a "stop and escalate if" list. These are review lenses, not builders, and there is no orchestrator: a human invokes one at a time and cross-lane consultation is the same agent reading another playbook.
- Strong doc conventions in two families: flat capitalised root files with an Update Law (agenticair, project-workflow) and numbered `docs/01..09` fixed roles then appended entries (clancyhr, broker-valuation-os). Every project mandates same-turn doc updates.
- Hard build rules in agenticair `GLOBAL_INSTRUCTIONS.md`: four UI states, no hardcoding, TypeScript only, git snapshot before risky prompts, CHANGELOG line format.
- Eleven read-only routines (health, drift, PR triage, commit review for bvos) and the `tenant-smoke` and `repo-split-migration` skills, which are genuinely good runbooks.
- Four plans in `~/.claude/plans/` that are, in effect, excellent execution specs (constraints with file:line citations, gates with "Stop: owner confirms", risk tables, rollback). They were written ad hoc; there is no template or skill behind them.
- Thirteen design-taste skills in project rfp (third-party, `Leonxlnx/taste-skill`), mostly marketing surfaces and image generation.

Gaps, stage by stage:

| Stage | What exists | What is missing |
|---|---|---|
| Idea / discovery | `WHAT_WE_ARE_BUILDING.md`; CPO lens judges ideas | Nothing develops an idea or asks discovery questions |
| PRD / spec | Hand-maintained `PRODUCT_SPEC`, `01_USER_SPEC`, `TECH_SPEC` | No skill writes a spec; no quality gate; no freeze; no provenance on decisions |
| Stories | Prose phase plans, `SCREEN_BUILD_CHECKLIST` | No story format, no acceptance-criteria template, no scoring, no split/prioritise |
| Design | Design-system docs (Clarity laws, Visual Canon, four-state rule); taste skills | No design *step* that turns a story into a screen inventory, state list, reference mapping; taste skills are not project-aware (two ban the fonts your projects mandate) |
| Build | The global loop; GLOBAL_INSTRUCTIONS rules | No plan-with-Files/TDD/Verification contract; no builder subagent; no controls step |
| Review | Seven lenses (proposal review); `bvos-commit-review` routine | No diff-walking code-review agent with a rubric; no builder/judge separation; no schema verdict; Anthropic's `/code-review` and `/security-review` exist but nothing in your setup calls them |
| Ship | DevOps King, QA Lead sacred flows, tenant-smoke | Fine; needs to be a stage the flow reaches, not a lens you remember to call |
| Docs | Strongest stage; Update Laws; changelog-sync | No check that the rules were followed (no doc-drift audit) |
| State | `START_HERE.md` stamps, phase stamps inside plans | No per-project state file an agent resumes from; no hooks anywhere (global or project) |
| Orchestration | None | No hub, no path chooser, no gate enforcement outside a human typing "stop" |

## 5. What transfers and what does not

Do not adopt wholesale:

- The Mercadona toolkit as-is: Spanish, Mercadona vocabulary, internally inconsistent, depends on GSD and Superpowers conventions you do not use, and its research stage assumes you run Mom Test interviews with real users before writing stories. Lift its mechanics.
- Control Tower as-is: requires `cmux`, GitHub labels as a state database, area-token admission, and two live sessions per repo. Its own comparison table says: "Improving the discipline of a single agent: Superpowers / GSD Core; Control Tower is overkill unless there is shared concurrency." Lift four mechanisms (freeze gate, judge without shell, schema verdict with diff token, state file + step table + hooks).
- BMAD as-is: 29 skills, `uv`, Python renderers, a `_bmad/` folder per project, personas with menus. It is the closest to what you want and the best documented, and installing it to *study* is reasonable. But it would add a second doc convention on top of your two, and its build skill would fight your GLOBAL_INSTRUCTIONS. Lift its path chooser, spec contract, review-prompt files (portable as-is), memlog, and verified AGENTS.md block.

Transfer, in priority order:

1. A hub that classifies the ask (tier and stage) and routes, asking the stage's questions. (BMAD hub + path chooser)
2. A spec skill with hypothesis, frozen decisions with provenance, anti-scope, `[NEEDS CLARIFICATION]`, `[⚠️ Pending: define with X]`, a deterministic quality score, and a freeze gate that presents at most 15 lines and stops. (CT template + Mercadona guard + BMAD frozen block)
3. Stories with acceptance postconditions, a lite 6-dimension score by script, red-flag splitting, and a slice table (Type, Delivers, Dep, Accepts, Protected, Area, Gate, Signal). (Mercadona + CT)
4. Builder / judge separation: builder subagent with Bash, judge subagent without Bash, review package with diff hash, JSON verdict validated by a script, parent assigns severity and routes patch/defer/bad-spec. (CT + BMAD)
5. A per-project state file plus three hooks: SessionStart hydration, Stop check against `last_commit`, PreToolUse guard on frozen spec files. (CT hooks, BMAD memlog)
6. Conventions as short documents pasted into every build brief: your existing rules (four states, no hardcoding, TypeScript, OpenRouter only, doc Update Law) become the "vara". (CT conventions)
7. A design stage that is project-aware: reads the project's design-system doc, produces a screen inventory with the four states per screen and a reference mapping, and hands off to Stitch / paper.design when useful. (Your Visual Canon + four-state rule, BMAD `bmad-ux` DESIGN.md shape)
8. Your seven lenses become optional review lenses the review stage can invoke, parameterised per project. (BMAD lens config)
9. Never-invent placeholders, provenance footers, rule IDs, "unverified is never OK" exit-code discipline, prompt-length discipline. (Mercadona + CT + BMAD, cross-cutting)

## 6. Target design: one flow, callable from any chat

Working name: `flow` (rename freely). Installed globally so every chat has it; project files only hold what is project-specific.

```
~/.claude/
  skills/flow/                 hub: classify the ask, route, ask the stage's questions
  skills/flow-spec/            idea -> spec -> freeze gate
  skills/flow-stories/         spec -> stories/slices, scored, split, prioritised
  skills/flow-design/          story -> screen inventory, states, reference map, handoff
  skills/flow-build/           story -> plan (Files/TDD/Verification) -> builder -> controls -> judge -> commit
  skills/flow-review/          diff -> package -> judge (+ optional project lenses) -> triage
  skills/flow-ship/            pre-merge gates, smoke, changelog, doc Update Law
  skills/flow-adopt/           one-time per project: seeds state, conventions, maps the doc family
  agents/flow-builder.md       Sonnet; Read, Write, Edit, Grep, Glob, Bash
  agents/flow-judge.md         Opus;   Read, Grep, Glob, Write   (no Bash, by design)
  agents/flow-spec-reviewer.md fresh-context reviewer for specs and stories (feedback-flip)
  flow/conventions/*.md        the vara: your rules as eight short documents
  flow/scripts/                score_spec.py, score_story.py, redflags.py, check_verdict.mjs, step.mjs (deterministic)
  flow/templates/              spec.md, story.md, slice-table.md, screen-inventory.md, review-package.md
  hooks (settings.json)        SessionStart hydrate, Stop last_commit check, PreToolUse frozen-spec guard
<project>/
  .agent/STATE.md              current feature, stage, gate, last_commit, open decisions (git-ignored)
  docs/specs/<date>-<slug>.md  spec with Estado: DRAFT | FROZEN
  AGENTS.md or CLAUDE.md       a verified block: policy, where things are, run/verify, conventions that differ, pitfalls
  (existing lenses stay)       .claude/commands/*.md become flow-review lenses via a small manifest
```

### What each stage asks and produces

Hub (`/flow` or just describing the task in a chat with the flow installed):
- Reads `.agent/STATE.md` if present. Classifies tier: trivial (do it, no method), one session (go to build), epic (spec first), project (brief/PRD first). Classifies stage from what exists on disk (no spec? spec not frozen? stories not scored?). Says what it will do and which questions it needs answered, then routes. It never starts the stage inside the hub context; it tells you to open the stage (or, in the same chat, invokes the stage skill).

Spec:
- Questions, only after investigating the repo and existing docs first: what is the bet; how would we know it failed; what is explicitly out (anti-scope); which decisions are yours (quoted), which are deduced, which are the agent's proposals (parked, never frozen); what must not change.
- Produces `docs/specs/<date>-<slug>.md` with `Estado: DRAFT`, scored by `score_spec.py` (three dimensions, auto-FAIL rule), gaps as `[NEEDS CLARIFICATION]` and `[⚠️ Pending: define with <who>]`.
- Freeze gate: prints at most 15 lines and stops. On your literal OK it flips to `FROZEN`, stamps the date, and the PreToolUse hook then refuses edits to frozen sections.

Stories:
- Produces the slice table and one story file per slice with acceptance postconditions (Given/When/Then), Protected (out of scope), Area, Gate (`visual` for UI, `plan` by default), Signal. Scores each with `score_story.py`, runs `redflags.py`, proposes 2-3 splits for oversized ones, orders with the anti-waterfall rules (every batch delivers user value; infra only when a story needs it).
- Validation always goes to `flow-spec-reviewer`, a fresh subagent that did not see the generation.

Design (UI slices only):
- Reads the project's design-system doc (Clarity, Visual Canon, DESIGN_SYSTEM.md, or the taste skill if none). Produces a screen inventory entry per screen: route, reference mapping, four states (empty/loading/error/success), components, copy, and a deviation log. Hands off to Stitch/paper.design when you want a canvas. The `visual` gate at ship means you look at a screenshot before merge.

Build (one story per session):
- Writes a plan whose tasks carry `Files (create|modify)`, `TDD` (the test name), `Verification` (shell predicates scored by exit code). Then a step loop recorded in `.agent/run.json`: dispatch `flow-builder` with the brief and the conventions pasted in; run controls yourself (scope check: touched files equal declared files; tests named exist; verification commands pass); write the review package with the diff hash; dispatch `flow-judge` with the package path; validate the verdict with `check_verdict.mjs` (rejects on schema, on stale hash, on PASS-with-high); route findings; commit only the builder's reported paths, never `git add -A`; commit message composed by the step script.
- Your git-snapshot rule, four-state rule, no-hardcoding rule ride along in the brief as conventions, so the judge checks them.

Review (also usable standalone on any diff or PR):
- The same judge, plus optional project lenses (your seven, mapped by trigger: touches auth/billing/RLS -> cso-agent; touches deploy -> devops-king; and so on). Findings graded by the parent session, then Apply patches / Leave as action items / Walk through each.

Ship:
- Pre-merge: verify script, sacred flows or `tenant-smoke`, migration drift, `visual` gate screenshot, CHANGELOG line in house format, doc Update Law for the project's family. Merge stays yours.

Adopt (once per project):
- Seeds `.agent/STATE.md`, `.gitignore` rules, detects doc family A or B and records where specs/stories/screens live, writes the verified block into `AGENTS.md`/`CLAUDE.md` with a ledger of what was already there, and registers existing lenses.

## 7. Implementation phases

Phase 0, housekeeping (half a day, do first):
- Rotate and remove two plaintext tokens (see section 9).
- Decide the plugin home (section 8, decision 1).
- Optionally install BMAD in a throwaway folder to study its build flow live. Not into a real project.

Phase 1, foundation (2-3 sessions):
- `flow` hub with the path chooser and stage detection.
- `flow-spec` with template, `score_spec.py`, freeze gate.
- `.agent/STATE.md` template, `flow-adopt`, three hooks in global `settings.json`.
- Conventions folder: port your rules from GLOBAL_INSTRUCTIONS and CLAUDE.md into eight short documents.
- Pilot: adopt on one project and write one real spec end to end.

Phase 2, build and judge (3-4 sessions):
- `flow-stories` with `score_story.py`, `redflags.py`, slice table, fresh-context validation.
- `flow-builder`, `flow-judge`, `check_verdict.mjs`, `step.mjs`, review package template.
- `flow-build` and `flow-review`. Port BMAD's `edge-case-hunter.md` and `verification-gap.md` review prompts as two extra lenses (they are self-contained files).
- Pilot: build one real story from the Phase 1 spec through judge and commit.

Phase 3, design and ship (2 sessions):
- `flow-design` reading each project's design doc; screen-inventory template; `visual` gate.
- `flow-ship` wiring tenant-smoke, sacred flows, changelog, Update Law per doc family.
- Map the seven agenticair lenses into `flow-review` via a manifest; leave the files where they are.

Phase 4, measure and close the loop (ongoing):
- A `flow-retro` per epic reading the specs, verdicts and git evidence (BMAD retrospective shape).
- One routine: doc-drift audit (do the Update Laws hold) alongside your migration-drift audit.
- Harvest per-story numbers (verdict vetoes, judge findings by rule, time spec-to-merge) so you can answer Mercadona's kill criterion: after five stories, is human intervention per story lower than doing it by hand?

## 8. Decisions needed from you

1. Home for the flow. Recommendation: a git repo (`houseofai/flow`) installed as a local Claude Code plugin, so it is versioned and every project gets the same version. Alternative: loose files in `~/.claude/skills` and `~/.claude/agents` (faster to start, no versioning).
2. Build house-made and borrow files, or install BMAD as the base and customise. Recommendation: house-made. Your doc conventions and rules are already strong and BMAD would layer a second convention on top; borrow its review prompts and spec contract verbatim.
3. State: file in the repo (`.agent/STATE.md` + `docs/specs`) or GitHub issues as the registry (Control Tower style). Recommendation: files now; GitHub issues can be added later if you ever run parallel agents.
4. Pilot project. Recommendation: agenticair (richest docs, seven lenses, most rules to port). Alternative: cikku (smallest, cleanest, lowest risk).
5. Names: `flow` / `flow-spec` / ... or something else.
6. Whether the judge model is Opus (Control Tower's choice; costs more per review) or the same model as the builder.

## 9. Security flags (loud, on purpose)

1. `~/.claude/settings.local.json` contains a live Sentry auth token (`sntryu_...`) embedded in several permission allow-list entries. Anyone who can read that file has your Sentry API access. Rotate the token at sentry.io, then delete those allow-list lines (they are stale one-off curl commands anyway).
2. `~/.claude/scheduled-tasks/clancy-prelaunch-preflight/SKILL.md` contains a Supabase Management API token in plain text. The routine is disabled but the file persists. Rotate the token; if the routine is ever revived, source it from `~/.claude/secrets/` like `daily-bhm-health` does.
3. Several routines `source` production `.env` files with service-role keys and run on a schedule. They are read-only by instruction only. Any content they fetch (issue rows, briefing text) is untrusted and runs with production access. Move their secrets to `~/.claude/secrets/*.env` and give them the narrowest key that works.
4. `~/.claude/plans/golden-strolling-sparkle.md` records that gitleaks found a Plaqad SSO client secret and a Resend key in the BA engine repo history. Rotation was planned; confirm it happened.
5. `~/Documents/PROJECTS/clancyhr` and `~/PROJECTS/clancyhr` are different repo states (docs to 15 vs docs to 42). Agents told to "read the docs" can read the wrong copy. Pick one and archive the other.

## 10. Source map

- Control Tower artifact: extracted text in the session scratchpad as `control-tower.txt`.
- Steps of AI Adoption artifact: `ai-adoption.txt`.
- Repos cloned in the scratchpad: `mercadona-user-story-toolkit/`, `control-tower-plugin/`, `bmad-method/`.
- Files worth copying verbatim when we build: `bmad-method/skills/bmad-build/review-prompts/{edge-case-hunter,verification-gap}.md`, `bmad-method/skills/bmad-build/spec-template.md`, `bmad-method/skills/bmad/scripts/memlog.py`, `bmad-method/skills/bmad-project-context/references/{template,best-practices}.md`, `control-tower-plugin/plugin/agents/ct-judge.md`, `control-tower-plugin/plugin/templates/_TEMPLATE-execution-spec.md`, `control-tower-plugin/plugin/conventions/*.md`, `control-tower-plugin/plugin/hooks/{session-start,stop,dispatch-guard}.js`, `mercadona-user-story-toolkit/scripts/*.py`, `mercadona-user-story-toolkit/shared-config.md`.
