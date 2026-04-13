import { mockSystemTimeZone } from "../../test";
import { isValidTimeZone } from "../../zoned/validate";
import { getSystemTimeZone } from "./getSystemTimeZone";

describe("getSystemTimeZone", () => {
  it.each`
    mockTimezone
    ${"UTC"}
    ${"Etc/GMT"}
    ${"GMT"}
    ${"Europe/Lisbon"}
    ${"Europe/Dublin"}
    ${"Europe/Berlin"}
    ${"Europe/Helsinki"}
    ${"Europe/Istanbul"}
    ${"Asia/Kolkata"}
    ${"Asia/Kathmandu"}
    ${"Asia/Shanghai"}
    ${"Australia/Lord_Howe"}
    ${"Pacific/Chatham"}
    ${"Pacific/Apia"}
    ${"Pacific/Niue"}
    ${"America/New_York"}
    ${"America/Chicago"}
    ${"America/Phoenix"}
  `("returns the mocked IANA timeZone $mockTimezone", ({ mockTimezone }) => {
    const restoreTimezone = mockSystemTimeZone(mockTimezone);

    const timeZone = getSystemTimeZone();
    expect(timeZone).toBe(mockTimezone);
    expect(isValidTimeZone(timeZone)).toBe(true);
    restoreTimezone();
  });

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
