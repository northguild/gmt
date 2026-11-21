import {
  cachedFormatter,
  checkFormatterArguments,
  clearFormatterCache,
} from "./formatterCache";
import { isLunisolarTextCompatNeeded } from "./temporalCompat/capabilities";

describe("cachedFormatter", () => {
  beforeEach(() => {
    clearFormatterCache();
  });

  // Compat D33: where the probe for the calendar fails, a chinese or dangi date is refused, and a
  // refusal is not cached; where it passes, the host's own formatter is returned.
  it.each`
    locale               | calendar     | options
    ${"en-u-ca-chinese"} | ${"chinese"} | ${{ timeZone: "UTC" }}
    ${"en-u-ca-dangi"}   | ${"dangi"}   | ${{ timeZone: "UTC" }}
    ${"en"}              | ${"chinese"} | ${{ timeZone: "UTC", calendar: "chinese", dateStyle: "short" }}
  `(
    "throws a RangeError for $locale with $options on every call while the $calendar probe fails",
    ({
      locale,
      calendar,
      options,
    }: {
      locale: string;
      calendar: "chinese" | "dangi";
      options: object;
    }) => {
      const attempt = () => cachedFormatter("DateTimeFormat", locale, options);
      if (isLunisolarTextCompatNeeded(calendar)) {
        expect(attempt).toThrow(RangeError);
        expect(attempt).toThrow(RangeError);
      } else {
        expect(attempt).not.toThrow();
      }
    },
  );

  // The argument check validates the caller's options only: a time-only function completes them
  // afterwards, and the formatter it formats with is the one refused.
  it("does not refuse a chinese date formatter when only the arguments are checked", () => {
    expect(() =>
      checkFormatterArguments("DateTimeFormat", "en-u-ca-chinese", {}),
    ).not.toThrow();
  });

  // A formatter whose date parts are thrown away is built without the date refusals, and the
  // refusing formatter for the same arguments still throws: the two are cached apart.
  it.each`
    locale               | why
    ${"en-u-ca-chinese"} | ${"compat D33"}
  `(
    "builds $locale without the date refusal ($why), and still refuses it where the probe fails",
    ({ locale }: { locale: string }) => {
      const options = { dateStyle: "full", timeZone: "UTC" } as const;
      const kept = cachedFormatter("DateTimeFormat", locale, options, false);
      expect(cachedFormatter("DateTimeFormat", locale, options, false)).toBe(
        kept,
      );
      const attempt = () => cachedFormatter("DateTimeFormat", locale, options);
      if (isLunisolarTextCompatNeeded("chinese")) {
        expect(attempt).toThrow(RangeError);
      } else {
        expect(attempt).not.toThrow();
      }
    },
  );

  it("returns the same formatter for the same plain arguments", () => {
    const options = { dateStyle: "long", timeZone: "UTC" } as const;
    expect(cachedFormatter("DateTimeFormat", "en-GB", options)).toBe(
      cachedFormatter("DateTimeFormat", "en-GB", { ...options }),
    );
  });

  it.each`
    why                                | locale       | options
    ${"an omitted locale"}             | ${undefined} | ${{ timeZone: "UTC" }}
    ${"a DateTimeFormat with no zone"} | ${"en-GB"}   | ${{ dateStyle: "long" }}
    ${"an empty locale array"}         | ${[]}        | ${{ timeZone: "UTC" }}
  `("builds fresh for $why", ({ locale, options }) => {
    expect(cachedFormatter("DateTimeFormat", locale, options)).not.toBe(
      cachedFormatter("DateTimeFormat", locale, options),
    );
  });

  // Intl would turn an object into its ToString; the gate refuses it before anything is built.
  it("throws a TypeError for an object option value instead of converting it", () => {
    expect(() =>
      cachedFormatter("DateTimeFormat", "en-GB", {
        timeZone: "UTC",
        month: { toString: () => "long" },
      } as never),
    ).toThrow(TypeError);
  });

  // Intl refuses a non-finite digit count; the cache never keeps what failed, so each call throws.
  it.each`
    label         | value
    ${"NaN"}      | ${Number.NaN}
    ${"Infinity"} | ${Number.POSITIVE_INFINITY}
  `(
    "throws the RangeError Intl throws for a $label digit count",
    ({ value }) => {
      const options = {
        timeZone: "UTC",
        fractionalSecondDigits: value,
      } as never;
      expect(() => cachedFormatter("DateTimeFormat", "en-GB", options)).toThrow(
        RangeError,
      );
      expect(() => cachedFormatter("DateTimeFormat", "en-GB", options)).toThrow(
        RangeError,
      );
    },
  );

  it("skips an undefined option value, so it shares a formatter with the option left out", () => {
    expect(
      cachedFormatter("DateTimeFormat", "en-GB", {
        timeZone: "UTC",
        dateStyle: "long",
        hour12: undefined,
      }),
    ).toBe(
      cachedFormatter("DateTimeFormat", "en-GB", {
        timeZone: "UTC",
        dateStyle: "long",
      }),
    );
  });

  it("shares a formatter for the other kinds with no zone at all", () => {
    expect(cachedFormatter("NumberFormat", "en", { style: "percent" })).toBe(
      cachedFormatter("NumberFormat", "en", { style: "percent" }),
    );
  });

  it("reads a locale array once, so a Proxy that answers each read differently poisons nothing", () => {
    let gets = 0;
    const flipping = new Proxy(["de-DE"], {
      get(target, key, receiver) {
        if (key === "0") {
          gets += 1;
          return gets % 2 === 1 ? "de-DE" : "ja-JP";
        }
        return Reflect.get(target, key, receiver);
      },
    });
    const options = { dateStyle: "long", timeZone: "UTC" } as const;
    const at = 1_720_051_200_000;
    cachedFormatter("DateTimeFormat", flipping, options);
    expect(
      cachedFormatter("DateTimeFormat", ["de-DE"], options).format(at),
    ).toBe("4. Juli 2024");
    expect(
      cachedFormatter("DateTimeFormat", ["de-DE"], options).resolvedOptions()
        .locale,
    ).toBe("de-DE");
  });

  it("throws what Intl throws when a Proxy locale array's has trap throws, on a cache hit too", () => {
    const options = { dateStyle: "long", timeZone: "UTC" } as const;
    cachedFormatter("DateTimeFormat", ["en-GB"], options);
    const hostile = new Proxy(["en-GB"], {
      has(target, key) {
        if (key === "0") {
          throw new Error("trap");
        }
        return Reflect.has(target, key);
      },
    });
    expect(() => cachedFormatter("DateTimeFormat", hostile, options)).toThrow(
      "trap",
    );
    expect(() =>
      checkFormatterArguments("DateTimeFormat", hostile, options),
    ).toThrow("trap");
  });

  it("canonicalizes the locale list before it reads the options", () => {
    const reads: string[] = [];
    const options = {
      get timeZone() {
        reads.push("timeZone");
        return "UTC";
      },
    };
    expect(() =>
      cachedFormatter("DateTimeFormat", ["not a locale"], options),
    ).toThrow(RangeError);
    expect(reads).toEqual([]);
  });

  it("never runs an option getter to build the key", () => {
    let reads = 0;
    const options = {
      timeZone: "UTC",
      get dateStyle() {
        reads += 1;
        return "long";
      },
    };
    const a = cachedFormatter("DateTimeFormat", "en-GB", options);
    const b = cachedFormatter("DateTimeFormat", "en-GB", options);
    expect(a).not.toBe(b);
    expect(reads).toBe(2);
  });

  // Each pair differs in one constructor argument, so the formatters must not be shared and
  // must format 2024-07-04T15:05Z as the output columns say (read from Intl itself).
  it.each`
    why                                  | localeA    | optionsA                                                                 | outputA      | localeB                  | optionsB                                                                     | outputB
    ${"hour12 vs hourCycle"}             | ${"en-US"} | ${{ timeZone: "UTC", hour: "numeric", minute: "2-digit", hour12: true }} | ${"3:05 PM"} | ${"en-US"}               | ${{ timeZone: "UTC", hour: "numeric", minute: "2-digit", hourCycle: "h23" }} | ${"15:05"}
    ${"a different timeZone"}            | ${"en-US"} | ${{ timeZone: "UTC", hour: "numeric", minute: "2-digit" }}               | ${"3:05 PM"} | ${"en-US"}               | ${{ timeZone: "Asia/Tokyo", hour: "numeric", minute: "2-digit" }}            | ${"12:05 AM"}
    ${"a different calendar"}            | ${"en-US"} | ${{ timeZone: "UTC", year: "numeric" }}                                  | ${"2024"}    | ${"en-US"}               | ${{ timeZone: "UTC", year: "numeric", calendar: "buddhist" }}                | ${"2567 BE"}
    ${"a different numberingSystem"}     | ${"en-US"} | ${{ timeZone: "UTC", day: "numeric" }}                                   | ${"4"}       | ${"en-US"}               | ${{ timeZone: "UTC", day: "numeric", numberingSystem: "arab" }}              | ${"٤"}
    ${"a locale extension calendar key"} | ${"en-US"} | ${{ timeZone: "UTC", year: "numeric" }}                                  | ${"2024"}    | ${"en-US-u-ca-buddhist"} | ${{ timeZone: "UTC", year: "numeric" }}                                      | ${"2567 BE"}
    ${"a locale extension hc key"}       | ${"en-US"} | ${{ timeZone: "UTC", hour: "numeric" }}                                  | ${"3 PM"}    | ${"en-US-u-hc-h23"}      | ${{ timeZone: "UTC", hour: "numeric" }}                                      | ${"15"}
  `(
    "does not share a formatter across $why",
    ({ localeA, optionsA, outputA, localeB, optionsB, outputB }) => {
      const at = 1_720_105_500_000;
      const a = cachedFormatter("DateTimeFormat", localeA, optionsA);
      const b = cachedFormatter("DateTimeFormat", localeB, optionsB);
      expect(a).not.toBe(b);
      expect(a.format(at)).toBe(outputA);
      expect(b.format(at)).toBe(outputB);
    },
  );

  it("gives a fresh result after an options object is mutated between calls", () => {
    const options: Record<string, unknown> = {
      timeZone: "UTC",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    const at = 1_720_105_500_000;
    const first = cachedFormatter("DateTimeFormat", "en-US", options);
    expect(first.format(at)).toBe("3:05 PM");
    options["hour12"] = false;
    options["hourCycle"] = undefined;
    const second = cachedFormatter("DateTimeFormat", "en-US", options);
    expect(second).not.toBe(first);
    expect(second.format(at)).toBe("15:05");
    expect(first.format(at)).toBe("3:05 PM");
  });

  it.each`
    kind                    | locale            | options
    ${"DateTimeFormat"}     | ${"not a locale"} | ${{ timeZone: "UTC" }}
    ${"NumberFormat"}       | ${"!!"}           | ${{}}
    ${"ListFormat"}         | ${"en"}           | ${{ type: "nope" }}
    ${"RelativeTimeFormat"} | ${"en"}           | ${{ numeric: "nope" }}
  `(
    "$kind throws RangeError on every call for an invalid argument",
    ({ kind, locale, options }) => {
      for (let call = 0; call < 3; call += 1) {
        expect(() => cachedFormatter(kind, locale, options)).toThrow(
          RangeError,
        );
        expect(() => checkFormatterArguments(kind, locale, options)).toThrow(
          RangeError,
        );
      }
    },
  );

  it("does not need a zone for the other kinds", () => {
    expect(cachedFormatter("ListFormat", "en", { type: "conjunction" })).toBe(
      cachedFormatter("ListFormat", "en", { type: "conjunction" }),
    );
  });

  it("builds anew once Intl.DateTimeFormat is replaced, and keeps the other kinds", () => {
    const options = { dateStyle: "long", timeZone: "UTC" } as const;
    const before = cachedFormatter("DateTimeFormat", "en-GB", options);
    const list = cachedFormatter("ListFormat", "en", { type: "conjunction" });
    const Native = Intl.DateTimeFormat;
    class Patched extends Native {}
    Intl.DateTimeFormat = Patched as typeof Intl.DateTimeFormat;
    try {
      const after = cachedFormatter("DateTimeFormat", "en-GB", options);
      expect(after).not.toBe(before);
      expect(after).toBeInstanceOf(Patched);
      expect(cachedFormatter("DateTimeFormat", "en-GB", options)).toBe(after);
      expect(cachedFormatter("ListFormat", "en", { type: "conjunction" })).toBe(
        list,
      );
    } finally {
      Intl.DateTimeFormat = Native;
    }
    expect(
      cachedFormatter("DateTimeFormat", "en-GB", options),
    ).not.toBeInstanceOf(Patched);
  });

  it("clears a kind past 256 entries and still answers correctly", () => {
    const first = cachedFormatter("NumberFormat", "en", {
      minimumFractionDigits: 0,
    });
    for (let digits = 0; digits < 300; digits += 1) {
      cachedFormatter("NumberFormat", "en", {
        minimumIntegerDigits: (digits % 20) + 1,
        maximumFractionDigits: (digits % 5) + 1,
        useGrouping: digits % 2 === 0,
        minimumFractionDigits: 0,
        maximumSignificantDigits: (digits % 21) + 1,
      });
    }
    expect(
      (
        cachedFormatter("NumberFormat", "en", {
          minimumFractionDigits: 0,
        }) as Intl.NumberFormat
      ).format(1234.5),
    ).toBe((first as Intl.NumberFormat).format(1234.5));
  });
});

describe("checkFormatterArguments", () => {
  it("throws for the same invalid arguments every time", () => {
    for (let call = 0; call < 2; call += 1) {
      expect(() =>
        checkFormatterArguments("DateTimeFormat", "en-US", {
          timeZone: "Not/AZone",
        }),
      ).toThrow(RangeError);
    }
  });

  it("constructs again once Intl.DateTimeFormat is replaced", () => {
    checkFormatterArguments("DateTimeFormat", "en-US", { dateStyle: "long" });
    const Native = Intl.DateTimeFormat;
    Intl.DateTimeFormat = class extends Native {
      constructor() {
        super();
        throw new RangeError("replaced");
      }
    } as typeof Intl.DateTimeFormat;
    try {
      expect(() =>
        checkFormatterArguments("DateTimeFormat", "en-US", {
          dateStyle: "long",
        }),
      ).toThrow("replaced");
    } finally {
      Intl.DateTimeFormat = Native;
    }
  });

  it("is silent for valid arguments, repeated", () => {
    expect(() => {
      checkFormatterArguments("DateTimeFormat", "en-US", { dateStyle: "long" });
      checkFormatterArguments("DateTimeFormat", "en-US", { dateStyle: "long" });
    }).not.toThrow();
  });
});
