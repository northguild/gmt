import { isValidTimezone } from "../../zoned/validate";
import { mockSystemTimezone } from "../test/runtimeFixtures";
import { getSystemTimezone } from "./getSystemTimezone";

describe("getSystemTimezone", () => {
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
  `("returns the mocked IANA timezone", ({ mockTimezone }) => {
    const restoreTimezone = mockSystemTimezone(mockTimezone);

    const timezone = getSystemTimezone();
    expect(timezone).toBe(mockTimezone);
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
