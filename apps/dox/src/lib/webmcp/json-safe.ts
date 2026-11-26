/**
 * The value as JSON carries it: an `undefined` field is dropped, as the browser would drop it on
 * the way to the model. The facts functions return plain data, so nothing else changes.
 */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
