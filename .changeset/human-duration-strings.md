---
"@northguild/gmt": minor
---

Add `parseHumanDuration` and `formatHumanDuration`, which read and write the duration strings people type, such as `2h 30m` and `3 days` (Story CORE-85). `parseHumanDuration` is in `@northguild/gmt/duration/parse` and `formatHumanDuration` is in `@northguild/gmt/duration/format`. The root and `@northguild/gmt/duration` export both.

Config files and command-line flags hold `30s`, `2h 30m` or `7d`, not `PT30S` or `P7D`, and `parseDuration` reads ISO 8601 only. Each caller wrote a parser, and each one decided alone what `1m` means. These two functions use one grammar that is written out in full on the function page.

```typescript
import { parseHumanDuration } from "@northguild/gmt/duration/parse";
import { formatHumanDuration } from "@northguild/gmt/duration/format";

parseHumanDuration("2h 30m"); // "PT2H30M"
parseHumanDuration("3 days"); // "P3D"
parseHumanDuration("1.5h"); // "PT1H30M"
parseHumanDuration("1s 500ms"); // "PT1.5S"
parseHumanDuration("1m"); // "PT1M" (a minute)
parseHumanDuration("1mo"); // "P1M" (a month)
parseHumanDuration("1.5h 30m"); // "" (a fraction only on the last unit)
parseHumanDuration("P1M"); // "" (ISO 8601, so use parseDuration)

formatHumanDuration("PT2H30M"); // "2h 30m"
formatHumanDuration("PT90M"); // "90m"
formatHumanDuration("PT1.5S"); // "1.5s"
formatHumanDuration("-PT2H30M"); // "-2h 30m"
```

- `m` is always a minute and `mo` always a month. Unit names are not case-sensitive, so `1M` is also a minute.
- Units are kept as you wrote them: `3 days` is `P3D`, not `PT72H`. A day is not always 24 hours, so the function does not guess.
- Write a unit at most once, largest first. A typo such as `2h 3h` or `30m 2h` returns `""`, so it is never summed.
- A fraction is allowed only on hours, minutes or seconds, and only on the last unit. Temporal spreads it into smaller units. `ms` joins the seconds and takes no fraction.
- Separate units with spaces, a comma, `and`, or nothing at all: `2h30m`. Only the plain space counts. A leading or trailing space, a tab or a no-break space returns `""`, so trim the input first.
- `parseHumanDuration` returns `""` for anything outside the grammar. `formatHumanDuration` returns `""` for anything that is not an ISO 8601 duration. For a duration in the words of a locale, use `formatDuration`.
- `parseHumanDuration(formatHumanDuration(d))` gives the same duration as `parseDuration(d)`, for every valid ISO 8601 duration `d`.

No string is valid in both grammars, so to accept either form write `parseDuration(text) || parseHumanDuration(text)`.

The docs add the Duration Parser Bench tool at `/tools/duration-parser-bench/` and a section in the durations guide.
