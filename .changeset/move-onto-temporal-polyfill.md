---
"@northguild/gmt": minor
---

GMT runs on `temporal-polyfill` in place of `@js-temporal/polyfill`. Every import is smaller, month arithmetic takes bounded time for any amount, and `Temporal`, `Intl` and `toTemporalInstant` are re-exported from `temporal-polyfill`.

- `compareDurations` returns `0` for two equal durations; it returned `null`.
- The `smallestUnit` of `parseDuration` and `toStringSmallestUnit` of `DurationStringOptions` no longer accept `"minute"` or `"minutes"` at the type level, as the Temporal specification has it. What they do at run time is unchanged.
