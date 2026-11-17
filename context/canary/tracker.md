# Canary — Tracker

A row is a canary story with its own GitHub issue. New canary work is a `CNRY-<n>` row with its
spec in [issues/](issues/). `/plan-story` and `/implement` take a `CNRY-*` ID like any other.

The four canary stories built before this epic keep their `CORE-*` IDs and their records in
[../domination/issues/](../domination/issues/), and their rows stay in
[../domination/tracker.md](../domination/tracker.md) as well. A story ID never changes.

`CNRY-*` work ships nothing in `packages/gmt`, so it carries no changeset unless it also changes
the package.

| Order | Story    | Title                                                                           | Blocked by | GitHub Issue | Status |
| ----- | -------- | ------------------------------------------------------------------------------- | ---------- | ------------ | ------ |
| 1     | CORE-81  | Weekly Temporal oracle and leap-second canary open issues, not just write logs  | —          | #319         | Done   |
| 2     | CORE-82  | The suite runs on native `Temporal`: Node 26, Chromium, Firefox, WebKit, weekly | —          | #322         | Done   |
| 3     | CORE-92  | Weekly check for a `temporal-polyfill` release GMT can swap to                  | —          | #386         | Done   |
| 4     | CORE-110 | The weekly upgrade check compares each calendar's years with native `Temporal`  | —          | #468         | Done   |
| 5     | CNRY-1   | Safari's ICU and time zone data in the native suite, and an engine page | —          | #483         | Done   |

Canary issues fixed with no story of their own:

- #361 the WebKit leg; #364 the workaround probes in each browser leg; #366 known failures no
  longer fail a leg.
- #365, #393, #462 the first untagged failures on Chromium 153, Firefox 155 and WebKit 26, tagged
  or fixed.
- #372, #373 the browser legs outgrew the runner; each browser pass now runs as eight shards.
- #380 the report job reads the newest verdict artifact after a rerun.
- #371 the leap-second canary falls back to IANA `leap-seconds.list` when IERS is down.
- PR #472 issues are filed only from `main`.
- #539–#543 one run files one rolling issue per workflow, and a US clock-watch change stays
  listed until a person closes it; module mocks apply in browser legs (the setup file loads no
  module a test mocks); a test file that imports a Node built-in stays out of browser legs;
  `rangeBundle` leaves no polyfill globals behind; tags follow the CORE-113 test titles;
  locale-data gaps grouped per browser. The WebKit legs no longer run out of memory (the range
  probes skip Islamic years before 1 AH, where the polyfill never returns in WebKit); D31 prints
  a coptic year before AM 1 signed; D32 prints the first day of 1 AH as 1 AH in WebKit; the en
  noon range keeps both day periods.
