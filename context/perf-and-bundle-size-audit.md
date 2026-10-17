# Performance and bundle-size audit — `@northguild/gmt`

Measured on the 1.19.0 source (branch `feature/197-…`), Node 24.21.0, esbuild 0.28.2.
Timings are averages of a few runs on one laptop. Read them as orders of magnitude, not as
benchmarks.

## Summary

- **Size.** Importing everything costs 467.6 kB minified, 119.6 kB gzipped (bundlephobia).
  About a third of that, 44 kB gzipped, is `@js-temporal/polyfill`. **Every** GMT import pays
  that 44 kB, even a 0.8 kB function such as `isValidDate`. Tree-shaking works for GMT's own
  code. It cannot remove the polyfill.
- **Speed.** Most of the 209 loops in the source are bounded by a small constant or by the
  size of the output. Five families grow with the input span or log size, and each has a
  closed-form or binary-search replacement. The worst is the duty-log scan, which grows with
  the **square** of the log: 390 ms for a 1-year log with one rule.
- **GNSS, leap seconds and time scales are already arithmetic.** `gnssWeek.ts`,
  `leapSeconds.ts` and `timescale/` use division, modulus and table lookups. No loop there
  grows with the span.
- **Nothing guards either.** There is no benchmark, no size budget, and no performance rule in
  `tdd-dev`, `gmt-reviewer`, the review checklist or the coding standards. The only related
  rule is "an exhausted loop returns the sentinel".

## Scoped files

Load only the part the task needs.

- [bundle-size.md](perf-and-bundle-size-audit/bundle-size.md) — Part 1: where the bytes are, what a real user pays for one imported function, and the bundle-size findings.
- [loop-performance.md](perf-and-bundle-size-audit/loop-performance.md) — Part 2: what Big O means here, the measurements, and the loop findings ranked by real-world impact.
- [agent-changes-and-decisions.md](perf-and-bundle-size-audit/agent-changes-and-decisions.md) — Part 3: recommended `tdd-dev` and `gmt-reviewer` rule changes, the owner decisions, the suggested story split, and how the figures were measured.
