import type { MockedFunction } from "vitest";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { convertUnixToPlainTime } from "./convertUnixToPlainTime";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("convertUnixToPlainTime", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
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

describe("convertUnixToPlainTime invalid-input @example", () => {
  it('returns "" for convertUnixToPlainTime(NaN)', () => {
    expect(convertUnixToPlainTime(NaN)).toBe("");
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
