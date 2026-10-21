import type { MockedFunction } from "vitest";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { convertUnixToPlainDate } from "./convertUnixToPlainDate";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("convertUnixToPlainDate", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
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

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("getSystemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(getSystemTimeZone).mockReset();
  });

  it("returns the mocked zone while a row replaces it", () => {
    vi.mocked(getSystemTimeZone).mockReturnValue("Pacific/Kiritimati");
    expect(getSystemTimeZone()).toBe("Pacific/Kiritimati");
  });

  it("returns the host's own zone again in the next row", () => {
    expect(getSystemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
