---
"@burglekitt/gmt": minor
---

Add plain range formatting: `formatDateRange`, `formatDateTimeRange` (Story J14).

Plain counterparts of the existing `zoned/format/formatZonedRange` — same `(start, end, locale?, options?)` parameter order and `Intl.DateTimeFormatOptions` shape, but wrapping `Temporal.PlainDate`/`Temporal.PlainDateTime` directly since there's no timezone to reconcile between endpoints. Both use `Intl.DateTimeFormat.prototype.formatRange` under the hood, so the locale elides shared fields between `start` and `end` (`"February 3 – 5, 2024"` for same-month, `"November 3, 2024 – February 10, 2025"` once the year differs) instead of the caller having to format both ends and join them by hand. Returns `""` when either endpoint is invalid; a reversed range (`end` before `start`) still formats rather than throwing or auto-correcting.

Updated `packages/gmt/README.md`, `packages/gmt/src/plain/README.md`, and the `format-date-time` skill.
