import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
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
    ${1709164800000} | ${undefined} | ${"2024-02-29"}
    ${1709164800}    | ${"seconds"} | ${"2024-02-29"}
    ${-1}            | ${undefined} | ${"1969-12-31"}
    ${-86400}        | ${"seconds"} | ${"1969-12-31"}
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

  // yesterday tomorrow tests
  it.each`
    unix             | timeZone             | expected
    ${1709164800000} | ${"UTC"}             | ${"2024-02-29"}
    ${1709164800000} | ${YesterdayTimeZone} | ${"2024-02-28"}
    ${1709164800000} | ${TomorrowTimeZone}  | ${"2024-02-29"}
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
    ${null}
    ${undefined}
    ${1.5}
    ${-1.5}
  `("returns empty string for invalid unix $unix", ({ unix }) => {
    expect(convertUnixToPlainDate(unix as never)).toBe("");
  });
});

describe("convertUnixToPlainDate non-object options", () => {
  // Temporal GetOptionsObject: a legacy positional unit string (or null, or a number) is not an
  // options object, so it is the sentinel — never read as the default milliseconds, which would turn
  // 1710460800 seconds (2024-03-15) into "1970-01-20".
  it.each`
    options
    ${"seconds"}
    ${null}
    ${1000}
  `(
    'returns "" for convertUnixToPlainDate(1710460800, $options)',
    ({ options }) => {
      expect(convertUnixToPlainDate(1710460800, options as never)).toBe("");
    },
  );

  it('reads { epochUnit: "seconds" } as 2024-03-15 (UTC)', () => {
    expect(convertUnixToPlainDate(1710460800, { epochUnit: "seconds" })).toBe(
      "2024-03-15",
    );
  });
});

describe("convertUnixToPlainDate invalid-input @example", () => {
  it('returns "" for convertUnixToPlainDate(NaN)', () => {
    expect(convertUnixToPlainDate(NaN)).toBe("");
  });
});
