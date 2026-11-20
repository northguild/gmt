import {
  isDisputedCalendarLocale,
  isDisputedCalendarTag,
  refuseDisputedDefaultCalendar,
} from "./defaultCalendarRefusal";

describe("isDisputedCalendarTag", () => {
  it.each`
    tag                  | disputed | why
    ${"ar-SA"}           | ${true}  | ${"a disputed region pair"}
    ${"AR-sa"}           | ${true}  | ${"case does not matter"}
    ${"ar-SA-posix"}     | ${true}  | ${"a variant does not change it"}
    ${"ar-SA-u-nu-latn"} | ${true}  | ${"an extension does not change it"}
    ${"ar-SA-x-private"} | ${true}  | ${"private use does not change it"}
    ${"ar-Arab-SA"}      | ${false} | ${"a script settles it"}
    ${"ar"}              | ${false} | ${"the language alone is agreed"}
    ${"ar-EG"}           | ${false} | ${"another region is agreed"}
    ${"en-TH"}           | ${true}  | ${"a disputed region pair"}
    ${"en-Latn-TH"}      | ${false} | ${"a script settles it"}
    ${"eng-SA"}          | ${true}  | ${"an alias Safari keeps as written"}
    ${"uz-004"}          | ${true}  | ${"a numeric region Safari keeps as written"}
    ${"uz-AF"}           | ${false} | ${"the canonical form is agreed"}
    ${"uz-Arab-004"}     | ${false} | ${"a script settles it"}
    ${"uzn-Arab"}        | ${true}  | ${"a disputed script pair"}
    ${"uzn-Arab-AF"}     | ${true}  | ${"a disputed script pair with any region"}
    ${"ps"}              | ${true}  | ${"a disputed language"}
    ${"ps-Arab-PK"}      | ${true}  | ${"a disputed language with a script"}
    ${"ps-PK"}           | ${false} | ${"an agreed region of a disputed language"}
    ${"pbu-586"}         | ${false} | ${"an agreed numeric region of a disputed language"}
    ${"lrc-IQ"}          | ${false} | ${"an agreed region of a disputed language"}
    ${"lrc-IR"}          | ${true}  | ${"another region of a disputed language"}
    ${"shn-764"}         | ${true}  | ${"a disputed numeric region pair"}
    ${"en"}              | ${false} | ${"an agreed language"}
  `(
    "$tag is disputed: $disputed ($why)",
    ({ tag, disputed }: { tag: string; disputed: boolean }) => {
      expect(isDisputedCalendarTag(tag)).toBe(disputed);
    },
  );
});

describe("isDisputedCalendarLocale", () => {
  it.each`
    label               | locales               | disputed
    ${"[en, ar-SA]"}    | ${["en", "ar-SA"]}    | ${true}
    ${"[fur, fa]"}      | ${["fur", "fa"]}      | ${true}
    ${"[th-TH, en-US]"} | ${["th-TH", "en-US"]} | ${true}
    ${"[en-GB, en]"}    | ${["en-GB", "en"]}    | ${false}
    ${"[th-TH, th]"}    | ${["th-TH", "th"]}    | ${false}
    ${"en-GB"}          | ${"en-GB"}            | ${false}
  `(
    "$label is disputed: $disputed",
    ({
      locales,
      disputed,
    }: {
      locales: string | string[];
      disputed: boolean;
    }) => {
      expect(isDisputedCalendarLocale(locales)).toBe(disputed);
    },
  );

  it("reads the host default locale for an omitted locale and an empty list", () => {
    const host = new Intl.DateTimeFormat().resolvedOptions().locale;
    expect([
      isDisputedCalendarLocale(undefined),
      isDisputedCalendarLocale([]),
    ]).toEqual([isDisputedCalendarTag(host), isDisputedCalendarTag(host)]);
  });
});

describe("refuseDisputedDefaultCalendar", () => {
  it("throws for a date in a disputed default calendar", () => {
    expect(() =>
      refuseDisputedDefaultCalendar(
        new Intl.DateTimeFormat("en-TH", { timeZone: "UTC" }),
        "en-TH",
        undefined,
      ),
    ).toThrow(RangeError);
  });

  it.each`
    label                              | locale     | options                     | named
    ${"a named calendar the host has"} | ${"en-TH"} | ${{ calendar: "buddhist" }} | ${"buddhist"}
    ${"a named alias of it"}           | ${"ar-SA"} | ${{ calendar: "islamicc" }} | ${"islamicc"}
    ${"a time-only formatter"}         | ${"en-TH"} | ${{ hour: "numeric" }}      | ${undefined}
    ${"a weekday-only formatter"}      | ${"en-TH"} | ${{ weekday: "long" }}      | ${undefined}
    ${"an agreed locale"}              | ${"en-GB"} | ${{}}                       | ${undefined}
  `(
    "returns the formatter for $label",
    ({
      locale,
      options,
      named,
    }: {
      locale: string;
      options: Intl.DateTimeFormatOptions;
      named: string | undefined;
    }) => {
      const formatter = new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: "UTC",
      });
      expect(refuseDisputedDefaultCalendar(formatter, locale, named)).toBe(
        formatter,
      );
    },
  );

  it("throws for a named calendar the host does not have", () => {
    expect(() =>
      refuseDisputedDefaultCalendar(
        new Intl.DateTimeFormat("ar-SA", { calendar: "zzzz", timeZone: "UTC" }),
        "ar-SA",
        "zzzz",
      ),
    ).toThrow(RangeError);
  });
});
