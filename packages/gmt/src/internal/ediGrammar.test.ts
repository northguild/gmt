import * as root from "../index";
import * as regex from "../regex";
import type { EdifactDtmFormat, X12DateTimePeriodFormat } from "../types/edi";
import {
  EDIFACT_DTM_FORMATS,
  EDIFACT_DTM_GRAMMAR,
  EDIFACT_TWO_DIGIT_YEAR_FORMATS,
  X12_DATE_TIME_PERIOD_FORMATS,
  X12_DATE_TIME_PERIOD_GRAMMAR,
  X12_TIME_CODES,
  X12_TWO_DIGIT_YEAR_FORMATS,
  ediCodeOf,
} from "./ediGrammar";

// UNTDID data element 2379 and X12 data element 1250. Every entry proves shape only: month 01–12,
// day 01–31, hour 00–23, minute and second 00–59, ordinal day 001–366. Whether the day exists in
// its month, or day 366 in its year, is Temporal's job in `ediDateTimeFields.ts`.

describe("EDIFACT_DTM_GRAMMAR", () => {
  it.each`
    code     | value                         | reason
    ${"101"} | ${"240615"}                   | ${"YYMMDD"}
    ${"101"} | ${"690101"}                   | ${"YY 69: the reader resolves the century"}
    ${"102"} | ${"20240615"}                 | ${"CCYYMMDD"}
    ${"102"} | ${"20230229"}                 | ${"a day the year does not have still matches: calendar validity is Temporal's"}
    ${"102"} | ${"00000101"}                 | ${"year 0000"}
    ${"201"} | ${"2406151430"}               | ${"YYMMDDHHMM"}
    ${"202"} | ${"240615143000"}             | ${"YYMMDDHHMMSS"}
    ${"203"} | ${"202406151430"}             | ${"CCYYMMDDHHMM"}
    ${"203"} | ${"202406152359"}             | ${"last minute of the day"}
    ${"204"} | ${"20240615143000"}           | ${"CCYYMMDDHHMMSS"}
    ${"204"} | ${"20240615235959"}           | ${"last second of the day"}
    ${"205"} | ${"202406151430+0200"}        | ${"CCYYMMDDHHMMZHHMM"}
    ${"205"} | ${"202406151430+0530"}        | ${"half-hour offset"}
    ${"205"} | ${"202406151430-0000"}        | ${"negative zero"}
    ${"206"} | ${"2406151430+0200"}          | ${"YYMMDDHHMMZHHMM"}
    ${"207"} | ${"240615143000+0200"}        | ${"YYMMDDHHMMSSZHHMM"}
    ${"208"} | ${"20240615143000+0200"}      | ${"CCYYMMDDHHMMSSZHHMM"}
    ${"208"} | ${"20240615143000-0530"}      | ${"western half-hour"}
    ${"209"} | ${"143000+0200"}              | ${"HHMMSSZHHMM"}
    ${"301"} | ${"2406151430+02"}            | ${"YYMMDDHHMMZZZ"}
    ${"301"} | ${"6901010000UTC"}            | ${"literal UTC"}
    ${"302"} | ${"240615143000+02"}          | ${"YYMMDDHHMMSSZZZ"}
    ${"302"} | ${"240615143000UTC"}          | ${"literal UTC"}
    ${"303"} | ${"202406151430+02"}          | ${"ZZZ as ±HH (Rec 7 ¶12)"}
    ${"303"} | ${"202406151430-05"}          | ${"ZZZ as -05 (Rec 7 ¶12 example)"}
    ${"303"} | ${"202406151430+00"}          | ${"ZZZ as +00"}
    ${"303"} | ${"202406151430UTC"}          | ${"ZZZ as the literal UTC (SMDG)"}
    ${"303"} | ${"202406151430GMT"}          | ${"ZZZ as the literal GMT (Rec 7 ¶12)"}
    ${"303"} | ${"202406151430PDT"}          | ${"ZZZ as an undefined abbreviation: raw zone text"}
    ${"304"} | ${"20240615143000+02"}        | ${"CCYYMMDDHHMMSSZZZ"}
    ${"304"} | ${"20240615143000CET"}        | ${"undefined abbreviation"}
    ${"401"} | ${"1430"}                     | ${"HHMM"}
    ${"401"} | ${"0000"}                     | ${"midnight"}
    ${"402"} | ${"143000"}                   | ${"HHMMSS"}
    ${"404"} | ${"143000+02"}                | ${"HHMMSSZZZ"}
    ${"404"} | ${"143000UTC"}                | ${"literal UTC"}
    ${"406"} | ${"+0200"}                    | ${"ZHHMM"}
    ${"406"} | ${"-0530"}                    | ${"western half-hour"}
    ${"406"} | ${"+2359"}                    | ${"highest hour and minute the shape allows"}
    ${"713"} | ${"24061514302406201600"}     | ${"wire form, no hyphen"}
    ${"717"} | ${"240615240620"}             | ${"wire form"}
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
    ${"101"} | ${"20240615"}                   | ${"102's value"}
    ${"101"} | ${"241301"}                     | ${"month 13"}
    ${"101"} | ${"240632"}                     | ${"day 32"}
    ${"101"} | ${"240600"}                     | ${"day 00"}
    ${"101"} | ${"24615"}                      | ${"unpadded month"}
    ${"102"} | ${"240615"}                     | ${"101's value"}
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
    ${"201"} | ${"202406151430"}               | ${"203's value"}
    ${"201"} | ${"240615143000"}               | ${"202's value"}
    ${"201"} | ${"2406152400"}                 | ${"hour 24"}
    ${"201"} | ${"2406151460"}                 | ${"minute 60"}
    ${"202"} | ${"2406151430"}                 | ${"201's value"}
    ${"202"} | ${"240615143060"}               | ${"second 60"}
    ${"203"} | ${"20240615143000"}             | ${"204's value"}
    ${"203"} | ${"2406151430"}                 | ${"201's value"}
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
    ${"206"} | ${"2406151430+02"}              | ${"301's value: ZZZ is three characters"}
    ${"206"} | ${"202406151430+0200"}          | ${"205's value: four-digit year"}
    ${"207"} | ${"2406151430+0200"}            | ${"206's value: no seconds"}
    ${"207"} | ${"240615143060+0200"}          | ${"second 60"}
    ${"208"} | ${"202406151430+0200"}          | ${"205's value: no seconds"}
    ${"208"} | ${"20240615143000+2400"}        | ${"offset hour 24"}
    ${"208"} | ${"20240615143000Z"}            | ${"Z designator: 2379 has none"}
    ${"209"} | ${"143000+02"}                  | ${"404's value: ZZZ is three characters"}
    ${"209"} | ${"1430+0200"}                  | ${"no seconds"}
    ${"209"} | ${"143000+0260"}                | ${"offset minute 60"}
    ${"209"} | ${"143000"}                     | ${"402's value: no offset"}
    ${"205"} | ${"202406151430"}               | ${"203's value: no offset"}
    ${"205"} | ${"202406151430?+0200"}         | ${"release character"}
    ${"301"} | ${"202406151430+02"}            | ${"303's value"}
    ${"301"} | ${"240615143000+02"}            | ${"302's value"}
    ${"301"} | ${"2406151430"}                 | ${"201's value: no zone"}
    ${"301"} | ${"2406151430?+02"}             | ${"release character"}
    ${"302"} | ${"2406151430+02"}              | ${"301's value"}
    ${"302"} | ${"240615143000"}               | ${"202's value: no zone"}
    ${"303"} | ${"202406151430"}               | ${"203's value: no zone"}
    ${"303"} | ${"202406151430+0200"}          | ${"205's value: ZHHMM"}
    ${"303"} | ${"20240615143000+02"}          | ${"304's value"}
    ${"303"} | ${"202406151430?+02"}           | ${"release character is not part of the element value"}
    ${"303"} | ${"202406151430utc"}            | ${"lower case"}
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
    ${"404"} | ${"1430+02"}                    | ${"HHMM with a zone: 2379 defines no such code"}
    ${"404"} | ${"143000"}                     | ${"402's value: no zone"}
    ${"404"} | ${"143000?+02"}                 | ${"release character"}
    ${"404"} | ${"240000+02"}                  | ${"hour 24"}
    ${"406"} | ${"+2400"}                      | ${"hour 24"}
    ${"406"} | ${"+0260"}                      | ${"minute 60"}
    ${"406"} | ${"0200"}                       | ${"no sign"}
    ${"406"} | ${"+02"}                        | ${"hours only: that is a ZZZ form, not ZHHMM"}
    ${"406"} | ${"+02:00"}                     | ${"colon"}
    ${"406"} | ${"Z"}                          | ${"designator"}
    ${"406"} | ${"−0200"}                      | ${"U+2212 minus sign"}
    ${"406"} | ${"?+0200"}                     | ${"release character"}
    ${"406"} | ${""}                           | ${"empty string"}
    ${"713"} | ${"202406151430202406201600"}   | ${"719's value"}
    ${"713"} | ${"2406151430"}                 | ${"201's value: one date-time"}
    ${"713"} | ${"2406151430-2406201600"}      | ${"one hyphen: the mask's notation, never transmitted"}
    ${"713"} | ${"2406151430--2406201600"}     | ${"two hyphens"}
    ${"717"} | ${"2024061520240620"}           | ${"718's value"}
    ${"717"} | ${"240615"}                     | ${"101's value: one date"}
    ${"717"} | ${"240615-240620"}              | ${"one hyphen: the mask's notation, never transmitted"}
    ${"717"} | ${"240615--240620"}             | ${"two hyphens"}
    ${"718"} | ${"20240615-20240620"}          | ${"one hyphen: X12 RD8's wire form, never a 2379 one"}
    ${"718"} | ${"20240615--20240620"}         | ${"two hyphens"}
    ${"718"} | ${"20240615/20240620"}          | ${"solidus"}
    ${"718"} | ${"20240615"}                   | ${"102's value: one date"}
    ${"718"} | ${"240615240620"}               | ${"717's value"}
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
    ${"404"} | ${"143000+02"}                | ${["14", "30", "00", "+02"]}
    ${"406"} | ${"-0530"}                    | ${["-", "05", "30"]}
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
    ${"D6"}  | ${"240615"}                        | ${"YYMMDD"}
    ${"D8"}  | ${"20240615"}                      | ${"CCYYMMDD"}
    ${"DB"}  | ${"06152024"}                      | ${"MMDDCCYY"}
    ${"DB"}  | ${"02292023"}                      | ${"a day the year does not have still matches: calendar validity is Temporal's"}
    ${"TT"}  | ${"061524"}                        | ${"MMDDYY"}
    ${"DT"}  | ${"202406151430"}                  | ${"CCYYMMDDHHMM"}
    ${"TR"}  | ${"1506241430"}                    | ${"DDMMYYHHMM"}
    ${"TR"}  | ${"2406151430"}                    | ${"the EDIFACT 201 digits also read as day 24, month 06, year 15: the qualifier tells the orders apart"}
    ${"RTS"} | ${"20240615143000"}                | ${"CCYYMMDDHHMMSS, one date-time despite the R"}
    ${"TM"}  | ${"1430"}                          | ${"HHMM"}
    ${"TS"}  | ${"143000"}                        | ${"HHMMSS"}
    ${"RD6"} | ${"240615-240620"}                 | ${"YYMMDD-YYMMDD, hyphen transmitted"}
    ${"RD8"} | ${"20240615-20240620"}             | ${"CCYYMMDD-CCYYMMDD"}
    ${"RD8"} | ${"20240620-20240615"}             | ${"a reversed range still matches: ordering is the reader's"}
    ${"RD"}  | ${"06152024-06202024"}             | ${"MMDDCCYY-MMDDCCYY"}
    ${"RDT"} | ${"202406151430-202406201600"}     | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}
    ${"DTS"} | ${"20240615143000-20240620160000"} | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS, a range despite having no R"}
    ${"DDT"} | ${"20240615-202406201600"}         | ${"CCYYMMDD-CCYYMMDDHHMM"}
    ${"DTD"} | ${"202406151430-20240620"}         | ${"CCYYMMDDHHMM-CCYYMMDD"}
    ${"RTM"} | ${"0900-1700"}                     | ${"HHMM-HHMM"}
    ${"RTM"} | ${"1700-0900"}                     | ${"a reversed range still matches: ordering is the reader's"}
    ${"TC"}  | ${"166"}                           | ${"DDD"}
    ${"TC"}  | ${"001"}                           | ${"first day of the year"}
    ${"TC"}  | ${"366"}                           | ${"day 366: shape only, the reader checks the year"}
    ${"TU"}  | ${"24166"}                         | ${"YYDDD"}
    ${"TU"}  | ${"23366"}                         | ${"day 366 of a common year still matches: calendar validity is Temporal's"}
    ${"EH"}  | ${"4166"}                          | ${"YDDD"}
    ${"EH"}  | ${"0001"}                          | ${"year digit 0, day 001"}
  `("code $code matches $value ($reason)", ({ code, value }) => {
    expect(
      X12_DATE_TIME_PERIOD_GRAMMAR[code as X12DateTimePeriodFormat].test(value),
    ).toBe(true);
  });

  it.each`
    code     | value                              | reason
    ${"D6"}  | ${"20240615"}                      | ${"D8's value"}
    ${"D6"}  | ${"241301"}                        | ${"month 13"}
    ${"D8"}  | ${"240615"}                        | ${"D6's value"}
    ${"D8"}  | ${"06152024"}                      | ${"DB's value read as CCYYMMDD: 20 is not a month"}
    ${"D8"}  | ${"20240632"}                      | ${"day 32"}
    ${"D8"}  | ${""}                              | ${"empty string"}
    ${"D8"}  | ${"20240615\n"}                    | ${"a trailing newline: $ is the end of the value, not of a line"}
    ${"D8"}  | ${"2024-06-15"}                    | ${"an ISO 8601 date"}
    ${"DB"}  | ${"20240615"}                      | ${"D8's value: 20 is not a month"}
    ${"DB"}  | ${"13152024"}                      | ${"month 13"}
    ${"DB"}  | ${"06322024"}                      | ${"day 32"}
    ${"DB"}  | ${"6152024"}                       | ${"unpadded month"}
    ${"DB"}  | ${"061524"}                        | ${"TT's value"}
    ${"DB"}  | ${"06/15/2024"}                    | ${"separators"}
    ${"DB"}  | ${" 06152024"}                     | ${"leading whitespace"}
    ${"DB"}  | ${"06152024 "}                     | ${"trailing whitespace"}
    ${"TT"}  | ${"240615"}                        | ${"D6's value: 24 is not a month"}
    ${"TT"}  | ${"131524"}                        | ${"month 13"}
    ${"TT"}  | ${"06152024"}                      | ${"DB's value"}
    ${"DT"}  | ${"20240615143000"}                | ${"RTS's value"}
    ${"DT"}  | ${"202406152400"}                  | ${"hour 24"}
    ${"TR"}  | ${"202406151430"}                  | ${"DT's value"}
    ${"TR"}  | ${"1513241430"}                    | ${"month 13"}
    ${"TR"}  | ${"3206241430"}                    | ${"day 32"}
    ${"TR"}  | ${"1506242400"}                    | ${"hour 24"}
    ${"TR"}  | ${"1506241460"}                    | ${"minute 60"}
    ${"TR"}  | ${"150624"}                        | ${"no time"}
    ${"RTS"} | ${"202406151430"}                  | ${"DT's value"}
    ${"RTS"} | ${"20240615143060"}                | ${"second 60"}
    ${"TM"}  | ${"143000"}                        | ${"TS's value"}
    ${"TM"}  | ${"2400"}                          | ${"hour 24"}
    ${"TS"}  | ${"1430"}                          | ${"TM's value"}
    ${"TS"}  | ${"143060"}                        | ${"second 60"}
    ${"RD6"} | ${"240615240620"}                  | ${"no hyphen: X12 transmits it"}
    ${"RD6"} | ${"20240615-20240620"}             | ${"RD8's value"}
    ${"RD6"} | ${"240615"}                        | ${"D6's value"}
    ${"RD8"} | ${"2024061520240620"}              | ${"no hyphen: EDIFACT 718's wire form, not X12"}
    ${"RD8"} | ${"20240615--20240620"}            | ${"two hyphens"}
    ${"RD8"} | ${"20240615/20240620"}             | ${"solidus"}
    ${"RD8"} | ${"20240615"}                      | ${"D8's value"}
    ${"RD8"} | ${"240615-240620"}                 | ${"RD6's value"}
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
    ${"DDT"} | ${"202406151430-20240620"}         | ${"DTD's order"}
    ${"DDT"} | ${"20240615-20240620"}             | ${"RD8's value: no time on the end"}
    ${"DDT"} | ${"202406151430-202406201600"}     | ${"RDT's value: time on the start"}
    ${"DDT"} | ${"20240615202406201600"}          | ${"no hyphen"}
    ${"DTD"} | ${"20240615-202406201600"}         | ${"DDT's order"}
    ${"DTD"} | ${"20240615-20240620"}             | ${"RD8's value: no time on the start"}
    ${"DTD"} | ${"202406151430-202406201600"}     | ${"RDT's value: time on the end"}
    ${"DTD"} | ${"20240615143020240620"}          | ${"no hyphen"}
    ${"RTM"} | ${"09001700"}                      | ${"no hyphen"}
    ${"RTM"} | ${"0900"}                          | ${"TM's value"}
    ${"RTM"} | ${"2400-1700"}                     | ${"hour 24"}
    ${"RTM"} | ${"0900-1760"}                     | ${"minute 60"}
    ${"RTM"} | ${"09:00-17:00"}                   | ${"colons"}
    ${"TC"}  | ${"000"}                           | ${"day 000"}
    ${"TC"}  | ${"367"}                           | ${"day 367"}
    ${"TC"}  | ${"400"}                           | ${"day 400"}
    ${"TC"}  | ${"999"}                           | ${"day 999"}
    ${"TC"}  | ${"66"}                            | ${"unpadded"}
    ${"TC"}  | ${"0166"}                          | ${"four digits"}
    ${"TC"}  | ${"24166"}                         | ${"TU's value"}
    ${"TC"}  | ${" 166"}                          | ${"leading whitespace"}
    ${"TC"}  | ${"166 "}                          | ${"trailing whitespace"}
    ${"TC"}  | ${""}                              | ${"empty string"}
    ${"TU"}  | ${"24000"}                         | ${"day 000"}
    ${"TU"}  | ${"24367"}                         | ${"day 367"}
    ${"TU"}  | ${"4166"}                          | ${"EH's value"}
    ${"TU"}  | ${"166"}                           | ${"TC's value"}
    ${"TU"}  | ${"2024166"}                       | ${"four-digit year"}
    ${"EH"}  | ${"4000"}                          | ${"day 000"}
    ${"EH"}  | ${"4367"}                          | ${"day 367"}
    ${"EH"}  | ${"24166"}                         | ${"TU's value"}
    ${"EH"}  | ${"166"}                           | ${"TC's value"}
    ${"EH"}  | ${"A166"}                          | ${"letter year digit"}
    ${"UN"}  | ${"20240615"}                      | ${"unstructured: nothing matches, GMT never guesses a format"}
    ${"UN"}  | ${"anything"}                      | ${"unstructured"}
    ${"UN"}  | ${""}                              | ${"unstructured"}
  `("code $code rejects $value ($reason)", ({ code, value }) => {
    expect(
      X12_DATE_TIME_PERIOD_GRAMMAR[code as X12DateTimePeriodFormat].test(value),
    ).toBe(false);
  });

  it.each`
    code     | value                              | groups
    ${"DB"}  | ${"06152024"}                      | ${["06", "15", "2024"]}
    ${"TT"}  | ${"061524"}                        | ${["06", "15", "24"]}
    ${"TR"}  | ${"1506241430"}                    | ${["15", "06", "24", "14", "30"]}
    ${"EH"}  | ${"4166"}                          | ${["4", "166"]}
    ${"TU"}  | ${"24166"}                         | ${["24", "166"]}
    ${"RD"}  | ${"06152024-06202024"}             | ${["06", "15", "2024", "06", "20", "2024"]}
    ${"DTS"} | ${"20240615143000-20240620160000"} | ${["2024", "06", "15", "14", "30", "00", "2024", "06", "20", "16", "00", "00"]}
    ${"DDT"} | ${"20240615-202406201600"}         | ${["2024", "06", "15", "2024", "06", "20", "16", "00"]}
    ${"DTD"} | ${"202406151430-20240620"}         | ${["2024", "06", "15", "14", "30", "2024", "06", "20"]}
    ${"RTM"} | ${"0900-1700"}                     | ${["09", "00", "17", "00"]}
  `("code $code captures $groups from $value", ({ code, value, groups }) => {
    expect(
      X12_DATE_TIME_PERIOD_GRAMMAR[code as X12DateTimePeriodFormat]
        .exec(value)
        ?.slice(1),
    ).toEqual(groups);
  });
});

describe("code lists", () => {
  it("EDIFACT_DTM_FORMATS is the 23 supported 2379 codes, each with a grammar", () => {
    expect([...EDIFACT_DTM_FORMATS]).toEqual([
      "101",
      "102",
      "201",
      "202",
      "203",
      "204",
      "205",
      "206",
      "207",
      "208",
      "209",
      "301",
      "302",
      "303",
      "304",
      "401",
      "402",
      "404",
      "406",
      "713",
      "717",
      "718",
      "719",
    ]);
    expect(Object.keys(EDIFACT_DTM_GRAMMAR).sort()).toEqual(
      [...EDIFACT_DTM_FORMATS].sort(),
    );
  });

  it("X12_DATE_TIME_PERIOD_FORMATS is the 21 supported 1250 codes, each with a grammar", () => {
    expect([...X12_DATE_TIME_PERIOD_FORMATS]).toEqual([
      "D6",
      "D8",
      "DB",
      "TT",
      "DT",
      "TR",
      "RTS",
      "TM",
      "TS",
      "RD6",
      "RD8",
      "RD",
      "RDT",
      "DTS",
      "DDT",
      "DTD",
      "RTM",
      "TC",
      "TU",
      "EH",
      "UN",
    ]);
    expect(Object.keys(X12_DATE_TIME_PERIOD_GRAMMAR).sort()).toEqual(
      [...X12_DATE_TIME_PERIOD_FORMATS].sort(),
    );
  });

  it("the two-digit-year lists name exactly the codes whose mask has YY and no CC", () => {
    expect([...EDIFACT_TWO_DIGIT_YEAR_FORMATS]).toEqual([
      "101",
      "201",
      "202",
      "206",
      "207",
      "301",
      "302",
      "713",
      "717",
    ]);
    expect([...X12_TWO_DIGIT_YEAR_FORMATS]).toEqual([
      "D6",
      "TT",
      "TR",
      "RD6",
      "TU",
    ]);
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
  // The mask of each row is the standard's own (UNTDID 2379; X12 1250 release 005010),
  // written as this file's part names: `MI` is the minute, `ZS`/`ZH`/`ZM` the `ZHHMM` offset.
  it.each`
    standard     | code     | start                                                       | end
    ${"edifact"} | ${"102"} | ${["CCYY", "MM", "DD"]}                                     | ${undefined}
    ${"edifact"} | ${"201"} | ${["YY", "MM", "DD", "HH", "MI"]}                           | ${undefined}
    ${"edifact"} | ${"205"} | ${["CCYY", "MM", "DD", "HH", "MI", "ZS", "ZH", "ZM"]}       | ${undefined}
    ${"edifact"} | ${"206"} | ${["YY", "MM", "DD", "HH", "MI", "ZS", "ZH", "ZM"]}         | ${undefined}
    ${"edifact"} | ${"207"} | ${["YY", "MM", "DD", "HH", "MI", "SS", "ZS", "ZH", "ZM"]}   | ${undefined}
    ${"edifact"} | ${"208"} | ${["CCYY", "MM", "DD", "HH", "MI", "SS", "ZS", "ZH", "ZM"]} | ${undefined}
    ${"edifact"} | ${"209"} | ${["HH", "MI", "SS", "ZS", "ZH", "ZM"]}                     | ${undefined}
    ${"edifact"} | ${"303"} | ${["CCYY", "MM", "DD", "HH", "MI", "ZZZ"]}                  | ${undefined}
    ${"edifact"} | ${"404"} | ${["HH", "MI", "SS", "ZZZ"]}                                | ${undefined}
    ${"edifact"} | ${"406"} | ${["ZS", "ZH", "ZM"]}                                       | ${undefined}
    ${"edifact"} | ${"718"} | ${["CCYY", "MM", "DD"]}                                     | ${["CCYY", "MM", "DD"]}
    ${"x12"}     | ${"DB"}  | ${["MM", "DD", "CCYY"]}                                     | ${undefined}
    ${"x12"}     | ${"TR"}  | ${["DD", "MM", "YY", "HH", "MI"]}                           | ${undefined}
    ${"x12"}     | ${"DDT"} | ${["CCYY", "MM", "DD"]}                                     | ${["CCYY", "MM", "DD", "HH", "MI"]}
    ${"x12"}     | ${"RTM"} | ${["HH", "MI"]}                                             | ${["HH", "MI"]}
    ${"x12"}     | ${"TU"}  | ${["YY", "DDD"]}                                            | ${undefined}
    ${"x12"}     | ${"EH"}  | ${["Y", "DDD"]}                                             | ${undefined}
  `(
    "$standard $code has the parts $start and the end $end",
    ({ standard, code, start, end }) => {
      const entry = ediCodeOf(standard, code);
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

  it("every 1250 code but UN has its own grammar, and a range is joined by a hyphen", () => {
    for (const code of X12_DATE_TIME_PERIOD_FORMATS.filter(
      (code) => code !== "UN",
    )) {
      const entry = ediCodeOf("x12", code);
      expect(entry?.grammar).toBe(X12_DATE_TIME_PERIOD_GRAMMAR[code]);
      // X12 1250: "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD".
      expect(entry?.rangeSeparator).toBe("-");
    }
  });

  it("the two-digit-year lists are exactly the codes whose layout has YY", () => {
    const hasTwoDigitYear = (standard: string, code: string): boolean => {
      const layout = ediCodeOf(standard, code)?.layout;
      return [...(layout?.start ?? []), ...(layout?.end ?? [])].includes("YY");
    };
    expect(
      EDIFACT_DTM_FORMATS.filter((code) => hasTwoDigitYear("edifact", code)),
    ).toEqual([...EDIFACT_TWO_DIGIT_YEAR_FORMATS]);
    expect(
      [...X12_DATE_TIME_PERIOD_FORMATS]
        .filter((code) => hasTwoDigitYear("x12", code))
        .sort(),
    ).toEqual([...X12_TWO_DIGIT_YEAR_FORMATS].sort());
  });

  it.each`
    standard         | code             | reads
    ${"x12"}         | ${"UN"}          | ${"Unstructured: a real 1250 code with no layout"}
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
