## Decisions this spec makes

### D1. The leap-second table is closed and built in

**Owner decision**, under the reference-data rule as now amended (tracker DoD; overview "Bundled
reference data"): "a table its standards body has closed … ships on the default path as an
internal constant, with its source and final revision cited beside it". The IERS leap-second
table is closed:

- CGPM 2026 Resolution 5 "decides that continuous UTC will become effective on 20 May 2027" (R§7.3);
- IERS Bulletin C 72 (6 July 2026): "NO leap second will be introduced at the end of December
  2026" and "Leap seconds can be introduced in UTC at the end of the months of December or June"
  (R§6.2). The next date IERS names, the end of June 2027, falls after continuous UTC begins.

So:

- The 28 rows are a module-level constant in `packages/gmt/src/internal/leapSeconds.ts`, with the
  source and final revision in its comment. **No function takes a table argument.**
- **After the last row, TAI − UTC is 37 s indefinitely.** No function has an upper date bound of
  its own; the limits are Temporal's instant range and, for scale strings, the four-digit year.
- **No `…/data` subpath.** Nothing in this story is opt-in data.
- A weekly IERS canary (§5.8) runs until IERS publishes its file format for continuous UTC, and is
  retired then (**owner decision**, §9.1). ITU-R TF.460-6 §2.1 still allows a month end other than
  June or December with eight weeks' notice (§2.3), so until 20 May 2027 the canary is what would
  catch a Bulletin C 73 announcing, say, an end-of-March 2027 insertion.

### D2. SPA-48's table functions: what survives the no-catch-all rule

Decided by the rule "a call the types accept must return a value", read strictly: no function
whose typed calls can only return one value.

| SPA-48 function | Decision | Reason |
| --- | --- | --- |
| `taiMinusUtc(isoString)` | **Keep** | Varies with the date (10 … 37, `null` before 1972) |
| `leapSecondsBetween(start, end)` | **Keep** | Varies with both dates |
| `isLeapSecond(isoString)` | **Keep** | `true` on 27 seconds, `false` elsewhere |
| `nextLeapSecond(isoString)` | **Keep** | 27 different answers for dates up to 2016-12-31T23:59:59Z, `""` after |
| `leapSecondTable()` | **Drop** | No argument and a constant result: one value for every call. The rows are reachable through the kept functions (`nextLeapSecond` walks every insertion; `taiMinusUtc` reads every value), and the guide prints them with their source |
| `tableProvenance()` | **Drop** | Same reason, and with no caller-supplied table there is no second table whose provenance could differ. Source and revision are cited in the constant's comment, the JSDoc and the guide |
| `isTableStale(at)` | **Drop** | Can never return `true`: the table is closed, so no date is beyond it |
| `isValidLeapSecondTable(table)` | **Drop** | No caller-supplied tables |

The SPA-48 issue edits record each drop (§8.1).

### D3. `isLeapSecond`: the table lookup takes the name; the syntax check becomes `hasSecond60`

`plain/validate/isLeapSecond(value)` exists, root-exported, and only tests that a seconds field
reads `60`. A second root `isLeapSecond` breaks `export *` (TS2308) and `build-reference.ts`.
**Resolution (breaking, `minor` with a Breaking changes section):** rename the syntax check to
`hasSecond60` (same location, behaviour and tests); `timescale/validate/isLeapSecond(isoString)` is the
table lookup.

- ITU-R TF.460-6 Annex 1 §2.1–2.2 defines a leap second as "the last second of a UTC month" that
  "begins at 23h 59m 60s". `isLeapSecond("2024-06-15T12:34:60Z") // true` is false by that
  definition. SPA-48: "`isLeapSecond` is a table lookup, not a pattern match."
- `hasSecond60` names what the old function tests: RFC 3339 §5.6's `time-second` holding 60.
- The old one-argument call keeps compiling but changes meaning: `isLeapSecond("2024-06-15T12:34:60Z")`
  was `true` and is now `false`. The changeset says so in its Breaking changes section.
- Owner policy allows the break: no 2.0.0, no shim, no deprecation (coding-standards § Changesets).

### D4. A `:60` input is accepted only for a listed insertion

TF.460-6 Annex 3 dates events inside a leap second as "30 June, 23h 59m 60.6s UTC". Every
UTC-reading function here:

- accepts `…T23:59:60[.f]Z` (and any offset spelling of the same instant,
  `2017-01-01T08:59:60+09:00`) **only when** the table lists an insertion at the next 00:00 UTC, and
  maps it to the inserted TAI second: `2016-12-31T23:59:60Z` → `2017-01-01T00:00:36 TAI`;
- returns the sentinel for any other second-60 string;
- writes `…T23:59:60[.f]Z` when a TAI, GPS, GAL, BDT, QZS or IRN label falls inside an inserted
  second: `fromTAI("2017-01-01T00:00:36.5 TAI") // "2016-12-31T23:59:60.5Z"`.

Continuous scales (TAI, GPS, GAL, BDT, QZS, IRN) have no second 60. `GLO`
inserts leap seconds with UTC ("it introduces the same leap seconds as UTC", RINEX 4.02 §4.1.2), so
`…T23:59:60 GLO` is valid exactly when UTC's label is.

Nothing else widens: `parseInstantNanoseconds`, `toNanoseconds`, `spanNs` and every other GMT
function still reject `:60`. A `:60` string these functions write is readable only by this story's
functions; the JSDoc says so.

### D5. Scale strings: one fixed grammar, FITS and RINEX tokens, a new scoped exception

A time-scale string is an ISO 8601 extended local date-time, one space, and a token naming the
scale: `'2026-01-01T00:00:37 TAI'`. It is not SPICE syntax: `str2et_c` accepts only "TDB, TDT, UTC"
(and `TT`) as labels (R§9.1). The tokens come from the standards that define them (R§9.2–9.4):

| Scale | Token | Authority |
| --- | --- | --- |
| TAI | `TAI` | FITS 4.0 §9.2.1 Table 30, p. 38 (IAU FITS Working Group) |
| GPS time | `GPS` | RINEX 4.02 / 3.05 §5.2.8 ("GPS to identify GPS time"); FITS 4.0 Table 30 |
| Galileo time | `GAL` | RINEX §5.2.8 ("GAL to identify Galileo time") |
| BeiDou time | `BDT` | RINEX §5.2.8 ("BDT to identify BDS time") |
| QZSS time | `QZS` | RINEX §5.2.8 ("QZS to identify QZSS time") |
| GLONASS time | `GLO` | RINEX §5.2.8 ("GLO to identify the GLONASS UTC time") |
| NavIC time | `IRN` | RINEX §5.2.8 ("IRN to identify NavIC time") |

The "date-time, space, token" arrangement is a **GMT rule**; no standard joins the two. The token is
the same string as the `GnssSystem` member, so `gnssToUtc("GAL", "2024-01-01T00:00:18 GAL")`.

### D6. `GnssSystem` is the six RINEX identifiers; week functions take a named counter

`GnssSystem = "GPS" | "GAL" | "BDT" | "QZS" | "GLO" | "IRN"`: the complete RINEX 4.02 §5.2.8 list.
MAR-16's `'BDS'` names the constellation, not a time token, and becomes `'BDT'`.

"Peer" means **IMO-recognised component of the World-Wide Radionavigation System (WWRNS)**. Resolution
A.1046(27) (2011; annex revised by MSC.599(111), 2026, which states that the WWRNS includes regional
systems) sets the policy and names no system; each system is recognised by its own instrument: GPS and
GLONASS by A.860(20) (1997), BeiDou by SN.1/Circ.329 (2014), Galileo by SN.1/Circ.334 (2016), IRNSS
(NavIC) by SN.1/Circ.340 (2020) and QZSS by SN.1/Circ.341 (2021). The one primary IMO page that names
all six is the MSC 104 meeting summary (2021). Recognition scope differs: GPS's recognition is for
"waters other than harbour entrances and approaches and restricted waters", BeiDou's and IRNSS's
are for ocean waters, and IRNSS's is regional ("ocean waters within the area covered by 55°E
longitude, 50°N latitude, 110°E longitude and 5°S latitude"). GMT converts each system's time
everywhere; the scope is a navigation-use fact the JSDoc states, not a limit GMT applies. Receiver
equipment is standardised per system in the IEC 61108 series — parts for GPS, GLONASS, Galileo, BDS
and NavIC; no QZSS part was found — so IEC 61108 is cited per system, never as the authority for the
six. Receiver output uses IEC 61162-1:2024 (Edition 6.0) sentences. (Research §9a; the SN.1 circular
texts are licensed mirrors, and SN.1/Circ.341's body was not reached.)

**No system-specific functions (owner decision).** Every system goes through the same functions:
`utcToGnss` / `gnssToUtc` for scale strings, `gnssWeekToUtc` / `utcToGnssWeek` for broadcast weeks,
`rinexWeekToUtc` / `utcToRinexWeek` for RINEX weeks. No system has a function or type of its own:
a national system never gets its own named function (tracker, "International authority first").

GPS and QZSS each broadcast two week counters: LNAV "a modulo 1024 binary representation", CNAV "a
modulo-8192 binary representation" (IS-GPS-200N §20.3.3.3.1.1, §30.3.3.1.1.1; IS-QZSS-PNT-006
§4.1.2.3(1), §4.2.2). A week number means nothing without its counter's width, and guessing is a
catch-all. So the week functions take the counter by name, a union in which each member has exactly
one modulus:

```ts
type GnssWeekCounter =
  | "GPS-LNAV" | "GPS-CNAV" | "GAL" | "BDT" | "QZS-LNAV" | "QZS-CNAV" | "IRN-LNAV" | "IRN-L1NV";
```

NavIC also has two: the L5/S message's week "is coded on 10 bits … which covers 1024 weeks" (ISRO
IRNSS ICD SPS 1.1 §5.7), the L1 message's "on 13 bits … which covers 8192 weeks" (NavIC ICD SPS L1
1.0 §5.6) (R§5a.2). The member names are the RINEX 4.02 navigation-message names: `LNAV` and `CNAV`
for GPS and QZSS, `LNAV` (Table A30) and `L1NV` (Table A31) for NavIC. Joining them to the system
token with `-` is a **GMT rule**. Galileo (12 bits, "covers 4096 weeks", Issue 2.2 Table 69) and
BeiDou (13 bits, "0 through 8191", B1I 3.0 §5.2.4.4) each have one counter. **GLONASS has no week
counter, so `GLO` is not a member**: a typed call could only return the sentinel. An untyped `'GLO'`
still returns it (MAR-16's verification line, tested with `// @ts-expect-error`).

Each counter's time of week is taken in **seconds of week**, 0 up to 604 800. Where a message
broadcasts it coarser — NavIC L5/S in 12 s counts 1–50400, NavIC L1 as a two-hour index plus an
18 s count (R§5a.2) — the caller converts to seconds first; the JSDoc says so.
