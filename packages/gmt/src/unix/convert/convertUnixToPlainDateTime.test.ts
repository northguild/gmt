import type { MockedFunction } from "vitest";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { convertUnixToPlainDateTime } from "./convertUnixToPlainDateTime";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("convertUnixToPlainDateTime", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
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

describe("convertUnixToPlainDateTime invalid-input @example", () => {
  it('returns "" for convertUnixToPlainDateTime(NaN)', () => {
    expect(convertUnixToPlainDateTime(NaN)).toBe("");
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
