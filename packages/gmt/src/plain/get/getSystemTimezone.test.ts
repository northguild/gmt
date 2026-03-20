import { isValidTimezone } from "../../zoned/validate";
import { mockSystemTimezone } from "../test/runtimeFixtures";
import { getSystemTimezone } from "./getSystemTimezone";

describe("getSystemTimezone", () => {
  it("returns the mocked IANA timezone", () => {
    const restoreTimezone = mockSystemTimezone("Pacific/Chatham");

    const timezone = getSystemTimezone();

    expect(timezone).toBe("Pacific/Chatham");
    expect(isValidTimezone(timezone)).toBe(true);

    restoreTimezone();
  });

  it("returns an empty string if an error occurs", () => {
    const resolvedOptionsSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(() => {
        throw new Error("Simulated error");
      });

    try {
      const timezone = getSystemTimezone();
      expect(timezone).toBe("");
    } finally {
      resolvedOptionsSpy.mockRestore();
    }
  });
});
