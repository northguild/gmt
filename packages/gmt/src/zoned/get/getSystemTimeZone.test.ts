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

  // ICU reports "Etc/Unknown" when it cannot work out the host zone (for example `TZ=""`), and
  // Node reports `undefined` for a `TZ` it does not recognise. Neither is a zone that Temporal or
  // `Intl.DateTimeFormat` accepts, so neither may be handed to a caller as the system zone.
  it.each`
    reported         | description
    ${"Etc/Unknown"} | ${"ICU's unknown-zone placeholder"}
    ${undefined}     | ${"no zone"}
    ${""}            | ${"an empty identifier"}
  `(
    "returns an empty string when the host reports $description",
    ({ reported }) => {
      const defaultOptions = Intl.DateTimeFormat().resolvedOptions();
      const resolvedOptionsSpy = vi
        .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
        .mockReturnValue({ ...defaultOptions, timeZone: reported });

      try {
        expect(getSystemTimeZone()).toBe("");
      } finally {
        resolvedOptionsSpy.mockRestore();
      }
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
