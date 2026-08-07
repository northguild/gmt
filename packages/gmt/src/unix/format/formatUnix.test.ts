import { expectDateTimeEqual, MustTestLocales } from "../../test";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { formatUnix } from "./formatUnix";

// Base: 2024-02-29T00:00:00Z (Thursday — leap day)
const REF_MS = 1709164800000;
const REF_S = 1709164800;

describe("formatUnix", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Basic en-US formatting with UTC timezone (all dateStyle/timeStyle combos)
  // PlainDateTime.toLocaleString is used internally, so the output does NOT
  // include a timezone name even with full/long styles.
  // ---------------------------------------------------------------------------
  describe("en-US style variants (UTC)", () => {
    it.each`
      options                                         | expected
      ${{ dateStyle: "full", timeStyle: "full" }}     | ${"Thursday, February 29, 2024 at 12:00:00 AM"}
      ${{ dateStyle: "long", timeStyle: "long" }}     | ${"February 29, 2024 at 12:00:00 AM"}
      ${{ dateStyle: "medium", timeStyle: "medium" }} | ${"Feb 29, 2024, 12:00:00 AM"}
      ${{ dateStyle: "short", timeStyle: "short" }}   | ${"2/29/24, 12:00 AM"}
    `("formats $options as $expected", ({ options, expected }) => {
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          ...options,
          timeZone: "UTC",
        }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Locale coverage — medium/short, UTC
  // One representative case across all MustTestLocales.
  // ---------------------------------------------------------------------------
  describe("locale coverage — medium/short (UTC)", () => {
    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${"Feb 29, 2024, 12:00 AM"}
      ${MustTestLocales.enGB} | ${"29 Feb 2024, 00:00"}
      ${MustTestLocales.deDE} | ${"29.02.2024, 00:00"}
      ${MustTestLocales.frFR} | ${"29 févr. 2024, 00:00"}
      ${MustTestLocales.esES} | ${"29 feb 2024, 0:00"}
      ${MustTestLocales.itIT} | ${"29 feb 2024, 00:00"}
      ${MustTestLocales.ptPT} | ${"29/02/2024, 00:00"}
      ${MustTestLocales.svSE} | ${"29 feb. 2024 00:00"}
      ${MustTestLocales.isIS} | ${"29. feb. 2024, 00:00"}
      ${MustTestLocales.zhCN} | ${"2024年2月29日 00:00"}
      ${MustTestLocales.zhTW} | ${"2024年2月29日 凌晨12:00"}
      ${MustTestLocales.jaJP} | ${"2024/02/29 0:00"}
      ${MustTestLocales.koKR} | ${"2024. 2. 29. 오전 12:00"}
      ${MustTestLocales.arSA} | ${"٢٩/٠٢/٢٠٢٤، ١٢:٠٠ ص"}
      ${MustTestLocales.heIL} | ${"29 בפבר׳ 2024, 0:00"}
      ${MustTestLocales.ruRU} | ${"29 февр. 2024 г., 00:00"}
      ${MustTestLocales.trTR} | ${"29 Şub 2024 00:00"}
    `("formats for $locale as $expected", ({ locale, expected }) => {
      const options = {
        dateStyle: "medium" as const,
        timeStyle: "short" as const,
        timeZone: "UTC" as const,
      };
      expectDateTimeEqual(formatUnix(REF_MS, locale, options), expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Timezone handling
  // REF_MS = 2024-02-29T00:00:00Z (February is CET/EST/JST offsets below)
  // ---------------------------------------------------------------------------
  describe("timezone handling", () => {
    it.each`
      timeZone              | expected
      ${"UTC"}              | ${"February 29, 2024 at 12:00:00 AM"}
      ${"Europe/Paris"}     | ${"February 29, 2024 at 1:00:00 AM"}
      ${"America/New_York"} | ${"February 28, 2024 at 7:00:00 PM"}
      ${"Asia/Tokyo"}       | ${"February 29, 2024 at 9:00:00 AM"}
    `("converts REF_MS to $timeZone as $expected", ({ timeZone, expected }) => {
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "long",
          timeZone,
        }),
      ).toBe(expected);
    });

    it("defaults to system timezone when no timeZone is provided", () => {
      vi.spyOn(getSystemTimeZoneModule, "getSystemTimeZone").mockReturnValue(
        "UTC",
      );
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "long",
        }),
      ).toBe("February 29, 2024 at 12:00:00 AM");
    });

    it("uses getSystemTimeZone() when timeZone is 'local'", () => {
      vi.spyOn(getSystemTimeZoneModule, "getSystemTimeZone").mockReturnValue(
        "Europe/Paris",
      );
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "long",
          timeZone: "local",
        }),
      ).toBe("February 29, 2024 at 1:00:00 AM");
    });

    it("falls back to UTC when an invalid timezone is provided", () => {
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "long",
          timeZone: "Invalid/Zone",
        }),
      ).toBe("February 29, 2024 at 12:00:00 AM");
    });
  });

  // ---------------------------------------------------------------------------
  // includeTimeZoneName — mirrors formatUtc.includeTimeZoneName
  // ---------------------------------------------------------------------------
  describe("includeTimeZoneName", () => {
    it("omits the timezone name by default (PlainDateTime path)", () => {
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "long",
          timeZone: "UTC",
        }),
      ).toBe("February 29, 2024 at 12:00:00 AM");
    });

    it("includes the timezone name when includeTimeZoneName is true", () => {
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "long",
          timeZone: "UTC",
          includeTimeZoneName: true,
        }),
      ).toContain("UTC");
    });
  });

  // ---------------------------------------------------------------------------
  // epochUnit: "seconds"
  // ---------------------------------------------------------------------------
  describe("epochUnit: seconds", () => {
    it("formats a unix-seconds value identically to the ms equivalent", () => {
      expect(
        formatUnix(REF_S, MustTestLocales.enUS, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
          epochUnit: "seconds",
        }),
      ).toBe("Feb 29, 2024, 12:00 AM");
    });

    it("returns '' for an invalid epochUnit string", () => {
      expect(
        formatUnix(REF_MS, MustTestLocales.enUS, {
          epochUnit: "hours" as never,
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Numeric string input
  // ---------------------------------------------------------------------------
  describe("numeric string input", () => {
    it("accepts a numeric ms string", () => {
      expect(
        formatUnix(String(REF_MS), MustTestLocales.enUS, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }),
      ).toBe("Feb 29, 2024, 12:00 AM");
    });

    it("accepts a negative numeric string (pre-epoch date)", () => {
      // -86400000 = 1969-12-31T00:00:00Z
      expect(
        formatUnix("-86400000", MustTestLocales.enUS, {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "UTC",
        }),
      ).not.toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value
      ${"not-a-number"}
      ${"12.5ms"}
      ${""}
      ${null}
      ${undefined}
      ${NaN}
      ${Infinity}
      ${-Infinity}
      ${true}
    `("returns '' for $value", ({ value }) => {
      expect(
        formatUnix(value as never, MustTestLocales.enUS, { timeZone: "UTC" }),
      ).toBe("");
    });
  });
});
