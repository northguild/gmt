import { Temporal } from "../internal/temporal";
import { hostileProxy, revokedProxy } from "./hostileValues";

/**
 * Values that are not strings, each named for the failure message. Built per use: a Proxy that
 * throws on every trap reaches the catch path, where the others stop at the `typeof` guard.
 *
 * Every validator that takes a string, or any value, returns `false` for each
 * of these. The `String` object is the case ECMA-262 §6.1.4 decides: a `String` object is an
 * object, not a string.
 *
 * ```ts
 * it("returns false for a value that is not a string", () => {
 *   for (const [kind, make] of NON_STRINGS) {
 *     expect(isValidDate(make()), kind).toBe(false);
 *   }
 * });
 * ```
 */
export const NON_STRINGS: [string, () => unknown][] = [
  ["null", () => null],
  ["undefined", () => undefined],
  ["a number", () => 20240615],
  ["a boolean", () => true],
  ["an array holding a string", () => ["20240615"]],
  ["an object", () => ({})],
  // `typeof` is "object": a String object is not a string, although it reads as one.
  ["a String object", () => new String("20240615")],
  ["a bigint", () => 20240615n],
  // A symbol throws a TypeError when it is read as a string.
  ["a symbol", () => Symbol("20240615")],
  ["a function", () => () => "20240615"],
  // Temporal reads a ZonedDateTime as a time zone identifier, so a zone check that only asks
  // Temporal passes it although it is an object.
  [
    "a ZonedDateTime whose toString is a zone id",
    () => {
      const zoned = Temporal.ZonedDateTime.from(
        "2020-02-28T00:00:00+09:00[Asia/Tokyo]",
      );
      zoned.toString = () => "Asia/Tokyo";
      return zoned;
    },
  ],
  ["a Proxy that throws on any trap", hostileProxy],
  ["a revoked Proxy", revokedProxy],
  // oxlint-disable-next-line @northguild/gmt-oxlint/no-new-date -- unsupported-type fixture
  ["a Date", () => new Date(0)], // date-ban: a Date as a non-string input
];

/**
 * Returns its argument typed `unknown`, the way a value read from JSON or a form arrives.
 *
 * Type tests start from it, never from `const input: unknown = "…"`: an assignment can narrow
 * the declared type, and the assertion would then test the wrong thing.
 */
export const arrives = (value: unknown): unknown => value;
