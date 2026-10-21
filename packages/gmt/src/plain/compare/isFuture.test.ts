import type { MockedFunction } from "vitest";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { isFuture } from "./isFuture";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("isFuture", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it("returns false for the current instant (not future)", () => {
    expect(isFuture("2024-02-29")).toBe(false);
  });

  it.each`
    value           | expected
    ${"2024-03-01"} | ${true}
    ${"2999-01-01"} | ${true}
    ${"2024-02-29"} | ${false}
    ${"2024-02-28"} | ${false}
    ${"2020-01-01"} | ${false}
  `(
    "returns $expected for $value (today is 2024-02-29)",
    ({ value, expected }) => {
      expect(isFuture(value)).toBe(expected);
    },
  );

  it.each`
    value
    ${""}
    ${null}
    ${undefined}
    ${"not-a-date"}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isFuture(value as never)).toBe(false);
  });

  it("returns false when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(isFuture("2024-03-01")).toBe(false);
  });

  it("returns false when Temporal.Now.zonedDateTimeISO throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(isFuture("2024-03-01")).toBe(false);
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
