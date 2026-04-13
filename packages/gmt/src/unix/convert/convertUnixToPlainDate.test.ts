import * as getSystemTimeZoneModule from "../../plain/get/getSystemTimeZone";
import { convertUnixToPlainDate } from "./convertUnixToPlainDate";

describe("convertUnixToPlainDate", () => {
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
    ${1706659200000} | ${undefined} | ${"2024-01-31"}
    ${1706659200}    | ${"seconds"} | ${"2024-01-31"}
    ${1704067200000} | ${undefined} | ${"2024-01-01"}
    ${1706745600000} | ${undefined} | ${"2024-02-01"}
  `(
    "returns $expected for unix $unix with epochUnit $epochUnit",
    ({ unix, epochUnit, expected }) => {
      expect(
        convertUnixToPlainDate(unix as never, {
          epochUnit: epochUnit as never,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    unix             | timeZone              | expected
    ${1706659200000} | ${"UTC"}              | ${"2024-01-31"}
    ${1706659200000} | ${"America/New_York"} | ${"2024-01-30"}
  `(
    "returns $expected for unix $unix in timeZone $timeZone",
    ({ unix, timeZone, expected }) => {
      expect(
        convertUnixToPlainDate(unix, { timeZone, epochUnit: "milliseconds" }),
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
    expect(convertUnixToPlainDate(unix as never)).toBe("");
  });
});
