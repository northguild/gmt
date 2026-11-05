# Slice 1 — swap-config: run the suite on `temporal-polyfill` behind the unchanged seam

Index: [index.md](index.md). Clauses: index Authority rows "Import `/full/implementation`" and
"`getNow()` may equal the frozen system time", and correction 1.

## What it does

The suite runs on `temporal-polyfill/full/implementation` without editing
`packages/gmt/src/internal/temporal.ts` and without committing `temporal-polyfill` anywhere.
Three files change: one new Node config, the browser config, and the bounded-child resolve hook.
A fourth, `getNow.test.ts`, stops failing on a polyfill whose clock has no sub-millisecond part (§4).

## 1. `packages/gmt/vitest.swap.config.ts` (new)

The same shape as `vitest.native.config.ts`: `mergeConfig(base, …)` over `./vitest.config.ts`.

```ts
/** The swap pass's implementation: always the polyfill, never the runtime's built-in Temporal. */
export const SWAP_ENTRY = "temporal-polyfill/full/implementation";
```

- `resolve.alias`: `{ find: /^@js-temporal\/polyfill$/, replacement: SWAP_ENTRY }`. The
  replacement is a bare specifier, resolved from `packages/gmt`, where the job installs it.
- `test.env`: `{ GMT_SWAP_ENTRY: SWAP_ENTRY }`. This is for the bounded child (§3).
- A header comment: what the config is for (the CORE-92 swap check), and that the package is
  installed only in the swap job, so running this config in an ordinary checkout fails to
  resolve the entry. That is the intended failure.
- No `import` of `temporal-polyfill` anywhere in committed code. The alias is a string, so `tsc`,
  lint and `knip` see no unlisted dependency. Verify that `knip` stays clean.

## 2. `packages/gmt/vitest.browser.config.ts`

Today: `const native = process.env.GMT_TEMPORAL !== "polyfill";`, an alias to the shim when
native, and `test.env` `{ GMT_NATIVE_TEMPORAL: "1" }` when native.

Change it to three modes, read once:

| `GMT_TEMPORAL` | Alias for `@js-temporal/polyfill` | `test.env` |
| -------------- | --------------------------------- | ---------- |
| unset or `""` | `src/test/nativeTemporal.ts` (unchanged) | `GMT_NATIVE_TEMPORAL: "1"` |
| `polyfill` | none (unchanged) | `{}` |
| `temporal-polyfill` | `SWAP_ENTRY`, imported from `./vitest.swap.config.ts` | `{}` |
| anything else | the config throws `Error` naming the value and the three accepted values | — |

The browser Worker in `src/test/boundedChild.browser.ts` is built by Vite, so the alias reaches
it with no further change.

Update the header comment at lines 8–9 to name the third mode.

## 3. `packages/gmt/src/test/boundedChild.ts`

`resolveHook()` builds the source of a Node `registerHooks` resolve hook for a child process.
The child does **not** go through Vite, so a Vite alias never reaches it. Today the hook maps the
polyfill specifier to the native shim when `GMT_NATIVE_TEMPORAL === "1"`. Without a change, the
swap pass's bounded-child tests would quietly run on `@js-temporal/polyfill` and pass, which is
false evidence.

- Read `process.env.GMT_SWAP_ENTRY` (string or unset).
- When it is set, the hook maps `POLYFILL` to it: `return next(SWAP_ENTRY, context)`. The
  bare specifier then resolves from the importing file under `packages/gmt/src`, which finds
  `packages/gmt/node_modules/temporal-polyfill`.
- When both `GMT_NATIVE_TEMPORAL === "1"` and `GMT_SWAP_ENTRY` are set, throw. Two
  implementations at once is a configuration error, not a choice.
- Keep the "joined, not quoted whole" rule: the specifier `@js-temporal/polyfill` must not appear
  as a quoted string in this file (seam scan, `internal/temporal.test.ts`).
- Update the JSDoc on `resolveHook` to name the swap case.

### Tests (`packages/gmt/src/test/`)

Find the existing tests for `boundedChild.ts` first (`grep -rln boundedChild packages/gmt/src`).
Add rows there, or in a new `boundedChild.test.ts` if none exist. If `resolveHook` has to become
an export for testing, add `/** @internal */` and keep it out of every public index.

| Row | Expected |
| --- | -------- |
| neither env set | hook source has `NATIVE_SHIM = null` and no swap mapping |
| `GMT_NATIVE_TEMPORAL=1` | hook source maps to the shim URL (unchanged behaviour) |
| `GMT_SWAP_ENTRY=temporal-polyfill/full/implementation` | hook source maps the polyfill specifier to that string |
| both set | throws, and the message names both variables |

Restore `process.env` after each row (`vi.stubEnv` + `vi.unstubAllEnvs`). Do not rely on
mock state carried between tests (see the index's "After #384").

### Config tests

A config file has no unit test today. Cover the browser config's mode table by a small test
that imports the config module under each `GMT_TEMPORAL` value (`vi.stubEnv`, then
`vi.resetModules()` and a dynamic `import()`). Assert the alias list and `test.env` per row,
and the throw for `GMT_TEMPORAL=bogus`. Put it in `apps/dox/scripts/canary/polyfill-swap.test.ts`
(slice 3's file), or in `packages/gmt/src/test/` if importing a config from there is simpler.
Either is fine; say which in the hand-off.

## 4. `packages/gmt/src/plain/get/getNow.test.ts`

The row "returns an exact plain datetime for the mocked system timeZone" freezes the clock at
`2024-02-29T00:00:00.000Z` and asserts `isAfterDateTime(now, chopUtc(systemTime))` is `true`. Its
comment says "greater or equal", but the assertion is strictly later. It passes on
`@js-temporal/polyfill` only because that clock adds a sub-millisecond part to the frozen
millisecond. Temporal §2.3.1 does not require one, and `temporal-polyfill` 1.0.7 reads exactly
`2024-02-29T00:00:00`, so the row fails on every swap run.

Change the assertion to "later or equal", built from two GMT comparisons:

```ts
const floor = chopUtc(systemTime);
expect(isAfterDateTime(now, floor) || areDateTimesEqual(now, floor)).toBe(true);
```

Import `areDateTimesEqual` from `"../compare"` beside `isAfterDateTime`. Do not use
`!isBeforeDateTime(now, floor)`: it returns `true` for `""` (the sentinel), so the row would pass
when `getNow` fails. Keep the comment, now true. No change to `getNow.ts`.

## Must not change

- `src/internal/temporal.ts` and `internal/temporal.test.ts`.
- `vitest.config.ts`, `vitest.native.config.ts`, `vitest.bench.config.ts`.
- What the native and control passes resolve today. The existing `native-suite.test.ts` rows stay
  green with no edit.

## Done when

- `pnpm --filter @northguild/gmt test` is green, and so is the new test.
- In a scratch copy with `pnpm --filter @northguild/gmt add -D temporal-polyfill@1.0.7`,
  `pnpm --filter @northguild/gmt exec vitest run --config vitest.swap.config.ts src/internal/temporal.test.ts src/plain/get/getNow.test.ts`
  passes (the seam test under the alias; `getNow` with §4's fix). Then a probe test (scratch only, not committed) shows
  `Temporal.Now.instant` resolving to the polyfill's class, not `globalThis.Temporal`, on Node 26.
- `knip` and `tsc` are clean with `temporal-polyfill` absent.
