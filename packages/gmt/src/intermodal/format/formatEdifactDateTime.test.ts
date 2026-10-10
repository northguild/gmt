import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseEdifactDateTime } from "../parse/parseEdifactDateTime";
import { formatEdifactDateTime } from "./formatEdifactDateTime";

/**
 * Every expected value is the ISO 8601 date-time placed under the UNTDID 2379 mask by hand:
 * `203` is `CCYYMMDDHHMM` and `204` is `CCYYMMDDHHMMSS`. What the mask has no field for is left
 * out, never rounded.
 */
describe("formatEdifactDateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("203 CCYYMMDDHHMM and 204 CCYYMMDDHHMMSS: a date and time with no offset", () => {
    // `readsBack` is the date-time cut to the mask's smallest field, which the parser returns.
    it.each`
      code     | value                              | expected            | readsBack                | reads
      ${"203"} | ${"2024-06-15T14:30:00"}           | ${"202406151430"}   | ${"2024-06-15T14:30:00"} | ${"zero seconds"}
      ${"203"} | ${"2024-06-15T14:30"}              | ${"202406151430"}   | ${"2024-06-15T14:30:00"} | ${"no seconds given"}
      ${"203"} | ${"2024-06-15T14:30:45"}           | ${"202406151430"}   | ${"2024-06-15T14:30:00"} | ${"seconds are dropped: the mask has none"}
      ${"203"} | ${"2024-06-15T23:59:59.999999999"} | ${"202406152359"}   | ${"2024-06-15T23:59:00"} | ${"the last nanosecond of the day stays on its day"}
      ${"203"} | ${"2024-12-31T23:59:59.9"}         | ${"202412312359"}   | ${"2024-12-31T23:59:00"} | ${"the last tenth of a year keeps its date: the cut never reaches the next year"}
      ${"203"} | ${"0000-01-01T00:00:00"}           | ${"000001010000"}   | ${"0000-01-01T00:00:00"} | ${"the first four-digit year"}
      ${"203"} | ${"9999-12-31T23:59:00"}           | ${"999912312359"}   | ${"9999-12-31T23:59:00"} | ${"the last four-digit year"}
      ${"204"} | ${"2024-06-15T14:30:45"}           | ${"20240615143045"} | ${"2024-06-15T14:30:45"} | ${"with seconds"}
      ${"204"} | ${"2024-06-15T14:30"}              | ${"20240615143000"} | ${"2024-06-15T14:30:00"} | ${"no seconds given: written as 00"}
      ${"204"} | ${"2024-06-15T14:30:45.9"}         | ${"20240615143045"} | ${"2024-06-15T14:30:45"} | ${"0.9 of a second is dropped, not rounded up"}
      ${"204"} | ${"2024-02-29T23:59:59.5"}         | ${"20240229235959"} | ${"2024-02-29T23:59:59"} | ${"leap day: the cut never reaches 1 March"}
    `(
      "writes $value under $code as $expected, which reads back as $readsBack ($reads)",
      ({ code, value, expected, readsBack }) => {
        expect(formatEdifactDateTime(value, code)).toBe(expected);
        expect(parseEdifactDateTime(expected, code)).toBe(readsBack);
      },
    );
  });

  describe("the value is a local date-time, as isValidDateTime accepts it", () => {
    it.each`
      value                          | reads
      ${"2024-06-15"}                | ${"a date: use formatEdifactDate"}
      ${"14:30"}                     | ${"a time"}
      ${"2024-06-15T14:30:00Z"}      | ${"an instant: a local code has no offset to hold"}
      ${"2024-06-15T14:30:00+02:00"} | ${"a date-time with an offset: use formatEdifactOffsetDateTime"}
      ${"2024-06-15 14:30"}          | ${"a space separator"}
      ${"20240615T1430"}             | ${"basic format: the input is extended ISO 8601"}
      ${"2023-02-29T14:30"}          | ${"29 February 2023"}
      ${"2024-06-15T24:00"}          | ${"hour 24"}
      ${"2024-06-15T23:59:60"}       | ${"a leap second"}
      ${"+010000-01-01T00:00"}       | ${"year 10000: CCYY is four digits"}
      ${"-000001-12-31T23:59"}       | ${"a year before 0000"}
      ${""}                          | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      expect(formatEdifactDateTime(value, "203")).toBe("");
      expect(formatEdifactDateTime(value, "204")).toBe("");
    });
  });

  describe("a code that does not state a local date-time", () => {
    it.each(edifactFormatsOutside("dateTime"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(
          formatEdifactDateTime("2024-06-15T14:30:45", code as never),
        ).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => formatEdifactDateTime(bad as never, "203")}
      ${"format"} | ${(bad: unknown) => formatEdifactDateTime("2024-06-15T14:30", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(formatEdifactDateTime("2024-06-15T14:30", "203")).toBe("");
  });
});
