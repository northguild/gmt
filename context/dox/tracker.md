## GitHub Issues

35 sub-stories on 26 GitHub issues: #130–#142, #171 (`DOX-C0`), #240 (`DOX-C4`), #288
(`DOX-A6`), #289 (`DOX-E1c`), #293 (`DOX-E1d`), #430 (`DOX-G1`), #447 (`DOX-G2`), #467
(`DOX-G3`), #458 (`DOX-G4`), #448 (`DOX-G6`), #477 (`DOX-G7`,
with #475), #487 (`DOX-G8`) and #522 (`DOX-G9`). What each done story shipped is in [built.md](built.md).

A row here is a `DOX-*` story with its own GitHub issue. Add one, then run `pnpm deps:sync`,
which generates `Blocked by`, only for Dox work that belongs to no realm story. The Dox pages and
tools of a realm story (`TRAN-*`, `INT-*`, `CORE-*` and the rest) add no row here: that story's
row in [../domination/tracker.md](../domination/tracker.md) tracks them, and what they shipped is
in [built.md](built.md). `CORE-*` is kept for core functionality shipped in `packages/gmt`, the
functions that belong to no industry and fixes across the whole library. Site work that ships
nothing in the package, such as the hero globe and its sky, is a `DOX-G*` row here. The earlier
site stories in that tracker (`CORE-86` … `CORE-88`) stay where they are.
`/plan-story` writes a `DOX-G*` story as a spec folder under [specs/](specs/), by `dox-architect`
or `architect`, with no tool shortlist; `/pipeline` says who builds it.

`apps/dox` is private, so no changesets unless a change also touches `packages/gmt`.

| Order | Story                                       | Blocked by | GitHub Issue | Status |
| ----- | ------------------------------------------- | ---------- | ------------ | ------ |
| 1     | DOX-A1                                      | —          | #130         | Done   |
| 2     | DOX-A2                                      | —          | #131         | Done   |
| 3     | DOX-A3 (DOX-A3a, DOX-A3b)                   | —          | #132         | Done   |
| 4     | DOX-A5                                      | —          | #134         | Done   |
| 5     | DOX-A4 (DOX-A4a, DOX-A4b, DOX-A4c, DOX-A4d) | —          | #133         | Done   |
| 6     | DOX-B1 (DOX-B1a)                            | —          | #135         | Done   |
| 7     | DOX-B2 (DOX-B2a, DOX-B2b, DOX-B2c, DOX-B2d) | —          | #136         | Done   |
| 8     | DOX-D1                                      | —          | #140         | Done¹  |
| 9     | DOX-D2                                      | —          | #141         | Done¹  |
| 10    | DOX-E1 (DOX-E1a, DOX-E1b)                   | —          | #142         | Done   |
| 11    | DOX-C0                                      | —          | #171         | Done   |
| 12    | DOX-C1                                      | —          | #137         | Done   |
| 13    | DOX-C2                                      | —          | #138         | Done   |
| 14    | DOX-C3 (DOX-C3a, DOX-C3b)                   | —          | #139         | Done²  |
| 15    | DOX-C4                                      | —          | #240         | Done   |
| 16    | DOX-E1c                                     | —          | #289         | Done³  |
| 17    | DOX-E1d                                     | —          | #293         | Done⁴  |
| 18    | DOX-A6                                      | —          | #288         | Done⁵  |
| 19    | DOX-G1                                      | —          | #430         | Done   |
| 20    | DOX-G2                                      | —          | #447         | Todo   |
| 21    | DOX-G3                                      | —          | #467         | Done   |
| 22    | DOX-G4                                      | —          | #458         | Done   |
| 23    | DOX-G6                                      | —          | #448         | Done⁶  |
| 24    | DOX-G7                                      | —          | #477         | Done   |
| 25    | DOX-G8                                      | —          | #487         | Done   |
| 26    | DOX-G9                                      | —          | #522         | Done   |

¹ Owed verification, not work: a keyboard-only pass, `prefers-reduced-*` emulation, and a
real Firefox/Safari check.

² Owed verification, not work: re-run `html-diff` and `visual:diff` after the interval
visualizer's `data-role="axis"` attribute, against a baseline from a clean worktree of the
commit before that change (the baseline runbook in [built.md](built.md)).

³ The globe on the GPU. Owed verification, not work: a real Safari and Firefox pass. WGSL
that compiles under one implementation can fail under another, and only a browser can say.
The first-frame error scope falls back to canvas-2D if it does, so the cost of finding out
late is a slower globe, not a broken page.

⁴ The Earth imagery. Owed verification, not work: the same real Safari and Firefox pass as
³, and the `/dox` rail seen with the imagery in a live chat. The rail mounts through the same
`initGlobe` as the other two hosts, but `pnpm globe:smoke` cannot drive the chat. A failed
image load leaves the flat globe, so the cost of a browser that rejects the texture is the
look, not the page.

⁵ Type pages by usage, property tables and the doc gate. Owed verification, not work: a real
Firefox pass of the reference tables. Chromium was swept on every reference page at three
widths and WebKit on five pages; Playwright's Firefox would not start.

⁶ Search and answer engines. Owed verification, not work: the platform previews, the live
`deploy-smoke` run and the live Core Web Vitals numbers can only run after a deploy. The list is in
[built.md](built.md), under "Open checks after a deploy".
