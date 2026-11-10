import { Temporal } from "../../internal/temporal";
import { countIntlConstructions } from "../../test/countIntlConstructions";
import { MustTestLocales } from "../../test/localeMatrix";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import { SSIM_SENTINEL_ROWS, SSIM_VALID_ROWS } from "../../test/ssimDateRows";
import { parseSsimDate } from "./parseSsimDate";

/**
 * Every expected year is read off the grammar by hand: the window start's century plus `YY`,
 * plus 100 when that is below the start. Each expected date was also run through the polyfill.
 */
describe("parseSsimDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const VALID = SSIM_VALID_ROWS;

  it.each(VALID)(
    "reads '%s' in window %d as %s",
    (value, yearWindow, expected) => {
      expect(parseSsimDate(value, { yearWindow })).toBe(expected);
    },
  );

  it.each(SSIM_SENTINEL_ROWS)(
    "returns '' for '%s' (window %d): %s",
    (value, yearWindow) => {
      expect(parseSsimDate(value, { yearWindow })).toBe("");
    },
  );

  it.each`
    options                       | reason
    ${{}}                         | ${"no yearWindow"}
    ${{ yearWindow: undefined }}  | ${"yearWindow undefined"}
    ${{ yearWindow: -1 }}         | ${"below 0"}
    ${{ yearWindow: 9901 }}       | ${"above 9900"}
    ${{ yearWindow: 2000.5 }}     | ${"not an integer"}
    ${{ yearWindow: Number.NaN }} | ${"NaN"}
    ${{ yearWindow: Infinity }}   | ${"Infinity"}
    ${{ yearWindow: "2000" }}     | ${"a numeric string"}
    ${{ yearWindow: null }}       | ${"null"}
    ${{ yearWindow: "Rolling" }}  | ${"a capitalised string is not 'rolling'"}
  `("returns '' for the window $reason", ({ options }) => {
    expect(parseSsimDate("01JAN26", options)).toBe("");
  });

  describe("arguments", () => {
    it("returns '' for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(
          parseSsimDate(make() as string, { yearWindow: 2000 }),
          kind,
        ).toBe("");
      }
    });

    it("returns '' for a String object", () => {
      expect(
        parseSsimDate(new String("01JAN26") as string, { yearWindow: 2000 }),
      ).toBe("");
    });

    it("returns '' for omitted options", () => {
      expect(parseSsimDate("01JAN26", undefined as never)).toBe("");
    });

    it.each`
      options
      ${null}
      ${"x"}
      ${1}
      ${true}
    `("returns '' for the non-object options $options", ({ options }) => {
      expect(parseSsimDate("01JAN26", options)).toBe("");
    });

    it("reads a function carrying yearWindow like any options bag", () => {
      const options = Object.assign(() => {}, { yearWindow: 2000 });
      expect(parseSsimDate("01JAN26", options)).toBe("2026-01-01");
    });

    it("returns '' when the yearWindow getter throws", () => {
      const options = {
        get yearWindow(): number {
          throw new Error("hostile getter");
        },
      };
      expect(parseSsimDate("01JAN26", options)).toBe("");
    });

    it("returns '' when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(parseSsimDate("01JAN26", { yearWindow: 2000 })).toBe("");
    });
  });

  describe("rolling window", () => {
    function setNow(instant: string): void {
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from(instant),
      );
    }

    it.each`
      now                       | value        | expected
      ${"2026-06-01T00:00:00Z"} | ${"01JAN76"} | ${"1976-01-01"}
      ${"2026-06-01T00:00:00Z"} | ${"31DEC75"} | ${"2075-12-31"}
      ${"2026-06-01T00:00:00Z"} | ${"01JAN26"} | ${"2026-01-01"}
      ${"2077-06-01T00:00:00Z"} | ${"01JAN26"} | ${"2126-01-01"}
      ${"2026-12-31T23:59:59Z"} | ${"01JAN76"} | ${"1976-01-01"}
      ${"2027-01-01T00:00:00Z"} | ${"01JAN76"} | ${"2076-01-01"}
      ${"2051-06-01T00:00:00Z"} | ${"29FEB00"} | ${""}
      ${"2026-06-01T00:00:00Z"} | ${"29FEB00"} | ${"2000-02-29"}
    `(
      "reads '$value' as '$expected' when now is $now",
      ({ now, value, expected }) => {
        setNow(now);
        expect(parseSsimDate(value, { yearWindow: "rolling" })).toBe(expected);
      },
    );
  });

  describe("locale independence", () => {
    function stubLocale(locale: string): void {
      vi.spyOn(
        Intl.DateTimeFormat.prototype,
        "resolvedOptions",
      ).mockReturnValue({
        locale,
      } as Intl.ResolvedDateTimeFormatOptions);
      if (typeof navigator !== "undefined") {
        vi.spyOn(navigator, "language", "get").mockReturnValue(locale);
      }
    }

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
      "gives the fixed answers under the ambient locale $locale",
      ({ locale }) => {
        stubLocale(locale);
        const options = { yearWindow: 2000 };
        expect(parseSsimDate("01JAN26", options)).toBe("2026-01-01");
        expect(parseSsimDate("25OCT26", options)).toBe("2026-10-25");
        expect(parseSsimDate("01jan26", options)).toBe("");
        expect(parseSsimDate("01ENE26", options)).toBe("");
        expect(parseSsimDate("01JANV26", options)).toBe("");
      },
    );

    it("constructs no Intl formatter", () => {
      const run = (): void => {
        for (const [value, yearWindow] of VALID) {
          parseSsimDate(value, { yearWindow });
        }
      };
      expect(
        countIntlConstructions(["DateTimeFormat", "NumberFormat"], run, run),
      ).toBe(0);
    });

    it("calls no locale-sensitive string method", () => {
      const upper = vi.spyOn(String.prototype, "toLocaleUpperCase");
      const lower = vi.spyOn(String.prototype, "toLocaleLowerCase");
      const compare = vi.spyOn(String.prototype, "localeCompare");
      for (const [value, yearWindow] of VALID) {
        parseSsimDate(value, { yearWindow });
      }
      const calls = [
        upper.mock.calls.length,
        lower.mock.calls.length,
        compare.mock.calls.length,
      ];
      vi.restoreAllMocks();
      expect(calls).toStrictEqual([0, 0, 0]);
    });
  });
});
