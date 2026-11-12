---
"@northguild/gmt": minor
---

The `finance` area now reads and writes the value date in SWIFT MT messages. The value date in field 30 and field 32A has six digits, `YYMMDD`, such as `240615`. It is not ISO 8601, so `Temporal` cannot read it. The functions are in `@northguild/gmt/finance`, and in `@northguild/gmt/finance/parse`, `@northguild/gmt/finance/format` and `@northguild/gmt/finance/validate`.

- `parseSwiftDate(value)` reads a value date and returns an ISO date.
- `formatSwiftDate(value)` writes an ISO date as a value date.
- `isValidSwiftDate(value)` is `true` exactly when `parseSwiftDate` would return a date.

```typescript
import {
  formatSwiftDate,
  isValidSwiftDate,
  parseSwiftDate,
} from "@northguild/gmt/finance";

parseSwiftDate("240615"); // "2024-06-15"
formatSwiftDate("2024-06-15"); // "240615"
isValidSwiftDate("750101"); // false
```

Three rules apply to all three functions:

- **SWIFT chooses the century, so you do not.** SWIFT reads a `YY` from 01 to 60 as 20`YY`, 2001 to 2060, and refuses any other `YY`, `00` and `61` to `99` included. There are no options. `240615` is 2024-06-15, and `990615` and `750101` are refused.
- **A date that does not exist is refused.** The day is checked in the year the rule gives, so `040229` is 2004-02-29 and `050229` returns `""`.
- **Only the bare six digits are read.** A tag, a currency, an amount, a space or any other digit makes the parser return `""` and the validator return `false`. `formatSwiftDate` takes an ISO calendar date, and returns `""` for a date-time or for a year outside 2001 to 2060, because written as two digits it would be read back as another year.

The rule covers the value dates SWIFT states it for: field 32A of MT 910, and fields 30 and 32A of category 1 and 2 messages other than the common group messages n92, n95 and n96. Other six-digit dates, such as field 31D of an MT 700, follow their own rules: read them with `parseDateWithPattern`.
