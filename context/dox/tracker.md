## GitHub Issues

Workflow: copy the title + description from `issues/<letter>.md` into a new GitHub issue
for each story, then paste the resulting issue number into the `GitHub Issue:` line for
that story **both here and in the issue file**. When starting a branch for a story, tell
the agent which story ID (e.g. "work on DOX-A3") — it will find the matching issue link here
and the full spec in `issues/<letter>.md`.

`Order` is the sequence to actually build these in. It follows overview.md §5: Group DOX-A
straight through (DOX-A1–DOX-A2 first so every later story lands on a live site), then DOX-B, DOX-C, DOX-D,
E. Story Groups are kept **un-interleaved** so each is a coherent, reviewable slice.
Story issue numbers are blank until created.

**No changesets, no publish column.** `apps/docs` is private and is not published to
npm, so unlike `context/roadmap/`, these stories do not need a `.changeset/*.md` entry —
with one exception: if a story also modifies `packages/gmt` (for example DOX-A3 deciding to
stub the namespace READMEs, per overview.md §7), that change follows the normal repo
convention and does need a changeset.

**DOX-A1 and DOX-A2 are the gate.** Do not start DOX-A3 until the site is deployed and reachable.
Everything after that point is verifiable on a live URL instead of in a dev server, and
that is worth more than the two stories cost.

| Order | Story  | GitHub Issue | Status      |
| ----- | ------ | ------------ | ----------- |
| 1     | DOX-A1 | #130         | Not started |
| 2     | DOX-A2 | #131         | Not started |
| 3     | DOX-A3 | #132         | Not started |
| 4     | DOX-A4 | #133         | Not started |
| 5     | DOX-A5 | #134         | Not started |
| 6     | DOX-B1 | #135         | Not started |
| 7     | DOX-B2 | #136         | Not started |
| 8     | DOX-C1 | #137         | Not started |
| 9     | DOX-C2 | #138         | Not started |
| 10    | DOX-C3 | #139         | Not started |
| 11    | DOX-D1 | #140         | Not started |
| 12    | DOX-D2 | #141         | Not started |
| 13    | DOX-E1 | #142         | Not started |

Parked work carries no story ID and never enters this table — see
[appendix-parked.md](appendix-parked.md).
