import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { isValidX12DateTimePeriod } from "./isValidX12DateTimePeriod";
import { isValidX12DateTimePeriodFormat } from "./isValidX12DateTimePeriodFormat";

describe("isValidX12DateTimePeriodFormat", () => {
  // The 21 codes of X12 data element 1250 GMT names, with the mask each definition gives
  // (release 005010, Stedi's X12-licensed dictionary).
  it.each`
    formatQualifier | mask
    ${"D8"}         | ${"CCYYMMDD"}
    ${"D6"}         | ${"YYMMDD"}
    ${"DB"}         | ${"MMDDCCYY"}
    ${"TT"}         | ${"MMDDYY"}
    ${"DT"}         | ${"CCYYMMDDHHMM"}
    ${"TR"}         | ${"DDMMYYHHMM"}
    ${"RTS"}        | ${"CCYYMMDDHHMMSS"}
    ${"TM"}         | ${"HHMM"}
    ${"TS"}         | ${"HHMMSS"}
    ${"RD8"}        | ${"CCYYMMDD-CCYYMMDD"}
    ${"RD6"}        | ${"YYMMDD-YYMMDD"}
    ${"RD"}         | ${"MMDDCCYY-MMDDCCYY"}
    ${"RDT"}        | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}
    ${"DTS"}        | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS"}
    ${"DDT"}        | ${"CCYYMMDD-CCYYMMDDHHMM"}
    ${"DTD"}        | ${"CCYYMMDDHHMM-CCYYMMDD"}
    ${"RTM"}        | ${"HHMM-HHMM"}
    ${"TC"}         | ${"DDD"}
    ${"TU"}         | ${"YYDDD"}
    ${"EH"}         | ${"YDDD"}
  `("returns true for $formatQualifier ($mask)", ({ formatQualifier }) => {
    expect(isValidX12DateTimePeriodFormat(formatQualifier)).toBe(true);
  });

  // UN is a real 1250 code and a member of X12DateTimePeriodFormat, so it is a valid format. It has no
  // mask, so no value is ever valid against it: that is parseX12DateTimePeriod's null.
  it("returns true for UN (Unstructured): a code GMT names and never reads", () => {
    expect(isValidX12DateTimePeriodFormat("UN")).toBe(true);
  });

  // The other 21 codes the dictionary lists for data element 1250, each with its definition:
  // real codes GMT does not read, because each names a partial value, a range of partial values
  // or a month-name form.
  it.each`
    formatQualifier | definition
    ${"CC"}         | ${"First Two Digits of Year Expressed in Format CCYY"}
    ${"CD"}         | ${"Month and Year Expressed in Format MMMYYYY"}
    ${"CM"}         | ${"Date in Format CCYYMM"}
    ${"CQ"}         | ${"Date in Format CCYYQ"}
    ${"CY"}         | ${"Year Expressed in Format CCYY"}
    ${"DA"}         | ${"Range of Dates within a Single Month Expressed in Format DD-DD"}
    ${"DD"}         | ${"Day of Month in Numeric Format"}
    ${"KA"}         | ${"Date Expressed in Format YYMMMDD"}
    ${"MCY"}        | ${"MMCCYY"}
    ${"MD"}         | ${"Month of Year and Day of Month Expressed in Format MMDD"}
    ${"MM"}         | ${"Month of Year in Numeric Format"}
    ${"RD2"}        | ${"Range of Years Expressed in Format YY-YY"}
    ${"RD4"}        | ${"Range of Years Expressed in Format CCYY-CCYY"}
    ${"RD5"}        | ${"Range of Years and Months Expressed in Format CCYYMM-CCYYMM"}
    ${"RDM"}        | ${"Range of Dates Expressed in Format YYMMDD-MMDD"}
    ${"RMD"}        | ${"Range of Months and Days Expressed in Format MMDD-MMDD"}
    ${"RMY"}        | ${"Range of Years and Months Expressed in Format YYMM-YYMM"}
    ${"TQ"}         | ${"Date Expressed in Format MMYY"}
    ${"YM"}         | ${"Year and Month Expressed in Format YYMM"}
    ${"YMM"}        | ${"Range of Year and Months, Expressed in CCYYMMM-MMM Format"}
    ${"YY"}         | ${"Last Two Digits of Year Expressed in Format CCYY"}
  `(
    "returns false for $formatQualifier ($definition): a 1250 code GMT does not read",
    ({ formatQualifier }) => {
      expect(isValidX12DateTimePeriodFormat(formatQualifier)).toBe(false);
    },
  );

  it.each`
    formatQualifier | reads
    ${"d8"}         | ${"lower case: matching is exact"}
    ${" D8"}        | ${"a leading space"}
    ${"D8 "}        | ${"a trailing space"}
    ${"D"}          | ${"a truncated code"}
    ${"D10"}        | ${"not a 1250 code"}
    ${"DTM"}        | ${"a segment name, not a 1250 code"}
    ${"102"}        | ${"a UN/EDIFACT 2379 code"}
    ${"ET"}         | ${"a 623 time code"}
    ${"ZZ"}         | ${"an unknown code"}
    ${""}           | ${"an empty string"}
    ${"toString"}   | ${"an inherited property name"}
  `("returns false for $formatQualifier ($reads)", ({ formatQualifier }) => {
    expect(isValidX12DateTimePeriodFormat(formatQualifier)).toBe(false);
  });

  // `parseX12DateTimePeriod` returns one null for a code GMT does not read and for a value that does
  // not fit its code. The format validator is what tells the two apart: the value validator is
  // false for both, and the code is still one GMT names when only the value is bad. `UN` is the
  // one code that is a valid format and has no valid value.
  it.each`
    value         | formatQualifier | valueIsValid | codeIsNamed | reads
    ${"20240615"} | ${"D8"}         | ${true}      | ${true}     | ${"a value that fits its code"}
    ${"20230229"} | ${"D8"}         | ${false}     | ${true}     | ${"a bad value under a code GMT reads: 29 February 2023"}
    ${"240615"}   | ${"D8"}         | ${false}     | ${true}     | ${"a D6 value under D8: the code is read, the value is not its mask"}
    ${"240615"}   | ${"D6"}         | ${false}     | ${true}     | ${"a two-digit year with no window: the code is read"}
    ${"20240615"} | ${"UN"}         | ${false}     | ${true}     | ${"Unstructured: a real code that reads no value"}
    ${"202406"}   | ${"CM"}         | ${false}     | ${false}    | ${"a 1250 code GMT does not read"}
    ${"20240615"} | ${"ZZ"}         | ${false}     | ${false}    | ${"not a 1250 code"}
  `(
    "$value under $formatQualifier: isValidX12DateTimePeriod is $valueIsValid and isValidX12DateTimePeriodFormat is $codeIsNamed ($reads)",
    ({ value, formatQualifier, valueIsValid, codeIsNamed }) => {
      expect(isValidX12DateTimePeriod(value, formatQualifier)).toBe(
        valueIsValid,
      );
      expect(isValidX12DateTimePeriodFormat(formatQualifier)).toBe(codeIsNamed);
    },
  );

  it("returns false for a format qualifier that is not a string", () => {
    const nonStrings: [string, unknown][] = [
      ["null", null],
      ["undefined", undefined],
      ["a number", 8],
      ["a boolean", true],
      ["an array holding a code", ["D8"]],
      ["an object", { D8: true }],
      ["a Proxy that throws on any trap", hostileProxy()],
      ["a revoked Proxy", revokedProxy()],
    ];
    for (const [kind, value] of nonStrings) {
      expect(isValidX12DateTimePeriodFormat(value), kind).toBe(false);
    }
  });
});
