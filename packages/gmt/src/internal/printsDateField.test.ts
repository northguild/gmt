import { printsDateField } from "./printsDateField";

function prints(locale: string, options: Intl.DateTimeFormatOptions): boolean {
  const formatter = new Intl.DateTimeFormat(locale, options);
  return printsDateField(formatter, formatter.resolvedOptions());
}

describe("printsDateField", () => {
  // ECMA-402 ToDateTimeOptions: with no field asked for, year, month and day are added.
  it.each`
    locale               | options                      | why
    ${"en"}              | ${{}}                        | ${"defaults add year, month and day"}
    ${"en"}              | ${{ dateStyle: "short" }}    | ${"dateStyle"}
    ${"en"}              | ${{ year: "numeric" }}       | ${"year"}
    ${"en"}              | ${{ month: "long" }}         | ${"month"}
    ${"en"}              | ${{ day: "numeric" }}        | ${"day"}
    ${"en"}              | ${{ era: "short" }}          | ${"era"}
    ${"en"}              | ${{ timeZoneName: "short" }} | ${"a zone name alone still adds the date defaults"}
    ${"en-u-ca-chinese"} | ${{}}                        | ${"chinese defaults"}
    ${"zh-u-ca-chinese"} | ${{ year: "numeric" }}       | ${"chinese year prints relatedYear and yearName"}
    ${"ko-u-ca-dangi"}   | ${{ month: "numeric" }}      | ${"dangi month"}
  `("is true for $locale with $options ($why)", ({ locale, options }) => {
    expect(prints(locale, options)).toBe(true);
  });

  // The week and the time of day do not depend on the calendar (ECMA-402 ToLocalTime).
  it.each`
    locale               | options
    ${"en"}              | ${{ hour: "numeric" }}
    ${"en"}              | ${{ hour: "numeric", minute: "numeric" }}
    ${"en"}              | ${{ weekday: "long" }}
    ${"en"}              | ${{ timeStyle: "short" }}
    ${"en"}              | ${{ fractionalSecondDigits: 3 }}
    ${"zh-u-ca-chinese"} | ${{ hour: "numeric" }}
    ${"zh-u-ca-chinese"} | ${{ weekday: "long" }}
    ${"ko-u-ca-dangi"}   | ${{ timeStyle: "short" }}
  `("is false for $locale with $options", ({ locale, options }) => {
    expect(prints(locale, options)).toBe(false);
  });

  it("reads the parts when the resolved options name no date field", () => {
    const formatter = new Intl.DateTimeFormat("en", { hour: "numeric" });
    const resolved = formatter.resolvedOptions();
    // TypeScript's lib types (as of TS 5.9) omit ECMA-402's `relatedYear` part type.
    const relatedYear = {
      type: "relatedYear",
      value: "2027",
    } as unknown as Intl.DateTimeFormatPart;
    vi.spyOn(formatter, "formatToParts").mockReturnValue([relatedYear]);
    expect(printsDateField(formatter, resolved)).toBe(true);
  });

  it("is false when the formatter cannot format", () => {
    const formatter = new Intl.DateTimeFormat("en", { hour: "numeric" });
    const resolved = formatter.resolvedOptions();
    vi.spyOn(formatter, "formatToParts").mockImplementation(() => {
      throw new RangeError("cannot format");
    });
    expect(printsDateField(formatter, resolved)).toBe(false);
  });
});
