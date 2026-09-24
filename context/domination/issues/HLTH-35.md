# HLTH-35 — Healthcare: Partial-date semantics

**Scope:** Comparing, ordering and range-testing dates of differing precision.

## Gap

Clinical data is full of imprecise dates — a birth year with no month, a diagnosis month with no day, a historical event recorded as a decade. HLTH-34 can validate and preserve them, but validation does not answer the question every consumer actually has: **is this partial date before that one?**

The answer requires treating a partial date as a range. `2022` means 2022-01-01 through 2022-12-31. Two partial dates may be unambiguously ordered, or may overlap such that no ordering exists — and a comparison function returning a boolean cannot express the second case.

FHIRPath, the expression language FHIR itself uses, already defines the answer: "the comparison is performed by considering each precision in order, beginning with years"; "if the values are different, the comparison stops and the result is false"; "If one input has a value for the precision and the other does not, the comparison stops and the result is empty ({ })". So `@2012-01 = @2012` is `{ }` (a printed example), and `@2012-01 = @2012-02` is `false`, decided at the month (derived from the rule; the nearest printed example is `@2012 = @2013 // false`). CQL's `same as` and `same or before` carry the identical walk, returning `null` where FHIRPath returns empty. This story is that semantics for ISO strings.

([FHIRPath N1 (v2.0.0) §6.1.1 Equals and §6.2 Comparison; current release v3.0.0 carries the same wording](https://hl7.org/fhirpath/N1/), [CQL v2.0.0 Appendix B, Same As / Same Or Before](https://cql.hl7.org/09-b-cqlreference.html), [HL7 VRCL partial date](https://build.fhir.org/ig/HL7/vr-common-library//StructureDefinition-Extension-partial-date-vr.html))

## Scope

- `packages/gmt/src/health/convert/partialDateRange.ts`:
  - `partialDateRange(value: string, precision: FhirPrecision): { start: string, end: string } | null` — Expands a partial date to the half-open plain-date range it denotes. Endpoints are plain dates, not instants.
- `packages/gmt/src/health/compare/comparePartialDates.ts`:
  - `comparePartialDates(a: string, b: string): -1 | 0 | 1 | 'indeterminate' | null` — Three-valued comparison. `'indeterminate'` when all shared components are equal and the precisions differ — FHIRPath's empty result.
  - `partialDatesEqual(a: string, b: string): boolean | 'indeterminate'`
  - `partialDateContains(outer: string, inner: string): boolean`
- `packages/gmt/src/health/calculate/sortPartialDates.ts`:
  - `sortPartialDates(values: string[], options?: { tieBreak?: 'earliest' | 'latest' }): string[]` — A total order for display. `tieBreak` is required to make it deterministic and its effect is documented.

## Design notes

- **`'indeterminate'` is the point of this story.** Comparing `2022` with `2022-06-15` has no correct boolean answer: June 2022 lies inside the range 2022 denotes. Returning `false`, or coercing both to midnight on the first of the year, produces a confidently wrong clinical answer. Consumers must handle the third case explicitly. The result maps one-to-one onto FHIRPath's `{ }` so a FHIRPath engine built on GMT agrees with the reference implementations.
- **Decide at the first differing component, not by overlap.** `2022-01` versus `2022-06` is `-1` even though both are inside `2022`; the ranges do not overlap, and FHIRPath decides at the month. Only equal-so-far-then-more-precise yields `'indeterminate'`.
- **Sorting and comparison are separate functions** because they answer different questions. A UI list needs a total order even where the comparison is indeterminate; a clinical rule must not silently get one. `sortPartialDates` therefore takes an explicit tie-break and documents that its order is for presentation, not inference.
- **Plain dates, never instants.** Partial dates carry no timezone; these are calendar comparisons, and routing them through instant conversion introduces the off-by-one HLTH-36 documents. CORE-6's `Interval` is instant-only and rejects plain dates, so this story does **not** use it and does **not** widen it. The existing `plain/` interval-by-date functions (`intervalsOverlapDate`, `intervalIntersectionDate`, `intervalContainsDate`) already apply the half-open rule to plain dates and are the primitives here. Decision of record for the open question the previous draft left.
- Ranges are half-open, consistent with the rest of the library. `2022` is `[2022-01-01, 2023-01-01)`.

## What gmt provides (do not re-implement)

- `getFHIRPrecision` from HLTH-34 — precision detection
- `intervalsOverlapDate` / `intervalIntersectionDate` / `intervalContainsDate` from `plain/` — half-open plain-date range comparison
- `isValidDate` — endpoint validation

## Verification

- `partialDateRange('2022', 'year')` returns `{ start: '2022-01-01', end: '2023-01-01' }`
- `comparePartialDates('2021', '2023')` returns `-1`
- `comparePartialDates('2022', '2022-06-15')` returns `'indeterminate'`
- `comparePartialDates('2022-01', '2022-06')` returns `-1` — decided at the month, the same rule that makes FHIRPath's `@2012 = @2013` false
- `comparePartialDates('2022-01', '2022')` returns `'indeterminate'`, matching FHIRPath's `@2012-01 = @2012 → { }`
- `partialDateContains('2022', '2022-06-15')` returns `true`
- `partialDatesEqual('2022', '2022')` returns `true`; `partialDatesEqual('2022', '2022-06')` returns `'indeterminate'`
- `sortPartialDates` is deterministic and stable under both tie-break settings
- A leap-year February range ends correctly
- Passing an instant string (with offset) returns the sentinel — these are calendar values
- `pnpm run validate` stays green
