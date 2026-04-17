import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { convertUnixToPlainTime } from "./convertUnixToPlainTime";

describe("convertUnixToPlainTime", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    unix             | epochUnit         | expected
    ${1709164800000} | ${undefined}      | ${"00:00:00"}
    ${1709164800}    | ${"seconds"}      | ${"00:00:00"}
    ${1709164800000} | ${"milliseconds"} | ${"00:00:00"}
    ${1709218800000} | ${undefined}      | ${"15:00:00"}
    ${-1}            | ${undefined}      | ${"23:59:59.999"}
    ${-86400}        | ${"seconds"}      | ${"00:00:00"}
  `(
    "returns $expected for unix $unix with epochUnit $epochUnit",
    ({ unix, epochUnit, expected }) => {
      expect(
        convertUnixToPlainTime(unix as never, {
          epochUnit: epochUnit as never,
        }),
      ).toBe(expected);
    },
  );

  // yesterday tomorrow tests
  it.each`
    unix             | timeZone             | expected
    ${1709164800000} | ${"UTC"}             | ${"00:00:00"}
    ${1709164800000} | ${YesterdayTimeZone} | ${"13:00:00"}
    ${1709164800000} | ${TomorrowTimeZone}  | ${"13:00:00"}
  `(
    "returns $expected for unix $unix in timeZone $timeZone",
    ({ unix, timeZone, expected }) => {
      expect(
        convertUnixToPlainTime(unix, { timeZone, epochUnit: "milliseconds" }),
      ).toBe(expected);
    },
  );

  it.each`
    unix
    ${"invalid"}
    ${null}
    ${undefined}
    ${1.5}
    ${-1.5}
  `("returns empty string for invalid unix $unix", ({ unix }) => {
    expect(convertUnixToPlainTime(unix as never)).toBe("");
  });
});
