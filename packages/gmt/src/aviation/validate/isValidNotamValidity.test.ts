import { Temporal } from "../../internal/temporal";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { NON_STRINGS } from "../../test/nonStrings";
import {
  NOTAM_BAD_OPTIONS,
  NOTAM_SENTINEL_ROWS,
  NOTAM_VALID_ROWS,
} from "../../test/notamValidityRows";
import { parseNotamValidity } from "../parse/parseNotamValidity";
import { isValidNotamValidity } from "./isValidNotamValidity";

/**
 * Every expected value is decided from OPADD 4.1 §2.3.16 and §2.3.17: a value is valid exactly when
 * `parseNotamValidity` reads it, and the shared rows state by hand which values those are.
 */
describe("isValidNotamValidity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Verification rows from issue #406", () => {
    it.each`
      value               | options                 | expected | reason
      ${"1407031230EST"}  | ${{ yearWindow: 2000 }} | ${true}  | ${"an estimated end"}
      ${"PERM"}           | ${{ yearWindow: 2000 }} | ${true}  | ${"permanent"}
      ${"1407031230 EST"} | ${{ yearWindow: 2000 }} | ${false} | ${"a space before EST"}
      ${"2502301200"}     | ${{ yearWindow: 2000 }} | ${false} | ${"February has no 30th"}
      ${"2506151200"}     | ${{}}                   | ${false} | ${"no yearWindow"}
      ${"PERM"}           | ${{}}                   | ${false} | ${"PERM too needs yearWindow"}
      ${"0002290000"}     | ${{ yearWindow: 2000 }} | ${true}  | ${"2000 is a leap year"}
      ${"0002290000"}     | ${{ yearWindow: 1900 }} | ${false} | ${"1900 is not a leap year"}
    `(
      "returns $expected for '$value' with $options: $reason",
      ({ value, options, expected }) => {
        expect(isValidNotamValidity(value, options)).toBe(expected);
      },
    );
  });

  describe("agrees with the parser over the shared rows", () => {
    it.each(NOTAM_VALID_ROWS)(
      "returns true for '$value' in window $yearWindow ($reason)",
      ({ value, yearWindow }) => {
        const options = { yearWindow };
        expect(isValidNotamValidity(value, options)).toBe(true);
        expect(isValidNotamValidity(value, options)).toBe(
          parseNotamValidity(value, options) !== null,
        );
      },
    );

    it.each(NOTAM_SENTINEL_ROWS)(
      "returns false for '$value' in window $yearWindow: $reason",
      ({ value, yearWindow }) => {
        const options = { yearWindow };
        expect(isValidNotamValidity(value, options)).toBe(false);
        expect(isValidNotamValidity(value, options)).toBe(
          parseNotamValidity(value, options) !== null,
        );
      },
    );

    it.each(NOTAM_BAD_OPTIONS)(
      "returns false for '2506151200' with options that carry no window: $reason",
      ({ options }) => {
        expect(isValidNotamValidity("2506151200", options as never)).toBe(
          false,
        );
        expect(isValidNotamValidity("PERM", options as never)).toBe(false);
      },
    );
  });

  describe("rolling window", () => {
    // The clock is pinned: a rolling window moves with the UTC year.
    it.each`
      now                       | value              | expected
      ${"2026-06-01T00:00:00Z"} | ${"7506151200"}    | ${true}
      ${"2026-06-01T00:00:00Z"} | ${"PERM"}          | ${true}
      ${"2026-06-01T00:00:00Z"} | ${"7506151200EST"} | ${true}
      ${"2026-06-01T00:00:00Z"} | ${"7506151260"}    | ${false}
      ${"2026-06-01T00:00:00Z"} | ${"7602291200"}    | ${true}
      ${"2051-06-01T00:00:00Z"} | ${"0002290000"}    | ${false}
      ${"2026-06-01T00:00:00Z"} | ${"0002290000"}    | ${true}
    `(
      "returns $expected for '$value' in a rolling window when now is $now",
      ({ now, value, expected }) => {
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(
          Temporal.Instant.from(now),
        );
        const options = { yearWindow: "rolling" as const };
        expect(isValidNotamValidity(value, options)).toBe(expected);
        expect(isValidNotamValidity(value, options)).toBe(
          parseNotamValidity(value, options) !== null,
        );
      },
    );
  });

  describe("arguments", () => {
    it.each(NON_STRINGS)("returns false for the %s as value", (_kind, make) => {
      expect(isValidNotamValidity(make() as string, { yearWindow: 2000 })).toBe(
        false,
      );
    });

    it("returns false for a String object value", () => {
      expect(
        isValidNotamValidity(new String("PERM") as string, {
          yearWindow: 2000,
        }),
      ).toBe(false);
    });
  });

  describe("never throws", () => {
    it.each`
      kind               | make
      ${"hostile proxy"} | ${hostileProxy}
      ${"revoked proxy"} | ${revokedProxy}
    `("returns false for a $kind in either argument", ({ make }) => {
      expect(isValidNotamValidity(make(), { yearWindow: 2000 })).toBe(false);
      expect(isValidNotamValidity("PERM", make())).toBe(false);
    });

    it("returns false when the yearWindow getter throws", () => {
      const options = {
        get yearWindow(): number {
          throw new Error("hostile getter");
        },
      };
      expect(isValidNotamValidity("PERM", options)).toBe(false);
    });
  });
});
