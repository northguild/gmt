import {
  INVALID_PTP_RECORDS,
  VALID_PTP_RECORDS,
} from "../../test/ptpTimestampRows";
import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { ptpToUtc } from "./ptpToUtc";

// Every expected value: seconds - offset, then Temporal's Instant#toString, checked against
// @js-temporal/polyfill with a plain script (not against ptpToUtc).
describe("ptpToUtc", () => {
  it.each`
    seconds                 | nanoseconds  | offset    | expected                            | label
    ${1_704_067_237n}       | ${0}         | ${37}     | ${"2024-01-01T00:00:00Z"}           | ${"issue verification"}
    ${1_704_067_237n}       | ${0}         | ${0}      | ${"2024-01-01T00:00:37Z"}           | ${"zero offset keeps the 37 s error"}
    ${1_704_067_237n}       | ${0}         | ${36}     | ${"2024-01-01T00:00:01Z"}           | ${"stale 2016 offset"}
    ${1_704_067_237}        | ${500000000} | ${37}     | ${"2024-01-01T00:00:00.5Z"}         | ${"number seconds"}
    ${1_704_067_237n}       | ${1}         | ${37}     | ${"2024-01-01T00:00:00.000000001Z"} | ${"one nanosecond kept"}
    ${1_704_067_237n}       | ${999999999} | ${37}     | ${"2024-01-01T00:00:00.999999999Z"} | ${"top nanosecond kept"}
    ${37n}                  | ${0}         | ${37}     | ${"1970-01-01T00:00:00Z"}           | ${"earliest result accepted"}
    ${36n}                  | ${999999999} | ${37}     | ${""}                               | ${"one nanosecond before 1970"}
    ${0n}                   | ${0}         | ${37}     | ${""}                               | ${"unset clock"}
    ${0n}                   | ${0}         | ${0}      | ${"1970-01-01T00:00:00Z"}           | ${"zero offset at the epoch"}
    ${0n}                   | ${0}         | ${-32768} | ${"1970-01-01T09:06:08Z"}           | ${"lowest int16"}
    ${0n}                   | ${0}         | ${32767}  | ${""}                               | ${"highest int16 is before 1970"}
    ${1_483_228_836n}       | ${0}         | ${36}     | ${"2017-01-01T00:00:00Z"}           | ${"inserted second on the old offset"}
    ${1_483_228_836n}       | ${0}         | ${37}     | ${"2016-12-31T23:59:59Z"}           | ${"inserted second on the new offset, no :60"}
    ${1_483_228_837n}       | ${0}         | ${37}     | ${"2017-01-01T00:00:00Z"}           | ${"first second after the insertion"}
    ${253_402_300_836n}     | ${999999999} | ${37}     | ${"9999-12-31T23:59:59.999999999Z"} | ${"last instant of year 9999"}
    ${253_402_300_837n}     | ${0}         | ${37}     | ${"+010000-01-01T00:00:00Z"}        | ${"expanded year"}
    ${32_767n}              | ${0}         | ${32767}  | ${"1970-01-01T00:00:00Z"}           | ${"highest int16 reaches the epoch"}
    ${32_767n}              | ${5}         | ${32767}  | ${"1970-01-01T00:00:00.000000005Z"} | ${"highest int16 keeps nanoseconds"}
    ${1_704_067_237n}       | ${0}         | ${-1}     | ${"2024-01-01T00:00:38Z"}           | ${"negative offset adds a second"}
    ${8_640_000_000_037n}   | ${0}         | ${37}     | ${"+275760-09-13T00:00:00Z"}        | ${"Temporal's last instant"}
    ${8_640_000_000_037n}   | ${1}         | ${37}     | ${""}                               | ${"one nanosecond past Temporal"}
    ${281_474_976_710_655n} | ${999999999} | ${37}     | ${""}                               | ${"valid record outside Temporal's range"}
  `(
    "returns '$expected' for seconds $seconds, nanoseconds $nanoseconds, offset $offset ($label)",
    ({ seconds, nanoseconds, offset, expected }) => {
      expect(ptpToUtc({ seconds, nanoseconds }, offset)).toBe(expected);
    },
  );

  it.each`
    offset       | expected                  | label
    ${37.5}      | ${""}                     | ${"fraction"}
    ${40000}     | ${""}                     | ${"above int16"}
    ${32768}     | ${""}                     | ${"int16 max plus one"}
    ${-32769}    | ${""}                     | ${"int16 min minus one"}
    ${NaN}       | ${""}                     | ${"NaN"}
    ${Infinity}  | ${""}                     | ${"Infinity"}
    ${-Infinity} | ${""}                     | ${"negative Infinity"}
    ${true}      | ${""}                     | ${"boolean"}
    ${{}}        | ${""}                     | ${"object"}
    ${"37"}      | ${""}                     | ${"string"}
    ${37n}       | ${""}                     | ${"bigint"}
    ${null}      | ${""}                     | ${"null"}
    ${undefined} | ${""}                     | ${"undefined"}
    ${-0}        | ${"2024-01-01T00:00:37Z"} | ${"negative zero reads as 0"}
  `(
    "returns '$expected' for offset $offset ($label)",
    ({ offset, expected }) => {
      expect(
        ptpToUtc({ seconds: 1_704_067_237n, nanoseconds: 0 }, offset as number),
      ).toBe(expected);
    },
  );

  it("returns '' when the offset argument is left out", () => {
    // @ts-expect-error currentUtcOffset is required
    expect(ptpToUtc({ seconds: 1_704_067_237n, nanoseconds: 0 })).toBe("");
  });

  describe.each([37, 0, -32768, 32767])("offset %i", (offset) => {
    it.each(INVALID_PTP_RECORDS)(
      "returns '' for the invalid record '$name' ($reason)",
      ({ value }) => {
        expect(ptpToUtc(value as never, offset)).toBe("");
      },
    );
  });

  it.each(VALID_PTP_RECORDS)(
    "returns an instant ending in Z for the valid record '$name' at offset 0, or '' past Temporal",
    ({ value }) => {
      const result = ptpToUtc(value as never, 0);
      const { seconds } = value as { seconds: bigint | number };

      // Temporal's last instant is 8_640_000_000_000 s after 1970; the row's own seconds decide.
      if (BigInt(seconds) > 8_640_000_000_000n) {
        expect(result).toBe("");
      } else {
        expect(result).toMatch(/Z$/);
      }
    },
  );

  it("does not change a frozen input record", () => {
    const record = Object.freeze({ seconds: 1_704_067_237n, nanoseconds: 5 });

    expect(ptpToUtc(record, 37)).toBe("2024-01-01T00:00:00.000000005Z");
    expect(record).toStrictEqual({ seconds: 1_704_067_237n, nanoseconds: 5 });
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();

    expect(ptpToUtc({ seconds: 1_704_067_237n, nanoseconds: 0 }, 37)).toBe("");
  });
});
