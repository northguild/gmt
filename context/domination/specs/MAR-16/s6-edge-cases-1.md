## 6. Edge-case test matrix

**Conventions.** `it.each` template tables, one category per table. Internal tests of
`leapSeconds.ts` use a synthetic `negativeStepSteps`: `LEAP_SECOND_STEPS` plus a row at
2030-01-01T00:00:00Z with 36 s (a deleted second; built in the test with
`Temporal.Instant.from(…).epochNanoseconds`). Every value below came from the reference run.

### 6.1 `LEAP_SECOND_STEPS` invariants (`leapSeconds.test.ts`)

- 28 rows; `at[0]` = `Temporal.Instant.from("1972-01-01T00:00:00Z").epochNanoseconds`, offset 10;
  last row 2017-01-01, offset 37 (SPA-48: "The table's final entry matches TAI − UTC = 37").
- Each bigint equals the epoch ns of the date in its comment.
- Each `at` is 00:00:00 UTC on a month's first day (TF.460-6 §2.1–2.2).
- `at` strictly increasing; every step exactly +1 s (the closed table has no deleted second).
- 27 rows after the first = 27 leap seconds.

Internal queries on `negativeStepSteps`: `taiOfUtc` of `2029-12-31T23:59:58Z` → TAI
`2030-01-01T00:00:35`; of `2029-12-31T23:59:59Z` and `…59.5Z` → `null`; of `2030-01-01T00:00:00Z` →
`2030-01-01T00:00:36`; `utcOfTai` of TAI `2030-01-01T00:00:35.5` → `2029-12-31T23:59:58.5Z`, of
`…00:00:36` → `2030-01-01T00:00:00Z`; a second-60 on 2029-12-31 → `null`; `nextStepIndex` from
2024-01-01 → that row (written `2029-12-31T23:59:59Z` by `nextLeapSecond`'s formatting rule).

### 6.2 `taiMinusUtc`

| isoString | Expected |
| --- | --- |
| `"2024-01-01T00:00:00Z"` | `37` |
| `"2016-01-01T00:00:00Z"` | `36` |
| `"2016-12-31T23:59:60Z"` | `36` |
| `"2017-01-01T00:00:00Z"` | `37` |
| `"2013-06-01T00:00:00Z"` | `35` |
| `"1972-01-01T00:00:00Z"` | `10` |
| `"1980-01-06T00:00:00Z"` | `19` |
| `"1999-08-22T00:00:00Z"` | `32` |
| `"2006-01-01T00:00:00Z"` | `33` |
| `"2027-06-28T00:00:00Z"` | `37` |
| `"2100-01-01T00:00:00Z"` | `37` (closed table) |
| `"1971-12-31T23:59:59.999999999Z"`, `"1971-01-01T00:00:00Z"` | `null` |
| `"2017-12-31T23:59:60Z"` | `null` |

Plus §6.11. **Battle matrix:** for each `c` of `sameInstantBattleCases`, `taiMinusUtc(c.value) === 37`.

### 6.3 `leapSecondsBetween`

| start | end | Expected |
| --- | --- | --- |
| `"2020-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `0` |
| `"2000-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `5` (2005, 2008, 2012, 2015, 2016) |
| `"1972-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `27` |
| `"1980-01-06T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `18` |
| `"2024-01-01T00:00:00Z"` | `"2000-01-01T00:00:00Z"` | `-5` |
| `"2016-12-31T23:59:60Z"` | `"2017-01-01T00:00:00Z"` | `1` |
| `"2016-12-31T23:59:59Z"` | `"2016-12-31T23:59:60Z"` | `0` |
| `"2016-12-31T23:59:60.5Z"` | `"2017-01-01T00:00:00Z"` | `0` (the inserted second started at 23:59:60.000, before `start`; TF.460-6 Annex 1 §2.2) |
| `"1971-01-01T00:00:00Z"` | `"2024-01-01T00:00:00Z"` | `null` |

### 6.4 `nextLeapSecond`

| isoString | Expected |
| --- | --- |
| `"2016-01-01T00:00:00Z"` | `"2016-12-31T23:59:60Z"` |
| `"2016-12-31T23:59:59.5Z"` | `"2016-12-31T23:59:60Z"` |
| `"2016-12-31T23:59:60Z"` | `""` |
| `"2015-06-30T23:59:60Z"` | `"2016-12-31T23:59:60Z"` |
| `"1972-01-01T00:00:00Z"` | `"1972-06-30T23:59:60Z"` |
| `"1999-08-22T00:00:00Z"` | `"2005-12-31T23:59:60Z"` |
| `"2024-01-01T00:00:00Z"` | `""` (SPA-48: none scheduled) |
| `"2027-05-20T00:00:00Z"` | `""` |
| `"1971-06-01T00:00:00Z"` | `""` |

**Property:** for each of the 27 insertion days derived from `LEAP_SECOND_STEPS`,
`nextLeapSecond(<day>T00:00:00Z)` is `<day>T23:59:60Z` and `isLeapSecond` of it is `true`.

### 6.5 `isLeapSecond`, `hasSecond60`

| isoString | `isLeapSecond` |
| --- | --- |
| `"2016-12-31T23:59:60Z"`, `"1972-06-30T23:59:60Z"`, `"2008-12-31T23:59:60.999999999Z"` | `true` |
| `"2009-01-01T08:59:60+09:00"`, `"2016-12-31T18:59:60-05:00[America/New_York]"` | `true` |
| `"2017-12-31T23:59:60Z"` (SPA-48), `"2016-06-30T23:59:60Z"`, `"2016-12-31T12:34:60Z"`, `"1971-12-31T23:59:60Z"` | `false` |
| `"2016-12-31T23:59:59Z"` (SPA-48) | `false` |
| `"20161231T235960Z"`, `"2016-12-31t23:59:60Z"`, `"2016-12-31 23:59:60Z"`, `"2016-12-31T23:59:60"`, `"2016-12-31T23:59:61Z"` | `false` |

**All listed:** for each of the 27 days, `<day>T23:59:60Z` → `true`, `<day>T23:59:59Z` → `false`.
`hasSecond60`: the existing rows, renamed, unchanged.

### 6.6 `toTAI` / `fromTAI`

| Call | Expected |
| --- | --- |
| `toTAI("2026-01-01T00:00:00Z")` | `"2026-01-01T00:00:37 TAI"` (SPA-46) |
| `toTAI("2013-06-01T00:00:00Z")` | `"2013-06-01T00:00:35 TAI"` (SPA-46: 35, not 37) |
| `toTAI("1972-01-01T00:00:00Z")` | `"1972-01-01T00:00:10 TAI"` |
| `toTAI("2016-12-31T23:59:59Z")` | `"2017-01-01T00:00:35 TAI"` |
| `toTAI("2016-12-31T23:59:60Z")` | `"2017-01-01T00:00:36 TAI"` |
| `toTAI("2016-12-31T23:59:60.5Z")` | `"2017-01-01T00:00:36.5 TAI"` |
| `toTAI("2016-12-31T23:59:60.123456789Z")` | `"2017-01-01T00:00:36.123456789 TAI"` |
| `toTAI("2016-12-31T23:59:60.999999999Z")` | `"2017-01-01T00:00:36.999999999 TAI"` |
| `toTAI("2017-01-01T08:59:60+09:00")` | `"2017-01-01T00:00:36 TAI"` |
| `toTAI("2016-12-31T18:59:60-05:00[America/New_York]")` | `"2017-01-01T00:00:36 TAI"` |
| `toTAI("2017-01-01T00:00:00Z")` | `"2017-01-01T00:00:37 TAI"` |
| `toTAI("2015-06-30T23:59:60Z")` | `"2015-07-01T00:00:35 TAI"` |
| `toTAI("1972-06-30T23:59:60Z")` | `"1972-07-01T00:00:10 TAI"` |
| `toTAI("2100-01-01T00:00:00Z")` | `"2100-01-01T00:00:37 TAI"` |
| `toTAI("9999-12-31T23:59:22.999999999Z")` | `"9999-12-31T23:59:59.999999999 TAI"` |
| `toTAI("9999-12-31T23:59:23Z")` | `""` (year 10000) |
| `toTAI("2017-12-31T23:59:60Z")`, `toTAI("2016-12-31T12:34:60Z")`, `toTAI("1971-12-31T23:59:60Z")` | `""` |
| `fromTAI("2026-01-01T00:00:37 TAI")` | `"2026-01-01T00:00:00Z"` |
| `fromTAI("2017-01-01T00:00:35 TAI")` | `"2016-12-31T23:59:59Z"` |
| `fromTAI("2017-01-01T00:00:36 TAI")` | `"2016-12-31T23:59:60Z"` |
| `fromTAI("2017-01-01T00:00:36.5 TAI")` | `"2016-12-31T23:59:60.5Z"` |
| `fromTAI("2017-01-01T00:00:36.123456789 TAI")` | `"2016-12-31T23:59:60.123456789Z"` |
| `fromTAI("2017-01-01T00:00:37 TAI")` | `"2017-01-01T00:00:00Z"` |
| `fromTAI("1972-01-01T00:00:10 TAI")` | `"1972-01-01T00:00:00Z"` |
| `fromTAI("1972-01-01T00:00:09.999999999 TAI")` | `""` (SPA-46: pre-1972) |
| `fromTAI("2027-06-28T00:00:37 TAI")` | `"2027-06-28T00:00:00Z"` |
| `fromTAI("9999-12-31T23:59:59.999999999 TAI")` | `"9999-12-31T23:59:22.999999999Z"` |
| `fromTAI("2016-12-31T23:59:60 TAI")` | `""` |

**Battle matrix:** for each `c`, `toTAI(c.value) === "2024-02-29T00:00:37 TAI"`.

### 6.7 Scale-string grammar

Run against `fromTAI`, `gnssToUtc("GPS", …)` and `gnssToUtc("GAL", …)`, each with its own token. All `""`:
`"2026-01-01t00:00:37 TAI"`; `"2026-01-01 00:00:37 TAI"`; `"2026-01-01T00:00 TAI"`;
`"2026-01-01T00:00:37,5 TAI"`; `"2026-01-01T00:00:37.1234567890 TAI"`; `"2026-01-01T00:00:37. TAI"`;
`"2026-01-01T00:00:37  TAI"`; `"2026-01-01T00:00:37TAI"`; `" 2026-01-01T00:00:37 TAI"`;
`"2026-01-01T00:00:37 TAI "`; `"2026-01-01T00:00:37 tai"`; `"2026-01-01T00:00:37Z TAI"`;
`"2026-01-01T00:00:37+00:00 TAI"`; `"+002026-01-01T00:00:37 TAI"`; `"2026-02-30T00:00:37 TAI"`;
`"2026-01-01T24:00:00 TAI"`; `"2026-01-01T00:60:00 TAI"`; `"2026-01-01T00:00:61 TAI"`;
`"2026-01-01T00:00:37 UTC"`; `"2026-01-01T00:00:37 GST"`; `"2026-01-01T00:00:37 QZSST"`;
`"2026-01-01T00:00:37 GLONASST"`; `123`; `null`.

Accepted: `fromTAI("2026-01-01T00:00:37.5 TAI")` → `"2026-01-01T00:00:00.5Z"`;
`"…00:00:37.000000001 TAI"` → `"2026-01-01T00:00:00.000000001Z"`; `"…00:00:37.100 TAI"` →
`"2026-01-01T00:00:00.1Z"`.
