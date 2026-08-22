# Regex API

Composable regex patterns for parsing ISO 8601 date/time strings. Useful for building custom parsers or validation regexes.

## Modules

### date

Date patterns:

- `year`, `month`, `day`, `plainDate`

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