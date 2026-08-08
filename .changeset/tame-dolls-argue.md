---
"@burglekitt/gmt": minor
---

Adds a new `duration` namespace for parsing and validating ISO 8601 duration strings:

- `isValidDuration` — validates an ISO 8601 duration string (e.g. `"P1DT2H30M"`) via `Temporal.Duration.from`.
- `parseDuration` — parses and re-normalizes an ISO 8601 duration string, returning `""` on invalid input. Accepts `smallestUnit`, `fractionalSecondDigits`, and `roundingMode` options to control the precision/rounding of the output.

Also extends the existing `add*`/`subtract*`/`diff*` functions across the `plain`, `zoned`, `unix`, and `utc` namespaces (`addDate`, `addDateTime`, `addTime`, `addUnix`, `addUtc`, `addZoned`, and their `subtract`/`diff` equivalents) with additional Temporal options that were previously unreachable:

- `add*`/`subtract*` gain an `overflow` option (`"constrain"` (default, matches current behavior) | `"reject"`) controlling how an out-of-range arithmetic result (e.g. adding 1 month to Jan 31) is resolved — clamp to the nearest valid date, or reject and return the function's sentinel (`""`/`null`).
- `diff*` gain `smallestUnit`, `roundingIncrement`, and `roundingMode` options to round the computed difference before it's returned, instead of always returning the exact unrounded value.

All new options are optional and default to current behavior — no existing call signature changes.
