// Not in `isoStringBody.ts`: esbuild keeps a module-level `new RegExp` in every bundle that loads
// its file, used or not, and most bundles that read an ISO body never ask this question.
import { isoStringBody, TIME_ZONE_ANNOTATION } from "./isoStringBody";

/** A `TIME_ZONE_ANNOTATION` at the start of the text it is tested on. */
const leadingTimeZoneAnnotation = new RegExp(`^${TIME_ZONE_ANNOTATION}`);

/**
 * True when the first annotation after the body (`isoStringBody`) names a time zone. Only a time
 * zone annotation makes a string zoned: it is the first annotation, and the only kind with no `=`
 * (RFC 9557 §4.1). A calendar or elective annotation alone leaves an offset-only instant.
 *
 * @param value ISO 8601 / RFC 9557 string
 * @returns whether a time zone annotation follows the body
 *
 * @example hasTimeZoneAnnotation("2024-06-15T10:00:00Z[Europe/London]") // true
 * @example hasTimeZoneAnnotation("2024-06-15T10:00:00Z[u-ca=gregory]") // false
 * @example hasTimeZoneAnnotation("2024-06-15T10:00:00Z") // false
 */
export function hasTimeZoneAnnotation(value: string): boolean {
  return leadingTimeZoneAnnotation.test(
    value.slice(isoStringBody(value).length),
  );
}
