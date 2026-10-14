import { Temporal } from "@js-temporal/polyfill";
import { certainlyTouchesMoreBuckets } from "./zoneBucketCap";

const at = (instant: string, zone: string) =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(zone);

describe("certainlyTouchesMoreBuckets", () => {
  it("is certain for a span well past the cap: 2000 to 2030 is 10,958 UTC days", () => {
    expect(
      certainlyTouchesMoreBuckets(
        at("2000-01-01T00:00:00Z", "UTC"),
        at("2030-01-01T00:00:00Z", "UTC"),
        "day",
        10_000,
      ),
    ).toBe(true);
  });

  it("is not certain for a span of exactly the cap", () => {
    // 2000-01-01 to 2027-05-19 is 10,000 UTC days.
    expect(
      certainlyTouchesMoreBuckets(
        at("2000-01-01T00:00:00Z", "UTC"),
        at("2027-05-19T00:00:00Z", "UTC"),
        "day",
        10_000,
      ),
    ).toBe(false);
  });

  it("leaves a span just past the cap to the walk: certainty needs a margin for partial days", () => {
    // 10,001 UTC days: over the cap, but within two days of it.
    expect(
      certainlyTouchesMoreBuckets(
        at("2000-01-01T00:00:00Z", "UTC"),
        at("2027-05-20T00:00:00Z", "UTC"),
        "day",
        10_000,
      ),
    ).toBe(false);
  });

  it("reads the cap it is given", () => {
    const start = at("2000-01-01T00:00:00Z", "UTC");
    const end = at("2030-01-01T00:00:00Z", "UTC");
    expect(certainlyTouchesMoreBuckets(start, end, "day", 20_000)).toBe(false);
    expect(certainlyTouchesMoreBuckets(start, end, "month", 300)).toBe(true);
  });

  it("does not count Samoa's deleted 30 December 2011 as a day", () => {
    // 1990-06-01 to 2017-10-17 is 10,001 calendar dates, one of them deleted, so the clock showed
    // 10,000: within the cap. A calendar-date count would call it over.
    expect(
      certainlyTouchesMoreBuckets(
        at("1990-06-01T19:00:00Z", "Pacific/Apia"),
        at("2017-10-16T18:00:00Z", "Pacific/Apia"),
        "day",
        10_000,
      ),
    ).toBe(false);
  });

  it("is not certain for an empty or inverted span", () => {
    const t = at("2024-06-15T12:00:00Z", "UTC");
    expect(certainlyTouchesMoreBuckets(t, t, "day", 0)).toBe(false);
    expect(
      certainlyTouchesMoreBuckets(t, at("2024-06-14T12:00:00Z", "UTC"), "day", 0),
    ).toBe(false);
  });
});
