# Slice 1 · GTFS Trip Board

[Index](./index.md). Each file follows its `gtfs-service-day-clock` twin unless this slice says
otherwise.

## Reader

The reader lives in `gtfs-trip-board.ts`, a pure module with no DOM.

**Splitting.**

- The paste is split on `\n`. One trailing `\r` is dropped from each line, and blank lines are
  skipped.
- Line numbers count physical lines, starting at 1, so the reader can find a line in the paste.
- Cells are split on `,` and nothing is trimmed: a padded time goes to the library, which
  refuses it.

**When the whole paste is refused.** Each case shows a single note and an empty table body:

| Case                           | Note                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing typed                  | "Paste a header line and up to 12 stop_times.txt rows."                                                                                |
| Over 2,000 characters          | "The paste is over 2,000 characters. The board reads one trip of up to 12 stops."                                                      |
| A required column is missing   | "The header has no `<col>` column." It names every missing column. The header needs `stop_id`, `arrival_time` and `departure_time`; `stop_timezone` is optional. |
| A column name appears twice    | "The header names `<col>` twice."                                                                                                      |

**When a row is rejected.** The row stays in its place, every value cell reads "not read", and
a note says "Line N: …":

- the line is over 150 characters: "is over 150 characters";
- the row has the wrong number of cells: "has N cells; the header has M";
- the row contains `"`: "has a quoted field; the board reads unquoted rows only";
- the `stop_id` is empty: "has no stop_id".

**Rows past the 12th** are not read. The note says "Rows past the 12th are not read: N more."

**A row that is read:**

- **Time cells.** An empty time is "not given": a stop that is not a timepoint may leave it
  empty, and no call is made for it. If both times are empty, the stop cell adds "not a
  timepoint".
- **The stop's zone.** It is the `stop_timezone` cell, or the agency's zone when the cell or the
  column is empty or missing, labelled "agency zone".

## Calls per stop

A widget draws library results and computes none. For each time a row gives:

| Value             | Call                                                                                                                                                                                                         | `""` / null                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instant           | `gtfsToInstant(date, time, agencyZone)`                                                                                                                                                                      | NO SIGNAL. The note is "Line N, arrival_time: " followed by `REASONS[explainRefusal(lib, date, time, agencyZone)]`.                                                                          |
| Platform reading  | `convertUtcToZoned(instant, stopZone)`, drawn with `zonedValue`; the instant itself sits under it, dim                                                                                                     | NO SIGNAL. The note is "Line N: stop_timezone is not an IANA name or an offset."                                                                                                             |
| Wrong reading     | Only when `stop_timezone` is not empty: `gtfsToInstant(date, time, stopZone)`, then `convertUtcToZoned(wrong, stopZone)`. The badge comes from `diffUtc(instant, wrong, "minutes")`, where a positive value is later. | NO SIGNAL. When `stop_timezone` is empty, the cell reads "agency zone: nothing to misread".                                                                                                  |
| Leg               | From the nearest earlier row that was read: its departure, or its arrival when the departure is not given, up to this arrival (or this departure). Elapsed time is `diffUtc(from, to, ["hours","minutes"])`. The clocks are `diffDateTime(convertUtcToPlainDateTime(from, {timeZone: fromZone}), convertUtcToPlainDateTime(to, {timeZone: stopZone}), ["hours","minutes"])`. | The first row reads "first stop". An end that is not given reads "not given". An end that was refused reads NO SIGNAL.                                                                       |

**Leg verdicts,** chosen in this order:

1. "clocks agree", when both records have equal `hours` and `minutes`.
2. "clock change in leg", followed by the instant from `getDstTransitions`.
   - It is asked per zone in `{fromZone, stopZone}`, for every year from
     `yearAt(lib, zone, from)` to `yearAt(lib, zone, to)`, each year once.
   - It is filtered by `isBetweenUtc(t.instant, from, to)`.
3. "zone change", when `fromZone !== stopZone`.
4. Otherwise, "clocks differ".

A record prints as `2 h 10 min`. The hours are dropped when they are 0. A negative record
prints with one U+2212 minus sign, as in "−40 min" and "−1 h 40 min".

**Plates.**

- **Trip:** `diffUtc` from the first read departure to the last read arrival.
- **Stops the wrong zone moves:** "N of M stops", counting the shifts that are not 0.
- Either plate reads NO SIGNAL when it has no input.

**Calls frame.** It records the calls in `name(args); // result` form, through the sibling's
`recorder`.

## Presets

These are sample trips, not a real timetable. Every value below was computed with the worktree's
built library on 2026-11-15. The header is
`stop_id,arrival_time,departure_time,stop_timezone`, and an empty last cell means agency zone.
**Inst.** is the arrival instant (or the departure at the first stop). **Platform** is the
arrival's wall clock in the stop's zone (offset in brackets). **Leg** gives elapsed / clocks.

**`border`**, the default. 20260615, `Europe/Madrid`. The stops `madrid-chamartin`, `caceres` and
`badajoz` are agency zone. `elvas`, `entroncamento` and `lisboa-oriente` are `Europe/Lisbon`.

| Stop            | arr / dep         | Inst.     | Platform     | Leg                      | Wrong                          |
| --------------- | ----------------- | --------- | ------------ | ------------------------ | ------------------------------ |
| madrid-chamartin | 08:00:00 / 08:00:00 | 06:00:00Z | 08:00 (+02) | first stop               | agency zone                    |
| caceres         | 10:32:00 / 10:35:00 | 08:32:00Z | 10:32 (+02) | 2 h 32 / 2 h 32, agree   | agency zone                    |
| badajoz         | 11:25:00 / 11:32:00 | 09:25:00Z | 11:25 (+02) | 50 min / 50 min, agree   | agency zone                    |
| elvas           | 11:52:00 / 11:54:00 | 09:52:00Z | 10:52 (+01) | 20 min / −40 min, zone change | 10:52:00Z, 11:52 (+01), 60 min later |
| entroncamento   | 13:20:00 / 13:22:00 | 11:20:00Z | 12:20 (+01) | 1 h 26 / 1 h 26, agree   | 60 min later                   |
| lisboa-oriente  | 14:15:00 / 14:15:00 | 12:15:00Z | 13:15 (+01) | 53 min / 53 min, agree   | 60 min later                   |

Plates: 6 h 15 min; 3 of 6 stops.

**`night-train`.** 20261024, `Europe/Vienna`. The Austrian stops `wien-hbf` and `linz-hbf` are
`Europe/Vienna`. The rest are `Europe/Berlin`.

| Stop          | arr / dep           | Inst.        | Platform        | Leg                     |
| ------------- | ------------------- | ------------ | --------------- | ----------------------- |
| wien-hbf      | 20:13:00 / 20:13:00 | 24th 18:13Z  | 20:13 (+02)     | first stop              |
| linz-hbf      | 21:28:00 / 21:31:00 | 19:28Z       | 21:28 (+02)     | 1 h 15 / 1 h 15         |
| passau-hbf    | 22:43:00 / 22:50:00 | 20:43Z       | 22:43 (+02)     | 1 h 12 / 1 h 12         |
| nuernberg-hbf | 25:10:00 / 25:18:00 | 24th 23:10Z  | 25th 01:10 (+02) | 2 h 20 / 2 h 20        |
| wuerzburg-hbf | 26:25:00 / 26:30:00 | 25th 00:25Z  | 02:25 (+02)     | 1 h 07 / 1 h 07         |
| goettingen    | 28:40:00 / 28:44:00 | 02:40Z       | 03:40 (+01)     | 2 h 10 / 1 h 10, clock change in leg at 2026-10-25T01:00:00Z |
| hannover-hbf  | 29:50:00 / 29:58:00 | 03:50Z       | 04:50 (+01)     | 1 h 06 / 1 h 06         |
| hamburg-hbf   | 31:20:00 / 31:20:00 | 05:20Z       | 06:20 (+01)     | 1 h 22 / 1 h 22         |

Every wrong reading here is "same instant". Plates: 11 h 7 min; 0 of 8 stops.

The page says so plainly: Vienna and Berlin keep the same offsets all year, so on this trip the
mistake moves nothing. The trip shows the clock change instead: the Würzburg to Göttingen leg
takes 2 h 10 min while the clocks say 1 h 10 min.

**`andes-june`.** A coach timetable; GTFS covers buses too. 20260615, `America/Santiago`. The
stops `santiago-terminal` (08:00:00 / 08:00:00) and `los-andes` (09:20:00 / 09:30:00) are agency
zone. `los-libertadores` (11:30:00 / 12:30:00), `uspallata` (14:10:00 / 14:20:00) and
`mendoza-terminal` (16:00:00 / 16:00:00) are `America/Argentina/Mendoza`.

| Stop               | Inst. | Platform    | Leg                       | Wrong          |
| ------------------ | ----- | ----------- | ------------------------- | -------------- |
| santiago-terminal  | 12:00Z | 08:00 (−04) | first stop               | agency zone    |
| los-andes          | 13:20Z | 09:20 (−04) | 1 h 20 / 1 h 20          | agency zone    |
| los-libertadores   | 15:30Z | 12:30 (−03) | 2 h 0 / 3 h 0, zone change | 14:30Z, 11:30 (−03), 60 min earlier |
| uspallata          | 18:10Z | 15:10 (−03) | 1 h 40 / 1 h 40          | 60 min earlier |
| mendoza-terminal   | 20:00Z | 17:00 (−03) | 1 h 40 / 1 h 40          | 60 min earlier |

Plates: 8 h 0 min; 3 of 5 stops.

**`andes-january`.** The same rows on 20260115. Santiago is on −03 in its summer. Arrival instants are 11:00Z,
12:20Z, 14:30Z, 17:10Z and 19:00Z; every platform reading is the typed time at −03; every leg
agrees (the border leg is 2 h 0 / 2 h 0); every wrong reading is "same instant". Plates: 8 h 0 min;
0 of 5 stops.

The two Andes presets carry the lesson: the mistake is out by the size of the change, an hour in
most zones, for half the year only. Santiago changes its clocks
(2026-04-05T03:00:00Z and 2026-09-06T04:00:00Z) and Mendoza does not.

**`no-noon`.** 20111230, `Pacific/Apia`. The stops are `apia-wharf` (08:00:00 / 08:00:00),
`faleolo` (08:45:00 / 08:50:00) and `mulifanua` (09:05:00 / 09:05:00), all agency zone.

- Every `gtfsToInstant` call returns `""`, so every cell reads NO SIGNAL.
- Every leg reads NO SIGNAL, because `diffUtc` returns null.
- Each note uses `REASONS.nonexistent`, and both plates read NO SIGNAL.
- The reason: Samoa skipped 30 December 2011 (a transition to +14:00 at 2011-12-30T10:00:00Z),
  so noon is the sentinel for the whole trip.

## Mount, component, page

The mount follows its twin, `gtfs-service-day-clock-mount.ts`. The section order is:

1. **The trip.**
   - A `field` with `textArea` from `families/ledger/text-area`, 8 rows. Its label is
     "Trip rows (stop_times.txt, with stop_timezone from stops.txt)".
   - A `textInput` for "Service date (calendar.txt)" and one for
     "Zone (agency.txt, agency_timezone)".
   - `gmt-preset` with the five presets.
   - The textarea scrolls inside itself (`white-space: pre`), never the page.
2. **Plates**, as `plates` with `hold`. The ghosts are the widest trip text ("−999 h 59 min"),
   "12 of 12 stops", `SIGNAL_TEXT` and `NOTHING_TYPED`.
3. **The table,** inside `grow()`, with `gate: "drawn"`.
   - The columns are `stop` (the row header), `arrival`, `departure`, `wrong` and `leg`, at 16%,
     22%, 22%, 22% and 18%.
   - Each value is a `hold`. The ghosts are `GHOST_ZONED` (the `convertUtcToZoned` output for
     `WIDEST_ZONE`, written as a literal and asserted against the library in a unit test),
     `GHOST_UTC`, `SIGNAL_TEXT`, "not given", "not read", the longest badge and the longest
     verdict.
   - Below 46rem, each stacked row is a block with a full bevelled border on all four sides,
     never a left edge alone.
   - The notes list sits under the table, `aria-live="polite"`.
4. **Calls made.**
   - A `select`, "Calls for". Its default is the first stop whose wrong reading moves, or else
     the first stop that was read.
   - Then `codeFrame({ gate: "codeframe", minLines, sizer })`, as in the sibling.
5. **`toolLinks`,** with `encodeWidgetPermalink`.

The rest of the mount:

- `renderGtfsTripBoardTemplate` parses the seed rows (string work only) and renders the table
  with every hold empty, so the first paint has the right row count.
- `permalinkOf` gives the preset id alone while all three boxes match a preset, and every value
  otherwise.
- Listeners are delegated `input` and `change` handlers with `{ signal }`, and the mount returns
  `onceDestroy`.
- `GtfsTripBoard.astro` takes `fullbleed` and calls `seedFromLocation("gtfstrip")`.

**The page** uses `ToolLayout` with `keypoint`, `intro` and `after`, frontmatter
`industries: [rail]`, and a `ts` block with `// result` comments:

```ts
gtfsToInstant("20260615", "11:52:00", "Europe/Madrid"); // "2026-06-15T09:52:00Z"
convertUtcToZoned("2026-06-15T09:52:00Z", "Europe/Lisbon"); // "2026-06-15T10:52:00+01:00[Europe/Lisbon]"
gtfsToInstant("20260615", "11:52:00", "Europe/Lisbon"); // "2026-06-15T10:52:00Z", an hour late
```

## Wiring

- **`dox-tools.ts`.**
  - `showGtfsTripBoardInput`: `stopTimes` max(2000), `date` max(16), `zone` max(64) and `preset`
    as an enum, all optional, with a `.refine` that requires one of them.
  - Add the tool to the `DoxToolName` union, to `DOX_TOOLS` and to `ENABLED_TOOL_NAMES`.
  - The `DOX_TOOL_DOCS` entry: its `when` says to use the tool for a whole trip, or when a
    stop's `stop_timezone` differs from the agency's, and its `args` say that the CSV needs a
    header line.
- **Worker.** `worker/tools.ts` returns `accept("gtfs-trip-board")`.
- **Registry and permalink.**
  - `widget-registry.ts`: a `defineWidget` entry with kind `gtfstrip`.
  - `widget-permalink.ts`: add the kind, the page path `/tools/gtfs-trip-board/`, the entry in
    `EMPTY_KEYS_BY_KIND`, and `stopTimes: 2000` in `LONG_STRING_KEYS`.
- **Site lists.**
  - `chat-constants.ts`: the starter "A GTFS trip from Madrid to Lisbon: which stops does
    stop_timezone move, and by how much?", with area `rail` and args `{ preset: "border" }`.
  - `mdx-jsx.ts`: add `"GtfsTripBoard"`.
  - `industry-overview.ts`: a rail `solves` row, "A stop's time read in its own zone", that
    links the guide, `/mistakes/rail/` and the tool.
- **Gate scripts.**
  - grow-measure: `{ slug: "gtfs-trip-board", preset: PRESET, drag: null }`.
  - html-diff: `{ path: "tools/gtfs-trip-board", widget: "gtfs-trip-board" }`.
  - visual-snapshot: `{ slug: "tool-gtfs-trip-board", path: "/tools/gtfs-trip-board/" }`.
  - readout-still:
    - `presets: ["border", "night-train", "no-noon"]`, `controls: []`;
    - `entries` for the date (`20260615`, `20260230`, `2026-06-15`, `""`), the zone
      (`Europe/Madrid`, `+05:30`, `Not/AZone`, `America/Argentina/Buenos_Aires`, `""`), and the
      trip rows (the `border` paste with a refused time, with `Europe/Wien` as one stop's
      `stop_timezone`, and with one time left empty), each keeping six rows;
    - `track: null`, `frame: false`, `scope: "above"`, `drawn: ["drawn", "hold"]`,
      `textBoxes: ["codeframe"]`.
- **Pages that link to the tool.** Each link is
  `/tools/gtfs-trip-board/?w=gtfstrip&wa=%7B%22preset%22%3A%22border%22%7D`.
  - The guide: a sentence in "### The agency's zone", and an entry in "See it break, then work".
  - `mistakes/rail.mdx`: a line after "Reading a stop's time in its own zone".
  - The Service Day Clock page: the `after` slot, "for a whole trip".

## Tests

- **`gtfs-trip-board.test.ts`.**
  - Every reader rule and message above.
  - Every preset against the tables above, through `~/test/trip-board-lib`.
  - That `GHOST_ZONED` is the library's output.
  - `permalinkOf`, `readArgs` and `matchPreset`.
- **`-mount.test.tsx`.**
  - Each preset.
  - Typing into each box, and changing the select.
  - Each test creates its own `AbortController`. `afterEach` aborts it and destroys the handle,
    even when an assertion fails. There are no timers and no sleeps; tests await the mount's
    promise.
- **`-prose.test.ts`.** It evaluates the `ts` block, checks for no "since midnight", checks that
  calls appear in code font, and checks for the rail tag.
- **`worker/tools.test.ts`:** accept, reject and cap tests.
- **`widget-permalink.test.ts`:** each preset round-trips; `stopTimes` round-trips at 2,000
  characters and is dropped at 2,001.
- **`widget-graph.test.ts`:** the heavy list gains `gtfs-trip-board.ts` and
  `gtfs-trip-board-mount.ts`.
- **`widget-load-error.test.tsx`:** add `MOUNTS`.
- **The holds browser test.**
  - It runs in Chromium and WebKit, at 300, 390, 1280 and 1440 px.
  - It steps every preset and the readout-still edits.
  - It waits for `document.getAnimations()` before it takes the baseline.
  - It checks that the plates' and `dd` rects stay within 0.5 px across edits.
  - For the edits that keep the row count, the table's rect must not change.
  - `scrollWidth <= clientWidth` holds for the page and for every cell at 300 px.
  - At 1280 px and wider, the plates meet the row's edges.
  - Every plate and every stacked block has all four border widths above 0.
  - Each page is closed in `finally`.
