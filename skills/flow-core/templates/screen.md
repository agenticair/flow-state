# <route or component> — Screen

Story: <docs/specs/<date>-<slug>/stories/<nn>-<slice>.md>
Reference: <design doc section or existing screen, with path:line>
Components: <existing component paths; new ones with the reason>

## States

| State | What shows | Copy | Next action |
|---|---|---|---|
| empty | <...> | <exact words or [⚠️ Pending: define with <who>]> | <...> |
| loading | <skeleton sized like success> | — | — |
| error | <human message, specific reason when known> | <...> | <retry / link / alternative> |
| success | <the full screen> | <...> | <...> |

## Responsive and theme

- <behaviour at phone width, by reference to the tokens>
- <dark mode, if the project has it>

## Deviation log

| # | Departure from the reference | Reason | Decided by |
|---|---|---|---|
