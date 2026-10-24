---
"@northguild/gmt": minor
---

Add recurrence rules and cron lines in a zone, in the new `@northguild/gmt/recurrence` subpath. The root exports it too. A schedule such as "every weekday at 02:30" is written in local time, so a daylight-saving change can leave an occurrence with a time that does not exist or that happens twice. GMT expands the schedule into instants and marks every occurrence a change touched.

Four functions and the types they use (`RecurrenceRule`, `CronExpression`, `OccurrenceWindow`, `RecurrenceOccurrence`, `CronRun`):

- `parseRecurrenceRule(value)` reads an RFC 5545 `RRULE` value, all 14 parts, with the rule's validity checks. It returns `null` for anything else, including `EXRULE`, `RSCALE` and `SKIP`.
- `expandRecurrence(rule, start, timeZone, window, options?)` gives the occurrences as instants, with `RDATE` and `EXDATE` lists. `disambiguation` is `"compatible"` (default, the RFC's reading), `"earlier"`, `"later"` or `"reject"`. Each row carries its `classification` plus the `earlier` and `later` instants.
- `parseCronExpression(value)` reads five crontab fields, with ranges, lists, `/step`, month and weekday names, `7` as Sunday and the nicknames `@hourly` to `@annually`. It returns `null` for a seconds field, `@reboot` and the `L`, `W`, `#` and `?` tokens.
- `cronRuns(expression, timeZone, window, policy)` gives the runs. There is no default policy, because real cron daemons disagree. `"crontabMatch"` never runs a time that does not exist and runs a repeated time twice. `"daemonCatchUp"` runs a fixed-time job from a skipped interval once, at the change, when the gap is under 3 hours, and a job in a repeated interval only once when the overlap is 3 hours or less, as cronie's daemon does.

The window is `{ start, end }` (half-open) or `{ after, count }` with a count of 1 to 10,000. Bad input gives `null` from the parsers and `[]` from the other two. A start, `RDATE` or `EXDATE` with a bracketed annotation such as `[Europe/Paris]` is bad input, because a call has one zone. `[]` also comes back for a cron line that never matches, a window of more than 10,000 rows, a window that opens about 1,000,000 occurrences after the start of a `COUNT` rule, and `"reject"` when the start, a wall-time `RDATE` or `EXDATE`, or a returned row is not unique.

```typescript
import { cronRuns, expandRecurrence, parseCronExpression, parseRecurrenceRule } from "@northguild/gmt/recurrence";

expandRecurrence(parseRecurrenceRule("FREQ=DAILY;COUNT=3"), "2024-03-09T02:30:00", "America/New_York", {
  after: "2024-03-08T00:00:00Z",
  count: 3,
}).map((row) => [row.instant, row.classification]);
// [["2024-03-09T07:30:00Z", "unique"], ["2024-03-10T07:30:00Z", "nonexistent"], ["2024-03-11T06:30:00Z", "unique"]]

cronRuns(
  parseCronExpression("30 2 * * *"),
  "America/New_York",
  { start: "2024-03-09T00:00:00Z", end: "2024-03-12T00:00:00Z" },
  "daemonCatchUp",
).map((run) => run.instant);
// ["2024-03-09T07:30:00Z", "2024-03-10T07:00:00Z", "2024-03-11T06:30:00Z"]
```

`DTSTART` is always the first occurrence. A `{ after, count }` window for a rule with fewer than `count` occurrences returns the ones it has. A rule that never matches again, such as February 30, gives DTSTART alone. A rare rule, such as a leap day or a Friday the 13th, still fills a count of 10,000. `UNTIL` must be a UTC date-time with a capital `T` and `Z`. When a cron line restricts both the day of month and the day of week, a day that matches either one runs. The root bundle grows by about 27 KB.

The docs add the Cron in a Zone tool and a recurrence and cron guide.
