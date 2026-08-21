## GitHub Issues

Workflow: copy the title + description from `issues/<letter>.md` into a new GitHub issue
for each story, then paste the resulting issue number into the `GitHub Issue:` line for
that story **both here and in the issue file**. When starting a branch for a story, tell
the agent which story ID (e.g. "work on A3") — it will find the matching issue link here
and the full spec in `issues/<letter>.md`.

`Order` is the sequence to actually build these in. It follows overview.md §5: Group A
straight through (A1–A2 first so every later story lands on a live site), then B, C, D,
E. Story Groups are kept **un-interleaved** so each is a coherent, reviewable slice.
Story issue numbers are blank until created.

**No changesets, no publish column.** `apps/docs` is private and is not published to
npm, so unlike `context/roadmap/`, these stories do not need a `.changeset/*.md` entry —
with one exception: if a story also modifies `packages/gmt` (for example A3 deciding to
stub the namespace READMEs, per overview.md §7), that change follows the normal repo
convention and does need a changeset.

**A1 and A2 are the gate.** Do not start A3 until the site is deployed and reachable.
Everything after that point is verifiable on a live URL instead of in a dev server, and
that is worth more than the two stories cost.

| Order | Story | GitHub Issue | Status      |
| ----- | ----- | ------------ | ----------- |
| 1     | A1    |              | Not started |
| 2     | A2    |              | Not started |
| 3     | A3    |              | Not started |
| 4     | A4    |              | Not started |
| 5     | A5    |              | Not started |
| 6     | B1    |              | Not started |
| 7     | B2    |              | Not started |
| 8     | C1    |              | Not started |
| 9     | C2    |              | Not started |
| 10    | C3    |              | Not started |
| 11    | D1    |              | Not started |
| 12    | D2    |              | Not started |
| 13    | E1    |              | Not started |

Parked work carries no story ID and never enters this table — see
[appendix-parked.md](appendix-parked.md).
