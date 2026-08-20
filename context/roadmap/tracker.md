## GitHub Issues

Workflow: copy the title + description below into a new GitHub issue for each story, then paste the resulting issue number into the `GitHub Issue:` line for that story **both here and in the story's bullet above** (Story Group A–J). When starting a branch for a story, tell the agent which story ID (e.g. "work on C1") — it will find the matching issue link here and the full context in the Story Group section above.

Issue number tracker (fill in as issues are created). `Order` is the sequence to actually work these in — it follows the "Suggested Sequencing" section above (C-group first as a correctness fix, then A1–A5 straight through, then D-group, then F-group, then B-group, then G-group, then H-group, then I-group, then J-group, then E1–E5 last) — **not** ascending issue number. `Publish` marks when to cut a release after that story lands: nearly every story is additive-only (new functions, or new optional parameters defaulting to current behavior), so nearly every bump is `minor`; publish once per Story Group rather than per-story. Groups B, G, H, I, and J are adjacent in `Order` but are **not** bundled into one publish — see the Changeset note below on why interleaving unpublished groups is unsafe.

**One exception to "additive-only":** J0b moves two functions between published subpaths (`@burglekitt/gmt/plain/get` → `.../plain/calculate`). Root imports are unaffected, but deep-subpath importers break. Treat it as `minor` with an explicit changeset note naming both paths — not as a silent additive change. See [issues/J.md](issues/J.md).

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
| 25    | H1    | Issue #72    | Done        | v1.11.0                                      |
| 26    | H2    | Issue #73    | Done        | v1.11.0                                      |
| 27    | H3    | Issue #74    | Done        | v1.11.0                                      |
| 28    | I1    | Issue #80    | Done        | not yet                                      |
| 29    | I2    | Issue #81    | Not started | not yet                                      |
| 30    | I3    | Issue #82    | Not started | not yet                                      |
| 31    | I4    | Issue #83    | Not started | minor, Story Group I complete                |
| 32    | J0a   | Issue #96    | Not started | not yet (docs-only, no changeset)            |
| 33    | J0b   | Issue #97    | Not started | not yet                                      |
| 34    | J1    | Issue #98    | Not started | not yet                                      |
| 35    | J3    | Issue #99    | Not started | not yet                                      |
| 36    | J4    | Issue #107   | Not started | not yet                                      |
| 37    | J5    | Issue #100   | Not started | not yet                                      |
| 38    | J6    | Issue #101   | Not started | not yet                                      |
| 39    | J7    | Issue #108   | Not started | not yet                                      |
| 40    | J8    | Issue #103   | Not started | not yet                                      |
| 41    | J9    | Issue #104   | Not started | not yet                                      |
| 42    | J10   | Issue #105   | Not started | not yet                                      |
| 43    | J11   | Issue #102   | Not started | not yet                                      |
| 44    | J12   | Issue #106   | Not started | not yet                                      |
| 45    | J13   | Issue #109   | Not started | not yet                                      |
| 46    | J14   | Issue #110   | Not started | not yet                                      |
| 47    | J15   | Issue #111   | Not started | minor, Story Group J complete                |
| 48    | E1    | Issue #44    | Not started | unscheduled, no publish plan until picked up |
| 49    | E2    | Issue #75    | Not started | unscheduled, no publish plan until picked up |
| 50    | E3    | Issue #76    | Not started | unscheduled, no publish plan until picked up |
| 51    | E4    | Issue #77    | Not started | unscheduled, no publish plan until picked up |
| 52    | E5    | Issue #78    | Not started | unscheduled, no publish plan until picked up |
| 53    | E6    | _pending_    | Not started | unscheduled, no publish plan until picked up |

## Story Group J phases

Group J is split into two phases. Full specs for every row above live in [issues/J.md](issues/J.md).

**Phase 0 (Order 32–33) — pre-existing defects, fixed before the rest of the group.** Found by the same 2026-08-20 parity audit that produced Group J, but unrelated to its content:

- **J0a** — `overview.md` declares the "surpasses all comparison libraries" release checkpoint twice, with contradictory group lists (one includes Group I, the other omits it). Documentation-only; no changeset.
- **J0b** — `getLocaleDayOfWeek` and `getLocaleZonedDayOfWeek` sit in `plain/get/` and `zoned/get/`, which are otherwise exclusively current-moment accessors. Moves them to `calculate/` alongside their D2 siblings and records the resulting namespace rule in `coding-standards.md`. **Blocks J3 and J4** — those add four more value-taking accessors and have no unambiguous home until this lands. Note the release impact: root imports are unaffected, but `@burglekitt/gmt/plain/get` is a published subpath, so the changeset must name the change explicitly.

**Phase 1 (Order 34–47) — the fourteen parity gaps.** Ordered above by dependency (J1 setters are foundational; J13 shares J11's regex work). `issues/J.md` additionally groups them into three priority tiers if the group ever needs trimming:

- **Tier 1** — J1, J3, J5, J6, J11. Highest real-world usage; J1 (no field setters anywhere in the library) is the single largest omission found.
- **Tier 2** — J8, J9, J10, J12.
- **Tier 3** — J4, J7, J13, J14, J15.

A fifteenth story, `cycle*` field wrap-around, was moved out of this group entirely on 2026-08-20 (`issues/J.md` Decision 6) — it now runs as **E6** at Order 53, since its own motivation (datepicker segment editing) is Group E's UI-primitive-ambition territory, not a day-one gap. It still depends on J1 across groups.

**Decisions of record.** `issues/J.md` opens with six settled decisions that must not be re-opened — most importantly that a **token formatter is deliberately excluded, not missing** (it hard-codes field order and ships US ordering to every locale; J12's `formatToParts` is the i18n-correct replacement), while token _parsing_ (J11) is in scope because no consumer-side workaround exists at any layer; and that **a comparison library having a function is evidence, never the justification** (Decision 6) — every story's Gap section must lead with a GMT-specific correctness/impossibility/consistency reason, competitor prior art is secondary. A future parity audit needs to read that section before filing `toFormat` as a gap, or re-adding a story on headcount grounds alone.
