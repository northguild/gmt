---
"@northguild/gmt": minor
---

Eight new functions turn an instant into a Julian Date, a Modified Julian Date or a count of seconds since J2000.0, and back. They are in `@northguild/gmt/timescale` and `@northguild/gmt/timescale/convert`.

- `toJulianDateParts(isoString, scale?)` and `fromJulianDateParts({ jd1, jd2 }, scale?)` carry a Julian Date as two numbers: `jd1` is a whole number of days and `jd2` is the fraction of a day. This form keeps the nanosecond.
- `toJulianDate(isoString, scale?)` and `fromJulianDate(jd, scale?)` use one number. One number cannot hold a modern Julian Date exactly, so the result is rounded to about 20 microseconds. Use the two-part form when the precision matters.
- `toModifiedJulianDate(isoString, scale?)` and `fromModifiedJulianDate(mjd, scale?)` use the Modified Julian Date, which is the Julian Date minus 2400000.5. It starts at midnight and keeps more digits in one number than the Julian Date does.
- `toJ2000Seconds(isoString, scale?)` and `fromJ2000Seconds(seconds, scale?)` count seconds from J2000.0.

`scale` is `"UTC"`, `"TAI"`, `"TT"` or `"TCG"`; the new type `TimeScale` names them, and `JulianDateParts` is the two-part shape. The default is `"UTC"`, except for the J2000 pair, which default to `"TT"` because J2000.0 is defined as 2000-01-01 12:00 TT. A Julian Date day starts at noon. On UTC, every day counts as one day, including a day with a leap second, so every value converts back to the instant it came from.

```typescript
import { fromJ2000Seconds, toJ2000Seconds, toJulianDate, toJulianDateParts, toModifiedJulianDate } from "@northguild/gmt";

toJulianDateParts("2026-01-01T00:00:00.123456789Z"); // { jd1: 2461041, jd2: 0.5000014288980208 }
toJulianDate("2026-01-01T12:00:00Z"); // 2461042
toModifiedJulianDate("2000-01-01T00:00:00Z"); // 51544
toJ2000Seconds("2000-01-01T11:58:55.816Z"); // 0
fromJ2000Seconds(0); // "2000-01-01T11:58:55.816Z"
```

Every `to*` function returns `null` and every `from*` function returns `""` for input that does not fit, an instant before 1972-01-01 or after year 9999, or a scale that is not one of the four. TDB is not offered. A single-number result is also `null` when the rounded number falls outside that range. None of them throws.
