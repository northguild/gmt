import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { isZonedPast } from "./isZonedPast";

describe("isZonedPast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(battleTestTimeZones)(
    "returns true for a distant-past instant represented in %s",
    (timeZone) => {
      const value = Temporal.Instant.from("2020-01-01T00:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(isZonedPast(value)).toBe(true);
    },
  );

  it.each(battleTestTimeZones)(
    "returns false for a distant-future instant represented in %s",
    (timeZone) => {
      const value = Temporal.Instant.from("2999-01-01T00:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(isZonedPast(value)).toBe(false);
    },
  );

  it("returns false for the exact current instant", () => {
    const value = Temporal.Now.instant().toZonedDateTimeISO("UTC").toString();
    expect(isZonedPast(value)).toBe(false);
  });

  it.each`
    value
    ${""}
    ${null}
    ${undefined}
    ${"not-a-zoned-datetime"}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isZonedPast(value as never)).toBe(false);
  });

  it("returns false when Temporal.Now.instant throws", () => {
    mockTemporalNowInstantThrow();
    expect(isZonedPast("2020-01-01T00:00:00+00:00[UTC]")).toBe(false);
  });
});
