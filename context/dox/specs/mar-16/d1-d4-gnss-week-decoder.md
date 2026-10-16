## D. The five tools

D1 to D7 are the GNSS Week Decoder (`/tools/gnss-week-decoder/`, kind `gnssweek`, tagged `[gnss, maritime]`). D8 holds
what the five share, D9 to D12 are the other four tools, and D13 links them.

**What it teaches.** A week number means nothing without its counter and its era. The same
reading is a different instant in every era, and a RINEX file's week is not the week a satellite
sends. The tool decodes a reading three ways in, draws every era's answer in a column, and shows
the same moment on every counter. Every system's clock is the Satellite Clock Converter's (D9).

### D1. Files and the name lists

- `src/lib/gnss-names.ts` (**leaf**, imports nothing): `GNSS_WEEK_COUNTERS`, `RINEX_WEEK_SYSTEMS`
  and `GNSS_SYSTEMS` in the type's declaration order, and `GNSS_DECODER_MODES =
  ["broadcast", "rinex", "utc"]`. `dox-tools.ts` imports it, so it must stay out of the `heavy`
  list and import nothing heavy.
- `src/lib/gnss-names.test.ts`: each list, as a set, equals the `choices` of the matching enum
  field in `LIVE_PLAYGROUND_TEMPLATES` (`gnssWeekToUtc.counter`, `rinexWeekToUtc.system`,
  `utcToGnss.system`). The checker may order union members differently, so compare sorted.
- `src/lib/gnss-week-decoder.ts`: pure (no DOM, no gmt import): state, presets, the reading plan,
  sentences, permalink, holds' text lists.
- `src/lib/gnss-lib.ts`: the shared loader of the three GNSS tools (D8).
- `src/lib/gnss-widgets.ts`: the shared pure helpers (D8).
- `src/lib/gnss-week-decoder-mount.ts`: `renderGnssWeekDecoderTemplate(args)` and
  `mountGnssWeekDecoder(root, args, signal)`, returning `onceDestroy` with `getPermalinkState`.
- `src/test/gnss-lib.ts`: the real loader for tests, as `src/test/edi-lib.ts` (D8).
- `src/components/GnssWeekDecoder.astro`, `src/styles/gmt-gnss-week-decoder.css` (after the shared
  `gmt-gnss-widgets.css`),
  `src/content/docs/tools/gnss-week-decoder.mdx`.

Root: `<div class="gmt-gnss-week-decoder gmt-widget not-content">`, the first thing in the
template, no other attribute.

### D2. Inputs (`GnssDecoderState`)

| Control | `data-role` | Element | Enabled in |
| --- | --- | --- | --- |
| Way in | `mode` | `.gmt-chip-group` of three radio `chipToggleHtml`s: "Broadcast week", "RINEX week", "UTC instant" | always |
| Counter | `counter` | `<select>` of `GNSS_WEEK_COUNTERS` | broadcast, utc |
| RINEX system | `system` | `<select>` of `RINEX_WEEK_SYSTEMS` | rinex |
| Week | `week` | number input | broadcast, rinex |
| Week slider | `week-slider` | `rangeFieldHtml`, 0 to the counter's last week (D3 probe), step 1 | broadcast |
| Time of week, seconds | `tow` | number input, a fraction allowed | broadcast, rinex |
| Time-of-week slider | `tow-slider` | `rangeFieldHtml`, 0 to 604 799, step 1 | broadcast, rinex |
| Era | `era-mode` + `era` + `era-pivot` | `<select>` "Nearest today (rolling)" / "A number" / "Not before a date"; a number input enabled for "A number"; a text input (an ISO UTC instant) enabled for "Not before a date" | broadcast |
| UTC instant | `utc` | text input, at most 64 characters | utc |
| Preset | `preset` + `preset-description` | `<select>` and a held description | always |

- **Every control is present in every mode.** One not in use is `disabled` (the shared disabled
  style; the widget styles nothing itself) and shows the value the current reading gives, so a
  change of mode continues from the same moment: in broadcast and RINEX modes the UTC field holds
  the decoded instant; in UTC mode the week, time of week and era hold what `utcToGnssWeek`
  returned for the chosen counter; in broadcast mode the RINEX system shows the counter's system.
- **A counter's system is its token before the `-`** (`"QZS-CNAV"` → `"QZS"`; `"GAL"` → `"GAL"`).
  That is the library's naming rule (L D6), applied to a name, not a table.
- `SECONDS_PER_WEEK = 7 * 86_400` is the slider's end, with a comment that it is the length of a
  week, not a library rule. The test asserts the library accepts `604799.999` and refuses `604800`.
- The PageUp and PageDown keys on both ranges step one tenth of the range, as the browser does.

### D3. Reading the library (`readGnss`)

Every value below is a call. The reading runs on each input, coalesced to one per animation frame.

1. **Probes, once per counter, cached:**
   - **Last week:** the smallest `w ≥ 1` for which `gnssWeekToUtc(counter, w, 0, 0)` is `""`,
     found by doubling then bisecting. Weeks below it are the counter's range; the slider ends at
     the week before it. The sentence for an out-of-range week names that first refused week
     ("This counter shows weeks below 1024."), so the site does no arithmetic on it.
   - **Era starts:** `gnssWeekToUtc(counter, 0, 0, e)` for each era drawn.
   - **Today's era:** `utcToGnssWeek(counter, now)` with `now` the reader's clock read once per
     reading (`Temporal.Now.instant()`), its `era` field.
   - For a RINEX system, its **first instant** is `rinexWeekToUtc(system, 0, 0)`.
2. **The instant** (`utc`):
   - broadcast: `gnssWeekToUtc(counter, week, tow, era)` with `era` the integer or `"rolling"`;
   - RINEX: `rinexWeekToUtc(system, week, tow)`;
   - UTC mode: the typed string, and `utcToGnssWeek(counter, utc)` gives the reading.
3. **The eras drawn** (broadcast and UTC modes): eras `0` through today's era `+ 1`. When the
   reading's era is beyond that, a gap mark and that era's lane follow. In each lane:
   `gnssWeekToUtc(counter, week, tow, e)`. The era `"rolling"` chose is the `era` of
   `utcToGnssWeek(counter, result)`.
4. **RINEX mode lanes:** one lane for the continuous count, then one lane for each broadcast counter
   of that system (`GNSS_WEEK_COUNTERS` whose token before `-` is the system), each reading the
   same numbers at era `0`: `gnssWeekToUtc(counter, week, tow, 0)`. A lane whose result differs
   from the RINEX result (string comparison) carries the chip "a different instant". This is the
   L D12 trap, drawn: `IRN` week `2295`, `86418` is `2024-01-01T00:00:00Z` from the file and
   `2043-08-17T00:00:00Z` on the `IRN-L1NV` counter.
5. **The same moment everywhere** (with a non-sentinel instant): `utcToGnssWeek(c, utc)` for every
   counter and `utcToRinexWeek(s, utc)` for every RINEX system.
6. **The reading's own system** (with a non-sentinel instant): `utcToGnss(system, utc)` for the
   counter's or record's system, and its **lead over UTC**,
   `diffUtcAsDuration(utc, <label's date-time>Z, "seconds")` (the shared `leadOverUtc`, D8). When
   the instant or the label holds second 60, `diffUtcAsDuration` cannot read it: the sub line reads
   "inside an inserted second" in the empty style. `isLeapSecond(utc)` decides the "leap second"
   chip on the UTC plate. Every other system's clock is the Satellite Clock Converter's job (D9);
   the decoder links to it (D13).

**Why `NO SIGNAL`** (`gnssNullText`), one sentence, decided by library calls in this order:

| Mode | Test | Sentence |
| --- | --- | --- |
| broadcast, RINEX | week not a whole number from 0 | "The week is a whole number from 0." |
| broadcast | week at or past the first refused week | "This counter shows weeks below {first refused week}." |
| broadcast, RINEX | time of week outside 0 up to 604 800 | "Time of week runs from 0 up to, not including, 604800 seconds." |
| broadcast | era not a whole number from 0 and not rolling | "The era is a whole number from 0, or rolling." |
| broadcast | "Not before a date" and `!isValidInstant(pivot)` | "The date the era counts from is not an ISO 8601 instant." |
| broadcast, RINEX | every part valid and the result is `""` | "That reading falls after the year 9999." |
| UTC | `hasSecond60(utc) && !isLeapSecond(utc)` | "No leap second was inserted at the end of that day." |
| UTC | `!hasSecond60(utc) && !isValidInstant(utc)` | "This is not an ISO 8601 instant with an offset or Z." |
| UTC | valid, and `utcToGnssWeek` is `null` | "This is before the counter's first week, which starts at {era 0 start}." |

A blank form in UTC mode makes no call and shows the empty state. A table cell whose own call
returned `""` or `null` shows `NO SIGNAL`, and one footnote under the table says which inputs gave
no reading ("before this system's first week").

### D4. Template

Three numbered sections and a links row. Sections 2 and 3 are `gmt-widget-section--wide` (the
child-selector trap) and ease through `.gmt-grow`. Section 1 is never wrapped.

1. **The reading.** The mode chips, then the field grid (D2), then the preset and its held
   description.
2. **Across rollover eras.** A `.gmt-gnss-frame` holding:
   - **Three hero plates** (`.gmt-punct-heroes` / `.gmt-punct-hero`, pinned with
     `justify-content: space-between`, `aria-hidden`, the values repeated in a visually hidden
     summary with `aria-live="polite"`):

     | Plate | `data-role` | Caption | Value | Sub line |
     | --- | --- | --- | --- | --- |
     | series 1 | `hero-utc` | "UTC" | the instant | "era n" (and "nearest today" when rolling chose it), or "continuous count" in RINEX mode; a "leap second" chip when `isLeapSecond` |
     | quiet | `hero-system` | "{system} time" | `utcToGnss(system, utc)` | "ahead of UTC by n s", or "inside an inserted second" |
     | quiet | `hero-rinex` | "RINEX week" | `utcToRinexWeek(system, utc).week` | "time of week n s", from the same call |

     A plate with no result reads "no result". Widths are reserved for the longest value any
     preset, any range position and a nine-digit fraction can give: a 30-character instant, a
     33-character label. The arithmetic is written in the sheet beside the rule.
   - **The era lanes** (`data-role="lanes"`, `role="img"` with a generated `aria-label`, and a
     visually hidden list of one sentence per lane). One lane per era (D3.3) or per RINEX row
     (D3.4). A lane is a bar from its era's start to the next era's start; every lane has the same
     width, so a reading sits at the same x in every era and the pins line up. Each lane has:
     - a label column on the left: "era n", or "RINEX" / the counter name;
     - the pin (`.gmt-cutoff-mark`) at the lane's result, placed by the polyfill;
     - a value chip in a fixed column on the right, on an opaque plate (`.gmt-cutoff-chip`), so
       the text never moves with the pin;
     - the chosen era in series 1 (lit glass and a "your reading" chip); the era `"rolling"`
       would choose carries "nearest today"; the others are neutral;
     - a "today" mark on the lane that holds the reader's now, a dashed `--gmt-ice` rule with a
       chip, never amber.
     A lane with no result keeps its box, has no pin, and its chip reads "no result".
   - **The calls**, one per line, with results (`.gmt-widget-codeframe`).
3. **The same moment on every counter.** Two real tables (`display: table`, `table-layout:
   fixed`, `overflow-x: auto`), each row always rendered:
   - `counters-table`: Counter, Week, Time of week (s), Era, for the eight counters;
   - `rinex-table`: RINEX system, Week, Time of week (s), for the five systems.
   The row of the reading's counter or system carries a hatched background and a "your reading"
   chip (pattern and word, no colour verdict). Under a named container width the tables become
   stacked rows, as the Timetable Reader's table does. The calls follow.
4. **Links row** (`.gmt-widget-controls`, D13): "Every satellite clock at this moment" to the
   Satellite Clock Converter, and "Is a receiver on this counter affected, and when?" to the GNSS
   Rollover Checker.

Every varying region (each plate's value and sub line, each lane chip, each table cell, each
footnote, the reason aside, each call frame) is held (`holdHtml`), its text list built by running
the pure text functions over a result of each shape. A call frame with no call keeps its box
(`visibility: hidden`).
