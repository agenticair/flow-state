# No hardcoding

Applies to: every diff.

- A value that could ever need tuning lives in configuration read at runtime: thresholds, limits, weights, model names, timeouts, feature flags, plan tiers, cadence. Not in a literal in the code path.
- Truly static values (table names, route paths, enum members) may be literals, named once.
- Copy shown to users lives with the other copy for that surface, not scattered in logic.
- Environment-specific values (URLs, keys, project ids) come from the environment; the code never knows which environment it is in.
- When in doubt, put it in config and name it. A named value with a comment about its unit is worth more than a clever constant.
