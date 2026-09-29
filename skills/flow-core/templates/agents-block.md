<!-- flow-state:begin -->
## Flow State

This repository is adopted into Flow State (verified <YYYY-MM-DD> against <short sha>). Invoke `flow` to see where a piece of work is and what comes next.

- **State:** `.agent/STATE.md` (git-ignored). Read it before assuming a stage. Update `last_commit` and `stage` when a stage closes.
- **Specs:** `<specs.dir>/<date>-<slug>.md`. A file with `Status: FROZEN` is not edited; changes go to `<slug>.changes.md`.
- **Config:** `flow.config.json` (team) and `flow.config.user.json` (personal, git-ignored). Autonomy is `<autonomy>`.
- **Verify:** `<the command that builds, lints and tests, from package.json or equivalent>`.
- **Docs family:** `<flat | numbered | custom>`. After a change, update `<changelog path>` and, for a decision, `<decisions path>`.
- **Conventions that differ from defaults:** <one line each, only what was read in the repo; omit the line if none>
- **Review lenses:** <name → trigger, one line each; omit if none>
<!-- flow-state:end -->
