---
"@burglekitt/gmt": minor
---

Add `getHoursInZonedDay` — the number of hours in a specific zoned calendar day (Story I4):

- `getHoursInZonedDay(value: string): number | null`

Returns `23` on spring-forward days, `25` on fall-back days, and `24` on normal days — or a fractional value for zones whose DST shift isn't a whole hour (e.g. `Australia/Lord_Howe`'s 30-minute shift returns `23.5`/`24.5`). Zoned-only — this is meaningless without a timezone. Returns `null` on invalid input per GMT's number-return sentinel convention.
