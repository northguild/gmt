/**
 * Reading the venue's time for the Earth clock, over gmt faked by hand: the zoned string and the
 * unix milliseconds are fixed, so the reading is exact. A held instant is read by gmt itself.
 */
import { loadClock } from "./title-clock";

const clock = vi.hoisted(() => ({ ms: 1_800_000_030_250, time: "18:42:30" }));
vi.mock("@northguild/gmt/unix/get", () => ({ getUnixNow: () => clock.ms }));
vi.mock("@northguild/gmt/zoned/get", () => ({
  getZonedNow: (zone: string) =>
    zone === "Nowhere/Land" ? "" : `2026-12-01T${clock.time}+02:00[${zone}]`,
}));

describe("the venue's time", () => {
  it("reads the zone's wall time and the zoned string it came from", async () => {
    const venue = await loadClock("Europe/Helsinki");
    expect(venue?.read()).toEqual({
      hour: 18,
      minute: 42,
      second: 30,
      zoned: "2026-12-01T18:42:30+02:00[Europe/Helsinki]",
    });
  });

  it("waits until just after the next whole second", async () => {
    const venue = await loadClock("Europe/Helsinki");
    // 250 ms into the second: 750 ms to go, and 20 more so the read lands past the edge.
    expect(venue?.untilNextSecond()).toBe(770);
  });

  it("reads no time for a zone gmt does not know", async () => {
    const venue = await loadClock("Nowhere/Land");
    expect(venue?.read()).toBeNull();
  });

  it("reads a held instant as the zone's wall time, on either side of a skipped hour", async () => {
    const venue = await loadClock("Europe/Helsinki");
    expect(venue?.at("2027-03-28T00:59:00Z")).toEqual({
      hour: 2,
      minute: 59,
      second: 0,
      zoned: "2027-03-28T02:59:00+02:00[Europe/Helsinki]",
    });
    expect(venue?.at("2027-03-28T01:00:00Z")).toEqual({
      hour: 4,
      minute: 0,
      second: 0,
      zoned: "2027-03-28T04:00:00+03:00[Europe/Helsinki]",
    });
  });

  it("reads no time for an instant gmt rejects", async () => {
    const venue = await loadClock("Europe/Helsinki");
    expect(venue?.at("2027-03-28T02:59:00")).toBeNull();
  });
});
