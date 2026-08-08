---
"@burglekitt/gmt": minor
---

Adds `normalizeDuration` to the `duration` namespace, rolling an ISO 8601 duration string's small units into larger ones via `Temporal.Duration.prototype.round` (e.g. `"PT90M"` + `{ largestUnit: "hour" }` → `"PT1H30M"`).

- Defaults to `{ largestUnit: "auto" }` when no options are given, which reformats a day/time-only duration without promoting units — pass an explicit `largestUnit` to promote.
- Accepts `largestUnit`, `smallestUnit`, `roundingIncrement`, `roundingMode`, and `relativeTo` options, mirroring `Temporal.Duration.prototype.round`'s options.
- `relativeTo` is required whenever a calendar unit (year/month/week) is involved — either as the requested `largestUnit`, or because the input duration already has a nonzero year/month/week component (this applies even under the `"auto"` default). Without it in either case, returns `""`.
- Returns `""` on invalid input: non-string value, invalid duration string, or invalid `relativeTo`.

Also expands `addDuration`/`subtractDuration`'s test coverage with additional permutations (overflow-without-borrow, negative-operand cancellation, fractional-second combination, negative-result subtraction) per `context/testing-standards.md`'s exhaustive `it.each` coverage bar.
