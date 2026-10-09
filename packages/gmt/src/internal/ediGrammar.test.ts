import * as root from "../index";
import * as regex from "../regex";
import type { EdifactDtmFormat, X12DateTimePeriodFormat } from "../types/edi";
import {
  EDIFACT_DTM_FORMATS,
  EDIFACT_DTM_GRAMMAR,
  X12_DATE_TIME_PERIOD_FORMATS,
  X12_DATE_TIME_PERIOD_GRAMMAR,
  X12_TIME_CODES,
  ediCodeOf,
  ediCodeOfKind,
} from "./ediGrammar";

// UNTDID data element 2379 and X12 data element 1250. Every entry proves shape only: month 01–12,
// day 01–31, hour 00–23, minute and second 00–59. Whether the day exists in its month is
// Temporal's job in `ediDateTimeFields.ts`.

describe("EDIFACT_DTM_GRAMMAR", () => {
  it.each`
    code     | value                         | reason
    ${"102"} | ${"20240615"}                 | ${"CCYYMMDD"}
    ${"102"} | ${"20230229"}                 | ${"a day the year does not have still matches: calendar validity is Temporal's"}
    ${"102"} | ${"00000101"}                 | ${"year 0000"}
    ${"203"} | ${"202406151430"}             | ${"CCYYMMDDHHMM"}
    ${"203"} | ${"202406152359"}             | ${"last minute of the day"}
    ${"204"} | ${"20240615143000"}           | ${"CCYYMMDDHHMMSS"}
    ${"204"} | ${"20240615235959"}           | ${"last second of the day"}
    ${"205"} | ${"202406151430+0200"}        | ${"CCYYMMDDHHMMZHHMM"}
    ${"205"} | ${"202406151430+0530"}        | ${"half-hour offset"}
    ${"205"} | ${"202406151430-0000"}        | ${"negative zero"}
    ${"208"} | ${"20240615143000+0200"}      | ${"CCYYMMDDHHMMSSZHHMM"}
    ${"208"} | ${"20240615143000-0530"}      | ${"western half-hour"}
    ${"303"} | ${"202406151430+02"}          | ${"ZZZ as ±HH (Rec 7 ¶12)"}
    ${"303"} | ${"202406151430-05"}          | ${"ZZZ as -05 (Rec 7 ¶12 example)"}
    ${"303"} | ${"202406151430+00"}          | ${"ZZZ as +00"}
    ${"303"} | ${"202406151430UTC"}          | ${"ZZZ as the literal UTC (SMDG)"}
    ${"303"} | ${"202406151430GMT"}          | ${"ZZZ as the literal GMT (Rec 7 ¶12)"}
    ${"304"} | ${"20240615143000+02"}        | ${"CCYYMMDDHHMMSSZZZ"}
    ${"401"} | ${"1430"}                     | ${"HHMM"}
    ${"401"} | ${"0000"}                     | ${"midnight"}
    ${"402"} | ${"143000"}                   | ${"HHMMSS"}
    ${"718"} | ${"2024061520240620"}         | ${"wire form"}
    ${"718"} | ${"2024062020240615"}         | ${"a reversed period still matches: ordering is the reader's"}
    ${"719"} | ${"202406151430202406201600"} | ${"wire form"}
  `("code $code matches $value ($reason)", ({ code, value }) => {
    expect(EDIFACT_DTM_GRAMMAR[code as EdifactDtmFormat].test(value)).toBe(
      true,
    );
  });

  it.each`
    code     | value                           | reason
    ${"102"} | ${"240615"}                     | ${"YYMMDD: a two-digit year is not read"}
    ${"102"} | ${"202406151430"}               | ${"203's value"}
    ${"102"} | ${"20241301"}                   | ${"month 13"}
    ${"102"} | ${"20240001"}                   | ${"month 00"}
    ${"102"} | ${"20240632"}                   | ${"day 32"}
    ${"102"} | ${"2024-06-15"}                 | ${"hyphens"}
    ${"102"} | ${" 20240615"}                  | ${"leading whitespace"}
    ${"102"} | ${"20240615 "}                  | ${"trailing whitespace"}
    ${"102"} | ${"20240615\n"}                 | ${"a trailing newline: $ is the end of the value, not of a line"}
    ${"102"} | ${"２０２４０６１５"}           | ${"full-width digits: a digit is 0–9"}
    ${"102"} | ${""}                           | ${"empty string"}
    ${"203"} | ${"20240615143000"}             | ${"204's value"}
    ${"203"} | ${"2406151430"}                 | ${"YYMMDDHHMM: a two-digit year is not read"}
    ${"203"} | ${"20240615"}                   | ${"102's value"}
    ${"203"} | ${"202406152400"}               | ${"hour 24"}
    ${"203"} | ${"202406151460"}               | ${"minute 60"}
    ${"203"} | ${"202413151430"}               | ${"month 13"}
    ${"203"} | ${"20240615T1430"}              | ${"T separator"}
    ${"203"} | ${"2024061514:30"}              | ${"colon in the time"}
    ${"203"} | ${" 202406151430"}              | ${"leading whitespace"}
    ${"203"} | ${"202406151430 "}              | ${"trailing whitespace"}
    ${"203"} | ${""}                           | ${"empty string"}
    ${"204"} | ${"202406151430"}               | ${"203's value"}
    ${"204"} | ${"20240615143060"}             | ${"second 60: GMT rejects a leap second"}
    ${"204"} | ${"20240615143000.5"}           | ${"fraction"}
    ${"205"} | ${"202406151430+02"}            | ${"303's value: ZZZ is three characters"}
    ${"205"} | ${"202406151430+02:00"}         | ${"colon in the offset"}
    ${"205"} | ${"202406151430Z"}              | ${"Z designator: 2379 has none"}
    ${"205"} | ${"202406151430+2400"}          | ${"offset hour 24"}
    ${"205"} | ${"202406151430+0260"}          | ${"offset minute 60"}
    ${"205"} | ${"20240615143000+0200"}        | ${"208's value: 205 has no seconds"}
    ${"208"} | ${"202406151430+0200"}          | ${"205's value: no seconds"}
    ${"208"} | ${"20240615143000+2400"}        | ${"offset hour 24"}
    ${"208"} | ${"20240615143000Z"}            | ${"Z designator: 2379 has none"}
    ${"205"} | ${"202406151430"}               | ${"203's value: no offset"}
    ${"205"} | ${"202406151430?+0200"}         | ${"release character"}
    ${"303"} | ${"202406151430"}               | ${"203's value: no zone"}
    ${"303"} | ${"202406151430+0200"}          | ${"205's value: ZHHMM"}
    ${"303"} | ${"20240615143000+02"}          | ${"304's value"}
    ${"303"} | ${"202406151430?+02"}           | ${"release character is not part of the element value"}
    ${"303"} | ${"202406151430utc"}            | ${"lower case"}
    ${"303"} | ${"202406151430PDT"}            | ${"an abbreviation: no UN/EDIFACT text defines one, so it is not read"}
    ${"303"} | ${"202406151430CET"}            | ${"an abbreviation"}
    ${"303"} | ${"202406151430UTZ"}            | ${"one letter off UTC is not UTC"}
    ${"303"} | ${"202406151430ZZZ"}            | ${"Z is not read as a UTC designator"}
    ${"303"} | ${"202406151430Z"}              | ${"a lone Z: the mask has three zone characters"}
    ${"304"} | ${"20240615143000CET"}          | ${"an abbreviation after seconds"}
    ${"303"} | ${"202406151430+24"}            | ${"ZZZ +24: a broken offset, not a zone name"}
    ${"303"} | ${"202406151430-99"}            | ${"ZZZ -99"}
    ${"303"} | ${"202406151430+-1"}            | ${"ZZZ of two signs and a digit"}
    ${"303"} | ${"202406151430---"}            | ${"ZZZ of signs alone"}
    ${"303"} | ${"202406151430000"}            | ${"ZZZ of digits alone"}
    ${"303"} | ${"202406151430A1B"}            | ${"ZZZ with a digit among letters"}
    ${"303"} | ${"202406151430+2"}             | ${"two-character zone"}
    ${"303"} | ${"202406152400+02"}            | ${"hour 24"}
    ${"303"} | ${" 202406151430+02"}           | ${"leading whitespace"}
    ${"303"} | ${"202406151430+02 "}           | ${"trailing whitespace"}
    ${"304"} | ${"20240615143000+0200"}        | ${"ZHHMM after seconds: the spec's own corrected 304 example"}
    ${"304"} | ${"202406151430+02"}            | ${"303's value"}
    ${"304"} | ${"20240615143000"}             | ${"204's value: no zone"}
    ${"304"} | ${"20240615143060+02"}          | ${"second 60"}
    ${"401"} | ${"143000"}                     | ${"402's value"}
    ${"401"} | ${"2400"}                       | ${"hour 24"}
    ${"401"} | ${"1460"}                       | ${"minute 60"}
    ${"401"} | ${"930"}                        | ${"unpadded hour"}
    ${"401"} | ${"14:30"}                      | ${"colon"}
    ${"401"} | ${""}                           | ${"empty string"}
    ${"402"} | ${"1430"}                       | ${"401's value"}
    ${"402"} | ${"143060"}                     | ${"second 60"}
    ${"718"} | ${"20240615-20240620"}          | ${"one hyphen: X12 RD8's wire form, never a 2379 one"}
    ${"718"} | ${"20240615--20240620"}         | ${"two hyphens"}
    ${"718"} | ${"20240615/20240620"}          | ${"solidus"}
    ${"718"} | ${"20240615"}                   | ${"102's value: one date"}
    ${"718"} | ${"240615240620"}               | ${"YYMMDD-YYMMDD: a two-digit year is not read"}
    ${"718"} | ${"2024061520241320"}           | ${"month 13 in the end"}
    ${"718"} | ${" 2024061520240620"}          | ${"leading whitespace"}
    ${"719"} | ${"2024061520240620"}           | ${"718's value: no times"}
    ${"719"} | ${"202406151430"}               | ${"203's value: one date-time"}
    ${"719"} | ${"202406152400202406201600"}   | ${"hour 24 in the start"}
    ${"719"} | ${"202406151430-202406201600"}  | ${"one hyphen: the mask's notation, never transmitted"}
    ${"719"} | ${"202406151430--202406201600"} | ${"two hyphens"}
  `("code $code rejects $value ($reason)", ({ code, value }) => {
    expect(EDIFACT_DTM_GRAMMAR[code as EdifactDtmFormat].test(value)).toBe(
      false,
    );
  });

  it.each`
    code     | value                         | groups
    ${"203"} | ${"202406151430"}             | ${["2024", "06", "15", "14", "30"]}
    ${"205"} | ${"202406151430+0530"}        | ${["2024", "06", "15", "14", "30", "+", "05", "30"]}
    ${"303"} | ${"202406151430+02"}          | ${["2024", "06", "15", "14", "30", "+02"]}
    ${"304"} | ${"20240615143000UTC"}        | ${["2024", "06", "15", "14", "30", "00", "UTC"]}
    ${"718"} | ${"2024061520240620"}         | ${["2024", "06", "15", "2024", "06", "20"]}
    ${"719"} | ${"202406151430202406201600"} | ${["2024", "06", "15", "14", "30", "2024", "06", "20", "16", "00"]}
  `("code $code captures $groups from $value", ({ code, value, groups }) => {
    expect(
      EDIFACT_DTM_GRAMMAR[code as EdifactDtmFormat].exec(value)?.slice(1),
    ).toEqual(groups);
  });
});

describe("X12_DATE_TIME_PERIOD_GRAMMAR", () => {
  it.each`
    code     | value                              | reason
    ${"D8"}  | ${"20240615"}                      | ${"CCYYMMDD"}
    ${"DB"}  | ${"06152024"}                      | ${"MMDDCCYY"}
    ${"DB"}  | ${"02292023"}                      | ${"a day the year does not have still matches: calendar validity is Temporal's"}
    ${"DT"}  | ${"202406151430"}                  | ${"CCYYMMDDHHMM"}
    ${"RTS"} | ${"20240615143000"}                | ${"CCYYMMDDHHMMSS, one date-time despite the R"}
    ${"TM"}  | ${"1430"}                          | ${"HHMM"}
    ${"TS"}  | ${"143000"}                        | ${"HHMMSS"}
    ${"RD8"} | ${"20240615-20240620"}             | ${"CCYYMMDD-CCYYMMDD"}
    ${"RD8"} | ${"20240620-20240615"}             | ${"a reversed range still matches: ordering is the reader's"}
    ${"RD"}  | ${"06152024-06202024"}             | ${"MMDDCCYY-MMDDCCYY"}
    ${"RDT"} | ${"202406151430-202406201600"}     | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}
    ${"DTS"} | ${"20240615143000-20240620160000"} | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS, a range despite having no R"}
  `("code $code matches $value ($reason)", ({ code, value }) => {
    expect(
      X12_DATE_TIME_PERIOD_GRAMMAR[code as X12DateTimePeriodFormat].test(value),
    ).toBe(true);
  });

  it.each`
    code     | value                              | reason
    ${"D8"}  | ${"240615"}                        | ${"YYMMDD: a two-digit year is not read"}
    ${"D8"}  | ${"06152024"}                      | ${"DB's value read as CCYYMMDD: 20 is not a month"}
    ${"D8"}  | ${"20240632"}                      | ${"day 32"}
    ${"D8"}  | ${""}                              | ${"empty string"}
    ${"D8"}  | ${"20240615\n"}                    | ${"a trailing newline: $ is the end of the value, not of a line"}
    ${"D8"}  | ${"2024-06-15"}                    | ${"an ISO 8601 date"}
    ${"DB"}  | ${"20240615"}                      | ${"D8's value: 20 is not a month"}
    ${"DB"}  | ${"13152024"}                      | ${"month 13"}
    ${"DB"}  | ${"06322024"}                      | ${"day 32"}
    ${"DB"}  | ${"6152024"}                       | ${"unpadded month"}
    ${"DB"}  | ${"061524"}                        | ${"MMDDYY: a two-digit year is not read"}
    ${"DB"}  | ${"06/15/2024"}                    | ${"separators"}
    ${"DB"}  | ${" 06152024"}                     | ${"leading whitespace"}
    ${"DB"}  | ${"06152024 "}                     | ${"trailing whitespace"}
    ${"DT"}  | ${"20240615143000"}                | ${"RTS's value"}
    ${"DT"}  | ${"202406152400"}                  | ${"hour 24"}
    ${"RTS"} | ${"202406151430"}                  | ${"DT's value"}
    ${"RTS"} | ${"20240615143060"}                | ${"second 60"}
    ${"TM"}  | ${"143000"}                        | ${"TS's value"}
    ${"TM"}  | ${"2400"}                          | ${"hour 24"}
    ${"TS"}  | ${"1430"}                          | ${"TM's value"}
    ${"TS"}  | ${"143060"}                        | ${"second 60"}
    ${"RD8"} | ${"2024061520240620"}              | ${"no hyphen: EDIFACT 718's wire form, not X12"}
    ${"RD8"} | ${"20240615--20240620"}            | ${"two hyphens"}
    ${"RD8"} | ${"20240615/20240620"}             | ${"solidus"}
    ${"RD8"} | ${"20240615"}                      | ${"D8's value"}
    ${"RD8"} | ${"240615-240620"}                 | ${"YYMMDD-YYMMDD: a two-digit year is not read"}
    ${"RD8"} | ${"20241315-20240620"}             | ${"month 13 in the start"}
    ${"RD8"} | ${" 20240615-20240620"}            | ${"leading whitespace"}
    ${"RD8"} | ${""}                              | ${"empty string"}
    ${"RD"}  | ${"0615202406202024"}              | ${"no hyphen"}
    ${"RD"}  | ${"20240615-20240620"}             | ${"RD8's order"}
    ${"RD"}  | ${"06152024"}                      | ${"DB's value"}
    ${"RDT"} | ${"202406151430202406201600"}      | ${"no hyphen: EDIFACT 719's wire form"}
    ${"RDT"} | ${"20240615-20240620"}             | ${"RD8's value"}
    ${"RDT"} | ${"202406151430"}                  | ${"DT's value"}
    ${"RDT"} | ${"202406152400-202406201600"}     | ${"hour 24 in the start"}
    ${"DTS"} | ${"2024061514300020240620160000"}  | ${"no hyphen"}
    ${"DTS"} | ${"202406151430-202406201600"}     | ${"RDT's value"}
    ${"DTS"} | ${"20240615143000"}                | ${"RTS's value"}
    ${"DTS"} | ${"20240615143060-20240620160000"} | ${"second 60 in the start"}
  `("code $code rejects $value ($reason)", ({ code, value }) => {
    expect(
      X12_DATE_TIME_PERIOD_GRAMMAR[code as X12DateTimePeriodFormat].test(value),
    ).toBe(false);
  });

  it.each`
    code     | value                              | groups
    ${"DB"}  | ${"06152024"}                      | ${["06", "15", "2024"]}
    ${"RD"}  | ${"06152024-06202024"}             | ${["06", "15", "2024", "06", "20", "2024"]}
    ${"DTS"} | ${"20240615143000-20240620160000"} | ${["2024", "06", "15", "14", "30", "00", "2024", "06", "20", "16", "00", "00"]}
  `("code $code captures $groups from $value", ({ code, value, groups }) => {
    expect(
      X12_DATE_TIME_PERIOD_GRAMMAR[code as X12DateTimePeriodFormat]
        .exec(value)
        ?.slice(1),
    ).toEqual(groups);
  });
});

describe("code lists", () => {
  it("EDIFACT_DTM_FORMATS is the 11 supported 2379 codes, each with a grammar", () => {
    expect([...EDIFACT_DTM_FORMATS]).toEqual([
      "102",
      "203",
      "204",
      "205",
      "208",
      "303",
      "304",
      "401",
      "402",
      "718",
      "719",
    ]);
    expect(Object.keys(EDIFACT_DTM_GRAMMAR).sort()).toEqual(
      [...EDIFACT_DTM_FORMATS].sort(),
    );
  });

  it("X12_DATE_TIME_PERIOD_FORMATS is the 10 supported 1250 codes, each with a grammar", () => {
    expect([...X12_DATE_TIME_PERIOD_FORMATS]).toEqual([
      "D8",
      "DB",
      "DT",
      "RTS",
      "TM",
      "TS",
      "RD8",
      "RD",
      "RDT",
      "DTS",
    ]);
    expect(Object.keys(X12_DATE_TIME_PERIOD_GRAMMAR).sort()).toEqual(
      [...X12_DATE_TIME_PERIOD_FORMATS].sort(),
    );
  });

  it("X12_TIME_CODES is the 56 DE 623 codes: 01–29 then the letter codes", () => {
    const numeric = Array.from({ length: 29 }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
    expect([...X12_TIME_CODES]).toEqual([
      ...numeric,
      "AD",
      "AS",
      "AT",
      "CD",
      "CS",
      "CT",
      "ED",
      "ES",
      "ET",
      "GM",
      "HD",
      "HS",
      "HT",
      "LT",
      "MD",
      "MS",
      "MT",
      "ND",
      "NS",
      "NT",
      "PD",
      "PS",
      "PT",
      "TD",
      "TS",
      "TT",
      "UT",
    ]);
    expect(X12_TIME_CODES).toHaveLength(56);
  });

  it.each`
    table                             | grammar
    ${"EDIFACT_DTM_GRAMMAR"}          | ${EDIFACT_DTM_GRAMMAR}
    ${"X12_DATE_TIME_PERIOD_GRAMMAR"} | ${X12_DATE_TIME_PERIOD_GRAMMAR}
  `(
    "every $table entry is anchored at both ends with no flags",
    ({ grammar }) => {
      for (const pattern of Object.values(grammar as Record<string, RegExp>)) {
        expect(pattern.source.startsWith("^")).toBe(true);
        expect(pattern.source.endsWith("$")).toBe(true);
        expect(pattern.flags).toBe("");
      }
    },
  );
});

describe("ediCodeOf", () => {
  // The mask of each row is the standard's own (UNTDID 2379; X12 1250 release 005010), written
  // as this file's part names: `MI` is the minute, `ZS`/`ZH`/`ZM` the `ZHHMM` offset. `kind` is
  // what the mask states, and `valueKind` is what each half of it is: a period of dates is two
  // dates.
  it.each`
    standard     | code     | kind                | valueKind           | start                                                       | end
    ${"edifact"} | ${"102"} | ${"date"}           | ${"date"}           | ${["CCYY", "MM", "DD"]}                                     | ${undefined}
    ${"edifact"} | ${"203"} | ${"dateTime"}       | ${"dateTime"}       | ${["CCYY", "MM", "DD", "HH", "MI"]}                         | ${undefined}
    ${"edifact"} | ${"204"} | ${"dateTime"}       | ${"dateTime"}       | ${["CCYY", "MM", "DD", "HH", "MI", "SS"]}                   | ${undefined}
    ${"edifact"} | ${"205"} | ${"offsetDateTime"} | ${"offsetDateTime"} | ${["CCYY", "MM", "DD", "HH", "MI", "ZS", "ZH", "ZM"]}       | ${undefined}
    ${"edifact"} | ${"208"} | ${"offsetDateTime"} | ${"offsetDateTime"} | ${["CCYY", "MM", "DD", "HH", "MI", "SS", "ZS", "ZH", "ZM"]} | ${undefined}
    ${"edifact"} | ${"303"} | ${"offsetDateTime"} | ${"offsetDateTime"} | ${["CCYY", "MM", "DD", "HH", "MI", "ZZZ"]}                  | ${undefined}
    ${"edifact"} | ${"304"} | ${"offsetDateTime"} | ${"offsetDateTime"} | ${["CCYY", "MM", "DD", "HH", "MI", "SS", "ZZZ"]}            | ${undefined}
    ${"edifact"} | ${"401"} | ${"time"}           | ${"time"}           | ${["HH", "MI"]}                                             | ${undefined}
    ${"edifact"} | ${"402"} | ${"time"}           | ${"time"}           | ${["HH", "MI", "SS"]}                                       | ${undefined}
    ${"edifact"} | ${"718"} | ${"datePeriod"}     | ${"date"}           | ${["CCYY", "MM", "DD"]}                                     | ${["CCYY", "MM", "DD"]}
    ${"edifact"} | ${"719"} | ${"dateTimePeriod"} | ${"dateTime"}       | ${["CCYY", "MM", "DD", "HH", "MI"]}                         | ${["CCYY", "MM", "DD", "HH", "MI"]}
    ${"x12"}     | ${"D8"}  | ${"date"}           | ${"date"}           | ${["CCYY", "MM", "DD"]}                                     | ${undefined}
    ${"x12"}     | ${"DB"}  | ${"date"}           | ${"date"}           | ${["MM", "DD", "CCYY"]}                                     | ${undefined}
    ${"x12"}     | ${"DT"}  | ${"dateTime"}       | ${"dateTime"}       | ${["CCYY", "MM", "DD", "HH", "MI"]}                         | ${undefined}
    ${"x12"}     | ${"RTS"} | ${"dateTime"}       | ${"dateTime"}       | ${["CCYY", "MM", "DD", "HH", "MI", "SS"]}                   | ${undefined}
    ${"x12"}     | ${"TM"}  | ${"time"}           | ${"time"}           | ${["HH", "MI"]}                                             | ${undefined}
    ${"x12"}     | ${"TS"}  | ${"time"}           | ${"time"}           | ${["HH", "MI", "SS"]}                                       | ${undefined}
    ${"x12"}     | ${"RD8"} | ${"dateRange"}      | ${"date"}           | ${["CCYY", "MM", "DD"]}                                     | ${["CCYY", "MM", "DD"]}
    ${"x12"}     | ${"RD"}  | ${"dateRange"}      | ${"date"}           | ${["MM", "DD", "CCYY"]}                                     | ${["MM", "DD", "CCYY"]}
    ${"x12"}     | ${"RDT"} | ${"dateTimeRange"}  | ${"dateTime"}       | ${["CCYY", "MM", "DD", "HH", "MI"]}                         | ${["CCYY", "MM", "DD", "HH", "MI"]}
    ${"x12"}     | ${"DTS"} | ${"dateTimeRange"}  | ${"dateTime"}       | ${["CCYY", "MM", "DD", "HH", "MI", "SS"]}                   | ${["CCYY", "MM", "DD", "HH", "MI", "SS"]}
  `(
    "$standard $code is a $kind of $valueKind halves with the parts $start and the end $end",
    ({ standard, code, kind, valueKind, start, end }) => {
      const entry = ediCodeOf(standard, code);
      expect(entry?.kind).toBe(kind);
      expect(entry?.valueKind).toBe(valueKind);
      expect(entry?.layout.start).toEqual(start);
      expect(entry?.layout.end).toEqual(end);
    },
  );

  it("every supported 2379 code has its own grammar, and a period is joined by nothing", () => {
    for (const code of EDIFACT_DTM_FORMATS) {
      const entry = ediCodeOf("edifact", code);
      expect(entry?.grammar).toBe(EDIFACT_DTM_GRAMMAR[code]);
      // UNTDID 2379, every directory read (twelve, from D.93A to D.22B): a period is given
      // "without hyphen".
      expect(entry?.rangeSeparator).toBe("");
    }
  });

  it("every supported 1250 code has its own grammar, and a range is joined by a hyphen", () => {
    for (const code of X12_DATE_TIME_PERIOD_FORMATS) {
      const entry = ediCodeOf("x12", code);
      expect(entry?.grammar).toBe(X12_DATE_TIME_PERIOD_GRAMMAR[code]);
      // X12 1250: "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD".
      expect(entry?.rangeSeparator).toBe("-");
    }
  });

  it("a code has an end exactly when its kind is a period or a range", () => {
    const ranges = [
      "datePeriod",
      "dateTimePeriod",
      "dateRange",
      "dateTimeRange",
    ];
    for (const [standard, codes] of [
      ["edifact", EDIFACT_DTM_FORMATS],
      ["x12", X12_DATE_TIME_PERIOD_FORMATS],
    ] as const) {
      for (const code of codes) {
        const entry = ediCodeOf(standard, code);
        expect(entry?.layout.end !== undefined, `${standard} ${code}`).toBe(
          ranges.includes(entry?.kind ?? ""),
        );
      }
    }
  });

  // No mask that is read carries a two-digit year, a day of the year or a year digit: the cut
  // codes took those parts with them.
  it("no supported code has a part other than CCYY, MM, DD, HH, MI, SS, ZS, ZH, ZM and ZZZ", () => {
    const parts = new Set<string>();
    for (const [standard, codes] of [
      ["edifact", EDIFACT_DTM_FORMATS],
      ["x12", X12_DATE_TIME_PERIOD_FORMATS],
    ] as const) {
      for (const code of codes) {
        const layout = ediCodeOf(standard, code)?.layout;
        for (const part of [...(layout?.start ?? []), ...(layout?.end ?? [])]) {
          parts.add(part);
        }
      }
    }
    expect([...parts].sort()).toEqual(
      ["CCYY", "DD", "HH", "MI", "MM", "SS", "ZH", "ZM", "ZS", "ZZZ"].sort(),
    );
  });

  // The codes cut from the EDI functions. A two-digit year is read by the pattern parsers
  // (`parseDateWithPattern` with a `yy` pattern and `yearWindow`); the rest state no date, time,
  // date-time or instant.
  it.each`
    standard     | code     | reads
    ${"edifact"} | ${"101"} | ${"YYMMDD: a two-digit year"}
    ${"edifact"} | ${"201"} | ${"YYMMDDHHMM: a two-digit year"}
    ${"edifact"} | ${"202"} | ${"YYMMDDHHMMSS: a two-digit year"}
    ${"edifact"} | ${"206"} | ${"YYMMDDHHMMZHHMM: a two-digit year"}
    ${"edifact"} | ${"207"} | ${"YYMMDDHHMMSSZHHMM: a two-digit year"}
    ${"edifact"} | ${"301"} | ${"YYMMDDHHMMZZZ: a two-digit year"}
    ${"edifact"} | ${"302"} | ${"YYMMDDHHMMSSZZZ: a two-digit year"}
    ${"edifact"} | ${"713"} | ${"YYMMDDHHMM-YYMMDDHHMM: a two-digit year"}
    ${"edifact"} | ${"717"} | ${"YYMMDD-YYMMDD: a two-digit year"}
    ${"edifact"} | ${"209"} | ${"HHMMSSZHHMM: a time with an offset and no date"}
    ${"edifact"} | ${"404"} | ${"HHMMSSZZZ: a time with a zone and no date"}
    ${"edifact"} | ${"406"} | ${"ZHHMM: an offset alone"}
    ${"x12"}     | ${"D6"}  | ${"YYMMDD: a two-digit year"}
    ${"x12"}     | ${"TT"}  | ${"MMDDYY: a two-digit year"}
    ${"x12"}     | ${"TR"}  | ${"DDMMYYHHMM: a two-digit year"}
    ${"x12"}     | ${"RD6"} | ${"YYMMDD-YYMMDD: a two-digit year"}
    ${"x12"}     | ${"TU"}  | ${"YYDDD: a two-digit year"}
    ${"x12"}     | ${"TC"}  | ${"DDD: a day of the year with no year"}
    ${"x12"}     | ${"EH"}  | ${"YDDD: a day of the year with one digit of the year"}
    ${"x12"}     | ${"DDT"} | ${"CCYYMMDD-CCYYMMDDHHMM: a date on one side, a date-time on the other"}
    ${"x12"}     | ${"DTD"} | ${"CCYYMMDDHHMM-CCYYMMDD: a date-time on one side, a date on the other"}
    ${"x12"}     | ${"RTM"} | ${"HHMM-HHMM: a range of times with no date"}
    ${"x12"}     | ${"UN"}  | ${"Unstructured"}
  `(
    "returns null for the cut $standard code $code ($reads)",
    ({ standard, code }) => {
      expect(ediCodeOf(standard, code)).toBeNull();
    },
  );

  it.each`
    standard         | code             | reads
    ${"edifact"}     | ${"D8"}          | ${"an X12 code under UN/EDIFACT"}
    ${"x12"}         | ${"102"}         | ${"a UN/EDIFACT code under X12"}
    ${"edifact"}     | ${"602"}         | ${"a 2379 code GMT does not read"}
    ${"edifact"}     | ${"501"}         | ${"a 2379 time span GMT does not read"}
    ${"x12"}         | ${"CM"}          | ${"a 1250 code GMT does not read"}
    ${"x12"}         | ${"d8"}          | ${"lower case: matching is exact"}
    ${"edifact"}     | ${" 102"}        | ${"a leading space: matching is exact"}
    ${"edifact"}     | ${""}            | ${"an empty code"}
    ${"edifact"}     | ${"__proto__"}   | ${"an inherited key, not a code"}
    ${"x12"}         | ${"constructor"} | ${"an inherited key, not a code"}
    ${"x12"}         | ${"toString"}    | ${"an inherited key, not a code"}
    ${"X12"}         | ${"D8"}          | ${"an upper-case standard"}
    ${"edi"}         | ${"102"}         | ${"an unknown standard"}
    ${"__proto__"}   | ${"102"}         | ${"an inherited key, not a standard"}
    ${"constructor"} | ${"102"}         | ${"an inherited key, not a standard"}
  `(
    "returns null for $standard code '$code' ($reads)",
    ({ standard, code }) => {
      expect(ediCodeOf(standard, code)).toBeNull();
    },
  );

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${102}       | ${"number"}
    ${true}      | ${"boolean"}
    ${[]}        | ${"array"}
    ${{}}        | ${"object"}
  `(
    "returns null when the standard or the code is $description",
    ({ input }) => {
      expect(ediCodeOf("edifact", input)).toBeNull();
      expect(ediCodeOf(input, "102")).toBeNull();
    },
  );
});

describe("ediCodeOfKind", () => {
  // Each public function names its own kind, so a code of any other kind is refused before a
  // value is read. The kind of each code is the one its mask states (see the table above).
  it.each`
    standard     | kind                | code     | found
    ${"edifact"} | ${"date"}           | ${"102"} | ${true}
    ${"edifact"} | ${"date"}           | ${"203"} | ${false}
    ${"edifact"} | ${"date"}           | ${"718"} | ${false}
    ${"edifact"} | ${"dateTime"}       | ${"203"} | ${true}
    ${"edifact"} | ${"dateTime"}       | ${"205"} | ${false}
    ${"edifact"} | ${"dateTime"}       | ${"719"} | ${false}
    ${"edifact"} | ${"offsetDateTime"} | ${"303"} | ${true}
    ${"edifact"} | ${"offsetDateTime"} | ${"203"} | ${false}
    ${"edifact"} | ${"time"}           | ${"401"} | ${true}
    ${"edifact"} | ${"time"}           | ${"102"} | ${false}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${true}
    ${"edifact"} | ${"datePeriod"}     | ${"719"} | ${false}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${true}
    ${"edifact"} | ${"dateRange"}      | ${"718"} | ${false}
    ${"x12"}     | ${"date"}           | ${"DB"}  | ${true}
    ${"x12"}     | ${"date"}           | ${"DT"}  | ${false}
    ${"x12"}     | ${"time"}           | ${"TS"}  | ${true}
    ${"x12"}     | ${"dateTime"}       | ${"RTS"} | ${true}
    ${"x12"}     | ${"dateTime"}       | ${"DTS"} | ${false}
    ${"x12"}     | ${"dateRange"}      | ${"RD"}  | ${true}
    ${"x12"}     | ${"dateRange"}      | ${"RDT"} | ${false}
    ${"x12"}     | ${"dateTimeRange"}  | ${"DTS"} | ${true}
    ${"x12"}     | ${"datePeriod"}     | ${"RD8"} | ${false}
    ${"x12"}     | ${"date"}           | ${"102"} | ${false}
    ${"edifact"} | ${"date"}           | ${"D8"}  | ${false}
    ${"edifact"} | ${"date"}           | ${"101"} | ${false}
    ${"x12"}     | ${"date"}           | ${"D6"}  | ${false}
  `(
    "finds $standard $code as a $kind code: $found",
    ({ standard, kind, code, found }) => {
      const entry = ediCodeOfKind(standard, kind, code);
      expect(entry !== null).toBe(found);
      if (found) {
        expect(entry).toEqual(ediCodeOf(standard, code));
      }
    },
  );

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${102}       | ${"a number"}
    ${["102"]}   | ${"an array holding the code"}
  `("returns null for a code that is $description", ({ input }) => {
    expect(ediCodeOfKind("edifact", "date", input)).toBeNull();
  });
});

describe("the grammars are private", () => {
  // A value-plus-code grammar is a two-argument relation; its public form is the validator
  // function, not a constant per code. Nothing EDI-shaped reaches the root or regex barrels.
  it.each`
    name
    ${"basicDate"}
    ${"basicShortDate"}
    ${"basicDateTime"}
    ${"basicDateTimeSeconds"}
    ${"basicShortDateTime"}
    ${"basicShortDateTimeSeconds"}
    ${"basicTime"}
    ${"basicTimeSeconds"}
    ${"basicUtcOffset"}
    ${"hourUtcOffset"}
    ${"ordinalDay"}
    ${"shortOrdinalDate"}
    ${"edifactZone"}
    ${"x12TimeCodeLike"}
    ${"EDIFACT_DTM_GRAMMAR"}
    ${"X12_DATE_TIME_PERIOD_GRAMMAR"}
    ${"X12_TIME_CODES"}
  `(
    "$name is exported from neither the root nor the regex barrel",
    ({ name }) => {
      expect(name in root).toBe(false);
      expect(name in regex).toBe(false);
    },
  );
});
