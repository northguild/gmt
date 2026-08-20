---
"@burglekitt/gmt": minor
---

Add standalone, locale-aware Gregorian era-name lookup (Story H2):

- `getLocaleEraNames(locale, style?)` — 2-element `[BCE-label, CE-label]` array

This is the GMT equivalent of Luxon's `Info.eras`: it returns locale-formatted era names without requiring a date value, delegating to the host runtime's `Intl` data. Returns `[]` for an invalid BCP 47 locale tag. If a locale has no distinct BCE/CE era names, both array elements contain the same string — the sentinel is reserved for invalid input only.
