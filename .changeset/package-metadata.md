---
"@northguild/gmt": patch
"@northguild/gmt-eslint": patch
"@northguild/gmt-oxlint": patch
"@northguild/gmt-biome": patch
---

Each package's npm description and keywords now say what it does. `@northguild/gmt` names time zones, DST, business days and ISO 8601. Each lint package says it bans the `Date` object and points to the `@northguild/gmt` replacement.

The `getTimezoneOffset()` lint message in all three lint packages now names `getTimeZoneOffset(timeZone, instant)` from `@northguild/gmt`, instead of "zoned methods".

The `no-date-library-imports` message in all three lint packages now names the banned library and links its migration guide on northguild.dev, which maps that library's calls to their `@northguild/gmt` replacements. Moment.js, Day.js, Luxon and date-fns each get their own guide; `spacetime` links the list of guides.

All three lint packages now also ban `@date-fns/tz`, the time zone package for date-fns v4. The Biome plugin now bans the same packages as the other two, and no longer flags names outside that list such as `moment-tz` or `luxon-timezone`.
