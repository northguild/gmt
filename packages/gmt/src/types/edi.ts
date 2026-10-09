/**
 * The UN/EDIFACT data element 2379 (Date or time or period format code) value that states a
 * calendar date. The mask and description are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * - `102` `CCYYMMDD`: "Calendar date: C = Century ; Y = Year ; M = Month ; D = Day."
 *
 * Taken by `parseEdifactDate`, `formatEdifactDate` and `isValidEdifactDate`.
 */
export type EdifactDateFormat = "102";

/**
 * The UN/EDIFACT data element 2379 values that state a time of day with no date and no offset.
 * Masks and descriptions are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * - `401` `HHMM`: "Time without seconds: H = Hour; m = Minute."
 * - `402` `HHMMSS`: "Time with seconds: H = Hour; m = Minute; s = Seconds."
 *
 * Taken by `parseEdifactTime`, `formatEdifactTime` and `isValidEdifactTime`.
 */
export type EdifactTimeFormat = "401" | "402";

/**
 * The UN/EDIFACT data element 2379 values that state a date and a time with no offset: a local
 * time at a place the value does not name. Masks and descriptions are the UNTDID directory's,
 * read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * - `203` `CCYYMMDDHHMM`: "Calendar date including time with minutes".
 * - `204` `CCYYMMDDHHMMSS`: "Calendar date including time with seconds".
 *
 * Taken by `parseEdifactDateTime`, `formatEdifactDateTime` and `isValidEdifactDateTime`.
 */
export type EdifactDateTimeFormat = "203" | "204";

/**
 * The UN/EDIFACT data element 2379 values that state a date and a time with an offset from UTC.
 * Masks and descriptions are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * - `205` `CCYYMMDDHHMMZHHMM`: "Calendar date including time and time zone expressed in hours
 *   and minutes."
 * - `208` `CCYYMMDDHHMMSSZHHMM`: "Calendar date including time with seconds, with Time Zone",
 *   where "Z = leading plus/minus sign, HHMM = difference to UTC in Hours and Minutes". In
 *   directories D.12A and later.
 * - `303` `CCYYMMDDHHMMZZZ`: "See 203 plus Z=Time zone."
 * - `304` `CCYYMMDDHHMMSSZZZ`: "See 204 plus Z=Time zone."
 *
 * The three `ZZZ` characters of `303` and `304` are read as an offset only: a signed hour
 * (`+02`, `-05`) or the literals `UTC` and `GMT`. Taken by `parseEdifactOffsetDateTime`,
 * `formatEdifactOffsetDateTime` and `isValidEdifactOffsetDateTime`.
 */
export type EdifactOffsetDateTimeFormat = "205" | "208" | "303" | "304";

/**
 * The UN/EDIFACT data element 2379 value that states a period between two calendar dates. The
 * mask and description are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * - `718` `CCYYMMDD-CCYYMMDD`: "A period of time specified by giving the start date followed by
 *   the end date (both including century). Data is to be transmitted as consecutive characters
 *   without hyphen."
 *
 * Taken by `parseEdifactDatePeriod`, `formatEdifactDatePeriod` and `isValidEdifactDatePeriod`.
 */
export type EdifactDatePeriodFormat = "718";

/**
 * The UN/EDIFACT data element 2379 value that states a period between two local date-times.
 * The mask and description are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * - `719` `CCYYMMDDHHMM-CCYYMMDDHHMM`: "A period of time which includes the century, year,
 *   month, day, hour and minute. Format of period to be given in actual message without
 *   hyphen."
 *
 * Taken by `parseEdifactDateTimePeriod`, `formatEdifactDateTimePeriod` and
 * `isValidEdifactDateTimePeriod`.
 */
export type EdifactDateTimePeriodFormat = "719";

/**
 * The UN/EDIFACT data element 2379 (Date or time or period format code) values GMT reads and
 * writes: 11 codes, each in the union of the one kind of value it states. Twelve directories
 * were read: UNECE's own
 * [D.21B](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm)
 * and
 * [D.22B](http://web.archive.org/web/20260311101223/https://service.unece.org/trade/untdid/d22b/tred/tred2379.htm)
 * pages, archived, and mirrors of D.93A, D.96A, D.01B, D.01C, D.03A, D.03B, D.04B, D.11B, D.12A
 * and D.13B. No mask of a code GMT reads changed across them.
 *
 * Every other 2379 code returns the sentinel from every function. Among them:
 *
 * - The codes with a two-digit year, `101`, `201`, `202`, `206`, `207`, `301`, `302`, `713` and
 *   `717`: no standard says which century `YY` belongs to. Read one with `parseDateWithPattern`
 *   or `parseDateTimeWithPattern`, a `yy` pattern and its `yearWindow` option.
 * - `209` and `404` (a time with an offset and no date) and `406` (an offset alone): none names
 *   a date, a time, a date-time or an instant.
 * - The day-first and month-first forms `2`–`5`, `10` (`CCYYMMDDTHHMM`), the week date `103`,
 *   the ordinal date `105`, the time period `210`, `307` (milliseconds), the zoned period `308`,
 *   the time spans `501`–`503`, `711`, the partial values (a century, a year, a month, a week or
 *   a day of month alone), the weekday period `720` and the quantities (`801` and up).
 *
 * Narrow a candidate with `isValidEdifactDtmFormat`, and name its kind with
 * `classifyEdifactDtmFormat`.
 */
export type EdifactDtmFormat =
  | EdifactDateFormat
  | EdifactTimeFormat
  | EdifactDateTimeFormat
  | EdifactOffsetDateTimeFormat
  | EdifactDatePeriodFormat
  | EdifactDateTimePeriodFormat;

/**
 * A UN/EDIFACT data element 2379 format code with the kind of value it states: the result of
 * `classifyEdifactDtmFormat`.
 *
 * The two members are tied together: testing `kind` narrows `format` to that kind's own union,
 * so a code that arrived as a plain string can be passed to the kind's parser, formatter and
 * validator with no cast.
 */
export type EdifactDtmFormatClass =
  | {
      /** The kind of value the code states: a calendar date, read by `parseEdifactDate`. */
      kind: "date";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: EdifactDateFormat;
    }
  | {
      /** The kind of value the code states: a time of day, read by `parseEdifactTime`. */
      kind: "time";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: EdifactTimeFormat;
    }
  | {
      /** The kind of value the code states: a local date and time, read by `parseEdifactDateTime`. */
      kind: "dateTime";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: EdifactDateTimeFormat;
    }
  | {
      /** The kind of value the code states: a date and time with an offset from UTC, read by `parseEdifactOffsetDateTime`. */
      kind: "offsetDateTime";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: EdifactOffsetDateTimeFormat;
    }
  | {
      /** The kind of value the code states: a period between two dates, read by `parseEdifactDatePeriod`. */
      kind: "datePeriod";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: EdifactDatePeriodFormat;
    }
  | {
      /** The kind of value the code states: a period between two local date-times, read by `parseEdifactDateTimePeriod`. */
      kind: "dateTimePeriod";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: EdifactDateTimePeriodFormat;
    };

/**
 * The X12 data element 1250 (Date Time Period Format Qualifier) values that state a calendar
 * date. Release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * - `D8` `CCYYMMDD`: "Date Expressed in Format CCYYMMDD".
 * - `DB` `MMDDCCYY`: "Date Expressed in Format MMDDCCYY".
 *
 * Taken by `parseX12Date`, `formatX12Date` and `isValidX12Date`.
 */
export type X12DateFormat = "D8" | "DB";

/**
 * The X12 data element 1250 values that state a time of day. Release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * - `TM` `HHMM`: "Time Expressed in Format HHMM".
 * - `TS` `HHMMSS`: "Time Expressed in Format HHMMSS".
 *
 * Taken by `formatX12Time`, and by `parseX12Time` and `isValidX12Time` as their optional
 * qualifier. Both are also forms of data element 337 (Time), which `parseX12Time` reads when no
 * qualifier is given. `TS` is a code of data element 623 too (`X12TimeCode`), where it means
 * Atlantic Standard Time.
 */
export type X12TimeFormat = "TM" | "TS";

/**
 * The X12 data element 1250 values that state a date and a time with no offset: a local time at
 * a place the value does not name. Release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * - `DT` `CCYYMMDDHHMM`: "Date and Time Expressed in Format CCYYMMDDHHMM".
 * - `RTS` `CCYYMMDDHHMMSS`: "Date and Time Expressed in Format CCYYMMDDHHMMSS". One date-time,
 *   despite the `R`.
 *
 * Taken by `parseX12DateTime`, `formatX12DateTime` and `isValidX12DateTime`.
 */
export type X12DateTimeFormat = "DT" | "RTS";

/**
 * The X12 data element 1250 values that state a range between two calendar dates, transmitted
 * with its hyphen. Release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * - `RD8` `CCYYMMDD-CCYYMMDD`: "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD".
 * - `RD` `MMDDCCYY-MMDDCCYY`: "Range of Dates Expressed in Format MMDDCCYY-MMDDCCYY".
 *
 * Taken by `parseX12DateRange`, `formatX12DateRange` and `isValidX12DateRange`.
 */
export type X12DateRangeFormat = "RD8" | "RD";

/**
 * The X12 data element 1250 values that state a range between two local date-times,
 * transmitted with its hyphen. Release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * - `RDT` `CCYYMMDDHHMM-CCYYMMDDHHMM`: "Range of Date and Time, Expressed in Format
 *   CCYYMMDDHHMM-CCYYMMDDHHMM".
 * - `DTS` `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS`: "Range of Date and Time Expressed in Format
 *   CCYYMMDDHHMMSS-CCYYMMDDHHMMSS". A range, despite having no `R`.
 *
 * Taken by `parseX12DateTimeRange`, `formatX12DateTimeRange` and `isValidX12DateTimeRange`.
 */
export type X12DateTimeRangeFormat = "RDT" | "DTS";

/**
 * The X12 data element 1250 (Date Time Period Format Qualifier) values GMT reads and writes: 10
 * codes, each in the union of the one kind of value it states. Release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached. The 42-code list is the same in release 008010.
 *
 * The other 32 codes of the element return the sentinel from every function. Among them:
 *
 * - The codes with a two-digit year, `D6`, `TT`, `TR`, `RD6` and `TU`: X12 does not say which
 *   century `YY` belongs to. Read one with `parseDateWithPattern` or `parseDateTimeWithPattern`,
 *   a `yy` pattern and its `yearWindow` option.
 * - `TC` and `EH` (a day of the year with no whole year), `DDT` and `DTD` (a range with a date
 *   on one side and a date-time on the other), `RTM` (a range of times with no date) and `UN`
 *   (Unstructured).
 * - `CC`, `CD`, `CM`, `CQ`, `CY`, `DA`, `DD`, `KA`, `MCY`, `MD`, `MM`, `RD2`, `RD4`, `RD5`,
 *   `RDM`, `RMD`, `RMY`, `TQ`, `YM`, `YMM` and `YY`.
 *
 * Narrow a candidate with `isValidX12DateTimePeriodFormat`, and name its kind with
 * `classifyX12DateTimePeriodFormat`.
 */
export type X12DateTimePeriodFormat =
  | X12DateFormat
  | X12TimeFormat
  | X12DateTimeFormat
  | X12DateRangeFormat
  | X12DateTimeRangeFormat;

/**
 * An X12 data element 1250 format qualifier with the kind of value it states: the result of
 * `classifyX12DateTimePeriodFormat`.
 *
 * The two members are tied together: testing `kind` narrows `format` to that kind's own union,
 * so a code that arrived as a plain string can be passed to the kind's parser, formatter and
 * validator with no cast.
 */
export type X12DateTimePeriodFormatClass =
  | {
      /** The kind of value the code states: a calendar date, read by `parseX12Date`. */
      kind: "date";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: X12DateFormat;
    }
  | {
      /** The kind of value the code states: a time of day, read by `parseX12Time(value, format)`. */
      kind: "time";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: X12TimeFormat;
    }
  | {
      /** The kind of value the code states: a local date and time, read by `parseX12DateTime`. */
      kind: "dateTime";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: X12DateTimeFormat;
    }
  | {
      /** The kind of value the code states: a range between two dates, read by `parseX12DateRange`. */
      kind: "dateRange";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: X12DateRangeFormat;
    }
  | {
      /** The kind of value the code states: a range between two local date-times, read by `parseX12DateTimeRange`. */
      kind: "dateTimeRange";
      /** The code itself, narrowed to the codes of that kind, so it fits the kind's functions. */
      format: X12DateTimeRangeFormat;
    };

/**
 * The 56 X12 data element 623 (Time Code) values, release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 *
 * [Release 005010](https://www.stedi.com/edi/x12-005010/element/623) has 51 of them: `25`–`29`
 * were added in release 006010 and are not valid in an 004010 or 005010 interchange. The type
 * names no release, so it is the superset.
 *
 * - `01`–`12`: UTC+1 through UTC+12 ("Equivalent to ISO P01" … `P12`).
 * - `13`–`24`: UTC−12 through UTC−1, in **descending** order (`M12` … `M01`): `13` is UTC−12 and
 *   `24` is UTC−1.
 * - `25`–`29`: the half-hour offsets `M2:30`, `M3:30`, `P5:30`, `P9:30`, `P10:30`.
 * - `UT` ("Universal Time Coordinate") and `GM` ("Greenwich Mean Time"): UTC.
 * - `AD`/`AS`/`AT` Alaska, `CD`/`CS`/`CT` Central, `ED`/`ES`/`ET` Eastern, `HD`/`HS`/`HT`
 *   Hawaii-Aleutian, `MD`/`MS`/`MT` Mountain, `ND`/`NS`/`NT` Newfoundland, `PD`/`PS`/`PT`
 *   Pacific, `TD`/`TS`/`TT` Atlantic: a named zone, daylight (`D`), standard (`S`) or unstated
 *   (`T`). X12 states no offset for these.
 * - `LT`: local time of the event, whose place is elsewhere in the message.
 *
 * `TS`, `TT`, `CD` and `MD` are also codes of data element 1250, where they mean something
 * unrelated: `TS` there is the format `HHMMSS` (`X12TimeFormat`). Narrow a candidate with
 * `isValidX12TimeCode`; `X12OffsetTimeCode` and `X12ZoneTimeCode` split the list in two, and
 * `classifyX12TimeCode` says which of the two a code belongs to.
 */
export type X12TimeCode =
  // fallow-ignore-next-line code-duplication -- the 56 DE 623 codes in type position; `X12_TIME_CODES` in internal/ediGrammar.ts is the same enumeration as a runtime list
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24"
  | "25"
  | "26"
  | "27"
  | "28"
  | "29"
  | "AD"
  | "AS"
  | "AT"
  | "CD"
  | "CS"
  | "CT"
  | "ED"
  | "ES"
  | "ET"
  | "GM"
  | "HD"
  | "HS"
  | "HT"
  | "LT"
  | "MD"
  | "MS"
  | "MT"
  | "ND"
  | "NS"
  | "NT"
  | "PD"
  | "PS"
  | "PT"
  | "TD"
  | "TS"
  | "TT"
  | "UT";

/**
 * The 31 X12 data element 623 time codes that state an offset from UTC, the codes
 * `x12TimeCodeOffset` reads. Release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 *
 * - `01`–`12`: UTC+1 through UTC+12 ("Equivalent to ISO P01" … `P12`).
 * - `13`–`24`: UTC−12 through UTC−1, in **descending** order (`M12` … `M01`): `13` is UTC−12 and
 *   `24` is UTC−1.
 * - `25`–`29`: the half-hour offsets `M2:30`, `M3:30`, `P5:30`, `P9:30`, `P10:30`. Added in
 *   release 006010.
 * - `UT` ("Universal Time Coordinate") and `GM` ("Greenwich Mean Time"): UTC.
 */
export type X12OffsetTimeCode =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24"
  | "25"
  | "26"
  | "27"
  | "28"
  | "29"
  | "GM"
  | "UT";

/**
 * The 25 X12 data element 623 time codes that name a zone and state no offset, the codes
 * `x12TimeCodeZone` reads. Release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 *
 * - `AD`/`AS`/`AT` Alaska, `CD`/`CS`/`CT` Central, `ED`/`ES`/`ET` Eastern, `HD`/`HS`/`HT`
 *   Hawaii-Aleutian, `MD`/`MS`/`MT` Mountain, `ND`/`NS`/`NT` Newfoundland, `PD`/`PS`/`PT`
 *   Pacific, `TD`/`TS`/`TT` Atlantic: daylight (`D`), standard (`S`) or unstated (`T`).
 * - `LT`: local time of the event, whose place is elsewhere in the message.
 */
export type X12ZoneTimeCode =
  | "AD"
  | "AS"
  | "AT"
  | "CD"
  | "CS"
  | "CT"
  | "ED"
  | "ES"
  | "ET"
  | "HD"
  | "HS"
  | "HT"
  | "LT"
  | "MD"
  | "MS"
  | "MT"
  | "ND"
  | "NS"
  | "NT"
  | "PD"
  | "PS"
  | "PT"
  | "TD"
  | "TS"
  | "TT";

/**
 * The zone an X12 data element 623 time code names: the result of `x12TimeCodeZone`. X12 states
 * no offset for a named code, so the result carries none.
 */
export interface X12NamedZone {
  /**
   * X12's own name for the zone, as its definition writes it: `Alaska`, `Central`, `Eastern`,
   * `Hawaii-Aleutian`, `Mountain`, `Newfoundland`, `Pacific` or `Atlantic`, and `Local` for `LT`.
   * It is a name, not an IANA identifier and not an offset: the caller maps it to a zone.
   */
  zone: string;
  /**
   * Whether the code says daylight time. `true` for a `D` code (`ED`), `false` for an `S` code
   * (`ES`), and `null` for a code that says neither (`ET`, `LT`), where the date decides.
   */
  daylight: boolean | null;
}

/**
 * An X12 data element 623 time code with what it states: the result of `classifyX12TimeCode`.
 *
 * The two members are tied together: testing `kind` narrows `timeCode` to the codes of one
 * reader, so a code that arrived as a plain string can be passed to `x12TimeCodeOffset` or
 * `x12TimeCodeZone` with no cast.
 */
export type X12TimeCodeClass =
  | {
      /** The code states an offset from UTC: read it with `x12TimeCodeOffset`. */
      kind: "offset";
      /** The code itself, narrowed to the 31 codes that state an offset. */
      timeCode: X12OffsetTimeCode;
    }
  | {
      /** The code names a zone and states no offset: read it with `x12TimeCodeZone`. */
      kind: "zone";
      /** The code itself, narrowed to the 25 codes that name a zone. */
      timeCode: X12ZoneTimeCode;
    };

/**
 * A period between two calendar dates, as a UN/EDIFACT period (`718`) or an X12 range (`RD8`,
 * `RD`) states it: the result of `parseEdifactDatePeriod` and `parseX12DateRange`.
 *
 * Neither standard says whether the end date is inside the period: that is the message's to
 * define, so the two dates are returned as transmitted. The pair can be passed to the plain
 * interval functions as `(start, end)`, for example
 * `intervalLengthDate(period.start, period.end, "days")`; those functions leave `end` outside
 * the interval.
 */
export interface EdiDatePeriod {
  /** The date the period starts on, `YYYY-MM-DD`. */
  start: string;
  /** The date the period ends on, `YYYY-MM-DD`. It is never before `start`, and may equal it. */
  end: string;
}

/**
 * A period between two local date-times, as a UN/EDIFACT period (`719`) or an X12 range (`RDT`,
 * `DTS`) states it: the result of `parseEdifactDateTimePeriod` and `parseX12DateTimeRange`.
 *
 * Both ends are wall clocks at a place the value does not name: no code that states a period
 * carries an offset, so neither end is an instant. Neither standard says whether the end is
 * inside the period. The pair can be passed to the plain interval functions as `(start, end)`,
 * for example `intervalLengthDateTime(period.start, period.end, "hours")`; those functions leave
 * `end` outside the interval.
 */
export interface EdiDateTimePeriod {
  /** The local date-time the period starts at, `YYYY-MM-DDTHH:MM:SS`. Seconds are always written. */
  start: string;
  /**
   * The local date-time the period ends at, `YYYY-MM-DDTHH:MM:SS`. Seconds are always written. It
   * is never before `start`, and may equal it.
   */
  end: string;
}
