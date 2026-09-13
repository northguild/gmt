import { mockSystemTimeZone, battleTestTimeZones } from "../../test";
import { isValidTimeZone } from "../validate";
import { getSystemTimeZone } from "./getSystemTimeZone";

describe("getSystemTimeZone", () => {
  it.each(battleTestTimeZones.map((mockTimezone) => ({ mockTimezone })))(
    "returns the mocked IANA timeZone $mockTimezone",
    ({ mockTimezone }) => {
      const restoreTimezone = mockSystemTimeZone(mockTimezone);

      const timeZone = getSystemTimeZone();
      expect(timeZone).toBe(mockTimezone);
      expect(isValidTimeZone(timeZone)).toBe(true);
      restoreTimezone();
    },
  );

  it("returns an empty string if an error occurs", () => {
    const resolvedOptionsSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(() => {
        throw new Error("Simulated error");
      });

    try {
      const timeZone = getSystemTimeZone();
      expect(timeZone).toBe("");
    } finally {
      resolvedOptionsSpy.mockRestore();
    }
  });
});
