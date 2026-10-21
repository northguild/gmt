/**
 * `isDeepStrictEqual` for the sentinel checks, without the Node util module, so a browser run can use it.
 *
 * It follows the strict comparison Node documents for `util.isDeepStrictEqual`: primitives compare
 * with `Object.is` (so `NaN` equals `NaN` and `0` does not equal `-0`), objects need the same
 * prototype, the same own enumerable keys (strings and symbols) and equal values under each key.
 * The call sites compare sentinels (`null`, `""`, `NaN`, `false`, `[]`) and plain objects or arrays
 * of those. Dates, Maps, Sets, RegExps, boxed primitives and typed arrays keep their state outside
 * own properties, so a key-by-key walk would call any two of them equal: they throw a `TypeError`.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return compare(a, b, new Map());
}

function compare(a: unknown, b: unknown, seen: Map<object, object>): boolean {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  if (!sameKind(a, b)) return false;
  rejectUnsupported(a);
  if (Array.isArray(a) && a.length !== (b as unknown[]).length) return false;
  if (seen.get(a) === b) return true;
  seen.set(a, b);
  return sameEntries(a, b, seen);
}

function sameKind(a: object, b: object): boolean {
  return (
    Object.getPrototypeOf(a) === Object.getPrototypeOf(b) &&
    Array.isArray(a) === Array.isArray(b)
  );
}

function sameEntries(a: object, b: object, seen: Map<object, object>): boolean {
  const keysA = enumerableKeys(a);
  return (
    keysA.length === enumerableKeys(b).length &&
    keysA.every(
      (key) =>
        Object.prototype.propertyIsEnumerable.call(b, key) &&
        compare(
          (a as Record<PropertyKey, unknown>)[key],
          (b as Record<PropertyKey, unknown>)[key],
          seen,
        ),
    )
  );
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function enumerableKeys(value: object): PropertyKey[] {
  return Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key),
  );
}

const UNSUPPORTED_TAG =
  /^\[object (?:Map|Set|WeakMap|WeakSet|Date|RegExp|Number|String|Boolean|BigInt|Symbol|ArrayBuffer|SharedArrayBuffer|DataView|\w+Array)\]$/;

function rejectUnsupported(value: object): void {
  const tag = Object.prototype.toString.call(value);
  if (!Array.isArray(value) && UNSUPPORTED_TAG.test(tag)) {
    throw new TypeError(`deepEqual does not compare ${tag}`);
  }
}
