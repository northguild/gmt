import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
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
    ${1706659200000} | ${undefined}      | ${"00:00:00"}
    ${1706659200}    | ${"seconds"}      | ${"00:00:00"}
    ${1706659200000} | ${"milliseconds"} | ${"00:00:00"}
    ${1706713200000} | ${undefined}      | ${"15:00:00"}
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

  it.each`
    unix             | timeZone              | expected
    ${1706659200000} | ${"UTC"}              | ${"00:00:00"}
    ${1706659200000} | ${"America/New_York"} | ${"19:00:00"}
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
    ${-1}
    ${null}
    ${undefined}
  `("returns empty string for invalid unix $unix", ({ unix }) => {
    expect(convertUnixToPlainTime(unix as never)).toBe("");
  });
});
