# Reviewer reference: standards, precedence, realms, oracles

Read by `gmt-reviewer` for the layer the checklist does not cover.

## The standards, and what each governs

| Standard                               | What it is                                                             | Where it binds in GMT                                                      |
| -------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **ECMA-262**                           | The JavaScript language                                                                                                                          | Number range (`MAX_SAFE_INTEGER`), `bigint` in `precision/` †                                                                               |
| **ECMA-402**                           | The `Intl` API — locale-aware formatting and locale data                                                                                         | Every locale-aware function; the 17-locale matrix †                                                                                        |
| **TC39 Temporal**                      | The date/time API replacing `Date`. The **specification** at `tc39.es/proposal-temporal/` is the authority; its `/docs/` pages and MDN are commentary and rank below it | Every type and every piece of arithmetic                                                                                                    |
| **Intl Era and Month Code** (proposal) | Era codes, month codes, proleptic dates for non-Gregorian calendars                                                                              | Japanese eras, Buddhist year, dates far in the past                                                                                        |
| **Intl Locale Info** (proposal)        | A locale's week data                                                                                                                             | First day of week, weekend days                                                                                                            |
| **ISO 8601**                           | The international date/time string standard                                                                                                      | The string contract — in and out, everywhere                                                                                               |
| **RFC 3339**                           | IETF internet profile of ISO 8601; stricter subset with an offset                                                                                | `formatRfc3339`                                                                                                                            |
| **RFC 9557**                           | Extends RFC 3339 with bracketed annotations (`[Europe/Paris]`, `u-ca`) and the critical flag `[!…]`                                               | How zoned values carry their zone; which annotations a parser must reject                                                                  |
| **RFC 5545 §3.6.1 / SQL:2011**         | iCalendar's `DTEND` is exclusive; SQL application-time `PERIOD` is closed-open                                                                    | Half-open `[start, end)` everywhere in `interval/` †                                                                                       |
| **IANA tzdb**                          | Every zone's offsets and DST history                                                                                                             | Zone identifiers; GMT never hardcodes an offset                                                                                            |
| **BCP 47**                             | IETF language tags (`en-US`, `ar-SA`) and `-u-` extension keys                                                                                   | Every locale argument                                                                                                                      |
| **Unicode CLDR**                       | Month names, date formats, week rules per locale                                                                                                 | Reaches GMT through the runtime's `Intl` data                                                                                              |
| **UTS #35 (LDML)**                     | The Unicode date-format pattern grammar                                                                                                          | `parse*WithPattern`'s tokens are a Luxon-derived subset (`internal/patternToken.ts`); a new token is justified from UTS #35, never Luxon †  |
| **IEEE 754**                           | Binary floating point; integers exact only to 2^53                                                                                               | Why `precision/` and `span/` return `bigint` past `MAX_SAFE_INTEGER` †                                                                      |
| **RFC 5322**                           | Internet Message Format; the email `Date:` header (replaced RFC 2822)                                                                            | `formatRfc2822`, `parseRfc2822`                                                                                                            |
| **RFC 9110**                           | HTTP Semantics; HTTP-date (replaced RFC 7231)                                                                                                    | `formatHttpDate`, `parseHttpDate`                                                                                                                  |
| **test262**                            | TC39's official conformance suite for JS and `Intl`                                                                                              | Where edge-case expected values come from — never another library's output. Files live under `test/built-ins/Temporal/` and `test/intl402/Temporal/`; cite the path in a finding |

Source of record: [standards.mdx](../../apps/dox/src/content/docs/guides/concepts/standards.mdx).
**If that page changes, this table follows.** Rows and cells marked † are not on
that page; they are this file's own, and changing one is not a docs-site edit.

## When sources disagree

Specifications, test suites and real engines occasionally disagree. Settle each question with
the most authoritative source available, in this order:

1. The **Temporal** specification.
2. **ECMA-402** and the **Intl** proposals.
3. **RFC 9557**, **RFC 3339** and **ISO 8601**.
4. **CLDR**.
5. **test262**.
6. Real engines, such as Chromium's built-in Temporal — used only to corroborate.

Record which rung decided a question.

**Where test262 sits.** A test262 file is the committee's own test of rungs 1 and 2, so it
outranks any engine — but it is written by people, it lags the spec, and it is occasionally
wrong, which is why it sits at 5 and never above the spec text. When a GMT result disagrees
with an engine and test262 sides with GMT, that is a documented engine divergence, not a defect;
`TAGGED_MISMATCHES` in `scripts/temporal-compat.mjs` is where such a disagreement is recorded,
with the test262 file named. An untagged mismatch is a GMT bug.

## The realms and their domain standards

Ten realms plus Core, 53 build-order stories
([tracker.md](../domination/tracker.md)). Each encodes a different body of convention,
and the conventions are the thing most likely to be quietly wrong.

| Realm                   | Standards and conventions it encodes                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core / Precision**    | TC39 Temporal, RFC 9557/3339/ISO 8601, half-open intervals (EWD831, SQL:2011 `PERIOD`, RFC 5545 §3.6.1), ISO week and ordinal dates, NRF 4-5-4, EU Reg 1182/71 Art 3(2)(c), NTP/FILETIME/.NET ticks/Excel serial/Postgres epochs |
| **Transport** (`TRAN`)  | Transit, dwell and ETA in zone-local time; the DCSA cut-off taxonomy                                                                                                                                                             |
| **Intermodal** (`INT`)  | Demurrage vs detention, ISF 10+2, AMS 24-Hour Rule, EU ENS/ICS2, UN/EDIFACT DTM format codes (data element 2379), X12 elements 373/337/623 and 1250/1251, GS1 EPCIS 2.0, DCSA Track & Trace                                                                                    |
| **Maritime** (`MAR`)    | GPS↔UTC and week rollover, AIS `secondOfUTC`, ITU-R M.585 MMSI, ship's time and the date line, charter-party laytime (laycan, NOR, SHEX/SHINC/WWD)                                                                               |
| **Road** (`ROAD`)       | FMCSA 49 CFR Part 395; EU Regulation (EC) No 561/2006                                                                                                                                                                            |
| **Rail** (`RAI`)        | GTFS service days and times beyond 24:00:00, `calendar_dates.txt`, the December timetable year, UIC 406                                                                                                                          |
| **Aviation** (`AV`)     | IATA scheduling seasons and SSIM, ICAO NOTAM items B)/C), METAR/TAF, FAA 14 CFR Part 117 and EASA ORO.FTL.205                                                                                                                    |
| **IoT** (`IOT`)         | IEEE 1588 PTP / 802.1AS, the NTP four-timestamp exchange, monotonic readings, watermarks                                                                                                                                         |
| **Healthcare** (`HLTH`) | HL7 v2.x DTM, FHIR R4 precision and `Timing.repeat`, DICOM PS3.5 §6.2, gestational and neonatal age, HIPAA Safe Harbor                                                                                                           |
| **Finance** (`FIN`)     | ISDA/FINCAD day counts (`30/360 US`, `30/360 ISDA`, `30E/360`, `30E+/360`, `ACT/360`, `ACT/365F`, `ACT/ACT ISDA`), roll conventions, settlement cycles (T+1 US equities, T+2 FX spot), tenors, IMM dates                         |
| **Space** (`SPA`)       | TAI/GPS/TT/TDB/UT1, IERS Bulletins A and C, leap seconds and smearing, Julian Date/MJD/J2000, CCSDS 301.0-B-4, TLE epochs, SCLK↔SCET, Mars MSD/AMT/LMST                                                                          |

**Legacy library awareness:** Luxon, date-fns, Moment.js, dayjs — useful for discovering an
edge case nobody considered, and as evidence of what other libraries chose. **Never as
authority.** A rule is justified by a specification or a standard, never by "Luxon does this".
Where the ecosystem agrees with Temporal, say so as corroboration and name the rung that
actually decided it.

## Oracles you may use

An oracle is something that cannot share a bug with the code under review. Every finding names
the one that reproduced it.

- **The spec text and test262** — the answer itself, not a check on it.
- **`pnpm compat:oracle`** — runs a scan in Chromium's native Temporal and the twin scan through
  GMT's public functions from `dist`, and writes `artifacts/temporal-oracle-<date>.{json,txt}`.
  Needs Playwright (`pnpm --filter @gmt/dox exec playwright install chromium`). Exit 1 is a GMT
  bug. Run it for any change under `internal/temporalCompat/`, `internal/zonedWallClock*`, or a
  non-ISO calendar path. Never wired into `validate` or `ci.yml`, so nobody else will run it.
- **`pnpm compat`** — which polyfill workarounds the installed runtime still needs, with the
  Node, ICU and polyfill versions it measured. A group whose probes all pass prints `REMOVABLE`
  unless it declares a guard, which prints `GUARD` until its package moves past the guarded version.
- **A plain `@js-temporal/polyfill` computation** (`node -e`) — a check, never the answer. Read
  its defect list before trusting a value near a range limit or in a non-ISO calendar.
- **The runtime's own `Intl` data**, read the way `src/test/runtimeWeekInfo.ts` reads it —
  deliberately without importing GMT, so a bug in GMT cannot make the check agree with itself.
- **Dershowitz & Reingold, _Calendrical Calculations_** — the Hebrew and Indian arithmetic GMT
  owns by owner decision Q4.

**Never an oracle:** GMT itself; another GMT function (`floorToZone` and `bucketRange` run on
the same `internal/zonedBucket.ts` as the code you are reviewing); a reference implementation
written for this story; Node's `--harmony-temporal` build, which is wrong on several range-edge cases; and memory.
