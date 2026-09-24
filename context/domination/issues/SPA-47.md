# SPA-47 — Space: TT and TCG scale conversion

**Scope:** Terrestrial Time and Geocentric Coordinate Time — the two scales that are a constant offset or a constant rate from TAI and need no Julian Date to compute.

## Gap

Spacecraft navigation and orbital mechanics use TT as the independent variable of Earth-based ephemerides. TT is a constant offset from TAI. TCG, the coordinate time of the geocentric reference system, differs from TT by a constant rate fixed by IAU resolution. Both are exactly defined, and both are prerequisites for the Julian Date story and for the barycentric scales.

The first draft bundled TT with TDB in one story. TDB needs the two-part Julian Date (SPA-49) for its periodic correction, while SPA-49 needs `toTT` to express a JD in a scale other than UTC — a mutual dependency the tracker flagged as unbuildable. Splitting the JD-free scales here and moving TDB/TCB to SPA-74 resolves it: SPA-49 depends on this story alone.

## Scope

- `packages/gmt/src/space/convert/tt.ts`:
  - `toTT(isoString: string): string` — ISO UTC to a TT scale string.
  - `fromTT(ttString: string): string` — TT to ISO UTC.
- `packages/gmt/src/space/convert/tcg.ts`:
  - `toTCG(isoString: string): string` — ISO UTC to a TCG scale string.
  - `fromTCG(tcgString: string): string` — TCG to ISO UTC.
  - `tcgMinusTt(isoString: string): number` — The accumulated rate difference in seconds, exposed like the TDB correction so callers see the magnitude.

## Key constants

- **TT = TAI + 32.184 seconds** — "TAI is a realization of TT, apart from a constant offset: TT = TAI + 32.184 s" (IERS Conventions 2010).
- **TT differs from TCG by a constant rate**: "dTT/dTCG = 1 − L_G, where L_G = 6.969 290 134 × 10⁻¹⁰" is a defining constant (IAU 2000 Resolution B1.9, which fixes only the rate). The IERS Conventions give the working formula, eq. (10.1): **TCG − TT = (L_G / (1 − L_G)) × (JD_TT − T₀) × 86400 s**, with **T₀ = 2443144.5003725**, the TT Julian date of 1977 January 1, 0h TAI, where TT and TCG coincide. The difference grows by about 22 ms per year.

([IAU 2000 Resolution B1.9, via SYRTE](https://syrte.obspm.fr/IAU_resolutions/Resol-UAI.htm), [IERS Conventions (2010), IERS TN 36, Chapter 10, eq. (10.1)](https://iers-conventions.obspm.fr/content/chapter10/tn36_c10.pdf))

## String format

```text
'2026-01-01T00:00:00 TT'
'2026-01-01T00:00:00 TCG'
```

## Design notes

- **No Julian Date is needed here.** Eq. (10.1) is linear in elapsed TT from a fixed epoch; `(JD_TT − T₀) × 86400` is simply TT seconds since 1977-01-01T00:00:32.184 TT, and that is computed from nanoseconds since the epoch (CORE-1), which is exact, not from a JD, which is not. That is what lets SPA-49 depend on this story without a cycle. The `1 / (1 − L_G)` factor is kept, not dropped: the IERS note that it "may be approximated" away is a 10⁻¹⁸ rate statement, and an exact formula costs nothing.
- **`tcgMinusTt` is exported for the same reason SPA-74 exports `tdbMinusTt`:** a caller at millisecond precision needs to know a ~1 second-per-50-years drift is being applied; hiding it inside the conversion makes the difference between "TT" and "TCG" look like a label.
- TT is the geocentric scale for Earth ephemerides; barycentric work needs TDB (SPA-74). Note the distinction rather than assuming callers know it.
- Pre-1972 input inherits SPA-46's sentinel: no integer TAI − UTC exists before then.

## Corrections

The first draft's `tdbMinusTt`, `toTDB` and `fromTDB` moved to SPA-74 together with the TDB − TT series, and this story took TCG in exchange. Nothing about their definitions changed; only the dependency graph did.

## What gmt provides (do not re-implement)

- `toTAI` / `fromTAI` from SPA-46 — TT is a constant offset from TAI
- `toNanoseconds` / `fromNanoseconds` from CORE-1 — exact elapsed time since the 1977 epoch for the TCG rate

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
