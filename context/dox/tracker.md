## GitHub Issues

The 23 sub-stories map onto 14 GitHub issues — #130–#142, plus **#171 for `DOX-C0`**. Each
issue appears once below; its `Story` column lists every sub-story that folds into it.
Start a branch by naming the sub-story ID (e.g. `DOX-A3a`) — the agent resolves it to the
issue number here and the full spec in `issues/<letter>.md`.

**#171 (`DOX-C0`) is the one story with its own issue** rather than a sub-story slot: the
React + Tailwind + AI Elements foundation is infrastructure rather than chat, it touches
every existing page's build, and it is independently reviewable before any chat behavior
exists. **It blocks all four other Tier 6 stories.**

`Order` is the sequence to actually build these in. It follows overview.md §5:

- **Tier 0 is the MVP and is order-locked.** `DOX-A1` → `DOX-A2` → `DOX-A3a` must land in
  that sequence so every later tier is visible on a live site from the start.
- **Tier 1 onward may be reordered freely.**
- **Tier 5 (scenarios) may run in parallel with Tiers 2–4** once `DOX-B1a` exists — it is
  content work with a different skill profile and does not compete with component work.

**An issue closes when its last sub-story lands, not its first.** Do not close #132 when
`DOX-A3a` ships — `DOX-A3b` is still open against it in Tier 1. Same for #133. The
single-story issues (#130, #131, #134, #140, #141, #171, #137, #138) close on their only
sub-story.

**No changesets, no publish column.** `apps/dox` is private and is not published to
npm, so unlike `context/roadmap/`, these stories do not need a `.changeset/*.md` entry —
with one exception: if a story also modifies `packages/gmt` (for example `DOX-A3a`
deciding to stub the namespace READMEs, per overview.md §7), that change follows the
normal repo convention and does need a changeset.

| Order | Story                                       | GitHub Issue | Status         |
| ----- | ------------------------------------------- | ------------ | -------------- |
| 1     | DOX-A1                                      | #130         | Done           |
| 2     | DOX-A2                                      | #131         | Done           |
| 3     | DOX-A3 (DOX-A3a, DOX-A3b)                   | #132         | Done           |
| 4     | DOX-A5                                      | #134         | Done           |
| 5     | DOX-A4 (DOX-A4a, DOX-A4b, DOX-A4c, DOX-A4d) | #133         | Done           |
| 6     | DOX-B1 (DOX-B1a)                            | #135         | Done           |
| 7     | DOX-B2 (DOX-B2a, DOX-B2b, DOX-B2c, DOX-B2d) | #136         | Done           |
| 8     | DOX-D1                                      | #140         | Done           |
| 9     | DOX-D2                                      | #141         | Done           |
| 10    | DOX-E1 (DOX-E1a, DOX-E1b)                   | #142         | Partially Done |
| 11    | DOX-C0                                      | #171         | Not started    |
| 12    | DOX-C1                                      | #137         | Not started    |
| 13    | DOX-C2                                      | #138         | Not started    |
| 14    | DOX-C3 (DOX-C3a, DOX-C3b)                   | #139         | Not started    |

Parked work carries no story ID and never enters this table — see
[appendix-parked.md](appendix-parked.md).
