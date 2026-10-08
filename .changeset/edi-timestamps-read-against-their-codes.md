---
"@northguild/gmt": minor
---

Add parsers, formatters and validators for UN/EDIFACT `DTM`, X12 and GS1 EPCIS timestamps to the `intermodal/` namespace, and the `@northguild/gmt/intermodal/parse` and `@northguild/gmt/intermodal/validate` subpaths (Story INT-15). A `yy` token in `parseDateWithPattern` and `parseDateTimeWithPattern` now needs a century window from the caller: see **Breaking changes**.

Freight mostly does not send ISO 8601. It sends UN/EDIFACT `DTM` segments, X12 date and time elements, and GS1 EPCIS events. Some of those formats carry a UTC offset and some do not, and the only signal is a format code or a time code. Each parser reads a value against its code and returns only what the code states. A value with no offset comes back as a local time, never as UTC.

```typescript
import {
  formatEdifactDtm,
  formatEpcisEvent,
  formatX12DateTimePeriod,
  isValidEdifactDtm,
  isValidEdifactDtmFormat,
  parseEdifactDtm,
  parseEpcisEvent,
  parseX12DateTime,
  parseX12DateTimePeriod,
  resolveLocal,
  x12TimeCode,
} from "@northguild/gmt";

// UN/EDIFACT: a DTM value (data element 2380) read against its format code (2379).
parseEdifactDtm("202406151430", "203"); // { local: "2024-06-15T14:30:00" } (203 states no offset: a local time, not UTC)
parseEdifactDtm("202406151430+0200", "205"); // { local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }
parseEdifactDtm("202406151430+02", "303"); // { local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }
parseEdifactDtm("202406151430CET", "303"); // { local: "2024-06-15T14:30:00", zone: "CET" } (zone text, not an offset)
parseEdifactDtm("2024061520240620", "718"); // { date: "2024-06-15", periodEnd: { date: "2024-06-20" } }
formatEdifactDtm("2024-06-15T14:30:00+02:00", "205"); // "202406151430+0200"
formatEdifactDtm("2024-06-15T14:30:00", "303"); // "" (a local time has no offset to write)
isValidEdifactDtm("202406151430", "204"); // false (a 204 value carries seconds)
isValidEdifactDtmFormat("602"); // false (GMT does not read code 602)

// X12: the date (element 373), time (337) and time code (623) of an AT7, G62 or DTM segment.
parseX12DateTime("20240615", "1430", "20");
// { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", offset: "-05:00", instant: "2024-06-15T19:30:00Z" }
parseX12DateTime("20240615", "1430", "ET");
// { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00", zone: "Eastern", daylight: null }
parseX12DateTime("20240615", "1430");
// { date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00" }
x12TimeCode("ES"); // { zone: "Eastern", daylight: false }
x12TimeCode("13"); // { offset: "-12:00" }

// X12: a Date Time Period (element 1251) against its format qualifier (1250), as a DTP segment carries it.
parseX12DateTimePeriod("20240615-20240620", "RD8"); // { date: "2024-06-15", periodEnd: { date: "2024-06-20" } }
parseX12DateTimePeriod("2200-0600", "RTM"); // { time: "22:00:00", periodEnd: { time: "06:00:00" } }
formatX12DateTimePeriod("2024-06-15", "D8"); // "20240615"

// A two-digit year needs the hundred-year window the caller names.
parseEdifactDtm("240615", "101"); // null
parseEdifactDtm("240615", "101", { yearWindow: 2000 }); // { date: "2024-06-15" }
parseEdifactDtm("990615", "101", { yearWindow: 1950 }); // { date: "1999-06-15" }

// GS1 EPCIS 2.0: eventTime is the instant, eventTimeZoneOffset the offset where it happened.
parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" });
// { instant: "2024-06-15T23:30:00Z", offset: "+02:00", local: "2024-06-16T01:30:00" }
parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z" }); // null (no eventTimeZoneOffset)
formatEpcisEvent({ instant: "2024-06-15T23:30:00Z", offset: "+02:00" });
// { eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }

// An offsetless local time becomes an instant only when the caller names the zone.
resolveLocal("2024-06-15T14:30:00", "America/New_York"); // "2024-06-15T18:30:00Z"
```

What each function reads or writes:

- **`parseEdifactDtm(value, formatQualifier, options?)`** reads a UN/EDIFACT `DTM` value (data element 2380) against its format code (data element 2379). It reads 23 codes: dates, times, date-times with and without an offset, and periods. `formatEdifactDtm` writes a value from an ISO 8601 string, and takes a period as `<start>/<end>`. `isValidEdifactDtm` checks a value against a code, and `isValidEdifactDtmFormat` checks the code alone.
- **`parseX12DateTime(date?, time?, timeCode?)`** reads X12 elements 373, 337 and 623: the date, time and time code that `AT7`, `G62` and `DTM-02`/`03`/`04` carry side by side. An element that was not sent is `""` or left out. A date alone and a time alone are both read. `isValidX12DateTime` checks the three together.
- **`x12TimeCode(timeCode)`** reads an element 623 time code alone. It returns `{ offset }` for the codes `01` to `29`, `UT` and `GM`, and `{ zone, daylight }` for the lettered codes. The codes `13` to `24` count down: `13` is UTC−12 and `24` is UTC−1. `isValidX12TimeCode` checks a code.
- **`parseX12DateTimePeriod(value, formatQualifier, options?)`** reads an X12 element 1251 value against its 1250 qualifier, the pair a `DTP` segment and `DTM-05`/`06` carry, in freight and in healthcare. It reads 20 codes: dates, times, date-times and ranges. `formatX12DateTimePeriod` writes one, and also writes elements 373 and 337 with the codes `D8`, `TM` and `TS`. `isValidX12DateTimePeriod` checks a value against a code, and `isValidX12DateTimePeriodFormat` checks the code alone.
- **`parseEpcisEvent(event)`** reads the two required time fields of a GS1 EPCIS 2.0 event, `eventTime` and `eventTimeZoneOffset`, and returns `{ instant, offset, local }`. `formatEpcisEvent` writes the pair back with `eventTime` in UTC, and `isValidEpcisEvent` checks one. The `epcisEventTime` and `epcisTimeZoneOffset` patterns are the two grammars GS1 publishes.

What the functions never guess:

- **An offsetless value never becomes UTC.** UN/EDIFACT `203`, an X12 date and time with no time code, the time code `LT` and every X12 1250 code state no offset. The result has `local` and no `instant`. Pass `local` and the place's IANA zone to `resolveLocal`. GMT maps no place to a zone.
- **A named X12 time code is a zone name, not an offset.** `ES` returns the name `Eastern` and `daylight: false`. X12 states no offset for a named zone, so the caller maps the name to an IANA zone.
- **An unresolved UN/EDIFACT zone is returned as text.** The three zone characters of `301` to `304` and `404` are read as an offset when they are a signed hour (`+02`), `UTC` or `GMT`. Any other three upper-case letters, such as `CET`, come back as `zone` with no offset: no UN/EDIFACT text defines them.
- **A two-digit year needs a window.** Neither UN/EDIFACT nor X12 says which century `YY` belongs to. Without `options.yearWindow`, the codes `101`, `201`, `202`, `206`, `207`, `301`, `302`, `713`, `717`, `D6`, `TT`, `TR`, `RD6` and `TU` return the sentinel. A formatter returns `""` for a year outside the window, so a round trip never changes a century.
- **A date is not a date-time, and a time is not an instant.** A date-only code returns `date`, not `local`. A time with no date (`209`, `404`, an X12 time alone) returns `time`, with `offset` when the value states one, and never an `instant`.
- **A formatter writes a value only when the code holds it exactly.** Seconds other than `:00` under a minute-precision code, offset minutes under a three-character zone, and a fraction of a second return `""`. Nothing is rounded.
- **A code GMT does not read returns the sentinel**, never a guessed format. The two format validators tell that case apart from a value that does not fit its code.

Wire details:

- **A UN/EDIFACT period has no hyphen, and an X12 range has one.** `2024061520240620` is a `718` period and `20240615-20240620` is an `RD8` range. Each parser reads only its own form.
- **The UN/EDIFACT release character is the caller's.** An interchange transmits `+02` as `?+02`. `parseEdifactDtm` takes the unescaped value and `formatEdifactDtm` returns it.
- **EPCIS requires both fields, and they are independent.** A missing `eventTimeZoneOffset`, `Z` and `+0200` return `null`. An offset written inside `eventTime` need not match the offset field.
- X12 is a United States standard. Its code lists were read through an X12-licensed dictionary.
- Also exported: the `EdiDateTime`, `EdiPeriodEnd`, `EdifactDtmFormat`, `X12DateTimePeriodFormat`, `X12TimeCode`, `X12DateTime`, `X12TimeCodeMeaning`, `X12TimeCodeOffset`, `X12TimeCodeZone`, `EpcisEventTime`, `EpcisInstant` and `TwoDigitYearOptions` types.

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
