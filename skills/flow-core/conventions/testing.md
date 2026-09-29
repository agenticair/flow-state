# Testing

Applies to: every diff.

- Test first. The named test fails for the reason its name gives before production code changes, then passes because of that change.
- A test name is a sentence about behaviour, not about a function: "rejects an expired token", not "test validate".
- Assert observable effect: the response, the row, the rendered text, the thrown error. Not that a mock was called.
- Deterministic and isolated: no wall clock, no network, no shared mutable state between tests. Fixtures are explicit.
- Never weaken an existing assertion to make a change pass. If the assertion is wrong, say so in the report and let the reviewer decide.
- Behaviour comes from production code. A fixture or mock that produces the promised behaviour is theatre.
- A bug fix carries a regression test that reproduces the bug first.
