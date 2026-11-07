---
"@northguild/gmt": minor
---

Two new functions read and write the TAI64N labels that qmail, daemontools and s6 put at the start of every log line, such as `@400000002a2b2c2d00000000`.

- `toTai64n(isoString)` returns the label of an instant: `@` followed by 24 lowercase hex digits.
- `fromTai64n(label)` returns the UTC instant of a TAI64 (16 hex digits), TAI64N (24) or TAI64NA (32) label, with or without the `@`, in either hex case. The attosecond digits of a TAI64NA label are checked and then dropped.

A label counts seconds of TAI, not of UTC, so a decoder that reads one as Unix seconds is 37 seconds out today and was 26 seconds out for the example in Bernstein's TAI64 definition. Both functions use the leap-second table, so a label written during an inserted second reads back as `23:59:60`.

```typescript
import { fromTai64n, toTai64n } from "@northguild/gmt";

toTai64n("1992-06-02T08:06:43Z"); // "@400000002a2b2c2d00000000"
fromTai64n("@400000002a2b2c2d00000000"); // "1992-06-02T08:06:43Z"
```

Both return `""` for an instant before 1972, a label of any other length, a character that is not a hex digit, or a label of 2^63 or more, which the TAI64 definition reserves. One thing to know about your own logs: daemontools on a host whose clock counts UTC adds only 10 seconds to the Unix time, not the full TAI − UTC offset, so its labels read 27 seconds early through `fromTai64n`. s6 on a UTC clock writes true TAI and reads correctly. `fromTai64n` does not correct the daemontools case, and the JSDoc of both functions says so.
