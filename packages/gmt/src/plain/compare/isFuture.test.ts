import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { isFuture } from "./isFuture";

describe("isFuture", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
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
