# CORE-114 — Core: The same call gives different values on different runtimes

**Scope:** Every public function returns one value on every host: Node 22, 24 and 26, Chromium,
Firefox and WebKit on Linux and macOS, with or without native Temporal, on any ICU. Adds no
library function. Tracked as #560.

## Gap

`@js-temporal/polyfill` 0.5.1 reads calendars, zone names and locale data from the host's `Intl`,
and hosts carry different ICU and CLDR copies. Chinese and Dangi dates, the Coptic era on 1 Tout
AM 1, nine zone names, zone links in `areZonedEqual`, Islamic dates before the Hijra, CLDR week
data and a locale's default calendar each gave different values on different hosts.

## Scope

- **The whole class, in one PR.** Every reader of host calendar, zone and locale data in
  `packages/gmt/src`.
- **Compat entries D33 to D37**, each with its repro, README rows, `workarounds.mjs` entry,
  `WHAT_BREAKS` entry and canary coverage.

## Decisions

- **Values are identical on every host; text is the host's own.**
- **Repair or refuse.** A value is repaired when a standard gives one answer every host can
  reach; otherwise the disputed input returns the sentinel on every host. A calendar or first day
  the caller names (`-u-ca-`, `calendar`, `-u-fw-`) is honoured. No routing by host.
- **Retirement** only when every engine in the weekly runs passes the entry's repro.
- **Upstream:** CLDR-19917, ICU-21506, WebKit 221878 and WebKit 330688.

The spec is `context/domination/specs/chinese-dangi-icu78/`.
