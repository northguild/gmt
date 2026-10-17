# Performance audit — Part 1, bundle size

Part of [the index](../perf-and-bundle-size-audit.md).

## Part 1 — Bundle size

### Where the bytes are

Root entry, every export, minified (esbuild, measured from `src/`; it matches bundlephobia's
figure within 4%):

| Area                   | Minified | Note                                                 |
| ---------------------- | -------: | ---------------------------------------------------- |
| `@js-temporal/polyfill` + `jsbi` | 153 kB | 44 kB gzipped. Flagged side-effectful (`./tsc-out/calendar.js`) |
| `internal/`            |   160 kB | Largest: `dutyEngine` 21.9, `zonedWallClockDifference` 14.8, `temporalCompat/repros` 12.0, `operatingSchedule` 6.7, `dutyRules` 6.6 |
| `plain/`               |    63 kB |                                                      |
| `zoned/`               |    26 kB |                                                      |
| `utc/` + `unix/`       |    31 kB |                                                      |
| All realm namespaces   |    30 kB | `intermodal`, `transport`, `calendar`, `workforce`, `gnss`, `timescale`, … |
| **Total**              | **486 kB** | **126.5 kB gzipped**                               |

### What a real user pays (tree-shaken, one function imported)

| Import                 | Minified | Gzipped | Polyfill share | GMT code | Of which `repros.ts` |
| ---------------------- | -------: | ------: | -------------: | -------: | -------------------: |
| `isValidDate`          | 153.3 kB | 44.7 kB |       152.5 kB |   0.8 kB |                    — |
| `formatDate`           | 155.4 kB | 45.4 kB |       152.5 kB |   2.8 kB |                    — |
| `businessDaysBetween`  | 172.5 kB | 50.2 kB |       152.6 kB |  19.9 kB |              12.0 kB |
| `addBusinessDays`      | 173.6 kB | 50.7 kB |       152.6 kB |  21.0 kB |              12.0 kB |
| `chargeableDays`       | 197.3 kB | 58.0 kB |       152.6 kB |  44.7 kB |              12.0 kB |
| `operatingTimeBetween` | 200.8 kB | 59.0 kB |       152.6 kB |  48.2 kB |              12.0 kB |
| `dutyViolations`       | 226.7 kB | 67.3 kB |       152.6 kB |  74.1 kB |              12.0 kB |

For reference, bundlephobia's whole-package figures: `temporal-polyfill@0.3.0` 54.4 kB / 19.9 kB
gzipped; `date-fns@4.1.0` 70.7 / 17.5; `luxon@3.7.2` 69.8 / 21.9. The npm tarball unpacks to
4.66 MB in 1,837 files (JSDoc kept in `dist/*.js`, plus `skills/`).

### Findings

**S1 — The polyfill is the floor under every import (44 kB gzipped).**
`src/index.ts:1` re-exports the whole polyfill (`export * from "@js-temporal/polyfill"`), and
698 source lines import it directly. The polyfill ships as one 129 kB ESM file that declares a
side effect, so no bundler can trim it. This is the single biggest lever. Options, in order of
effort:

1. **One import seam.** Route every `Temporal` import through one internal module
   (`internal/temporal.ts`). No change in behaviour. Every option below depends on it.
2. **Drop the root re-export.** GMT's contract is string-in, string-out (Core Rule 2), so
   handing out the polyfill's `Temporal` from the root is outside that contract. It also ties
   the public surface to one polyfill. Removing it is a breaking change, and a breaking change
   is acceptable here.
3. **Native-first.** Chromium already ships native Temporal (the `compat:oracle` scan runs on
   it). A build that reads `globalThis.Temporal` and loads the polyfill only where it is
   missing removes the 44 kB for those users. It needs a second entry or a conditional export,
   because a static `import` of the polyfill always bundles it. The `temporalCompat` probes
   already test behaviour rather than versions, so the workarounds keep working on whichever
   implementation is present. Engine support in Firefox, Safari and Node must be confirmed
   from each vendor's release notes before choosing.
4. **A smaller polyfill.** `temporal-polyfill` is 19.9 kB gzipped against 45.2 kB. The
   probes would gate its defects the same way. It needs the full zone, locale and calendar
   matrix plus `pnpm compat:oracle` before adopting.

**S2 — Canary fixtures ship to production (12 kB minified).**
`internal/temporalCompat/capabilities.ts:1` imports the whole `repros` table from
`repros.ts`. That table holds every repro with its `expected` value, including the
canary-only groups (`zoned.A`, `zoned.B`, `zoned.D`, `zoned.E`, `D9`) that no probe reads. So
any function that reaches a calendar or zone workaround carries all of it. Fix: move the
canary-only repros into their own module that only the canary script loads. Then key the
probe repros so each probe imports only its own, which lets the bundler drop the rest.

**S3 — No size budget or measurement.** No `size-limit`, no CI step, no script. Size has grown
each release from 1.14.2 to 1.19.0 without anyone choosing it.
Fix: a `scripts/bundle-size.mjs` that bundles in memory with esbuild (`write: false`, so `dist`
and the Dox dev server are untouched). It reports these three figures, and `validate` fails
when any of them grows past a budget:

- (a) the root entry,
- (b) the polyfill floor,
- (c) a fixed set of single-function imports (the table above).

The measurement used for this audit is in the appendix.

**S4 — The headline figure is the wrong one to read.** Bundlephobia shows the cost of
importing everything. Nobody does that, and the per-function table above is what a user
actually pays. Once S3 exists, generate that table into a Dox guide page so the true cost is
published rather than argued.

**S5 — Large internals are feature-sized, not waste.** `dutyEngine.ts` (21.9 kB) and
`zonedWallClockDifference.ts` (14.8 kB) are paid only by users of those functions. They are not
a priority for size. Comments are already stripped by any minifier. Keeping JSDoc in
`dist/*.js` only affects install size, not bundle size.

Clean: no TypeScript `enum`, no `Intl` object built at module load, `sideEffects: false` is
declared, and tree-shaking demonstrably drops unused GMT modules.

