# Duration API

Parsing, validation, and arithmetic for ISO 8601 duration strings (e.g. `"P1DT2H30M"`). All functions accept and return ISO 8601 duration strings.

## Modules

### calculate

Combine two durations:

- `addDuration`
- `subtractDuration`

Both operate on day/time units (days, hours, minutes, seconds, ...). Combining any pair where either operand has a nonzero years/months/weeks component returns `""` — `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option, so calendar-unit duration arithmetic isn't supported here.

### parse

Parse and normalize:

- `parseDuration`

### validate

Validation helpers:

- `isValidDuration`
