import { refuseLunisolarDate } from "./lunisolarRefusal";
import { isLunisolarTextCompatNeeded } from "./temporalCompat/capabilities";

// The real probe runs; the spy only records which calendars the guard asked about. A row throws
// exactly where the real probe says this runtime needs the refusal, so it holds on every host.
const asked = vi.hoisted(() => [] as string[]);
vi.mock("./temporalCompat/capabilities", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./temporalCompat/capabilities")>();
  return {
    ...actual,
    isLunisolarTextCompatNeeded: (
      calendar: Parameters<typeof actual.isLunisolarTextCompatNeeded>[0],
    ) => {
      asked.push(calendar);
      return actual.isLunisolarTextCompatNeeded(calendar);
    },
  };
});

beforeEach(() => {
  asked.length = 0;
});

/** The calendar a formatter resolved to, which is `chinese` or `dangi` in every refusal row. */
const calendarOf = (formatter: Intl.DateTimeFormat): "chinese" | "dangi" =>
  formatter.resolvedOptions().calendar as "chinese" | "dangi";

/** Where the real probe fails the guard throws, and where it passes it returns the formatter. */
const expectGuarded = (formatter: Intl.DateTimeFormat): void => {
  if (isLunisolarTextCompatNeeded(calendarOf(formatter))) {
    expect(() => refuseLunisolarDate(formatter)).toThrow(RangeError);
  } else {
    expect(refuseLunisolarDate(formatter)).toBe(formatter);
  }
};

describe("refuseLunisolarDate", () => {
  it.each`
    locale               | options
    ${"en-u-ca-chinese"} | ${{}}
    ${"en-u-ca-dangi"}   | ${{}}
    ${"en"}              | ${{ calendar: "dangi", dateStyle: "short" }}
    ${"en"}              | ${{ calendar: "chinese", dateStyle: "full" }}
    ${"zh-u-ca-chinese"} | ${{ era: "short" }}
    ${"zh-u-ca-chinese"} | ${{ year: "numeric" }}
    ${"zh-u-ca-chinese"} | ${{ month: "numeric" }}
    ${"zh-u-ca-chinese"} | ${{ day: "numeric" }}
    ${"ko-u-ca-dangi"}   | ${{ year: "2-digit" }}
  `(
    "throws a RangeError where the probe fails, else returns the formatter, for $locale with $options",
    ({ locale, options }: { locale: string; options: object }) => {
      expectGuarded(new Intl.DateTimeFormat(locale, options));
    },
  );

  it.each`
    locale               | options
    ${"zh-u-ca-chinese"} | ${{ hour: "numeric" }}
    ${"zh-u-ca-chinese"} | ${{ weekday: "long" }}
    ${"zh-u-ca-chinese"} | ${{ timeStyle: "short" }}
    ${"en-u-ca-dangi"}   | ${{ hour: "numeric", minute: "numeric" }}
    ${"en-u-ca-gregory"} | ${{}}
    ${"en-u-ca-hebrew"}  | ${{}}
    ${"en-u-ca-coptic"}  | ${{ era: "short" }}
  `(
    "returns the same formatter for $locale with $options",
    ({ locale, options }: { locale: string; options: object }) => {
      const formatter = new Intl.DateTimeFormat(locale, options);
      expect(refuseLunisolarDate(formatter)).toBe(formatter);
    },
  );

  it("returns the formatter when resolvedOptions throws", () => {
    const formatter = new Intl.DateTimeFormat("en-u-ca-chinese");
    vi.spyOn(formatter, "resolvedOptions").mockImplementation(() => {
      throw new Error("no options");
    });
    expect(refuseLunisolarDate(formatter)).toBe(formatter);
  });
});

describe("refuseLunisolarDate, more shapes", () => {
  it.each`
    locale               | options                                                    | why
    ${"en-u-ca-chinese"} | ${{ timeZoneName: "short" }}                               | ${"a zone name alone adds the date defaults"}
    ${"en-u-ca-dangi"}   | ${{ dateStyle: "short", timeStyle: "short" }}              | ${"dateStyle with timeStyle"}
    ${"en"}              | ${{ calendar: "chinese", month: "long", hour: "numeric" }} | ${"a month beside a time field"}
    ${"ja-u-ca-dangi"}   | ${{ era: "long" }}                                         | ${"era"}
  `(
    "throws a RangeError where the probe fails, else returns the formatter, for $locale with $options ($why)",
    ({ locale, options }: { locale: string; options: object }) => {
      expectGuarded(new Intl.DateTimeFormat(locale, options));
    },
  );

  it.each`
    locale                | options
    ${"en-u-ca-dangi"}    | ${{ weekday: "long" }}
    ${"ko-u-ca-dangi"}    | ${{ timeStyle: "short" }}
    ${"en"}               | ${{ calendar: "chinese", hour: "numeric", minute: "numeric", timeZone: "UTC" }}
    ${"en-u-ca-chinese"}  | ${{ fractionalSecondDigits: 3 }}
    ${"en-u-ca-islamic"}  | ${{}}
    ${"en-u-ca-buddhist"} | ${{ era: "short" }}
  `(
    "returns the same formatter for $locale with $options",
    ({ locale, options }) => {
      const formatter = new Intl.DateTimeFormat(locale, options);
      expect(refuseLunisolarDate(formatter)).toBe(formatter);
    },
  );
});

describe("refuseLunisolarDate probe cost", () => {
  it.each`
    locale               | options                | why
    ${"en-u-ca-gregory"} | ${{}}                  | ${"not a lunisolar calendar"}
    ${"zh-u-ca-chinese"} | ${{ hour: "numeric" }} | ${"a time-only format"}
    ${"en-u-ca-dangi"}   | ${{ weekday: "long" }} | ${"a weekday-only format"}
  `(
    "does not run the probe for $locale with $options ($why)",
    ({ locale, options }: { locale: string; options: object }) => {
      refuseLunisolarDate(new Intl.DateTimeFormat(locale, options));
      expect(asked).toEqual([]);
    },
  );

  it.each`
    locale               | calendar
    ${"en-u-ca-chinese"} | ${"chinese"}
    ${"ko-u-ca-dangi"}   | ${"dangi"}
  `(
    "asks the probe about $calendar for a $calendar date format",
    ({ locale, calendar }: { locale: string; calendar: string }) => {
      const formatter = new Intl.DateTimeFormat(locale);
      // The test's own question to the probe is not the guard's.
      const needed = isLunisolarTextCompatNeeded(calendar as "chinese");
      asked.length = 0;
      if (needed) {
        expect(() => refuseLunisolarDate(formatter)).toThrow(RangeError);
      } else {
        expect(refuseLunisolarDate(formatter)).toBe(formatter);
      }
      expect(asked).toEqual([calendar]);
    },
  );
});
