# CORE-105 — Core: One file per workaround in `zonedWallClockDifference.ts`

**Scope:** Split `packages/gmt/src/internal/zonedWallClockDifference.ts` so that each polyfill
workaround it carries lives in its own module under `internal/`, the mirrored TC39 abstract
operations they share live in one module, and the entry points the public functions call keep their
names and signatures. A refactor: it adds no function and changes no output. Raised in review of
#436 (CORE-104); tracked as #437.

## Gap

The file is 77,454 bytes after #436 (67,667 on `main` before it; D22's sentinel added the rest). Its
header lists five workarounds, each with its own trigger, the upstream fix that retires it and its
removal steps:

1. The wall-clock clamp at the range limits (defect 1, `zoned.A`): the `*AtLimit` fallbacks.
2. The UTC fast path without a validity check (defect 2, `zoned.D`): `checkUtcValidity` in
   `runAtRangeLimit`.
3. Non-ISO calendar arithmetic (CORE-6 D1–D7): the `isCalendarArithmeticCompatNeeded` terms and the
   plain context's dispatch.
4. The calendar nudge window that is never retried (D11): `monthTotalBySpec`, `monthRoundBySpec`,
   the defect-4 term in `untilTakesSpecPath`, `plainUntilWithRounding`.
5. An origin in a repeated hour (D22): `originNeedsSpecPath`, `originTotalBySpec`,
   `originRoundBySpec`, the defect-5 term in `untilTakesSpecPath`.

All five share the mirrored abstract operations below the header (`differenceZonedDateTime`,
`nudgeToCalendarUnit`, `nudgeToZonedTime`, `roundRelativeDuration` and the rest). Retiring one
workaround today means editing sections of a long file, and its removal steps (in the header,
`temporalCompat/README.md` and `scripts/lib/workarounds.mjs`) name functions inside it, not a file
to delete.

## Scope

1. **One module per workaround.** Each workaround's trigger and fallback moves to its own file under
   `internal/`, so that retiring it deletes that file and the lines that call it.
2. **One module for the shared operations.** The mirrored TC39 abstract operations, their types and
   constants move to a single module that every workaround imports.
3. **Entry points unchanged.** `zonedUntil`, `durationTotal`, `durationRound`, `durationCompare`,
   `plainDateUntilWithRounding`, `isCalendarDifferenceAcrossZones` and every other export keep their
   names, signatures and behaviour. Their callers (`internal/index.ts`, `plainDateUntil.ts`,
   `lengthFromNow.ts`, `durationUntilString.ts`, `formatRelativeUnix.ts`, `formatRelativeUtc.ts`, the
   compat probes) change at most an import path.
4. **Removal steps point at files.** The header notes, `temporalCompat/README.md` and the removal
   text in `scripts/lib/workarounds.mjs` name the file each workaround lives in.

## Design notes

- **No change in behaviour.** No test's expected value changes; the move is checked by the existing
  suites passing as they stand.
- **D22 stays where CORE-104 left it.** Its logic moves file, not shape; this story does not revisit
  the sentinel decision.
- **Bundle.** The split must not grow what any public function imports (`pnpm size`).

## What gmt provides (do not re-implement)

- CORE-104's D22 sentinel and the four other workarounds, as they stand in
  `internal/zonedWallClockDifference.ts`
- The compat probes and triggers in `internal/temporalCompat/` (`capabilities.ts`, `probeRepros.ts`,
  `index.ts`)
- `scripts/temporal-compat.mjs` and `scripts/lib/workarounds.mjs`

## Decisions

Settled by the owner. They are the current rules for this code.

- The split lives in `internal/zonedDifference/`, with no barrel file. The facade
  `internal/zonedWallClockDifference.ts` imports each module directly and keeps its path and its
  exports, so no caller changed.
- The facade re-exports `plainDateUntilWithRounding` and `plainUntilWithRounding`.
- The `*AtLimit` and `*WithPlainRelativeTo` functions live in `operations.ts`, because defects 1
  and 3-5 all call them.
- `apps/dox/scripts/canary/workaround-paths.test.ts` guards the file paths named in the removal
  steps.
- Only the `steps` in `scripts/lib/workarounds.mjs` changed; titles and triggers did not.
- Three pieces of stale removal text were fixed: D11 named `plainDateUntil.ts`, the
  `diffDateTime.ts` step for `dt1.until(...)` was missing, and zoned.A said "delete every mirrored
  operation".
- No budget in `bundle-size.budgets.json` was edited.
- `untilTakesSpecPath` stays one expression, with a `// defect N` mark on each term.
- Fallow findings on moved code are reported to the owner, never suppressed.
- The facade header keeps the defect numbers 1-5; the canary titles quote them.
- `operations.ts` may run past 1000 lines.
- Dox: none.
- The changeset is empty ("No release."), as for `.changeset/build-with-tsdown.md`.

## Result

- **Bundle.** `root` is 567909 B, up from 567889 B (+20 B), within the 567940 B budget. The plan
  assumed 0 B for the move. The growth comes from esbuild joining adjacent top-level `const`s only
  within a module, and from shifts in mangled-name length. No statement changed; a diff of the
  readable bundle confirmed it. The 11 functions that reach `runAtRangeLimit` grew 12 B each.
  Three shrank: `diffDate` 204781 to 204678, `diffDateTime` 203824 to 203757, `compareDurations`
  202004 to 201980.
- **Defect 2 (`utcValidity.ts`)** uses the zero-byte fallback. It keeps `checkUtcValidity(compute)`,
  and the `if (atRangeLimit && timeZone === "UTC")` guard stays at the call site in
  `runAtRangeLimit`, marked `// defect 2`. The three-argument form measured `root` at 567917 and was
  not used.
- **Line counts.** Facade 372 (was 2297), `operations.ts` 1383, `rangeLimit.ts` 121,
  `utcValidity.ts` 28, `calendarArithmetic.ts` 227, `nudgeWindow.ts` 246, `nudgeOrigin.ts` 166. Of these, only `operations.ts` and `nudgeOrigin.ts` exist today in `internal/zonedDifference/`; CORE-108 deleted the rest with their workarounds.
- **Fallow.** `fallow audit --base main` reports no issues in 23 changed files.
- **Removal text** is kept in three places that must agree: the module headers, the `steps` in
  `scripts/lib/workarounds.mjs`, and the README `## Removal steps`. Review added a sentence that the
  last of defects 3-5 to go also deletes the shared code only they use, and a closing step: drop the
  imports and locals `tsc` reports unused, and the `operations.ts` exports fallow reports unused.

## Verification

- `internal/zonedWallClockDifference.test.ts` and `test/noSpecValue.test.ts` pass unchanged.
- `node scripts/temporal-compat.mjs check` passes.
- `temporalCompat/README.md` points each removal step at its file.
