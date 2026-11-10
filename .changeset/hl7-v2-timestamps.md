---
"@northguild/gmt": minor
---

A new `healthcare` namespace reads and writes the HL7 v2 date-time, the `DTM` and the older `TS` that most clinical feeds still send, such as `20240615103000-0500`.

- `parseHL7(value)` returns what the value states: an instant (it has an offset), a local time (it has none), a partial value (a year, month, day or hour), or the HL7 null value `""`.
- `formatHL7(isoString, { precision })` writes an ISO 8601 value as a `DTM`, cut to the precision and never rounded. It never writes a `TS`, which HL7 withdrew in v2.6.
- `isValidHL7(value)` is true exactly when `parseHL7` reads the value.

An HL7 time with no offset is the sender's local time, and HL7 says so. It is not UTC. `parseHL7` returns it as `kind: "local"` with no `instant`, so you must supply the sender's zone to `resolveLocal` to get one. A value coarser than a minute, such as a birth year, returns `kind: "partial"` and also has no instant. A `TS` degree of precision can only lower the precision, so `199904011200^L` is April 1999, not 12:00.

```typescript
import { formatHL7, parseHL7, resolveLocal } from "@northguild/gmt";

parseHL7("20240615103000-0500");
// { kind: "instant", instant: "2024-06-15T15:30:00Z", offset: "-05:00", local: "2024-06-15T10:30:00", precision: "second" }

parseHL7("20240615103000"); // { kind: "local", local: "2024-06-15T10:30:00", precision: "second" }
resolveLocal("2024-06-15T10:30:00", "Europe/Helsinki"); // "2024-06-15T07:30:00Z"

formatHL7("2024-06-15T15:30:00Z"); // "20240615153000+0000"
```

`parseHL7` returns `null`, `formatHL7` returns `""` and `isValidHL7` returns `false` for a value that does not fit, a day the month lacks, an hour of 24 or a second of 60. None of them throws. The functions are also at `@northguild/gmt/healthcare`, `@northguild/gmt/healthcare/parse`, `@northguild/gmt/healthcare/format` and `@northguild/gmt/healthcare/validate`, with the types `Hl7DateTime`, `Hl7Precision` and `Hl7FormatOptions`.
