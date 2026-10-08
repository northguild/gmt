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

One function per file. Parsers go in a new `intermodal/parse/` module, formatters in the existing `intermodal/format/`, validators in a new `intermodal/validate/`. The EDIFACT and X12 grammars are internal: a value is valid only against a code, so the public check is a validator that takes both, not a pattern per code.

Function names follow the standards' own names: a `DTM` segment, X12's "Date/Time" segments, X12's "Date Time Period" element.

### Library — `packages/gmt/src/`

- `intermodal/parse/parseEdifactDtm.ts` — `parseEdifactDtm(value: string, formatQualifier: string, options?: TwoDigitYearOptions): EdiDateTime | null`. Parses a DTM date/time value (data element 2380) against its 2379 format code. Takes the **unescaped** element value: `+02`, not `?+02`. `options.yearWindow` is needed only by the two-digit-year codes.
- `intermodal/parse/parseX12DateTime.ts` — `parseX12DateTime(date?: string, time?: string, timeCode?: string): X12DateTime | null`. Reads elements 373, 337 and 623 as a freight segment carries them. Returns the local date-time, plus the offset and instant when the time code states an offset, or the zone name when it names one. A segment may carry a date alone or a time alone; a time alone returns the time and no instant.
- `intermodal/parse/parseX12DateTimePeriod.ts` — `parseX12DateTimePeriod(value: string, formatQualifier: string, options?: TwoDigitYearOptions): EdiDateTime | null`. Reads an element 1251 value against its 1250 qualifier.
- `intermodal/parse/x12TimeCode.ts` — `x12TimeCode(timeCode: string): X12TimeCodeMeaning | null`. Data element 623. Returns `{ offset }` or `{ zone, daylight }`.
- `intermodal/parse/parseEpcisEvent.ts` — `parseEpcisEvent(event: EpcisEventTime): EpcisInstant | null`, returning `{ instant, offset, local }`.
- `intermodal/format/formatEdifactDtm.ts` — `formatEdifactDtm(value: string, formatQualifier: string, options?: TwoDigitYearOptions): string`. Inverse of the parser. A period takes an ISO 8601 `<start>/<end>` string. Returns `""` when the value cannot be written in the code exactly. Its result is the element value; the caller releases `+` as `?+` when placing it in a segment.
- `intermodal/format/formatX12DateTimePeriod.ts` — `formatX12DateTimePeriod(value: string, formatQualifier: string, options?: TwoDigitYearOptions): string`. Also writes elements 373 and 337, whose forms are `D8`, `TM` and `TS`.
- `intermodal/format/formatEpcisEvent.ts` — `formatEpcisEvent(value: OffsetInstant): EpcisEventTime | null`.
- `intermodal/validate/` — `isValidEdifactDtm`, `isValidEdifactDtmFormat`, `isValidX12DateTime`, `isValidX12DateTimePeriod`, `isValidX12DateTimePeriodFormat`, `isValidX12TimeCode`, `isValidEpcisEvent`. Each value validator takes the same arguments as its parser and is true exactly when the parser returns non-null. Each format validator tells an unknown code apart from a bad value, which the parser's single `null` cannot.
- `regex/epcis.ts` — `epcisEventTime` and `epcisTimeZoneOffset`, the two grammars GS1 publishes. They are the only public patterns this story adds.
- `types/edi.ts` — `EdiDateTime`, `EdiPeriodEnd`, and the code unions `EdifactDtmFormat`, `X12DateTimePeriodFormat`, `X12TimeCode`. `types/epcis.ts` — `EpcisEventTime`.
- `internal/ediGrammar.ts` — the one code table per standard. Each code is written once, as its parts in the standards' mask notation (`CCYY`, `MM`, `DD`, `HH`, `ZHHMM`, `ZZZ`), and its grammar is built from them. `internal/ediDateTimeFields.ts` reads a value's fields from that table and `internal/ediDateTimeWriter.ts` writes them, so a parser and its formatter share one description of each code. `internal/isoInterval.ts` splits the `<start>/<end>` string a period is written from. `internal/twoDigitYear.ts` places a two-digit year in the 100-year window the caller names; it holds no year of its own.
- `types/two-digit-year.ts` — `TwoDigitYearOptions`, shared with `parseDateWithPattern` and `parseDateTimeWithPattern`. Their `yy` token follows the same rule: it needs `yearWindow` and returns the sentinel without it. A pattern with no `yy` never reads the option or the clock. The library holds no century of its own anywhere it has a choice; the email and HTTP date parsers keep the rules RFC 5322 §4.3 and RFC 9110 mandate for their own formats.

### The result shape

`parseEdifactDtm` and `parseX12DateTimePeriod` return the same shape. Each code fills only the members it can state:

| Member | Holds | Filled by |
| --- | --- | --- |
| `date` | `YYYY-MM-DD` | Date-only codes (`102`, `101`, `D8`, `D6`, `DB`, `TT`) and `TU` |
| `time` | `HH:MM:SS` | Time-only codes (`401`, `402`, `404`, `209`, `TM`, `TS`) |
| `local` | `YYYY-MM-DDTHH:MM:SS` | Every date-time code: the wall clock as written. With no `instant`, it is ready for `resolveLocal` |
| `instant` | An instant ending in `Z` | `205`–`208`; `301`–`304` when the zone is `±HH`, `UTC` or `GMT` |
| `offset` | `±HH:MM` | With `instant`; with `time` for `404` and `209`, since a time alone names no instant; alone for `406` |
| `zone` | Three upper-case letters | `301`–`304` and `404` when the zone is an abbreviation |
| `dayOfYear` | 1–366 | `TC`, `TU`, `EH` |
| `yearDigit` | 0–9 | `EH` |
| `periodEnd` | `date`, `time` or `local` for the end | Period and range codes |

`parseX12DateTime` returns `date` when a date was sent, `time` when a time was sent, and `local` when both were. A time code adds `offset`, or `zone` and `daylight`. `instant` needs a date, a time and a stated offset.

### Docs site — `apps/dox/src/content/docs/`

- Guide `guides/industries/intermodal-edi-timestamps.mdx`: one `##` per function, a table of which codes carry an offset, what `ZZZ` is, the two X12 readers and which segments each serves, the healthcare use of `D8` and `RD8`.
- Scenarios `a-203-read-as-utc.mdx`, `et-is-not-an-offset.mdx`, `the-epcis-offset-nobody-kept.mdx`.
- Mistakes: extend `mistakes/intermodal.mdx`.
- Indexes: `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx`.
- The Standards guide (`guides/concepts/standards.mdx`): new sections for UN/EDIFACT, X12 and GS1 EPCIS, and for the database and system-clock formats the library already converts.
- Home page (`index.mdx`): the three standards join the "Every standard, in one place" card, and one new card covers the formats freight sends.
- Why GMT (`why-gmt.mdx`): one sentence in the industry section naming the three standards.
- Tools: **DTM Decoder** (`/tools/dtm-decoder/`) and **X12 Time Reader** (`/tools/x12-time-reader/`). Each says whether a value's offset is stated, and resolves an offsetless value once the reader picks a zone. Spec: [context/dox/specs/int-15-edi-timestamp-tools.md](../../dox/specs/int-15-edi-timestamp-tools.md).

## UN/EDIFACT DTM format codes (data element 2379)

| Code | Format | Offset |
| --- | --- | --- |
| `101` | `YYMMDD` | none |
| `102` | `CCYYMMDD` | none |
| `201` | `YYMMDDHHMM` | none |
| `202` | `YYMMDDHHMMSS` | none |
| `203` | `CCYYMMDDHHMM` | none |
| `204` | `CCYYMMDDHHMMSS` | none |
| `205` | `CCYYMMDDHHMMZHHMM` | yes — "ZHHMM = time zone given as offset from Coordinated Universal Time (UTC)" |
| `206` | `YYMMDDHHMMZHHMM` | yes |
| `207` | `YYMMDDHHMMSSZHHMM` | yes |
| `208` | `CCYYMMDDHHMMSSZHHMM` | yes |
| `209` | `HHMMSSZHHMM` | yes; a time, so no instant |
| `301` | `YYMMDDHHMMZZZ` | see `ZZZ` below |
| `302` | `YYMMDDHHMMSSZZZ` | see `ZZZ` below |
| `303` | `CCYYMMDDHHMMZZZ` | see `ZZZ` below |
| `304` | `CCYYMMDDHHMMSSZZZ` | see `ZZZ` below |
| `401` | `HHMM` | none |
| `402` | `HHMMSS` | none |
| `404` | `HHMMSSZZZ` | see `ZZZ` below; a time, so no instant |
| `406` | `ZHHMM` | the offset itself; "Z is plus (+) or minus (-)" |
| `713` | `YYMMDDHHMM-YYMMDDHHMM` | none; a period |
| `717` | `YYMMDD-YYMMDD` | none; a period |
| `718` | `CCYYMMDD-CCYYMMDD` | none; a period |
| `719` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | none; a period |

These 23 codes are the ones GMT reads. Every other 2379 code returns `null`. That includes partial values (a year, a month, a week), weekday periods (`720`) and quantities (`801` and up). It also includes forms that are whole values but that no implementation guide we read uses: the day-first and month-first dates (`2`–`5`), `10` (`CCYYMMDDTHHMM`), the week date `103`, the ordinal date `105`, the time spans (`501`–`503`), `210`, `307`, `308`, and `711`, which the directory removed in D.03B.

**The hyphen in a period mask is notation, not data.** Every directory read, from D.93A to D.22B, gives a period without a hyphen. `parseEdifactDtm` reads only the unhyphenated form and returns the sentinel for a hyphenated one, and `formatEdifactDtm` never writes a hyphen.

**`ZZZ` is three characters the directory does not define.** Every edition says only "Z = Time zone". Three forms are read:

- `±HH`, a signed hour count. UN/ECE Recommendation 7 ¶12 lets a UTC difference be written in hours and minutes "or hours only", with a leading sign, and gives the examples `+01` and `-05`. The SMDG schedule guide applies that recommendation to `303`.
- `UTC` or `GMT`. The SMDG guides write `UTC` in a `303` value, and Recommendation 7 ¶12 calls UTC "formerly known as Greenwich Mean Time".
- Any other three upper-case letters, such as `CET` or `PDT`. They come back as `zone` text with no offset: no standard defines them, and GMT does not assert what an undefined abbreviation means.

Anything else in the field returns the sentinel. A sign followed by something that is not an hour from `00` to `23` is a broken offset, not a zone name. Lower case returns the sentinel because every published example is upper case. Recommendation 7 also writes UTC as the single letter `Z`; the field is three characters and no guide writes `Z` there, so a value ending in a lone `Z` does not match the mask and returns the sentinel.

**The release character is the caller's.** `+` is the EDIFACT data element separator, so `+02` is transmitted as `?+02`. These functions take and return the element value itself.

## X12 date, time and time code (elements 373, 337, 623)

`AT7`, `G62` and `DTM-02`/`03`/`04` carry three elements. `parseX12DateTime` reads them together.

- **373, Date:** `CCYYMMDD`.
- **337, Time:** `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`, where `D` is tenths and `DD` hundredths of a second.
- **623, Time Code:** optional. In `DTM` and `AT7` X12 requires the time whenever the code is present. `G62` has no such note; GMT applies the same rule to it, so a time code with no time always returns the sentinel.

An element X12 leaves out is empty between its delimiters, so an empty string and an omitted argument both mean "not sent". `DTM` and `G62` each allow a date without a time and a time without a date. `AT7` does not allow a time without a date, but the function is not told which segment a value came from, so it reads a time alone wherever it came from. With neither a date nor a time there is nothing to read, and the result is the sentinel. Before release 004010 element 373 was `YYMMDD`; read such a date with `parseX12DateTimePeriod(value, "D6", { yearWindow })`.

### Time codes (data element 623)

The list is release 008010, which has 56 codes. Release 005010 has 51: codes `25`–`29` were added in release 006010 and are not valid in an earlier interchange. `x12TimeCode` takes no release, so it reads all 56.

- `01`–`12` are "Equivalent to ISO P01" … `P12`: UTC+1 … UTC+12.
- `13`–`24` are `M12` … `M01` in **descending** order: `13` is UTC−12 and `24` is UTC−1.
- `25`–`29` are the half-hour offsets `M2:30`, `M3:30`, `P5:30`, `P9:30`, `P10:30`.
- `UT` is "Universal Time Coordinate" and returns `+00:00`. `GM` is "Greenwich Mean Time" and returns `+00:00` too: it is the one zone-name code that yields an offset, on the strength of Recommendation 7 ¶12.
- The named standard and daylight codes (`AD`/`AS` Alaska, `CD`/`CS` Central, `ED`/`ES` Eastern, `HD`/`HS` Hawaii-Aleutian, `MD`/`MS` Mountain, `ND`/`NS` Newfoundland, `PD`/`PS` Pacific, `TD`/`TS` Atlantic) name a zone whose offset X12 does **not** state. The result is `{ zone, daylight }` with X12's zone name and a daylight flag, and the caller resolves the name against an IANA zone.
- The generic codes (`AT`, `CT`, `ET`, `HT`, `MT`, `NT`, `PT`, `TT`, `LT`) say neither standard nor daylight and return `{ zone, daylight: null }`, so the caller resolves against a date as well as a zone.

`TS`, `TT`, `CD` and `MD` are codes in both 623 and 1250, with unrelated meanings.

## X12 date time period formats (data element 1250)

`DTP` and `DTM-05`/`06` carry a 1250 qualifier and an element 1251 value. `parseX12DateTimePeriod` reads the pair. No 1250 code carries an offset, and a `DTP` segment has no time code.

| Code | Format |
| --- | --- |
| `D8` | `CCYYMMDD` |
| `D6` | `YYMMDD` |
| `DB` | `MMDDCCYY` |
| `TT` | `MMDDYY` |
| `DT` | `CCYYMMDDHHMM` |
| `TR` | `DDMMYYHHMM` |
| `RTS` | `CCYYMMDDHHMMSS` — a single date-time despite the `R` |
| `TM` | `HHMM` |
| `TS` | `HHMMSS` |
| `RD8` | `CCYYMMDD-CCYYMMDD` |
| `RD6` | `YYMMDD-YYMMDD` |
| `RD` | `MMDDCCYY-MMDDCCYY` |
| `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` |
| `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` — a range despite having no `R` |
| `DDT` | `CCYYMMDD-CCYYMMDDHHMM` |
| `DTD` | `CCYYMMDDHHMM-CCYYMMDD` |
| `RTM` | `HHMM-HHMM` — may cross midnight: `2200-0600` is a valid window |
| `TC` | `DDD` — day of year; needs a year from the caller |
| `TU` | `YYDDD` — a date |
| `EH` | `YDDD` — the last digit of the year; never resolved to a date |
| `UN` | Unstructured — returns `null`, never guessed |

X12 transmits the hyphen in a range; EDIFACT does not. The other 21 codes of 1250 return `null`: partial values (`CC`, `CY`, `CM`, `CQ`, `YM`, `MCY`, `MD`, `DD`, `MM`, `TQ`, `YY`), ranges of partial values (`DA`, `RD2`, `RD4`, `RD5`, `RMD`, `RMY`), `RDM` (`YYMMDD-MMDD`, whose end names no year), and the month-name forms (`CD`, `KA`, `YMM`).

## EPCIS 2.0 event time

`eventTime` and `eventTimeZoneOffset` are both required; `recordTime` is optional. GS1 publishes a grammar for each, in different bindings, and the two regexes mirror them exactly:

- `eventTimeZoneOffset`, from the JSON schema: `^([+]|[-])((0[0-9]|1[0-3]):([0-5][0-9])|14:00)$` — `±HH:MM` from `-14:00` to `+14:00`. `Z` and `+0200` do not match.
- `eventTime`, from the XSD's `DateTimeStamp`: a date-time with seconds, an optional fraction, then `Z` or an offset in the same range.

## Design notes

- **A qualifier without an offset must not silently become UTC.** `203` means local time at an unstated place. Returning `local` without `instant` forces the caller to supply the zone, which is the only correct resolution. This is the single most common EDI timestamp bug.
- **A date is not a local date-time.** A date-only code returns `date`, not `local`: `resolveLocal` takes a date-time, and a date alone names no instant in any zone.
- **A time is not an instant.** `404` and `209` carry a time and an offset and no date, so they return `time` and `offset`.
- **A named X12 time code is a zone name, not an offset.** `ES` names a zone and says standard time; X12 states no offset, and the offset of a named zone is a fact GMT does not carry. Returning the name and the daylight flag is all the standard supports.
- **An undefined EDIFACT zone is text, not an offset.** The same contract as a named X12 time code, for the same reason.
- **A local time with no place is not resolved.** `LT` and a blank time code mean local to the event, and the place is elsewhere in the message. GMT holds no place-to-zone registry, so the caller passes the zone.
- **EPCIS requires both fields, and they are independent.** `eventTime` fixes the instant. `eventTimeZoneOffset` is the offset in force where the event happened, so the event can be shown in local time. Neither derives from the other, and an offset written inside `eventTime` need not match it.
- **A two-digit year without a century must not silently get one.** Neither UN/EDIFACT nor X12 says which century `YY` belongs to, and a cut-off built into the library is right today and wrong later. So the caller states it with `yearWindow`, in one of two forms. A year is the first year of a fixed 100-year window: `2000` reads `00`–`99` as 2000–2099, and `1950` reads `50`–`99` as 1950–1999 and `00`–`49` as 2000–2049. It gives the same answer in any year, which is what stored data needs. `"rolling"` is the 100 years around today, from 50 years before the current UTC year to 49 after: 1976–2075 during 2026. It never needs maintenance, which suits live messages, and it reads the same stored value differently as years pass, which is why the caller has to ask for it by name. The codes that need it are `101`, `201`, `202`, `206`, `207`, `301`, `302`, `713`, `717` and `D6`, `TT`, `TR`, `RD6`, `TU`. Without it they return the sentinel, the same way an offsetless value returns no instant. A formatter returns the sentinel for a year outside the window, so a round-trip never changes a century. Codes with a four-digit year never read the option. A two-digit year is a legacy form: where a partner can send a four-digit code (`102`, `203`, `208`, `D8`, `DT`), ask for it.
- **A formatter writes a value only when the code holds it exactly.** Seconds under a minute-precision code, minutes in an offset under `ZZZ`, or a fraction under any code return the sentinel. Nothing is rounded.
- **Tenths and hundredths of a second are read, not written.** Element 337 allows them; no 1250 code does.
- **Partner maps are not bundled.** Which qualifier a given 214 or 315 uses in which segment is implementation-guide data. This story parses the values those guides name; it does not know which segment holds the estimated arrival.
- **Healthcare X12 uses the same elements.** 837 and 834 `DTP` segments carry `D8` and `RD8`; a healthcare consumer imports this parser. Its location under `intermodal/` reflects where the EDI expertise lives, not where it is used.
- DCSA carries `eventDateTime` with an `eventClassifierCode` marking a value planned, estimated or actual. That vocabulary is TRAN-57's; this story parses timestamps and does not interpret classifiers.

## Authority — what each rule rests on

UN/EDIFACT (UNECE, UN/CEFACT) and GS1 EPCIS (ISO/IEC 19987) are international standards. X12 is a United States standard, the dominant one in North American freight and healthcare EDI. The X12 standard is licensed; its code lists were read through Stedi's X12-licensed dictionary, and the X12 text itself was not reached.

| Rule | Source |
| --- | --- |
| 2379 format masks and descriptions | UNTDID data element 2379. Twelve directories were read: UNECE's own [D.21B](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm) and [D.22B](http://web.archive.org/web/20260311101223/https://service.unece.org/trade/untdid/d22b/tred/tred2379.htm) pages, archived, and mirrors of [D.93A](https://www.stylusstudio.com/edifact/D93A/2379.htm), D.96A, [D.01B](https://www.stylusstudio.com/edifact/D01B/2379.htm), [D.01C](https://www.stylusstudio.com/edifact/D01C/2379.htm), D.03A, [D.03B](https://www.stylusstudio.com/edifact/D03B/2379.htm), [D.04B](https://www.stylusstudio.com/edifact/D04B/2379.htm), [D.11B](https://www.edifactory.de/edifact/directory/D11B/data-element/2379), [D.12A](https://www.edifactory.de/edifact/directory/D12A/data-element/2379) and [D.13B](https://www.edifactory.de/edifact/directory/D13B/data-element/2379). The live UNECE host refuses automated requests. No mask of a code GMT reads changed across them. `205`, `406` and `719` are absent from D.93A and D.96A; `206`–`209` are absent from D.11B and present from D.12A; `711` is gone from D.03B |
| `205`–`209` and `406` carry a signed `HHMM` offset from UTC | UNTDID 2379. `205` and `406`: "offset from Coordinated Universal Time (UTC)". `206`–`209`, from D.12A: "Z = leading plus/minus sign, HHMM = difference to UTC in Hours and Minutes" |
| A period is transmitted without a hyphen, and a hyphenated value is rejected | UNTDID 2379, every directory read. D.93A to D.01B: `713`, `717` "Format of period to be given in actual message without hyphen."; `718` "Format of period to be given without hyphen." From D.01C: `713`, `717`, `718` "Data is to be transmitted as consecutive characters without hyphen." `719`, in every directory that has it: "Format of period to be given in actual message without hyphen." |
| `ZZZ` of `±HH` is a UTC offset in hours | [UN/ECE Recommendation 7](http://web.archive.org/web/20201020110807/http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec07/rec07_1988_inf108.pdf) ¶12: the difference is appended "in hours and minutes, or hours only, with a leading "+" or "-" sign", with the examples `+01` and `-05`; [SMDG IFTSAI 2.0 (draft)](https://smdg.org/wp-content/uploads/MIGs/Schedules/Draft-IFTSAI20.pdf) § DTM, which applies Recommendation 7 to `303` |
| `ZZZ` of `UTC` or `GMT` is UTC | **GMT rule**, resting on two sources. SMDG IFTSAI 2.0 and [SMDG BAPLIE 3.1.1](https://smdg.org/wp-content/uploads/MIGs/BAPLIE/BAPLIE3.1.1-02.pdf) write `UTC` in a `303` value. Recommendation 7 ¶12: "Co-ordinated Universal Time (formerly known as Greenwich Mean Time)" |
| Any other three upper-case letters are `zone` text, and nothing else is a zone | **GMT rule.** No UN/EDIFACT text defines an abbreviation, so GMT returns the letters and asserts nothing about them. A sign-led or numeric field that is not a valid hour is a broken offset, and parsers reject. Lower case is rejected because every published example is upper case; the syntax rules themselves allow lower case at level B. A lone `Z` is rejected because the mask has three characters, a variable-length element carries no trailing spaces ([UN/EDIFACT syntax rules](http://web.archive.org/web/20151228090930/http://www.unece.org/trade/untdid/texts/d422_d.htm) §7), and no guide writes it |
| A zone is always written `±HH`; zero is written `+00` and `+0000`; `-00` and `-0000` are read as `+00:00` | **GMT rule.** One spelling for one fact, in the form Recommendation 7 ¶12 gives. `toOffsetInstant` treats a negative zero offset the same way |
| `?` releases a service character | [UN/EDIFACT syntax rules, UNTDID Part 4 Chapter 2.2](http://web.archive.org/web/20151228090930/http://www.unece.org/trade/untdid/texts/d422_d.htm): "? immediately preceding one of the characters ' + : ? restores their normal meaning." The ISO 9735 text was not reached |
| Elements 373 and 337: formats and ranges | X12 data elements [373](https://www.stedi.com/edi/x12-005010/element/373) and [337](https://www.stedi.com/edi/x12-005010/element/337), release 005010. 337: "HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD … D = tenths (0-9) and DD = hundredths (00-99)" |
| A time code needs a time | X12 `DTM` syntax note C0403, "If DTM-04 is present, then DTM-03 is required" ([DTM, 005010](https://www.stedi.com/edi/x12-005010/segment/DTM)), and `AT7` C0706. **GMT rule** for `G62`, which has no such note |
| A blank time code means local to the event | X12 `AT7` segment: "If AT707 is not present then AT706 represents local time of the status" ([AT7, 005010](https://www.stedi.com/edi/x12-005010/segment/AT7)). **GMT rule** for `DTM` and `G62`, which do not say what an absent time code means. Either way the result states no offset |
| A date alone or a time alone is read; neither is `null` | X12 `G62` R0103, "At least one of G62-01 or G62-03 is required", with P0102 and P0304 pairing each qualifier to its value; `DTM` R020305, "At least one of DTM-02, DTM-03 or DTM-05 is required". `AT7` C0605 forbids a time without a date. **GMT rule:** the function is not told the segment, so it reads a time alone wherever it came from, and with neither there is nothing to read. A time alone yields no instant |
| An absent optional element is an empty string | **GMT rule.** An X12 element that is not sent is empty between its delimiters, so a caller reading a split segment holds `""` |
| 623 time codes, including the descending `13`–`24` run | X12 data element 623, [release 008010](https://www.stedi.com/edi/x12-008010/element/623): 56 codes. [Release 005010](https://www.stedi.com/edi/x12-005010/element/623) has 51; `25`–`29` first appear in 006010 |
| `GM` returns `+00:00` | **GMT rule.** X12 defines `GM` only by the name "Greenwich Mean Time". Recommendation 7 ¶12 equates it with UTC |
| 1250 format codes | X12 data element 1250, [release 005010](https://www.stedi.com/edi/x12-005010/element/1250): 42 codes, the same list in 008010 |
| An X12 range is transmitted with its hyphen | X12 data element 1250: each range code's definition gives the format with the hyphen ("Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD") and, unlike UNTDID 2379, carries no instruction to omit it |
| `eventTimeZoneOffset` grammar and range | GS1 EPCIS 2.0 [JSON schema](https://ref.gs1.org/standards/epcis/epcis-json-schema.json) pattern; [EPCIS Standard 2.0](https://ref.gs1.org/standards/epcis/) §7.4.1: the hour is "within the range 00 through 14 (inclusive) … except that if the value of the first two digits is 14, the value of the second two digits must be 00" |
| `eventTime` grammar | GS1 EPCIS 2.0 [XSD](https://ref.gs1.org/standards/epcis/epcglobal-epcis-2_0.xsd) `DateTimeStamp`. The JSON schema says only `format: date-time` |
| Both EPCIS fields are required | The JSON schema's `required` and the XSD's element declarations |
| The offset inside `eventTime` need not match `eventTimeZoneOffset` | EPCIS Standard 2.0 §7.4.1.1, which the standard marks non-normative: "there is no requirement that the time zone specifier in the XML representation of eventTime be the local time zone offset where the event was captured". Neither binding's grammar ties the two |
| An `eventTime` fraction longer than nine digits is refused | **GMT rule.** The XSD allows any length; Temporal holds nanoseconds, and a parser must not silently truncate |
| A two-digit year needs a caller-stated century window | **GMT rule.** UNTDID 2379 and X12 1250 define `YY` and name no century. A cut-off fixed in the library expires, and one that slides with today's date makes one stored message parse two ways in two years. The caller knows whether the data is live or stored, so the caller states the window: a fixed start year, or `"rolling"` |
| A rolling window runs from 50 years before the current UTC year to 49 after | **GMT rule**, year-granular. RFC 9110 §5.6.7 applies the same 50-year idea to the two-digit year of an obsolete HTTP date |
| A field out of range, or a day the year does not have, is rejected | TC39 Temporal `overflow: "reject"`; [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics) |
| A value is written only when the code holds it exactly | **GMT rule.** Rounding a time or an offset to fit a mask would put a different moment on the wire |
| A time with an offset and no date (`404`, `209`) yields no instant | **GMT rule.** An instant needs a date |
| `EH` is never resolved to a date | **GMT rule.** One digit of a year names ten years in every century |
| A period whose end precedes its start is `null`, when both ends carry a date | **GMT rule.** A reversed dated period names no span of time; the range validators reject one the same way. `DDT` and `DTD` compare by calendar date |
| A time-only range may end before it starts | **GMT rule.** `RTM` carries no date, so `2200-0600` is a window that crosses midnight, not a reversed one. The parser returns both times as written and does not say which day either falls on |
| A date-only code returns `date`, not `local` | **GMT rule.** A date names no instant in any zone, and `resolveLocal` takes a date-time |
| A period is written from `<start>/<end>` | UN/ECE Recommendation 7 ¶14: "the beginning, respectively, the end of a period of time, separated by a solidus" |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the instant-plus-offset pair
- `resolveLocal` from CORE-4 — resolving an offsetless local time once the caller supplies a zone
- `isValidDate`, `isValidDateTime`, `isValidTime` — the ISO values the formatters take
- `internal/utcOffsetString.ts` — parsing and writing a UTC offset through Temporal
- `regex/utc-offset` — the `±HH:MM` shape every `offset` result has

## Verification

- `parseEdifactDtm('202406151430', '203')` returns `local` with no `instant`
- `parseEdifactDtm('202406151430+0200', '205')` and `'20240615143000+0200'` with `'208'` return `instant` and `offset: '+02:00'`; `'143000+0200'` with `'209'` returns `time` and `offset` and no `instant`
- `parseEdifactDtm('202406151430+02', '303')`, `'…UTC'` and `'…GMT'` return `instant` and `offset`; `'…CET'` returns `local` and `zone: 'CET'` with no `offset`; `'…+24'`, `'…000'`, `'…cet'` and `'…?+02'` return the sentinel
- `parseEdifactDtm('2024061520240620', '718')` returns a `date` and a `periodEnd.date`; the hyphenated form and a reversed period return the sentinel
- `parseEdifactDtm('240615', '101')` returns the sentinel; with `{ yearWindow: 2000 }` it returns `2024-06-15`; `'690101'` returns `2069-01-01` with a window starting 2000 and `1969-01-01` with one starting 1969; a `yearWindow` that is neither `"rolling"` nor an integer from 0 to 9900 returns the sentinel
- With `{ yearWindow: 'rolling' }` and the clock faked, `'990615'` reads as 1999 on 2026-10-07 and on 2049-12-31, and as 2099 on 2050-01-01; with `{ yearWindow: 1950 }` it reads as 1999 on all three
- `formatEdifactDtm('1969-01-01', '101', { yearWindow: 2000 })` returns the sentinel: the year is outside the window
- `parseEdifactDtm('20240615', '102')` returns the same result with and without `yearWindow`, and with a clock that throws
- `formatEdifactDtm` round-trips every supported code and never writes a hyphen
- An unsupported format code returns the sentinel rather than guessing a format
- `parseX12DateTime('20240615', '1430', 'ET')` returns `local` with `zone: 'Eastern'`, `daylight: null` and no `offset`; with `'UT'` it returns `offset: '+00:00'` and an `instant`; with no time code it returns `local` alone; `'20240615'` alone returns a `date`
- `parseX12DateTime('20240615', '14300012')` returns `time: '14:30:00.12'`; a time code with no time returns the sentinel; `''` and an omitted argument give the same result
- `parseX12DateTime('', '1430', 'UT')` returns `time` and `offset` with no `local` and no `instant`; no date and no time returns the sentinel
- `parseX12DateTimePeriod('20240615', 'D8')` returns a `date`; `'20240615-20240620'` with `'RD8'` returns a period; the unhyphenated form and `'20240620-20240615'` return the sentinel
- `parseX12DateTimePeriod('2200-0600', 'RTM')` returns `time: '22:00:00'` and `periodEnd.time: '06:00:00'`, and `formatX12DateTimePeriod('22:00/06:00', 'RTM')` returns `'2200-0600'`
- `parseX12DateTimePeriod('20240615143000', 'RTS')` returns one local date-time, not a range; `'166'` with `'TC'` returns `{ dayOfYear: 166 }`; `'24366'` with `'TU'` and `{ yearWindow: 2000 }` returns `date: '2024-12-31'` and `dayOfYear: 366`, `'23366'` returns the sentinel, and either without a window returns the sentinel; `'UN'` returns the sentinel
- `x12TimeCode('ES')` returns `{ zone: 'Eastern', daylight: false }` and no offset; `'ED'` returns `daylight: true`; `'ET'` returns `daylight: null`; `'UT'` and `'GM'` return `{ offset: '+00:00' }`; `'01'` returns `+01:00`, `'13'` returns `-12:00` and `'24'` returns `-01:00` (the descending run, asserted); `'27'` returns `+05:30`; an unknown code returns the sentinel
- `parseDateWithPattern('2024-03-15', 'yyyy-MM-dd', undefined, { yearWindow: 'rolling' })` returns `2024-03-15` with a clock that throws
- `parseEpcisEvent` preserves the original offset through a round-trip, including a negative offset
- An EPCIS event missing `eventTimeZoneOffset`, or carrying `Z` or `+0200` there, returns the sentinel
- Each `isValid*` value validator agrees with its parser on every row above
- `pnpm run validate` stays green
