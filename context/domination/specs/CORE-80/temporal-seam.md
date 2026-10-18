# Slice 2 — The Temporal seam, and the polyfill strategy

Read with [index.md](./index.md). Story scope parts 2 and 8.

## A. One import site

**New file** `packages/gmt/src/internal/temporal.ts`:

```ts
/**
 * The one module in `src` that names the Temporal implementation. Every other file, tests
 * included, imports from here, so the implementation can change in one place.
 */
export { Intl, Temporal, toTemporalInstant } from "@js-temporal/polyfill";
```

It does no work at import time and adds nothing else: the three names are the ones the entry
points re-export today. `internal/index.ts` does **not** re-export it; the public entries name
the three explicitly (§ B), so nothing else from the polyfill can reach the surface.

**Rewrite every import** of `@js-temporal/polyfill` under `packages/gmt/src`, shipped and test
files alike (about 500 shipped files, 244 test files), to the relative path of
`internal/temporal`:

| Today | After |
| ----- | ----- |
| `import { Temporal } from "@js-temporal/polyfill";` | `import { Temporal } from "<rel>/internal/temporal";` |
| `import type { Temporal } from "@js-temporal/polyfill";` | `import type { Temporal } from "<rel>/internal/temporal";` |

Do it with a script run once (`node` + `path.relative`), not by hand, and keep the import's
position in the file. Files inside `internal/` use `./temporal`; inside
`internal/temporalCompat/`, `../temporal`. No source file other than `internal/temporal.ts`
imports the package afterwards: ``rg "(from|import\(|require\()\s*[\"'\`]@js-temporal/polyfill" packages/gmt/src``
matches that file and nothing else. Comments may still name the package, and the seam test in
`internal/temporal.test.ts` skips comment lines too.

**Enforce it.** In `packages/gmt/oxlint.config.mts`, add `no-restricted-imports` with
`paths: [{ name: "@js-temporal/polyfill", message: "Import Temporal from internal/temporal" }]`,
and an `overrides` entry turning it off for `src/internal/temporal.ts` only. If the root
`oxlint.config.mts` lints `packages/gmt/src`, add the same rule there scoped to that glob. Check
that oxlint 1.78 accepts the `paths` form; if not, use `patterns`. A deliberate violation in a
scratch file must fail `pnpm lint`, then be deleted.

## B. Entry points re-export from the seam

In all 17 `index.ts` files (the root and `calendar`, `transport`, `instant`, `plain`,
`timescale`, `interval`, `workforce`, `regex`, `gnss`, `unix`, `span`, `zoned`, `intermodal`,
`precision`, `duration`, `utc`), replace `export * from "@js-temporal/polyfill";` with:

```ts
export { Intl, Temporal, toTemporalInstant } from "./internal/temporal"; // root
export { Intl, Temporal, toTemporalInstant } from "../internal/temporal"; // a namespace
```

Keep each file's comment, reworded to say the names come from the seam. The public surface is
unchanged: `node scripts/api-surface.mjs check` passes with no snapshot edit. Measured with
esbuild 0.28.1, removing the re-export would save nothing (root 487.1 / 127.5 kB with and without
it; `addBusinessDays` alone or with `Temporal` 173.6 / 50.4 kB), which is why it stays.

`src/test/noThrow.ts` keeps its `polyfill` set (`toTemporalInstant`); it names no package, so it
needs no edit. No Dox page, `context/dox/built.md` line or test changes.

**Changeset: `patch`** for `@northguild/gmt` (owner decision 4). The story changes no output,
option or signature, but users get faster functions and smaller bundles only through a release.
The finalizer writes it last: one line per headline size saving (minified and gzipped kB,
before → after) and per speed target met, from the slice 1 snapshot compared with the final
state. Slice 11 adds the matching row to coding-standards § Changesets.

## C. Polyfill strategy (decided: owner decision 1)

**`@js-temporal/polyfill` stays GMT's only Temporal implementation in this story.** The seam is
the deliverable; it makes any later switch a one-file change plus a test run.

Reasoning, from the runtimes GMT supports (`engines` `>=22.16.0`; CI Node 22, 24, 26):

- **Native Temporal is not where GMT's users run.** Node 22 and 24 have none (local Node 24.21.0:
  `typeof globalThis.Temporal === "undefined"`). Node 26 enables it by default
  ([Node.js 26.0.0 release notes](https://nodejs.org/en/blog/release/v26.0.0); local Node
  26.10.0: `typeof globalThis.Temporal === "object"`). WebKit added it in Safari Technology
  Preview 249 ([WebKit release notes](https://webkit.org/blog/18182/release-notes-for-safari-technology-preview-249/),
  change 316742@main); this spec relies on no stable Safari release shipping it.
- **Native-first with a fallback cannot cut the default bundle.** The polyfill is a static import
  with a declared side effect. Choosing it at run time needs a dynamic `import()` or top-level
  `await`, which breaks synchronous use and `require()` of GMT's ESM. An opt-in `#temporal`
  import condition avoids that, but every function would then need the full suite on a second
  implementation, on every runtime that offers it.
- **A smaller polyfill trades a measured 44 kB for unmeasured conformance.**
  `internal/temporalCompat/` holds the behaviour probes (D1–D8, D10–D13), the weekly canary and `pnpm compat:oracle`,
  all pinned to `@js-temporal/polyfill`'s defects. A different implementation has different
  defects, and GMT would ship them until the probes found them. The authority for a switch is
  conformance (test262), not size.

**What would reopen the decision:** Node 24 leaving support and Safari stable shipping
Temporal. Then a native-first entry is worth its own story: probes already run against whatever
`Temporal` the seam returns, so the workarounds switch themselves off where native is correct.

Nothing in slices 3–10 depends on this choice.

## Edge cases

- `import type` and value imports of `Temporal` in the same file collapse to one import from
  the seam.
- A file that imports `Intl` or `toTemporalInstant` from the polyfill: none exists today
  (verified: shipped source imports only `Temporal`). If one appears, it imports from the seam.
- `scripts/temporal-compat.mjs` and other root scripts import the polyfill directly; they are
  outside `src` and keep doing so.

## Done when

- The polyfill is named in exactly one file under `packages/gmt/src`, and the lint rule enforces it.
- Every entry point re-exports `Intl`, `Temporal` and `toTemporalInstant` from the seam, and
  `node scripts/api-surface.mjs check` passes unchanged.
- `pnpm size`: every entry is unchanged to the byte (the seam adds no code). Record it in the
  handoff.
- Full suite green; `pnpm run validate` green.
