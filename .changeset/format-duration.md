---
"@burglekitt/gmt": minor
---

Adds `formatDuration` to the `duration` namespace, rendering an ISO 8601 duration string as a human-readable, locale-aware string (e.g. `"P1DT2H30M"` + `"en-US"` → `"1 day, 2 hours, and 30 minutes"`).

- Built on `Intl.NumberFormat({ style: "unit" })` for per-locale unit labels and pluralization, joined via `Intl.ListFormat` — both universally available on Node 20/22/24 with no version variance, unlike `Intl.DurationFormat`, which is absent entirely on Node 20/22 (only ships natively on Node 24+). This keeps `formatDuration` free of any new runtime dependency, at the cost of not being a byte-for-byte match to native `Intl.DurationFormat` output (e.g. no `"digital"` style).
- Accepts an optional `locale` (system default if omitted) and `{ style?: "long" | "short" | "narrow", zero?: boolean }` options.
- Zero-valued components are omitted by default; pass `{ zero: true }` to include them. A zero-length duration (`"PT0S"`) always renders `"0 seconds"`.
- Negative durations render each component with its own leading `"-"`.
- Returns `""` on invalid input: non-string value or invalid duration string.
