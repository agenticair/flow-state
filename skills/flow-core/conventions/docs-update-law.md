# Docs update law

Applies to: every change that a user, an operator, or the next agent could notice.

- The task is not complete until the affected docs say what is now true. Same turn, same commit.
- Which docs: the project's `flow.config.json` names the family. Flat: `CHANGELOG.md` for anything user-facing, `DECISIONS.md` for a choice between alternatives, `README.md` for setup or usage. Numbered: `docs/03_CHANGELOG.md`, `docs/06_DECISIONS.md`, and the spec that describes the changed behaviour. Custom: the paths in `docs.map`.
- A changelog line says what changed and where, in the project's existing format. Newest first.
- A decision entry says what was chosen, what was rejected, and why, in three lines. It cites the spec decision number when one exists.
- Docs describe reality, not the plan. A doc that describes what will be built is a spec and lives with the specs.
- Never create a new documentation file when an existing one has the role.
