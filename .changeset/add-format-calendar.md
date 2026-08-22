---
"@burglekitt/gmt": minor
---

Add `formatCalendar`, `formatCalendarZoned`, `formatCalendarUnix`, `formatCalendarUtc` (Story J15) — Story Group J complete.

Moment's `.calendar()`: a relative day label plus time-of-day, e.g. `"Tomorrow at 2:30 PM"`. This is distinct from the existing `formatRelative*` family, which renders an elapsed-time phrase ("in 1 day") and never includes a clock time — Group I's notes over-generalized Luxon's `toRelativeCalendar` parity claim to Moment's `.calendar()`, which this story corrects.

Within `±6` days of `reference` (default "now"), renders `<day label> <connector> <time>` — "today"/"tomorrow"/"yesterday" near the boundary, "in N days"/"N days ago" further out, via `Intl.RelativeTimeFormat`. Beyond that, falls back to an absolute `dateStyle: "long"` + `timeStyle` string with no relative wording, matching Moment's `sameElse` behavior.

The day label and time are joined using the **locale's own connector** — read from `Intl.DateTimeFormat`'s combined `dateStyle` + `timeStyle` part sequence for the same instant, never a hardcoded `"at"`. This is the go/no-go decision the story required before implementation: a verified `Intl`-only route with no hardcoded English, covering all 17 `MustTestLocales` including a locale (ru-RU) whose combined date+time pattern fuses a date-side suffix onto the connector literal, which the new `internal/joinDateTimeConnector.ts` helper detects and strips.

`timeStyle: "full"` is available on the zoned/unix/utc variants (a real IANA zone) but not on plain `formatCalendar` — a plain value has no real timezone, so `"full"`'s `timeZoneName` would misrepresent the internal UTC anchor as a fact about the input.

Updated `packages/gmt/README.md`, `plain/README.md`, `zoned/README.md`, `unix/README.md`, `utc/README.md`, and the `format-date-time` skill (new Core Pattern + a Common Mistakes entry distinguishing `formatCalendar` from `formatRelativeDateTime`).
