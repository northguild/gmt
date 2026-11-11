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

- **SWIFT chooses the century, so you do not.** SWIFT reads a `YY` above 79 as 19`YY` and the rest as 20`YY`, and refuses a year after 2060. The range is 1980 to 2060, limits included. There are no options. `990615` is 1999-06-15, `240615` is 2024-06-15, and `750101` is refused because it would be 2075.
- **A date that does not exist is refused.** The day is checked in the year the rule gives, so `000229` is 2000-02-29 and `850229` returns `""`.
- **Only the bare six digits are read.** A tag, a currency, an amount, a space or any other digit makes the parser return `""` and the validator return `false`. `formatSwiftDate` takes an ISO calendar date, and returns `""` for a date-time or for a year outside 1980 to 2060, because written as two digits it would be read back as another year.

The rule covers SWIFT value dates in field 30 and field 32A. Other six-digit dates, such as field 31D of an MT 700, follow their own rules: read them with `parseDateWithPattern`.
