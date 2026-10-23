import { isObject } from "./isObject";

/**
 * One place on Earth, given by field name and never by array position, so the axis order cannot
 * be misread. GeoJSON writes `[longitude, latitude]` (RFC 7946 §3.1.1); convert once, where the
 * data comes in: `{ latitude: c[1], longitude: c[0] }`, adding `height: c[2]` when it is present.
 *
 * The datum is WGS 84 and angles are decimal degrees (RFC 7946 §4; RFC 5870 §3.4.2). ISO 6709 and
 * ISO 19111 are the international standards for the same ground; they are named here as peers and
 * not quoted.
 *
 * A position on another body is not a `Position`. For example, Mars longitudes in the Mars-time
 * functions stay plain numbers.
 *
 * RFC 5870 §2 and §3.4.5 call the height "geoid" height; GMT follows RFC 7946 and means the
 * ellipsoid. `height` has no range. A function whose answer depends on whether a longitude is 180
 * or -180 says so in its own docs.
 *
 * GMT does not turn a position into a time zone. A zone is always a parameter.
 */
export type Position = {
  /**
   * Decimal degrees, north positive, from -90 to 90 inclusive (RFC 5870 §3.4.2). At -90 and 90
   * any longitude in range is accepted and kept as given.
   */
  latitude: number;
  /**
   * Decimal degrees, east positive, from -180 to 180 inclusive (RFC 5870 §3.4.2). RFC 5870 §3.4.4
   * treats -180 and 180 as the same meridian, so both are accepted and GMT never rewrites one as
   * the other; `-0` is kept as `-0`.
   */
  longitude: number;
  /**
   * Metres above (positive) or below (negative) the WGS 84 ellipsoid (RFC 7946 §4). This is not
   * height above sea level. Leave it out when it is unknown; do not write `0` (RFC 5870 §3.4.2).
   *
   * @defaultValue None. The height is unknown.
   */
  height?: number;
};

/**
 * Read a `Position` from a caller's value, or `null`. This is the one check every function that
 * takes a `Position` makes; that function then returns its own sentinel for `null`.
 *
 * - `latitude` must be a number from -90 to 90 inclusive (RFC 5870 §3.4.2). `longitude` must be a
 *   number from -180 to 180 inclusive (RFC 5870 §3.4.2; §3.4.4 treats 180 and -180 as equal).
 *   Neither is wrapped or clamped.
 * - `height` is optional and has no range, but when it is present it must be a finite number.
 *   `undefined` means the height is not known, and the result then has no `height` key. `null` is
 *   not the same as absent and gives `null`.
 * - The members are read with an ordinary property get, once each, in the order `height`,
 *   `latitude`, `longitude`. All three are read before any is checked, and the caller's value is
 *   never read again.
 * - Nothing is coerced: `"35.68"`, `35n` and `new Number(35)` are all invalid.
 * - Values are copied unchanged. `-0` stays `-0`, and `180` and `-180` are never rewritten.
 * - The result is a new plain object with the keys `latitude`, `longitude` and, when given,
 *   `height`. Extra members on the input are not copied. It is not frozen.
 * - It never throws. A throwing getter, a throwing Proxy or a revoked Proxy gives `null`.
 *
 * @param value the caller's candidate position
 * @example readPosition({ latitude: 35.68, longitude: 139.77 }) // { latitude: 35.68, longitude: 139.77 }
 * @example readPosition({ latitude: 35.68, longitude: 139.77, height: -30 }) // { latitude: 35.68, longitude: 139.77, height: -30 }
 * @example readPosition({ latitude: 0, longitude: -180 }) // { latitude: 0, longitude: -180 }
 * @example readPosition([139.77, 35.68]) // null
 * @example readPosition({ latitude: 90.000001, longitude: 0 }) // null
 * @returns a new `Position`, or `null` when `value` is not a valid position
 */
export function readPosition(value: unknown): Position | null {
  if (!isObject(value)) return null;

  let height: unknown;
  let latitude: unknown;
  let longitude: unknown;
  try {
    // Code-unit order, each member read once, all before any check.
    ({ height, latitude, longitude } = value as Record<string, unknown>);
  } catch {
    return null;
  }

  if (
    typeof latitude !== "number" ||
    !(latitude >= -90 && latitude <= 90) ||
    typeof longitude !== "number" ||
    !(longitude >= -180 && longitude <= 180)
  ) {
    return null;
  }

  if (height === undefined) return { latitude, longitude };
  if (typeof height !== "number" || !Number.isFinite(height)) return null;
  return { latitude, longitude, height };
}
