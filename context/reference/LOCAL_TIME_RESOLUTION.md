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

A string that already carries an offset or a bracketed zone has no ambiguity left to report:
both functions reject it rather than discarding the resolution it already had.

## The instant-plus-offset pair

Where a value must survive rendering back into the local time the event was seen in, an instant
alone is not enough and neither is a zone: the pair is `{ instant, offset }`, with `timeZone`
optional because most feeds do not send it. Neither field derives from the other — the instant
orders events globally, the offset renders them as the human on the ground saw them.

This shape is what the interchange standards actually require:

| Standard           | Instant field            | Offset field                                             |
| ------------------ | ------------------------ | -------------------------------------------------------- |
| GS1 EPCIS 2.0      | `eventTime` (UTC)        | `eventTimeZoneOffset` — required                          |
| DCSA Track & Trace | `eventDateTime`          | Carried in the timestamp, with an `eventClassifierCode`  |
| UN/EDIFACT DTM     | Qualifier `102` / `203`  | Qualifier `303` / `304` (`CCYYMMDDHHMMZZZ`)              |
| DICOM              | `DT` value               | `&ZZXX` suffix                                            |

Sources: [OpenEPCIS](https://openepcis.io/docs/epcis/),
[UNECE DTM](https://service.unece.org/trade/untdid/d03a/trsd/trsddtm.htm),
[DCSA](https://dcsa.org/standards/track-and-trace/standard-documentation-track-and-trace).
