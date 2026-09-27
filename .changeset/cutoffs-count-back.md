---
"@northguild/gmt": minor
---

Add `cutoffAt`, `cutoffSchedule`, `isPastCutoff` and `timeToCutoff` to the `transport/` namespace, and the `@northguild/gmt/transport/compare` subpath (Story TRAN-10).

A logistics deadline is not a fixed timestamp. It counts back from an event — a vessel's departure, a container's loading, an arrival — in the local time of the place that enforces it, and it moves when that event moves. An ocean booking carries a stack of them: documentation, VGM, gate-in, customs.

```typescript
import { cutoffAt, cutoffSchedule, isPastCutoff, timeToCutoff } from "@northguild/gmt";

// A vessel sails Friday 14 June 2024 at 18:00 in Amsterdam. "Two days before, 17:00":
cutoffAt("2024-06-14T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", atLocalTime: "17:00" });
// "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" — not 48 hours, which keeps 18:00

cutoffSchedule("2024-06-14T16:00:00Z", [
  { name: "gate-in", offset: "P1D" },
  { name: "document", offset: "P2D", atLocalTime: "17:00" },
  { name: "VGM", offset: "P1D", atLocalTime: "10:00" },
], { timeZone: "Europe/Amsterdam" });
// [ { name: "document", at: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" },
//   { name: "VGM", at: "2024-06-13T10:00:00+02:00[Europe/Amsterdam]" },
//   { name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" } ]

// 96 hours before an arrival is exact elapsed time, across New York's fall-back.
cutoffAt("2024-11-05T17:00:00Z", "PT96H", { timeZone: "America/New_York" });
// "2024-11-01T13:00:00-04:00[America/New_York]"

isPastCutoff("2024-06-12T16:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]"); // true
timeToCutoff("2024-06-12T16:00:00Z", "2024-06-12T17:00:00+02:00[Europe/Amsterdam]"); // "-PT1H"
```

- **`atLocalTime` pins the time of day.** With it, the offset's exact part (hours and smaller) comes off the anchor's instant, its calendar part (years, months, weeks, days) off that local date, and the cut-off is `atLocalTime` on the day it lands on. Without it, the offset is taken off as Temporal's `ZonedDateTime#subtract` takes it: `P2D` keeps the anchor's wall clock and `PT96H` is 96 elapsed hours.
- **The anchor is the caller's event.** Loading, departure and arrival are different instants, and `cutoffAt` never guesses which one a rule means. The anchor is exact — an instant or a zoned string, whose bracket is not read — and `timeZone`, an IANA identifier or a fixed offset, is the local frame. The functions are pure: a rescheduled departure is a new call.
- **Closures roll backward.** With a `BusinessCalendar`, a cut-off on a weekend or holiday moves by `roll`, `"preceding"` by default, so a deadline never moves later. The rolled day keeps the cut-off's local time of day. `roll` without `calendar` returns `""`.
- **A skipped hour is refused.** Every local wall time a cut-off lands on takes the earlier pass of a repeated hour, and returns `""` for an hour the clock skipped or a day the zone deleted, rather than shifting the deadline.
- **`cutoffSchedule` is all or nothing.** It sorts the stack by instant, keeps the given order for ties, and returns `[]` if any entry fails.
- **The window closes at the cut-off.** `isPastCutoff` is `true` from the cut-off instant on. `timeToCutoff` is exact hours, `PT0S` at the cut-off and negative after it. Both return their sentinel for `cutoffAt`'s `""`.
- Also exported: the `CutoffOptions`, `Cutoff`, `CutoffTime` and `CutoffScheduleOptions` types.
