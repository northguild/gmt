## 6. Edge-case test matrix (continued)

### 6.10 Constants against their sources (`gnssTimeScales.test.ts`, `gnssWeek.test.ts`)

Each row names its clause from §0:

- each `epochLabel` equals `Temporal.PlainDateTime.from(<label>).toZonedDateTime("UTC").epochNanoseconds`;
- `taiMinusUtc("1980-01-06T00:00:00Z") === 19` = GPS `taiMinusScale` (BIPM vol. 15 p. 48;
  IS-GPS-200N §3.3.4);
- `taiMinusUtc("1999-08-22T00:00:00Z") - 13 === 19` = GAL `taiMinusScale` (BIPM `utc-gnss`;
  Galileo Issue 2.2 §5.1.2);
- `taiMinusUtc("2006-01-01T00:00:00Z") === 33` = BDT `taiMinusScale` (BIPM `utc-gnss`; B1I 3.0 §3.3);
- QZS `taiMinusScale === 19n` (IS-QZSS-PNT-006 §5.1);
- `GLO` `taiMinusScale === null` and its epoch label is the table's first row (RINEX 4.02 §4.1.2;
  BIPM vol. 15 p. 49; D10);
- `IRN` `taiMinusScale === 19n` and `taiMinusUtc("1999-08-21T23:59:47Z") - 13 === 19` (derived:
  ISRO-IRNSS-ICD-SPS-1.1 §5.7 + IERS; RINEX 4.02 Table 1) — the row name says "derived";
- each counter's modulus (IS-GPS-200N §20.3.3.3.1.1 / §30.3.3.1.1.1, Galileo Issue 2.2 Table 69,
  B1I 3.0 §5.2.4.4, IS-QZSS-PNT-006 §4.1.2.3(1) / §4.2.2, ISRO-IRNSS-ICD-SPS-1.1 §5.7,
  ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6);
- `RINEX_WEEK_EPOCHS` (RINEX 4.02 Tables A9, A13, A19, A30; BDT §5.4.6, Table A23);
- `NANOSECONDS_PER_WEEK === 7n * NANOSECONDS_PER_DAY`.

### 6.11 Shared invalid-input rows

Instant argument: `null`, `undefined`, `123`, `""`, `"x"`, `"2024-01-01"`, `"2024-01-01T00:00:00"`,
`"2024-01-01T00:00:00[UTC]"`, `"20240101T000000Z"`. `system`: `"gps"`, `"BDS"`, `"GLONASS"`,
`"NAVIC"`, `""`, `null`. Collapse value lists into one row per category.

**Error paths:** `mockTemporalInstantFromThrow` (second-60 path), `mockTemporalPlainDateTimeFromThrow`
(scale-string parse), `mockTemporalInstantFromEpochNanosecondsThrow` (formatting): the sentinel for
one representative function per path.

### 6.12 Cross-cutting suites

- `test/noThrow.test.ts` covers the new functions through the corpus; assert `gnss` and `timescale`
  appear in `corpusNamespaces()`.
- No locale matrix: nothing here formats text for a locale.
- The battle-matrix rows are the zone coverage; no function takes a time-zone argument.

---

## 7. TDD slice order

Barrels are created in the slice that adds their first file. Each slice is red → green → refactor.

0. **Rename `isLeapSecond` → `hasSecond60`** in `plain/validate/` with every import of §5.1 item 4.
1. **Leap table.** `internal/leapSeconds.ts` (constant, `taiOfUtc`, `utcOfTai`, `nextStepIndex`);
   `internal/utcReading.ts`. Rows §6.1.
2. **Queries** (`timescale/calculate`, `timescale/validate`). `taiMinusUtc`, `leapSecondsBetween`,
   `nextLeapSecond`, `isLeapSecond`. Rows §6.2–6.5.
3. **`toTAI` / `fromTAI`** (`timescale/convert`). `internal/timeScaleString.ts`;
   `formatUtcReading`'s second-60 branch. Rows §6.6–6.7.
4. **GPS** (`gnss/convert`). `types/gnss.ts`; `internal/gnssTimeScales.ts` (GPS row); `utcToGnss`,
   `gnssToUtc` for `"GPS"`. Rows §6.8 GPS, §6.10 GPS.
5. **GAL / QZS / BDT / IRN.** Their constants, tokens and rows; properties 2–3 of §6.8; the derived
   NavIC offset row of §6.10.
6. **GLO.** Its row, branch and rows; properties 1 and 4 of §6.8 across all six systems.
7. **Week functions.** `internal/gnssWeek.ts`; `gnssWeekToUtc`, `utcToGnssWeek`; `"rolling"`. Rows §6.9.
7a. **Pivot era.** The `{ notBefore }` form of `RolloverEra` in `resolveRolloverEra` (§3.9), the type
    and its JSDoc. The pivot rows and property of §6.9.
8. **RINEX weeks.** `internal/rinexWeek.ts`; `rinexWeekToUtc`, `utcToRinexWeek`. Rows §6.9a. The
   `BDT` row pins RINEX Table A27's example.
9. **Wiring and docs.** §5.1–5.9, §8. Then `pnpm run validate`.
10. **Dox: the decoder tool and the industry-layer tooling change — see the dox-architect spec**
    (§5.5, §5.10), with the tool's `chat-constants.ts` area and pill. One build, last.

---
