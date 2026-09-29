# <Title> — Spec

Status: DRAFT
Date: <YYYY-MM-DD>
Project: <name>
Ticket: <url, key, or none>

## Hypothesis

**Bet:** <what we believe will be true for whom once this ships, in one sentence>
**We would know it failed if:** <an observable signal, with how it is measured, or [⚠️ Pending: define with <who>]>
**Anti-scope:** <what this deliberately does not do, so no builder adds it>

## Frozen decisions

<!-- Every row carries a provenance tag. `said: "quote" (who, date)`; `deduced: from <source>`; `proposed` is not allowed here, park it below. -->

| # | Decision | Provenance |
|---|---|---|
| D-1 | <decision> | said: "<quote>" |
| D-2 | <decision> | deduced: from D-1 and `<path:line>` |

## Context for the builder

<!-- Only bullets, **bold**, and closed code fences. This section and the slice rows are all a builder ever sees. -->

- <fact a builder needs, with `path:line` when it comes from the repo>
- <constraint>

## Parked

<!-- Open questions and proposals. Nothing here is frozen. -->

| # | Question or proposal | Options seen | Owner |
|---|---|---|---|
| P-1 | <proposed: ...> | <a / b> | <who decides> |

## Slices

<!-- Filled by `flow-stories`. Empty at freeze. -->

| # | Slice | Type | Delivers | Dep | Accepts | Protected | Area | Gate | Signal |
|---|---|---|---|---|---|---|---|---|---|
