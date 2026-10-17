---
name: gmt-intermodal
description: >
  Intermodal container and freight timing in @northguild/gmt/intermodal — free
  time and demurrage (freeTimeExpiry, chargeableDays, demurrageClock), billing
  deadlines (billingTimeline), bill of lading dates and multimodalETA
  (bolTimestamp), and EDI and event timestamps: UN/EDIFACT DTM, X12 date, time
  and time code readers and writers (parseEdifact*, parseX12*,
  parseX12DateAndTime, x12TimeCodeOffset), EPCIS events (parseEpcisEvent).
  Every tariff term is the caller's. Reads the docs site (llms.txt) and the
  installed package's JSDoc; a routing pointer.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/intermodal-bill-of-lading-and-eta.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/intermodal-billing-deadlines.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/intermodal-edi-timestamps.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/intermodal-free-time-and-demurrage.mdx'
  - 'northguild/gmt:packages/gmt/src/intermodal/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/edi.ts'
  - 'northguild/gmt:packages/gmt/src/types/epcis.ts'
  - 'northguild/gmt:packages/gmt/src/types/two-digit-year.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.20.0'
---

# GMT Intermodal

Use this skill when the task is container free time and demurrage, billing
deadlines, bill of lading dates, a multimodal ETA, or reading and writing EDI
and EPCIS timestamps. The time zone rules it builds on are in the
`gmt-timezone` skill; leg timing is in the `gmt-transport` skill.

## When to load

- The user is working out when a container's free time ends, how many days of
  demurrage or detention are chargeable and for which dates, or which events a
  charge's clock runs between.
- The user is reading or writing a UN/EDIFACT `DTM` value, an X12 date, time,
  time code or date time period, or a GS1 EPCIS event time, and must know
  whether its offset was stated.

## Core rules

1. **Free time is counted in the terminal's local days; the start day and the
    basis are tariff terms, never defaults.**
    `freeTimeExpiry(clockStart, freeDays, { basis, timeZone, firstDay, calendar? })`
    returns `{ freeTimeStart, lastFreeDay, expiresAt }`: local dates in
    `timeZone`, and the first instant of the day after the last free day.
    `firstDay` (`"eventDay"` | `"nextDay"`) has no default because the two
    differ by a day of charges; `basis: "working"` needs a `BusinessCalendar`
    and returns `null` without one. `chargeableDays(clockStart, clockEnd,
    freeDays, options)` also needs `chargeBasis` (no default): many tariffs
    count both in calendar days; where a tariff grants free time in working
    days the days after it are mostly charged as calendar days, and some
    tariffs charge working days only. It counts the days on or after
    `expiresAt` the half-open dwell touched, lists them as `chargedDates`, and
    splits them into `tiers` bands; `freeDays: 0` is allowed there.
    `demurrageClock(events, scope, { direction, startEvent? })` selects the
    events per leg: import demurrage and storage run discharge (or
    availability) to gate-out, detention gate-out to empty return; export
    demurrage gate-in to loaded, detention empty release to gate-in; `combined`
    runs both as one period. No standard fixes how these days are counted;
    every term is the tariff's.
2. **Billing deadlines are dates counted from an anchor, and every window is
    the caller's.** `billingTimeline({ anchorOn, invoiceIssuedOn?,
    requestReceivedOn? }, { issueDays, disputeDays, resolutionDays,
    agreedResolutionOn? })` returns `{ invoiceDeadline, issuedByDeadline,
    disputeDeadline, requestedByDeadline, resolutionDeadline }`. Day zero is
    the anchor and each deadline is `date + days` on the ISO calendar; a date
    is by the deadline when it is on or before it. No window has a default (a
    missing one returns `null`); fields whose input does not exist yet are
    `null`, so an anchor alone is a forecast. The anchor is whatever date the
    caller counts from: the last charged date
    (`chargedDates.at(-1)`), or for a re-bill the issuance date of the invoice
    received. Reduce an instant to the billing party's local date first with
    `convertUtcToPlainDate(instant, { timeZone })`. A request before its
    invoice, or an agreed date before the request, returns `null`. GMT
    computes dates, not liability.
3. **A B/L date is a local date; a multimodal ETA keeps transit and dwell
    apart.** `bolTimestamp(value, event, { timeZone })` returns the
    `YYYY-MM-DD` date on the local clock in `timeZone` at the instant `value`:
    DCSA Bill of Lading 3.0 types `issueDate`, `receivedForShipmentDate` and
    `shippedOnBoardDate` as dates with no time or offset. `event` is
    `"issue" | "received" | "shippedOnBoard"`, one per DCSA date field; all
    three render the same way and anything else is `""`. `timeZone` is
    required (no UTC default): the place of issue for `issue`, the loading
    terminal for `received` and `shippedOnBoard`. 21:00 in New York
    is 01:00Z the next day, so the UTC date is wrong. Only the instant is read;
    a zoneless value is `""`. `multimodalETA(legs, { startTimeZone? })` takes
    `scheduleDelivery`'s `Leg[]` and returns `{ eta, totalLegs, totalTransit,
    totalDwell }`: transit is the legs' durations added up, dwell the time
    actually spent at handoffs (a wait for a scheduled departure included; the
    last leg's `dwellAfter` excluded), both with hours as the largest unit, and
    they sum to the elapsed time. Every `scheduleDelivery` rule applies, so a
    missed connection is `null`. An empty array is `{ eta: "", totalLegs: 0,
    totalTransit: "PT0S", totalDwell: "PT0S" }`. Dwell is never estimated.
4. **An EDI timestamp is read by the function for its kind of value, and
    nothing the code does not state is guessed.** Each kind has a `parse…`,
    `format…` and `isValid…` function named for it (`parseEdifactDate`,
    `formatEdifactDate`, `isValidEdifactDate`), and `format` is typed to that
    kind's codes. UN/EDIFACT `DTM` (value 2380 against format code 2379):
    `EdifactDate` (`102`), `EdifactTime` (`401`, `402`), `EdifactDateTime`
    (`203`, `204`), `EdifactOffsetDateTime` (`205`, `208`, `303`, `304`),
    `EdifactDatePeriod` (`718`), `EdifactDateTimePeriod` (`719`). X12 (element
    1251 against qualifier 1250, in `DTP` and `DTM-05`/`06`): `X12Date` (`D8`,
    `DB`), `X12Time` (`TM`, `TS`), `X12DateTime` (`DT`, `RTS`), `X12DateRange`
    (`RD8`, `RD`), `X12DateTimeRange` (`RDT`, `DTS`). `parseX12Time(value)`
    with no `format` reads element 337, tenths and hundredths included
    (`"14300012"` is `"14:30:00.12"`), and `formatX12TimeElement(value, form)`
    writes it in the mask named: `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`
    (`"14:30:00"` under `HHMMSSDD` is `"14300000"`). A parser returns one value:
    `"2024-06-15"`, `"14:30:00"`, `"2024-06-15T14:30:00"`,
    `"2024-06-15T14:30:00+02:00"` (the string `toOffsetInstant` reads), or
    `{ start, end }` for a period or range. The sentinel is `""`, or `null`
    for a period, a range, a zone or a classifier. A period formatter takes
    `(start, end, format)`. No EDI function takes options. X12 freight is
    three calls: `parseX12DateAndTime("20240615", "1430")` is
    `"2024-06-15T14:30:00"` (elements 373 and 337 of `AT7`, `G62` or `DTM`,
    both required), `x12TimeCodeOffset("20")` is `"-05:00"`, and
    `resolveLocal(local, offset)` is `"2024-06-15T19:30:00Z"`. For a code
    held as a plain string, `classifyEdifactDtmFormat`,
    `classifyX12DateTimePeriodFormat` and `classifyX12TimeCode` return
    `{ kind, format }` or `{ kind, timeCode }`, or `null` for a code no
    function reads; testing `kind` narrows the code with no cast.
    `parseEpcisEvent({ eventTime, eventTimeZoneOffset })` returns
    `{ instant, offset, local }`; both fields are required and need not
    agree. Five no-guess rules. (a) An offsetless value never becomes UTC:
    `203`, `204`, `DT`, `RTS` and `parseX12DateAndTime` return a local
    date-time; pass it and an IANA zone to `resolveLocal`. (b) A named X12
    time code is a zone name, not an offset: `x12TimeCodeZone("ES")` is
    `{ zone: "Eastern", daylight: false }` and `ET` has `daylight: null`,
    while `x12TimeCodeOffset` reads `01`–`29`, `UT` and `GM`, and `13`–`24`
    count down (`13` is `-12:00`). Each returns its sentinel for the other's
    codes. (c) The `ZZZ` of `303` and `304` is an offset only: `+02`, `UTC`
    and `GMT` are read, and letters such as `CET` return `""`. (d) A
    two-digit year is not read by any EDI function: `101`, `201`, `202`,
    `206`, `207`, `301`, `302`, `713`, `717`, `D6`, `TT`, `TR`, `RD6` and
    `TU`. Read one with `parseDateWithPattern` or `parseDateTimeWithPattern`,
    a `yy` pattern and `{ yearWindow }`: a start year such as `2000` (a fixed
    window, for stored data) or `"rolling"` (50 years before the current UTC
    year to 49 after). Without `yearWindow` a `yy` pattern returns `""`. (e)
    `209`, `404`, `406`, `TC`, `EH`, `DDT`, `DTD`, `RTM` and `UN` are not
    read: none states one date, time or date-time. A UN/EDIFACT period has no
    hyphen (`2024061520240620` under `718`) and an X12 range has one
    (`20240615-20240620` under `RD8`); a reversed one returns the sentinel.
    Pass a UN/EDIFACT parser the unescaped value (`+02`, not `?+02`). A
    formatter cuts seconds and fractions to its mask and never rounds.
    It writes `ZZZ` as `±HH`, and `+05:30` under `303` or `304` returns `""`:
    use `205` or `208`. Each value validator is true exactly when its parser
    returns a value (`isValidX12DateAndTime(date, time)` for the freight
    pair), and `isValidEdifactDtmFormat`, `isValidX12DateTimePeriodFormat`
    and `isValidX12TimeCode` check a code alone. `isValidEpcisEvent` is
    `isValidEpcisEventTime` and `isValidEpcisTimeZoneOffset` together: the
    `epcisEventTime` regex matches `2024-02-30`, the validator does not.
5. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://gmt-dox.northguild.workers.dev/llms.txt`, and each page
   has a `.md` twin that holds its text. The JSDoc ships in the installed
   package: `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **Free time and demurrage**: `freeTimeExpiry`, `chargeableDays`,
  `demurrageClock`
- **Billing deadlines**: `billingTimeline`
- **Bill of lading dates and multimodal ETA**: `bolTimestamp`, `multimodalETA`
- **EDI and event timestamps**: `parseEdifactDate`, `parseEdifactTime`,
  `parseEdifactDateTime`, `parseEdifactOffsetDateTime`,
  `parseEdifactDatePeriod`, `parseEdifactDateTimePeriod`, `parseX12Date`,
  `parseX12Time`, `parseX12DateTime`, `parseX12DateRange`,
  `parseX12DateTimeRange`, `parseX12DateAndTime`, `x12TimeCodeOffset`,
  `x12TimeCodeZone`, `classifyEdifactDtmFormat`,
  `classifyX12DateTimePeriodFormat`, `classifyX12TimeCode`,
  `parseEpcisEvent`; a `format…` and an `isValid…` for each `parseEdifact…`
  kind, for `X12Date`, `X12Time`, `X12DateTime`, `X12DateRange` and
  `X12DateTimeRange`, and for `EpcisEvent`; `formatX12TimeElement`,
  `isValidX12DateAndTime`, `isValidEpcisEventTime`,
  `isValidEpcisTimeZoneOffset`, `isValidEdifactDtmFormat`,
  `isValidX12DateTimePeriodFormat`, `isValidX12TimeCode`

## References

- [intermodal reference](https://gmt-dox.northguild.workers.dev/reference/intermodal/)
- [Docs map for agents (llms.txt)](https://gmt-dox.northguild.workers.dev/llms.txt)
- [GMT Timezone skill](../gmt-timezone/SKILL.md)
- [GMT Transport skill](../gmt-transport/SKILL.md)
