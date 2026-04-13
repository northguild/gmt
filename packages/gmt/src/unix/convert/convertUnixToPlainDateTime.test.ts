import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
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
    ${1706659200000} | ${undefined} | ${"2024-01-31T00:00:00"}
    ${1706659200}    | ${"seconds"} | ${"2024-01-31T00:00:00"}
    ${1704067200000} | ${undefined} | ${"2024-01-01T00:00:00"}
    ${1706713200000} | ${undefined} | ${"2024-01-31T15:00:00"}
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

  it.each`
    unix             | timeZone              | expected
    ${1706659200000} | ${"UTC"}              | ${"2024-01-31T00:00:00"}
    ${1706659200000} | ${"America/New_York"} | ${"2024-01-30T19:00:00"}
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
    ${-1}
    ${null}
    ${undefined}
  `("returns empty string for invalid unix $unix", ({ unix }) => {
    expect(convertUnixToPlainDateTime(unix as never)).toBe("");
  });
});
