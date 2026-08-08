# DST Disambiguation

Twice a year, in timezones that observe Daylight Saving Time, the mapping between "local wall-clock time" and "actual instant" breaks down. This doc explains why, and how GMT lets you control what happens.

## The problem

A plain datetime like `"2024-03-10T02:30:00"` has no timezone attached — it's just numbers on a clock face. To turn it into a real instant, you attach a timezone (e.g. `"America/New_York"`). Normally that's a 1:1 mapping. But on the two days a year DST changes, it isn't:

- **Spring-forward gap**: clocks jump forward, so a whole hour of wall-clock time never happens. On 2024-03-10, `America/New_York` went straight from `01:59:59` to `03:00:00`. The time `02:30:00` **does not exist** that day.
- **Fall-back overlap**: clocks jump backward, so an hour of wall-clock time happens **twice**. On 2024-11-03, `America/New_York` went from `01:59:59` back to `01:00:00` and counted up again. The time `01:30:00` happens **twice** — once before the clocks fall back, once after.

If you don't think about this, code that attaches a timezone to a plain datetime will silently pick _something_ for these cases — and libraries differ (and have had bugs) around what that "something" is. GMT makes the choice explicit instead of hiding it.

## The four resolution strategies

Both scenarios need a tiebreak rule. Temporal (and GMT, which wraps it) offers four:

| Value                    | Gap behavior           | Overlap behavior    |
| ------------------------ | ---------------------- | ------------------- |
| `"compatible"` (default) | same as `"later"`      | same as `"earlier"` |
| `"earlier"`              | pre-transition offset  | first occurrence    |
| `"later"`                | post-transition offset | second occurrence   |
| `"reject"`               | GMT returns `""`       | GMT returns `""`    |

- **Gap** (`"earlier"`/`"later"`): a nonexistent wall-clock time doesn't have a "before"/"after" instant of its own, so these resolve by pretending the transition happened either before or after the given time — `"earlier"` = pre-transition offset, `"later"` = post-transition offset.
- **Overlap** (`"earlier"`/`"later"`): the wall-clock time genuinely happens twice — these just pick the first or second real occurrence.

`"compatible"` is the default because it matches what most runtimes and other datetime libraries do out of the box — it's the safe, unsurprising choice if you don't have an opinion. Reach for `"earlier"`/`"later"` when your domain has a specific rule (e.g. "always round DST-gap appointments forward"), and `"reject"` when an ambiguous/nonexistent time should be a hard validation error rather than silently resolved.

## Which function do I actually need?

`disambiguation` shows up on more than one function, and they don't all behave the same way — this is the part people get tripped up on. Use this table to route to the right one:

| Your situation                                | Function                      | Real control?      |
| --------------------------------------------- | ----------------------------- | ------------------ |
| Attach a plain local time + timezone          | `convertPlainDateTimeToZoned` | **Yes, fully.**    |
| Add/subtract a duration from a zoned datetime | `addZoned` / `subtractZoned`  | **Overlaps only.** |
| Jump to start/end of day/week/month/quarter   | `startOfZoned` family         | **Yes, fully.**    |

- **`convertPlainDateTimeToZoned`** — every value (`earlier`/`later`/`reject`) changes the result, for both gaps and overlaps.
- **`addZoned` / `subtractZoned`** — only controls overlaps; has no effect on gaps. See below.
- **`startOfZoned` family** (`startOfZoned`, `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned` — Story C3) — fully controllable; these construct a new local time via `.with()`, same mechanism as `convertPlainDateTimeToZoned`.

### Real-world scenarios

**"A user picks 2:30 AM on March 10th in a signup form, and I need to store it as a real instant."**
You have a _plain_ local time with no instant behind it yet — use `convertPlainDateTimeToZoned`. That date/time might not exist (spring-forward gap), and `disambiguation` is your only lever to decide what happens: silently round forward (`"compatible"`/`"later"`), silently round back (`"earlier"`), or make it a hard validation error (`"reject"`) so the form can ask the user to pick a different time.

**"A subscription renews every 30 days from whenever it started, and I need the next renewal timestamp."**
You already have a `ZonedDateTime` (the last renewal) and you're moving it forward by a duration — use `addZoned`. Here `disambiguation` only matters if the _arithmetic result itself_ happens to land on an ambiguous fall-back local time (e.g. the 30-day cycle happens to land on `2024-11-03T01:30:00` in `America/New_York`); you can pass `disambiguation: "reject"` to catch that and force a manual decision instead of silently picking `"compatible"`. But if the result instead lands in a _gap_ (nonexistent local time), `disambiguation` won't help — Temporal's arithmetic already resolves gap landings on its own, before `addZoned` ever gets a chance to apply your preference. Don't rely on `reject` to catch a gap-crossing add; it won't throw.

**"I need to reject any zoned arithmetic that lands on DST-ambiguous ground, no exceptions."**
You can get there for overlaps (pass `disambiguation: "reject"` to `addZoned`/`subtractZoned`), but not for gaps — there's currently no way to make a gap-crossing add/subtract fail. If that guarantee matters for your domain, validate the _result_ separately (e.g. reconstruct it through `convertPlainDateTimeToZoned` with `reject`, which does see gaps) rather than trusting `addZoned` alone.

### Why `addZoned`/`subtractZoned` can't fully control gaps

`Temporal.ZonedDateTime.prototype.add()`/`.subtract()` don't accept a `disambiguation` option at all — arithmetic always resolves ambiguity internally as `"compatible"`. GMT's `addZoned`/`subtractZoned` work around this by re-resolving the _result_ through the same construction path `convertPlainDateTimeToZoned` uses (dropping the offset and reconstructing from the local time + timezone). That trick genuinely works for overlaps, because the ambiguity is still there to resolve when you look at the result's local time. It does _not_ work for gaps: by the time arithmetic finishes, a gap landing has already been silently advanced past (the local time it hands back is a real, unambiguous one) — there's nothing left to disambiguate. This is a property of how Temporal's arithmetic algorithm works, not a GMT limitation we can lift later without an upstream spec change.

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
