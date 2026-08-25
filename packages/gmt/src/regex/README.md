# Regex API

Composable regex patterns for parsing ISO 8601 date/time strings. Useful for building custom parsers or validation regexes.

## Modules

### date

Date patterns:

- `year`, `month`, `day`, `plainDate`

### calendar-date

GMT's calendar-annotated PlainDate pattern (calendar-native digits, not Temporal's ISO-digit
`[u-ca=...]` convention):

- `calendarDate` — e.g. `"5785-01-01[u-ca=hebrew]"`, `"0006-10-03[u-ca=japanese;era=reiwa]"`

### calendar-zoned-date-time

GMT's calendar-annotated ZonedDateTime pattern. **The `[u-ca=...]` segment precedes
`[timeZone]` — the reverse of RFC 9557, deliberately**; see the file's own comment for why
(short version: GMT's digits are calendar-native, so the string is never valid RFC 9557, and
writing it in RFC order makes Temporal silently misparse a Hebrew year as an ISO year):

- `calendarZonedDateTime` — e.g. `"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"`

Its date half and annotation half are byte-identical to `calendarDate`'s, with a sync test
asserting the two never drift apart.

### date-time

DateTime patterns:

- `plainDateTime`

### http-date

RFC 7231 IMF-fixdate pattern:

- `httpDate`

### leap-second

Leap second handling:

- `leapSecond`

### rfc-2822

RFC 5322 (RFC 2822) date-time pattern:

- `rfc2822DateTime`

### rfc-3339

Strict RFC 3339 date-time pattern:

- `rfc3339DateTime`

### sql-date-time

ANSI SQL / ODBC datetime literal pattern:

- `sqlDateTime`

### time

Time patterns:

- `plainTime`
- `hour`, `minute`, `second`
- `fractionalSecond`, `millisecond`

### time-zone-like

Timezone patterns:

- `timezoneLike`

### unix

Unix timestamp patterns:

- `unixSeconds`, `unixMilliseconds`

### utc-date-time

UTC datetime patterns:

- `utcDateTime`