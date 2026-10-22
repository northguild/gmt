# CORE-89 — Core: The Morocco 2026 clock-change checker in Dox

**Scope:** Dox gains a Morocco 2026 clock-change checker at `/gmt/check/morocco-2026-clock-change`, built from the Canada checker's parts, which become shared rather than copied. Adds no library function.

## Gap

Since 2026-09-20, Morocco and Western Sahara stay on UTC+00 all year and no longer change their clocks for Ramadan; tzdb 2026c records it. A runtime with older tz data shows `Africa/Casablanca` and `Africa/El_Aaiun` at `+01:00` outside Ramadan and `+00:00` during it, so it is an hour ahead for most of the year and right for a few weeks, which hides the fault. Measured: Chromium 153.0.8010.12 gives `+01:00` at 2026-10-22T12:00Z and 2027-06-01T12:00Z; Chromium 156.0.8078.4, WebKit 26.6 and Node 26.12.1 (tz 2026e) give `+00:00`. The Canada checker shows Casablanca as one probe row only.

## Scope

- **The checker** at `/gmt/check/morocco-2026-clock-change`, MIT like the rest of Dox, with its chat pill and widget registration: the reader's runtime against tzdb 2026c for both zones, the clock changes that no longer happen, and which saved events moved (`classifyStoredZoned`). The Dox Worker computes it when the page is requested.
- **Shared parts.** The Canada checker's runtime probe, live clocks, saved-events check and help card become parts both pages use. The Canada page keeps its behaviour and its tests.
- **A test file** beside `packages/gmt/src/test/oh-canada.test.ts`: fixed instants through 2027, Ramadan included, every row failing on tz data older than 2026c. The page links to it.
- **The weekly native run.** A `KNOWN_HOST_FAILURES` group for Chromium, with evidence, if the run's Chromium still predates 2026c when the test lands.

## What gmt provides (do not re-implement)

- The Canada checker, its Worker endpoint and its page parts (`CORE-88`)
- `classifyStoredZoned` (`CORE-83`)
- `getTimeZoneOffset`, `getDstTransitions` and the zone helpers the Worker endpoint calls

## Verification

- The checker page and its Worker endpoint answer 200 live, and the Worker column matches tzdb 2026c for both zones.
- The Canada page renders and behaves as before on the shared parts.
- The checker works keyboard-only and at 375 px.
- `pnpm run validate` stays green.
