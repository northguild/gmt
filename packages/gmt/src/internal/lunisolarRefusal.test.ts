import { refuseLunisolarDate } from "./lunisolarRefusal";

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
    "throws a RangeError for $locale with $options",
    ({ locale, options }: { locale: string; options: object }) => {
      expect(() =>
        refuseLunisolarDate(new Intl.DateTimeFormat(locale, options)),
      ).toThrow(RangeError);
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
