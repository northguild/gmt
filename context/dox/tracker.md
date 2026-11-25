## GitHub Issues

Each row is a `DOX-*` story with its own GitHub issue; what a done story shipped is in
[built/](built/index.md). Add a row, then run `pnpm deps:sync`, which generates `Blocked by`, only for
Dox work that belongs to no realm story. The Dox pages and tools of a realm story (`TRAN-*`,
`INT-*`, `CORE-*` and the rest) add no row here: that story's row in
[../domination/tracker.md](../domination/tracker.md) tracks them. `CORE-*` is for functionality
shipped in `packages/gmt`; site work that ships nothing in the package, such as the hero globe and
its sky, is a `DOX-*` row here. `/plan-story` writes a `DOX-G*` story as a spec folder under
[specs/](specs/), by `dox-architect` or `architect`, with no tool shortlist; `/pipeline` says who
builds it.

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
| 27    | DOX-G10                                     | —          | #473         | Done   |
| 28    | DOX-G11                                     | —          | #515         | Todo   |
| 29    | DOX-G12                                     | —          | #511         | Done   |
| 30    | DOX-G12                                     | —          | #534         | Done   |
| 31    | DOX-G13                                     | —          | #535         | Done   |
| 32    | DOX-G14                                     | —          | #538         | Todo   |
| 33    | DOX-G15                                     | —          | #556         | Done   |
| 34    | DOX-G15                                     | —          | #569         | Done   |
| 35    | DOX-G16                                     | —          | #578         | Todo   |

Owed verification, not work:

¹ A keyboard-only pass, `prefers-reduced-*` emulation and a real Firefox/Safari check.

² Re-run `html-diff` and `visual:diff` against a baseline from a clean worktree of the commit
before the interval visualizer's `data-role="axis"` attribute (the baseline runbook in
[tier-6-runbooks.md](built/tier-6-runbooks.md)).

³ A real Safari and Firefox pass of the GPU globe: WGSL that compiles under one implementation can
fail under another. The first-frame error scope falls back to canvas-2D.

⁴ The same Safari and Firefox pass for the Earth imagery, and the `/dox` rail with the imagery in a
live chat, which `pnpm globe:smoke` cannot drive.

⁵ A real Firefox pass of the reference tables.

⁶ The platform previews, the live `deploy-smoke` run and the live Core Web Vitals numbers, which
only run after a deploy ([tier-6-ops.md](built/tier-6-ops.md#after-a-deploy), "After a deploy").
