---
"@burglekitt/gmt": minor
---

Add token-pattern-based parsing: `parseDateWithPattern`, `parseDateTimeWithPattern`, `parseTimeWithPattern` (Story J11).

Each decodes a string against a caller-supplied token pattern (e.g. `"MM/dd/yyyy"`, `"dd-MMM-yyyy h:mm a"`) and returns the matching ISO `PlainDate`/`PlainDateTime`/`PlainTime` string, or `""` on no match, a malformed pattern, or a shape-valid-but-not-real date/time (`"02/31/2024"` against `"MM/dd/yyyy"` still fails — the regex only proves shape, `Temporal.*.from(..., { overflow: "reject" })` proves it's real).

This is a decoding tool for a *known, fixed* producer format — a CSV column, a legacy API field, a partially-typed form value — not a display formatter. GMT still has no token-pattern *formatter*: hard-coding a field order like `"MM/dd/yyyy"` for output would ship US field ordering to every locale (roadmap Decision 1). Use `formatDate`/`formatDateTime`/`formatDateToParts` for locale-correct display; use these new functions only to consume input whose shape you don't control.

Supports numeric tokens (`yyyy`/`yy`/`MM`/`M`/`dd`/`d`/`HH`/`H`/`hh`/`h`/`mm`/`m`/`ss`/`s`/`SSS`), locale-aware name tokens (`MMMM`/`MMM`/`EEEE`/`EEE`/`a`/`GGGG`/`GG`, defaulting to `"en-US"` when `locale` is omitted), and literal text via automatic literal characters or `'single quotes'`. `parseDateWithPattern`/`parseTimeWithPattern` each reject the other's tokens (returning `""`); `parseDateTimeWithPattern` accepts the full combined set.
