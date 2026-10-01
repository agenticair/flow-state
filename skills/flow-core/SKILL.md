---
name: flow-core
description: Shared runtime for Flow State. Holds the agent role definitions, conventions, templates, deterministic scripts and the config schema that the flow-* stage skills read by relative path. Never invoke this skill directly; it does nothing on its own.
license: MIT
metadata:
  version: "0.6.0"
  flow-stage: runtime
---

# flow-core

This folder is a library, not a workflow. If you were invoked directly, stop and tell the user to invoke `flow` instead.

Stage skills reference these paths relative to their own folder:

```
../flow-core/ground-rules.md          the floor for every agent; loaded first by every skill, pasted first in every brief, listed first in every package
../flow-core/integrations.json        catalog of integrations flow connect can probe (mcp, cli, env, file)
../flow-core/MANIFEST.json            generated: version + sha256 per file, so flow update can refuse to overwrite an edited install
../flow-core/roles/<role>.md          builder, judge, spec-reviewer, researcher (source of the generated agent files)
../flow-core/conventions/*.md         the yardstick: simplicity, boundaries, testing, ui-states, no-hardcoding, docs-update-law
../flow-core/templates/*.md           spec, stories, story, plan, screen, retro, welcome, STATE, agents-block
../flow-core/scripts/config.mjs       merged config (machine <- team <- personal); where; set --scope
../flow-core/scripts/update.mjs       check | run --yes: installed vs latest, edited-file refusal, install route
../flow-core/scripts/state.mjs        init | show | get <key> | set key=value ...   for .agent/STATE.md
../flow-core/scripts/spec.mjs         score | summary | freeze | unfreeze | check <spec.md>
../flow-core/scripts/rules.mjs        the repository's own rule files, concatenated; they win over conventions
../flow-core/scripts/score_story.mjs  six-dimension lite score for a story file
../flow-core/scripts/redflags.mjs     words that usually mean two stories
../flow-core/scripts/verdict.mjs      check <verdict.json>: schema validation
../flow-core/scripts/step.mjs         the build step machine: init | next | report | controls | package | verdict | commit | status | abort
../flow-core/scripts/harvest.mjs      --spec <spec.md>: the retro's numbers from committed verdicts and git trailers
../flow-core/scripts/doctor.mjs       flow connect: machine, tools, tiers, project, integrations (--only name); a fix per missing item
../flow-core/config.schema.json       the settings a project may set in flow.config.json
```

Scripts run with `node` and print their result; cite it literally. If `node --version` fails, the calling skill must say so and label anything it computed by hand as `UNVERIFIED (no node)`.
