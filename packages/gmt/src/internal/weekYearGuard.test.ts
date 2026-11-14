import { forgetWeekYearVerdicts, guardDateTimeFormat } from "./weekYearGuard";

/*
 * CORE-112 (D23, D24): which formatters the guard leaves alone and which it replaces. The decision
 * rests on the formatter's own text (a year that moves where the calendar year does not, at a
 * year boundary) and, on an unfixed V8, on a `resolvedOptions()` with no `year` for a pattern that
 * must have one (ECMA-402 CreateDateTimeFormat gives every date formatter without `dateStyle` a
 * year field when it asks for one).
 */
const utc = { timeZone: "UTC" } as const;

function build(locale: string, options: Intl.DateTimeFormatOptions) {
  const formatter = new Intl.DateTimeFormat(locale, { ...options, ...utc });
  return {
    formatter,
    guarded: guardDateTimeFormat(formatter, { ...options, ...utc }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  forgetWeekYearVerdicts();
});

describe("guardDateTimeFormat: formatters that pass are returned unchanged", () => {
  it.each`
    locale                | options
    ${"en"}               | ${{ year: "numeric", month: "long" }}
    ${"de"}               | ${{ year: "numeric", month: "long" }}
    ${"fr"}               | ${{ year: "numeric", month: "long" }}
    ${"ja-u-ca-japanese"} | ${{ year: "numeric", month: "long" }}
    ${"zh-u-ca-chinese"}  | ${{ year: "numeric", month: "long" }}
    ${"en"}               | ${{ dateStyle: "full" }}
    ${"de-CH"}            | ${{ era: "short" }}
    ${"gd"}               | ${{ hour: "numeric", minute: "numeric" }}
    ${"gd"}               | ${{ month: "short", day: "numeric" }}
  `(
    "returns the native formatter for '$locale' $options",
    ({ locale, options }) => {
      const { formatter, guarded } = build(locale, options);
      expect(guarded).toBe(formatter);
    },
  );
});

describe("guardDateTimeFormat: formatters that print the week-year are replaced", () => {
  it.each`
    locale                | options
    ${"gd"}               | ${{ year: "numeric", month: "short" }}
    ${"gl-u-ca-hebrew"}   | ${{ dateStyle: "full" }}
    ${"te-u-ca-buddhist"} | ${{ year: "numeric", month: "long" }}
  `("replaces the formatter for '$locale' $options", ({ locale, options }) => {
    const { formatter, guarded } = build(locale, options);
    expect(guarded).not.toBe(formatter);
  });

  it("gives the calendar year from format", () => {
    const { guarded } = build("gd", { year: "numeric", month: "short" });
    expect(guarded.format(1735516800000)).toBe("Dùbh 2024");
  });

  it("makes formatRangeToParts throw a TypeError, so no caller can reach the engine's range parts", () => {
    const { guarded } = build("gd", { year: "numeric", month: "short" });
    expect(() => guarded.formatRangeToParts(0, 1)).toThrow(TypeError);
  });

  it("reports the year field the formatter now prints in resolvedOptions", () => {
    const { guarded } = build("gd", { year: "numeric", month: "short" });
    expect(guarded.resolvedOptions().year).toBe("numeric");
  });

  it("reports a 2-digit year for a 2-digit request", () => {
    const { guarded } = build("ksh", { year: "2-digit", month: "2-digit" });
    expect(guarded.resolvedOptions().year).toBe("2-digit");
  });
});

describe("guardDateTimeFormat: the crash signal", () => {
  /** A formatter whose `resolvedOptions()` omits `year`, as unfixed V8 does for a `Y` pattern. */
  function withoutYear(calendar: string) {
    const real = new Intl.DateTimeFormat(`en-u-ca-${calendar}`, {
      month: "long",
      ...utc,
    });
    return {
      resolvedOptions: () => ({ ...real.resolvedOptions(), year: undefined }),
      format: (ms: number) => real.format(ms),
      formatToParts: (ms: number) => real.formatToParts(ms),
    } as unknown as Intl.DateTimeFormat;
  }

  it.each`
    calendar      | options                               | replaced
    ${"gregory"}  | ${{ year: "numeric", month: "long" }} | ${true}
    ${"buddhist"} | ${{ year: "numeric", month: "long" }} | ${true}
    ${"chinese"}  | ${{ year: "numeric", month: "long" }} | ${false}
    ${"dangi"}    | ${{ year: "numeric", month: "long" }} | ${false}
    ${"gregory"}  | ${{ dateStyle: "long" }}              | ${false}
  `(
    "year missing from resolvedOptions in '$calendar' with $options replaces the formatter: $replaced",
    ({ calendar, options, replaced }) => {
      const stub = withoutYear(calendar);
      expect(guardDateTimeFormat(stub, options) !== stub).toBe(replaced);
    },
  );

  it("never reads resolvedOptions or format when the options print no year", () => {
    const resolvedOptions = vi.fn();
    const format = vi.fn();
    const stub = { resolvedOptions, format } as unknown as Intl.DateTimeFormat;
    expect(guardDateTimeFormat(stub, { hour: "numeric" })).toBe(stub);
    expect(resolvedOptions).not.toHaveBeenCalled();
    expect(format).not.toHaveBeenCalled();
  });
});

describe("guardDateTimeFormat: one verdict per pattern", () => {
  /**
   * How many UTC twins a call builds for a formatter in a non-UTC zone. `dateStyle` is the case the
   * crash signal cannot see, so only the text verdict decides it.
   */
  function twinsBuilt(run: () => void): number {
    const spy = vi.spyOn(Intl, "DateTimeFormat");
    run();
    return spy.mock.calls.filter(
      ([, options]) =>
        (options as Intl.DateTimeFormatOptions | undefined)?.timeZone ===
          "UTC" &&
        (options as Intl.DateTimeFormatOptions | undefined)?.dateStyle ===
          "full",
    ).length;
  }

  const options = {
    dateStyle: "full",
    timeZone: "America/New_York",
  } as const;

  it("reads the text of a pattern once for formatters in different zones", () => {
    const first = new Intl.DateTimeFormat("gl-u-ca-hebrew", options);
    const second = new Intl.DateTimeFormat("gl-u-ca-hebrew", {
      ...options,
      timeZone: "Asia/Tokyo",
    });
    forgetWeekYearVerdicts();
    const built = twinsBuilt(() => {
      guardDateTimeFormat(first, options);
      guardDateTimeFormat(second, { ...options, timeZone: "Asia/Tokyo" });
    });
    expect(built).toBe(1);
  });

  it("reads the text again after Intl.DateTimeFormat is replaced", () => {
    const formatter = new Intl.DateTimeFormat("gl-u-ca-hebrew", options);
    guardDateTimeFormat(formatter, options);
    const built = twinsBuilt(() => {
      guardDateTimeFormat(formatter, options);
    });
    expect(built).toBe(1);
  });
});
