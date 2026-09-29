---
name: flow-core
description: Shared runtime for Flow State. Holds the agent role definitions, conventions, templates, deterministic scripts and the config schema that the flow-* stage skills read by relative path. Never invoke this skill directly; it does nothing on its own.
license: MIT
metadata:
  version: "0.2.0"
  flow-stage: runtime
---

# flow-core

This folder is a library, not a workflow. If you were invoked directly, stop and tell the user to invoke `flow` instead.

Stage skills reference these paths relative to their own folder:

```
../flow-core/roles/<role>.md          builder, judge, spec-reviewer, researcher (source of the generated agent files)
../flow-core/conventions/*.md         the yardstick: simplicity, boundaries, testing, ui-states, no-hardcoding, docs-update-law
../flow-core/templates/*.md           spec, STATE, agents-block
../flow-core/scripts/config.mjs       merged project + user config as JSON
../flow-core/scripts/state.mjs        init | show | get <key> | set key=value ...   for .agent/STATE.md
../flow-core/scripts/spec.mjs         score | summary | freeze | unfreeze | check <spec.md>
../flow-core/config.schema.json       the settings a project may set in flow.config.json
```

Scripts run with `node` and print their result; cite it literally. If `node --version` fails, the calling skill must say so and label anything it computed by hand as `UNVERIFIED (no node)`.
