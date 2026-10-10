import { X12_DATE_TIME_PERIOD_FORMATS } from "../../internal";
import { CUT_X12_FORMATS } from "../../test/ediCodes";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { isValidX12Date } from "./isValidX12Date";
import { isValidX12DateTimePeriodFormat } from "./isValidX12DateTimePeriodFormat";

describe("isValidX12DateTimePeriodFormat", () => {
  // The 10 codes of X12 data element 1250 GMT reads, with the mask each definition gives
  // (release 005010, Stedi's X12-licensed dictionary).
  it.each`
    format   | mask
    ${"D8"}  | ${"CCYYMMDD"}
    ${"DB"}  | ${"MMDDCCYY"}
    ${"DT"}  | ${"CCYYMMDDHHMM"}
    ${"RTS"} | ${"CCYYMMDDHHMMSS"}
    ${"TM"}  | ${"HHMM"}
    ${"TS"}  | ${"HHMMSS"}
    ${"RD8"} | ${"CCYYMMDD-CCYYMMDD"}
    ${"RD"}  | ${"MMDDCCYY-MMDDCCYY"}
    ${"RDT"} | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}
    ${"DTS"} | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS"}
  `("returns true for $format ($mask)", ({ format }) => {
    expect(isValidX12DateTimePeriodFormat(format)).toBe(true);
  });

  it("accepts exactly the 10 codes of the internal list", () => {
    expect(X12_DATE_TIME_PERIOD_FORMATS).toHaveLength(10);
    expect(
      X12_DATE_TIME_PERIOD_FORMATS.every(isValidX12DateTimePeriodFormat),
    ).toBe(true);
  });

  // The codes cut from the EDI functions: real 1250 codes that no function reads. `UN`
  // (Unstructured) is one of them: it has no mask, so no value is ever valid against it.
  it.each(CUT_X12_FORMATS)(
    "returns false for the cut code $code ($reads)",
    ({ code }) => {
      expect(isValidX12DateTimePeriodFormat(code)).toBe(false);
    },
  );

  // 21 more codes the dictionary lists for data element 1250, each with its definition: real
  // codes GMT does not read, because each names a partial value, a range of partial values or a
  // month-name form.
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

  // A parser returns one sentinel for a code GMT does not read and for a value that does not fit
  // its code. The format guard is what tells the two apart.
  it.each`
    value         | format  | valueIsValid | codeIsRead | reads
    ${"20240615"} | ${"D8"} | ${true}      | ${true}    | ${"a value that fits its code"}
    ${"20230229"} | ${"D8"} | ${false}     | ${true}    | ${"a bad value under a code GMT reads: 29 February 2023"}
    ${"240615"}   | ${"D8"} | ${false}     | ${true}    | ${"a YYMMDD value under D8: the code is read, the value is not its mask"}
    ${"240615"}   | ${"D6"} | ${false}     | ${false}   | ${"a two-digit-year code: not read"}
    ${"20240615"} | ${"UN"} | ${false}     | ${false}   | ${"Unstructured: not read"}
    ${"202406"}   | ${"CM"} | ${false}     | ${false}   | ${"a 1250 code GMT does not read"}
    ${"20240615"} | ${"ZZ"} | ${false}     | ${false}   | ${"not a 1250 code"}
  `(
    "$value under $format: isValidX12Date is $valueIsValid and isValidX12DateTimePeriodFormat is $codeIsRead ($reads)",
    ({ value, format, valueIsValid, codeIsRead }) => {
      expect(isValidX12Date(value, format)).toBe(valueIsValid);
      expect(isValidX12DateTimePeriodFormat(format)).toBe(codeIsRead);
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
