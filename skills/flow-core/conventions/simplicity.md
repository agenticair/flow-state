# Simplicity

Applies to: every diff.

- The burden of proof is on what is added. A new field, branch, parameter, module or abstraction needs a caller that exists in this diff or already in the repo.
- Guard at the door. Validate input where it enters the system; inside, trust the types.
- No configuration for a case nobody has. One implementation until a second real use appears.
- No comments that restate the code. A comment says why, when the why is not obvious from the name.
- A refactor beside the task is a separate task. Note it in the report; do not do it.
- If the smallest change that works is ugly, ship the smallest change and record the ugliness as a parked proposal.
