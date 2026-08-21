---
"@burglekitt/gmt": minor
---

Add duration introspection and comparison: `getDurationUnit`, `durationAs`, `negateDuration`, `absDuration`, `compareDurations`, `getDurationSign` (Story J8).

`getDurationUnit` reads a single component as stored (`getDurationUnit("PT90M", "hours")` is `0` — the minutes field holds 90, not a converted total); `durationAs` totals the whole duration into one unit instead (`durationAs("PT90M", "hours")` is `1.5`). `negateDuration`/`absDuration` flip or drop the sign; `getDurationSign` reports `-1`/`0`/`1`. New `duration/compare/` module holds `compareDurations`, wrapping `Temporal.Duration.compare`.

`durationAs` and `compareDurations` follow the `relativeTo` pattern already documented for `normalizeDuration` (A3): any calendar unit (years/months/weeks) on either side requires `relativeTo`, returning the sentinel (`null`) without it — this applies even when the *requested* unit is the only calendar-shaped one, e.g. `durationAs("PT36H", "weeks")` is `null`. Worth noting the asymmetry with `addDuration`/`subtractDuration` (A2): `Temporal.Duration.compare` **does** accept `relativeTo`, so `compareDurations` can order calendar-unit durations in cases `addDuration` cannot combine. `negateDuration`, `absDuration`, and `getDurationSign` are pure sign operations and never need `relativeTo`, even on calendar-unit durations.

Updated `packages/gmt/README.md`, `packages/gmt/src/duration/README.md`, and the `durations` skill (new Core Patterns plus two Common Mistakes entries extending the existing `relativeTo` guidance).
