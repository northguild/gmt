## 1. Files and signatures (continued)

### 1.3 Internal helpers (new)

All under `packages/gmt/src/internal/`, each with a colocated test, exported from
`internal/index.ts`.

**`leapSeconds.ts`** — the closed table and the queries over it.

```ts
/** TAI − UTC by date: `at[i]` (epoch ns, 00:00:00 UTC on a month's first day) starts `taiMinusUtc[i]`. */
export interface LeapSecondSteps {
  readonly at: readonly bigint[];
  readonly taiMinusUtc: readonly bigint[]; // seconds
}

/**
 * IERS Earth Orientation Center, Leap_Second.dat (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat),
 * updated through IERS Bulletin C 72, 6 July 2026. Closed: CGPM 2026 Resolution 5 makes UTC
 * continuous from 20 May 2027, and Bulletin C 72 rules out the end of December 2026. After the last
 * row TAI − UTC stays 37 s. Checked weekly against IERS by scripts/leap-seconds.mjs.
 */
export const LEAP_SECOND_STEPS: LeapSecondSteps;

export function taiOfUtc(steps: LeapSecondSteps, reading: UtcReading): bigint | null;
export function utcOfTai(steps: LeapSecondSteps, tai: bigint): UtcReading | null;
export function nextStepIndex(steps: LeapSecondSteps, reading: UtcReading): number;
```

The literal, exactly (each bigint produced by `Temporal.Instant.from(<date>).epochNanoseconds`; a
test asserts each one against its comment):

```ts
const ROWS: readonly (readonly [bigint, bigint])[] = [
  [63072000000000000n, 10n], // 1972-01-01T00:00:00Z
  [78796800000000000n, 11n], // 1972-07-01T00:00:00Z
  [94694400000000000n, 12n], // 1973-01-01T00:00:00Z
  [126230400000000000n, 13n], // 1974-01-01T00:00:00Z
  [157766400000000000n, 14n], // 1975-01-01T00:00:00Z
  [189302400000000000n, 15n], // 1976-01-01T00:00:00Z
  [220924800000000000n, 16n], // 1977-01-01T00:00:00Z
  [252460800000000000n, 17n], // 1978-01-01T00:00:00Z
  [283996800000000000n, 18n], // 1979-01-01T00:00:00Z
  [315532800000000000n, 19n], // 1980-01-01T00:00:00Z
  [362793600000000000n, 20n], // 1981-07-01T00:00:00Z
  [394329600000000000n, 21n], // 1982-07-01T00:00:00Z
  [425865600000000000n, 22n], // 1983-07-01T00:00:00Z
  [489024000000000000n, 23n], // 1985-07-01T00:00:00Z
  [567993600000000000n, 24n], // 1988-01-01T00:00:00Z
  [631152000000000000n, 25n], // 1990-01-01T00:00:00Z
  [662688000000000000n, 26n], // 1991-01-01T00:00:00Z
  [709948800000000000n, 27n], // 1992-07-01T00:00:00Z
  [741484800000000000n, 28n], // 1993-07-01T00:00:00Z
  [773020800000000000n, 29n], // 1994-07-01T00:00:00Z
  [820454400000000000n, 30n], // 1996-01-01T00:00:00Z
  [867715200000000000n, 31n], // 1997-07-01T00:00:00Z
  [915148800000000000n, 32n], // 1999-01-01T00:00:00Z
  [1136073600000000000n, 33n], // 2006-01-01T00:00:00Z
  [1230768000000000000n, 34n], // 2009-01-01T00:00:00Z
  [1341100800000000000n, 35n], // 2012-07-01T00:00:00Z
  [1435708800000000000n, 36n], // 2015-07-01T00:00:00Z
  [1483228800000000000n, 37n], // 2017-01-01T00:00:00Z
];
```

No Temporal call runs at module load. The 27 rows after the first are the 27 leap seconds; the
first is where whole-second TAI − UTC begins.

The query helpers take `steps` explicitly, and the public functions pass `LEAP_SECOND_STEPS`. That
keeps the deleted-second branches of §3 testable with a synthetic `steps` in the internal tests
(TF.460-6 allows a negative leap second; the closed table has none). Invariant tests on the
constant (§6.1) make a canary-driven edit that breaks a rule fail loudly.

**`utcReading.ts`** — a UTC label that may be a leap second.

```ts
export interface UtcReading {
  /** For a leap reading, the instant of `…T23:59:59.f` (Temporal's clamp of `…:60.f`). */
  readonly epochNanoseconds: bigint;
  readonly secondSixty: boolean;
}
export function parseUtcReading(value: unknown): UtcReading | null;
export function formatUtcReading(reading: UtcReading): string; // "" if Temporal throws
export function subsecondFraction(nanoseconds: bigint): string;
```

`parseUtcReading` checks shape only; whether a `:60` is real is `taiOfUtc`'s call:

1. Non-string → `null`.
2. `parseInstantNanoseconds(value)` non-null → `{ epochNanoseconds, secondSixty: false }`.
3. Else, `instantLeapSecond.test(value)` (`regex/leap-second.ts`) **and**
   `secondSixtyInstantBody.test(isoStringBody(value))` → inside `try`,
   `Temporal.Instant.from(value).epochNanoseconds` → `{ …, secondSixty: true }`; a throw → `null`.
4. Else `null`.

`secondSixtyInstantBody` is built from existing fragments, never hand-sliced:
`` new RegExp(`^${DATE}T(?:[01]\\d|2[0-3]):[0-5]\\d:60(?:[.,]\\d{1,9})?(?:Z|${EXTENDED_UTC_OFFSET})$`) ``,
with `DATE` the date part of `regex/date.ts`'s `plainDate` source and `EXTENDED_UTC_OFFSET` from
`isoStringBody.ts`. Basic format, lower-case `t`/`z` and a space separator stay refused.

`formatUtcReading`: not second-60 → `Temporal.Instant.fromEpochNanoseconds(ns).toString()`.
Second-60 → `pdt = …toZonedDateTimeISO("UTC").toPlainDateTime()`, then
`` `${pdt.toPlainDate()}T${pdt.toPlainTime().toString({ smallestUnit: "minute" })}:60${subsecondFraction(ns)}Z` ``.

`subsecondFraction(ns)`: `Temporal.PlainTime.from({ hour: 0, millisecond, microsecond,
nanosecond }, { overflow: "reject" }).toString().slice("00:00:00".length)` → `""`, `".5"`,
`".123456789"`. The sub-second count must be split into the three fields: 500 000 000 as
`nanosecond` alone is clamped to 999 by the default `overflow: "constrain"` (verified: it wrote
`.000000999`).

**`timeScaleString.ts`** — the D5 grammar.

```ts
export type TimeScaleToken = "TAI" | GnssSystem;
export const timeScaleString: RegExp =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))? (TAI|GPS|GAL|BDT|QZS|GLO|IRN)$/;
export interface TimeScaleLabel { readonly labelNanoseconds: bigint; readonly secondSixty: boolean }
export function parseTimeScaleString(value: unknown, token: TimeScaleToken): TimeScaleLabel | null;
export function formatTimeScaleString(label: TimeScaleLabel, token: TimeScaleToken): string;
```

A "label nanoseconds" value is a scale's wall clock read as if UTC
(`PlainDateTime#toZonedDateTime("UTC").epochNanoseconds`).

`parseTimeScaleString`:

1. Non-string, or no match → `null`. Group 8 `!== token` → `null`.
2. `second = Number(group 6)`; `second > 60` → `null`; `second === 60 && token !== "GLO"` → `null`.
3. `fraction = group 7 ? Number(group 7) * 10 ** (9 - group7.length) : 0` (exact: < 10⁹).
4. Inside `try`: `Temporal.PlainDateTime.from({ year, month, day, hour, minute, second: second ===
   60 ? 59 : second, millisecond: Math.floor(fraction / 1e6), microsecond: Math.floor(fraction /
   1e3) % 1000, nanosecond: fraction % 1000 }, { overflow: "reject" })`, then
   `.toZonedDateTime("UTC").epochNanoseconds`. A throw → `null`.
5. Return `{ labelNanoseconds, secondSixty: second === 60 }`.

`formatTimeScaleString`: inside `try`, `pdt` as above; year outside 0–9999 → `""`. Not second-60 →
`` `${pdt.toString()} ${token}` `` (verified `2026-01-01T00:00:37`, `2026-01-01T00:00:37.5`).
Second-60 → `` `${pdt.toPlainDate()}T${pdt.toPlainTime().toString({ smallestUnit: "minute" })}:60${subsecondFraction(ns)} ${token}` ``.

**`gnssTimeScales.ts`** — per-system constants and label conversions.

```ts
export interface GnssTimeScale {
  /** TAI minus the scale, in seconds; null for GLO, which is UTC's own wall clock. */
  readonly taiMinusScale: bigint | null;
  /** First defined label, label nanoseconds. */
  readonly epochLabel: bigint;
}
export const GNSS_TIME_SCALES: Readonly<Record<GnssSystem, GnssTimeScale>>;
export function isGnssSystem(value: unknown): value is GnssSystem;
export function scaleLabelOfUtc(system: GnssSystem, reading: UtcReading): TimeScaleLabel | null;
export function utcOfScaleLabel(system: GnssSystem, label: TimeScaleLabel): UtcReading | null;
```

| System | `taiMinusScale` | Epoch label | `epochLabel` |
| --- | --- | --- | --- |
| `GPS` | `19n` | `1980-01-06T00:00:00` | `315964800000000000n` |
| `GAL` | `19n` | `1999-08-22T00:00:00` | `935280000000000000n` |
| `BDT` | `33n` | `2006-01-01T00:00:00` | `1136073600000000000n` |
| `QZS` | `19n` | `1980-01-06T00:00:00` | `315964800000000000n` |
| `GLO` | `null` | `1972-01-01T00:00:00` | `63072000000000000n` |
| `IRN` | `19n` (derived, D11) | `1999-08-22T00:00:00` | `935280000000000000n` |

Each `epochLabel` equals `Temporal.PlainDateTime.from(<label>).toZonedDateTime("UTC").epochNanoseconds`
(a test asserts it). Each literal carries a comment naming its clause (§0).
`NANOSECONDS_PER_SECOND` comes from `foreignEpochs.ts`; add
`NANOSECONDS_PER_WEEK = 604_800_000_000_000n` beside it.

**`gnssWeek.ts`** — counters, week arithmetic, the era.

```ts
export const GNSS_WEEK_COUNTERS: Readonly<Record<GnssWeekCounter, { system: GnssSystem; modulus: bigint }>>;
// GPS-LNAV 1024n, GPS-CNAV 8192n, GAL 4096n, BDT 8192n, QZS-LNAV 1024n, QZS-CNAV 8192n,
// IRN-LNAV 1024n, IRN-L1NV 8192n
export function isGnssWeekCounter(value: unknown): value is GnssWeekCounter;
export function timeOfWeekNanoseconds(timeOfWeekSeconds: unknown): bigint | null;
export function resolveRolloverEra(counter: GnssWeekCounter, week: bigint, rolloverEra: unknown): bigint | null;
export function labelOfWeek(counter: GnssWeekCounter, week: bigint, timeOfWeekNanoseconds: bigint, era: bigint): bigint;
export function weekOfLabel(counter: GnssWeekCounter, labelNanoseconds: bigint): GnssWeek | null;
```

**`rinexWeek.ts`** — RINEX navigation-file weeks (D12).

```ts
/** Epoch label of each RINEX navigation record's continuous week count. */
export const RINEX_WEEK_EPOCHS: Readonly<Record<RinexWeekSystem, { system: GnssSystem; epochLabel: bigint }>>;
// GPS, GAL, QZS, IRN: 315964800000000000n (1980-01-06T00:00:00, the GPS epoch), each in its own scale;
// BDT: 1136073600000000000n (2006-01-01T00:00:00 BDT; RINEX 4.02 §5.4.6, Table A23)
export function isRinexWeekSystem(value: unknown): value is RinexWeekSystem;
```

A RINEX week has no modulus and no era: `label = epochLabel + week × WEEK + towNs` in the named
system's scale, with `week` any safe integer ≥ 0. Converting uses the same `utcOfScaleLabel` /
`scaleLabelOfUtc` as every other scale. (For GAL, QZS and IRN the label is read in that system's
scale; all three share whole seconds with GPS, so the result equals the GPS reading.)

---
