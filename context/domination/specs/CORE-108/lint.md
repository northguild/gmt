# Slice 5 — Import restrictions

Issue Scope 6 says the lint plugins name the polyfill. They do not: `gmt-oxlint`, `gmt-eslint` and
`gmt-biome` mention it only in their CHANGELOGs (`no-date-library-imports` bans date libraries, not
Temporal polyfills). The polyfill is named in the repo's own lint configs, CORE-80's seam rule. So
this slice edits configs only; the three plugin packages get no change and no changeset
(index § Corrections 1).

## Rule

In each config below, `no-restricted-imports` bans **both** packages, so the old one cannot come back
and the new one is reached only through the seam:

```ts
"no-restricted-imports": ["error", {
  paths: [{ name: "@js-temporal/polyfill", message: "GMT runs on temporal-polyfill; import Temporal from internal/temporal" }],
  patterns: [{ group: ["temporal-polyfill", "temporal-polyfill/**"], message: "Import Temporal from internal/temporal" }],
}]
```

Check the oxlint version in the lockfile supports `patterns` with `group` (oxlint's
`no-restricted-imports` follows ESLint's options); if it does not, list the subpaths GMT could
import (`temporal-polyfill`, `/full`, `/full/implementation`, `/implementation`, `/global`,
`/full/global`, `/shim`, `/full/shim`, `/fns/*`) as `paths` instead.

| Config | Files | Exempt |
| ------ | ----- | ------ |
| `oxlint.config.mts` (root) | `packages/gmt/src/**` | `packages/gmt/src/internal/temporal.ts` |
| `packages/gmt/oxlint.config.mts` | `src/**`, `bench/**` | `src/internal/temporal.ts`; `src/test/swapEntry.ts` imports `temporal-polyfill-candidate/…`, which neither rule names, so no exemption is needed (slice 4 points it there; until then it is exempt) |
| `apps/dox/oxlint.config.mts` | `src/**`, `scripts/**`, `tests/**` (new override) | none: Dox takes `Temporal` from `@northguild/gmt` (slice 2); message "Import Temporal from @northguild/gmt" |

`scripts/behaviour-matrix/**` keeps importing `@js-temporal/polyfill` (its own pinned comparison
tool); the root config does not cover it with this rule, and the existing override for it stays.
`scripts/bundle-size.mjs` names both packages only as strings in esbuild input, which the rule does
not see.

## Tests

- `internal/temporal.test.ts` (slice 2) already scans `src` and `bench` for both specifiers in forms
  lint cannot see.
- A lint fixture is not needed; prove the rule once by hand: add `import { Temporal } from
  "temporal-polyfill/full/implementation"` to one `packages/gmt/src` file and one `apps/dox/src` file,
  run `pnpm lint`, see both errors, revert.

## Done when

`pnpm lint` (root, `packages/gmt`, `apps/dox`) passes; the hand check above fails as expected.
