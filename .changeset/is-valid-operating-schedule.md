---
"@northguild/gmt": minor
---

New `isValidOperatingSchedule` tells a closed schedule from one the operating-hours functions refuse.

- **`isValidOperatingSchedule(schedule)`** returns `true` exactly when `operatingIntervals`, `isOpenAt`, `nextOpenAt`, `nextCloseAt`, `operatingTimeBetween` and `addOperatingTime` accept the schedule. `operatingIntervals` returns `[]` and `isOpenAt` returns `false` both for a closed schedule and for one they refuse. It never throws, and it narrows the value to `OperatingSchedule`.

  ```typescript
  const week = { start: "2024-06-10T00:00:00Z", end: "2024-06-17T00:00:00Z" };
  const closed = { timeZone: "Europe/London", weekly: {} };
  const typo = { timeZone: "Europe/London", weekly: { 8: [{ from: "09:00", to: "17:00" }] } };

  operatingIntervals(closed, week); // []
  isValidOperatingSchedule(closed); // true — closed every day
  operatingIntervals(typo, week); // []
  isValidOperatingSchedule(typo); // false — 8 is not an ISO weekday
  ```

- **Corrected advice in `isOpenAt`.** Its documentation said to call `operatingIntervals` to tell a closed schedule from an invalid one. That cannot work, because `operatingIntervals` returns `[]` for both. It now points to `isValidOperatingSchedule`.
