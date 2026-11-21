import { describe, expect, it } from "vitest";
import { clockJump, zoneJump } from "./zone-jump";

describe("a zone's recorded jump", () => {
  it("finds the date Manila skipped, from the zone's own data", () => {
    const jump = zoneJump("Asia/Manila", [1844, 1845]);
    expect(jump?.pages).toEqual([
      { date: "1844-12-30", gap: false },
      { date: "1844-12-31", gap: true },
      { date: "1845-01-01", gap: false },
    ]);
  });

  it("gives no pages for a zone with no recorded change in those years", () => {
    expect(zoneJump("Asia/Manila", [1700])).toBeNull();
  });
});

describe("the hour a zone's clocks skip", () => {
  it("reads Helsinki's spring-forward in 2027 from the zone's own data", () => {
    expect(clockJump("Europe/Helsinki", [2027])).toEqual({
      date: "2027-03-28",
      from: "03:00",
      to: "04:00",
    });
  });

  it("gives nothing for a zone with no change in those years", () => {
    expect(clockJump("Asia/Kolkata", [2027])).toBeNull();
  });
});
