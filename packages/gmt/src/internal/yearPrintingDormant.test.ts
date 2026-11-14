import { Temporal } from "./temporal";

/*
 * CORE-112 slice 7: each repair is dormant behind one engine probe. With the four probes stubbed
 * to pass (a fixed engine) no formatter is wrapped: the cache hands out the engine's own
 * `Intl.DateTimeFormat`, so no per-format work runs. With them stubbed to fail, exactly the
 * formatters that can show the defect are wrapped. (`vi.mock` makes this an isolated file; the
 * setup file has already loaded the library, so each test loads the cache again after the mock.)
 */

/** The formatter cache, loaded after the probe stub is in place. */
async function freshCache(): Promise<typeof import("./formatterCache")> {
  vi.resetModules();
  return import("./formatterCache");
}

const probes = vi.hoisted(() => ({ needed: true }));

vi.mock("./temporalCompat/capabilities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isJapaneseEraCompatNeeded: () => probes.needed,
  isIslamicEraCompatNeeded: () => probes.needed,
  isJapaneseTwoDigitYearCompatNeeded: () => probes.needed,
  isRelatedYearWidthCompatNeeded: () => probes.needed,
}));

const era = { era: "short", year: "numeric", timeZone: "UTC" } as const;
const twoDigit = { year: "2-digit", timeZone: "UTC" } as const;

describe("year printing is dormant on a fixed engine", () => {
  it.each`
    locale                        | options     | label
    ${"en-u-ca-japanese"}         | ${era}      | ${"D25 japanese"}
    ${"en-u-ca-islamic-civil"}    | ${era}      | ${"D26 islamic-civil"}
    ${"en-u-ca-islamic-umalqura"} | ${era}      | ${"D26 islamic-umalqura"}
    ${"ja-u-ca-japanese"}         | ${twoDigit} | ${"D27 ja japanese"}
    ${"en-u-ca-chinese"}          | ${twoDigit} | ${"D28 chinese"}
    ${"en-u-ca-dangi"}            | ${twoDigit} | ${"D28 dangi"}
  `(
    "returns the engine's own formatter for $label when its probe passes",
    async ({ locale, options }) => {
      probes.needed = false;
      const { cachedFormatter } = await freshCache();
      const formatter = cachedFormatter("DateTimeFormat", locale, options);
      expect(formatter).toBeInstanceOf(Intl.DateTimeFormat);
    },
  );

  it.each`
    locale                     | options     | label
    ${"en-u-ca-japanese"}      | ${era}      | ${"D25 japanese"}
    ${"en-u-ca-islamic-civil"} | ${era}      | ${"D26 islamic-civil"}
    ${"ja-u-ca-japanese"}      | ${twoDigit} | ${"D27 ja japanese"}
  `(
    "wraps the formatter for $label when its probe fails",
    async ({ locale, options }) => {
      probes.needed = true;
      const { cachedFormatter } = await freshCache();
      const formatter = cachedFormatter("DateTimeFormat", locale, options);
      expect(formatter).not.toBeInstanceOf(Intl.DateTimeFormat);
    },
  );

  it.each`
    locale                | options                               | label
    ${"en-u-ca-gregory"}  | ${era}                                | ${"gregory with era"}
    ${"en-u-ca-japanese"} | ${{ month: "long", timeZone: "UTC" }} | ${"japanese month only"}
    ${"ja-u-ca-gregory"}  | ${twoDigit}                           | ${"ja gregory 2-digit"}
  `(
    "wraps nothing for $label even when every probe fails",
    async ({ locale, options }) => {
      probes.needed = true;
      const { cachedFormatter } = await freshCache();
      const formatter = cachedFormatter("DateTimeFormat", locale, options);
      expect(formatter).toBeInstanceOf(Intl.DateTimeFormat);
    },
  );
});

describe("every public format function is the engine's own on a fixed engine", () => {
  // Midnight UTC, as the library formats a plain date; the oracle is the engine's formatter built
  // with the same locale and options, so a fixed engine gives the same text from the library.
  const midnight = (iso: string): number =>
    Temporal.PlainDate.from(iso).toZonedDateTime("UTC").epochMilliseconds;

  it.each`
    locale                        | options                                  | start              | end
    ${"en-u-ca-japanese"}         | ${{ era: "short", year: "numeric" }}     | ${"-000001-07-10"} | ${"1872-12-31"}
    ${"ja-u-ca-japanese"}         | ${{ era: "short", year: "numeric" }}     | ${"1868-10-23"}    | ${"1873-01-01"}
    ${"en-u-ca-islamic-civil"}    | ${{ era: "short", year: "numeric" }}     | ${"0600-07-10"}    | ${"2025-07-10"}
    ${"en-u-ca-islamic-umalqura"} | ${{ era: "short", year: "numeric" }}     | ${"-000001-07-10"} | ${"0622-07-19"}
    ${"ja-u-ca-japanese"}         | ${{ year: "2-digit" }}                   | ${"2019-04-30"}    | ${"2020-05-01"}
    ${"en-u-ca-chinese"}          | ${{ year: "2-digit", month: "2-digit" }} | ${"0005-07-10"}    | ${"0006-07-10"}
    ${"en-u-ca-dangi"}            | ${{ year: "2-digit" }}                   | ${"-000001-07-10"} | ${"0005-07-10"}
  `(
    "formatDate, its parts and the three ranges equal the engine for '$locale' $options at $start to $end",
    async ({ locale, options, start, end }) => {
      probes.needed = false;
      vi.resetModules();
      const [
        { formatDate },
        { formatDateToParts },
        { formatDateRange },
        { formatDateTimeRange },
        { formatZonedRange },
        { formatZonedDateTime },
        { normalizeDateTime },
      ] = await Promise.all([
        import("../plain/format/formatDate"),
        import("../plain/format/formatDateToParts"),
        import("../plain/format/formatDateRange"),
        import("../plain/format/formatDateTimeRange"),
        import("../zoned/format/formatZonedRange"),
        import("../zoned/format/formatZonedDateTime"),
        import("./normalizeDateTime"),
      ]);
      const engine = new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: "UTC",
      });
      const a = midnight(start);
      const b = midnight(end);
      const zoned = (iso: string): string => `${iso}T00:00:00+00:00[UTC]`;
      expect(formatDate(start, locale, options)).toBe(
        normalizeDateTime(engine.format(a)),
      );
      expect(formatDateToParts(start, locale, options)).toEqual(
        engine.formatToParts(a),
      );
      expect(formatZonedDateTime(zoned(start), locale, options)).toBe(
        normalizeDateTime(engine.format(a)),
      );
      const range = normalizeDateTime(engine.formatRange(a, b));
      expect(formatDateRange(start, end, locale, options)).toBe(range);
      expect(
        formatDateTimeRange(
          `${start}T00:00:00`,
          `${end}T00:00:00`,
          locale,
          options,
        ),
      ).toBe(range);
      expect(formatZonedRange(zoned(start), zoned(end), locale, options)).toBe(
        range,
      );
    },
  );
});

describe("widenRelatedYear", () => {
  it.each`
    needed   | calendar      | options                                  | widened  | label
    ${true}  | ${"chinese"}  | ${{ year: "2-digit" }}                   | ${true}  | ${"chinese, year 2-digit, probe fails"}
    ${true}  | ${"dangi"}    | ${{ year: "2-digit", month: "2-digit" }} | ${true}  | ${"dangi, year and month 2-digit, probe fails"}
    ${false} | ${"chinese"}  | ${{ year: "2-digit" }}                   | ${false} | ${"chinese, probe passes"}
    ${true}  | ${"chinese"}  | ${{ year: "numeric" }}                   | ${false} | ${"chinese, year numeric"}
    ${true}  | ${"chinese"}  | ${{ month: "2-digit" }}                  | ${false} | ${"chinese, no year"}
    ${true}  | ${"gregory"}  | ${{ year: "2-digit" }}                   | ${false} | ${"gregory, year 2-digit"}
    ${true}  | ${"japanese"} | ${{ year: "2-digit" }}                   | ${false} | ${"japanese, year 2-digit"}
  `("$widened for $label", async ({ needed, calendar, options, widened }) => {
    probes.needed = needed;
    vi.resetModules();
    const { widenRelatedYear } = await import("./yearPrinting");
    const out = widenRelatedYear(options, calendar);
    if (widened) {
      expect(out).toEqual({ ...options, year: "numeric" });
      expect(options.year).toBe("2-digit");
    } else {
      expect(out).toBe(options);
    }
  });
});

describe("the year repair wrapper", () => {
  it("has no formatRangeToParts: a parts call on a wrapped formatter throws a TypeError", async () => {
    probes.needed = true;
    const { cachedFormatter } = await freshCache();
    const formatter = cachedFormatter(
      "DateTimeFormat",
      "en-u-ca-japanese",
      era,
    );
    expect(() => formatter.formatRangeToParts(0, 1)).toThrow(TypeError);
  });

  it("reports the options it resolved, not a stand-in's", async () => {
    probes.needed = true;
    const { cachedFormatter } = await freshCache();
    const formatter = cachedFormatter(
      "DateTimeFormat",
      "en-u-ca-japanese",
      era,
    );
    const resolved = formatter.resolvedOptions();
    expect(resolved.calendar).toBe("japanese");
    expect(resolved.timeZone).toBe("UTC");
  });
});
