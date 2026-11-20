import { normalizeDateTime } from "../../internal";
import {
  expectDateTimeEqual,
  MustTestLocales,
  arSAGregorian,
} from "../../test";
import { hostDateTimeText, numericPartValues } from "../../test/hostIntl";
import { formatDateTimeToParts } from "./formatDateTimeToParts";

const OPTIONS = { dateStyle: "medium", timeStyle: "short" } as const;

describe("formatDateTimeToParts", () => {
  describe("17-locale matrix — dateStyle/timeStyle", () => {
    // The parts join to the host's text (its wording, compat README rule 7; the bidi marks the
    // parts keep are compared as the text normalises them) and carry the value:
    // 2024-02-03 14:30, with the hour as 2 when the host's hour cycle adds a day period.
    it.each`
      locale
      ${MustTestLocales.enUS}
      ${MustTestLocales.enGB}
      ${MustTestLocales.deDE}
      ${MustTestLocales.frFR}
      ${MustTestLocales.esES}
      ${MustTestLocales.itIT}
      ${MustTestLocales.ptPT}
      ${MustTestLocales.svSE}
      ${MustTestLocales.isIS}
      ${MustTestLocales.zhCN}
      ${MustTestLocales.zhTW}
      ${MustTestLocales.jaJP}
      ${MustTestLocales.koKR}
      ${arSAGregorian}
      ${MustTestLocales.heIL}
      ${MustTestLocales.ruRU}
      ${MustTestLocales.trTR}
    `(
      "returns parts for $locale that join to the host's text and carry 2024-02-03 14:30",
      ({ locale }) => {
        const parts = formatDateTimeToParts(
          "2024-02-03T14:30:00",
          locale,
          OPTIONS,
        );
        expect(
          normalizeDateTime(parts.map((part) => part.value).join("")),
        ).toBe(hostDateTimeText(locale, OPTIONS, "2024-02-03T14:30:00"));
        expect(parts.some((part) => part.type === "unknown")).toBe(false);
        const twelveHour = parts.some((part) => part.type === "dayPeriod");
        const values = numericPartValues(parts, locale);
        expect(values).toMatchObject({
          year: 2024,
          day: 3,
          hour: twelveHour ? 2 : 14,
          minute: 30,
        });
        expect([undefined, 2]).toContain(values["month"]);
        expect(parts.some((part) => part.type === "month")).toBe(true);
      },
    );
  });

  describe("no options — ECMA-402 GetDateTimeFormat(~any~, ~all~) defaults", () => {
    // With no required field and no dateStyle/timeStyle, ECMA-402 (as amended
    // by Temporal) formats a PlainDateTime with year, month, day, hour, minute
    // and second all "numeric" — the output PlainDateTime#toLocaleString gives.
    // Expected values: runtime Intl.DateTimeFormat given those six fields
    // explicitly (timeZone "UTC"), cross-checked against the polyfill's
    // Intl.DateTimeFormat#formatToParts(plainDateTime).
    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${[{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]}
      ${MustTestLocales.deDE} | ${[{ type: "day", value: "15" }, { type: "literal", value: "." }, { type: "month", value: "3" }, { type: "literal", value: "." }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "14" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }]}
    `(
      "no options for $locale formats date and time to the second",
      ({ locale, expected }) => {
        const actual = formatDateTimeToParts("2024-03-15T14:30:00", locale);
        expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
      },
    );

    it("era-only options still get the date and time defaults (era is not a required field)", () => {
      const actual = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { era: "short" },
      );
      const expected = [
        { type: "month", value: "3" },
        { type: "literal", value: "/" },
        { type: "day", value: "15" },
        { type: "literal", value: "/" },
        { type: "year", value: "2024" },
        { type: "literal", value: " " },
        { type: "era", value: "AD" },
        { type: "literal", value: ", " },
        { type: "hour", value: "2" },
        { type: "literal", value: ":" },
        { type: "minute", value: "30" },
        { type: "literal", value: ":" },
        { type: "second", value: "00" },
        { type: "literal", value: " " },
        { type: "dayPeriod", value: "PM" },
      ];
      expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
    });

    it("an explicit field set is not given defaults", () => {
      const actual = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { hour: "numeric", minute: "numeric" },
      );
      const expected = [
        { type: "hour", value: "2" },
        { type: "literal", value: ":" },
        { type: "minute", value: "30" },
        { type: "literal", value: " " },
        { type: "dayPeriod", value: "PM" },
      ];
      expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
    });
  });

  describe("a zoneless value never prints a zone name", () => {
    // timeZoneName is not a field a PlainDateTime format inherits
    // (GetDateTimeFormat inherit ~relevant~), so the internal UTC anchor
    // must never surface as "UTC".
    it.each`
      description                                    | options                                      | expected
      ${"timeZoneName short alone (defaults apply)"} | ${{ timeZoneName: "short" }}                 | ${[{ type: "month", value: "3" }, { type: "literal", value: "/" }, { type: "day", value: "15" }, { type: "literal", value: "/" }, { type: "year", value: "2024" }, { type: "literal", value: ", " }, { type: "hour", value: "2" }, { type: "literal", value: ":" }, { type: "minute", value: "30" }, { type: "literal", value: ":" }, { type: "second", value: "00" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]}
      ${"hour with timeZoneName long"}               | ${{ hour: "numeric", timeZoneName: "long" }} | ${[{ type: "hour", value: "2" }, { type: "literal", value: " " }, { type: "dayPeriod", value: "PM" }]}
    `("$description produces no timeZoneName part", ({ options, expected }) => {
      const actual = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        options,
      );
      expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
    });
  });

  describe("a timeStyle never brings a zone name (AdjustDateTimeStyleFormat)", () => {
    // [[TemporalPlainDateTimeFormat]] = AdjustDateTimeStyleFormat(…,
    // « weekday, era, year, month, day, dayPeriod, hour, minute, second,
    // fractionalSecondDigits »): the long/full time formats' timeZoneName is
    // removed and the remaining hour, minute and second are kept. The expected
    // parts are the runtime Intl.DateTimeFormat medium time format at the UTC
    // anchor — the same fields, no zone.
    const EN_US_NOON = [
      { type: "hour", value: "12" },
      { type: "literal", value: ":" },
      { type: "minute", value: "00" },
      { type: "literal", value: ":" },
      { type: "second", value: "00" },
      { type: "literal", value: "\u202f" },
      { type: "dayPeriod", value: "PM" },
    ];
    const EN_US_FULL_DATE = [
      { type: "weekday", value: "Thursday" },
      { type: "literal", value: ", " },
      { type: "month", value: "February" },
      { type: "literal", value: " " },
      { type: "day", value: "29" },
      { type: "literal", value: ", " },
      { type: "year", value: "2024" },
      { type: "literal", value: " at " },
    ];
    const DE_DE_MEDIUM = [
      { type: "day", value: "29" },
      { type: "literal", value: "." },
      { type: "month", value: "02" },
      { type: "literal", value: "." },
      { type: "year", value: "2024" },
      { type: "literal", value: ", " },
      { type: "hour", value: "12" },
      { type: "literal", value: ":" },
      { type: "minute", value: "00" },
      { type: "literal", value: ":" },
      { type: "second", value: "00" },
    ];

    it.each`
      locale                  | options                                       | expected
      ${MustTestLocales.enUS} | ${{ timeStyle: "long" }}                      | ${EN_US_NOON}
      ${MustTestLocales.enUS} | ${{ timeStyle: "full" }}                      | ${EN_US_NOON}
      ${MustTestLocales.enUS} | ${{ dateStyle: "full", timeStyle: "full" }}   | ${[...EN_US_FULL_DATE, ...EN_US_NOON]}
      ${MustTestLocales.deDE} | ${{ dateStyle: "medium", timeStyle: "long" }} | ${DE_DE_MEDIUM}
    `(
      "$locale with $options has no timeZoneName part",
      ({ locale, options, expected }) => {
        const actual = formatDateTimeToParts(
          "2024-02-29T12:00",
          locale,
          options,
        );
        expectDateTimeEqual(JSON.stringify(actual), JSON.stringify(expected));
      },
    );

    it("dateStyle with an explicit timeZoneName is a TypeError in CreateDateTimeFormat, so []", () => {
      expect(
        formatDateTimeToParts("2024-02-29T12:00", MustTestLocales.enUS, {
          dateStyle: "full",
          timeZoneName: "short",
        }),
      ).toEqual([]);
    });
  });

  describe("part order differs between locales", () => {
    it("en-US puts month before day; fr-FR puts day before month", () => {
      const enParts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
      );
      const frParts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.frFR,
      );

      const enMonthIdx = enParts.findIndex((p) => p.type === "month");
      const enDayIdx = enParts.findIndex((p) => p.type === "day");
      const frDayIdx = frParts.findIndex((p) => p.type === "day");
      const frMonthIdx = frParts.findIndex((p) => p.type === "month");

      expect(enMonthIdx).toBeLessThan(enDayIdx);
      expect(frDayIdx).toBeLessThan(frMonthIdx);
    });
  });

  describe("RTL locales", () => {
    it.each`
      locale                  | description
      ${arSAGregorian}        | ${"ar-SA-u-ca-gregory"}
      ${MustTestLocales.heIL} | ${"he-IL"}
    `(
      "returns string-valued parts for RTL locale $description",
      ({ locale }) => {
        const parts = formatDateTimeToParts(
          "2024-03-15T14:30:00",
          locale,
          OPTIONS,
        );
        expect(parts.length).toBeGreaterThan(0);
        expect(
          parts.every(
            (p) => typeof p.type === "string" && typeof p.value === "string",
          ),
        ).toBe(true);
      },
    );
  });

  describe("options producing every part type", () => {
    it("second/fractionalSecond options add those parts", () => {
      const parts = formatDateTimeToParts(
        "2024-03-15T14:30:00.123",
        MustTestLocales.enUS,
        {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          fractionalSecondDigits: 3,
        },
      );
      const types = parts.map((p) => p.type);
      expect(types).toContain("second");
      expect(types).toContain("fractionalSecond");
    });

    it("dayPeriod (hour12) adds a dayPeriod part", () => {
      const parts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { hour: "numeric", minute: "numeric", hour12: true },
      );
      expect(parts.map((p) => p.type)).toContain("dayPeriod");
    });

    it("weekday and era options add those parts", () => {
      const parts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        {
          weekday: "long",
          era: "short",
          year: "numeric",
          month: "numeric",
          day: "numeric",
        },
      );
      const types = parts.map((p) => p.type);
      expect(types).toContain("weekday");
      expect(types).toContain("era");
    });

    it("no options and empty options object produce the same parts", () => {
      const noOpts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
      );
      const emptyOpts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        {},
      );
      expect(emptyOpts).toEqual(noOpts);
    });

    it("an option present as undefined is read as absent (ECMA-402 GetOption), so defaults still fill it", () => {
      const noOpts = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
      );
      const undefinedYear = formatDateTimeToParts(
        "2024-03-15T14:30:00",
        MustTestLocales.enUS,
        { year: undefined },
      );
      expect(undefinedYear).toEqual(noOpts);
    });
  });

  describe("invalid input", () => {
    it.each`
      value                    | label
      ${"not-a-datetime"}      | ${"'not-a-datetime'"}
      ${"2024-13-01T00:00:00"} | ${"'2024-13-01T00:00:00'"}
      ${"2024-02-30T00:00:00"} | ${"'2024-02-30T00:00:00'"}
      ${""}                    | ${"''"}
      ${null}                  | ${"null"}
      ${undefined}             | ${"undefined"}
      ${false}                 | ${"false"}
      ${[]}                    | ${"[]"}
    `("returns [] for invalid input: $label", ({ value }) => {
      expect(formatDateTimeToParts(value as never)).toEqual([]);
    });
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. The text is the host's for the
  // same list.
  it("returns the host's fr-FR text (parts joined) for locale list fr-FR, en-US", () => {
    const locale = [MustTestLocales.frFR, MustTestLocales.enUS];
    const options = { dateStyle: "medium", timeStyle: "short" } as const;
    const parts = formatDateTimeToParts("2024-02-03T14:30:45", locale, options);
    expect(normalizeDateTime(parts.map((part) => part.value).join(""))).toBe(
      hostDateTimeText(locale, options, "2024-02-03T14:30:45"),
    );
  });

  it("returns [] for locale list fr-FR, 'not a locale!!'", () => {
    expect(
      formatDateTimeToParts(
        "2024-02-03T14:30:45",
        [MustTestLocales.frFR, "not a locale!!"],
        { dateStyle: "medium", timeStyle: "short" },
      ),
    ).toEqual([]);
  });
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options and wraps any other
// primitive with ToObject, which carries no formatting fields, so a string or number formats with
// the defaults. Expected strings from native Chromium 153 (`toLocaleString("en-US", 1)` and
// `new Intl.DateTimeFormat("en-US", null)`, which throws).
describe("formatDateTimeToParts with primitive options", () => {
  it.each`
    options   | expected
    ${null}   | ${""}
    ${"long"} | ${"2/3/2024, 2:30:00 PM"}
    ${1}      | ${"2/3/2024, 2:30:00 PM"}
  `("returns '$expected' for options $options", ({ options, expected }) => {
    expectDateTimeEqual(
      formatDateTimeToParts(
        "2024-02-03T14:30:00",
        MustTestLocales.enUS,
        options as never,
      )
        .map((part) => part.value)
        .join(""),
      expected,
    );
  });
});

// ECMA-402 GetOption step 1 is Get(options, property), which follows the prototype chain, so an
// inherited option is read exactly as the same option held as an own property. Here the date is 15
// March 2024, a Friday, so dateStyle "full" in en-US names the weekday.
describe("formatDateTimeToParts with inherited options", () => {
  it.each`
    label          | options
    ${"own"}       | ${{ dateStyle: "full" }}
    ${"inherited"} | ${Object.create({ dateStyle: "full" })}
  `(
    "formats with $label options { dateStyle: 'full' }, an inherited option being read like an own one",
    ({ options }) => {
      expect(
        formatDateTimeToParts("2024-03-15T20:00:00", "en-US", options),
      ).toEqual([
        { type: "weekday", value: "Friday" },
        { type: "literal", value: ", " },
        { type: "month", value: "March" },
        { type: "literal", value: " " },
        { type: "day", value: "15" },
        { type: "literal", value: ", " },
        { type: "year", value: "2024" },
      ]);
    },
  );
});

// ECMA-402 GetOption would turn an object option into its ToString. A function accepts a
// string for a string option and nothing else, so it returns its sentinel and the caller's
// toString() is never run.
describe("formatDateTimeToParts with an option that is an object", () => {
  it("returns the sentinel for month given as an object, and never calls its toString()", () => {
    let coercions = 0;
    const month = {
      toString() {
        coercions += 1;
        return coercions === 1 ? "long" : "narrow";
      },
    };
    const out = formatDateTimeToParts("2024-03-15T20:00:00", "en-US", {
      month,
      day: "numeric",
    } as never);
    expect({ out, coercions }).toEqual({ out: [], coercions: 0 });
  });
});
