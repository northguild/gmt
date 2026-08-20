## GitHub Issues

Workflow: copy the title + description below into a new GitHub issue for each story, then paste the resulting issue number into the `GitHub Issue:` line for that story **both here and in the story's bullet above** (Story Group A–G). When starting a branch for a story, tell the agent which story ID (e.g. "work on C1") — it will find the matching issue link here and the full context in the Story Group section above.

Issue number tracker (fill in as issues are created). `Order` is the sequence to actually work these in — it follows the "Suggested Sequencing" section above (C-group first as a correctness fix, then A1–A5 straight through, then D-group, then F-group, then B-group, then G-group, then H-group, then I-group, then E1–E5 last) — **not** ascending issue number. `Publish` marks when to cut a release after that story lands: every story is additive-only (new functions, or new optional parameters defaulting to current behavior), so every bump is `minor`; publish once per Story Group rather than per-story. Groups B, G, H, and I are adjacent in `Order` but are **not** bundled into one publish — see the Changeset note below on why interleaving unpublished groups is unsafe.

**Changeset note:** each story's PR still adds its own `.changeset/*.md` file with a `minor` bump label (that's the correct per-change label, independent of when a release is cut). Changesets accumulate un-versioned in `.changeset/` across multiple merged PRs; only running `pnpm changeset:version` actually consumes them and cuts a release. Do **not** run `changeset:version` / publish until the `Publish` column for that row says so (i.e. wait for the last story in the Story Group, not the first). Story Groups are kept **un-interleaved** in `Order` specifically so this holds: `changeset:version` versions everything sitting in `.changeset/` at the time it's run, not just the "completing" group's own changesets, so interleaving two groups' stories would cause an earlier group's publish to sweep up a later, still-in-progress group's changesets too.

| Order | Story | GitHub Issue | Status      | Publish                                      |
| ----- | ----- | ------------ | ----------- | -------------------------------------------- |
| 1     | C1    | Issue #38    | Done        | v1.5.0                                       |
| 2     | C2    | Issue #39    | Done        | v1.5.0                                       |
| 3     | C3    | Issue #40    | Done        | v1.5.0                                       |
| 4     | A1    | Issue #27    | Done        | v1.6.0                                       |
| 5     | A2    | Issue #28    | Done        | v1.6.0                                       |
| 6     | A3    | Issue #29    | Done        | v1.6.0                                       |
| 7     | A4    | Issue #30    | Done        | v1.6.0                                       |
| 8     | A5    | Issue #31    | Done        | v1.6.0                                       |
| 9     | D1    | Issue #41    | Done        | v1.7.0                                       |
| 10    | D2    | Issue #42    | Done        | v1.7.0                                       |
| 11    | D3    | Issue #43    | Done        | v1.7.0                                       |
| 12    | F1    | Issue #54    | Done        | v1.8.0                                       |
| 13    | F2    | Issue #55    | Done        | v1.8.0                                       |
| 14    | F3    | Issue #56    | Done        | v1.8.0                                       |
| 15    | F4    | Issue #57    | Done        | v1.8.0                                       |
| 16    | B1    | Issue #32    | Done        | v1.9.0                                       |
| 17    | B2    | Issue #33    | Done        | v1.9.0                                       |
| 18    | B3    | Issue #34    | Done        | v1.9.0                                       |
| 19    | B4    | Issue #35    | Done        | v1.9.0                                       |
| 20    | B5    | Issue #36    | Done        | v1.9.0                                       |
| 21    | B6    | Issue #37    | Done        | v1.9.0                                       |
| 22    | B7    | Issue #79    | Done        | v1.9.0                                       |
| 23    | G1    | Issue #58    | Done        | v1.10.0                                      |
| 24    | G2    | Issue #59    | Done        | v1.10.0                                      |
| 25    | H1    | Issue #72    | Done        | not yet                                      |
| 26    | H2    | Issue #73    | Not started | not yet                                      |
| 27    | H3    | Issue #74    | Not started | minor, Story Group H complete                |
| 28    | I1    | Issue #80    | Not started | not yet                                      |
| 29    | I2    | Issue #81    | Not started | not yet                                      |
| 30    | I3    | Issue #82    | Not started | not yet                                      |
| 31    | I4    | Issue #83    | Not started | minor, Story Group I complete                |
| 32    | E1    | Issue #44    | Not started | unscheduled, no publish plan until picked up |
| 33    | E2    | Issue #75    | Not started | unscheduled, no publish plan until picked up |
| 34    | E3    | Issue #76    | Not started | unscheduled, no publish plan until picked up |
| 35    | E4    | Issue #77    | Not started | unscheduled, no publish plan until picked up |
| 36    | E5    | Issue #78    | Not started | unscheduled, no publish plan until picked up |
