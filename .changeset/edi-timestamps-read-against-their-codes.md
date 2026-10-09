---
"@northguild/gmt": minor
---

Add 45 functions that read, write and check UN/EDIFACT `DTM`, X12 and GS1 EPCIS timestamps to the `intermodal/` namespace, and the `@northguild/gmt/intermodal/parse` and `@northguild/gmt/intermodal/validate` subpaths (Story INT-15). A `yy` token in `parseDateWithPattern` and `parseDateTimeWithPattern` now needs a century window from the caller: see **Breaking changes**.

Freight mostly does not send ISO 8601. It sends UN/EDIFACT `DTM` segments, X12 date and time elements, and GS1 EPCIS events. Some of those formats carry a UTC offset and some do not, and the only signal is a format code or a time code. So the functions are split by the kind of value a code states: a date, a time, a local date-time, a date-time with an offset, or a period. Each function takes only the codes of its kind, and each parser returns one value the rest of the library takes. A value with no offset comes back as a local time, never as UTC.

```typescript
import {
  classifyEdifactDtmFormat,
  classifyX12TimeCode,
  formatEdifactDatePeriod,
  formatEdifactOffsetDateTime,
  formatEpcisEvent,
  formatX12Date,
  formatX12Time,
  parseDateWithPattern,
  parseEdifactDate,
  parseEdifactDatePeriod,
  parseEdifactDateTime,
  parseEdifactOffsetDateTime,
  parseEpcisEvent,
  parseX12DateAndTime,
  parseX12DateRange,
  parseX12Time,
  resolveLocal,
  toOffsetInstant,
  x12TimeCodeOffset,
  x12TimeCodeZone,
} from "@northguild/gmt";

// UN/EDIFACT: a DTM value (data element 2380) and its format code (2379). One parser per kind of value.
parseEdifactDate("20240615", "102"); // "2024-06-15"
parseEdifactDateTime("202406151430", "203"); // "2024-06-15T14:30:00" (203 states no offset: a local time, not UTC)
parseEdifactOffsetDateTime("202406151430+0200", "205"); // "2024-06-15T14:30:00+02:00"
parseEdifactOffsetDateTime("202406151430+02", "303"); // "2024-06-15T14:30:00+02:00"
parseEdifactOffsetDateTime("202406151430UTC", "303"); // "2024-06-15T14:30:00+00:00"
parseEdifactOffsetDateTime("202406151430CET", "303"); // "" (an abbreviation names no offset)
parseEdifactDatePeriod("2024061520240620", "718"); // { start: "2024-06-15", end: "2024-06-20" }
toOffsetInstant("2024-06-15T14:30:00+02:00"); // { instant: "2024-06-15T12:30:00Z", offset: "+02:00" }

// Each formatter takes the value its parser returns, and cuts it to the code's mask.
formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", "205"); // "202406151430+0200"
formatEdifactOffsetDateTime("2024-06-15T14:30:45.9+02:00", "205"); // "202406151430+0200" (205 holds minutes)
formatEdifactOffsetDateTime("2024-06-15T14:30:00Z", "303"); // "202406151430+00"
formatEdifactDatePeriod("2024-06-15", "2024-06-20", "718"); // "2024061520240620"

// X12 freight: the date (element 373), time (337) and time code (623) of an AT7, G62 or DTM segment, in three calls.
const local = parseX12DateAndTime("20240615", "1430"); // "2024-06-15T14:30:00"
const offset = x12TimeCodeOffset("20"); // "-05:00"
resolveLocal(local, offset); // "2024-06-15T19:30:00Z"

// A lettered time code names a zone and states no offset. The caller maps the name to an IANA zone.
x12TimeCodeZone("ES"); // { zone: "Eastern", daylight: false }
x12TimeCodeZone("ET"); // { zone: "Eastern", daylight: null }
resolveLocal(local, "America/New_York"); // "2024-06-15T18:30:00Z"

// X12: a Date Time Period (element 1251) and its format qualifier (1250), as a DTP segment carries them.
parseX12DateRange("20240615-20240620", "RD8"); // { start: "2024-06-15", end: "2024-06-20" }
parseX12Time("14300012"); // "14:30:00.12" (element 337, no qualifier)
parseX12Time("143045", "TS"); // "14:30:45"
formatX12Date("2024-06-15", "D8"); // "20240615"
formatX12Time("14:30:45", "TS"); // "143045"

// A code that arrives as data is a plain string. Classify it, and testing `kind` narrows `format` with no cast.
const code: string = "203";
const classified = classifyEdifactDtmFormat(code); // { kind: "dateTime", format: "203" }
if (classified?.kind === "dateTime") {
  parseEdifactDateTime("202406151430", classified.format); // "2024-06-15T14:30:00"
}
classifyX12TimeCode("20"); // { kind: "offset", timeCode: "20" }
classifyX12TimeCode("ET"); // { kind: "zone", timeCode: "ET" }
classifyEdifactDtmFormat("101"); // null (a two-digit-year code: no function reads it)

// A two-digit year is read with the pattern parsers, in the hundred-year window the caller names.
parseDateWithPattern("240615", "yyMMdd", undefined, { yearWindow: 2000 }); // "2024-06-15"

// GS1 EPCIS 2.0: eventTime is the instant, eventTimeZoneOffset the offset where it happened.
parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" });
// { instant: "2024-06-15T23:30:00Z", offset: "+02:00", local: "2024-06-16T01:30:00" }
parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z" }); // null (no eventTimeZoneOffset)
formatEpcisEvent({ instant: "2024-06-15T23:30:00Z", offset: "+02:00" });
// { eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }
```

UN/EDIFACT: a `DTM` value (data element 2380) against its format code (data element 2379).

| Kind of value | Parser, formatter, validator | Codes | Value |
| --- | --- | --- | --- |
| Date | `parseEdifactDate`, `formatEdifactDate`, `isValidEdifactDate` | `102` | `"2024-06-15"` |
| Time | `parseEdifactTime`, `formatEdifactTime`, `isValidEdifactTime` | `401` `402` | `"14:30:00"` |
| Local date-time | `parseEdifactDateTime`, `formatEdifactDateTime`, `isValidEdifactDateTime` | `203` `204` | `"2024-06-15T14:30:00"` |
| Date-time with an offset | `parseEdifactOffsetDateTime`, `formatEdifactOffsetDateTime`, `isValidEdifactOffsetDateTime` | `205` `208` `303` `304` | `"2024-06-15T14:30:00+02:00"` |
| Period of dates | `parseEdifactDatePeriod`, `formatEdifactDatePeriod`, `isValidEdifactDatePeriod` | `718` | `{ start: "2024-06-15", end: "2024-06-20" }` |
| Period of local date-times | `parseEdifactDateTimePeriod`, `formatEdifactDateTimePeriod`, `isValidEdifactDateTimePeriod` | `719` | `{ start: "2024-06-15T08:00:00", end: "2024-06-20T17:00:00" }` |

X12: an element 1251 value against its 1250 format qualifier, the pair a `DTP` segment and `DTM-05`/`06` carry, in freight and in healthcare.

| Kind of value | Parser, formatter, validator | Codes | Value |
| --- | --- | --- | --- |
| Date | `parseX12Date`, `formatX12Date`, `isValidX12Date` | `D8` `DB` | `"2024-06-15"` |
| Time | `parseX12Time`, `formatX12Time`, `isValidX12Time` | `TM` `TS`, or element 337 with no qualifier | `"14:30:00"` |
| Local date-time | `parseX12DateTime`, `formatX12DateTime`, `isValidX12DateTime` | `DT` `RTS` | `"2024-06-15T14:30:00"` |
| Range of dates | `parseX12DateRange`, `formatX12DateRange`, `isValidX12DateRange` | `RD8` `RD` | `{ start: "2024-06-15", end: "2024-06-20" }` |
| Range of local date-times | `parseX12DateTimeRange`, `formatX12DateTimeRange`, `isValidX12DateTimeRange` | `RDT` `DTS` | `{ start: "2024-06-15T08:00:00", end: "2024-06-20T17:00:00" }` |

The other functions:

- **`parseX12DateAndTime(date, time)`** reads X12 elements 373 and 337, the date and time that `AT7`, `G62` and `DTM-02`/`03` carry side by side, as one local date-time. Both are required.
- **`x12TimeCodeOffset(timeCode)`** reads the 31 element 623 time codes that state an offset: `01` to `29`, `UT` and `GM`. The codes `13` to `24` count down: `13` is `-12:00` and `24` is `-01:00`.
- **`x12TimeCodeZone(timeCode)`** reads the 25 time codes that name a zone, and returns `{ zone, daylight }`. `daylight` is `true`, `false`, or `null` when the code says neither.
- **`classifyEdifactDtmFormat`, `classifyX12DateTimePeriodFormat` and `classifyX12TimeCode`** take a code as a plain string and return it with its kind, `{ kind, format }` or `{ kind, timeCode }`, or `null` for a code no function reads. `isValidEdifactDtmFormat`, `isValidX12DateTimePeriodFormat` and `isValidX12TimeCode` check a code alone.
- **`parseEpcisEvent(event)`** reads the two required time fields of a GS1 EPCIS 2.0 event, `eventTime` and `eventTimeZoneOffset`, and returns `{ instant, offset, local }`. `formatEpcisEvent` writes the pair back with `eventTime` in UTC, and `isValidEpcisEvent` checks one. The `epcisEventTime` and `epcisTimeZoneOffset` patterns are the two grammars GS1 publishes.
- **Each value validator** takes its parser's arguments and is true exactly when the parser returns a value.

What the types settle, and what they cannot:

- **A function reads every code its `format` type accepts.** `parseEdifactDate(value, "203")` does not compile: `203` is a date-time code. No EDI function takes options.
- **A parser returns one value, the same for every code of its kind.** A date is `YYYY-MM-DD`. A time and a local date-time always carry seconds. A date-time with an offset is the wall clock as written with its offset, the string `toOffsetInstant` reads. A period is `{ start, end }`. An invalid value returns `""`, or `null` for a period.
- **What still returns the sentinel is a fact about the value.** A value that does not fit its code's mask, or names a day or an hour that does not exist. Under `303` and `304`, zone characters that are not a signed hour, `UTC` or `GMT`. A period or range whose end is before its start. In a formatter, a year outside 0000–9999, or an offset the code cannot hold.

What the functions never guess:

- **An offsetless value never becomes UTC.** UN/EDIFACT `203` and `204`, an X12 date and time, and every X12 1250 code state no offset. The result is a local date-time. Pass it and the place's IANA zone to `resolveLocal`. GMT maps no place to a zone.
- **A named X12 time code is a zone name, not an offset.** `ES` returns the name `Eastern` and `daylight: false`. X12 states no offset for a named zone, so the caller maps the name to an IANA zone. `x12TimeCodeOffset` returns `""` for such a code, and `x12TimeCodeZone` returns `null` for an offset code.
- **A UN/EDIFACT zone abbreviation is not an offset.** The three zone characters of `303` and `304` are read when they are a signed hour (`+02`), `UTC` or `GMT`. Letters such as `CET` return `""`: no UN/EDIFACT text defines them. Where a partner sends one, remove the letters, read the rest with `parseEdifactDateTime` under `203` or `204`, and resolve it in the zone you map the letters to.
- **A formatter cuts a time to the mask and never rounds it.** A fraction of a second is always dropped, and a minute-precision code drops the seconds too. An offset is never cut: `+05:30` under `303` or `304` returns `""`, because the field holds whole hours. Write it under `205` or `208`.

Codes that are not read:

- **The two-digit-year codes**: UN/EDIFACT `101`, `201`, `202`, `206`, `207`, `301`, `302`, `713` and `717`, and X12 `D6`, `TT`, `TR`, `RD6` and `TU`. Neither standard says which century `YY` belongs to. Read one with `parseDateWithPattern` or `parseDateTimeWithPattern`, a `yy` pattern and `yearWindow`: `yyMMdd` for `101` and `D6`, `yyMMddHHmm` for `201`, `yyMMddHHmmss` for `202`, `MMddyy` for `TT`, `ddMMyyHHmm` for `TR`. Split a period (`713`, `717`, `RD6`) and read each half. No function writes a two-digit year.
- **The codes that state no single date, time or date-time**: UN/EDIFACT `209` and `404` (a time with an offset and no date) and `406` (an offset alone), and X12 `TC` and `EH` (a day of the year with no whole year), `DDT` and `DTD` (a date on one side of a range and a date-time on the other), `RTM` (a range of times with no date) and `UN` (unstructured).
- **Every other code of the two elements.** GMT reads 11 UN/EDIFACT format codes, 10 X12 format qualifiers and all 56 X12 time codes.

Wire details:

- **A UN/EDIFACT period has no hyphen, and an X12 range has one.** `2024061520240620` is a `718` period and `20240615-20240620` is an `RD8` range. Each parser reads only its own form.
- **The UN/EDIFACT release character is the caller's.** An interchange transmits `+02` as `?+02`. The parsers take the unescaped value and the formatters return it.
- **An X12 time with no qualifier may carry tenths or hundredths of a second.** `parseX12Time` and `parseX12DateAndTime` read them. No 1250 code holds them, so `formatX12Time` does not write them.
- **EPCIS requires both fields, and they are independent.** A missing `eventTimeZoneOffset`, `Z` and `+0200` return `null`. An offset written inside `eventTime` need not match the offset field.
- X12 is a United States standard. Its code lists were read through an X12-licensed dictionary.
- Also exported: a type for each kind's codes (`EdifactDateFormat`, `EdifactTimeFormat`, `EdifactDateTimeFormat`, `EdifactOffsetDateTimeFormat`, `EdifactDatePeriodFormat`, `EdifactDateTimePeriodFormat`, `X12DateFormat`, `X12TimeFormat`, `X12DateTimeFormat`, `X12DateRangeFormat`, `X12DateTimeRangeFormat`, `X12OffsetTimeCode`, `X12ZoneTimeCode`), the unions `EdifactDtmFormat`, `X12DateTimePeriodFormat` and `X12TimeCode`, and the `EdifactDtmFormatClass`, `X12DateTimePeriodFormatClass`, `X12TimeCodeClass`, `X12NamedZone`, `EdiDatePeriod`, `EdiDateTimePeriod`, `EpcisEventTime`, `EpcisInstant` and `TwoDigitYearOptions` types.

### Breaking changes

`parseDateWithPattern` and `parseDateTimeWithPattern` take a fourth parameter, `options?: TwoDigitYearOptions`. A pattern with a `yy` token now returns `""` unless `options.yearWindow` is given. 1.18 read `yy` in a window fixed in the library, 1969 to 2068.

| Call | 1.18 | 1.19 |
| --- | --- | --- |
| `parseDateWithPattern("03/15/24", "MM/dd/yy")` | `"2024-03-15"` | `""` |
| `parseDateWithPattern("03/15/69", "MM/dd/yy")` | `"1969-03-15"` | `""` |
| `parseDateWithPattern("Mar 15, '24", "MMM d, ''yy")` | `"2024-03-15"` | `""` |
| `parseDateTimeWithPattern("03/15/24 14:30", "MM/dd/yy HH:mm")` | `"2024-03-15T14:30:00"` | `""` |

The same calls with a window:

```typescript
import { parseDateTimeWithPattern, parseDateWithPattern } from "@northguild/gmt";

// A year is the first year of a fixed hundred-year window. 1969 is the 1.18 window exactly.
parseDateWithPattern("03/15/24", "MM/dd/yy", undefined, { yearWindow: 1969 }); // "2024-03-15"
parseDateWithPattern("03/15/69", "MM/dd/yy", undefined, { yearWindow: 1969 }); // "1969-03-15"
parseDateWithPattern("03/15/68", "MM/dd/yy", undefined, { yearWindow: 1969 }); // "2068-03-15"
parseDateTimeWithPattern("03/15/24 14:30", "MM/dd/yy HH:mm", undefined, { yearWindow: 1969 }); // "2024-03-15T14:30:00"

// "rolling" is the hundred years around today.
parseDateWithPattern("03/15/24", "MM/dd/yy", undefined, { yearWindow: "rolling" }); // "2024-03-15" (while the current UTC year is 1975–2074)
```

Why: no standard says which century a two-digit year belongs to. A cut-off built into the library is right today and wrong later, and the caller is the one who knows whether the data is live or stored. So the caller states the window.

Unchanged: a pattern with no `yy` reads exactly as before, and never reads the option or the clock. `parseTimeWithPattern` has no year token and takes no options. `parseRfc2822` and `parseHttp` keep the two-digit-year rules that RFC 5322 and RFC 9110 give for their own formats.

Migration:

- **To keep the 1.18 result, pass `{ yearWindow: 1969 }`.** It reads `69`–`99` as 1969–1999 and `00`–`68` as 2000–2068, as 1.18 did. A fixed window gives the same answer in any year, so it is the form for stored data. Choose another start year when the data calls for one: `{ yearWindow: 2000 }` reads `00`–`99` as 2000–2099.
- **For live data, pass `{ yearWindow: "rolling" }`.** It runs from 50 years before the current UTC year to 49 years after: 1976 to 2075 during 2026. It never needs maintenance. It reads the same stored value differently as years pass, so do not use it for stored data.
- **`options` is the fourth parameter.** The third is `locale`; pass `undefined` there to keep the default, `"en-US"`.
- **With a `yy` pattern, any other `yearWindow` returns `""`**: a value that is neither `"rolling"` nor an integer from 0 to 9900.
- **Where the source can send a four-digit year, ask for it.** A `yyyy` pattern needs no window.
