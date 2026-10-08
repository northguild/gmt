import { EDIFACT_DTM_FORMATS } from "../../internal";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { isValidEdifactDtm } from "./isValidEdifactDtm";
import { isValidEdifactDtmFormat } from "./isValidEdifactDtmFormat";

describe("isValidEdifactDtmFormat", () => {
  // The 23 UNTDID 2379 codes of the story's table, written out so a code dropped from the
  // internal list fails here.
  it.each`
    code     | mask
    ${"101"} | ${"YYMMDD"}
    ${"102"} | ${"CCYYMMDD"}
    ${"201"} | ${"YYMMDDHHMM"}
    ${"202"} | ${"YYMMDDHHMMSS"}
    ${"203"} | ${"CCYYMMDDHHMM"}
    ${"204"} | ${"CCYYMMDDHHMMSS"}
    ${"205"} | ${"CCYYMMDDHHMMZHHMM"}
    ${"206"} | ${"YYMMDDHHMMZHHMM"}
    ${"207"} | ${"YYMMDDHHMMSSZHHMM"}
    ${"208"} | ${"CCYYMMDDHHMMSSZHHMM"}
    ${"209"} | ${"HHMMSSZHHMM"}
    ${"301"} | ${"YYMMDDHHMMZZZ"}
    ${"302"} | ${"YYMMDDHHMMSSZZZ"}
    ${"303"} | ${"CCYYMMDDHHMMZZZ"}
    ${"304"} | ${"CCYYMMDDHHMMSSZZZ"}
    ${"401"} | ${"HHMM"}
    ${"402"} | ${"HHMMSS"}
    ${"404"} | ${"HHMMSSZZZ"}
    ${"406"} | ${"ZHHMM"}
    ${"713"} | ${"YYMMDDHHMM-YYMMDDHHMM"}
    ${"717"} | ${"YYMMDD-YYMMDD"}
    ${"718"} | ${"CCYYMMDD-CCYYMMDD"}
    ${"719"} | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}
  `("returns true for the supported code $code ($mask)", ({ code }) => {
    expect(isValidEdifactDtmFormat(code)).toBe(true);
  });

  it("accepts exactly the 23 codes of the internal list", () => {
    expect(EDIFACT_DTM_FORMATS).toHaveLength(23);
    expect(EDIFACT_DTM_FORMATS.every(isValidEdifactDtmFormat)).toBe(true);
  });

  // 2379 codes GMT does not read: the partial values, the weekday period and the quantities, the
  // day-first and month-first dates (2–5), 10 (CCYYMMDDTHHMM), the week date 103, the ordinal
  // date 105, the time period 210, 307 (milliseconds), the zoned period 308, the time spans
  // (501–503) and 711, which the directory dropped in D.03B.
  it.each`
    code     | reads
    ${"2"}   | ${"a day-first or month-first date"}
    ${"3"}   | ${"a day-first or month-first date"}
    ${"4"}   | ${"a day-first or month-first date"}
    ${"5"}   | ${"a day-first or month-first date"}
    ${"10"}  | ${"CCYYMMDDTHHMM"}
    ${"103"} | ${"the week date"}
    ${"105"} | ${"the ordinal date"}
    ${"210"} | ${"a time period with offsets"}
    ${"307"} | ${"a date and time with milliseconds"}
    ${"308"} | ${"a zoned period"}
    ${"711"} | ${"CCYYMMDD-CCYYMMDD, removed in D.03B"}
    ${"501"} | ${"a time span"}
    ${"502"} | ${"a time span"}
    ${"503"} | ${"a time span"}
    ${"602"} | ${"a partial value"}
    ${"609"} | ${"a partial value"}
    ${"610"} | ${"a partial value"}
    ${"616"} | ${"a partial value"}
    ${"720"} | ${"a weekday period"}
    ${"801"} | ${"a quantity"}
    ${"802"} | ${"a quantity"}
    ${"803"} | ${"a quantity"}
    ${"804"} | ${"a quantity"}
    ${"999"} | ${"not a 2379 code"}
  `("returns false for the unsupported code $code ($reads)", ({ code }) => {
    expect(isValidEdifactDtmFormat(code)).toBe(false);
  });

  // Matching is exact: a code is three characters, not a number and not padded.
  it.each`
    code             | reads
    ${"0203"}        | ${"a leading zero"}
    ${" 203"}        | ${"a leading space"}
    ${"203 "}        | ${"a trailing space"}
    ${"203\n"}       | ${"a trailing newline"}
    ${"２０３"}      | ${"full-width digits"}
    ${"20"}          | ${"a prefix of a code"}
    ${""}            | ${"an empty string"}
    ${"D8"}          | ${"an X12 1250 code"}
    ${"constructor"} | ${"an inherited property name"}
  `("returns false for the near-miss $code ($reads)", ({ code }) => {
    expect(isValidEdifactDtmFormat(code)).toBe(false);
  });

  // `parseEdifactDtm` returns one null for an unsupported code and for a value that does not
  // fit its code. The format validator is what tells the two apart: the value validator is false
  // for both, and the code is still a supported one when only the value is bad.
  it.each`
    value         | code     | valueIsValid | codeIsSupported | reads
    ${"20240615"} | ${"102"} | ${true}      | ${true}         | ${"a value that fits its code"}
    ${"20230229"} | ${"102"} | ${false}     | ${true}         | ${"a bad value under a supported code: 29 February 2023"}
    ${"240615"}   | ${"102"} | ${false}     | ${true}         | ${"a 101 value under 102: the code is supported, the value is not its mask"}
    ${"240615"}   | ${"101"} | ${false}     | ${true}         | ${"a two-digit year with no window: the code is supported"}
    ${"20240615"} | ${"602"} | ${false}     | ${false}        | ${"a code GMT does not read"}
    ${"20240615"} | ${"999"} | ${false}     | ${false}        | ${"not a 2379 code"}
  `(
    "$value under $code: isValidEdifactDtm is $valueIsValid and isValidEdifactDtmFormat is $codeIsSupported ($reads)",
    ({ value, code, valueIsValid, codeIsSupported }) => {
      expect(isValidEdifactDtm(value, code)).toBe(valueIsValid);
      expect(isValidEdifactDtmFormat(code)).toBe(codeIsSupported);
    },
  );

  // A non-string is never a code: 203 as a number is the value a caller might pass unquoted.
  it("returns false for a formatQualifier that is not a string", () => {
    const nonStrings: [string, unknown][] = [
      ["the number 203", 203],
      ["null", null],
      ["undefined", undefined],
      ["a boolean", true],
      ["an array holding a code", ["203"]],
      ["an object", {}],
      ["a Proxy that throws on any trap", hostileProxy()],
      ["a revoked Proxy", revokedProxy()],
    ];
    for (const [kind, value] of nonStrings) {
      expect(isValidEdifactDtmFormat(value), kind).toBe(false);
    }
  });
});
