import { describe, expect, it } from "vitest";
import { zoneJump } from "./zone-jump";

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
