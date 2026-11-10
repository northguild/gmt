---
"@northguild/gmt": minor
---

Add the `finance` namespace: read, write and check FIX `UTCTimestamp` values, the `YYYYMMDD-HH:MM:SS[.fraction]` time that orders, executions and market data carry in a FIX message. It is available from `@northguild/gmt` and from `@northguild/gmt/finance`, with `/parse`, `/format` and `/validate` subpaths.

- `parseFixUtcTimestamp(value)` returns `{ instant, precision, leapSecond, picoseconds }`, or `null`. The precision comes from the number of fraction digits sent (none, 3, 6, 9 or 12) and is never widened, so a millisecond stamp stays a millisecond stamp. `instant` keeps the digits sent up to the ninth, and digits 10 to 12 of a picosecond stamp come back in `picoseconds`, so nothing is dropped without saying so.
- `formatFixUtcTimestamp(instant, precision)` writes an instant in UTC at the precision a counterparty asks for. `precision` is `"second"`, `"millisecond"`, `"microsecond"`, `"nanosecond"` or `"picosecond"`. It cuts and never rounds, so a stamp cannot move into the next second or day, and `"picosecond"` pads `000` because an instant holds nothing finer.
- `isValidFixUtcTimestamp(value)` is `true` exactly when the parser returns a value. It takes any value and narrows it to `string`.

A seconds field of `60` is accepted only on the 27 days a leap second was inserted, and it is read back as `23:59:60`. Any other `60` is refused.

```typescript
import { formatFixUtcTimestamp, parseFixUtcTimestamp } from "@northguild/gmt/finance";

parseFixUtcTimestamp("20240615-14:30:00.123456789012");
// { instant: "2024-06-15T14:30:00.123456789Z", precision: "picosecond", leapSecond: false, picoseconds: 12 }
parseFixUtcTimestamp("20171231-23:59:60"); // null: no second was inserted that day
formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "millisecond"); // "20240615-14:30:00.123"
```

The parser returns `null` for a fraction of any other width, for a date that does not exist and for a value in ISO 8601 form. The formatter returns `""` for a date-time with no offset, which names no UTC second until `resolveLocal` gives one, for a year outside 0000 to 9999 and for an unknown precision.
