---
"@northguild/gmt": minor
---

Add operating hours to `calendar/`: `recurringWindows`, `operatingIntervals`, `isOpenAt`, `nextOpenAt`, `nextCloseAt`, `operatingTimeBetween` and `addOperatingTime` (Story CORE-55).

A business day answers "is Thursday a working day". A terminal gate, a support desk, a customs office or a night curfew asks more: is it open now, how many open hours have passed, and when does an SLA measured in open hours fall due. One `OperatingSchedule` answers all of them: a zone, windows of local wall time for each ISO weekday, holiday dates, and dated overrides.

```typescript
import { addOperatingTime, nextOpenAt, operatingIntervals, operatingTimeBetween, recurringWindows } from "@northguild/gmt";

const nineToFive = [{ from: "09:00", to: "17:00" }];
const desk = {
  timeZone: "America/New_York",
  weekly: { 1: nineToFive, 2: nineToFive, 3: nineToFive, 4: nineToFive, 5: nineToFive },
  holidays: ["2024-07-04"],
  overrides: [{ date: "2024-07-05", windows: [{ from: "10:00", to: "12:00" }] }],
};

operatingIntervals(desk, { start: "2024-07-04T04:00:00Z", end: "2024-07-06T04:00:00Z" });
// [{ start: "2024-07-05T14:00:00Z", end: "2024-07-05T16:00:00Z" }] — holiday closed, Friday overridden
nextOpenAt("2024-06-15T16:00:00Z", desk); // "2024-06-17T13:00:00Z" — Saturday noon to Monday 09:00 local
operatingTimeBetween("2024-06-14T20:00:00Z", "2024-06-17T14:00:00Z", desk); // "PT2H"
addOperatingTime("2024-06-14T20:00:00Z", "PT8H", desk); // "2024-06-17T20:00:00Z" — Monday 16:00 local
addOperatingTime("2024-06-14T20:00:00Z", "PT8H", desk, { within: "P1D" }); // ""

recurringWindows(
  { 6: [{ from: "23:00", to: "06:00" }] },
  { start: "2024-11-02T00:00:00Z", end: "2024-11-04T00:00:00Z" },
  "America/New_York",
);
// [{ start: "2024-11-03T03:00:00Z", end: "2024-11-03T11:00:00Z" }] — 8 hours across the fall-back night
```

- **Windows are half-open local wall time.** A `to` at or before its `from` wraps past midnight (`23:00`–`06:00` is a night, `00:00`–`00:00` a whole day). A window belongs to the date it starts on, so a Friday holiday or override removes or replaces a Friday-night window and a Saturday one does not. Windows that overlap or touch are merged.
- **Every window edge goes through `resolveLocal`.** `disambiguation` defaults to `"compatible"`: an edge in a repeated fall-back hour takes the earlier instant, and one in a skipped spring-forward hour moves forward by the gap. `"earlier"` and `"later"` pick the other instant. `"reject"` returns the sentinel when a window with an ambiguous or nonexistent edge could change the answer, and ignores one that cannot. Every function takes the option.
- **Dates are the zone's real local dates.** Holidays and overrides are ISO dates in the schedule's zone. A `BusinessCalendar` can be passed as `holidays`; its `holidays` are read and its `weekend` is not. An override wins over a holiday, and `windows: []` closes a date. A date the zone deleted has no windows, and a date the clock re-enters after a fall-back is walked once.
- **Open time is exact elapsed time.** `operatingTimeBetween` sums the open intervals inside `[start, end)` with hours as the largest unit, the same number `sumIntervals` gives for their intersections with the range. `addOperatingTime` is its inverse: the earliest instant at which that much open time has passed. Its duration is hours and smaller; a duration with days, weeks, months or years returns `""`, because `P1D` of open time could mean 24 open hours or one working day.
- **Searches have a stated horizon.** `nextOpenAt`, `nextCloseAt` and `addOperatingTime` search up to `within` after the input (default `"P1Y"`, added in the schedule's zone). An answer exactly at the horizon counts; past it they return `""`. `nextOpenAt` returns the input when it is already open, and `nextCloseAt` returns the input when it is already closed.
- **Walks are bounded.** A range spanning more than 10,000 local dates (about 27 years) from its start's date, or a search that would go that far past its input, returns the sentinel, never a truncated answer. A search answers as soon as its answer is certain, and a horizon past Temporal's last instant stops there.
- Also exported: the `OperatingSchedule`, `LocalWindow`, `OperatingOverride` and `IsoWeekday` types under `/types`. The subpath `@northguild/gmt/calendar/hours` joins the package exports.
