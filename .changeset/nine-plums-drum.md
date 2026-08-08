---
"@burglekitt/gmt": minor
---

Adds `addDuration` and `subtractDuration` to the `duration` namespace, combining two ISO 8601 duration strings (e.g. `"P1D"` + `"PT2H"` → `"P1DT2H"`) via `Temporal.Duration.prototype.add`/`.subtract`.

Both operate on day/time units only — combining a pair where either operand has a nonzero years/months/weeks component returns `""`, since `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option to resolve calendar-unit arithmetic.
