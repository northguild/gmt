import type { MockedFunction } from "vitest";
import { Temporal } from "../../internal/temporal";
import { isValidDate } from "../validate/isValidDate";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { getYear } from "./getYear";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("getYear", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it("returns current year", () => {
    expect(getYear()).toBe("2024");
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getYear()).toBe("");
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"2024"}
    ${YesterdayTimeZone} | ${"2024"}
    ${TomorrowTimeZone}  | ${"2024"}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getYear()).toBe(expected);
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getYear();
    expect(result).toBe("");
  });
});

// The clock read in the middle of each year. A year outside 0000 to 9999 is written as Temporal
// writes it at the head of a date, with a sign and six digits (TC39 Temporal `PadISOYear ( y )`, §3.5.10), so
// `<year>-06-15` is the date `Temporal.PlainDate` writes and `isValidDate` reads.
describe("getYear with the clock outside years 0000 to 9999", () => {
  afterEach(() => {
    vi.mocked(getSystemTimeZone).mockReset();
    vi.useRealTimers();
  });

  it.each`
    clock                        | expected
    ${"-000005-06-15T12:00:00Z"} | ${"-000005"}
    ${"0000-06-15T12:00:00Z"}    | ${"0000"}
    ${"9999-06-15T12:00:00Z"}    | ${"9999"}
    ${"+010000-06-15T12:00:00Z"} | ${"+010000"}
    ${"-271821-06-15T12:00:00Z"} | ${"-271821"}
    ${"+275760-06-15T12:00:00Z"} | ${"+275760"}
  `("returns $expected when the clock reads $clock", ({ clock, expected }) => {
    vi.useFakeTimers();
    vi.setSystemTime(Temporal.Instant.from(clock).epochMilliseconds);
    vi.mocked(getSystemTimeZone).mockReturnValue("UTC");

    const year = getYear();

    expect(year).toBe(expected);
    expect(
      Temporal.Instant.from(clock)
        .toZonedDateTimeISO("UTC")
        .toPlainDate()
        .toString(),
    ).toBe(`${year}-06-15`);
    expect(isValidDate(`${year}-06-15`)).toBe(true);
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
