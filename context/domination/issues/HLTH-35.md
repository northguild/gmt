# HLTH-35 — Healthcare: Partial-date semantics

**Scope:** Comparing, ordering and range-testing dates of differing precision.

## Gap

Clinical data is full of imprecise dates — a birth year with no month, a diagnosis month with no day, a historical event recorded as a decade. HLTH-34 can validate and preserve them, but validation does not answer the question every consumer actually has: **is this partial date before that one?**

The answer requires treating a partial date as a range. `2022` means 2022-01-01 through 2022-12-31. Two partial dates may be unambiguously ordered, or may overlap such that no ordering exists — and a comparison function returning a boolean cannot express the second case.

([HL7 VRCL partial date](https://build.fhir.org/ig/HL7/vr-common-library//StructureDefinition-Extension-partial-date-vr.html))

## Scope

- `packages/gmt/src/health/convert/partialDateRange.ts`:
  - `partialDateRange(value: string, precision: FhirPrecision): Interval | null` — Expands a partial date to the interval it denotes.
- `packages/gmt/src/health/compare/comparePartialDates.ts`:
  - `comparePartialDates(a: string, b: string): -1 | 0 | 1 | 'indeterminate' | null` — Three-valued comparison. `'indeterminate'` when the ranges overlap and no ordering can be asserted.
  - `partialDatesEqual(a: string, b: string): boolean | 'indeterminate'`
  - `partialDateContains(outer: string, inner: string): boolean`
- `packages/gmt/src/health/calculate/sortPartialDates.ts`:
  - `sortPartialDates(values: string[], options?: { tieBreak?: 'earliest' | 'latest' }): string[]` — A total order for display. `tieBreak` is required to make it deterministic and its effect is documented.

## Design notes

- **`'indeterminate'` is the point of this story.** Comparing `2022` with `2022-06-15` has no correct boolean answer: June 2022 lies inside the range 2022 denotes. Returning `false`, or coercing both to midnight on the first of the year, produces a confidently wrong clinical answer. Consumers must handle the third case explicitly.
- **Sorting and comparison are separate functions** because they answer different questions. A UI list needs a total order even where the comparison is indeterminate; a clinical rule must not silently get one. `sortPartialDates` therefore takes an explicit tie-break and documents that its order is for presentation, not inference.
- Ranges are half-open, consistent with CORE-6. `2022` is `[2022-01-01, 2023-01-01)`.
- Partial dates carry no timezone. These are calendar comparisons and must not be routed through instant conversion — see HLTH-36 for why normalising offsets at this precision introduces errors.

## What gmt provides (do not re-implement)

- `getFHIRPrecision` from HLTH-34 — precision detection
- `intervalsOverlap` / `intervalContains` / `intersectIntervals` from CORE-6 — range comparison
- `Interval` from `types/`

## Verification

- `partialDateRange('2022', 'year')` returns `[2022-01-01, 2023-01-01)`
- `comparePartialDates('2021', '2023')` returns `-1`
- `comparePartialDates('2022', '2022-06-15')` returns `'indeterminate'`
- `comparePartialDates('2022-01', '2022-06')` returns `-1`
- `partialDateContains('2022', '2022-06-15')` returns `true`
- `partialDatesEqual('2022', '2022')` returns `true`; `partialDatesEqual('2022', '2022-06')` returns `'indeterminate'`
- `sortPartialDates` is deterministic and stable under both tie-break settings
- A leap-year February range ends correctly
- `pnpm run validate` stays green
