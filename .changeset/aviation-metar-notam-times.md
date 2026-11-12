---
"@northguild/gmt": minor
---

The `aviation` area now reads the time in a METAR report and the validity of a NOTAM. Both are in `@northguild/gmt/aviation`, in `@northguild/gmt/aviation/parse` and in `@northguild/gmt/aviation/validate`.

A METAR report time, such as `302350Z`, gives a day, an hour and a minute. It has no month and no year, so reading it needs the time the report was received. A NOTAM states its start (item B) and its end (item C) as ten digits, `YYMMDDHHMM`. Item C can also say `PERM`, or end in `EST` for an estimate.

- `parseMetarTime(value, referenceInstant)` reads a METAR, SPECI or TAF time group and returns a UTC instant.
- `isValidMetarTime(value, referenceInstant)` is `true` exactly when `parseMetarTime` would return an instant.
- `parseNotamValidity(value, options)` reads item B) or C) and returns a `NotamValidity`, or `null`.
- `isValidNotamValidity(value, options)` is `true` exactly when `parseNotamValidity` would return a value.
- `NotamValidity` is `{ kind: "instant"; instant: string; estimated: boolean }` or `{ kind: "permanent" }`.

```typescript
import {
  isValidMetarTime,
  parseMetarTime,
  parseNotamValidity,
} from "@northguild/gmt/aviation";

parseMetarTime("302350Z", "2024-07-01T00:05:00Z"); // "2024-06-30T23:50:00Z"
parseNotamValidity("1407031230EST", { yearWindow: 2000 });
// { kind: "instant", instant: "2014-07-03T12:30:00Z", estimated: true }
parseNotamValidity("PERM", { yearWindow: 2000 }); // { kind: "permanent" }
isValidMetarTime("321200Z", "2024-07-01T00:05:00Z"); // false
```

- **The reference instant is required.** `parseMetarTime` returns the matching time nearest to it, so a report made at 23:50 on 30 June and received on 1 July reads as 30 June, not 30 days ahead. If two are equally near, it returns the earlier. A month without the day, such as `31` in June, is skipped. The group is read in UTC.
- **`PERM` is not a date.** `parseNotamValidity` returns `{ kind: "permanent" }` with no instant. A value ending in `EST` keeps its instant and sets `estimated` to `true`. A space before `EST` is not read.
- **You state the century for a NOTAM.** `options.yearWindow` is required, as it is for the EDI and SSIM parsers. Without it, `parseNotamValidity` returns `null` and `isValidNotamValidity` returns `false`.
- **Hour `24` is not read.** NOTAMs write the end of a day as `2359`.
- **Items B) and C) share one reader.** `PERM` and `EST` belong to item C) only. When you read item B), treat a `"permanent"` result or `estimated: true` as malformed.
- **A value that cannot be read returns the empty result.** `parseMetarTime` returns `""`, `parseNotamValidity` returns `null` and the validators return `false`. This includes a reference that is not an ISO 8601 instant with `Z` or an offset.
