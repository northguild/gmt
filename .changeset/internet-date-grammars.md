---
"@northguild/gmt": patch
---

Make the RFC 5322, HTTP-date and RFC 3339 parsers and formatters follow their grammars exactly (Story CORE-8).

**`parseRfc2822` accepts what a receiver must accept.** It took only the strict form GMT's own formatter writes. RFC 5322 §3.3 also allows folding whitespace, comments, any letter case and a 4-or-more-digit year. §4 says a receiver MUST accept the obsolete syntax too: two- and three-digit years, and the military and North American zone names. Unknown zone names read as `-0000`, meaning no offset information.

```typescript
import { parseRfc2822 } from "@northguild/gmt/zoned";

parseRfc2822("fri,15 Mar 24 14:30 -0400 (EDT)"); // "2024-03-15T14:30:00-04:00[-04:00]"
parseRfc2822("Fri, 15 Mar 2024 14:30:00 CEST"); // "2024-03-15T14:30:00+00:00[+00:00]"
```

Comments are read in one linear pass. A deeply nested comment used to take quadratic time: 4 seconds for 100 KB.

**`parseHttp` accepts all three HTTP-date forms.** RFC 9110 §5.6.7 says a recipient MUST accept `rfc850-date` and `asctime-date` as well as `IMF-fixdate`. Only `IMF-fixdate` was accepted.

```typescript
import { parseHttp } from "@northguild/gmt/utc";

parseHttp("Sunday, 06-Nov-94 08:49:37 GMT"); // "1994-11-06T08:49:37Z"
parseHttp("Sun Nov  6 08:49:37 1994"); // "1994-11-06T08:49:37Z"
```

**A day name that contradicts the date is rejected.** RFC 5322 §3.3 requires the day of week to match the date. Both parsers ignored it, so `"Sat, 15 Mar 2024"` parsed as a Friday. They now return `""`.

`parseHttp` applies the rule to **all three** HTTP-date forms, `asctime-date` included. That form writes the day name with no comma after it, so it is the one most likely to be read as decoration — it is not. 6 November 1994 was a Sunday, so all three of these return `""`, and only the Sunday spellings parse:

```typescript
parseRfc2822("Sat, 15 Mar 2024 14:30:00 -0400"); // ""
parseHttp("Sat, 15 Mar 2024 14:30:00 GMT"); // "" — IMF-fixdate
parseHttp("Monday, 06-Nov-94 08:49:37 GMT"); // "" — rfc850-date
parseHttp("Mon Nov  6 08:49:37 1994"); // "" — asctime-date
parseHttp("Sun Nov  6 08:49:37 1994"); // "1994-11-06T08:49:37Z"
```

Accepting a mismatch would mean choosing which of the two fields to believe, and RFC 9110 gives no rule for that. Rejecting is the only reading that never invents a date.

Compatibility: remove the day name. The date alone then decides the result. For `parseHttp`, parse the string as RFC 5322 and convert it to UTC.

```typescript
parseRfc2822("15 Mar 2024 14:30:00 -0400"); // "2024-03-15T14:30:00-04:00[-04:00]"
convertZonedToUtc(parseRfc2822("15 Mar 2024 14:30:00 GMT")); // "2024-03-15T14:30:00Z"
```

**Formatters stop writing strings outside their grammar.** `formatRfc2822` and `formatHttp` wrote years before 0000 as `"00-1"`, and `formatHttp` wrote years past 9999. `formatRfc2822` wrote an offset with seconds, such as Monrovia's −00:44:30 in 1969, as `"-0044.5"`. `formatRfc3339` rounded a sub-minute offset to the minute, which names a different instant, and wrote years past 9999 in expanded form. All three now return `""` for a year their grammar cannot express, and `formatRfc2822` does the same for an offset with seconds. `formatRfc3339` writes such a value as the same instant at `+00:00`.

```typescript
formatRfc3339("1969-12-31T23:15:30-00:45[Africa/Monrovia]"); // "1970-01-01T00:00:00+00:00"
formatRfc3339("+010000-01-01T00:00:00+00:00[UTC]"); // ""
formatHttp("-000001-06-15T12:00:00Z"); // ""
formatRfc2822("-000001-06-15T12:00:00+00:00[UTC]"); // ""
```

Compatibility: for the value itself, use Temporal's own serialisation. `Temporal.ZonedDateTime#toString({ timeZoneName: "never" })` gives the earlier `formatRfc3339` string, and `Temporal.Instant#toString()` or `Temporal.ZonedDateTime#toString()` gives a string for any year.

```typescript
Temporal.ZonedDateTime.from("1969-12-31T23:15:30-00:45[Africa/Monrovia]").toString({ timeZoneName: "never" }); // "1969-12-31T23:15:30-00:45"
```

The `rfc2822DateTime` and `httpDate` regexes stay strict: they match only the form GMT writes. The `rfc3339DateTime` regex now rejects an offset outside `-23:59`…`+23:59`, as RFC 3339 §5.6 requires.

```typescript
import { rfc3339DateTime } from "@northguild/gmt/regex";

rfc3339DateTime.test("2024-03-15T14:30:00+24:00"); // false
```
