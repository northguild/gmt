## 2. Validation order and sentinels

Every public function validates before any work and wraps its body in
`try { … } catch { return <sentinel>; }`.

| Function | Order | Sentinel |
| --- | --- | --- |
| `taiMinusUtc(isoString)` | `parseUtcReading`; `taiOfUtc` non-null | `null` |
| `leapSecondsBetween(start, end)` | reading `start`; reading `end`; both `taiOfUtc` non-null | `null` |
| `nextLeapSecond(isoString)` | reading; `taiOfUtc` non-null | `""` |
| `isLeapSecond(isoString)` | reading; `secondSixty`; `taiOfUtc` non-null | `false` |
| `toTAI(isoString)` | reading; `taiOfUtc` | `""` |
| `fromTAI(taiString)` | `parseTimeScaleString(…, "TAI")`; not `secondSixty`; `utcOfTai` | `""` |
| `utcToGnss(system, utcString)` | `isGnssSystem`; reading; `scaleLabelOfUtc` | `""` |
| `gnssToUtc(system, value)` | `isGnssSystem`; `parseTimeScaleString(…, system)`; `utcOfScaleLabel` | `""` |
| `gnssWeekToUtc(counter, week, tow, rolloverEra)` | `isGnssWeekCounter`; `week` safe integer in `[0, modulus)`; `timeOfWeekNanoseconds`; `resolveRolloverEra`; label; `utcOfScaleLabel` | `""` |
| `utcToGnssWeek(counter, utcString)` | `isGnssWeekCounter`; reading; `scaleLabelOfUtc`; `weekOfLabel` | `null` |
| `rinexWeekToUtc(system, week, tow)` | `isRinexWeekSystem`; `week` safe integer ≥ 0; `timeOfWeekNanoseconds`; label; `utcOfScaleLabel` | `""` |
| `utcToRinexWeek(system, utcString)` | `isRinexWeekSystem`; reading; `scaleLabelOfUtc`; `d ≥ 0` | `null` |
| `hasSecond60(value)` | unchanged | `false` |

**Invalid** covers: a non-string or malformed date; a zoneless or date-only string (SPA-48's
`'2020-01-01Z'` is not an instant; its verification uses full instants, §8.1); a second-60 string
the table does not list; a date before 1972-01-01 or before the system's epoch; a scale string with
the wrong token, a second 60 on a continuous scale, a year past 9999, or any other grammar break; an
unknown system, counter or message; a week, time of week or era out of range.

**Collisions.** `nextLeapSecond`'s `""` also means "none after this instant", the answer for every
date from 2016-12-31T23:59:60Z on. `isLeapSecond`'s `false` is also the answer for an ordinary
second. Each JSDoc says so.

**Fresh objects.** `utcToGnssWeek` returns a new literal on every call (`toEqual` plus one
`not.toBe` row).

---

## 3. Algorithms (bigint nanoseconds throughout)

Notation: `A[i]` = `steps.at[i]`, `O[i]` = `steps.taiMinusUtc[i]` × 10⁹, `S` = 10⁹ ns, `n` = rows.

### 3.1 `taiOfUtc(steps, reading)`

1. `u = reading.epochNanoseconds`. If `u < A[0]` → `null`. No upper bound.
2. **Second 60.** Find `j ≥ 1` with `A[j] − S ≤ u < A[j]` and `O[j] − O[j−1] === +S`. None →
   `null`. Return `u + O[j−1] + S`.
3. **Ordinary.** `i` = last index with `A[i] ≤ u`. If `i + 1 < n`, `O[i+1] − O[i] === −S` and
   `u ≥ A[i+1] − S` → `null` (inside a deleted second). Return `u + O[i]`.

### 3.2 `utcOfTai(steps, tai)`

1. If `tai < A[0] + O[0]` → `null` (before 1972-01-01T00:00:10 TAI).
2. `i` = last index with `A[i] + O[i] ≤ tai`.
3. `u = tai − O[i]`. If `i + 1 < n` and `u ≥ A[i+1]` (only before a positive step) →
   `{ epochNanoseconds: tai − O[i] − S, secondSixty: true }`; else `{ epochNanoseconds: u,
   secondSixty: false }`.

A negative step needs no special case here (verified with a synthetic −1 row at 2030-01-01: TAI
`2030-01-01T00:00:35.5` → `2029-12-31T23:59:58.5Z`, `…00:00:36` → `2030-01-01T00:00:00Z`).

### 3.3 `nextStepIndex(steps, reading)`

`u = reading.secondSixty ? reading.epochNanoseconds + S : reading.epochNanoseconds`. Return the
first `j ≥ 1` with `A[j] > u`, or −1.

### 3.4 Timescale functions (all pass `LEAP_SECOND_STEPS`)

- `taiMinusUtc`: `Number((t − u) / S) − (secondSixty ? 1 : 0)` with `t = taiOfUtc(...)`. During an
  inserted second this is the old value (36 at `2016-12-31T23:59:60Z`).
- `leapSecondsBetween`: `started(end) − started(start)`, where `started(x)` is the number of leap
  seconds that started before `x`. That is `taiMinusUtc(x)`, plus 1 when `x` is inside an inserted
  second past its start. An inserted second starts at `…T23:59:60.000Z` (ITU-R TF.460-6 Annex 1
  §2.2), so it counts when that start falls in `[start, end)`. The result is a signed count:
  `23:59:60 → 00:00:00` is 1; `23:59:59 → 23:59:60` is 0; `23:59:60.5 → 00:00:00` is 0, because that
  second started at 23:59:60.000, before `start`. A deleted second counts −1 when its omitted
  23:59:59.000 falls in `[start, end)`.
  - It is **not** `taiMinusUtc(end) − taiMinusUtc(start)`. TAI − UTC steps at the following
    00:00:00, so that difference counts an insertion whose second started before `start`
    (`23:59:60.5 → 00:00:00` would give 1) and breaks the half-open rule. Over whole days the two
    agree.
- `nextLeapSecond`: `j = nextStepIndex`; −1 → `""`. Else the UTC date of `A[j] − S`, as `…T23:59:60Z`
  for a positive step (`formatUtcReading` with `secondSixty: true`) and `…T23:59:59Z` for a deleted
  second (`Instant#toString`).
- `isLeapSecond`: `reading.secondSixty && taiOfUtc(...) !== null`.
- `toTAI`: `formatTimeScaleString({ labelNanoseconds: taiOfUtc(...), secondSixty: false }, "TAI")`.
- `fromTAI`: label (not second-60) → `utcOfTai` → `formatUtcReading`.

### 3.5 `scaleLabelOfUtc(system, reading)` / `utcOfScaleLabel(system, label)`

- **TAI-based** (`taiMinusScale !== null`): to the scale, `t = taiOfUtc`; `label = t −
  taiMinusScale × S`; `label < epochLabel` → null; `secondSixty: false`. From the scale:
  `label.secondSixty` → null; `label < epochLabel` → null; `utcOfTai(label + taiMinusScale × S)`.
- **`GLO`**: to the scale, `taiOfUtc(...) === null` → null (validates a `:60` and the lower bound);
  the label is the reading itself, `secondSixty` kept. From the scale, the reading is the label
  itself; `taiOfUtc(reading) === null` → null.

### 3.6 GNSS string functions

`utcToGnss` = `formatTimeScaleString(scaleLabelOfUtc(...), system)`.
`gnssToUtc` = `formatUtcReading(utcOfScaleLabel(system, parseTimeScaleString(value, system)))`.

### 3.7 Why the same arithmetic gives every story constant

GPS − UTC is never stored: 2024 is `37 − 19 = 18`; the GPS epoch `19 − 19 = 0`; 2016 `36 − 19 = 17`.
BDT − UTC in 2024 is `37 − 33 = 4`; GAL − UTC at 1999-08-22 is `32 − 19 = 13`. Each is BIPM's
`(19-xx)` / `(33-xx)` with xx read from the table.

### 3.8 Week arithmetic

- `timeOfWeekNanoseconds(tow)`: finite number, `0 ≤ tow < 604800`, else null. `ns =
  BigInt(Math.round(tow * 1e9))`; `ns >= NANOSECONDS_PER_WEEK` → null (verified:
  `Math.round(604799.9999999999 * 1e9) === 604800000000000`).
- `labelOfWeek = epochLabel + (era × modulus + week) × WEEK + towNs`.
- `weekOfLabel`: `d = label − epochLabel`; `d < 0` → null; `F = d / WEEK`, `towNs = d % WEEK`;
  `{ week: Number(F % modulus), timeOfWeekSeconds: Number(towNs) / 1e9, era: Number(F / modulus) }`.
- `gnssWeekToUtc`: label from the resolved era → `utcOfScaleLabel` → `formatUtcReading`. A week time
  inside an inserted second returns `…T23:59:60Z`.
- `utcToGnssWeek`: reading → `scaleLabelOfUtc` → `weekOfLabel`.

### 3.9 `resolveRolloverEra(counter, week, rolloverEra)`

- A number: `Number.isSafeInteger(rolloverEra) && rolloverEra >= 0` → `BigInt(rolloverEra)`; else
  null.
- `"rolling"` (exact): inside the caller's `try`, read `Temporal.Now.instant()` **once**; place it
  with `scaleLabelOfUtc`; `Fnow = (label − epochLabel) / WEEK`; `M = modulus`;
  `era = max(floor((Fnow − week + M/2) / M), 0)`. Floor explicitly: the numerator can be negative.
- `{ notBefore }` (`isObject`, read `notBefore` **once**; other keys ignored, as CORE-6 reads
  records):
  1. `notBefore` must be a string that `parseUtcReading` accepts and `taiOfUtc` places (a listed
     `:60` is accepted); otherwise null.
  2. `Lp = scaleLabelOfUtc(system, reading).labelNanoseconds`. If `Lp < epochLabel` (the pivot is
     before the counter's epoch) → null.
  3. `period = M × WEEK` (1024, 4096 or 8192 weeks, by counter); `base = epochLabel + week × WEEK +
     towNs`.
  4. `era = Lp ≤ base ? 0 : ceil((Lp − base) / period)` (bigint ceiling). The result label is
     `base + era × period`: the earliest occurrence of that week and time of week whose label is
     `≥ Lp`. **Equal counts**: a decoded instant exactly at `notBefore` is returned.
  5. The result then goes through `utcOfScaleLabel` and `formatUtcReading` like any other era; a
     label outside Temporal's instant range throws inside the `try` and returns `""`.
  Labels are compared, not UTC instants: every scale with a week counter is continuous, so label
  order is instant order, and an inserted leap second keeps its place.
- Anything else → null (including `null`, an array with no `notBefore`, and a non-string
  `notBefore`).

The decoded full week satisfies `Fnow − M/2 < F ≤ Fnow + M/2` under `"rolling"`, unless clamped at
era 0; under a pivot it satisfies `Lp ≤ L < Lp + period`.

### 3.10 RINEX weeks

- `rinexWeekToUtc(system, week, tow)`: `label = RINEX_WEEK_EPOCHS[system].epochLabel + week × WEEK +
  towNs`; then `utcOfScaleLabel(RINEX_WEEK_EPOCHS[system].system, …)` → `formatUtcReading`.
- `utcToRinexWeek(system, utc)`: `scaleLabelOfUtc` → `d = label − epochLabel`; `d < 0` → null;
  `{ week: Number(d / WEEK), timeOfWeekSeconds: Number(d % WEEK) / 1e9 }`.

---
