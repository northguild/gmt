# Slice 2 — Seam, dependency and types

GMT runs on `temporal-polyfill` 1.0.8 from here on. No workaround is removed in this slice: every
group stays, gated as it is, so a failure here is the swap and nothing else. CORE-92 run
42021143232 showed the suite passes on 1.0.8 with only the D9 row failing, which slice 1 fixed.
Authority row: index § Authority, "The seam imports `/full/implementation`".

## Dependency

- `packages/gmt/package.json`: `dependencies` → `{ "temporal-polyfill": "1.0.8" }` (exact; the
  upgrade check in slice 4 moves it by a reviewed edit). Remove `@js-temporal/polyfill`. `jsbi`
  leaves the tree with it; check nothing else names `jsbi` (`grep -rn jsbi` outside `node_modules`;
  `scripts/lib/native-suite-compat.mjs` and its test
  `apps/dox/scripts/canary/native-suite-compat.test.ts` do, and slice 4 rewrites them).
- `apps/dox/package.json`: remove `@js-temporal/polyfill` (Dox takes `Temporal` from
  `@northguild/gmt`, below).
- `pnpm install`; the lockfile gains `temporal-polyfill`, `temporal-spec`, `temporal-utils`.
- `temporal-polyfill` is ESM only; GMT already is (`"type": "module"`, tsdown `format: "esm"`).
  `tsdown.config.ts` has `deps: { neverBundle: true }`, so no change; check `dist/internal/temporal.js`
  after a worktree build: one `import … from "temporal-polyfill/full/implementation"` line.

## Seam

`packages/gmt/src/internal/temporal.ts`:

```ts
export {
  Intl,
  Temporal,
  toTemporalInstant,
} from "temporal-polyfill/full/implementation";
```

`full/implementation.js` exports `IntlExtended as Intl, Temporal, toTemporalInstant`, so the three
public names stay. Keep the file's header comment, updated to name the new package and to say why
`/full/implementation` (research § 7: `/full` hands back a built-in `Temporal`; the default entry has
only `iso8601` and `gregory`).

`internal/temporal.test.ts`:

- `SPECIFIER` becomes `/["'`]temporal-polyfill(?:\/[^"'`]*)?["'`]/` (any subpath).
- New row: no file in `src` or `bench` names `@js-temporal/polyfill` as a module, seam included.
- New row: the seam's specifier is exactly `temporal-polyfill/full/implementation`.

## Test harness

| File | Change |
| ---- | ------ |
| `src/test/hostModules.d.ts` | Delete the `declare module "temporal-polyfill/full/implementation"` block (CORE-92). It hides the package's own types |
| `vitest.native.config.ts` | Alias `^temporal-polyfill\/full\/implementation$` → `src/test/nativeTemporal.ts` |
| `vitest.browser.config.ts` | Native mode aliases the new specifier. The `temporal-polyfill` mode is retargeted in slice 4; until then it aliases the seam's specifier to `SWAP_ENTRY` (a no-op on the same package) |
| `vitest.swap.config.ts` | Same: alias the new specifier; slice 4 points it at the candidate |
| `src/test/boundedChild.ts` | The child's resolve hook maps `temporal-polyfill/full/implementation` (native and swap legs), not `@js-temporal/polyfill` |
| `src/test/nativeTemporal.ts`, `src/test/noThrow.ts` | Comments; the `toTemporalInstant` shim keeps the same export |
| `.fallowrc.jsonc` | The comment naming the alias |

Comments elsewhere in `src/test/*` that describe 0.5.1 behaviour (`setFakeSystemTime.ts`, the
`oh-*.test.ts` files, `annotationGrammar.test.ts` …) are corrected only where the statement is now
false on 1.0.8; a historical note that says "0.5.1" and is still true stays.

## Types

Delete `packages/gmt/tsconfig.tsbuildinfo` (and any other `*.tsbuildinfo`) before counting; stale
composite build info hides errors. Expect about 238 errors (research § 5; CORE-108 findings:
95 TS2694, 65 TS2724, 40 TS2322, 20 TS2345, 7 TS2578).

1. **Helper types (TS2694, TS2724).** `temporal-spec` does not export `DateTimeUnit`, `SmallestUnit`,
   `LargestUnit`, `TotalUnit`, `PluralUnit`, `RoundingMode`, `ToStringPrecisionOptions`,
   `DifferenceOptions`, `DurationRoundTo`, `ToInstantOptions`, `ArithmeticOptions`,
   `ZonedDateTimeAssignmentOptions`. New file `src/internal/temporalTypes.ts` exports one alias per
   name GMT uses, **derived** from `temporal-spec` types by indexed access, never a hand-written
   union where a spec type exists. Examples: `DateTimeUnit = Temporal.DateUnit | Temporal.TimeUnit`;
   `PluralUnit<T> = Temporal.PluralizeUnit<T>`;
   `RoundingMode = NonNullable<Temporal.RoundingOptions<Temporal.DateUnit | Temporal.TimeUnit>["roundingMode"]>`;
   option bags from the method parameter types (`Parameters<Temporal.PlainDate["until"]>[1]`).
   It imports `type { Temporal }` from `./temporal`, never from the package.
2. **Call sites.** 67 non-test files write `Temporal.<HelperName>`. Replace with the named import from
   `internal/temporalTypes` (a type-only rename; let `tsc` list every site, and run `oxfmt` after).
   Test files the same.
3. **TS2578.** Delete each `@ts-expect-error` that no longer fires; if the line it guarded is now a
   real call with a valid type, keep the row and its expected value.
4. **TS2322 / TS2345.** Mostly `ZonedDateTimeLike` objects without `timeZone`/`offset` and narrower
   option types. Fix the GMT type, never with a cast to `any` or `as unknown as`.

**Public types change.** GMT re-exports `Temporal` and `Intl` from every namespace entry (`src/index.ts`
and 18 `*/index.ts`), so consumers' `Temporal.*` types now come from `temporal-spec`. Any public
signature that named a removed helper type now names the alias. List every public type whose
emitted `.d.ts` text changes (`pnpm --filter @northguild/gmt build` in this worktree, diff
`dist/**/*.d.ts` against a build of `main` saved to scratch) and hand the list to slice 7 for the
changeset.

## Dox

57 files under `apps/dox/src`, `apps/dox/scripts` and `apps/dox/tests` import
`{ Temporal }` or `type { Temporal }` from `@js-temporal/polyfill` (research § 5 says 68; 57 is the
count today). Change each to `@northguild/gmt`, which re-exports the seam, so Dox runs the one
implementation GMT runs (research § 7). `apps/dox/vitest.config.ts:54` comment follows. Do not touch
`apps/dox/src/lib/bundle-size.ts` (slice 6 / Dox spec).

Do not build `packages/gmt/dist` in the main checkout; the Dox dev server there reads it.

## Not in this slice

`scripts/behaviour-matrix` keeps its own `@js-temporal/polyfill` 0.5.1 pin: it is a separate,
private comparison tool outside the workspace (`.fallowrc` ignores it). Slice 7 states that in its
README.

## Done when

`tsc` clean in `packages/gmt` and `apps/dox`; whole suite green on Node; browser suite green in
Chromium, Firefox and WebKit (`vitest.browser.config.ts` with `GMT_TEMPORAL=polyfill`);
`node scripts/temporal-compat.mjs check` runs (groups may now report removable — that is slice 3).
