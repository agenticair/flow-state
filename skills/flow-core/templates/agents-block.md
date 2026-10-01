<!-- flow-state:begin -->
## Flow State

This repository is set up with Flow State (verified <YYYY-MM-DD> against <short sha>). Invoke `flow` to see where a piece of work is and what comes next; `flow connect` checks the setup.

- **State:** `.agent/STATE.md` (git-ignored). Read it before assuming a stage. Update `last_commit` and `stage` when a stage closes.
- **Specs:** `<specs.dir>/<date>-<slug>.md`. A file with `Status: FROZEN` is not edited; changes go to `<slug>.changes.md`.
- **Config:** `flow.config.json` (team) and `flow.config.user.json` (personal, git-ignored). Autonomy is `<autonomy>`.
- **Verify:** `<the command that builds, lints and tests>`. Smoke: `<command or none>`.
- **Docs family:** `<flat | numbered | custom>`. After a change, update `<changelog path>` and, for a decision, `<decisions path>`.
- **Design authority:** `<path, or none>`.
- **Conventions that differ from defaults:** <one line each, only what was read in the repo; omit the line if none>
- **Known pitfalls:** <one line each, with evidence; omit if none>
- **Review lenses:** <name → trigger, one line each; omit if none>

### Ways of working

- **Branching:** <trunk: push to `<default>` | feature branches named `<pattern>` with a pull request into `<default>`>
- **Before a merge:** <checks that must be green (names); human review by <whom>; labels; the PR template at <path>>
- **To production:** <automatic on merge to `<branch>` | `<command>` | release tag `<pattern>` | train on <day>>; environments in order: <staging → production>
- **Versioning and release notes:** <changelog file; bump rule; tags; release workflow>
- **Done means:** <tests green, docs updated, screenshot for UI, migration note, …>
<!-- flow-state:end -->
