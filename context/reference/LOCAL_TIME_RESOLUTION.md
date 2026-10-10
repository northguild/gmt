# Local Time Resolution — the disambiguation vocabulary

A zoneless wall time ("gate-out 08:00") is not an instant. Turning one into an instant needs a
zone the sender did not send, plus a policy for the two days a year the mapping is not
one-to-one. This file is the vocabulary GMT uses for both, and the rule that binds every
function taking a local wall time.

Ambiguous and nonexistent wall times are the single most common datetime bug there is. 01:30
happens twice on a fall-back day and never on a spring-forward one.

## Classification — what a wall time turns out to be

`classifyLocal(localDateTime, timeZone)` reports this **before** any policy resolves it, so
code can refuse rather than guess. It returns `null` on invalid input, never `"unique"`, which
would read as a verdict.

| Member          | Meaning                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| `unique`        | One instant. The ordinary case, and every case in a zone with no DST.                        |
| `ambiguous`     | Two instants an offset shift apart — a fall-back hour the clock ran through twice.           |
| `nonexistent`   | No instant. A spring-forward hour the clock skipped, or a calendar day a zone deleted crossing the date line. |

## Policy — which instant a resolution picks

`resolveLocal(localDateTime, timeZone, { disambiguation })` takes the four values Temporal
takes. The default is `"compatible"`, matching Temporal.

| Policy         | Ambiguous wall time | Nonexistent wall time |
| -------------- | ------------------- | --------------------- |
| `"compatible"` | The **earlier** instant | The **later** instant |
| `"earlier"`    | The earlier instant | The instant before the gap |
| `"later"`      | The later instant   | The instant after the gap |
| `"reject"`     | Returns the sentinel, resolving nothing | Returns the sentinel |

`"reject"` returns `""` rather than throwing, per the sentinel contract. It is the right choice
for anything where a silently wrong hour is expensive — a demurrage clock, a medication window,
a duty limit.

## The binding rule

**Every function that accepts a local wall time routes through `resolveLocal` and states its
disambiguation policy in its JSDoc, in this vocabulary.** Ambiguous and nonexistent wall times
are never resolved silently. This is a Definition of Done item, not a style preference.

Two corollaries:

- **An offset is not a zone.** `-05:00` does not identify `America/New_York`. Store the zone for
  anything scheduled in the future; store the offset for anything that already happened.
- **A stored offset is a complete rule for local time.** `timeZone` is a time zone identifier
  (an IANA name, or an offset to the minute such as `+05:30`, `+0530` or `-08`) or a stored
  offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns), so
  `resolveLocal(local, getTimeZoneOffset(zone, at))` is the instant the zone gives. A fixed
  offset has no transition: `classifyLocal` returns `"unique"`, `disambiguation` has nothing to
  decide and `"reject"` does not reject.
- **Boundary functions take no disambiguation option at all.** `startOf*`/`endOf*` and
  everything built on them return the real boundary and ignore the option — see
  [coding-standards § Calendar & zone semantics](../coding-standards.md#calendar--zone-semantics),
  which is the decision of record. The option belongs to field-setting functions only, the same
  split TC39 draws.

## Canonical cases

Use these when testing or reviewing a local-to-instant conversion. They cover an hour shift, a
30-minute shift, a 45-minute-offset zone and a deleted calendar day.

| Wall time             | Zone                  | Classification | Why                                       |
| --------------------- | --------------------- | -------------- | ----------------------------------------- |
| `2024-07-15T12:00:00` | `America/New_York`    | `unique`       | Ordinary summer date                      |
| `2024-11-03T01:30:00` | `America/New_York`    | `ambiguous`    | Fall-back overlap                         |
| `2024-03-10T02:30:00` | `America/New_York`    | `nonexistent`  | Spring-forward gap                        |
| `2024-04-07T01:45:00` | `Australia/Lord_Howe` | `ambiguous`    | A 30-minute overlap                       |
| `2024-09-29T03:15:00` | `Pacific/Chatham`     | `nonexistent`  | A 45-minute-offset zone's gap             |
| `2011-12-30T12:00:00` | `Pacific/Apia`        | `nonexistent`  | The day Samoa skipped crossing the date line |
| `2024-11-03T01:30:00` | `UTC`                 | `unique`       | UTC has no transitions                    |
| `1970-01-01T12:00:00` | `-00:44:30`           | `unique`       | A stored offset with seconds; a fixed offset has no transitions |

A string that already carries an offset or a bracketed zone has no ambiguity left to report:
both functions reject it rather than discarding the resolution it already had.

## The instant-plus-offset pair

Where a value must survive rendering back into the local time the event was seen in, an instant
alone is not enough and neither is a zone: the pair is `{ instant, offset }`, with `timeZone`
optional because most feeds do not send it. Neither field derives from the other — the instant
orders events globally, the offset renders them as the human on the ground saw them.

`offset` is `±HH:MM`, or `±HH:MM:SS` where the zone was not on a whole minute
(`Africa/Monrovia` stood at `-00:44:30` until 1972). An offset with seconds is not a time zone
identifier: `isValidTimeZone` rejects it and `isValidUtcOffset` accepts it. Which functions take
it in the time zone position follows from the result:

| The function's result | Its time zone position takes | An offset with seconds |
| --- | --- | --- |
| Has no zone in it: an instant, a plain value, a number, a boolean | Anything `isValidTimeZone` or `isValidUtcOffset` accepts, read by `internal/zoneFrame` | Read exactly |
| Carries the zone: a zoned string, a `BusinessCalendar` | A time zone identifier only (`isValidTimeZone`) | Returns the sentinel. A written zone cannot carry seconds (RFC 9557 §4.1) |
| Is text from `Intl.DateTimeFormat` | A time zone identifier only | Returns the sentinel. `Intl.DateTimeFormat` takes an offset to the minute (ECMA-262 `IsTimeZoneOffsetString`) |

`internal/zoneFrame` places an offset with seconds on its whole-minute zone (`-00:44:30` on
`-00:44`) and carries the seconds as a shift. So with an offset with seconds, a function that
does arithmetic returns its sentinel within the offset's seconds (under a minute) of one end of
the instant range: the last instant for an offset east of UTC, the first for one west. Each such
function states the limit in its JSDoc. A function that only reads a value has no limit, and
neither have `resolveLocal`, `classifyLocal`, `toOffsetInstant`, `getTimeZoneOffset` and
`isBetweenUnix`.

This shape is what the interchange standards actually require:

| Standard           | Instant field            | Offset field                                             |
| ------------------ | ------------------------ | -------------------------------------------------------- |
| GS1 EPCIS 2.0      | `eventTime` (UTC)        | `eventTimeZoneOffset` — required                          |
| DCSA Track & Trace | `eventDateTime`          | Carried in the timestamp, with an `eventClassifierCode`  |
| UN/EDIFACT DTM     | The 2380 value under format codes `205`–`208`, or `301`–`304` when the zone is `±HH`, `UTC` or `GMT` | In the same value: `ZHHMM`, or `ZZZ`. Codes `102` and `203` carry none and name no instant |
| DICOM              | `DT` value               | `&ZZXX` suffix                                            |

Sources: [OpenEPCIS](https://openepcis.io/docs/epcis/),
[UNECE DTM](https://service.unece.org/trade/untdid/d03a/trsd/trsddtm.htm),
[DCSA](https://dcsa.org/standards/track-and-trace/standard-documentation-track-and-trace).
