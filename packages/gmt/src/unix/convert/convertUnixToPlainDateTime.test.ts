import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { convertUnixToPlainDateTime } from "./convertUnixToPlainDateTime";

describe("convertUnixToPlainDateTime", () => {
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
    unix             | epochUnit    | expected
    ${1709164800000} | ${undefined} | ${"2024-02-29T00:00:00"}
    ${1709164800}    | ${"seconds"} | ${"2024-02-29T00:00:00"}
    ${-1}            | ${undefined} | ${"1969-12-31T23:59:59.999"}
    ${-86400}        | ${"seconds"} | ${"1969-12-31T00:00:00"}
  `(
    "returns $expected for unix $unix with epochUnit $epochUnit",
    ({ unix, epochUnit, expected }) => {
      expect(
        convertUnixToPlainDateTime(unix as never, {
          epochUnit: epochUnit as never,
        }),
      ).toBe(expected);
    },
  );

  // yesterday tomorrow tests
  it.each`
    unix             | timeZone             | expected
    ${1709164800000} | ${"UTC"}             | ${"2024-02-29T00:00:00"}
    ${1709164800000} | ${YesterdayTimeZone} | ${"2024-02-28T13:00:00"}
    ${1709164800000} | ${TomorrowTimeZone}  | ${"2024-02-29T13:00:00"}
  `(
    "returns $expected for unix $unix in timeZone $timeZone",
    ({ unix, timeZone, expected }) => {
      expect(
        convertUnixToPlainDateTime(unix, {
          timeZone,
          epochUnit: "milliseconds",
        }),
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
    expect(convertUnixToPlainDateTime(unix as never)).toBe("");
  });
});
