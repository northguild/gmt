## D. The five tools (continued)

### D10. GNSS Rollover Checker: `/tools/gnss-rollover-checker/`, kind `rollover`, GNSS and Maritime

**What it answers.** "Is my receiver affected, and when?" Every broadcast counter wraps; firmware
that fixes the era starts reporting dates one counter period early (or late) after the wrap. All
eight counters are peers: the 10-bit `GPS-LNAV`, `QZS-LNAV` and `IRN-LNAV` next wrap at
2038-11-20T23:59:42Z †; `GAL` (12-bit) first wraps at 2078-02-19T23:59:42Z †; the 13-bit
`GPS-CNAV`, `QZS-CNAV`, `IRN-L1NV` and `BDT` wrap far later (`IRN-L1NV` at 2156-08-21T23:59:42Z †,
the others from the run).

**Files:** `src/lib/gnss-rollover-checker.ts`, `…-mount.ts` and their tests;
`src/components/GnssRolloverChecker.astro`; `src/styles/gmt-gnss-rollover-checker.css`;
`src/content/docs/tools/gnss-rollover-checker.mdx`. Root
`<div class="gmt-gnss-rollover-checker gmt-widget not-content">`.

**Inputs** (`RolloverState`):

| Control | `data-role` | Element |
| --- | --- | --- |
| Counter | `counter` | `<select>` of `GNSS_WEEK_COUNTERS` |
| Firmware model | `firmware-model` | chip group: "Build date" (default: a pivot, as real receivers count) or "Fixed era" |
| Build date | `firmware-pivot` | text input, an ISO UTC instant; enabled for "Build date" |
| The era the firmware assumes | `firmware-era` | number input, a whole number from 0; enabled for "Fixed era" |
| Check at | `now-mode` | chip group: "Today" (the reader's clock, live) or "A date" |
| Date | `date` | text input, enabled for "A date" |
| Date slider | `date-slider` | `rangeFieldHtml` by day, from the firmware window's start to the end of the window after it (below); enabled for "A date" |
| Preset | `preset` + `preset-description` | |

The clock is read only after mount and only in "Today" mode, as the Cut-off Countdown does. A
preset or a permalink with a `date` is pinned.

**Reading** (`readRollover`):

1. **Every counter's next wrap** (the peer table, any mode): for each counter, `eraAt(counter, at)`
   and `eraStart(counter, era + 1)`; the time left, `diffUtcAsDuration(at, next, "days")`. Rows
   whose next wrap is the soonest (string-equal) carry the chip "next to wrap". The counter's width
   comes from `firstRefusedWeek` and is shown as "weeks below 1024".
2. **Your receiver:** the true reading at `at`, `utcToGnssWeek(counter, at)`; what the firmware
   reports, `gnssWeekToUtc(counter, week, tow, firmware)` with `firmware` the pivot form
   `{ notBefore: pivot }` or the fixed era; the verdict, `areUtcEqual(reported, at)` → "reports the
   right date", else `diffUtcAsDuration(at, reported, "days")` → "reports a date n days early" or
   "late".
3. **The firmware's window and the date it goes wrong:**
   - build date: the window starts at the pivot. **It goes wrong from** the pivot's own reading
     one era later: `r = utcToGnssWeek(counter, pivot)`, then
     `gnssWeekToUtc(counter, r.week, r.timeOfWeekSeconds, r.era + 1)`. From that instant on, the
     firmware decodes every reading one counter period early;
   - fixed era: the window is `eraStart(firmwareEra)` to `eraStart(firmwareEra + 1)`; it goes wrong
     from the second of those, and reports dates late before the first.
   Adding one to an era is choosing which era to ask about, as the decoder's lanes do.
4. **The rolling receiver** ("Today" mode only): `gnssWeekToUtc(counter, week, tow, "rolling")`
   with today's reading, which picks the era nearest the device's own clock. In "A date" mode the
   row reads "rolling reads the device's real clock; switch to Today to see it", in the empty
   style, because the library's `"rolling"` cannot be pinned to another date.
5. **The countdown** ("Today" mode): `diffUtcAsDuration(now, wrongFrom, "seconds")`, refreshed each
   second, shown as days, hours, minutes and seconds (formatting). In "A date" mode it is the
   pinned value.

**Why `NO SIGNAL`:** the era is not a whole number from 0; the build date is not an instant ("The
build date is not an ISO 8601 instant.") or is before the counter's first week; the date is not an
instant (second 60 included: "Pick a date outside an inserted second."); the date is before the
counter's first week (the D3 sentence); the firmware's window runs past the year 9999.

**Template.** Three sections: the inputs; a `.gmt-gnss-frame` with three pinned plates
(`hero-reports` "The receiver reports", series 1; `hero-wrong-from` "Wrong from", the date the
firmware starts reporting wrong dates; `hero-left` "Time left", the countdown, or "past by n
days") over **the window strip** (`role="img"`): the firmware's window lit in series 1 (from the
build date, or the fixed era), the window after it hatched with the chip "reports one counter
period early", the build date's mark in pivot mode, the check date's pin, a "today" mark, each wrap
a mark with its chip; then
**`counters-table`** (Counter, Width, Next wrap, Time left), the rolling row, the calls and the
links row (D13).

**Presets** (each pinned with a `date` unless it says "today"; every value from the run unless
marked †):

| Id | Counter, firmware, date | Expect |
| --- | --- | --- |
| `navic-built-2020` (default) | `IRN-LNAV`, build date `2020-01-01T00:00:00Z`, `2026-10-15T00:00:00Z` | right date; wrong from one 10-bit period after the build date |
| `navic-built-2020-after-wrap` | `IRN-LNAV`, build date `2020-01-01T00:00:00Z`, a date after "wrong from" | a date 7168 days early |
| `qzss-built-2005` | `QZS-LNAV`, build date `2005-06-01T00:00:00Z`, `2026-10-15T00:00:00Z` | a date 7168 days early: the firmware went wrong one 10-bit period after its build date, before the check date |
| `galileo-built-2024` | `GAL`, build date `2024-01-01T00:00:00Z`, `2026-10-15T00:00:00Z` | right date; wrong from one 12-bit period after the build date |
| `beidou-built-2024` | `BDT`, build date `2024-01-01T00:00:00Z`, `2026-10-15T00:00:00Z` | right date; wrong from one 13-bit period later |
| `navic-fixed-era` | `IRN-LNAV`, fixed era 1, `2026-10-15T00:00:00Z` | right date; wrong from `2038-11-20T23:59:42Z` † |
| `navic-fixed-era-after-2038` | `IRN-LNAV`, fixed era 1, `2039-01-01T00:00:00Z` | a date 7168 days early |
| `galileo-fixed-first-wrap` | `GAL`, fixed era 0, `2078-03-01T00:00:00Z` | a date 28672 days early; wrong from `2078-02-19T23:59:42Z` † |
| `gps-lnav-fixed-era` | `GPS-LNAV`, fixed era 2, `2026-10-15T00:00:00Z` | right date; wrong from `2038-11-20T23:59:42Z` † |
| `firmware-ahead` | `QZS-LNAV`, fixed era 3, `2026-10-15T00:00:00Z` | a date one period late |
| `today` | `GAL`, build date `2024-01-01T00:00:00Z`, today | live; tests pin the clock to `2026-10-15T00:00:00Z` |

**Permalink and chat.** Keys `counter`, `firmwareNotBefore` (the build date) or `firmwareEra`
(digits), `date` (left out for today). `showGnssRolloverCheckerInput = z.object({ counter:
z.enum(GNSS_WEEK_COUNTERS), firmwareNotBefore: z.string().min(10).max(64).optional(),
firmwareEra: z.string().regex(/^(?:0|[1-9]\d{0,5})$/).optional(), date:
z.string().min(10).max(64).optional() })` with a refinement: exactly one of `firmwareNotBefore` and
`firmwareEra`. Neither is defaulted. Doc, appended: purpose "Check when a receiver whose firmware
counts weeks from a build date, or fixes the rollover era, starts reporting wrong dates, for any
satellite week counter, with the next wrap of every counter"; when "Call when the reader asks about a GNSS week rollover, whether a receiver
is affected, when the next rollover is, or why a receiver reports a date about 19.6 years early";
args "`counter` as named (for example `IRN-LNAV`); `firmwareNotBefore` when the reader gives a
build or release date, `firmwareEra` as digits when they give an era; `date` only when the reader
names one". Starter, area `gnss`: "A NavIC receiver's firmware was built on 2020-01-01: when
does it start reporting wrong dates?", `args: { counter: "IRN-LNAV", firmwareNotBefore:
"2020-01-01T00:00:00Z" }`.

**Tests.** Every preset under a pinned clock: the peer table for all eight counters (the 10-bit
three share their next wrap; the earliest group is marked), both firmware models, the verdict and
day count, the window and "wrong from" (in pivot mode it equals the pivot's reading one era later,
and the instant before it still reports the right date),
the rolling row in each mode, the countdown's text, every sentence, the permalink round trip; the
mount's regions, holds and live tick (fake timers); no on-screen GPS-only wording such as "GPS
rollover" in a heading or the starter.
