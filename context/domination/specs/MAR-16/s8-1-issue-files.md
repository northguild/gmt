## 8. Doc slice

### 8.1 Issue files

Edit with the plain-english rules. The research corrections (R§11) are folded in.

**`issues/MAR-16.md`**

- Title and `**Scope:**`: "GNSS time scales — the RINEX world-standard set of six (GPS, Galileo,
  BeiDou, QZSS, GLONASS, NavIC) — and week rollover".
- `## Gap` table: one row per RINEX token, in RINEX's order, with corrected sources:
  - GPS: IS-GPS-200N §3.3.4, §20.3.3.3.1.1, §30.3.3.1.1.1; week "LNAV 10 bits, modulo 1024; CNAV 13
    bits, modulo 8192".
  - GLO: "GLONASS time as RINEX and BIPM report it: UTC hours, with UTC's leap seconds" (RINEX 4.02
    §4.1.2, §5.2.8; BIPM Annual Report vol. 15 p. 49); week "none". No ICD quotation.
  - GAL: Galileo OS SIS ICD Issue 2.2 §5.1.2, Table 69, its sentence as Issue 2.2 prints it.
  - QZS: IS-QZSS-PNT-006 §5.1, §4.1.2.3(1), §4.2.2; week "LNAV 10 bits, modulo 1024; CNAV 13 bits,
    modulo 8192".
  - BDT: BDS-SIS-ICD-B1I-3.0 §3.3 (epoch, "accumulates continuously without leap seconds"),
    §5.2.4.3–5.2.4.4.
  - IRN: epoch 00:00:00 IRNSST 1999-08-22 = 1999-08-21T23:59:47Z, "ahead of UTC by 13 leap
    seconds" (ISRO-IRNSS-ICD-SPS-1.1 §5.7; ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6; RINEX 4.02 §4.1.6); TAI −
    IRNSST 19 s, **derived** (no ICD or BIPM statement); week "L5/S 10 bits, modulo 1024; L1 13 bits,
    modulo 8192"; no leap seconds (derived, R§5a.3). (R§11 correction 13.)
- The paragraph under the table: "TAI − GPS = 19 s, TAI − GST = **+19 s** and TAI − BDT = 33 s are
  stated by BIPM (Annual Report on Time Activities vol. 15, p. 48; `utc-gnss` file header), not by
  the ICDs, none of which mentions TAI except QZSS's. The ICD epochs and the leap-second table give
  the same values as a cross-check." (Fixes the sign error and the "by definition" claim.)
- Sources line: add BIPM Annual Report vol. 15, the `utc-gnss` file, RINEX 4.02, FITS 4.0, and the
  two NavIC ICDs; replace the Galileo, BeiDou and QZSS links with Issue 2.2, B1I 3.0 and PNT-006;
  drop the GLONASS ICD link.
- Framing (top of the file): "GMT supports the RINEX world-standard set of six satellite time
  scales: GPS, Galileo, BeiDou, QZSS, GLONASS and NavIC."
- `## Scope`: the six files under `packages/gmt/src/gnss/convert/` of §1.1 with their signatures (no
  table argument; system or counter first; `GnssSystem` as the six RINEX tokens; `GnssWeekCounter`
  with `IRN-LNAV` and `IRN-L1NV`; required `rolloverEra`; `rinexWeekToUtc` /
  `utcToRinexWeek` for RINEX navigation weeks). Add: "`toTAI` / `fromTAI`
  (`packages/gmt/src/timescale/convert/`) and the time-scale string grammar are built here; the
  TAI64 labels stay in their own story." Replace "the RINEX system letters spelled out" with "the six
  RINEX 4.02 §5.2.8 time-system identifiers". Add a `## String format` section with the D5 token
  table. Add a line: "The code lives in the `gnss/` and `timescale/` building-block namespaces; this
  story creates no `maritime/` namespace (D13)."
- `## Key constants`: "TAI − GPS = +19 seconds (BIPM: '19 s + C0', C0 tens of nanoseconds)"; the
  QZSS CNAV counter; NavIC's constants; rollovers "GPS LNAV at 1999-08-21T23:59:47Z and
  2019-04-06T23:59:42Z UTC; the next at 2038-11-20T23:59:42Z (TAI − UTC stays 37 s: continuous UTC
  from 20 May 2027, CGPM 2026 Resolution 5). Galileo's first 4096-week rollover is
  2078-02-19T23:59:42Z UTC." Replace the BIPM presentation link with the Annual Report and the
  `utc-gnss` file. Add NavIC's rollovers: 10-bit 2019-04-06T23:59:42Z and 2038-11-20T23:59:42Z,
  13-bit 2156-08-21T23:59:42Z.
- `## Design notes`: add D12 (RINEX navigation weeks are continuous from 1980 for GPS, QZSS, NavIC
  and Galileo, so they have their own functions; a RINEX NavIC week read as a NavIC broadcast week is
  1024 weeks off). Replace the GLONASS bullet with D10 ("`GLO` is GLONASS time in UTC hours, as
  RINEX and BIPM report it; GMT does not implement the three-hour system time"); replace "Default to
  the current era…" with D7; add D6 (named counters) and that offsets are nominal; drop "The
  leap-second table from SPA-48 — shared" wording that implies a table argument.
- `## What gmt provides (do not re-implement)` — must not name SPA-46 (a mutual reference would be
  flagged `⚠` by `deps check`):

  ```markdown
  - `parseInstantNanoseconds` / `toNanoseconds` from CORE-1 — instant parsing and precision
  - The leap-second table and its queries from SPA-48 — built in this story, consumed here
  ```

- `## Verification`: drop any table argument; `'BDS'` → `'BDT'`; the GAL scale string ends `GAL`;
  `utcToGnssWeek` takes the counter first (`'GPS-LNAV'`). Rewrite:
  - the era line: "`gnssWeekToUtc('GPS-LNAV', 100, 0, 0)` and era 1 give GPS labels exactly 1024
    weeks apart; `'GAL'` 4096 and `'BDT'` 8192; the UTC strings differ by that many weeks less the
    leap seconds between them";
  - the GLO week line: "`'GLO'` is not a week counter: the types do not accept it, and an untyped
    call returns the sentinel";
  - the line "`utcToGnss('GLO', iso)` is exactly three hours ahead of UTC and carries no leap-second
    offset" becomes "`utcToGnss('GLO', iso)` shows UTC's own wall clock with the token `GLO` (RINEX
    4.02 §4.1.2; BIPM), carries no leap-second offset, and writes a listed leap second as
    `…T23:59:60 GLO`";
  - add NavIC lines: "`utcToGnss('IRN', '1999-08-21T23:59:46Z')` returns the sentinel and
    `'1999-08-21T23:59:47Z'` returns `'1999-08-22T00:00:00 IRN'`"; "`utcToGnss('IRN',
    '2024-01-01T00:00:00Z')` is 18 seconds ahead of UTC (TAI − IRNSST 19 s, derived)";
    "`gnssWeekToUtc('IRN-LNAV', 0, 0, 1)` is `2019-04-06T23:59:42Z`";
  - add the RINEX line: "`rinexWeekToUtc('IRN', 2295, 86418)` is `2024-01-01T00:00:00Z`, and the
    same number through `gnssWeekToUtc('IRN-L1NV', 2295, 86418, 0)` is 1024 weeks later".

**`issues/SPA-48.md`**

- `## Scope`: `packages/gmt/src/timescale/calculate/` `taiMinusUtc(isoString)`,
  `leapSecondsBetween(start, end)`, `nextLeapSecond(isoString): string`;
  `packages/gmt/src/timescale/validate/` `isLeapSecond(isoString)`. The table is an
  internal constant (`internal/leapSeconds.ts`). Record the dropped functions in one bullet each,
  with D2's reason: `leapSecondTable` and `tableProvenance` (zero-argument constants: one value for
  every call; source and revision are cited in code and the guide), `isTableStale` (the table is
  closed, so it could never return `true`).
- `## Leap second facts`:
  - replace "A resolution has been adopted to **discontinue leap seconds by 2035**" with: "CGPM 2022
    Resolution 4 decided that the maximum value of UT1 − UTC 'will be increased in, or before, 2035'.
    CGPM 2026 Resolution 5 decided that 'continuous UTC will become effective on 20 May 2027', with
    a maximum |UT1 − UTC| of 3600 s. The table is therefore closed: TAI − UTC stays 37 s after
    2017-01-01."
  - "Insertions occur preferentially at the end of June or December" → add "(first preference; end
    of March and September are second preference, ITU-R TF.460-6 Annex 1 §2.1)".
  - Cite BIPM Annual Report vol. 15 Table 2 for pre-1972 "rubber seconds".
- `## Design notes`:
  - Replace the `isTableStale` bullet with: "The table is closed and built in (tracker DoD exemption
    for closed tables). A weekly canary compares it with the IERS file until IERS publishes its
    file format for continuous UTC; ITU-R TF.460-6 §2.3 requires at least eight weeks' notice of
    any insertion."
  - Replace "bundled with recorded provenance and a review cadence" with the canary and the cited
    source and revision.
  - Add "The syntax-only check in `plain/validate/` is `hasSecond60`."
- `## What gmt provides`: `parseInstantNanoseconds` / `toNanoseconds` from CORE-1 (drop
  `isValidZonedDateTime`).
- `## Verification`: full instants (`'2020-01-01T00:00:00Z'`, not `'2020-01-01Z'`); `nextLeapSecond`
  returns `""` for a current date; drop the `isTableStale` line; "The table's final entry matches TAI
  − UTC = 37" becomes "`taiMinusUtc('2017-01-01T00:00:00Z')` and `taiMinusUtc('2100-01-01T00:00:00Z')`
  return 37".

**`issues/SPA-46.md`**

- Title `# SPA-46 — Space: TAI64 labels`; `**Scope:**` "The TAI64, TAI64N and TAI64NA label formats
  built on TAI."
- `## Gap`: drop the GPS sentence.
- `## Scope`: remove the `tai.ts` and `gps.ts` bullets; add "`toTAI` / `fromTAI` and the GPS
  conversions (`gnssToUtc` / `utcToGnss` with `"GPS"`) are in MAR-16." The TAI64 functions move to
  `packages/gmt/src/timescale/convert/`, one file each (`toTai64n.ts`, `fromTai64n.ts`,
  `toTai64Bytes.ts`, `fromTai64Bytes.ts`); their signatures are unchanged (no table argument: the
  table is built in).
- `## Key constants`: keep TAI − UTC and the TAI64 line; drop the GPS lines (including "exactly and
  permanently, by definition", which BIPM's "19 s + C0" contradicts); replace the TimeTools link (a
  vendor page) and the BIPM presentation with BIPM Annual Report vol. 15.
- Remove `## String format` (it moves to MAR-16, without "SPICE-style").
- `## Design notes`: drop the GPS-epoch bullet.
- `## Corrections`: remove the `toGPS` paragraph (MAR-16's Corrections records the same sign error).
- `## What gmt provides`:

  ```markdown
  - `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
  - The leap-second table from SPA-48 — TAI − UTC by date
  - `toTAI` / `fromTAI` and the time-scale string grammar from MAR-16 — the TAI hinge the labels are built on
  ```

- `## Verification`: keep only the TAI64 lines; note that TAI − UTC on 1992-06-02 is 26 s (the
  1991-01-01 row), matching Bernstein's example.

**`issues/CORE-1.md` line 93:** `isLeapSecond` → `hasSecond60`.

GitHub issues #197, #229 and #227: the finalizer drafts their text from these edits for the owner's
approval.
