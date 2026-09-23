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

## Five DST-related questions, five different functions

Beyond `disambiguation`/`offset` (this doc's main subject — what to do when _constructing_ a value lands on an ambiguous or nonexistent instant), GMT has four more DST-related functions with easily-confused names. Route by the question you're actually asking:

| Your question                                                                   | Function                               | Scope                                                |
| ------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------- |
| Does this zone observe DST at all?                                              | `hasDaylightSaving(timeZone)`          | Zone-level, no instant                               |
| Where do this zone's transitions fall?                                          | `getDstTransitions(timeZone, year)`    | Enumerates instants                                  |
| Is _this particular instant_ currently in DST?                                  | `isInDaylightSaving(value)`            | A single zoned value                                 |
| Is _this particular wall time_ ambiguous or nonexistent?                        | `classifyLocal(local, timeZone)`       | A single plain datetime, asked _before_ construction |
| What should happen when construction lands on an ambiguous/nonexistent instant? | `disambiguation` / `offset` (this doc) | Orthogonal — a construction-time choice, not a query |

`classifyLocal` is the one to reach for when the right answer is "don't resolve this at all". Every other row on this list either describes a zone or describes a value that has already been built; `classifyLocal` answers the question while you still have the option of refusing. It returns `"unique"`, `"ambiguous"` or `"nonexistent"` — the vocabulary the rest of this doc uses — so a demurrage clock, a medication window or a duty limit can route the case to a human instead of silently accepting one of two instants an hour apart.

`isInDaylightSaving` compares a zoned value's own offset against its timeZone's standard (non-DST) offset for that same year — the smaller of the offsets a Jan 15 and a Jul 15 reference point attain, since DST always shifts a zone's clocks forward relative to its own standard time, in every hemisphere:

```typescript
import { isInDaylightSaving } from "@northguild/gmt/zoned";

isInDaylightSaving("2024-07-15T12:00:00-04:00[America/New_York]");
// true

isInDaylightSaving("2024-01-15T12:00:00-05:00[America/New_York]");
// false

// Southern-hemisphere DST spans the new year — one of the two reference
// points still falls in standard time and the other in DST either way.
isInDaylightSaving("2024-01-15T12:00:00+11:00[Australia/Sydney]");
// true

isInDaylightSaving("2024-07-15T12:00:00+09:00[Asia/Tokyo]");
// false — Asia/Tokyo has no DST, so this is always false
```

## Which function do I actually need?

`disambiguation` shows up on more than one function, and they don't all behave the same way — this is the part people get tripped up on. Use this table to route to the right one:

| Your situation                                | Function                          | Real control?                  |
| --------------------------------------------- | --------------------------------- | ------------------------------ |
| Resolve a plain local time to an **instant**  | `resolveLocal`                    | **Yes, fully.**                |
| Attach a plain local time + timezone          | `convertPlainDateTimeToZoned`     | **Yes, fully.**                |
| Add/subtract a duration from a zoned datetime | `addZoned` / `subtractZoned`      | **Yes, where the date part lands.** |
| Jump to start/end of a boundary               | `startOfZoned` family             | **No — always real.**          |
| Set one or more fields directly               | `setZoned` / `setUnix`            | **Gaps; overlaps with `offset: "ignore"`.** |
| Cycle (wrap) a single field                   | `cycleZoned`                      | **Gaps; overlaps with `offset: "ignore"`.** |

- **`resolveLocal`** (`instant/convert/`, Story CORE-4) — same resolution as `convertPlainDateTimeToZoned` and the same full control, but it returns the UTC instant rather than a zoned string, and it is exact: `convertPlainDateTimeToZoned` truncates to milliseconds by default, so a nanosecond wall time survives one and not the other. `resolveLocal` also has no `offset` parameter, because (as below) that parameter is inert on this construction path anyway. Pair it with `classifyLocal` to branch before a policy applies.
- **`convertPlainDateTimeToZoned`** — every value (`earlier`/`later`/`reject`) changes the result, for both gaps and overlaps.
- **`addZoned` / `subtractZoned`** (and `intervalFromDurationZoned`) — the date part of the duration moves the wall clock, and `disambiguation` resolves that landing when it falls in a gap or an overlap; the time part is exact time and is never re-resolved. See below.
- **`startOfZoned` family** (`startOfZoned`, `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned`, and their `unix/` counterparts `startOfUnix`, `endOfUnix`, `startOfQuarterForUnix`, `endOfQuarterForUnix` — Story C3) — these always return the real boundary of the unit in the zone (a start is never after the input, an end never before it), so there is nothing to disambiguate. They follow TC39's `startOfDay()`, which takes no resolution options, so they take no `disambiguation` or `offset` options either. Earlier releases built the boundary as a wall-clock time via `.with()`, which could land after the input in a gap or on the other pass of an overlap.
- **`setZoned` / `setUnix`** (Story J1) — `.with()`-based: `offset` defaults to `"prefer"`, as Temporal's `ZonedDateTime#with` does, so `disambiguation` resolves a gap, and resolves a fall-back overlap only when you pass `offset: "ignore"` — **see "The `offset` parameter" below**. These take **caller-supplied** field values, so they also expose `overflow` — a caller-supplied `day: 31` can be out of range. `setUtc` takes only `overflow`: a UTC wall clock is never ambiguous and its offset is always `+00:00`, so it has no `disambiguation` or `offset` option (removed in 1.16.0).
- **`cycleZoned`** (Story E6) — same `.with()`-based rule as `setZoned`: `offset` defaults to `"prefer"`, so pass `offset: "ignore"` for `disambiguation` to choose in an overlap. `cycleZoned` computes its target field value with plain, DST-agnostic wrap bounds (e.g. `hour` always wraps `0–23`), then hands it to `setZoned` — so a cycled `hour` that lands in a gap or overlap is resolved by `disambiguation`/`offset` exactly the way any other field-set call is, rather than by deriving DST-aware wrap boundaries directly.

### Real-world scenarios

**"A user picks 2:30 AM on March 10th in a signup form, and I need to store it as a real instant."**
You have a _plain_ local time with no instant behind it yet — use `resolveLocal` if you want the instant back, or `convertPlainDateTimeToZoned` if you want the zoned string. That date/time might not exist (spring-forward gap), and `disambiguation` is your only lever to decide what happens: silently round forward (`"compatible"`/`"later"`), silently round back (`"earlier"`), or make it a hard validation error (`"reject"`) so the form can ask the user to pick a different time.

**"A subscription renews every 30 days from whenever it started, and I need the next renewal timestamp."**
You already have a `ZonedDateTime` (the last renewal) and you're moving it forward by a duration — use `addZoned`. `{ days: 30 }` moves the wall-clock date and keeps the wall-clock time, so `disambiguation` matters when that landing doesn't exist or happens twice. In a fall-back overlap (the 30-day cycle lands on `2024-11-03T01:30:00` in `America/New_York`) it picks the occurrence; in a spring-forward gap (it lands on `2024-03-10T02:30:00`) `"compatible"` and `"later"` move forward to `03:30`, `"earlier"` back to `01:30`. Pass `disambiguation: "reject"` to get `""` in either case and force a manual decision.

**"I need to reject any zoned arithmetic that lands on DST-ambiguous ground, no exceptions."**
Pass `disambiguation: "reject"` to `addZoned`/`subtractZoned`/`intervalFromDurationZoned`. It fires when the date part of the duration lands in a gap or an overlap. A time-only duration (`{ hours: 3 }`) is exact time — it never lands on a wall clock that needs resolving, so there is nothing to reject.

### How `addZoned`/`subtractZoned` apply it

`Temporal.ZonedDateTime.prototype.add()`/`.subtract()` don't accept a `disambiguation` option — they resolve the intermediate wall clock as `"compatible"`. GMT follows the same algorithm, TC39's [AddZonedDateTime](https://tc39.es/proposal-temporal/#sec-temporal-addzoneddatetime), and substitutes your `disambiguation` for that `"compatible"`:

1. The date part (years, months, weeks, days) is added to the wall-clock date; the wall-clock time is kept.
2. That date-time is resolved in the zone with your `disambiguation` — in a gap or an overlap alike, exactly as `convertPlainDateTimeToZoned` resolves it.
3. The time part (hours and smaller) is added in exact time, so `+ { minutes: 10 }` is always 10 real minutes.

```typescript
import { addZoned } from "@northguild/gmt/zoned";

// 2024-03-10T02:30 doesn't exist in America/New_York.
addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 });
// "2024-03-10T03:30:00-04:00[America/New_York]"  (default "compatible" == "later")

addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "earlier" });
// "2024-03-10T01:30:00-05:00[America/New_York]"

addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "reject" });
// ""
```

Before 1.16.0 a gap landing was always moved forward, whatever `disambiguation` said. Omit the option (or pass `"compatible"`) to keep that result.

### The `offset` parameter

`setZoned`/`setUnix` and `cycleZoned` construct their result via `Temporal.ZonedDateTime.prototype.with()`, not `.from()`. `.with()` has an option `convertPlainDateTimeToZoned`/`addZoned`/`subtractZoned` never need to think about, because they don't have it: **`offset`**, which controls what happens to the _existing_ offset already attached to the source `ZonedDateTime` when you change some of its fields. (The `startOfZoned` family no longer uses `.with()` for boundaries, so none of this applies to it.)

`offset` accepts four values, mirroring Temporal's own `OffsetDisambiguationOptions`:

| Value                                          | Behavior                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `"prefer"` (Temporal's and **GMT's default**)  | Keep the source's offset if it's still valid for the new fields; only fall back to `disambiguation` if it isn't.                                |
| `"use"`                                        | Always keep the source's offset, even if that produces a different real-world instant than the local time implies.                              |
| `"ignore"`                                     | Always discard the source's offset and recompute purely from time zone + local time — this is what makes `disambiguation` actually take effect. |
| `"reject"`                                     | Return `""` if the source's offset isn't valid for the new fields, regardless of `disambiguation`.                                              |

**Why this matters, concretely**: a field-setting function starts from an already-built `ZonedDateTime` — which already has a valid, resolved offset — and then changes some of its fields. For a same-day change, the source's offset is _almost always still valid_ for the new fields. With `offset: "prefer"` (Temporal's default), that means the source offset just gets kept — and `disambiguation` is never even consulted, because there was nothing ambiguous to resolve from Temporal's point of view. Passing `disambiguation` alone therefore gives byte-identical output across all four values on a fall-back overlap, until `offset: "ignore"` is also passed. In a gap the source offset cannot hold, so `disambiguation` applies under `"prefer"` too.

GMT follows Temporal and defaults `offset` to `"prefer"` on these functions (since 1.16.0; earlier releases defaulted to `"ignore"`). Changing a field keeps the value on the same side of a fall-back when it can. Pass `offset: "ignore"` when you want the new wall-clock time re-resolved through `disambiguation`:

```typescript
setZoned("2024-11-03T01:45:00-05:00[America/New_York]", { minute: 0 }, { disambiguation: "reject" });
// "2024-11-03T01:00:00-05:00[America/New_York]" — the source's -05:00 is still valid, so it is kept

setZoned("2024-11-03T01:45:00-05:00[America/New_York]", { minute: 0 }, { disambiguation: "reject", offset: "ignore" });
// "" — 01:00 is re-resolved, it is ambiguous, and "reject" fires
```

Boundary functions (`startOfZoned`, `endOfZoned`, the quarter and locale-week variants) are the exception: they follow TC39's `startOfDay()`, which takes no resolution options, and always return the real boundary. They take no `disambiguation`/`offset` options, and neither does `mapZonedHoursInDay`, which maps the input's calendar date exactly as TC39's `startOfDay()`/`hoursInDay` define it.

`convertPlainDateTimeToZoned`, `addZoned`/`subtractZoned` and `intervalFromDurationZoned` take no `offset` option (removed in 1.16.0, when it was inert): they always resolve a plain date-time with no offset attached, as Temporal's `PlainDateTime#toZonedDateTime` does, so there is no stored offset to prefer, use, ignore or reject. `disambiguation` alone controls them.

**Why not `overflow` too?** `Temporal.ZonedDateTime.prototype.with()` also accepts a third option, `overflow` (`"constrain" | "reject"`, controlling what happens when a field value like `day` or `month` is out of range). GMT exposes it only where the caller supplies the field values — `setZoned`/`setUnix`/`setUtc` — because a caller-supplied `day: 31` can be out of range. Functions that only ever set fixed, always-in-range literals have no use for it, so it is left off their API. Arithmetic defaults to TC39's `"constrain"` (29 February plus one year is 28 February); parsers use `"reject"`.

## Using it in GMT

`convertPlainDateTimeToZoned` (and, as the DST disambiguation work continues, other functions that produce a `ZonedDateTime` from a plain/local value) accepts an optional `disambiguation` option:

```typescript
import { convertPlainDateTimeToZoned } from "@northguild/gmt/zoned";

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
- `context/roadmap/index.md` (Story Group C) — the internal tracking doc for rolling `disambiguation` support out across the rest of GMT's zoned-producing functions. Archived on parity in `9e3b22d`; read it from git history.
