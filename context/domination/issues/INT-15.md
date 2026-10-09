# INT-15 — Intermodal: EDI and event-standard timestamp interop

**Scope:** Read and write the timestamp formats the logistics industry actually exchanges — UN/EDIFACT, X12, EPCIS.

## Gap

GMT can parse ISO 8601. The freight industry mostly does not send ISO 8601. It sends EDIFACT `DTM` segments, X12 date/time elements and EPCIS events — and the recurring defect across all of them is that some formats carry a UTC offset and some do not, with no in-band signal beyond a format qualifier or a time code.

Trading-partner maps vary; the data elements underneath them do not. They are fixed enumerations and fixed formats, so parsing them is standards work, not partner work:

- UN/EDIFACT data element **2379** (Date or time or period format code) qualifies the value in a `DTM` segment.
- X12 elements **373** (Date), **337** (Time) and **623** (Time Code) sit side by side in the freight segments: `AT7` in a 214 carrier status, `G62` in a 204 load tender, and `DTM-02`/`03`/`04`.
- X12 data element **1250** (Date Time Period Format Qualifier) qualifies element 1251 (Date Time Period) in a `DTP` segment and in `DTM-05`/`06`. A healthcare 837 claim always carries its dates and ranges this way, in `DTP`. A 315 ocean status or a 404 rail bill of lading has no `DTP`; its `DTM` may carry the pair in `DTM-05`/`06` in place of the plain date in `DTM-02`.
- GS1 EPCIS 2.0 carries `eventTime` and `eventTimeZoneOffset` on every event.

## Scope

The EDI functions are split by the kind of value a code states: a date, a time, a local date-time, a date-time with an offset, or a period. Each kind has one parser, one formatter and one validator, and each takes only the codes of its kind. X12 data element 337 is a time sent with no code, so it has a formatter of its own, `formatX12TimeElement`, which takes the element's mask.

**The rule: a call the types accept returns a value.** A function's `format` parameter is typed to its kind's own union, so a code a function cannot read does not compile. The only exceptions are facts about the value that no signature can express; [What still returns the sentinel](#what-still-returns-the-sentinel) lists them. No EDI function takes options.

One function per file. Parsers and classifiers go in `intermodal/parse/`, formatters in `intermodal/format/`, validators in `intermodal/validate/`. The EDIFACT and X12 grammars are internal: a value is valid only against a code, so the public check is a validator that takes both, not a pattern per code.

### UN/EDIFACT — a `DTM` value (data element 2380) against its format code (2379)

| Kind | Functions | Codes | Value |
| --- | --- | --- | --- |
| Date | `parseEdifactDate`, `formatEdifactDate`, `isValidEdifactDate` | `102` | `2024-06-15` |
| Time | `parseEdifactTime`, `formatEdifactTime`, `isValidEdifactTime` | `401` `402` | `14:30:00` |
| Local date-time | `parseEdifactDateTime`, `formatEdifactDateTime`, `isValidEdifactDateTime` | `203` `204` | `2024-06-15T14:30:00` |
| Date-time with an offset | `parseEdifactOffsetDateTime`, `formatEdifactOffsetDateTime`, `isValidEdifactOffsetDateTime` | `205` `208` `303` `304` | `2024-06-15T14:30:00+02:00` |
| Period of dates | `parseEdifactDatePeriod`, `formatEdifactDatePeriod`, `isValidEdifactDatePeriod` | `718` | `{ start, end }` |
| Period of local date-times | `parseEdifactDateTimePeriod`, `formatEdifactDateTimePeriod`, `isValidEdifactDateTimePeriod` | `719` | `{ start, end }` |

- `classifyEdifactDtmFormat(format: string): EdifactDtmFormatClass | null` returns `{ kind, format }` for a code that arrives as data. `kind` is `"date"`, `"time"`, `"dateTime"`, `"offsetDateTime"`, `"datePeriod"` or `"dateTimePeriod"`. Testing `kind` narrows `format` to that kind's union, so the code passes to the kind's functions with no cast.
- `isValidEdifactDtmFormat(format: unknown): format is EdifactDtmFormat` checks a code alone. It is true exactly when the classifier returns a result.
- The parsers take the **unescaped** element value: `+02`, not `?+02`. The formatters return the element value; the caller releases `+` as `?+` when placing it in a segment.

### X12 — an element 1251 value against its format qualifier (1250)

| Kind | Functions | Codes | Value |
| --- | --- | --- | --- |
| Date | `parseX12Date`, `formatX12Date`, `isValidX12Date` | `D8` `DB` | `2024-06-15` |
| Time | `parseX12Time`, `formatX12Time`, `isValidX12Time` | `TM` `TS`. The parser and the validator read element 337 when `format` is omitted; `formatX12TimeElement` writes it | `14:30:00`, `14:30:00.12` |
| Local date-time | `parseX12DateTime`, `formatX12DateTime`, `isValidX12DateTime` | `DT` `RTS` | `2024-06-15T14:30:00` |
| Range of dates | `parseX12DateRange`, `formatX12DateRange`, `isValidX12DateRange` | `RD8` `RD` | `{ start, end }` |
| Range of local date-times | `parseX12DateTimeRange`, `formatX12DateTimeRange`, `isValidX12DateTimeRange` | `RDT` `DTS` | `{ start, end }` |

- `parseX12Time(value: string, format?: X12TimeFormat)` and `isValidX12Time` take the qualifier as optional. With none, the value is an element 337 time of 4, 6, 7 or 8 digits. With `TM` or `TS`, the value is read against that mask alone. `formatX12Time(value, format)` needs the qualifier and writes `HHMM` or `HHMMSS`, the two masks a 1250 code has. An element 337 time is written by `formatX12TimeElement`, below.
- `classifyX12DateTimePeriodFormat(format: string): X12DateTimePeriodFormatClass | null` returns `{ kind, format }`. `kind` is `"date"`, `"time"`, `"dateTime"`, `"dateRange"` or `"dateTimeRange"`. `isValidX12DateTimePeriodFormat` checks a code alone.

### X12 — the date, time and time code of a freight segment (elements 373, 337, 623)

- `parseX12DateAndTime(date: string, time: string): string` reads the two elements `AT7`, `G62` and `DTM-02`/`03` carry side by side, as one local date-time. Both are required.
- `isValidX12DateAndTime(date: string, time: string): boolean` takes the same two elements and is true exactly when `parseX12DateAndTime` returns a value: it calls the parser.
- `formatX12TimeElement(value: string, form: X12TimeElementForm): string` writes a time as an element 337 value. `form` is one of the element's own four masks: `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`. The caller names the form, and the function never reads it off the value, so the width of the field does not depend on the data: `14:30:00` under `HHMMSSDD` is `14300000`. `parseX12Time` reads the result back when it is given no qualifier. A 1250 code such as `TS` is not a form and returns the sentinel. The form has no validator: the programmer chooses it, and it never arrives as data.
- `x12TimeCodeOffset(timeCode: X12OffsetTimeCode): string` returns the offset the code states, `±HH:MM`, for the 31 codes that state one: `01`–`29`, `UT` and `GM`. It returns `""` for any other value.
- `x12TimeCodeZone(timeCode: X12ZoneTimeCode): X12NamedZone | null` returns `{ zone, daylight }` for the 25 codes that name a zone. Both members are always present. It returns `null` for any other value.
- `classifyX12TimeCode(timeCode: string): X12TimeCodeClass | null` returns `{ kind, timeCode }`, with `kind` `"offset"` or `"zone"`. `isValidX12TimeCode` checks a code alone.

The freight read is three calls, each total over its types:

```ts
const local = parseX12DateAndTime("20240615", "1430"); // "2024-06-15T14:30:00"
const offset = x12TimeCodeOffset("20"); // "-05:00"
resolveLocal(local, offset); // "2024-06-15T19:30:00Z"
```

### GS1 EPCIS

- `parseEpcisEvent(event: EpcisEventTime): EpcisInstant | null`, returning `{ instant, offset, local }`.
- `formatEpcisEvent(value: OffsetInstant): EpcisEventTime | null`.
- `isValidEpcisEvent(event: unknown): boolean`. It is the two field validators together: it calls `isValidEpcisEventTime` on `eventTime` and `isValidEpcisTimeZoneOffset` on `eventTimeZoneOffset`.
- `isValidEpcisEventTime(value: string): boolean` checks an `eventTime`. The value matches `epcisEventTime`, names a day that exists and carries a fraction of at most nine digits. The pattern proves the shape alone, so it matches `2024-02-30T14:30:00Z` and a ten-digit fraction; the validator returns `false` for both.
- `isValidEpcisTimeZoneOffset(value: string): boolean` checks an `eventTimeZoneOffset`. The `epcisTimeZoneOffset` pattern is the whole rule for a string, so the validator and the pattern agree on every string; the validator adds `false` for a value that is not a string.
- `regex/epcis.ts` — `epcisEventTime` and `epcisTimeZoneOffset`, the two grammars GS1 publishes. They are the only public patterns this story adds.

### Types and internals — `packages/gmt/src/`

- `types/edi.ts` — one union per kind (`EdifactDateFormat`, `EdifactTimeFormat`, `EdifactDateTimeFormat`, `EdifactOffsetDateTimeFormat`, `EdifactDatePeriodFormat`, `EdifactDateTimePeriodFormat`; `X12DateFormat`, `X12TimeFormat`, `X12DateTimeFormat`, `X12DateRangeFormat`, `X12DateTimeRangeFormat`), the four masks of element 337 (`X12TimeElementForm`), the unions of all codes read (`EdifactDtmFormat`, `X12DateTimePeriodFormat`, `X12TimeCode`), the split of the time codes (`X12OffsetTimeCode`, `X12ZoneTimeCode`), the classifier results (`EdifactDtmFormatClass`, `X12DateTimePeriodFormatClass`, `X12TimeCodeClass`), and the results `X12NamedZone`, `EdiDatePeriod` and `EdiDateTimePeriod`. `types/epcis.ts` — `EpcisEventTime`.
- `internal/ediGrammar.ts` — the one code table per standard. Each code is written once, as its kind and its parts in the standards' mask notation (`CCYY`, `MM`, `DD`, `HH`, `ZHHMM`, `ZZZ`). The kind, the grammar, the reader and the writer all come from that entry. Element 337 has no code, so its table is keyed by its four masks. The reader of an element 337 time and its writer both come from that table, so the forms `parseX12Time` reads are the forms `formatX12TimeElement` writes.
- `internal/ediDateTimeFields.ts` reads a value's fields from that table and `internal/ediDateTimeWriter.ts` writes them, so a parser and its formatter share one description of each code. Each public function is a thin call into one of the two.
- `types/two-digit-year.ts` — `TwoDigitYearOptions`, the option of `parseDateWithPattern` and `parseDateTimeWithPattern`. Their `yy` token needs `yearWindow` and returns the sentinel without it. A pattern with no `yy` never reads the option or the clock. `internal/twoDigitYear.ts` places a two-digit year in the 100-year window the caller names; it holds no year of its own. `internal/yearWindowStart.ts` reads the option. The library holds no century of its own anywhere it has a choice; the email and HTTP date parsers keep the rules RFC 5322 §4.3 and RFC 9110 mandate for their own formats.

### The result shape

Every parser returns one value, the same for every code of its kind, and the kind's formatter takes that value.

| Kind | Result | Sentinel |
| --- | --- | --- |
| Date | `YYYY-MM-DD` | `""` |
| Time | `HH:MM:SS`. Seconds are always written. An element 337 time adds a fraction of one or two digits when the value has one | `""` |
| Local date-time | `YYYY-MM-DDTHH:MM:SS`. Seconds are always written. It has no `Z` and no offset, so it is ready for `resolveLocal` | `""` |
| Date-time with an offset | `YYYY-MM-DDTHH:MM:SS±HH:MM`: the wall clock as written, with its offset. It is the string `fromOffsetInstant` writes and `toOffsetInstant` reads | `""` |
| Period or range | `{ start, end }`: two dates (`EdiDatePeriod`) or two local date-times (`EdiDateTimePeriod`), as transmitted | `null` |
| Named zone | `{ zone, daylight }` (`X12NamedZone`) | `null` |
| Classifier | `{ kind, format }` or `{ kind, timeCode }` | `null` |

A period formatter takes `(start, end, format)`. Each value validator takes its parser's arguments and is true exactly when the parser returns a value.

### What still returns the sentinel

Each is a fact about the value, stated in the function's JSDoc:

- A value that does not fit its code's mask, or names a day, an hour, a minute or a second that does not exist.
- Under `303` and `304`, zone characters that are not a signed hour, `UTC` or `GMT`.
- A period or range whose end is before its start.
- In a formatter: a value of another kind, a year outside 0000–9999, an offset with minutes under `303` or `304`, and an offset with a non-zero seconds part under any code.

### Docs site — `apps/dox/src/content/docs/`

- Guide `guides/industries/intermodal-edi-timestamps.mdx`: the UN/EDIFACT functions by kind with a table of which codes carry an offset, what `ZZZ` is, the period without a hyphen, the release character, the three-call freight read, the time code, a `DTP` value, a code that arrives as data, the mask → pattern table for a two-digit year, what is not read, the validators, EPCIS, and the step from a local time to an instant.
- Scenarios `a-203-read-as-utc.mdx`, `et-is-not-an-offset.mdx`, `the-epcis-offset-nobody-kept.mdx`.
- Mistakes: extend `mistakes/intermodal.mdx`.
- Indexes: `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx`.
- The Standards guide (`guides/concepts/standards.mdx`): sections for UN/EDIFACT, X12 and GS1 EPCIS, and for the database and system-clock formats the library already converts.
- Home page (`index.mdx`): the three standards join the "Every standard, in one place" card, and one card covers the formats freight sends.
- Why GMT (`why-gmt.mdx`): one sentence in the industry section naming the three standards.
- Tools: **DTM Decoder** (`/tools/dtm-decoder/`) and **X12 Time Reader** (`/tools/x12-time-reader/`). Each classifies the code, calls the function for its kind, says whether the value's offset is stated, and resolves an offsetless value once the reader picks a zone. Spec: [context/dox/specs/int-15-edi-timestamp-tools.md](../../dox/specs/int-15-edi-timestamp-tools.md).

## UN/EDIFACT DTM format codes (data element 2379)

GMT reads 11 codes.

| Code | Format | Kind | Offset |
| --- | --- | --- | --- |
| `102` | `CCYYMMDD` | Date | none |
| `203` | `CCYYMMDDHHMM` | Local date-time | none |
| `204` | `CCYYMMDDHHMMSS` | Local date-time | none |
| `205` | `CCYYMMDDHHMMZHHMM` | Date-time with an offset | yes — "ZHHMM = time zone given as offset from Coordinated Universal Time (UTC)" |
| `208` | `CCYYMMDDHHMMSSZHHMM` | Date-time with an offset | yes |
| `303` | `CCYYMMDDHHMMZZZ` | Date-time with an offset | see `ZZZ` below |
| `304` | `CCYYMMDDHHMMSSZZZ` | Date-time with an offset | see `ZZZ` below |
| `401` | `HHMM` | Time | none |
| `402` | `HHMMSS` | Time | none |
| `718` | `CCYYMMDD-CCYYMMDD` | Period of dates | none |
| `719` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | Period of local date-times | none |

Codes that are not read, by group. Each returns the sentinel from every function, and `classifyEdifactDtmFormat` returns `null` for it.

| Codes | Format | Why not |
| --- | --- | --- |
| `101`, `201`, `202`, `206`, `207`, `301`, `302`, `713`, `717` | A two-digit year: `YYMMDD`, `YYMMDDHHMM`, `YYMMDDHHMMSS`, and the same with `ZHHMM`, `ZZZ` or as a period | The directory does not say which century `YY` belongs to. A code with a four-digit year states the same kind of value, and a partner's guide can ask for it. A caller who must read one uses the pattern parsers and states the century: see [A two-digit year](#a-two-digit-year) |
| `209`, `404` | `HHMMSSZHHMM`, `HHMMSSZZZ` | A time with an offset and no date. It names no instant, and the library has no such kind of value |
| `406` | `ZHHMM` | An offset alone. It is no date, time or date-time |
| Every other code | — | Partial values (a year, a month, a week), weekday periods (`720`) and quantities (`801` and up). Also forms that are whole values but that no implementation guide we read uses: the day-first and month-first dates (`2`–`5`), `10` (`CCYYMMDDTHHMM`), the week date `103`, the ordinal date `105`, the time spans (`501`–`503`), `210`, `307`, `308`, and `711`, which the directory removed in D.03B |

**The hyphen in a period mask is notation, not data.** Every directory read, from D.93A to D.22B, gives a period without a hyphen. `parseEdifactDatePeriod` and `parseEdifactDateTimePeriod` read only the unhyphenated form and return the sentinel for a hyphenated one, and the two period formatters never write a hyphen.

**`ZZZ` is three characters the directory does not define.** Every edition says only "Z = Time zone". It is read as an offset only, in two forms:

- `±HH`, a signed hour count from `00` to `23`. UN/ECE Recommendation 7 ¶12 lets a UTC difference be written in hours and minutes "or hours only", with a leading sign, and gives the examples `+01` and `-05`. The SMDG schedule guide applies that recommendation to `303`.
- `UTC` or `GMT`, read as `+00:00`. The SMDG guides write `UTC` in a `303` value, and Recommendation 7 ¶12 calls UTC "formerly known as Greenwich Mean Time".

Anything else in the field returns the sentinel. Letters such as `CET` or `PDT` are not read: no standard defines them, and GMT does not assert what an undefined abbreviation means. A caller whose partner sends one removes the letters, reads the rest with `parseEdifactDateTime` under `203` or `204`, and resolves it in the IANA zone the caller maps the letters to. A sign followed by something that is not an hour from `00` to `23` is a broken offset. Lower case returns the sentinel because every published example is upper case. Recommendation 7 also writes UTC as the single letter `Z`; the field is three characters and no guide writes `Z` there, so a value ending in a lone `Z` does not match the mask.

**`303` and `304` hold whole hours.** A formatter writes the zone as `±HH`, never `UTC` or `GMT`. An offset with minutes, such as `+05:30`, returns the sentinel under `303` and `304`; `205` and `208` hold it.

**The release character is the caller's.** `+` is the EDIFACT data element separator, so `+02` is transmitted as `?+02`. These functions take and return the element value itself.

## X12 date, time and time code (elements 373, 337, 623)

`AT7`, `G62` and `DTM-02`/`03`/`04` carry three elements. `parseX12DateAndTime` reads the first two together, and the time code has its own two readers.

- **373, Date:** `CCYYMMDD`.
- **337, Time:** `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`, where `D` is tenths and `DD` hundredths of a second.
- **623, Time Code:** optional. It says where the clock was.

`parseX12DateAndTime` needs both the date and the time. `DTM` and `G62` each allow a date without a time and a time without a date: a caller reads a date alone with `parseX12Date(value, "D8")` and a time alone with `parseX12Time(value)`. To write the two elements, a caller writes the date with `formatX12Date(value, "D8")` and the time with `formatX12TimeElement`, naming the form by its mask. The result of the read is local and carries no offset. The caller reads the time code with `classifyX12TimeCode`, then resolves the local date-time at the offset `x12TimeCodeOffset` returns, or in the IANA zone the caller maps the `x12TimeCodeZone` name to. With no time code the time is local to the event, and the caller supplies the zone. Before release 004010 element 373 was `YYMMDD`; read such a date with `parseDateWithPattern(value, "yyMMdd", undefined, { yearWindow })`.

### Time codes (data element 623)

The list is release 008010, which has 56 codes. Release 005010 has 51: codes `25`–`29` were added in release 006010 and are not valid in an earlier interchange. The functions take no release, so they read all 56. `x12TimeCodeOffset` reads 31 of them and `x12TimeCodeZone` the other 25.

- `01`–`12` are "Equivalent to ISO P01" … `P12`: UTC+1 … UTC+12.
- `13`–`24` are `M12` … `M01` in **descending** order: `13` is UTC−12 and `24` is UTC−1.
- `25`–`29` are the half-hour offsets `M2:30`, `M3:30`, `P5:30`, `P9:30`, `P10:30`.
- `UT` is "Universal Time Coordinate" and returns `+00:00`. `GM` is "Greenwich Mean Time" and returns `+00:00` too: it is the one zone-name code that yields an offset, on the strength of Recommendation 7 ¶12.
- The named standard and daylight codes (`AD`/`AS` Alaska, `CD`/`CS` Central, `ED`/`ES` Eastern, `HD`/`HS` Hawaii-Aleutian, `MD`/`MS` Mountain, `ND`/`NS` Newfoundland, `PD`/`PS` Pacific, `TD`/`TS` Atlantic) name a zone whose offset X12 does **not** state. The result is `{ zone, daylight }` with X12's zone name and a daylight flag, and the caller resolves the name against an IANA zone.
- The generic codes (`AT`, `CT`, `ET`, `HT`, `MT`, `NT`, `PT`, `TT`, `LT`) say neither standard nor daylight and return `{ zone, daylight: null }`, so the caller resolves against a date as well as a zone.

`TS`, `TT`, `CD` and `MD` are codes in both 623 and 1250, with unrelated meanings.

## X12 date time period formats (data element 1250)

`DTP` and `DTM-05`/`06` carry a 1250 qualifier and an element 1251 value. No 1250 code carries an offset, and a `DTP` segment has no time code. GMT reads 10 codes.

| Code | Format | Kind |
| --- | --- | --- |
| `D8` | `CCYYMMDD` | Date |
| `DB` | `MMDDCCYY` | Date |
| `TM` | `HHMM` | Time |
| `TS` | `HHMMSS` | Time |
| `DT` | `CCYYMMDDHHMM` | Local date-time |
| `RTS` | `CCYYMMDDHHMMSS` — a single date-time despite the `R` | Local date-time |
| `RD8` | `CCYYMMDD-CCYYMMDD` | Range of dates |
| `RD` | `MMDDCCYY-MMDDCCYY` | Range of dates |
| `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | Range of local date-times |
| `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` — a range despite having no `R` | Range of local date-times |

Codes that are not read, by group. Each returns the sentinel from every function, and `classifyX12DateTimePeriodFormat` returns `null` for it.

| Codes | Format | Why not |
| --- | --- | --- |
| `D6`, `TT`, `TR`, `RD6`, `TU` | A two-digit year: `YYMMDD`, `MMDDYY`, `DDMMYYHHMM`, `YYMMDD-YYMMDD`, `YYDDD` | X12 does not say which century `YY` belongs to. A code with a four-digit year states the same kind of value. A caller who must read one uses the pattern parsers: see [A two-digit year](#a-two-digit-year) |
| `TC`, `EH` | `DDD`, `YDDD` | A day of the year with no whole year. Neither can be read back as a date |
| `DDT`, `DTD` | `CCYYMMDD-CCYYMMDDHHMM`, `CCYYMMDDHHMM-CCYYMMDD` | A range with a date on one side and a date-time on the other. It fits neither range kind |
| `RTM` | `HHMM-HHMM` | A range of times with no date, which may cross midnight. No other code states that kind |
| `UN` | Unstructured | It has no format to read |
| The other 21 codes | — | Partial values (`CC`, `CY`, `CM`, `CQ`, `YM`, `MCY`, `MD`, `DD`, `MM`, `TQ`, `YY`), ranges of partial values (`DA`, `RD2`, `RD4`, `RD5`, `RMD`, `RMY`), `RDM` (`YYMMDD-MMDD`, whose end names no year), and the month-name forms (`CD`, `KA`, `YMM`) |

X12 transmits the hyphen in a range; EDIFACT does not. Tenths and hundredths of a second are element 337's, and no 1250 code holds them. `parseX12Time` and `parseX12DateAndTime` read them. `formatX12TimeElement` writes them under the masks `HHMMSSD` and `HHMMSSDD`. `formatX12Time` cuts them, because `TS` is `HHMMSS`.

## A two-digit year

No EDI function reads or writes a two-digit year. A caller who holds one reads it with `parseDateWithPattern` or `parseDateTimeWithPattern`, a `yy` pattern and `yearWindow`:

| Code | Mask | Pattern | Parser |
| --- | --- | --- | --- |
| `101`, `D6` | `YYMMDD` | `yyMMdd` | `parseDateWithPattern` |
| `TT` | `MMDDYY` | `MMddyy` | `parseDateWithPattern` |
| `201` | `YYMMDDHHMM` | `yyMMddHHmm` | `parseDateTimeWithPattern` |
| `202` | `YYMMDDHHMMSS` | `yyMMddHHmmss` | `parseDateTimeWithPattern` |
| `TR` | `DDMMYYHHMM` | `ddMMyyHHmm` | `parseDateTimeWithPattern` |

A period (`713`, `717`, `RD6`) is split in two and each half read the same way.

`yearWindow` has two forms. A year is the first year of a fixed 100-year window: `2000` reads `00`–`99` as 2000–2099, and `1950` reads `50`–`99` as 1950–1999 and `00`–`49` as 2000–2049. It gives the same answer in any year, which is what stored data needs. `"rolling"` is the 100 years around today, from 50 years before the current UTC year to 49 after: 1976–2075 during 2026. It never needs maintenance, which suits live messages, and it reads the same stored value differently as years pass, which is why the caller has to ask for it by name. Without `yearWindow` a `yy` pattern returns the sentinel.

## EPCIS 2.0 event time

`eventTime` and `eventTimeZoneOffset` are both required; `recordTime` is optional. GS1 publishes a grammar for each, in different bindings, and the two regexes mirror them exactly:

- `eventTimeZoneOffset`, from the JSON schema: `^([+]|[-])((0[0-9]|1[0-3]):([0-5][0-9])|14:00)$` — `±HH:MM` from `-14:00` to `+14:00`. `Z` and `+0200` do not match.
- `eventTime`, from the XSD's `DateTimeStamp`: a date-time with seconds, an optional fraction, then `Z` or an offset in the same range.

## Design notes

- **One kind of value per function.** Each code states exactly one kind of value, so the split is exact. A function that took every code would return the sentinel for most pairs of code and value, and its parser would need a result with a member for every kind. With one kind per function, the type of `format` is the list of codes that work, and the result is one value.
- **A code without an offset must not silently become UTC.** `203` means local time at an unstated place. `parseEdifactDateTime` returns a local date-time with no `Z` and no offset, which forces the caller to supply the zone, the only correct resolution. This is the single most common EDI timestamp bug.
- **The offset result keeps the wall clock.** `parseEdifactOffsetDateTime` returns the date and time as written with the offset, not the UTC instant: the value states both, and `toOffsetInstant` gives the instant when the caller wants it.
- **A named X12 time code is a zone name, not an offset.** `ES` names a zone and says standard time; X12 states no offset, and the offset of a named zone is a fact GMT does not carry. Returning the name and the daylight flag is all the standard supports.
- **An undefined EDIFACT zone abbreviation is not read.** No text defines `CET`, so no function says what it means. The caller, who knows the partner, maps it.
- **A local time with no place is not resolved.** `LT` and a blank time code mean local to the event, and the place is elsewhere in the message. GMT holds no place-to-zone registry, so the caller passes the zone.
- **EPCIS requires both fields, and they are independent.** `eventTime` fixes the instant. `eventTimeZoneOffset` is the offset in force where the event happened, so the event can be shown in local time. Neither derives from the other, and an offset written inside `eventTime` need not match it.
- **A two-digit year without a century must not silently get one.** Neither UN/EDIFACT nor X12 says which century `YY` belongs to, and a cut-off built into the library is right today and wrong later. So the EDI functions do not read those codes, and the pattern parsers read the value with the window the caller states. A two-digit year is a legacy form: where a partner can send a four-digit code (`102`, `203`, `208`, `D8`, `DT`), ask for it.
- **A formatter cuts a time to the mask and never rounds it.** Under a 2379 or 1250 code a fraction of a second is always dropped, and a minute-precision code drops the seconds too. Under an element 337 mask, `D` holds the whole tenths of the second and `DD` its whole hundredths, and what is below them is dropped: `14:30:45.999` is `1430459` under `HHMMSSD`. So every valid value of the kind can be written under every code of the kind and every mask of the element. An offset is never cut, because the result would name another instant.
- **The caller names the form of an element 337 time.** The element has four forms and no format qualifier to say which one a value is in. A reader can tell them apart by length, so `parseX12Time` takes no form. A writer cannot choose one from the value without making the width of the field depend on the data: `14:30:00` would be six digits and `14:30:00.12` eight. So `formatX12TimeElement` takes the form, named by the mask the dictionary prints, and `formatX12Time` stays the writer for a 1250 qualifier.
- **Partner maps are not bundled.** Which qualifier a given 214 or 315 uses in which segment is implementation-guide data. This story parses the values those guides name; it does not know which segment holds the estimated arrival.
- **Healthcare X12 uses the same elements.** 837 and 834 `DTP` segments carry `D8` and `RD8`; a healthcare consumer imports these parsers. Their location under `intermodal/` reflects where the EDI expertise lives, not where it is used.
- DCSA carries `eventDateTime` with an `eventClassifierCode` marking a value planned, estimated or actual. That vocabulary is TRAN-57's; this story parses timestamps and does not interpret classifiers.

## Authority — what each rule rests on

UN/EDIFACT (UNECE, UN/CEFACT) and GS1 EPCIS (ISO/IEC 19987) are international standards. X12 is a United States standard, the dominant one in North American freight and healthcare EDI. The X12 standard is licensed; its code lists were read through Stedi's X12-licensed dictionary, and the X12 text itself was not reached.

| Rule | Source |
| --- | --- |
| 2379 format masks and descriptions | UNTDID data element 2379. Twelve directories were read: UNECE's own [D.21B](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm) and [D.22B](http://web.archive.org/web/20260311101223/https://service.unece.org/trade/untdid/d22b/tred/tred2379.htm) pages, archived, and mirrors of [D.93A](https://www.stylusstudio.com/edifact/D93A/2379.htm), D.96A, [D.01B](https://www.stylusstudio.com/edifact/D01B/2379.htm), [D.01C](https://www.stylusstudio.com/edifact/D01C/2379.htm), D.03A, [D.03B](https://www.stylusstudio.com/edifact/D03B/2379.htm), [D.04B](https://www.stylusstudio.com/edifact/D04B/2379.htm), [D.11B](https://www.edifactory.de/edifact/directory/D11B/data-element/2379), [D.12A](https://www.edifactory.de/edifact/directory/D12A/data-element/2379) and [D.13B](https://www.edifactory.de/edifact/directory/D13B/data-element/2379). The live UNECE host refuses automated requests. No mask of a code GMT reads changed across them. `205` and `719` are absent from D.93A and D.96A; `208` is absent from D.11B and present from D.12A |
| Each code states one kind of value | UNTDID 2379 and X12 1250: each code's mask and definition give one form. The kind is written beside the mask in `internal/ediGrammar.ts` |
| `205` and `208` carry a signed `HHMM` offset from UTC | UNTDID 2379. `205`: "offset from Coordinated Universal Time (UTC)". `208`, from D.12A: "Z = leading plus/minus sign, HHMM = difference to UTC in Hours and Minutes" |
| A period is transmitted without a hyphen, and a hyphenated value is rejected | UNTDID 2379, every directory read. `718`, D.93A to D.01B: "Format of period to be given without hyphen."; from D.01C: "Data is to be transmitted as consecutive characters without hyphen." `719`, in every directory that has it: "Format of period to be given in actual message without hyphen." |
| `ZZZ` of `±HH` is a UTC offset in hours | [UN/ECE Recommendation 7](http://web.archive.org/web/20201020110807/http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec07/rec07_1988_inf108.pdf) ¶12: the difference is appended "in hours and minutes, or hours only, with a leading "+" or "-" sign", with the examples `+01` and `-05`; [SMDG IFTSAI 2.0 (draft)](https://smdg.org/wp-content/uploads/MIGs/Schedules/Draft-IFTSAI20.pdf) § DTM, which applies Recommendation 7 to `303` |
| `ZZZ` of `UTC` or `GMT` is UTC | **GMT rule**, resting on two sources. SMDG IFTSAI 2.0 and [SMDG BAPLIE 3.1.1](https://smdg.org/wp-content/uploads/MIGs/BAPLIE/BAPLIE3.1.1-02.pdf) write `UTC` in a `303` value. Recommendation 7 ¶12: "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)" |
| Any other `ZZZ` is rejected | **GMT rule.** No UN/EDIFACT text defines an abbreviation such as `CET`, so GMT reads none. A sign-led or numeric field that is not a valid hour is a broken offset. Lower case is rejected because every published example is upper case; the syntax rules themselves allow lower case at level B. A lone `Z` is rejected because the mask has three characters, a variable-length element carries no trailing spaces ([UN/EDIFACT syntax rules](http://web.archive.org/web/20151228090930/http://www.unece.org/trade/untdid/texts/d422_d.htm) §7), and no guide writes it |
| A zone is always written `±HH`; zero is written `+00` and `+0000`; `-00` and `-0000` are read as `+00:00` | **GMT rule.** One spelling for one fact, in the form Recommendation 7 ¶12 gives. `toOffsetInstant` treats a negative zero offset the same way |
| `303` and `304` hold whole hours; an offset with minutes is rejected there | The field is three characters, and the hours-only form of UN/ECE Recommendation 7 ¶12 (`+01`, `-05`) fills it. **GMT rule:** an offset is never cut or rounded to fit, because the value would name another instant. `205` and `208` hold hours and minutes. No mask holds the seconds of an offset, so an offset with a non-zero seconds part is rejected under every code |
| `?` releases a service character | [UN/EDIFACT syntax rules, UNTDID Part 4 Chapter 2.2](http://web.archive.org/web/20151228090930/http://www.unece.org/trade/untdid/texts/d422_d.htm): "? immediately preceding one of the characters ' + : ? restores their normal meaning." The ISO 9735 text was not reached |
| Elements 373 and 337: formats and ranges | X12 data elements [373](https://www.stedi.com/edi/x12-005010/element/373) and [337](https://www.stedi.com/edi/x12-005010/element/337), release 005010. 337: "HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD … D = tenths (0-9) and DD = hundredths (00-99)" |
| `formatX12TimeElement` takes one of four forms, named `HHMM`, `HHMMSS`, `HHMMSSD` and `HHMMSSDD` | X12 data element 337, release 005010: the definition lists exactly these four masks, and the element has a length of 4 to 8. **GMT rule:** the caller names the form, because the element has no format qualifier and a form chosen from the value would make the field's width depend on the data |
| A date and a time with no time code are local to the event | X12 `AT7` segment: "If AT707 is not present then AT706 represents local time of the status" ([AT7, 005010](https://www.stedi.com/edi/x12-005010/segment/AT7)). **GMT rule** for `DTM` and `G62`, which do not say what an absent time code means. Either way `parseX12DateAndTime` states no offset |
| `parseX12DateAndTime` needs both elements | **GMT rule.** The function returns one local date-time, which needs a date and a time. X12 lets a segment carry one without the other (`G62` R0103, "At least one of G62-01 or G62-03 is required"; `DTM` R020305, "At least one of DTM-02, DTM-03 or DTM-05 is required"), and a caller reads a date alone with `parseX12Date` and a time alone with `parseX12Time` |
| 623 time codes, including the descending `13`–`24` run | X12 data element 623, [release 008010](https://www.stedi.com/edi/x12-008010/element/623): 56 codes. [Release 005010](https://www.stedi.com/edi/x12-005010/element/623) has 51; `25`–`29` first appear in 006010 |
| `GM` returns `+00:00` | **GMT rule.** X12 defines `GM` only by the name "Greenwich Mean Time". Recommendation 7 ¶12 equates it with UTC |
| 1250 format codes | X12 data element 1250, [release 005010](https://www.stedi.com/edi/x12-005010/element/1250): 42 codes, the same list in 008010 |
| An X12 range is transmitted with its hyphen | X12 data element 1250: each range code's definition gives the format with the hyphen ("Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD") and, unlike UNTDID 2379, carries no instruction to omit it |
| `eventTimeZoneOffset` grammar and range | GS1 EPCIS 2.0 [JSON schema](https://ref.gs1.org/standards/epcis/epcis-json-schema.json) pattern; [EPCIS Standard 2.0](https://ref.gs1.org/standards/epcis/) §7.4.1: the hour is "within the range 00 through 14 (inclusive) … except that if the value of the first two digits is 14, the value of the second two digits must be 00" |
| `eventTime` grammar | GS1 EPCIS 2.0 [XSD](https://ref.gs1.org/standards/epcis/epcglobal-epcis-2_0.xsd) `DateTimeStamp`. The JSON schema says only `format: date-time` |
| Both EPCIS fields are required | The JSON schema's `required` and the XSD's element declarations |
| The offset inside `eventTime` need not match `eventTimeZoneOffset` | EPCIS Standard 2.0 §7.4.1.1, which the standard marks non-normative: "there is no requirement that the time zone specifier in the XML representation of eventTime be the local time zone offset where the event was captured". Neither binding's grammar ties the two |
| An `eventTime` fraction longer than nine digits is refused | **GMT rule.** The XSD allows any length; Temporal holds nanoseconds, and a parser must not silently truncate |
| A two-digit-year code is not read by an EDI function | **GMT rule.** UNTDID 2379 and X12 1250 define `YY` and name no century. For each such code, a code with a four-digit year states the same kind of value, and a partner's guide can ask for it. The pattern parsers read the legacy form with the century stated |
| A `yy` pattern token needs a caller-stated century window | **GMT rule.** No standard names the century of a two-digit year. A cut-off fixed in the library expires, and one that slides with today's date makes one stored value parse two ways in two years. The caller knows whether the data is live or stored, so the caller states the window: a fixed start year, or `"rolling"` |
| A rolling window runs from 50 years before the current UTC year to 49 after | **GMT rule**, year-granular. RFC 9110 §5.6.7 applies the same 50-year idea to the two-digit year of an obsolete HTTP date |
| A field out of range, or a day the year does not have, is rejected | TC39 Temporal `overflow: "reject"`; [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics) |
| A formatter cuts seconds and fractions to the mask, and never rounds | **GMT rule.** A mask states a precision. Cutting to it writes the minute or the second the value falls in, so every value of the kind can be written under every code of the kind. Rounding could move the value into the next minute, hour or day |
| A code that states no date, time, date-time or instant is not read (`209`, `404`, `406`, `TC`, `EH`, `DDT`, `DTD`, `RTM`, `UN`) | **GMT rule.** A time with an offset and no date names no instant. One digit of a year (`EH`) names ten years in every century. A mixed range, a range of times and unstructured text fit no kind of value the library has |
| A period or range whose end precedes its start is rejected | **GMT rule.** A reversed period names no span of time; the range validators reject one the same way. An end equal to its start is valid |
| Both ends of a period are returned as transmitted | UNTDID 2379 and X12 1250 do not say whether the end is inside the period: that is the message's to define. **GMT rule:** no day is added or removed |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the instant-plus-offset pair, and the string a date-time with an offset is read and written as
- `resolveLocal` from CORE-4 — resolving an offsetless local time once the caller supplies a zone or an offset
- `isValidDate`, `isValidDateTime`, `isValidTime` — the ISO values the formatters take
- `internal/utcOffsetString.ts` — parsing and writing a UTC offset through Temporal
- `regex/utc-offset` — the `±HH:MM` shape every offset result has

## Verification

- `packages/gmt/src/test/ediPermutations.test.ts` proves the rule that a call the types accept returns a value. For every function it pairs every code in the function's union with valid values of its kind (with seconds, with a fraction, a leap day, the years 0000 and 9999, offsets from −12:00 to +14:00). It asserts 881 valid pairs, 789 UN/EDIFACT and 92 X12, and each returns a value. It asserts 20 more for element 337, the four masks with five times each: `formatX12TimeElement` writes each, and `parseX12Time` reads it back cut to the mask. It asserts the value-level exceptions as sentinels: 60 part-hour offsets under `303` and `304`, and 63 reversed ranges. A value of another kind returns the sentinel from every function
- `parseEdifactDateTime('202406151430', '203')` returns `2024-06-15T14:30:00`, with no `Z` and no offset; the same value under `'204'` returns the sentinel
- `parseEdifactOffsetDateTime('202406151430+0200', '205')` returns `2024-06-15T14:30:00+02:00`, and `toOffsetInstant` reads it as `2024-06-15T12:30:00Z` and `+02:00`; `'20240615143045+0530'` with `'208'` returns `2024-06-15T14:30:45+05:30`
- `parseEdifactOffsetDateTime('202406151430+02', '303')` returns `…+02:00`, and `'…UTC'` and `'…GMT'` return `…+00:00`; `'…CET'`, `'…+24'`, `'…000'`, `'…cet'`, `'…Z'` and `'…?+02'` return the sentinel
- `formatEdifactOffsetDateTime('2024-06-15T14:30:00Z', '303')` returns `202406151430+00`; `'2024-06-15T14:30:00+05:30'` returns the sentinel under `'303'` and `202406151430+0530` under `'205'`; `'2024-06-15T14:30:45.9+02:00'` under `'205'` returns `202406151430+0200`
- `parseEdifactDatePeriod('2024061520240620', '718')` returns `{ start: '2024-06-15', end: '2024-06-20' }`; the hyphenated form and a reversed period return the sentinel; `formatEdifactDatePeriod('2024-06-15', '2024-06-20', '718')` returns the value with no hyphen
- A code of another kind does not compile, and returns the sentinel when a caller forces it: `parseEdifactDate('202406151430', '203')` returns `""`
- `parseX12DateAndTime('20240615', '1430')` returns `2024-06-15T14:30:00`; with `'14300012'` it returns `2024-06-15T14:30:00.12`; an empty date or an empty time returns the sentinel
- `resolveLocal(parseX12DateAndTime('20240615', '1430'), x12TimeCodeOffset('20'))` returns `2024-06-15T19:30:00Z`
- `x12TimeCodeOffset('01')` returns `+01:00`, `'13'` returns `-12:00` and `'24'` returns `-01:00` (the descending run, asserted); `'27'` returns `+05:30`; `'UT'` and `'GM'` return `+00:00`; `'ET'` and an unknown code return the sentinel
- `x12TimeCodeZone('ES')` returns `{ zone: 'Eastern', daylight: false }`; `'ED'` returns `daylight: true`; `'ET'` returns `daylight: null`; `'UT'` and an unknown code return the sentinel
- `parseX12Date('20240615', 'D8')` returns `2024-06-15`; `parseX12DateRange('20240615-20240620', 'RD8')` returns `{ start, end }`; the unhyphenated form and `'20240620-20240615'` return the sentinel
- `parseX12DateTime('20240615143000', 'RTS')` returns one local date-time, not a range
- `parseX12Time('14300012')` returns `14:30:00.12`; the same value with `'TS'` returns the sentinel; `formatX12Time('14:30:45.9', 'TS')` returns `143045`
- `formatX12TimeElement('14:30:00.12', 'HHMMSSDD')` returns `14300012`, and `'HHMMSSD'` returns `1430001`; `'14:30:00'` under `'HHMMSSDD'` returns `14300000`; `'14:30:45.999'` returns `143045` under `'HHMMSS'` and `14304599` under `'HHMMSSDD'`; `'TS'` as the form, a date-time and `'24:00'` return the sentinel
- For each of `1430`, `143045`, `1430001`, `14300012`, `14300000`, `0000` and `23595999`, `formatX12TimeElement(parseX12Time(value), form)` returns the value again, where `form` is the mask with as many characters as the value has digits
- `classifyEdifactDtmFormat('203')` returns `{ kind: 'dateTime', format: '203' }`; `'101'`, `'209'` and `'602'` return the sentinel; `classifyX12DateTimePeriodFormat` returns the sentinel for `'D6'`, `'RTM'` and `'UN'`; `classifyX12TimeCode('20')` returns `kind: 'offset'` and `'ET'` returns `kind: 'zone'`
- `parseDateWithPattern('240615', 'yyMMdd', undefined, { yearWindow: 2000 })` returns `2024-06-15`, and the sentinel with no `yearWindow`; `'990615'` returns `1999-06-15` with a window starting 1950 and `2099-06-15` with one starting 2000; a `yearWindow` that is neither `"rolling"` nor an integer from 0 to 9900 returns the sentinel
- With `{ yearWindow: 'rolling' }` and the clock faked, a `yy` pattern reads `99` as 1999 on 2026-10-07 and on 2049-12-31, and as 2099 on 2050-01-01; with `{ yearWindow: 1950 }` it reads as 1999 on all three
- `parseDateWithPattern('2024-03-15', 'yyyy-MM-dd', undefined, { yearWindow: 'rolling' })` returns `2024-03-15` with a clock that throws
- `parseEpcisEvent` preserves the original offset through a round-trip, including a negative offset
- An EPCIS event missing `eventTimeZoneOffset`, or carrying `Z` or `+0200` there, returns the sentinel
- `isValidX12DateAndTime('20240615', '1430')` and `('20240615', '14300012')` return `true`; an empty time, `'20230229'`, a time of `'2430'` and a six-digit date return `false`
- `isValidEpcisEventTime('2024-06-15T14:30:00Z')` returns `true`; `'2024-02-30T14:30:00Z'` and `'2024-06-15T14:30:00.1234567891Z'` return `false`, and `epcisEventTime` matches both; a value with no seconds or with no `Z` or offset returns `false`
- `isValidEpcisTimeZoneOffset('-05:00')` and `('+14:00')` return `true`; `'+14:01'`, `'Z'`, `'+0200'` and `'+05:30:00'` return `false`
- `isValidEpcisEvent` returns the same answer as the two field validators together for every event the suite gives it
- Each `isValid*` value validator agrees with its parser on every row above
- `pnpm run validate` stays green
