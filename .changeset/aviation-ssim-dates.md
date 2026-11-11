---
"@northguild/gmt": minor
---

A new `aviation` area reads and writes the date in IATA SSIM airline schedule files. An SSIM date has seven characters, `DDMMMYY`, such as `01JAN26`. It is not ISO 8601, so `Temporal` cannot read it. The functions are in `@northguild/gmt/aviation`, and in `@northguild/gmt/aviation/parse`, `@northguild/gmt/aviation/format` and `@northguild/gmt/aviation/validate`.

- `parseSsimDate(value, options)` reads an SSIM date and returns an ISO date.
- `formatSsimDate(value, options)` writes an ISO date as an SSIM date.
- `isValidSsimDate(value, options)` is `true` exactly when `parseSsimDate` would return a date.

```typescript
import {
  formatSsimDate,
  isValidSsimDate,
  parseSsimDate,
} from "@northguild/gmt/aviation";

parseSsimDate("01JAN26", { yearWindow: 2000 }); // "2026-01-01"
formatSsimDate("2026-10-25", { yearWindow: 2000 }); // "25OCT26"
isValidSsimDate("31FEB26", { yearWindow: 2000 }); // false
```

Three rules apply to all three functions:

- **The month is a fixed English code.** It is one of `JAN` to `DEC`, in upper case, and it is never read through the platform's language. The result is the same on every machine. `01jan26`, `01ENE26` and `01JANV26` are not read.
- **You state the century.** A two-digit year has no century of its own, so `options.yearWindow` is required: a first year such as `2000`, or `"rolling"`. There is no default. Without it, the parser and the formatter return `""` and the validator returns `false`.
- **A date that does not exist is refused.** `29FEB25` and `31APR26` return `""`. `formatSsimDate` also returns `""` for a year outside the window, because written as two digits it would be read back as another century.
