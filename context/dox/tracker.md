## GitHub Issues

Workflow: copy the title + description for a sub-story from `issues/<letter>.md` into a
new comment or the description of its existing GitHub issue, then paste the resulting
sub-story ID into the `Story` column below. When starting a branch for a sub-story, tell
the agent which sub-story ID (e.g. "work on DOX-A3a") — it will find the matching issue
number here and the full spec in `issues/<letter>.md`.

**No new GitHub issues are created by the 2026-08-26 rewrite.** 23 units of work map onto
the same 13 issues, #130–#142. New work enters as a lettered sub-story on the issue it
naturally belongs to — `DOX-A3a`/`DOX-A3b`, `DOX-A4a`–`DOX-A4d`, `DOX-B1a`/`DOX-B1b`,
`DOX-B2a`–`DOX-B2d`, `DOX-C3a`/`DOX-C3b`, `DOX-E1a`/`DOX-E1b` — following the same
`J0a`/`J0b` sub-ID precedent `context/roadmap/` already established.

**Four issues now span more than one tier**, which is the accepted cost of folding new
work into old issues rather than opening new ones:

| Issue | Story  | Tiers spanned                                                |
| ----- | ------ | ------------------------------------------------------------ |
| #132  | DOX-A3 | 0 (`A3a`) + 1 (`A3b`)                                        |
| #133  | DOX-A4 | 1 (`A4a`) + 5 (`A4b`–`d`)                                    |
| #135  | DOX-B1 | 2 (`B1a` lands before `B1b`, which lands after `B2a`–`d`)    |
| #136  | DOX-B2 | 2 (`B2a`–`d`, all in-tier, but four independent sub-stories) |

**An issue closes when its last sub-story lands, not its first.** Do not close #132 when
`DOX-A3a` ships — `DOX-A3b` is still open against it in Tier 1. Same for #133 and #135.

`Order` is the sequence to actually build these in. It follows overview.md §5:

- **Tier 0 is the MVP and is order-locked.** `DOX-A1` → `DOX-A2` → `DOX-A3a` must land in
  that sequence so every later tier is visible on a live site from the start.
- **Tier 1 onward may be reordered freely.**
- **Tier 5 (scenarios) may run in parallel with Tiers 2–4** once `DOX-B1a` exists — it is
  content work with a different skill profile and does not compete with component work.

**No changesets, no publish column.** `apps/dox` is private and is not published to
npm, so unlike `context/roadmap/`, these stories do not need a `.changeset/*.md` entry —
with one exception: if a story also modifies `packages/gmt` (for example `DOX-A3a`
deciding to stub the namespace READMEs, per overview.md §7), that change follows the
normal repo convention and does need a changeset.

| Order | Tier | Story   | GitHub Issue | Status      |
| ----- | ---- | ------- | ------------ | ----------- |
| 1     | 0    | DOX-A1  | #130         | Done        |
| 2     | 0    | DOX-A2  | #131         | Done        |
| 3     | 0    | DOX-A3a | #132         | Not started |
| 4     | 1    | DOX-A5  | #134         | Not started |
| 5     | 1    | DOX-A4a | #133         | Not started |
| 6     | 1    | DOX-A3b | #132         | Not started |
| 7     | 2    | DOX-B1a | #135         | Not started |
| 8     | 2    | DOX-B2a | #136         | Not started |
| 9     | 2    | DOX-B2b | #136         | Not started |
| 10    | 2    | DOX-B2c | #136         | Not started |
| 11    | 2    | DOX-B2d | #136         | Not started |
| 12    | 2    | DOX-B1b | #135         | Not started |
| 13    | 3    | DOX-D1  | #140         | Not started |
| 14    | 3    | DOX-D2  | #141         | Not started |
| 15    | 4    | DOX-E1a | #142         | Not started |
| 16    | 4    | DOX-E1b | #142         | Not started |
| 17    | 5    | DOX-A4b | #133         | Not started |
| 18    | 5    | DOX-A4c | #133         | Not started |
| 19    | 5    | DOX-A4d | #133         | Not started |
| 20    | 6    | DOX-C1  | #137         | Not started |
| 21    | 6    | DOX-C2  | #138         | Not started |
| 22    | 6    | DOX-C3a | #139         | Not started |
| 23    | 6    | DOX-C3b | #139         | Not started |

Parked work carries no story ID and never enters this table — see
[appendix-parked.md](appendix-parked.md).
