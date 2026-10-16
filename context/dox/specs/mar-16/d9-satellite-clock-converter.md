## D. The five tools (continued)

### D9. Satellite Clock Converter: `/tools/satellite-clock-converter/`, kind `satclock`, GNSS and Maritime

**What it teaches.** One instant reads differently on every clock, and the gap between a
satellite clock and UTC grew with each leap second. It takes over the per-system offsets the
decoder used to carry.

**Files:** `src/lib/satellite-clock-converter.ts`, `…-mount.ts` and their tests;
`src/components/SatelliteClockConverter.astro`; `src/styles/gmt-satellite-clock-converter.css`;
`src/content/docs/tools/satellite-clock-converter.mdx`. Root
`<div class="gmt-satellite-clock-converter gmt-widget not-content">`.

**Inputs** (`ClockState`):

| Control | `data-role` | Element |
| --- | --- | --- |
| A time on any clock | `value` | text input, at most 64 characters: a UTC instant (`…Z` or an offset), or a scale string `YYYY-MM-DDTHH:MM:SS[.f] <TOKEN>` with `TAI` or a `GNSS_SYSTEMS` token |
| Step through the table | `moment-slider` | `rangeFieldHtml`, one position for `INTEGER_UTC_FROM` and one for `secondAfter` each insertion; moving it writes that UTC instant into `value` |
| Preset | `preset` + `preset-description` | `<select>` and a held description |

**Reading** (`readClocks`):

1. **Which clock the value is on:** the token after the value's one space. `TAI` →
   `fromTAI(value)`; a `GNSS_SYSTEMS` member → `gnssToUtc(token, value)`; no space → the value is
   UTC as typed. Any other token is the sentinel. The token list is the type's names, not a rule.
2. **Every clock** (with a UTC instant): `utcToGnss(s, utc)` for each `GNSS_SYSTEMS` member and
   `toTAI(utc)`; each lead with `leadOverUtc`; `taiMinusUtc(utc)` for the TAI row's own lead (the
   test asserts it equals the TAI row's `leadOverUtc` wherever both read).
3. **The reader's own clock row** is marked "your reading". When its written-back string differs
   from the typed one (a trimmed fraction, an offset rewritten as `Z`), the row says "written as"
   with the library's string.
4. **The next change:** `nextLeapSecond(utc)`, or "none after this instant: these gaps stay as they
   are".

**Why `NO SIGNAL`**, one sentence, in order: an unknown token ("The scale after the space is not
one of TAI, GPS, GAL, BDT, QZS, GLO or IRN."); `hasSecond60` without `isLeapSecond` on the UTC side
("No leap second was inserted at the end of that day."); the scale's converter returned `""` ("The
library does not read this as a time on that clock: check the form, or the date is before that
clock's first instant."); not an instant. A row whose own call returned `""` shows `NO SIGNAL` and
the footnote "before this system's first instant".

**Template.** Three sections:

1. The value, the slider, the preset.
2. A `.gmt-gnss-frame` with three pinned plates (`hero-utc` "UTC", series 1; `hero-tai`
   "TAI − UTC", `taiMinusUtc` + " s", sub `toTAI`; `hero-next` "Next change", `nextLeapSecond` or
   "none after this instant"), then **the lead bars** (`role="img"`, a hidden list): one bar per
   clock from 0 to its lead, on one scale whose end is the TAI row's lead; each value on a chip in
   a fixed right-hand column; the "your reading" row lit in series 1.
3. **`clocks-table`**: Clock, Reading, Ahead of UTC, for `UTC`, `TAI` and the six systems, every
   row always rendered. Two notes, page-copy facts from the JSDoc: "`GLO` is GLONASS time as RINEX
   and the BIPM report it, in UTC's own hours." and the `IRN` row's chip "derived" with the note
   "No international body states NavIC's offset; the library derives it from the NavIC epoch."
   Then the calls, and the links row (D13).

**Presets** († = JSDoc, L§4 and the built timescale JSDoc; confirm in the run):

| Id | Value | The library returns |
| --- | --- | --- |
| `utc-2024` (default) | `2024-01-01T00:00:00Z` | `BDT` `2024-01-01T00:00:04 BDT` †, `QZS` `…:18 QZS` †, `GLO` `…:00 GLO` †, `IRN` `…:18 IRN` †, `GPS` `…:18 GPS` †, `TAI` 37 s †; `GAL` from the run |
| `galileo-first-instant` | `1999-08-22T00:00:00 GAL` | UTC `1999-08-21T23:59:47Z` † |
| `beidou-reading` | `2024-01-01T00:00:04 BDT` | UTC `2024-01-01T00:00:00Z` † |
| `tai-reading` | `2026-01-01T00:00:37 TAI` | UTC `2026-01-01T00:00:00Z` † |
| `inside-leap-second` | `2016-12-31T23:59:60Z` | `GLO` `2016-12-31T23:59:60 GLO` †; `TAI` from `toTAI` (the `.5` example gives `2017-01-01T00:00:36.5 TAI` †); leads "inside an inserted second" |
| `before-beidou` | `2005-12-31T23:59:59Z` | `BDT` `""` † → its row `NO SIGNAL`; the other rows from the run |
| `no-leap-second-that-day` | `2017-12-31T23:59:60 GLO` | `""` † → `NO SIGNAL`, "No leap second was inserted at the end of that day." |
| `wrong-token` | `2024-01-01T00:00:37 UTC` | `NO SIGNAL`, the unknown-token sentence |

**Permalink and chat.** Key `value`. `showSatelliteClockConverterInput = z.object({ value:
z.string().min(10).max(64) })`. Doc, appended: purpose "Show one instant on every satellite clock
and on TAI, with each clock's lead over UTC on that date"; when "Call when the reader asks what a
GPS, Galileo, BeiDou, QZSS, GLONASS or NavIC clock or TAI reads at an instant, how far a
satellite clock is from UTC, or to convert a time-scale string to UTC"; args "`value` exactly as the
reader gave it: a UTC instant or a string ending in TAI, GPS, GAL, BDT, QZS, GLO or IRN". Starter,
area `gnss`: "What do the GPS, Galileo, BeiDou, QZSS, GLONASS and NavIC clocks read at
2024-01-01T00:00:00Z?", `args: { value: "2024-01-01T00:00:00Z" }`.

**Tests.** Every preset against the real library: the clock detected, the calls in order, every
row, every lead, the TAI cross-check, the "written as" note, each sentence, the slider's positions
(one more than the insertions, the first at `INTEGER_UTC_FROM`), the permalink round trip; the
mount's regions and holds; no `UTC+3`, `Moscow` or `MSK` anywhere.
