# Performance audit — Part 1, bundle size

Part of [the index](../perf-and-bundle-size-audit.md).

## Part 1 — Bundle size

### Where the bytes are

Root entry, every export, minified (esbuild, measured from `src/`). The polyfill row and the
total are current (`node scripts/bundle-size.mjs report`); the other area rows were measured on
the 1.19.0 source and do not sum to the total:

| Area                   | Minified | Note                                                 |
| ---------------------- | -------: | ---------------------------------------------------- |
| `temporal-polyfill` 1.0.8 | 65.4 kB | 23.3 kB gzipped (65,445 B and 23,294 B) |
| `internal/`            |   160 kB | Largest: `dutyEngine` 21.9, `zonedWallClockDifference` 14.8, `temporalCompat/repros` 12.0 (an older figure, measured before `repros` left the shipped path), `operatingSchedule` 6.7, `dutyRules` 6.6 |
| `plain/`               |    63 kB |                                                      |
| `zoned/`               |    26 kB |                                                      |
| `utc/` + `unix/`       |    31 kB |                                                      |
| All realm namespaces   |    30 kB | `intermodal`, `transport`, `calendar`, `workforce`, `gnss`, `timescale`, … |
| **Total**              | **438.9 kB** | **121.9 kB gzipped**                             |

### What a real user pays (tree-shaken, one function imported)

| Import                 | Minified | Gzipped | Over the polyfill floor (minified) |
| ---------------------- | -------: | ------: | ----------------------: |
| `isValidDate`          | 66,262 B | 23,656 B |                   817 B |
| `formatDate`           | 69,759 B | 24,789 B |                 4,314 B |
| `businessDaysBetween`  | 68,836 B | 24,669 B |                 3,391 B |
| `addBusinessDays`      | 69,898 B | 25,092 B |                 4,453 B |
| `chargeableDays`       | 81,847 B | 29,036 B |                16,402 B |
| `operatingTimeBetween` | 85,512 B | 30,036 B |                20,067 B |
| `dutyViolations`       | 109,704 B | 37,646 B |               44,259 B |

For reference, bundlephobia's whole-package figures: `date-fns@4.1.0` 70.7 / 17.5; `luxon@3.7.2` 69.8 / 21.9. The npm tarball unpacks to
4.66 MB in 1,837 files (JSDoc kept in `dist/*.js`, plus `skills/`).

### Findings

**S1 — The polyfill is the floor under every import (23.3 kB gzipped on `temporal-polyfill` 1.0.8; it was 44 kB on `@js-temporal/polyfill`).**
The audit found that `src/index.ts:1` re-exported the whole polyfill and that 698 source lines
imported it directly. `internal/temporal.ts` is now the one seam (option 1), and the polyfill behind
it is `temporal-polyfill` (option 4). The polyfill still ships as one ESM file that no bundler can
trim, so the floor stays under every import. Options, in order of effort:

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

**S2 — Canary fixtures shipped to production (12 kB minified).**
`internal/temporalCompat/capabilities.ts:1` imports the whole `repros` table from
`repros.ts`. That table holds every repro with its `expected` value, including the
canary-only groups that no probe reads. So any function that reaches a calendar or zone
workaround carried all of it. Fixed: the probe repros live in `probeRepros.ts`, which
`capabilities.ts` imports, and `repros.ts` (with the canary-only `D9` group) is loaded only by the
canary script.

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

