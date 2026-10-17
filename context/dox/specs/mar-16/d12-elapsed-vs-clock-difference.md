## D. The five tools (continued)

### D12. Elapsed vs. Clock Difference: `/tools/elapsed-vs-clock-difference/`, kind `elapsed`, Core

**What it teaches.** Subtracting two UTC readings gives the clock difference. The seconds that
really passed include every inserted second between them.

**Tag: Core**, by the same reasoning as D11: `timescale`, `span`, `plain` and `precision` only.

**Which functions, from the corpus:** `spanNs` (`span/calculate`) is the clock difference: exact
nanoseconds between two instants, counting no leap second, and refusing second 60 (its JSDoc says
both). The true elapsed time is `spanNs` between the two `toTAI` readings, each read as an
instant by putting `Z` after its date-time: TAI has no leap seconds, so the difference of its
readings is SI seconds. `leapSecondsBetween` gives the count, and `insertionsBetween` (D8) names
them. `spanMs` is not used (it rounds to milliseconds); `diffUtcAsDuration` is not used (it reads
the same POSIX difference as `spanNs`, in units).

**Files:** `src/lib/elapsed-vs-clock.ts`, `…-mount.ts` and their tests;
`src/components/ElapsedVsClock.astro`; `src/styles/gmt-elapsed-vs-clock.css`;
`src/content/docs/tools/elapsed-vs-clock-difference.mdx`. Root
`<div class="gmt-elapsed-vs-clock gmt-widget not-content">`.

**Inputs:** `start` and `end` (text, a listed `23:59:60` allowed); `end-slider` (by day, from
`INTEGER_UTC_FROM` to the later of today and `CONTINUOUS_UTC_FROM`, plus one year); `preset`.

**Reading** (`readElapsed`): `clock = spanNs(start, end)`; `taiStart = toTAI(start)`,
`taiEnd = toTAI(end)`; `elapsed = spanNs(<taiStart>Z, <taiEnd>Z)`; `count =
leapSecondsBetween(start, end)`; `insertionsBetween(start, end, count)`.

**An endpoint that is itself `23:59:60`:** `spanNs` refuses it, so the clock difference is
`NO SIGNAL` with "A clock difference cannot place 23:59:60: the span functions, like every function
outside the leap-second ones, refuse second 60." The elapsed time and the count still read it
through TAI, and the inserted second is listed when it is the start (half-open). When the `23:59:60`
is not a listed insertion, `toTAI` and `leapSecondsBetween` return the sentinel too, with "No leap
second was inserted at the end of that day."

**Template.** Three sections: the inputs; a `.gmt-gnss-frame`; then the calls and the links row. The
frame reads as a sum above two vernier rulers. The sum is three plates, `hero-clock` "Clock
difference" (`secondsText(clock)`, series 2), `hero-count` "Leap seconds between" (the signed count,
series 3) and `hero-elapsed` "Seconds that passed" (`secondsText(elapsed)`, series 1), joined by `+`
and `=` (a column sum at narrow widths). Under it is the figure (`role="img"`, its `aria-label` the
summary sentence): the "UTC clock" ruler, one cell per clock second labelled with its wall time; two
tapes (the clock difference counts every cell and leaves a dashed gap over each inserted second, the
elapsed tape fills every cell); and the "Seconds that passed" ruler at the same scale, numbering the
SI seconds. Each inserted second is a stretched `23:59:60` cell in series 3 on the clock face and a
hatched "+1 s" cell on the elapsed ruler, so the two ends misalign by exactly the seconds inserted.
A long span compresses: the seconds beside each end stay, a slashed break stands for the rest, and
every inserted second keeps its own cell; when the width cannot hold them all, one cell says how
many. Placement is arithmetic only (`drawMs`); every number comes from the library calls. A span
that cannot be read draws the amber `NO SIGNAL` on the ruler it cannot fill. The earlier end and the
later end hang under the rulers at opposite edges, then **`insertions-list`** (the counted seconds,
always reserving the tallest list a preset gives), the calls and the links row. The test, not the
widget, checks `elapsed − clock = count × 10⁹` wherever all three read.

**Presets** (each output from the run unless marked †):

| Id | Start, end | Expect |
| --- | --- | --- |
| `across-2016` (default) | `2016-12-31T23:59:59Z`, `2017-01-01T00:00:01Z` | clock 2 s, elapsed 3 s, one insertion `2016-12-31T23:59:60Z` |
| `start-is-the-leap-second` | `2016-12-31T23:59:60Z`, `2017-01-01T00:00:00Z` | count 1 †; clock `NO SIGNAL`; elapsed 1 s |
| `twenty-four-years` | `2000-01-01T00:00:00Z`, `2024-01-01T00:00:00Z` | count 5 †; the five seconds from 2005-12-31 to 2016-12-31 |
| `no-insertions` | `2020-01-01T00:00:00Z`, `2024-01-01T00:00:00Z` | count 0 †; clock equals elapsed |
| `backwards` | `2024-01-01T00:00:00Z`, `2000-01-01T00:00:00Z` | count −5 †; both spans negative |
| `not-inserted` | `2017-12-31T23:59:60Z`, `2018-01-01T00:00:00Z` | `NO SIGNAL` on all three, "No leap second was inserted at the end of that day." |
| `before-1972` | `1971-01-01T00:00:00Z`, `2024-01-01T00:00:00Z` | clock reads; elapsed and count `null` † → "UTC has differed from TAI by whole seconds only since 1972-01-01." |

**Permalink and chat.** Keys `start`, `end`. `showElapsedVsClockInput = z.object({ start:
z.string().min(10).max(64), end: z.string().min(10).max(64) })`. Doc, appended: purpose "Compare
the clock difference between two UTC instants with the seconds that really passed, and list the
leap seconds between them"; when "Call when the reader asks how many seconds really passed between
two UTC times, why a duration across a leap second is a second short, or how to measure elapsed
time across 23:59:60"; args "both instants exactly as the reader gave them". Starter, area
`leapseconds`: "How many seconds really passed from 2016-12-31T23:59:59Z to
2017-01-01T00:00:01Z?", `args: { start: "2016-12-31T23:59:59Z", end: "2017-01-01T00:00:01Z" }`.

**Tests.** Every preset: the three numbers, the identity above, the list (its length equals the
count), each sentence, the permalink round trip; the mount's regions and holds.
