# UI states

Applies to: every component that loads data or performs an async action.

Four states, each designed, before the component is complete:

- **Empty.** Loaded successfully, nothing to show. A purposeful message and a next action. Never a blank area.
- **Loading.** A skeleton or indicator sized like the success state. Never stale data presented as current.
- **Error.** A human-readable message, the specific reason when known, and a recovery action. Never a raw error string or a stack trace.
- **Success.** The full component.

Represent them as a discriminated union (`status: 'empty' | 'loading' | 'error' | 'success'`), not as three nullable flags. Impossible states should be impossible to write.

Server-rendered pages follow the same rule at the page level: a data source that fails renders the page without that section, not a 500.
