---
story: CORE-90
issue: 341
status: waiting
dox: none
---

# CORE-90 — phase 2: the US clock-change checker

Issue: [#341](https://github.com/northguild/gmt/issues/341). Story file:
[issues/CORE-90.md](../../issues/CORE-90.md), which records what phase 1 shipped and the owner's
decisions.

## Trigger

Phase 2 starts when a change to a US zone's clock rules is law **and** a tz database release models
it. The weekly US clock-change watch
([canary/overview.md](../../../canary/overview.md)) files a tz issue when a zone in
`apps/dox/src/lib/us-region-zones.json` changes its rules: that issue is the signal.

## Scope

- **The checker** at `/check/us-<year>-clock-change/`, built from the CORE-89 checker parts
  (`wireZoneMap` and `wireFeatureMap`, the probe, stored-times, clocks and key-points cards) and
  the phase 1 US projection, boundary files and zone list.
- **A US test file** in `packages/gmt/src/test/`, like `oh-canada.test.ts`, for the US zones.
- **Zones and dates come from the tz release,** never from a bill: which zones change, when, and
  the states that choose standard time all year instead.
- **Any date.** The page and its tests handle a change on any date and at any local time, not only
  a usual changeover Sunday.
- **Words before the date.** A checker published before its change needs each dated phrase in both
  tenses, flipping when the moment passes. Dox has none today; commit 4ce90269 has the two-form
  parts (`tense-slot`, `bindTense`) to rebuild from.
- **Retire the watch's tz part** when the checker ships, and decide what the Sunshine Protection
  Act page becomes (fold into the checker, or keep for the states that have not acted).

## Verification

- The checker's Worker column matches the tz release that models the change, for every changed
  zone.
- The checker works keyboard-only and at 375 px.
- `pnpm run validate` stays green.
