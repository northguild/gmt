import { normalizeDateTime } from "../../internal";
import { expectDateTimeEqual, MustTestLocales } from "../../test";
import { hostDateText, numericPartValues } from "../../test/hostIntl";
import { formatDateToParts } from "./formatDateToParts";

describe("formatDateToParts", () => {
  describe("17-locale matrix — default options", () => {
    // The parts join to the host's text (its own wording; the bidi marks the
    // parts keep are compared as the text normalises them) and carry the value:
    // 2024-02-03.
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
      ${MustTestLocales.arSA}
      ${MustTestLocales.heIL}
      ${MustTestLocales.ruRU}
      ${MustTestLocales.trTR}
    `(
      "returns parts for $locale that join to the host's text and carry 2024-02-03",
      ({ locale }) => {
        const parts = formatDateToParts("2024-02-03", locale);
        expect(
          normalizeDateTime(parts.map((part) => part.value).join("")),
        ).toBe(hostDateText(locale, {}, "2024-02-03"));
        expect(parts.some((part) => part.type === "unknown")).toBe(false);
        expect(numericPartValues(parts, locale)).toEqual({
          year: 2024,
          month: 2,
          day: 3,
        });
      },
    );
  });

  describe("part order differs between locales — the property formatToParts exists for", () => {
    it("en-US puts month before day; fr-FR puts day before month", () => {
      const enParts = formatDateToParts("2024-03-15", MustTestLocales.enUS);
      const frParts = formatDateToParts("2024-03-15", MustTestLocales.frFR);

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
      ${MustTestLocales.arSA} | ${"ar-SA"}
      ${MustTestLocales.heIL} | ${"he-IL"}
    `(
      "returns string-valued parts for RTL locale $description",
      ({ locale }) => {
        const parts = formatDateToParts("2024-03-15", locale);
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
    it("era option adds an era part", () => {
      const parts = formatDateToParts("2024-03-15", MustTestLocales.enUS, {
        era: "short",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      expect(parts.map((p) => p.type)).toContain("era");
    });

    it("weekday option adds a weekday part", () => {
      const parts = formatDateToParts("2024-03-15", MustTestLocales.enUS, {
        weekday: "long",
      });
      expect(parts.map((p) => p.type)).toContain("weekday");
    });

    it.each`
      style
      ${"full"}
      ${"long"}
      ${"medium"}
      ${"short"}
    `("dateStyle $style produces year/month/day parts", ({ style }) => {
      const parts = formatDateToParts("2024-03-15", MustTestLocales.enUS, {
        dateStyle: style,
      });
      const types = parts.map((p) => p.type);
      expect(types).toContain("year");
      expect(types).toContain("month");
      expect(types).toContain("day");
    });

    it("no options and empty options object produce the same parts", () => {
      const noOpts = formatDateToParts("2024-03-15", MustTestLocales.enUS);
      const emptyOpts = formatDateToParts(
        "2024-03-15",
        MustTestLocales.enUS,
        {},
      );
      expect(emptyOpts).toEqual(noOpts);
    });
  });

  describe("a PlainDate yields only date fields (Temporal ECMA-402 amendments)", () => {
    // [[TemporalPlainDateFormat]] is null when dateStyle is undefined and
    // timeStyle is set, and GetDateTimeFormat(~date~, ~date~, ~relevant~)
    // returns null when only non-date fields are given: both throw a
    // TypeError, so there is nothing to format. timeZoneName is never
    // inherited (~relevant~). With dateStyle, AdjustDateTimeStyleFormat keeps
    // only « weekday, era, year, month, day ».
    const THURSDAY_FEB_29 = [
      { type: "weekday", value: "Thursday" },
      { type: "literal", value: ", " },
      { type: "month", value: "February" },
      { type: "literal", value: " " },
      { type: "day", value: "29" },
      { type: "literal", value: ", " },
      { type: "year", value: "2024" },
    ];
    const NUMERIC_FEB_29 = [
      { type: "month", value: "2" },
      { type: "literal", value: "/" },
      { type: "day", value: "29" },
      { type: "literal", value: "/" },
      { type: "year", value: "2024" },
    ];

    it.each`
      description                                         | options                                                                        | expected
      ${"timeStyle long alone (no PlainDate format)"}     | ${{ timeStyle: "long" }}                                                       | ${[]}
      ${"timeStyle short alone (no PlainDate format)"}    | ${{ timeStyle: "short" }}                                                      | ${[]}
      ${"hour alone (only a non-date field)"}             | ${{ hour: "numeric" }}                                                         | ${[]}
      ${"minute and second alone"}                        | ${{ minute: "2-digit", second: "2-digit" }}                                    | ${[]}
      ${"dateStyle full + timeStyle full drops the time"} | ${{ dateStyle: "full", timeStyle: "full" }}                                    | ${THURSDAY_FEB_29}
      ${"date fields + hour drops the hour"}              | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric" }}      | ${NUMERIC_FEB_29}
      ${"timeZoneName alone is not inherited (defaults)"} | ${{ timeZoneName: "short" }}                                                   | ${NUMERIC_FEB_29}
      ${"date fields + timeZoneName long"}                | ${{ year: "numeric", month: "numeric", day: "numeric", timeZoneName: "long" }} | ${NUMERIC_FEB_29}
    `("en-US $description", ({ options, expected }) => {
      expect(
        formatDateToParts("2024-02-29", MustTestLocales.enUS, options),
      ).toEqual(expected);
    });

    it("dateStyle with an explicit timeZoneName is a TypeError in CreateDateTimeFormat, so []", () => {
      expect(
        formatDateToParts("2024-02-29", MustTestLocales.enUS, {
          dateStyle: "full",
          timeZoneName: "short",
        }),
      ).toEqual([]);
    });
  });

  describe("invalid input", () => {
    it.each`
      value           | label
      ${"not-a-date"} | ${"'not-a-date'"}
      ${"2024-13-01"} | ${"'2024-13-01'"}
      ${"2024-02-30"} | ${"'2024-02-30'"}
      ${""}           | ${"''"}
      ${null}         | ${"null"}
      ${undefined}    | ${"undefined"}
      ${false}        | ${"false"}
      ${[]}           | ${"[]"}
    `("returns [] for invalid input: $label", ({ value }) => {
      expect(formatDateToParts(value as never)).toEqual([]);
    });
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. The text is the host's for the
  // same list.
  it("returns the host's fr-FR text (parts joined) for locale list fr-FR, en-US", () => {
    const locale = [MustTestLocales.frFR, MustTestLocales.enUS];
    const parts = formatDateToParts("2024-02-03", locale);
    expect(normalizeDateTime(parts.map((part) => part.value).join(""))).toBe(
      hostDateText(locale, {}, "2024-02-03"),
    );
  });

  it("returns [] for locale list fr-FR, 'not a locale!!'", () => {
    expect(
      formatDateToParts("2024-02-03", [MustTestLocales.frFR, "not a locale!!"]),
    ).toEqual([]);
  });
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options and wraps any other
// primitive with ToObject, which carries no formatting fields, so a string or number formats with
// the defaults. Expected strings from native Chromium 153 (`toLocaleString("en-US", 1)` and
// `new Intl.DateTimeFormat("en-US", null)`, which throws).
describe("formatDateToParts with primitive options", () => {
  it.each`
    options   | expected
    ${null}   | ${""}
    ${"long"} | ${"2/3/2024"}
    ${1}      | ${"2/3/2024"}
  `("returns '$expected' for options $options", ({ options, expected }) => {
    expectDateTimeEqual(
      formatDateToParts("2024-02-03", MustTestLocales.enUS, options as never)
        .map((part) => part.value)
        .join(""),
      expected,
    );
  });
});

// ECMA-402 GetOption step 1 is Get(options, property), which follows the prototype chain, so an
// inherited option is read exactly as the same option held as an own property. Here the date is 15
// March 2024, a Friday, so dateStyle "full" in en-US names the weekday.
describe("formatDateToParts with inherited options", () => {
  it.each`
    label          | options
    ${"own"}       | ${{ dateStyle: "full" }}
    ${"inherited"} | ${Object.create({ dateStyle: "full" })}
  `(
    "formats with $label options { dateStyle: 'full' }, an inherited option being read like an own one",
    ({ options }) => {
      expect(formatDateToParts("2024-03-15", "en-US", options)).toEqual([
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
describe("formatDateToParts with an option that is an object", () => {
  it("returns the sentinel for month given as an object, and never calls its toString()", () => {
    let coercions = 0;
    const month = {
      toString() {
        coercions += 1;
        return coercions === 1 ? "long" : "narrow";
      },
    };
    const out = formatDateToParts("2024-03-15", "en-US", {
      month,
      day: "numeric",
    } as never);
    expect({ out, coercions }).toEqual({ out: [], coercions: 0 });
  });
});
