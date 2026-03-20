import { formatZonedRange } from "./formatZonedRange";

describe("formatZonedRange", () => {
  // en-US
  it.each`
    from                                             | to                                               | locale     | options                                                                 | expected
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "long", timeStyle: "long" }}                             | ${"February 29, 2024, 10:00:00 AM EST – 12:00:00 PM EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "long", timeStyle: "short" }}                            | ${"February 29, 2024, 10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dateStyle: "short", timeStyle: "short" }}                           | ${"2/29/24, 10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "short" }}        | ${"10:00 AM – 12:00 PM EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "long" }}         | ${"10:00 AM – 12:00 PM EST"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortGeneric" }} | ${"10:00 AM – 12:00 PM ET"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "longGeneric" }}  | ${"10:00 AM – 12:00 PM ET"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }}  | ${"10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "longOffset" }}   | ${"10:00 AM – 12:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "narrow" }}                                              | ${"in the morning"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "short" }}                                               | ${"in the morning"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ dayPeriod: "long" }}                                                | ${"in the morning"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ formatMatcher: "basic" }}                                           | ${"2/29/2024, 10:00:00 AM – 12:00:00 PM"}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"en-US"} | ${{ formatMatcher: "best fit" }}                                        | ${"2/29/2024, 10:00:00 AM – 12:00:00 PM"}
  `(
    "formats a valid zoned datetime range correctly for locale $locale",
    ({ from, to, locale, options, expected }) => {
      expect(formatZonedRange(from, to, locale, options)).toBe(expected);
    },
  );

  it.each`
    from                                             | to
    ${"2024-02-29T10:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00+01:00[Europe/Paris]"}
    ${"2024-02-29T10:00:00+00:00[UTC]"}              | ${"2024-02-29T12:00:00+09:00[Asia/Tokyo]"}
  `(
    "returns empty string when range endpoints use different timezones: $from -> $to",
    ({ from, to }) => {
      expect(
        formatZonedRange(from, to, "en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),
      ).toBe("");
    },
  );

  it("forces formatting to use endpoint timezone even when options.timeZone is provided", () => {
    const from = "2024-02-29T10:00:00-05:00[America/New_York]";
    const to = "2024-02-29T12:00:00-05:00[America/New_York]";

    expect(
      formatZonedRange(from, to, "en-US", {
        hour: "numeric",
        minute: "numeric",
        timeZoneName: "short",
        timeZone: "UTC",
      }),
    ).toBe("10:00 AM – 12:00 PM EST");
  });

  // TODO do rest of locales
  // en-GB
  // de-DE
  // fr-FR
  // es-ES
  // it-IT
  // pt-PT
  // sv-SE
  // is-IS
  // zh-CN
  // zh-TW
  // ja-JP
  // ko-KR
  // ar-SA
  // he-IL
  // ru-RU
  // tr-TR
});
