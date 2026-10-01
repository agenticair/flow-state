Welcome to Flow State.

Flow State is an orchestration layer for your coding agent. It takes a piece of work from idea to merged pull request (spec, stories, build, review, ship, retro) and automates most of it. You keep three decisions: freeze the spec, go on a story, merge the pull request. A program checks the rest.

This is the first run on this machine, so I have four questions. Each has a default. Answer with a number per question, or `keep` to accept all defaults. You can change any answer later with `flow settings`.

1. How much should Flow State ask? (default: **assisted**)
   1. assisted: stops at freeze, go, merge, and when stuck
   2. gated: stops at every checkpoint, you approve each plan and each commit
   3. auto: a build halts with a reason instead of asking; freeze and merge stay yours
2. After a review, what happens to the findings? (default: **draft**)
   1. draft: written up for you to paste on the pull request
   2. post: posted on the pull request as one comment, under your account
   3. off: kept in the story file only
3. May Flow State approve a pull request when nothing high or medium remains? (default: **no**)
   1. no
   2. yes: it counts as your approval; GitHub refuses it on your own PR. Merging is never automated.
4. When a newer Flow State exists? (default: **ask**)
   1. ask: tell you and offer the update command; run it only on your yes
   2. notify: one line, nothing else
   3. never: do not check
