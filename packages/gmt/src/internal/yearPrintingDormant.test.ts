import { Temporal } from "./temporal";

/*
 * CORE-112: each repair is dormant behind one engine probe. With the probes stubbed
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
  isCopticEraCompatNeeded: () => probes.needed,
  isCopticEpochEraCompatNeeded: () => probes.needed,
  isIslamicEpochEraCompatNeeded: () => probes.needed,
  isJapaneseTwoDigitYearCompatNeeded: () => probes.needed,
  isJapaneseNumberingSystemCompatNeeded: () => probes.needed,
  isIslamicCalendarResolutionCompatNeeded: () => probes.needed,
  isRelatedYearWidthCompatNeeded: () => probes.needed,
  isRangeFieldCompatNeeded: () => probes.needed,
}));

const era = { era: "short", year: "numeric", timeZone: "UTC" } as const;
const twoDigit = { year: "2-digit", timeZone: "UTC" } as const;

describe("year printing is dormant on a fixed engine", () => {
  it.each`
    locale                        | options     | label
    ${"en-u-ca-japanese"}         | ${era}      | ${"D25 japanese"}
    ${"ja-u-ca-japanese"}         | ${twoDigit} | ${"D27 ja japanese"}
    ${"en-u-ca-coptic"}           | ${era}      | ${"D31 coptic"}
    ${"ja-u-ca-japanese-nu-arab"} | ${era}      | ${"D27 ja japanese nu-arab"}
  `(
    "returns the engine's own formatter for $label when its probe passes",
    async ({ locale, options }) => {
      probes.needed = false;
      const { cachedFormatter } = await freshCache();
      const formatter = cachedFormatter("DateTimeFormat", locale, options);
      expect(formatter).toBeInstanceOf(Intl.DateTimeFormat);
    },
  );

  // The public functions refuse chinese and dangi (compat D33), so the repair's own formatter is read.
  it.each`
    locale               | options     | label
    ${"en-u-ca-chinese"} | ${twoDigit} | ${"D28 chinese"}
    ${"en-u-ca-dangi"}   | ${twoDigit} | ${"D28 dangi"}
  `(
    "returns the engine's own formatter for $label when its probe passes",
    async ({ locale, options }) => {
      probes.needed = false;
      const { guardedDateTimeFormat } = await freshCache();
      expect(guardedDateTimeFormat(locale, options)).toBeInstanceOf(
        Intl.DateTimeFormat,
      );
    },
  );

  it.each`
    locale                        | options     | label
    ${"en-u-ca-japanese"}         | ${era}      | ${"D25 japanese"}
    ${"ja-u-ca-japanese"}         | ${twoDigit} | ${"D27 ja japanese"}
    ${"ja-u-ca-japanese-nu-arab"} | ${era}      | ${"D27 ja japanese nu-arab"}
    ${"en-u-ca-coptic"}           | ${era}      | ${"D31 coptic"}
    ${"en-u-ca-islamic-tbla"}     | ${era}      | ${"D32 islamic-tbla"}
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
    locale                    | options                               | label
    ${"en-u-ca-gregory"}      | ${era}                                | ${"gregory with era"}
    ${"en-u-ca-japanese"}     | ${{ month: "long", timeZone: "UTC" }} | ${"japanese month only"}
    ${"ja-u-ca-gregory"}      | ${twoDigit}                           | ${"ja gregory 2-digit"}
    ${"en-u-ca-coptic"}       | ${{ month: "long", timeZone: "UTC" }} | ${"coptic month only"}
    ${"en-u-ca-islamic-tbla"} | ${{ month: "long", timeZone: "UTC" }} | ${"islamic-tbla month only"}
    ${"en-u-ca-ethiopic"}     | ${era}                                | ${"ethiopic with era"}
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

describe("D26 holds with its probe passing", () => {
  it.each`
    date            | expectedEmpty
    ${"0600-07-10"} | ${true}
    ${"2025-07-10"} | ${false}
  `(
    "formatDate of '$date' in islamic-civil is empty only before the Hijra: $expectedEmpty",
    async ({ date, expectedEmpty }) => {
      probes.needed = false;
      vi.resetModules();
      const { formatDate } = await import("../plain/format/formatDate");
      const locale = "en-u-ca-islamic-civil";
      const options = { era: "short", year: "numeric" } as const;
      const engine = new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: "UTC",
      }).format(
        Temporal.PlainDate.from(date).toZonedDateTime("UTC").epochMilliseconds,
      );
      expect(formatDate(date, locale, options)).toBe(
        expectedEmpty ? "" : engine,
      );
    },
  );
});

describe("every public format function is the engine's own on a fixed engine", () => {
  // Midnight UTC, as the library formats a plain date; the oracle is the engine's formatter built
  // with the same locale and options, so a fixed engine gives the same text from the library.
  const midnight = (iso: string): number =>
    Temporal.PlainDate.from(iso).toZonedDateTime("UTC").epochMilliseconds;

  it.each`
    locale                    | options                              | start              | end
    ${"en-u-ca-japanese"}     | ${{ era: "short", year: "numeric" }} | ${"-000001-07-10"} | ${"1872-12-31"}
    ${"ja-u-ca-japanese"}     | ${{ era: "short", year: "numeric" }} | ${"1868-10-23"}    | ${"1873-01-01"}
    ${"ja-u-ca-japanese"}     | ${{ year: "2-digit" }}               | ${"2019-04-30"}    | ${"2020-05-01"}
    ${"en-u-ca-coptic"}       | ${{ era: "short", year: "numeric" }} | ${"-000001-07-10"} | ${"0001-07-10"}
    ${"en-u-ca-coptic"}       | ${{ era: "short", year: "numeric" }} | ${"0284-08-29"}    | ${"0284-09-10"}
    ${"en-u-ca-islamic-tbla"} | ${{ era: "short", year: "numeric" }} | ${"0622-07-18"}    | ${"0622-07-19"}
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
    30_000,
  );
});

describe("the guarded formatter is the engine's own on a fixed engine for chinese and dangi", () => {
  const midnight = (iso: string): number =>
    Temporal.PlainDate.from(iso).toZonedDateTime("UTC").epochMilliseconds;

  it.each`
    locale               | options                                  | start              | end
    ${"en-u-ca-chinese"} | ${{ year: "2-digit", month: "2-digit" }} | ${"0005-07-10"}    | ${"0006-07-10"}
    ${"en-u-ca-dangi"}   | ${{ year: "2-digit" }}                   | ${"-000001-07-10"} | ${"0005-07-10"}
  `(
    "formatDate, its parts and the three ranges equal the engine for '$locale' $options at $start to $end",
    async ({ locale, options, start, end }) => {
      probes.needed = false;
      const { guardedDateTimeFormat } = await freshCache();
      const engine = new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: "UTC",
      });
      const guarded = guardedDateTimeFormat(locale, {
        ...options,
        timeZone: "UTC",
      });
      const a = midnight(start);
      const b = midnight(end);
      expect(guarded.format(a)).toBe(engine.format(a));
      expect(guarded.formatToParts(a)).toEqual(engine.formatToParts(a));
      expect(guarded.formatRange(a, b)).toBe(engine.formatRange(a, b));
    },
  );
});

describe("D30 is dormant on a fixed engine", () => {
  it.each`
    locale                    | options                                     | needed   | label
    ${"en-u-ca-islamic"}      | ${{ timeZone: "UTC" }}                      | ${true}  | ${"islamic keyword, probe fails"}
    ${"en"}                   | ${{ timeZone: "UTC", calendar: "islamic" }} | ${true}  | ${"islamic option, probe fails"}
    ${"en-u-ca-islamic-rgsa"} | ${{ timeZone: "UTC" }}                      | ${true}  | ${"rgsa keyword, probe fails"}
    ${"en-u-ca-islamic"}      | ${{ timeZone: "UTC" }}                      | ${false} | ${"islamic keyword, probe passes"}
    ${"en-u-ca-islamic-rgsa"} | ${{ timeZone: "UTC" }}                      | ${false} | ${"rgsa keyword, probe passes"}
  `(
    "builds with the engine's own resolution when the probe passes, rebuilt otherwise: $label",
    async ({ locale, options, needed }) => {
      probes.needed = needed;
      const { cachedFormatter } = await freshCache();
      const own = new Intl.DateTimeFormat(locale, options).resolvedOptions();
      const built = cachedFormatter(
        "DateTimeFormat",
        locale,
        options,
      ).resolvedOptions();
      if (needed) {
        expect(built.calendar).not.toBe("islamic-rgsa");
        expect(built.calendar).not.toBe("islamic");
      } else {
        expect(built.calendar).toBe(own.calendar);
      }
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

describe("range field repair (D29) is dormant on a fixed engine", () => {
  const yo = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  } as const;

  it("never reads a verdict while the probe passes", async () => {
    probes.needed = false;
    vi.resetModules();
    const { rangeFieldsText } = await import("./rangeFields");
    expect(
      rangeFieldsText(
        new Intl.DateTimeFormat("yo", yo),
        yo,
        1_720_569_600_000,
        1_720_656_000_000,
      ),
    ).toBeNull();
  });

  it("reads the detector's verdict for a formatter whose range is broken once the probe fails", async () => {
    probes.needed = true;
    vi.resetModules();
    const { rangeFieldsText } = await import("./rangeFields");
    const { rangeFieldCases, rangeFieldProblem } =
      await import("./temporalCompat/rangeFieldRepros");
    const own = rangeFieldCases.find(({ name }) => name === "yoWeekdayTwice");
    const brokenHere =
      own !== undefined &&
      rangeFieldProblem(own.locale, own.options, own.from, own.to) !==
        "complete";
    expect(
      rangeFieldsText(
        new Intl.DateTimeFormat("yo", yo),
        yo,
        1_720_569_600_000,
        1_720_656_000_000,
      ) !== null,
    ).toBe(brokenHere);
  });
});
