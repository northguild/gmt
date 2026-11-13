import type { MockedFunction } from "vitest";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { systemTimeZone } from "../../internal/resolveLocale";
import { isPast } from "./isPast";

vi.mock("../../internal/resolveLocale", { spy: true });

describe("isPast", () => {
  let timeZoneSpy: MockedFunction<typeof systemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
    timeZoneSpy = vi.mocked(systemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it("returns false for the current instant (not past)", () => {
    expect(isPast("2024-02-29")).toBe(false);
  });

  it.each`
    value           | expected
    ${"2024-02-28"} | ${true}
    ${"2020-01-01"} | ${true}
    ${"2024-02-29"} | ${false}
    ${"2024-03-01"} | ${false}
    ${"2999-01-01"} | ${false}
  `(
    "returns $expected for $value (today is 2024-02-29)",
    ({ value, expected }) => {
      expect(isPast(value)).toBe(expected);
    },
  );

  it.each`
    value           | label
    ${""}           | ${"''"}
    ${null}         | ${"null"}
    ${undefined}    | ${"undefined"}
    ${"not-a-date"} | ${"'not-a-date'"}
  `("returns false for invalid value $label", ({ value }) => {
    expect(isPast(value as never)).toBe(false);
  });

  it("returns false when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(isPast("2024-02-28")).toBe(false);
  });

  it("returns false when Temporal.Now.zonedDateTimeISO throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(isPast("2024-02-28")).toBe(false);
  });
});

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("systemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(systemTimeZone).mockReset();
  });

  it("returns the mocked zone while a row replaces it", () => {
    vi.mocked(systemTimeZone).mockReturnValue("Pacific/Kiritimati");
    expect(systemTimeZone()).toBe("Pacific/Kiritimati");
  });

  it("returns the host's own zone again in the next row", () => {
    expect(systemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
