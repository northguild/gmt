## D. The five tools (continued)

### D11. Leap Second Timeline: `/tools/leap-second-timeline/`, kind `leapline`, Core

**What it teaches.** UTC took 27 inserted seconds between 1972 and 2016, none since, and none after
continuous UTC begins on 2027-05-20. A `23:59:60` is real only on a listed day.

**Tag: Core, by the B1 rule** (decision 12). It uses `timescale`, `utc`, `plain` and `precision`.
None is an industry's own namespace, so `core` is allowed; GNSS and Maritime draw on `timescale`
and would be allowed too. Core is chosen because leap seconds matter to every industry that logs
time, and `timescale` stays a Core namespace (decision 16). The tools index and the three section sidebars
already group Core tools (five Core tools ship today; `build-tool-index.ts` and
`industry-sidebar.ts` walk `INDUSTRY_TAG_IDS`, which starts with `core`), so nothing changes there.

**Files:** `src/lib/leap-second-timeline.ts`, `…-mount.ts` and their tests;
`src/components/LeapSecondTimeline.astro`; `src/styles/gmt-leap-second-timeline.css`;
`src/content/docs/tools/leap-second-timeline.mdx`. Root
`<div class="gmt-leap-second-timeline gmt-widget not-content">`.

**Inputs:** `date` (text) with `date-slider` (by day, from `INTEGER_UTC_FROM` to the later of the
reader's today and `CONTINUOUS_UTC_FROM`, plus one year of axis; moving it writes
`YYYY-MM-DDT00:00:00Z`); `check` (text, a second-60 reading to test); `from` and `to` (text);
`preset`.

**Reading** (`readTimeline`): `insertions` and each one's `secondAfter` and
`taiMinusUtc(secondAfter)` (the step chart's values); `taiMinusUtc(date)`; `nextLeapSecond(date)`;
for `check`: `hasSecond60`, `isLeapSecond`, `isValidInstant`; `leapSecondsBetween(from, to)` and
`insertionsBetween`.

**Verdict words for `check`:** "inserted: a real leap second" (`isLeapSecond`); "well-formed, but
nothing was inserted at the end of that day" (`hasSecond60` only); "a valid instant, but not a
second 60" (`isValidInstant`); otherwise `NO SIGNAL`, "This is not an ISO 8601 instant."

**Template.** Three sections: the inputs; a `.gmt-gnss-frame` holding **the staircase** (`role="img"`,
its `aria-label` the reading in words, plus a hidden list); the legend; three pinned plates
(`hero-offset` "TAI − UTC on the date", `hero-between` "Leap seconds between", `hero-check` "Your
second 60"); then **`insertions-table`** (Inserted second, TAI − UTC after), every row always rendered,
the counted rows marked; the calls; the links row.

The staircase is a step chart of TAI − UTC from 1972 (the library's first offset) to the last
inserted second, with a y axis in seconds, gridlines, a filled area, and one riser and one dot per
insertion, every value from `insertions`, `secondAfter` and `taiMinusUtc`. A year axis labels it every
five years, and the lit insertions carry fitted chips (`label-fit.ts`). Beyond the last riser the line
runs flat to a hatched, dashed-edge end cap with the chip "continuous UTC from 2027-05-20". Overlays:
the date is a vertical cursor with a dot on the step, a dashed guide back to the y axis and a readout
("2000-01-01 · 32 s") in a strip above the data; the `from`–`to` span is a hatched band whose
counted risers and dots are thickened and whose readout counts them ("5 leap seconds counted"); a
checked insertion is a lit riser in the third series colour; a checked second 60 that was never
inserted is a dashed, struck-through ghost riser labelled "never inserted" at its day. When a
reading is asked for and the library gives no value, an amber bracketed plate "⟨ NO SIGNAL — invalid
input ⟩" sits in the plot; a legitimately empty result (no insertion after a date) does not raise it.
Readouts are clamped inside the plot and use tabular figures. At container widths under 34rem the
plot is shorter and the y column narrower.

**Presets** († = built timescale JSDoc):

| Id | Inputs | The library returns |
| --- | --- | --- |
| `from-2000` (default) | date `2000-01-01T00:00:00Z`; from `2000-01-01T00:00:00Z` to `2024-01-01T00:00:00Z`; check `2016-12-31T23:59:60Z` | TAI − UTC from the run; between 5 †; check true † |
| `last-insertion` | date `2016-01-01T00:00:00Z` | 36 †; next `2016-12-31T23:59:60Z` † |
| `after-the-table` | date `2024-01-01T00:00:00Z` | 37 †; next `""` † → "none after this date" |
| `far-future` | date `2100-01-01T00:00:00Z` | 37 † |
| `not-inserted` | check `2017-12-31T23:59:60Z` | `false` †, `hasSecond60` true |
| `offset-spelling` | check `2009-01-01T08:59:60+09:00` | `true` † |
| `backwards` | from `2024-01-01T00:00:00Z` to `2000-01-01T00:00:00Z` | −5 † |
| `before-1972` | date `1971-01-01T00:00:00Z`; from `1971-01-01T00:00:00Z` to `2024-01-01T00:00:00Z` | `null` † twice → `NO SIGNAL`, "UTC has differed from TAI by whole seconds only since 1972-01-01." |

**Permalink and chat.** Keys `date`, `check`, `from`, `to`, each optional, at least one present.
`showLeapSecondTimelineInput` is a flat object of four optional strings (10–64 characters) with a
refinement. Doc, appended: purpose "Show every leap second UTC has had on a timeline, TAI − UTC at a
date, the leap seconds between two dates, and whether a 23:59:60 was really inserted"; when "Call
when the reader asks how many leap seconds there are or were between dates, what TAI − UTC was on
a date, whether a 23:59:60 timestamp is real, or when leap seconds end"; args "dates exactly as the
reader gave them". Starter, area `leapseconds`: "How many leap seconds were inserted from 2000 to
2024, and what was TAI − UTC in 2000?", `args: { date: "2000-01-01T00:00:00Z", from:
"2000-01-01T00:00:00Z", to: "2024-01-01T00:00:00Z" }`.

**Tests.** Every preset: the walk, the step values, each plate, the verdicts, the band, the table,
the sentences, the permalink round trip; the mount's regions and holds; the slider's ends follow
the reader's today (fake timers at two dates).
