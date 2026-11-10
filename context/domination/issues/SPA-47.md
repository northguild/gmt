# SPA-47 — Space: TT and TCG scale conversion

**Scope:** Terrestrial Time and Geocentric Coordinate Time — the two scales that are a constant offset or a constant rate from TAI and need no Julian Date to compute.

## Gap

Spacecraft navigation and orbital mechanics use TT as the independent variable of Earth-based ephemerides. TT is a constant offset from TAI. TCG, the coordinate time of the geocentric reference system, differs from TT by a constant rate fixed by IAU resolution. Both are exactly defined, and both are prerequisites for the Julian Date story.

The first draft bundled TT with TDB in one story. TDB needs the two-part Julian Date (SPA-49) for its periodic correction, while SPA-49 needs `toTT` to express a JD in a scale other than UTC — a mutual dependency the tracker flagged as unbuildable. This story keeps only the scales that need no Julian Date, and TDB and TCB are not part of the epic: SPA-49 depends on this story alone.

## Scope

Paths are under `packages/gmt/src/timescale/`.

- `timescale/convert/toTT.ts, fromTT.ts`:
  - `toTT(isoString: string): string` — ISO UTC to a TT scale string.
  - `fromTT(ttString: string): string` — TT to ISO UTC.
- `timescale/convert/toTCG.ts, fromTCG.ts` and `timescale/calculate/tcgMinusTt.ts`:
  - `toTCG(isoString: string): string` — ISO UTC to a TCG scale string.
  - `fromTCG(tcgString: string): string` — TCG to ISO UTC.
  - `tcgMinusTt(isoString: string): number | null` — The accumulated rate difference in seconds, exposed so callers see the magnitude.

## Key constants

- **TT = TAI + 32.184 seconds** — "TAI is a realization of TT, apart from a constant offset: TT = TAI + 32.184 s" (IERS Conventions 2010).
- **TT differs from TCG by a constant rate**: "dTT/dTCG = 1 − L_G, where L_G = 6.969 290 134 × 10⁻¹⁰" is a defining constant (IAU 2000 Resolution B1.9, which fixes only the rate). The IERS Conventions give the working formula, eq. (10.1): **TCG − TT = (L_G / (1 − L_G)) × (JD_TT − T₀) × 86400 s**, with **T₀ = 2443144.5003725**, the TT Julian date of 1977 January 1, 0h TAI, where TT and TCG coincide. The difference grows by about 22 ms per year.

([IAU 2000 Resolution B1.9, via SYRTE](https://syrte.obspm.fr/IAU_resolutions/Resol-UAI.htm), [IERS Conventions (2010), IERS TN 36, Chapter 10, eq. (10.1)](https://iers-conventions.obspm.fr/content/chapter10/tn36_c10.pdf))

## String format

```text
'2026-01-01T00:00:00 TT'
'2026-01-01T00:00:00 TCG'
```

## Tool

**Terrestrial Time Stack** (`/tools/terrestrial-time-stack/`): one bar of TAI − UTC (steps), TT − TAI (constant) and TCG − TT (drifts), a drift lane across 1972–9999, and the instant on UTC, TAI, TT and TCG. Calls `toTT`, `fromTT`, `toTCG`, `fromTCG`, `tcgMinusTt`, `taiMinusUtc`, `toTAI`, `fromTAI`. It is a separate tool, not a row in the Satellite Clock Converter: that tool's ladder tops out at TAI, so TT would sit above its top rail, and it shows TCG at one instant, where the drift reads as another rung.

## Design notes

- **No Julian Date is needed here.** Eq. (10.1) is linear in elapsed TT from a fixed epoch; `(JD_TT − T₀) × 86400` is simply TT seconds since 1977-01-01T00:00:32.184 TT, and that is computed from nanoseconds since the epoch (CORE-1), which is exact, not from a JD, which is not. That is what lets SPA-49 depend on this story without a cycle. The `1 / (1 − L_G)` factor is kept, not dropped: the IERS note that it "may be approximated" away is a 10⁻¹⁸ rate statement, and an exact formula costs nothing.
- **`tcgMinusTt` is exported deliberately:** a caller at millisecond precision needs to know a ~1 second-per-50-years drift is being applied; hiding it inside the conversion makes the difference between "TT" and "TCG" look like a label.
- TT is the geocentric scale for Earth ephemerides; barycentric work needs TDB, which this epic does not provide. Note the distinction rather than assuming callers know it.
- Pre-1972 input inherits SPA-46's sentinel: no integer TAI − UTC exists before then.

## Corrections

The first draft's `tdbMinusTt`, `toTDB` and `fromTDB` moved to SPA-74 together with the TDB − TT series, and this story took TCG in exchange. Nothing about their definitions changed; only the dependency graph did.

## What gmt provides (do not re-implement)

- `toTAI` / `fromTAI` from MAR-16 — TT is a constant offset from TAI. The public functions are not called (a public function never calls another); their internal hinge (`parseUtcReading`, `taiOfUtc`, `utcOfTai`, `formatUtcReading`, `LEAP_SECOND_STEPS`) is.
- `floorDivide` from CORE-3 — the floor toward −∞ in both directions.

## Verification

- `toTT('2026-01-01T00:00:00Z')` returns `'2026-01-01T00:01:09.184 TT'` — TAI + 32.184 s exactly
- TT minus TAI is exactly 32.184 seconds for every test date
- Round-trip for TT returns an equivalent UTC string
- `tcgMinusTt` at the 1977-01-01T00:00:32.184 TT epoch is `0` to nanosecond precision
- `tcgMinusTt` grows linearly: its value at 2027-01-01 minus its value at 2026-01-01 equals `L_G × 365 × 86400` seconds to within 1 ns
- `tcgMinusTt('2000-01-01T12:00:00Z')` is about `0.5057` seconds, asserted against the IAU constant, not a hardcoded number
- Round-trip for TCG returns an equivalent UTC string to nanosecond precision
- A date before 1972-01-01 returns the sentinel
- `pnpm run validate` stays green

## Decisions

Settled by the owner. They are the current rules for this code.

- The five functions live in `timescale/`, one file each: `convert/toTT.ts`, `fromTT.ts`, `toTCG.ts`, `fromTCG.ts` and `calculate/tcgMinusTt.ts`. They are general scales, not Space-only, and SPA-49 and SPA-52 take their `timescale/` paths from this.
- `tcgMinusTt` returns `number | null` (the sentinel for a number), as `taiMinusUtc` does. It is a UTC instant in, and the value is exactly the floored nanosecond offset `toTCG` applies, in seconds, so `toTCG(x) − toTT(x) === tcgMinusTt(x)`.
- Inputs, outputs, sentinels and bounds match `toTAI` and `fromTAI`: any instant `parseUtcReading` reads, full-nanosecond shortest-digit output, `""` before 1972-01-01 UTC, past year 9999 and on invalid input. TT and TCG have no second 60. `TT` is the only spelling read, not FITS's deprecated `TDT` or `ET`.
- Rounding floors toward −∞ in bigint, in both directions. TCG − TT is `d × 6969290134 / (10¹⁹ − 6969290134)` nanoseconds, `d` being TT nanoseconds since the epoch. `fromTCG` uses the closed-form inverse `TT = TCG − floor(D × 6969290134 / 10¹⁹)` with no iteration, so `fromTCG(toTCG(x)) === x` for every nanosecond. The unreachable TCG nanosecond (about one in 1.4 × 10⁹) reads as the next one's UTC instant, and that is accepted.
- Sources: TT = TAI + 32.184 s is IERS TN 36 §10.1. Resolution B1.9 states only dTT/dTCG = 1 − L_G and the value of L_G, with no epoch and no closed form. The epoch T₀ and eq. (10.1) come from TN 36 §10.1. The floor to the nanosecond, and the closed-form inverse that follows from it, are GMT's own rule.
- No Julian Date is computed: `(JD_TT − T₀) × 86400` is TT nanoseconds since the TT label `1977-01-01T00:00:32.184`, which is why SPA-49 can depend on this story. The `1 / (1 − L_G)` factor is kept. The verification values are `toTT('2026-01-01T00:00:00Z')` = `…T00:01:09.184 TT`, `tcgMinusTt('2000-01-01T12:00:00Z')` = 0.50583333 s, and the TCG/TT epoch as a UTC input = `1976-12-31T23:59:45Z`.
- Time-scale strings: the scoped exception in `coding-standards.md` lists `fromTT`, `fromTCG` and the `TT` and `TCG` tokens. `toTAI` and `fromTAI` changed only in an `@returns` line and a dead `|| label.secondSixty` check removed from `fromTAI`; behaviour is the same.
- The root bundle budget in `scripts/bundle-size.budgets.json` rose from 569400 to 570400 B (+1000 B). The measured size is 570338 B, which leaves 62 B. This is a reviewed raise for the new exports, with SPA-46 as precedent.
- The Dox tool is the Terrestrial Time Stack at `/tools/terrestrial-time-stack/` (chat tool `showTerrestrialTimeStack`, permalink kind `ttstack`); its rules are in `context/dox/built.md`. "Ephemeris Time" is not used as a name, because it names ET, TT's deprecated predecessor, which `fromTT` refuses.
- Dox deviations from the spec: (a) the `readout-still` entry is `drawn: ["drawn", "hold"]`, not `["drawn"]`, because `hold` exempts only a hold's live wrapper (four other entries do the same); (b) the plates fall to one column below a 20rem container, as well as to 2 × 2 below 36rem, so a value and its unit never wrap; (c) the shared `widgets/builders/plates.ts` gained two optional fields, `words` (a value given in words at the quiet size) and `unbroken` (a value and its unit on one line), both opt-in, and `html-diff` showed the other 43 widget pages' markup unchanged; (d) the drift lane's y-labels sit in their own rows above and below the field.
