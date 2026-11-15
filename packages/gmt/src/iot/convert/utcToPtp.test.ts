import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { isValidPtpTimestamp } from "../validate/isValidPtpTimestamp";
import { ptpToUtc } from "./ptpToUtc";
import { utcToPtp } from "./utcToPtp";

// Every expected value: Temporal.Instant.from(value).epochNanoseconds + offset × 10⁹, split into
// seconds and nanoseconds, checked against @js-temporal/polyfill with a plain script (not against
// utcToPtp). A result below zero, or an input before 1970, is null (GMT rule).
describe("utcToPtp", () => {
  it.each`
    value                               | offset    | seconds               | nanoseconds  | label
    ${"2024-01-01T00:00:00Z"}           | ${37}     | ${1_704_067_237n}     | ${0}         | ${"issue verification"}
    ${"2024-01-01T02:00:00+02:00"}      | ${37}     | ${1_704_067_237n}     | ${0}         | ${"offset input"}
    ${"2024-01-01T05:30:00,25+05:30"}   | ${37}     | ${1_704_067_237n}     | ${250000000} | ${"comma fraction and offset"}
    ${"2024-01-01T00:00:00.000000001Z"} | ${37}     | ${1_704_067_237n}     | ${1}         | ${"one nanosecond"}
    ${"2024-01-01T00:00:00.5Z"}         | ${37}     | ${1_704_067_237n}     | ${500000000} | ${"half a second"}
    ${"2024-01-01T00:00:00Z"}           | ${0}      | ${1_704_067_200n}     | ${0}         | ${"zero offset"}
    ${"2017-01-01T00:00:00Z"}           | ${37}     | ${1_483_228_837n}     | ${0}         | ${"after the last insertion"}
    ${"2016-12-31T23:59:59Z"}           | ${36}     | ${1_483_228_835n}     | ${0}         | ${"before it, on the old offset"}
    ${"1970-01-01T00:00:00Z"}           | ${37}     | ${37n}                | ${0}         | ${"earliest input accepted"}
    ${"1970-01-01T09:06:08Z"}           | ${-32768} | ${0n}                 | ${0}         | ${"lowest int16 reaches PTP zero"}
    ${"+275760-09-13T00:00:00Z"}        | ${37}     | ${8_640_000_000_037n} | ${0}         | ${"Temporal's last instant"}
    ${"1970-01-01T00:00:00Z"}           | ${32767}  | ${32_767n}            | ${0}         | ${"highest int16 offset"}
    ${"1970-01-01T09:06:08.000000001Z"} | ${-32768} | ${0n}                 | ${1}         | ${"one nanosecond above PTP zero"}
    ${"1969-12-31T23:00:00-02:00"}      | ${37}     | ${3_637n}             | ${0}         | ${"1969 local date, instant after 1970"}
  `(
    "returns seconds $seconds, nanoseconds $nanoseconds for '$value' at offset $offset ($label)",
    ({ value, offset, seconds, nanoseconds }) => {
      const result = utcToPtp(value, offset);

      expect(result).toEqual({ seconds, nanoseconds });
      expect(typeof result?.seconds).toBe("bigint");
    },
  );

  it.each`
    value                               | offset    | label
    ${"1970-01-01T00:00:00Z"}           | ${-32768} | ${"result below 0 seconds"}
    ${"1969-12-31T23:59:59Z"}           | ${37}     | ${"before 1970"}
    ${"1969-12-31T23:59:59.999999999Z"} | ${0}      | ${"one nanosecond before 1970"}
    ${"1970-01-01T09:06:07.999999999Z"} | ${-32768} | ${"one nanosecond below PTP zero"}
    ${"1970-01-01T01:00:00+02:00"}      | ${37}     | ${"1970 local date, instant before 1970"}
    ${"2016-12-31T23:59:60Z"}           | ${37}     | ${"leap second"}
    ${"2024-01-01T00:00:00"}            | ${37}     | ${"no designator"}
    ${"2024-01-01"}                     | ${37}     | ${"date only"}
    ${"2024-01-01T00:00:00Z[UTC]"}      | ${37}     | ${"annotation"}
    ${"20240101T000000Z"}               | ${37}     | ${"basic format"}
    ${"2024-01-01T00:00:00z"}           | ${37}     | ${"lower-case z"}
    ${""}                               | ${37}     | ${"empty string"}
    ${"invalid"}                        | ${37}     | ${"not a date"}
  `(
    "returns null for '$value' at offset $offset ($label)",
    ({ value, offset }) => {
      expect(utcToPtp(value, offset)).toBeNull();
    },
  );

  it.each`
    offset       | label
    ${37.5}      | ${"fraction"}
    ${40000}     | ${"above int16"}
    ${32768}     | ${"int16 max plus one"}
    ${-32769}    | ${"int16 min minus one"}
    ${NaN}       | ${"NaN"}
    ${Infinity}  | ${"Infinity"}
    ${"37"}      | ${"string"}
    ${37n}       | ${"bigint"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
  `("returns null for offset $offset ($label)", ({ offset }) => {
    expect(utcToPtp("2024-01-01T00:00:00Z", offset as number)).toBeNull();
  });

  it("returns null when the offset argument is left out", () => {
    // @ts-expect-error currentUtcOffset is required
    expect(utcToPtp("2024-01-01T00:00:00Z")).toBeNull();
  });

  it.each`
    value             | label
    ${1_704_067_200}  | ${"number"}
    ${null}           | ${"null"}
    ${undefined}      | ${"undefined"}
    ${{ seconds: 1 }} | ${"record"}
  `("returns null for the non-string value $label", ({ value }) => {
    expect(utcToPtp(value as never, 37)).toBeNull();
  });

  it.each`
    value                               | offset
    ${"2024-01-01T00:00:00Z"}           | ${37}
    ${"2024-01-01T02:00:00+02:00"}      | ${37}
    ${"2024-01-01T05:30:00,25+05:30"}   | ${37}
    ${"2024-01-01T00:00:00.000000001Z"} | ${37}
    ${"2024-01-01T00:00:00.5Z"}         | ${37}
    ${"2024-01-01T00:00:00Z"}           | ${0}
    ${"2017-01-01T00:00:00Z"}           | ${37}
    ${"2016-12-31T23:59:59Z"}           | ${36}
    ${"1970-01-01T00:00:00Z"}           | ${37}
    ${"1970-01-01T09:06:08Z"}           | ${-32768}
    ${"+275760-09-13T00:00:00Z"}        | ${37}
    ${"1970-01-01T00:00:00Z"}           | ${32767}
    ${"1970-01-01T09:06:08.000000001Z"} | ${-32768}
    ${"1969-12-31T23:00:00-02:00"}      | ${37}
  `(
    "isValidPtpTimestamp accepts the output for '$value' at offset $offset",
    ({ value, offset }) => {
      const result = utcToPtp(value, offset);

      expect(result).not.toBeNull();
      expect(isValidPtpTimestamp(result)).toBe(true);
    },
  );

  describe.each([37, 0, -32768, 32767])("round trip at offset %i", (offset) => {
    it.each([0, 1, 999_999_999])(
      "utcToPtp(ptpToUtc(t)) equals t for nanoseconds %i",
      (nanoseconds) => {
        const timestamp = { seconds: 1_704_067_237n, nanoseconds };

        expect(utcToPtp(ptpToUtc(timestamp, offset), offset)).toEqual(
          timestamp,
        );
      },
    );

    it.each([
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00.000000001Z",
      "2024-01-01T00:00:00.999999999Z",
    ])("ptpToUtc(utcToPtp('%s')) returns the input", (value) => {
      const timestamp = utcToPtp(value, offset);

      expect(timestamp).not.toBeNull();
      expect(ptpToUtc(timestamp as never, offset)).toBe(value);
    });
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(utcToPtp("2024-01-01T00:00:00Z", 37)).toBeNull();
  });
});
