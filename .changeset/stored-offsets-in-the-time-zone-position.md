---
"@northguild/gmt": patch
---

Fix three defects. A UTC offset with seconds, which the library itself returns, is now accepted where a time zone is read and the result has no zone in it. Every function that returns a year now writes it the way Temporal does, which changes the result for a year below 1000 or above 9999. The operating-hours functions now see a night window at the very start of the range of instants Temporal supports.

### A stored offset is accepted where a time zone is

`getTimeZoneOffset`, `getZonedOffset` and `toOffsetInstant` return a zone's real offset, and that offset can carry seconds. `Africa/Monrovia` stood at `-00:44:30` until 1972, and most time zones report an offset with seconds for dates before they adopted a standard time. A caller who passed that offset back as a time zone got the empty result. So did a caller who wrote a whole-minute offset with seconds, such as `+05:30:00`.

```typescript
import {
  classifyLocal,
  convertUtcToPlainDateTime,
  getTimeZoneOffset,
  resolveLocal,
  toOffsetInstant,
} from "@northguild/gmt";

getTimeZoneOffset("Africa/Monrovia", "1970-01-01T12:00:00Z"); // "-00:44:30"

resolveLocal("1970-01-01T12:00:00", "-00:44:30"); // "1970-01-01T12:44:30Z" (was "")
resolveLocal("1970-01-01T12:00:00", "Africa/Monrovia"); // "1970-01-01T12:44:30Z" (the same instant, as before)
resolveLocal("1970-01-01T12:00:00", "+05:30:00"); // "1970-01-01T06:30:00Z" (was "")
classifyLocal("1970-01-01T12:00:00", "-00:44:30"); // "unique" (was null)
toOffsetInstant("1970-01-01T12:44:30Z", "-00:44:30"); // { instant: "1970-01-01T12:44:30Z", offset: "-00:44:30" } (was null)
convertUtcToPlainDateTime("1970-01-01T12:44:30Z", { timeZone: "-00:44:30" }); // "1970-01-01T12:00:00" (was "")
```

- **The 84 functions whose result has no zone in it** now accept, in the time zone position, anything `isValidTimeZone` or `isValidUtcOffset` accepts, and every input that worked before returns what it returned before. They are `resolveLocal`, `classifyLocal`, `toOffsetInstant`, `getTimeZoneOffset`, the `getZoned*` field readers, the `utc/` and `unix/` functions that convert to a plain value, parse a field or calculate, `floorToZone`, `bucketRange`, the operating-hours functions, `freeTimeExpiry`, `chargeableDays` and `bolTimestamp`.
- **The 28 functions that need a time zone identifier** still return the empty result for an offset with seconds, and their documentation now says why: 23 write the zone into their result (`convertUtcToZoned` and the like, and the functions that take a business calendar), and 5 pass it to `Intl.DateTimeFormat` (`formatUtc`, `formatCalendarUtc`, `formatUnix`, `formatCalendarUnix` and `formatTimeZoneName`).
- **An offset with seconds is still not a time zone.** `isValidTimeZone("-00:44:30")` is `false` and `isValidUtcOffset("-00:44:30")` is `true`. To check what a function with a zoneless result accepts, use `isValidTimeZone(x) || isValidUtcOffset(x)`.
- **One limit.** With an offset with seconds, a function that does arithmetic returns the empty result within the offset's seconds (under a minute) of one end of the range of instants Temporal supports: the last instant for an offset east of UTC, the first for one west. A function that only reads a value has no limit, and neither have `resolveLocal`, `classifyLocal`, `toOffsetInstant`, `getTimeZoneOffset` and `isBetweenUnix`.

```typescript
import { convertUtcToZoned, fromOffsetInstant } from "@northguild/gmt";

convertUtcToZoned("1970-01-01T12:44:30Z", "-00:44:30"); // "" (a written zone cannot carry seconds)
convertUtcToZoned("1970-01-01T12:44:30Z", "Africa/Monrovia"); // "1970-01-01T12:00:00-00:45[Africa/Monrovia]"
fromOffsetInstant({ instant: "1970-01-01T12:44:30Z", offset: "-00:44:30" }); // "1970-01-01T12:00:00-00:44:30"
```

### A year is written the same way everywhere

Temporal writes a year with four digits from 0000 to 9999, and with a sign and six digits outside that range. Some functions wrote the year as a bare number, and some wrote a malformed one. All of them now write Temporal's form.

```typescript
import {
  convertUtcToPlainDate,
  convertUtcToPlainDateTime,
  parseUnitFromDate,
  parseYearFromDate,
  parseYearFromUtc,
} from "@northguild/gmt";

parseYearFromDate("0005-06-01"); // "0005" (was "5")
parseYearFromDate("0999-06-01"); // "0999" (was "999")
parseYearFromDate("+010000-01-01"); // "+010000" (was "10000")
parseYearFromUtc("-000005-01-01T00:00:00Z"); // "-000005" (was "-5")
parseUnitFromDate("0005-06-01", "year"); // "0005" (was "5")
parseYearFromDate("2024-03-15"); // "2024" (unchanged)

convertUtcToPlainDate("-000005-01-01T00:00:00Z"); // "-000005-01-01" (was "00-5-01-01")
convertUtcToPlainDate("+010000-01-01T00:00:00Z"); // "+010000-01-01" (was "10000-01-01", which isValidDate rejects)
convertUtcToPlainDateTime("+010000-01-01T00:00:00Z"); // "+010000-01-01T00:00:00" (was "10000-01-01T00:00:00")
```

- **A year from 1000 to 9999 is unchanged**, in every function.
- **A year from 0000 to 0999 now has four digits**, and a year outside 0000–9999 has a sign and six digits, in these 14 places:
  - `parseYearFromDate`, `parseYearFromDateTime`, `parseYearFromZoned`, `parseYearFromUtc` and `parseYearFromUnix`.
  - The `"year"` unit of `parseUnitFromDate`, `parseUnitFromDateTime`, `parseUnitFromZoned`, `parseUnitFromUtc` and `parseUnitFromUnix`.
  - The `"year"` unit of `getNowUnit`, `getUtcNowUnit`, `getUnixNowUnit` and `getZonedNowUnit`.
- **Only a year outside 0000–9999 changes** in `convertUtcToPlainDate`, `convertUtcToPlainDateTime`, `getYear`, `getUtcYear`, `getUnixYear` and `getZonedYear`. They already wrote four digits inside that range.
- **The other units are unchanged.** A month, a day, an hour and the rest are written as before.

Check any code that reads a year below 1000 or above 9999 from one of these functions and compares it as text, or stores it. `Number(year)` gives the same number as before.

### Operating hours at the start of the range

At the first instant Temporal supports, the seven operating-hours functions missed a window that opened on the previous local date and runs past midnight. They now see it, cut to the first instant.

```typescript
import { isOpenAt, nextCloseAt, operatingIntervals } from "@northguild/gmt";

const night = [{ from: "22:00", to: "06:00" }];
const schedule = {
  timeZone: "UTC",
  weekly: { 1: night, 2: night, 3: night, 4: night, 5: night, 6: night, 7: night },
};

isOpenAt("-271821-04-20T01:00:00Z", schedule); // true (was false)
nextCloseAt("-271821-04-20T01:00:00Z", schedule); // "-271821-04-20T06:00:00Z"
operatingIntervals(schedule, { start: "-271821-04-20T00:00:00Z", end: "-271821-04-20T12:00:00Z" });
// [{ start: "-271821-04-20T00:00:00Z", end: "-271821-04-20T06:00:00Z" }] (was [])
```

Only a schedule read on the first local date of that range, in the year -271821, is affected.
