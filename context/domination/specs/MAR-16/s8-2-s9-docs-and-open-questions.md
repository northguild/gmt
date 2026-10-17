## 8. Doc slice (continued)

### 8.2 Tracker and overview

- **Already done in this revision (unstaged):** the reference-data rule's closed-table exemption in
  `tracker.md` (DoD), and its restatements in `overview.md` (Key Decisions "Bundled reference data"
  and "Leap seconds", "Why there are no bundled registries") and `index.md`.
- `overview.md`, architecture tree — the current plan, no dated narrative:
  - under the new core modules, add `timescale/  (SPA-48, MAR-16 — TAI, leap seconds; SPA-46 TAI64)`
    and `gnss/  (MAR-16 — satellite system times, weeks, rollovers)`;
  - `maritime/` → `(MAR-17 … MAR-19, MAR-59)`;
  - the `space/` line and its `data/ (Bulletin A)` child → one line, "Space realm — namespace name
    decided when the SPA stories start (SPA-47, SPA-49 … SPA-53, SPA-74, SPA-75)", with a note that
    "space" would collide with a planned spatial/geo expansion (GeoJSON, coordinates), so it is not
    reserved.
- `overview.md`, "What's in Core After This Epic" table: add `timescale/` (SPA-48, MAR-16, SPA-46:
  TAI − UTC, leap seconds, TAI and TAI64) and `gnss/` (MAR-16: the six RINEX system times, week
  counters, rollovers, RINEX weeks).
- `overview.md` Key Decisions: "Realm architecture" example `@northguild/gmt/space` →
  `@northguild/gmt/finance`, `@northguild/gmt/maritime`; "Space scales" `toTAI()`, `toGPS()` →
  `toTAI()`, `gnssToUtc()` and drop "(SPICE, SOFA, astropy pattern)"; "Leap seconds" names
  `timescale/` as the table's home.
- `tracker.md` realm notes name no code paths today; Phase 6's SPA-48 note changes as below. Nothing
  else names `space/` or `maritime/` paths.
- Finalizer: move the SPA-48 row to **#21**, directly above MAR-16 (now #22), Status `Done` for both,
  Release `—`. Renumber rows old #21–#60 by +1; #62–#68 keep their numbers. SPA-46's Deliverable:
  "TAI64 / TAI64N / TAI64NA labels". MAR-16's: "GNSS time scales (the six RINEX systems), week
  rollover, RINEX weeks, TAI, decoder tool".
- Cut table: `MAR-59 (#26) | MAR-16, SPA-48, MAR-17 … MAR-19, MAR-59`; `SPA-74 (#63) | SPA-46,
  SPA-47, SPA-49, SPA-74`; every cut between old #21 and #60 +1 (AV-64 #32, RAI-24 #35, IOT-66 #41,
  HLTH-39 #48, HLTH-68 #50, FIN-45 #56, FIN-73 #59).
- Phase 6 note: replace "**`SPA-48` comes first in this realm, not third.** … Build it when the first
  of those stories is picked up" with "**`SPA-48` shipped with `MAR-16`**, in the `timescale/` Core
  namespace. Its built-in table and queries are what `SPA-46`, `IOT-31` and `FIN-73` consume."
- Then `pnpm deps:sync`; confirm `pnpm deps -- check` passes.

### 8.3 Standards text

**`coding-standards.md`, after the INT-15 scoped exception:**

> ### Scoped exception: time-scale strings in the `timescale/` and `gnss/` converters (MAR-16)
>
> The same three rules extend to `fromTAI` (`packages/gmt/src/timescale/convert/`) and `gnssToUtc`
> (`packages/gmt/src/gnss/convert/`). A time-scale string
> (`"2026-01-01T00:00:37 TAI"`) is an ISO 8601 extended local date-time, one space, and a token
> naming the scale: `TAI` (FITS 4.0 Table 30) or one of the six RINEX 4.02 §5.2.8 time-system
> identifiers (`GPS`, `GAL`, `BDT`, `QZS`, `GLO`, `IRN`). ISO 8601 has no designator for TAI or a
> satellite system's time, and no `Temporal.*.from` reads one at any layer. The grammar is fixed,
> never caller-supplied:
>
> 1. One regex, `timeScaleString` in `internal/timeScaleString.ts`: a four-digit year, `T`, seconds
>    required, one to nine fraction digits after `.`, one space, the token. Not in `regex/`: no
>    standards body publishes the joined form.
> 2. The extracted fields are always handed to `Temporal.PlainDateTime.from(fields, { overflow:
>    "reject" })`. A second of 60 never reaches Temporal: it is refused for every token but `GLO`,
>    and for `GLO` it is passed as 59 with a flag, and kept only for one of the 27 inserted leap
>    seconds.
> 3. The try-catch and sentinel-return rules above are unchanged.
>
> The UTC side reads a second-60 instant (`"2016-12-31T23:59:60Z"`) without manual parsing: GMT's
> instant grammar with second 60 (`internal/utcReading.ts`) checks the shape, and
> `Temporal.Instant.from` reads it with the specification's clamp to 59. Only the `timescale/` and
> `gnss/` converters do this, and only for one of the 27 inserted leap seconds. Every other
> function still rejects a second of 60.
>
> This prohibition stands for every other function in the library.

**`code-review-checklist.md`, Architecture:** add `gnss/` and `timescale/` to the directory list.

### 8.4 Docs site pages (every result run against `packages/gmt/dist`)

Per [docs-site.md](../../docs-site.md). `dox-builder` writes these pages (dox-architect spec, F1),
not the library pipeline. Each is tagged by the one industry whose own namespace it runs (§5.5):
the GNSS guide, scenarios and mistakes page are `gnss`, the Maritime guide is `maritime`, and the
timescale pages are `core`.

- **GNSS guide** `guides/industries/gnss-system-time-and-week-rollover.mdx`, one `##` per rule:
  why every satellite scale but `GLO` runs ahead of UTC by an amount that changed with each leap
  second, with all six side by side and no system as the lead example; the six RINEX scales and
  their epochs (Galileo's 13 s; NavIC's derived offset); `GLO` is UTC hours, and raw broadcast
  GLONASS system time needs three hours removed; week counters (LNAV, CNAV, L1NV), the rollover
  instants, `"rolling"` vs an integer era; RINEX navigation weeks vs broadcast weeks; the tools;
  `## See it break, then work`.
- **Maritime guide** `guides/industries/maritime-gnss-time-and-week-rollover.mdx`: how ships use
  satellite time, framed by the six IMO recognitions, IEC 61108 per system and IEC 61162-1:2024
  (§5.5, D6): which systems a ship may use, equipment passing time in UTC, the log keeping UTC, a
  receiver's week counter over a ship's life, a leap second in a ship's record, and
  `## See it break, then work`. It links the GNSS guide and tools for the rules themselves.
- **Core guide** `guides/core-date-operations/leap-seconds-and-tai.mdx`: the 27 insertions in a
  table with the IERS source and Bulletin C 72; TAI − UTC by date; `23:59:60` is real only on listed
  days; counting; CGPM 2022 and 2026 and why the table is closed; the weekly canary.
- Scenarios (`scenarios/<slug>.mdx`, `<Scenario>` with `fixedSpecId` = the function's playground):
  `gnss-offset-hardcoded.mdx`, `gnss-week-that-wrapped.mdx`, `thirteen-bit-week-read-as-ten-bit.mdx`,
  `rinex-week-read-as-broadcast.mdx` and `a-leap-second-that-never-happened.mdx`. A slug names the
  fault, never one system, so no system is the lead example.
- Mistakes, Wrong/Correct pairs: for GNSS — the sign of a satellite scale's lead over UTC (GPS
  and Galileo alike); a fixed offset such as 18 s or 4 s; the present-day offset at a system's epoch; GLONASS time read with three hours added; a week without
  its counter or era; a RINEX week fed to a broadcast counter. For timescale — `hasSecond60` used as
  a leap-second check; integer TAI − UTC before 1972. The GNSS pairs go on the GNSS mistakes
  page (`mistakes/gnss.mdx`); the timescale pairs on a core mistakes page
  (`mistakes/leap-seconds.mdx`).
- Indexes: `guides/index.mdx`, `guides/core-date-operations/index.mdx`, `mistakes/index.mdx`, and
  `guides/industries/index.mdx`.
- The decoder tool's page is in the dox-architect spec.
- No page names SPA-46's TAI64 functions (not merged).

---

## 9. Open questions

### 9.1 Owner decisions (closed)

1. **The `GLO` lower bound is 1972-01-01T00:00:00Z** (owner decision; D10). RINEX and BIPM give
   GLONASS time no epoch, so a `GLO` label exists wherever UTC has whole-second leap seconds. The
   bound accepts dates before the constellation existed (first launch 1982), as `utcToGnss("GPS", …)` accepts
   dates before GPS's first satellite. The only document that dates GLONASS time later is the ICD
   that GMT does not follow.
2. **The weekly IERS canary stays until IERS publishes its file format for continuous UTC, and is
   retired then** (owner decision; D1, §5.8). Once continuous UTC is in effect on 20 May 2027 the
   file should gain no row, but until IERS says what the file looks like under continuous UTC, the
   canary is what would catch an unexpected change to it.

### 9.2 For the researcher

None open: the RINEX BeiDou and Galileo week rows are resolved (researcher §9.3.1, §12).

### 9.3 Decisions taken here that change story text (no question; listed so nothing surprises)

- D1–D2: the table is built in; no table argument; `leapSecondTable`, `tableProvenance`,
  `isTableStale` and `isValidLeapSecondTable` are dropped; no `…/data` subpath; TAI − UTC is 37 s
  after the last row.
- D3: `isLeapSecond` (plain) renamed `hasSecond60`: breaking, in a `minor`.
- D5–D6: RINEX and FITS tokens; `GnssSystem` is the six RINEX identifiers (`BDT`, not `BDS`); week
  functions take a named counter, including `IRN-LNAV` and `IRN-L1NV`; the GPS forms take `"LNAV"` /
  `"CNAV"`.
- D7–D8: required `rolloverEra`; system or counter first.
- D10: `GLO` is UTC hours only; GLONASS's three-hour system time is not implemented; MAR-16's "three
  hours ahead" line is rewritten.
- D11: TAI − IRNSST = 19 s is derived, and its JSDoc says so.
- D12: RINEX navigation weeks get `rinexWeekToUtc` / `utcToRinexWeek`, so a RINEX week cannot reach
  a broadcast counter by type.
- D13: `timescale/` and `gnss/`; no `space/` or `maritime/` in this story; the Space realm's
  namespace name is decided when the SPA stories start.
- Industry layers are separated from namespaces (owner decision); dox-architect owns the change.

### 9.4 Not reached (from R§13; marked, not asserted)

- How IERS will word Bulletin C and `leap-seconds.list` once continuous UTC takes effect. It does not
  matter to the built-in table: the canary compares rows only.
- The French official texts of the two CGPM resolutions (the English pages were used).
