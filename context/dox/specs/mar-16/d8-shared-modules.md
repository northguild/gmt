## D. The five tools (continued)

### D8. Shared pieces of the five tools

- **`src/lib/gnss-names.ts`** (leaf, D1) also holds `ROLLOVER_NOW_MODES = ["today", "date"]`.
- **`src/lib/gnss-widgets.ts`** (pure; takes a `GnssLib`, imports no gmt):
  - `counterSystem(counter)`: the token before `-`;
  - `labelParts(label)`: the date-time and the token of a scale string, split at its one space;
  - `leadOverUtc(lib, utc, label)`: `diffUtcAsDuration(utc, <date-time>Z, "seconds")`, or the
    "inside an inserted second" state when either reading holds second 60;
  - `firstRefusedWeek(lib, counter)` (the D3 probe, cached per counter), `eraStart(lib, counter,
    era)` (`gnssWeekToUtc(counter, 0, 0, era)`), `eraAt(lib, counter, instant)`
    (`utcToGnssWeek(counter, instant).era`);
  - the text helpers the three GNSS tools share ("no result", the before-first-week sentence).
- **`src/lib/timescale-widgets.ts`** (pure; takes a `TimescaleLib`):
  - `INTEGER_UTC_FROM = "1972-01-01T00:00:00Z"`, commented with its source: UTC has differed from
    TAI by whole seconds since this instant (BIPM Annual Report on Time Activities, Table 2;
    ITU-R TF.460-6; IERS `Leap_Second.dat`). Its test asserts `taiMinusUtc` reads it and returns `null` one second
    before;
  - `CONTINUOUS_UTC_FROM = "2027-05-20"`, a date with no time of day, as CGPM 2026 Resolution 5
    states it ("continuous UTC will become effective on 20 May 2027"). No library function returns
    it; it is drawn as the end of insertions and never used in a calculation;
  - `insertions(lib)`: every inserted second, by walking `nextLeapSecond` from `INTEGER_UTC_FROM`
    until it returns `""`. The test asserts the walk ends (27 steps today; the number is never
    typed into a page);
  - `secondAfter(lib, insertion)`: `addUtc(<the insertion with second 59>, { seconds: 1 })`, the
    first instant on the new offset. Rewriting `60` as `59` is reading the label, not arithmetic;
  - `insertionsBetween(lib, start, end, count)`: the `|count|` insertions `leapSecondsBetween`
    counted. From the earlier endpoint: that endpoint itself when `isLeapSecond` says it is one
    (the count is half-open, `[start, end)`), then `nextLeapSecond` until the list holds `|count|`.
    The test asserts the list's length equals the count for every preset of D11 and D12;
  - `secondsText(ns: bigint)`: formatting only (`"86401 s"`, a fraction to nine digits).
- **Loaders:**
  - `src/lib/gnss-lib.ts` (the Decoder, the Clock Converter, the Rollover Checker):
    `GMT_MODULES["gnss/convert"]`, `["timescale/calculate"]`, `["timescale/convert"]`,
    `["timescale/validate"]`, `["plain/validate"]`, `["precision/validate"]`, `["utc/calculate"]`,
    `["utc/compare"]`;
  - `src/lib/timescale-lib.ts` (the Timeline, Elapsed vs. Clock): `["timescale/calculate"]`,
    `["timescale/convert"]`, `["timescale/validate"]`, `["span/calculate"]`, `["utc/calculate"]`,
    `["plain/validate"]`, `["precision/validate"]`.
  Each picks only the names its tools call. A rejected import becomes a `WidgetLoadError`.
  `src/test/gnss-lib.ts` and `src/test/timescale-lib.ts` load the real library for tests.
- **`src/styles/gmt-gnss-widgets.css`**: the family sheet for the five roots: the frame
  (`.gmt-gnss-frame`), lanes and rulers, the peer tables, the hatched "your reading" row. The
  five roots join the plate, mark, chip and series lists of `gmt-punctuality-widgets.css` and
  `gmt-cutoff-widgets.css`, so nothing is copied. Each tool's own sheet follows it in `customCss`.
- **Cross-links** between the tools (D13) are built with `encodeWidgetPermalink`.
