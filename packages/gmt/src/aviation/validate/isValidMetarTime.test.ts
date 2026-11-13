import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import {
  METAR_SENTINEL_ROWS,
  METAR_VALID_ROWS,
} from "../../test/metarTimeRows";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseMetarTime } from "../parse/parseMetarTime";
import { isValidMetarTime } from "./isValidMetarTime";

/**
 * Every expected value is decided from the rule: a group is valid exactly when `parseMetarTime`
 * reads it as an instant, and the shared rows state by hand which groups those are.
 */
describe("isValidMetarTime", () => {
  describe("Verification rows from issue #406", () => {
    it.each`
      value        | referenceInstant          | expected | reason
      ${"302350Z"} | ${"2024-07-01T00:05:00Z"} | ${true}  | ${"previous month"}
      ${"321200Z"} | ${"2024-07-01T00:05:00Z"} | ${false} | ${"day 32"}
      ${"251200"}  | ${"2024-06-25T12:20:00Z"} | ${false} | ${"no Z"}
      ${"251200Z"} | ${"2024-06-25T12:20:00"}  | ${false} | ${"a reference with no offset"}
    `(
      "returns $expected for '$value' against '$referenceInstant': $reason",
      ({ value, referenceInstant, expected }) => {
        expect(isValidMetarTime(value, referenceInstant)).toBe(expected);
      },
    );
  });

  describe("agrees with the parser over the shared rows", () => {
    it.each(METAR_VALID_ROWS)(
      "returns true for '$value' against '$reference': $reason",
      ({ value, reference }) => {
        expect(isValidMetarTime(value, reference)).toBe(true);
        expect(isValidMetarTime(value, reference)).toBe(
          parseMetarTime(value, reference) !== "",
        );
      },
    );

    it.each(METAR_SENTINEL_ROWS)(
      "returns false for '$value' against '$reference': $reason",
      ({ value, reference }) => {
        expect(isValidMetarTime(value, reference)).toBe(false);
        expect(isValidMetarTime(value, reference)).toBe(
          parseMetarTime(value, reference) !== "",
        );
      },
    );
  });

  describe("arguments", () => {
    it.each(NON_STRINGS)("returns false for the %s as value", (_kind, make) => {
      expect(isValidMetarTime(make() as string, "2024-06-25T12:20:00Z")).toBe(
        false,
      );
    });

    it.each(NON_STRINGS)(
      "returns false for the %s as referenceInstant",
      (_kind, make) => {
        expect(isValidMetarTime("251200Z", make() as string)).toBe(false);
      },
    );

    it("returns false for a String object value", () => {
      expect(
        isValidMetarTime(
          new String("251200Z") as string,
          "2024-06-25T12:20:00Z",
        ),
      ).toBe(false);
    });
  });

  describe("never throws", () => {
    it.each`
      kind               | make
      ${"hostile proxy"} | ${hostileProxy}
      ${"revoked proxy"} | ${revokedProxy}
    `("returns false for a $kind in either argument", ({ make }) => {
      expect(isValidMetarTime(make(), "2024-06-25T12:20:00Z")).toBe(false);
      expect(isValidMetarTime("251200Z", make())).toBe(false);
    });
  });
});
