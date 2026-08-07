# DST Disambiguation

Twice a year, in timezones that observe Daylight Saving Time, the mapping between "local wall-clock time" and "actual instant" breaks down. This doc explains why, and how GMT lets you control what happens.

## The problem

A plain datetime like `"2024-03-10T02:30:00"` has no timezone attached — it's just numbers on a clock face. To turn it into a real instant, you attach a timezone (e.g. `"America/New_York"`). Normally that's a 1:1 mapping. But on the two days a year DST changes, it isn't:

- **Spring-forward gap**: clocks jump forward, so a whole hour of wall-clock time never happens. On 2024-03-10, `America/New_York` went straight from `01:59:59` to `03:00:00`. The time `02:30:00` **does not exist** that day.
- **Fall-back overlap**: clocks jump backward, so an hour of wall-clock time happens **twice**. On 2024-11-03, `America/New_York` went from `01:59:59` back to `01:00:00` and counted up again. The time `01:30:00` happens **twice** — once before the clocks fall back, once after.

If you don't think about this, code that attaches a timezone to a plain datetime will silently pick *something* for these cases — and libraries differ (and have had bugs) around what that "something" is. GMT makes the choice explicit instead of hiding it.

## The four resolution strategies

Both scenarios need a tiebreak rule. Temporal (and GMT, which wraps it) offers four:

| Value | Gap (nonexistent time) behavior | Overlap (ambiguous time) behavior |
|---|---|---|
| `"compatible"` (default) | Same as `"later"` | Same as `"earlier"` |
| `"earlier"` | Resolve as if the gap hadn't happened yet — pre-transition offset | Pick the *first* occurrence (pre-transition offset) |
| `"later"` | Resolve as if the gap had already happened — post-transition offset | Pick the *second* occurrence (post-transition offset) |
| `"reject"` | Throw — GMT returns `""` | Throw — GMT returns `""` |

`"compatible"` is the default because it matches what most runtimes and other datetime libraries do out of the box — it's the safe, unsurprising choice if you don't have an opinion. Reach for `"earlier"`/`"later"` when your domain has a specific rule (e.g. "always round DST-gap appointments forward"), and `"reject"` when an ambiguous/nonexistent time should be a hard validation error rather than silently resolved.

## Using it in GMT

`convertPlainDateTimeToZoned` (and, as the DST disambiguation work continues, other functions that produce a `ZonedDateTime` from a plain/local value) accepts an optional `disambiguation` option:

```typescript
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

// Spring-forward gap: 2024-03-10T02:30:00 doesn't exist in America/New_York.
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York");
// "2024-03-10T03:30:00.000-04:00[America/New_York]"  (default "compatible" == "later")

convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "earlier",
});
// "2024-03-10T01:30:00.000-05:00[America/New_York]"

convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — no such local time exists, and we're not going to guess

// Fall-back overlap: 2024-11-03T01:30:00 happens twice in America/New_York.
convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York");
// "2024-11-03T01:30:00.000-04:00[America/New_York]"  (default "compatible" == "earlier")

convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York", {
  disambiguation: "later",
});
// "2024-11-03T01:30:00.000-05:00[America/New_York]"
```

Note the offset is what actually distinguishes the two fall-back results above — the wall-clock string looks identical (`01:30:00`), but `-04:00` vs. `-05:00` is a real one-hour difference in absolute time.

## Why this matters

Silently resolving DST ambiguity is a well-known source of subtle bugs — a scheduled job, calendar event, or reminder created "at 2:30 AM" near a DST boundary can land an hour off from what the user meant, and it only shows up twice a year, making it hard to catch in testing. Exposing `disambiguation` explicitly means:

- You can pick a default behavior once, consciously and consistently, instead of inheriting whatever Temporal happens to do.
- You can use `"reject"` to make DST-ambiguous input an explicit validation failure at the boundary of your system, rather than a silently-wrong timestamp downstream.

## Further reading

- [Temporal's own writeup of disambiguation](https://tc39.es/proposal-temporal/docs/ambiguity.html) — the underlying spec this option maps onto.
- `context/roadmap.md` (Story Group C) — the internal tracking doc for rolling `disambiguation` support out across the rest of GMT's zoned-producing functions.
