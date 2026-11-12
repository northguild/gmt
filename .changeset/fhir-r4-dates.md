---
"@northguild/gmt": minor
---

The `healthcare` namespace now reads, checks and writes the FHIR R4 `date`, `dateTime` and `instant`, such as `2024-06` or `2015-02-07T13:28:17-05:00`.

- `parseFHIR(value)` returns the value as sent, its precision (`year`, `month`, `day`, `second` or `fraction`) and its offset.
- `isValidFHIR(value, type)` checks a value against `"date"`, `"dateTime"` or `"instant"`. A `date` takes a day or coarser, an `instant` a second or finer, and a `dateTime` takes all five.
- `formatFHIR(isoString, type, { precision })` writes an ISO 8601 value as a FHIR value, cut to the precision and never rounded.
- `fhirDate`, `fhirDateTime` and `fhirInstant` in `@northguild/gmt/regex` are the three R4 regexes. They prove shape only, so use `isValidFHIR` to check a value: `fhirDateTime` accepts `2024-02-30`, `fhirDate` accepts `2023-02-29`, and `fhirInstant` accepts `2017-12-31T23:59:60Z` and a fraction of ten digits.

Precision is kept, so `2024-06` stays a month and is never padded to 1 June. Unlike HL7 v2, a FHIR time with no zone is invalid, because FHIR does not leave it to the sender's local time. A second of `60` is valid only on an inserted leap second, so `2016-12-31T23:59:60Z` is valid and `2017-12-31T23:59:60Z` is not. `Z`, `+00:00` and `-00:00` all read as the offset `+00:00`.

```typescript
import { formatFHIR, isValidFHIR, parseFHIR } from "@northguild/gmt/healthcare";

parseFHIR("2024-06"); // { value: "2024-06", precision: "month", offset: "" }
parseFHIR("2015-02-07T13:28:17-05:00");
// { value: "2015-02-07T13:28:17-05:00", precision: "second", offset: "-05:00" }

isValidFHIR("2024-06-15T10:30:00", "dateTime"); // false (a time needs a zone)
formatFHIR("2024-06-15T23:30:00-05:00", "date"); // "2024-06-15"
formatFHIR("2024-06-15T10:30:00Z", "dateTime", { precision: "month" }); // "2024-06"
```

`parseFHIR` returns `null`, `formatFHIR` returns `""` and `isValidFHIR` returns `false` for a value that does not fit. None of them throws. The functions are also at `@northguild/gmt/healthcare/parse`, `@northguild/gmt/healthcare/format` and `@northguild/gmt/healthcare/validate`, with the types `FhirDateTime`, `FhirDateType`, `FhirPrecision` and `FhirFormatOptions`.
