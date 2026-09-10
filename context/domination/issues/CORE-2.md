# CORE-2 — Core: Span durations — `spanMs` + `spanNs`

**Scope:** Millisecond and nanosecond duration between two ISO strings. Universal primitive for profiling, observability, and any span measurement.

## Gap

GMT has `diffZoned` and `diffUnix`, which return Temporal `Duration` objects. Observability and IoT consumers need raw numbers. Three traps the first draft did not address: sign convention, wall-clock versus exact time across a DST transition, and leap seconds.

## Scope

- `packages/gmt/src/span/calculate/spanMs.ts`:
  - `spanMs(start: string, end: string): number` — Millisecond duration between two ISO strings. Negative when `start` is after `end`.
- `packages/gmt/src/span/calculate/spanNs.ts`:
  - `spanNs(start: string, end: string): bigint` — Nanosecond duration. Negative when `start` is after `end`.
- `packages/gmt/src/span/calculate/spanWallClock.ts`:
  - `spanWallClock(start: string, end: string, unit: 'days' | 'hours'): number | null` — Calendar-aware span in the zone carried by the inputs. Distinct from `spanMs`, which is always exact elapsed time.
- Sentinels on invalid input: `0` / `0n` are valid results, so invalid input returns `NaN` / `null` respectively and is documented as such.

## Design notes

- **Exact versus wall clock.** Across a DST transition, "one day later" and "24 hours later" differ by an hour. `spanMs` measures elapsed time; `spanWallClock` measures calendar distance. Both are correct answers to different questions, and conflating them is the most common span bug.
- **Leap seconds.** A span computed from two UTC strings across a leap second is one second short of the physical elapsed time, because UTC repeats a second. Against a smeared clock (Google, AWS, Meta) the error is up to a second, spread across the smear window. Document the limitation; leap-second-exact spans are SPA-48's job.
- **Overflow.** `spanMs` over very large ranges exceeds `Number.MAX_SAFE_INTEGER`. Document the safe range and direct callers past it to `spanNs`.

## What gmt provides (do not re-implement)

- `toNanoseconds` from CORE-1 — `spanNs(a, b)` is `toNanoseconds(b) - toNanoseconds(a)`
- `diffZoned` — the existing `Duration`-returning form, for callers who want calendar units

## Verification

- `spanNs(a, b)` equals `toNanoseconds(b) - toNanoseconds(a)`
- Zero: `spanMs(iso, iso)` returns `0`
- Sign: `spanMs(b, a)` equals `-spanMs(a, b)`
- Across US spring-forward, `spanWallClock(...,'hours')` and `spanMs` disagree by exactly one hour, and both are asserted
- Range exceeding `Number.MAX_SAFE_INTEGER` ms returns `NaN` from `spanMs` and an exact value from `spanNs`
- Invalid input returns `NaN` / `null`
- `pnpm run validate` stays green

## Outcome (delivered)

Shipped as `packages/gmt/src/span/` — `calculate/spanMs.ts`, `calculate/spanNs.ts`,
`calculate/spanWallClock.ts`, plus the namespace barrels, `./span*` package exports and a
`span/README.md` stub. Decisions taken while building it:

- **`spanMs` returns `null`, not the `NaN` the spec asked for — a deliberate deviation.**
  The `## Scope` line says "invalid input returns `NaN` / `null` respectively", but its own
  stated reason is that "`0` / `0n` are valid results". That argues for *not zero*; it does
  not argue for `NaN` over `null`, and `null` is equally distinguishable from `0`. Four
  things decide it the other way:
  `context/coding-standards.md` makes `null` the sentinel for every number-returning
  function in the library, and `diffZoned`, `getHoursInZonedDay`, `durationAs` and
  `intervalCountDate` all honour it; `number | null` is enforced by `strictNullChecks`
  while a `NaN` types as plain `number` and gives a caller no signal the call can fail;
  `spanNs` and `spanWallClock` already return `null`, so `NaN` would have put two
  conventions in one three-function namespace; and it would have been the only `NaN` return
  in 521 functions. The one point for `NaN` — that `sum += spanMs(...)` silently treats a
  failure as a zero-length span under `null`, where `NaN` poisons the total visibly — is
  answered by that line not compiling under `strict` at all. Raised in review on #238 by
  @craig-o-curtis; the spec's sentinel table should be read as "not zero", and a later story
  wanting `NaN` needs an argument the spec does not currently make.
- **`spanMs` is fractional, not truncated.** A sub-millisecond span is reported as a
  fraction (`123.456789`), following `performance.now()` — the platform's own millisecond
  duration type — rather than flooring a 900 µs profile span to `0`. It is computed as
  whole-milliseconds plus a nanosecond remainder rather than `Number(spanNs) / 1e6`,
  because `Number(bigint)` is already lossy past 2^53 ns (~104 days) and would corrupt the
  millisecond part too. Sub-millisecond fidelity still degrades above that; the safe range
  and the escape hatch (`spanNs`) are documented on the function.
- **The overflow guard is on the whole-millisecond part**, per the story's verification:
  the sentinel once `|ms| > Number.MAX_SAFE_INTEGER`. The two instants at the ends of
  `Temporal.Instant`'s range are 1.728 × 10^16 ms apart, so the case is reachable and
  tested, not theoretical.
- **`spanNs` returns `bigint | null`, not `bigint`.** The `## Scope` signature said
  `bigint`, but the sentinel bullet below it requires `null`, and the bullet wins: `0n` is
  the span between an instant and itself. This is also why `spanNs` is *not* literally
  `toNanoseconds(b) - toNanoseconds(a)` — `toNanoseconds` returns `0n` for both the epoch
  and a rejected string, so that subtraction silently reports a zero span for garbage. The
  verification's identity still holds for every valid pair and is asserted.
- **CORE-1's shared instant grammar was extracted, not duplicated.**
  `internal/instantNanoseconds.ts`'s `parseInstantNanoseconds` is now the single definition
  of "an instant string GMT accepts" (full RFC 9557 grammar, minus leap seconds in every
  separator/format variant, minus `[u-ca=...]`), returning `bigint | null` so each caller
  layers its own sentinel. `toNanoseconds` is now one line over it and keeps its `0n`
  contract unchanged.
- **A span is a duration, not an instant.** It reaches
  ±17_280_000_000_000_000_000_000n — twice `MAX_EPOCH_NANOSECONDS` — so CORE-1's
  `isValidEpochNanoseconds` gate deliberately does *not* apply here, exactly as CORE-1's
  outcome anticipated. Documented on `spanNs` so nobody feeds one to `fromNanoseconds`.
- **`spanWallClock` reads the wall clock with `PlainDateTime.from`, never via
  `ZonedDateTime`.** The first cut went `ZonedDateTime.from(...).toPlainDateTime()`, which is
  a local → instant → local round trip, and that round trip is lossy at exactly the DST edges
  this function exists to get right. `isValidZonedDateTime` accepts an offset-less
  `"2024-03-10T02:30:00[America/New_York]"`; 02:30 is inside the US spring-forward gap, so
  Temporal's default `compatible` disambiguation silently advanced it to 03:30 and a
  wall-clock day came back as 23 hours instead of 24 (and 0 days instead of 1). Reading the
  string's own digits removes the conversion entirely, so **no disambiguation policy applies**
  and a nonexistent or ambiguous local time is measured as written — for a clock-face
  question, the digits *are* the answer. Validation still gates on `isValidZonedDateTime`, so
  a mismatched offset, leap second or calendar annotation is still invalid input. Found in
  review; the offset-less form is now covered across the full 20-zone matrix in four DST
  windows.
- **`spanMs`'s safe-range guard is on the exact span, not the truncated millisecond part.**
  Guarding the whole-millisecond quotient let `MAX_SAFE_INTEGER` ms *plus* a fraction through,
  and recombination then rounded it up to 2^53 — an unsafe integer out of a function
  documented to return the sentinel past the safe range. The guard compares nanoseconds against
  `MAX_SAFE_INTEGER × 1_000_000n`, so the returned number is always a safe integer or below.
  Found in review.
- **`spanWallClock` reads each endpoint's own wall clock**, rather than requiring a shared
  zone or re-zoning `end` into `start`'s zone. Same-zone is the DST case the story
  describes and degenerates correctly; cross-zone is the flight-leg question TRAN-8/AV-25
  will ask (New York 23:00 to Berlin 11:00 next local day is 12 wall-clock hours, 7
  elapsed). Both endpoints must carry a bracketed IANA zone — it gates on
  `isValidZonedDateTime`, so an instant string or bare offset is invalid input.
- **`spanWallClock` truncates toward zero and is not a boundary count.** Noon Friday to
  18:00 Saturday is `1` day; 23:00 to 01:00 next calendar day is `0`, not `1`. Counting
  local midnights crossed is a different operation and belongs to CORE-5's
  `floorToZone`/`bucketRange`, not here. Truncation toward zero is also what keeps
  `spanWallClock(b, a, unit)` exactly `-spanWallClock(a, b, unit)`.
- **`WallClockSpanUnit` lives in `spanWallClock.ts`**, alongside the function, following
  CORE-1's `NanosecondTruncationUnit` rather than adding a `types/` file for a two-member
  union. Only the plural `"days"`/`"hours"` spellings are accepted, matching `diffZoned`;
  Temporal's singular `"day"`/`"hour"` are invalid input.
- **Leap seconds are documented, not handled**, per the story. A span across one is a
  second short of physical elapsed time. SPA-48's job.

- **`span/validate/isValidSpan` and `precision/validate/` were added on review.** Both
  namespaces shipped without a `validate/` module, the only two in the library to do so, and
  in `precision/` that was a real defect rather than a missing convention: `0n` is
  simultaneously the epoch and the invalid-input sentinel, and `toNanoseconds`' JSDoc
  pointed callers at `isValidUtc`, which rejects four of the five grammars `toNanoseconds`
  accepts (offsets, bracketed zones, space separators, basic format) — following it
  discarded valid input. `isValidInstant`, `isValidNanoseconds` and `isValidNanoPattern`
  each accept exactly what their partner parses, and `parseNanoseconds` now defers to
  `isValidNanoPattern` so the two cannot drift. `isValidSpan` was requested despite `null`
  never colliding with a valid span; it earns its place as the "will this pair measure?"
  predicate and by documenting that a too-wide span is a limit on the *result*, not the
  inputs. Raised on #238 by @craig-o-curtis.
- **The wider leap-second regex moved to `regex/`.** CORE-1 kept it module-local; it sat
  next to `regex/leap-second.ts`'s narrower `leapSecond` without either knowing about the
  other, which is the duplication that namespace exists to prevent. `regex/` now exports
  both, documented as a pair with a note on which gate each belongs behind.
  Raised on #238 by @craig-o-curtis.

### Known gap, not introduced here

The dox reference generator builds its TypeScript program with `strict: false`
(`apps/dox/scripts/build-reference.ts`), so `strictNullChecks` is off and the checker folds
`| null` out of every return type it renders. `spanNs`'s reference page therefore prints
`spanNs(start: string, end: string): bigint` in its `## Signature` block — as
`getHoursInZonedDay`, `diffZoned` and every other sentinel-returning function in the library
already do. The page's prose and `## Returns` section state the `null` contract correctly, so
this is a signature-line defect, not a wrong page. Flipping the flag fixes the return types
but makes the checker print `| undefined` on every optional parameter and truncate more long
unions; the clean fix is to render signatures via `signatureToSignatureDeclaration` with
`NodeBuilderFlags.NoUndefinedOptionalParameterType` instead of `checker.signatureToString`.
That is a Dox story, not CORE-2, and the change was reverted rather than half-applied.
