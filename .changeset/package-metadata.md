---
"@northguild/gmt": patch
"@northguild/gmt-eslint": patch
"@northguild/gmt-oxlint": patch
"@northguild/gmt-biome": patch
---

Each package's npm description and keywords now say what it does. `@northguild/gmt` names time zones, DST, business days and ISO 8601. Each lint package says it bans the `Date` object and points to the `@northguild/gmt` replacement.

The `getTimezoneOffset()` lint message in all three lint packages now names `getTimeZoneOffset(timeZone, instant)` from `@northguild/gmt`, instead of "zoned methods".
