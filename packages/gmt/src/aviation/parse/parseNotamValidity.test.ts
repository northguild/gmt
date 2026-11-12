import { Temporal } from "../../internal/temporal";
import { MustTestLocales } from "../../test/localeMatrix";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import {
  NOTAM_BAD_OPTIONS,
  NOTAM_SENTINEL_ROWS,
  NOTAM_VALID_ROWS,
} from "../../test/notamValidityRows";
import { parseNotamValidity } from "./parseNotamValidity";

/**
 * Every expected instant is read off OPADD 4.1 §2.3.16 and §2.3.17 by hand: the window start's
 * century plus `YY`, plus 100 when that is below the start, then the group read as UTC.
 */
describe("parseNotamValidity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(NOTAM_VALID_ROWS)(
    "reads '$value' in window $yearWindow as $expected ($reason)",
    ({ value, yearWindow, expected }) => {
      expect(parseNotamValidity(value, { yearWindow })).toEqual(expected);
    },
  );

  it.each(NOTAM_SENTINEL_ROWS)(
    "returns null for '$value' (window $yearWindow): $reason",
    ({ value, yearWindow }) => {
      expect(parseNotamValidity(value, { yearWindow })).toBeNull();
    },
  );

  describe("options", () => {
    it.each(NOTAM_BAD_OPTIONS)(
      "returns null for '2506151200' with $reason",
      ({ options }) => {
        expect(parseNotamValidity("2506151200", options as never)).toBeNull();
      },
    );

    it.each(NOTAM_BAD_OPTIONS)(
      "returns null for 'PERM' with $reason",
      ({ options }) => {
        expect(parseNotamValidity("PERM", options as never)).toBeNull();
      },
    );

    it("reads a function carrying yearWindow like any options bag", () => {
      const options = Object.assign(() => {}, { yearWindow: 2000 });
      expect(parseNotamValidity("2506151200", options)).toEqual({
        kind: "instant",
        instant: "2025-06-15T12:00:00Z",
        estimated: false,
      });
    });

    it("returns null when the yearWindow getter throws", () => {
      const options = {
        get yearWindow(): number {
          throw new Error("hostile getter");
        },
      };
      expect(parseNotamValidity("2506151200", options)).toBeNull();
    });
  });

  describe("arguments", () => {
    it("returns null for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(
          parseNotamValidity(make() as string, { yearWindow: 2000 }),
          kind,
        ).toBeNull();
      }
    });

    it("returns null for a String object", () => {
      expect(
        parseNotamValidity(new String("2506151200") as string, {
          yearWindow: 2000,
        }),
      ).toBeNull();
    });

    it.each`
      label              | make
      ${"hostile proxy"} | ${hostileProxy}
      ${"revoked proxy"} | ${revokedProxy}
    `("does not throw for a $label as value or options", ({ make }) => {
      expect(parseNotamValidity(make(), { yearWindow: 2000 })).toBeNull();
      expect(parseNotamValidity("2506151200", make())).toBeNull();
    });

    it("returns null when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(parseNotamValidity("2506151200", { yearWindow: 2000 })).toBeNull();
    });
  });

  describe("fresh results", () => {
    it("returns a new object for each PERM, so a caller cannot change the next result", () => {
      const first = parseNotamValidity("PERM", { yearWindow: 2000 });
      const second = parseNotamValidity("PERM", { yearWindow: 2000 });
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      (first as { kind: string }).kind = "changed";
      expect(parseNotamValidity("PERM", { yearWindow: 2000 })).toEqual({
        kind: "permanent",
      });
    });

    it("returns a new object for each instant", () => {
      const first = parseNotamValidity("2506151200", { yearWindow: 2000 });
      const second = parseNotamValidity("2506151200", { yearWindow: 2000 });
      expect(first).not.toBe(second);
    });
  });

  describe("rolling window", () => {
    function setNow(instant: string): void {
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from(instant),
      );
    }

    it.each`
      now                       | value              | expected
      ${"2026-06-01T00:00:00Z"} | ${"7506151200"}    | ${{ kind: "instant", instant: "2075-06-15T12:00:00Z", estimated: false }}
      ${"2026-06-01T00:00:00Z"} | ${"7606151200"}    | ${{ kind: "instant", instant: "1976-06-15T12:00:00Z", estimated: false }}
      ${"2026-06-01T00:00:00Z"} | ${"PERM"}          | ${{ kind: "permanent" }}
      ${"2026-12-31T23:59:59Z"} | ${"7606151200"}    | ${{ kind: "instant", instant: "1976-06-15T12:00:00Z", estimated: false }}
      ${"2027-01-01T00:00:00Z"} | ${"7606151200"}    | ${{ kind: "instant", instant: "2076-06-15T12:00:00Z", estimated: false }}
      ${"2027-01-01T00:00:00Z"} | ${"7506151200"}    | ${{ kind: "instant", instant: "2075-06-15T12:00:00Z", estimated: false }}
      ${"2026-06-01T00:00:00Z"} | ${"7506151200EST"} | ${{ kind: "instant", instant: "2075-06-15T12:00:00Z", estimated: true }}
    `(
      "reads '$value' as $expected when now is $now",
      ({ now, value, expected }) => {
        setNow(now);
        expect(parseNotamValidity(value, { yearWindow: "rolling" })).toEqual(
          expected,
        );
      },
    );

    it("reads no clock for a fixed window", () => {
      const spy = vi.spyOn(Temporal.Now, "instant");
      for (const { value, yearWindow } of NOTAM_VALID_ROWS) {
        parseNotamValidity(value, { yearWindow });
      }
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("locale independence", () => {
    it.each`
      locale
      ${MustTestLocales.enUS}
      ${MustTestLocales.deDE}
      ${MustTestLocales.arSA}
      ${MustTestLocales.trTR}
    `(
      "gives the fixed answers under the ambient locale $locale",
      ({ locale }) => {
        vi.spyOn(
          Intl.DateTimeFormat.prototype,
          "resolvedOptions",
        ).mockReturnValue({
          locale,
        } as Intl.ResolvedDateTimeFormatOptions);
        const options = { yearWindow: 2000 };
        expect(parseNotamValidity("1407031230EST", options)).toEqual({
          kind: "instant",
          instant: "2014-07-03T12:30:00Z",
          estimated: true,
        });
        expect(parseNotamValidity("perm", options)).toBeNull();
        expect(parseNotamValidity("1407031230est", options)).toBeNull();
      },
    );

    it("calls no case conversion", () => {
      const spies = (
        [
          "toUpperCase",
          "toLowerCase",
          "toLocaleUpperCase",
          "toLocaleLowerCase",
          "localeCompare",
        ] as const
      ).map((name) => vi.spyOn(String.prototype, name));
      for (const { value, yearWindow } of NOTAM_VALID_ROWS) {
        parseNotamValidity(value, { yearWindow });
      }
      for (const { value, yearWindow } of NOTAM_SENTINEL_ROWS) {
        parseNotamValidity(value, { yearWindow });
      }
      const calls = spies.map((s) => s.mock.calls.length);
      vi.restoreAllMocks();
      expect(calls).toStrictEqual([0, 0, 0, 0, 0]);
    });
  });
});
